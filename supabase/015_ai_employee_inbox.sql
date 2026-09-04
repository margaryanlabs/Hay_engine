-- HAY AI Employee operational inbox.
-- Apply after 014_ai_employees.sql.
-- Converts confirmed employee actions into owner-visible business work without pretending external systems were updated.

create table if not exists public.ai_employee_inbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id uuid not null references public.ai_employees(id) on delete cascade,
  session_id uuid references public.ai_employee_sessions(id) on delete set null,
  action_id uuid not null references public.ai_employee_actions(id) on delete cascade,
  kind text not null check (kind in ('appointment_request','lead','callback','order')),
  status text not null default 'open' check (status in ('open','accepted','completed','cancelled')),
  customer_name text,
  phone text,
  scheduled_for timestamptz,
  title text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (action_id)
);

create index if not exists ai_employee_inbox_business_idx on public.ai_employee_inbox(business_id,status,created_at desc);
create index if not exists ai_employee_inbox_schedule_idx on public.ai_employee_inbox(business_id,scheduled_for) where scheduled_for is not null;

alter table public.ai_employee_inbox enable row level security;
revoke all on public.ai_employee_inbox from anon;
grant select,insert,update,delete on public.ai_employee_inbox to authenticated;

create policy "owners employee inbox select" on public.ai_employee_inbox for select to authenticated using ((select auth.uid())=owner_id);
create policy "owners employee inbox insert" on public.ai_employee_inbox for insert to authenticated with check (
  (select auth.uid())=owner_id
  and exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))
  and exists(select 1 from public.ai_employees e where e.id=employee_id and e.owner_id=(select auth.uid()))
);
create policy "owners employee inbox update" on public.ai_employee_inbox for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "owners employee inbox delete" on public.ai_employee_inbox for delete to authenticated using ((select auth.uid())=owner_id);

comment on table public.ai_employee_inbox is 'Confirmed HAY Employee work captured for the business. appointment_request is intentionally not equivalent to an externally confirmed booking.';