-- HAY commercial core: plan entitlements + append-only usage ledger.
-- Apply after 006_first_party_attribution.sql.

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

create index if not exists usage_events_owner_period_idx on public.usage_events(owner_id, created_at desc);
create index if not exists usage_events_business_idx on public.usage_events(business_id, created_at desc) where business_id is not null;

alter table public.account_entitlements enable row level security;
alter table public.usage_events enable row level security;

revoke all on public.account_entitlements, public.usage_events from anon;
grant select, insert, update on public.account_entitlements to authenticated;
grant select, insert on public.usage_events to authenticated;

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
comment on table public.usage_events is 'Append-only per-account usage ledger for HAY plan enforcement.';
