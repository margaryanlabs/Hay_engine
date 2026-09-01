-- Apply after the prior HAY migrations in the dedicated HAY project.

alter table public.creator_projects
  add column if not exists content_item_id uuid references public.content_items(id) on delete set null;
create index if not exists creator_projects_content_item_idx on public.creator_projects(content_item_id);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','rendering','rendered','failed')),
  output_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists render_jobs_project_idx on public.render_jobs(project_id, created_at desc);

alter table public.render_jobs enable row level security;
revoke all on public.render_jobs from anon;
grant select, insert, update, delete on public.render_jobs to authenticated;

create policy "creator owners render select" on public.render_jobs for select to authenticated
using (exists (select 1 from public.creator_projects cp where cp.id = project_id and cp.owner_id = (select auth.uid())));
create policy "creator owners render insert" on public.render_jobs for insert to authenticated
with check (exists (select 1 from public.creator_projects cp where cp.id = project_id and cp.owner_id = (select auth.uid())));
create policy "creator owners render update" on public.render_jobs for update to authenticated
using (exists (select 1 from public.creator_projects cp where cp.id = project_id and cp.owner_id = (select auth.uid())))
with check (exists (select 1 from public.creator_projects cp where cp.id = project_id and cp.owner_id = (select auth.uid())));
create policy "creator owners render delete" on public.render_jobs for delete to authenticated
using (exists (select 1 from public.creator_projects cp where cp.id = project_id and cp.owner_id = (select auth.uid())));

-- Private working assets + public final renders. The service-role worker writes both;
-- only final renders are public because Instagram/TikTok need server-accessible media URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('hay-assets', 'hay-assets', false, 1073741824)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hay-renders', 'hay-renders', true, 1073741824, array['video/mp4'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
