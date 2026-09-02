-- Apply after 003_publish_worker_state.sql (and 002 for provider_settings).
-- Publishing automation is opt-in per connected channel. Default remains human approval.

alter table public.social_connections
  add column if not exists automation_mode text not null default 'approval',
  add column if not exists publish_defaults jsonb not null default '{}'::jsonb;

alter table public.social_connections drop constraint if exists social_connections_automation_mode_check;
alter table public.social_connections
  add constraint social_connections_automation_mode_check
  check (automation_mode in ('manual','approval','autoqueue'));

-- Prevent duplicate active delivery attempts for one content item.
create unique index if not exists publish_jobs_one_active_per_content_idx
  on public.publish_jobs(content_item_id)
  where status in ('queued','processing','needs_auth','needs_approval');
