-- HAY consent-aware Armenian correction flywheel + general dataset provenance registry.
-- Apply after 008_language_registry.sql in the dedicated HAY Supabase project only.

create table if not exists public.language_corrections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  correction_type text not null check (correction_type in ('pronunciation','transcript','translation','copy','code-switch','name-brand-place','other')),
  locale text not null default 'hy-AM' check (char_length(locale) between 2 and 24),
  source_text text not null check (char_length(btrim(source_text)) between 1 and 20000),
  system_text text,
  corrected_text text not null check (char_length(btrim(corrected_text)) between 1 and 20000),
  context jsonb not null default '{}'::jsonb,
  source_endpoint text,
  source_request_id text,
  consent_product_improvement boolean not null default false,
  consent_benchmark boolean not null default false,
  consent_model_training boolean not null default false,
  consent_version text not null default 'hay-consent-2026.09-v1',
  consent_recorded_at timestamptz not null default now(),
  consent_withdrawn_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted','reviewing','accepted','rejected','withdrawn')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  promoted_pronunciation_id uuid references public.pronunciation_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (consent_withdrawn_at is null or status = 'withdrawn')
);

create index if not exists language_corrections_owner_idx
on public.language_corrections(owner_id, created_at desc);

create index if not exists language_corrections_review_idx
on public.language_corrections(status, correction_type, created_at);

create table if not exists public.language_correction_audit (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid not null references public.language_corrections(id) on delete restrict,
  action text not null check (action in ('insert','update')),
  actor_id uuid references auth.users(id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists language_correction_audit_idx
on public.language_correction_audit(correction_id, created_at desc);

create table if not exists public.dataset_records (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null check (char_length(btrim(dataset_key)) between 1 and 120),
  record_type text not null check (record_type in ('pronunciation','transcript','translation','copy','code-switch','name-brand-place','benchmark','other')),
  locale text not null default 'hy-AM',
  content_hash text not null check (char_length(content_hash) = 64),
  payload jsonb not null,
  source_type text not null check (source_type in ('hay-curated','licensed','public-domain','consented-user-correction','imported')),
  source_reference text,
  license_code text,
  consent_reference text,
  owner_id uuid references auth.users(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  origin_correction_id uuid unique references public.language_corrections(id) on delete set null,
  status text not null default 'candidate' check (status in ('candidate','approved','withdrawn','archived')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists dataset_record_hash_uq
on public.dataset_records(dataset_key, content_hash) where status in ('candidate','approved');

create index if not exists dataset_records_provenance_idx
on public.dataset_records(dataset_key, source_type, status, created_at desc);

create or replace function public.hay_language_correction_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.hay_language_correction_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.language_correction_audit(correction_id, action, actor_id, snapshot)
  values(new.id, lower(TG_OP), coalesce((select auth.uid()), new.owner_id), to_jsonb(new));
  return new;
end;
$$;

create or replace function public.hay_dataset_record_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.hay_language_correction_before_update() from public;
revoke all on function public.hay_language_correction_audit() from public;
revoke all on function public.hay_dataset_record_before_update() from public;

drop trigger if exists language_corrections_updated_at on public.language_corrections;
create trigger language_corrections_updated_at
before update on public.language_corrections
for each row execute function public.hay_language_correction_before_update();

drop trigger if exists language_corrections_audit_insert on public.language_corrections;
create trigger language_corrections_audit_insert
after insert on public.language_corrections
for each row execute function public.hay_language_correction_audit();

drop trigger if exists language_corrections_audit_update on public.language_corrections;
create trigger language_corrections_audit_update
after update on public.language_corrections
for each row execute function public.hay_language_correction_audit();

drop trigger if exists dataset_records_updated_at on public.dataset_records;
create trigger dataset_records_updated_at
before update on public.dataset_records
for each row execute function public.hay_dataset_record_before_update();

alter table public.language_corrections enable row level security;
alter table public.language_correction_audit enable row level security;
alter table public.dataset_records enable row level security;

-- All three tables stay behind server-side application boundaries. User routes authenticate
-- an owner before service-role access; reviewer routes additionally require an operator allowlist.
revoke all on public.language_corrections, public.language_correction_audit, public.dataset_records from anon, authenticated;
grant select, insert, update on public.language_corrections to service_role;
grant select, insert on public.language_correction_audit to service_role;
grant select, insert, update on public.dataset_records to service_role;

comment on table public.language_corrections is 'Consent-aware user corrections. Private submission is allowed without reuse consent; promotion requires explicit product-improvement consent.';
comment on table public.dataset_records is 'General HAY dataset provenance/license/consent registry. Approved records are eligible for reviewed datasets; model-training consent remains a separate flag on the originating correction.';
