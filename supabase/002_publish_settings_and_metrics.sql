-- Apply after supabase/schema.sql in the dedicated HAY project.

alter table public.publish_jobs
  add column if not exists provider_settings jsonb not null default '{}'::jsonb;

create table if not exists public.content_metrics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  platform text not null,
  external_post_id text,
  measured_at timestamptz not null default now(),
  impressions bigint,
  reach bigint,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  clicks bigint,
  conversions bigint,
  watch_time_seconds numeric,
  raw jsonb not null default '{}'::jsonb
);

create index if not exists content_metrics_item_time_idx on public.content_metrics(content_item_id, measured_at desc);
create index if not exists content_metrics_business_time_idx on public.content_metrics(business_id, measured_at desc);

alter table public.content_metrics enable row level security;
revoke all on public.content_metrics from anon;
grant select, insert, update, delete on public.content_metrics to authenticated;

create policy "owners metrics select" on public.content_metrics for select to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners metrics insert" on public.content_metrics for insert to authenticated
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners metrics update" on public.content_metrics for update to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
create policy "owners metrics delete" on public.content_metrics for delete to authenticated
using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())));
