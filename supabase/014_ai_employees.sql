-- HAY AI Employee: Armenian-first business employee configuration, call/session outcomes and gated actions.
-- Apply after 013_atomic_billing_events.sql.
-- Raw call audio and full transcripts are intentionally NOT stored here by default.

create table if not exists public.ai_employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null default 'receptionist' check (role in ('receptionist','dispatcher','sales','orders')),
  locale text not null default 'hy-AM' check (locale in ('hy-AM','en','ru')),
  speech_style text not null default 'natural' check (speech_style in ('standard','natural','yerevan')),
  greeting text not null default 'Բարև ձեզ։ Ինչո՞վ կարող եմ օգնել։' check (char_length(greeting) between 1 and 500),
  voice_id text,
  status text not null default 'draft' check (status in ('draft','active','paused')),
  capabilities jsonb not null default '{"appointments":true,"leads":true,"callbacks":true,"orders":false,"humanHandoff":true}'::jsonb,
  action_policy jsonb not null default '{"requireCallerConfirmation":true,"autoExecute":[],"neverExecute":[]}'::jsonb,
  business_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_employee_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  employee_id uuid not null references public.ai_employees(id) on delete cascade,
  channel text not null default 'phone' check (channel in ('web','phone','whatsapp','telegram')),
  provider text,
  external_session_id text,
  state text not null default 'active' check (state in ('active','completed','handoff','failed')),
  caller_hash text,
  caller_masked text,
  consent_to_record boolean not null default false,
  raw_transcript_retained boolean not null default false,
  summary text,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_session_id)
);

create table if not exists public.ai_employee_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.ai_employees(id) on delete cascade,
  session_id uuid references public.ai_employee_sessions(id) on delete set null,
  action_type text not null check (action_type in ('book_appointment','create_lead','create_callback','take_order','handoff_human')),
  status text not null default 'proposed' check (status in ('proposed','confirmed','executed','rejected','failed')),
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, dedupe_key)
);

create index if not exists ai_employees_owner_idx on public.ai_employees(owner_id, created_at desc);
create index if not exists ai_employees_business_idx on public.ai_employees(business_id, status);
create index if not exists ai_employee_sessions_employee_idx on public.ai_employee_sessions(employee_id, started_at desc);
create index if not exists ai_employee_actions_employee_idx on public.ai_employee_actions(employee_id, created_at desc);

alter table public.ai_employees enable row level security;
alter table public.ai_employee_sessions enable row level security;
alter table public.ai_employee_actions enable row level security;

revoke all on public.ai_employees, public.ai_employee_sessions, public.ai_employee_actions from anon;
grant select, insert, update, delete on public.ai_employees, public.ai_employee_sessions, public.ai_employee_actions to authenticated;

create policy "owners employees select" on public.ai_employees for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners employees insert" on public.ai_employees for insert to authenticated with check (
  (select auth.uid()) = owner_id and (business_id is null or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
);
create policy "owners employees update" on public.ai_employees for update to authenticated using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id and (business_id is null or exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
);
create policy "owners employees delete" on public.ai_employees for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "owners employee sessions select" on public.ai_employee_sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners employee sessions insert" on public.ai_employee_sessions for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists(select 1 from public.ai_employees e where e.id=employee_id and e.owner_id=(select auth.uid()))
);
create policy "owners employee sessions update" on public.ai_employee_sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners employee sessions delete" on public.ai_employee_sessions for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "owners employee actions select" on public.ai_employee_actions for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners employee actions insert" on public.ai_employee_actions for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists(select 1 from public.ai_employees e where e.id=employee_id and e.owner_id=(select auth.uid()))
);
create policy "owners employee actions update" on public.ai_employee_actions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners employee actions delete" on public.ai_employee_actions for delete to authenticated using ((select auth.uid()) = owner_id);

comment on table public.ai_employees is 'Owner-scoped HAY AI Employee configuration. Provider credentials never belong in this table.';
comment on table public.ai_employee_sessions is 'Privacy-first call/session outcome ledger. Raw audio/transcript retention is opt-in, not default.';
comment on table public.ai_employee_actions is 'Auditable side-effect proposals and executions produced by HAY action gates.';