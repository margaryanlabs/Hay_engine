-- HAY first-party attribution. Apply after schema.sql.
-- Public redirect/event routes use the server-side service role; anon receives no table grants.

create table if not exists public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  slug text not null unique,
  destination_url text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  tracking_link_id uuid not null references public.tracking_links(id) on delete cascade,
  click_id uuid not null,
  event_type text not null check (event_type in ('click','lead','booking','order','signup','purchase')),
  event_key text unique,
  value numeric,
  currency text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists tracking_links_business_idx on public.tracking_links(business_id, created_at desc);
create index if not exists tracking_links_content_idx on public.tracking_links(content_item_id, created_at desc);
create index if not exists attribution_events_business_time_idx on public.attribution_events(business_id, occurred_at desc);
create index if not exists attribution_events_content_time_idx on public.attribution_events(content_item_id, occurred_at desc);
create index if not exists attribution_events_click_idx on public.attribution_events(click_id, occurred_at desc);

alter table public.tracking_links enable row level security;
alter table public.attribution_events enable row level security;
revoke all on public.tracking_links, public.attribution_events from anon;
grant select, insert, update, delete on public.tracking_links to authenticated;
grant select on public.attribution_events to authenticated;

create policy "owners tracking links select" on public.tracking_links for select to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "owners tracking links insert" on public.tracking_links for insert to authenticated
with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "owners tracking links update" on public.tracking_links for update to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "owners tracking links delete" on public.tracking_links for delete to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "owners attribution select" on public.attribution_events for select to authenticated
using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
