-- HAY Armenian language data registry.
-- Apply after 007_commercial_core.sql in the dedicated HAY Supabase project.
-- The curated in-code dictionary remains the deterministic fallback; this layer adds
-- reviewed system entries plus account/business-specific pronunciation overrides.

create table if not exists public.pronunciation_entries (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('system','account','business')),
  owner_id uuid references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  written text not null check (char_length(btrim(written)) between 1 and 160),
  written_key text generated always as (upper(btrim(written))) stored,
  spoken_hy_eastern text not null check (char_length(btrim(spoken_hy_eastern)) between 1 and 240),
  spoken_hy_western text not null check (char_length(btrim(spoken_hy_western)) between 1 and 240),
  category text not null default 'general' check (category in ('brand','acronym','finance','technology','social','place','person','product','general')),
  source_type text not null check (source_type in ('hay-reviewed','account-custom','business-custom','licensed','consented-correction','imported')),
  source_reference text,
  license_code text,
  consent_reference text,
  status text not null default 'active' check (status in ('active','draft','rejected','archived')),
  version integer not null default 1 check (version > 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'system' and owner_id is null and business_id is null)
    or (scope = 'account' and owner_id is not null and business_id is null)
    or (scope = 'business' and owner_id is not null and business_id is not null)
  )
);

create unique index if not exists pronunciation_system_written_uq
on public.pronunciation_entries(written_key) where scope = 'system';

create unique index if not exists pronunciation_account_written_uq
on public.pronunciation_entries(owner_id, written_key) where scope = 'account';

create unique index if not exists pronunciation_business_written_uq
on public.pronunciation_entries(business_id, written_key) where scope = 'business';

create index if not exists pronunciation_runtime_idx
on public.pronunciation_entries(scope, status, owner_id, business_id, written_key);

create table if not exists public.pronunciation_entry_audit (
  id uuid primary key default gen_random_uuid(),
  pronunciation_id uuid not null references public.pronunciation_entries(id) on delete restrict,
  version integer not null,
  action text not null check (action in ('insert','update')),
  actor_id uuid references auth.users(id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists pronunciation_audit_entry_idx
on public.pronunciation_entry_audit(pronunciation_id, version desc);

create or replace function public.hay_pronunciation_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.hay_pronunciation_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pronunciation_entry_audit (
    pronunciation_id,
    version,
    action,
    actor_id,
    snapshot
  ) values (
    new.id,
    new.version,
    lower(TG_OP),
    coalesce((select auth.uid()), new.created_by, new.owner_id),
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function public.hay_pronunciation_before_update() from public;
revoke all on function public.hay_pronunciation_audit() from public;

drop trigger if exists pronunciation_entries_version_trigger on public.pronunciation_entries;
create trigger pronunciation_entries_version_trigger
before update on public.pronunciation_entries
for each row execute function public.hay_pronunciation_before_update();

drop trigger if exists pronunciation_entries_audit_insert on public.pronunciation_entries;
create trigger pronunciation_entries_audit_insert
after insert on public.pronunciation_entries
for each row execute function public.hay_pronunciation_audit();

drop trigger if exists pronunciation_entries_audit_update on public.pronunciation_entries;
create trigger pronunciation_entries_audit_update
after update on public.pronunciation_entries
for each row execute function public.hay_pronunciation_audit();

alter table public.pronunciation_entries enable row level security;
alter table public.pronunciation_entry_audit enable row level security;

-- These tables are deliberately not exposed to browser clients. Owner-facing HAY
-- routes authenticate the user, then use the server-only admin client. This keeps
-- provenance and review metadata behind one controlled application boundary.
revoke all on public.pronunciation_entries, public.pronunciation_entry_audit from anon, authenticated;
grant select, insert, update on public.pronunciation_entries to service_role;
grant select, insert on public.pronunciation_entry_audit to service_role;

comment on table public.pronunciation_entries is 'Current HAY reviewed/system and owner/business pronunciation overrides. In-code curated core remains fallback.';
comment on table public.pronunciation_entry_audit is 'Append-only snapshot history for pronunciation provenance and version review.';
