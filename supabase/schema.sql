-- HAY Engine persistence schema.
-- Apply this only to a dedicated HAY Supabase project after review.
-- Raw OAuth access/refresh tokens are intentionally NOT stored in public tables.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null default '',
  website text,
  location text,
  primary_language text not null default 'hy' check (primary_language in ('hy','en','ru')),
  goals jsonb not null default '[]'::jsonb,
  audience text,
  offer text,
  tone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok','youtube','facebook','linkedin')),
  status text not null default 'pending' check (status in ('pending','connected','expired','error','disconnected')),
  account_id text,
  account_name text,
  credential_ref text,
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz,
  connected_at timestamptz,
  unique (business_id, platform, account_id)
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  url text,
  handle text,
  platform text,
  last_snapshot jsonb,
  last_analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  horizon_days integer not null default 7 check (horizon_days between 1 and 90),
  strategy jsonb not null default '{}'::jsonb,
  generated_by text not null default 'hay-demo',
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id uuid references public.marketing_plans(id) on delete set null,
  platform text not null,
  format text not null,
  language text not null default 'hy',
  objective text,
  hook text not null default '',
  concept text not null default '',
  caption text not null default '',
  cta text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  asset_brief text not null default '',
  asset_url text,
  status text not null default 'idea' check (status in ('idea','draft','approved','scheduled','published','failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  status text not null default 'planned',
  manifest jsonb not null,
  output_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  connection_id uuid references public.social_connections(id) on delete set null,
  platform text not null,
  status text not null default 'queued' check (status in ('queued','processing','needs_auth','published','failed')),
  scheduled_for timestamptz,
  external_post_id text,
  error text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_owner_idx on public.businesses(owner_id);
create index if not exists content_business_status_idx on public.content_items(business_id, status);
create index if not exists content_schedule_idx on public.content_items(scheduled_for) where scheduled_for is not null;
create index if not exists publish_jobs_schedule_idx on public.publish_jobs(status, scheduled_for);

alter table public.businesses enable row level security;
alter table public.social_connections enable row level security;
alter table public.competitors enable row level security;
alter table public.marketing_plans enable row level security;
alter table public.content_items enable row level security;
alter table public.creator_projects enable row level security;
alter table public.publish_jobs enable row level security;

revoke all on public.businesses, public.social_connections, public.competitors, public.marketing_plans, public.content_items, public.creator_projects, public.publish_jobs from anon;
grant select, insert, update, delete on public.businesses, public.social_connections, public.competitors, public.marketing_plans, public.content_items, public.creator_projects, public.publish_jobs to authenticated;

create policy "business owners select" on public.businesses for select to authenticated using ((select auth.uid()) = owner_id);
create policy "business owners insert" on public.businesses for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "business owners update" on public.businesses for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "business owners delete" on public.businesses for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "owners social select" on public.social_connections for select to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners social insert" on public.social_connections for insert to authenticated with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners social update" on public.social_connections for update to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners social delete" on public.social_connections for delete to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy "owners competitors all select" on public.competitors for select to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners competitors insert" on public.competitors for insert to authenticated with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners competitors update" on public.competitors for update to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners competitors delete" on public.competitors for delete to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy "owners plans select" on public.marketing_plans for select to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners plans insert" on public.marketing_plans for insert to authenticated with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners plans update" on public.marketing_plans for update to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners plans delete" on public.marketing_plans for delete to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy "owners content select" on public.content_items for select to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners content insert" on public.content_items for insert to authenticated with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners content update" on public.content_items for update to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners content delete" on public.content_items for delete to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));

create policy "creator project owners select" on public.creator_projects for select to authenticated using ((select auth.uid()) = owner_id);
create policy "creator project owners insert" on public.creator_projects for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "creator project owners update" on public.creator_projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "creator project owners delete" on public.creator_projects for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "owners jobs select" on public.publish_jobs for select to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners jobs insert" on public.publish_jobs for insert to authenticated with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners jobs update" on public.publish_jobs for update to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners jobs delete" on public.publish_jobs for delete to authenticated using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
