-- HAY commercial core: plan entitlements + Studio usage + developer API metering.
-- Apply after 006_first_party_attribution.sql.
-- This migration has not been applied to a dedicated HAY project yet; keep it canonical until first HAY database launch.

create table if not exists public.account_entitlements (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'free' check (plan_id in ('free','creator','growth','business','agency')),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','paused')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  meter text not null check (meter in ('content_assets','ai_video_credits','voice_minutes')),
  quantity numeric(12,3) not null check (quantity > 0),
  source text not null default 'app',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

-- Developer keys are application credentials, not Supabase platform keys.
-- Only SHA-256 hashes are stored. The raw `hay_live_...` key is returned once by trusted server code.
create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['language'],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (array_length(scopes, 1) between 1 and 20)
);

create table if not exists public.developer_api_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  api_key_id uuid not null references public.developer_api_keys(id) on delete cascade,
  endpoint text not null,
  operation text not null,
  request_count integer not null default 1 check (request_count > 0),
  input_chars integer not null default 0 check (input_chars >= 0),
  audio_bytes bigint not null default 0 check (audio_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_owner_period_idx on public.usage_events(owner_id, created_at desc);
create index if not exists usage_events_business_idx on public.usage_events(business_id, created_at desc) where business_id is not null;
create index if not exists developer_api_keys_owner_idx on public.developer_api_keys(owner_id, created_at desc);
create index if not exists developer_api_keys_active_hash_idx on public.developer_api_keys(key_hash) where revoked_at is null;
create index if not exists developer_api_usage_owner_period_idx on public.developer_api_usage(owner_id, created_at desc);
create index if not exists developer_api_usage_key_period_idx on public.developer_api_usage(api_key_id, created_at desc);

alter table public.account_entitlements enable row level security;
alter table public.usage_events enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.developer_api_usage enable row level security;

revoke all on public.account_entitlements, public.usage_events from anon;
grant select, insert, update on public.account_entitlements to authenticated;
grant select, insert on public.usage_events to authenticated;

-- Developer credentials and API usage are intentionally server-only tables.
-- Owner-facing management routes first authenticate the Supabase user, then use the server-side admin client.
revoke all on public.developer_api_keys, public.developer_api_usage from anon, authenticated;
grant select, insert, update, delete on public.developer_api_keys, public.developer_api_usage to service_role;

create policy "owners entitlement select" on public.account_entitlements
for select to authenticated using ((select auth.uid()) = owner_id);

create policy "owners free entitlement insert" on public.account_entitlements
for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and plan_id = 'free'
  and status in ('active','trialing')
  and provider is null
  and provider_customer_id is null
  and provider_subscription_id is null
);

-- Paid plan/status/provider changes are intentionally NOT owner-updateable.
-- They should be written by a trusted billing webhook/service-role path.

create policy "owners usage select" on public.usage_events
for select to authenticated using ((select auth.uid()) = owner_id);

create policy "owners usage insert" on public.usage_events
for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and (business_id is null or exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_id = (select auth.uid())
  ))
);

comment on table public.account_entitlements is 'Canonical commercial entitlement. Paid changes require a trusted billing integration.';
comment on table public.usage_events is 'Append-only per-account Studio usage ledger for HAY plan enforcement.';
comment on table public.developer_api_keys is 'Server-only HAY developer credentials. Stores SHA-256 hashes only; raw keys are never persisted.';
comment on table public.developer_api_usage is 'Server-only usage ledger for HAY developer API requests, separate from Studio subscription usage.';
