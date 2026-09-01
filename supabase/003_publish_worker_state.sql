-- Apply after 002_publish_settings_and_metrics.sql.
-- TikTok requires explicit user approval immediately before Direct Post, so HAY tracks
-- needs_approval separately from authentication failures.

alter table public.publish_jobs drop constraint if exists publish_jobs_status_check;
alter table public.publish_jobs
  add constraint publish_jobs_status_check
  check (status in ('queued','processing','needs_auth','needs_approval','published','failed'));

create index if not exists publish_jobs_due_idx
  on public.publish_jobs(status, scheduled_for, created_at)
  where status in ('queued','processing');
