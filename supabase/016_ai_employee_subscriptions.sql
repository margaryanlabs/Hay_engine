-- HAY AI Employee subscriptions + atomic call admission.
-- Apply after 014_ai_employees.sql and 015_ai_employee_inbox.sql.
-- A call reserves its maximum allowed duration before realtime provider work so
-- concurrent calls cannot overspend the same included-minute pool.

create table if not exists public.ai_employee_entitlements (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null default 'employee_trial' check (plan_id in ('employee_trial','employee_reception','employee_business','employee_team')),
  status text not null default 'trialing' check (status in ('active','trialing','past_due','canceled','paused')),
  employee_seats integer not null default 1 check (employee_seats between 0 and 100),
  included_minutes integer not null default 30 check (included_minutes between 0 and 1000000),
  concurrent_calls integer not null default 1 check (concurrent_calls between 0 and 1000),
  max_call_minutes integer not null default 8 check (max_call_minutes between 1 and 120),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null default date_trunc('month',now()),
  current_period_end timestamptz not null default date_trunc('month',now())+interval '1 month',
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_employee_call_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.ai_employees(id) on delete cascade,
  session_id uuid references public.ai_employee_sessions(id) on delete set null,
  provider text not null default 'elevenlabs-speech-engine',
  external_session_id text not null,
  state text not null default 'active' check (state in ('active','consumed','failed','released')),
  reserved_seconds integer not null check (reserved_seconds >= 0),
  billable_seconds integer not null default 0 check (billable_seconds >= 0),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(provider,external_session_id)
);

create index if not exists ai_employee_entitlements_status_idx on public.ai_employee_entitlements(status,current_period_end);
create index if not exists ai_employee_call_usage_owner_period_idx on public.ai_employee_call_usage(owner_id,started_at desc);
create index if not exists ai_employee_call_usage_active_idx on public.ai_employee_call_usage(owner_id,state) where state='active';

alter table public.ai_employee_entitlements enable row level security;
alter table public.ai_employee_call_usage enable row level security;
revoke all on public.ai_employee_entitlements,public.ai_employee_call_usage from anon;
grant select,insert on public.ai_employee_entitlements to authenticated;
grant select on public.ai_employee_call_usage to authenticated;
grant select,insert,update,delete on public.ai_employee_entitlements,public.ai_employee_call_usage to service_role;

create policy "owners employee entitlement select" on public.ai_employee_entitlements for select to authenticated using ((select auth.uid())=owner_id);
create policy "owners employee trial insert" on public.ai_employee_entitlements for insert to authenticated with check (
  (select auth.uid())=owner_id and plan_id='employee_trial' and status='trialing' and employee_seats=1 and included_minutes=30 and concurrent_calls=1
);
create policy "owners employee usage select" on public.ai_employee_call_usage for select to authenticated using ((select auth.uid())=owner_id);

create or replace function public.hay_employee_admit_call(
  p_owner_id uuid,
  p_employee_id uuid,
  p_session_id uuid,
  p_provider text,
  p_external_session_id text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_entitlement public.ai_employee_entitlements%rowtype;
  v_existing public.ai_employee_call_usage%rowtype;
  v_active integer:=0;
  v_used_seconds bigint:=0;
  v_limit_seconds bigint:=0;
  v_remaining bigint:=0;
  v_reserve integer:=0;
  v_id uuid;
begin
  if p_owner_id is null or p_employee_id is null or p_session_id is null then
    return jsonb_build_object('allowed',false,'reason','employee_call_identity_required');
  end if;
  if nullif(trim(coalesce(p_external_session_id,'')),'') is null then
    return jsonb_build_object('allowed',false,'reason','external_session_id_required');
  end if;
  if not exists(select 1 from public.ai_employees e where e.id=p_employee_id and e.owner_id=p_owner_id and e.status='active') then
    return jsonb_build_object('allowed',false,'reason','employee_not_active');
  end if;

  insert into public.ai_employee_entitlements(owner_id)
  values(p_owner_id)
  on conflict(owner_id) do nothing;

  select * into v_entitlement from public.ai_employee_entitlements where owner_id=p_owner_id for update;
  if not found then return jsonb_build_object('allowed',false,'reason','employee_entitlement_required'); end if;
  if v_entitlement.status not in ('active','trialing') then return jsonb_build_object('allowed',false,'reason','employee_subscription_inactive'); end if;
  if now()>=v_entitlement.current_period_end then return jsonb_build_object('allowed',false,'reason','employee_period_expired'); end if;

  select * into v_existing from public.ai_employee_call_usage
  where provider=left(coalesce(nullif(trim(p_provider),''),'elevenlabs-speech-engine'),80)
    and external_session_id=left(p_external_session_id,240)
  limit 1;
  if found then
    if v_existing.owner_id<>p_owner_id or v_existing.employee_id<>p_employee_id then
      return jsonb_build_object('allowed',false,'reason','external_session_conflict');
    end if;
    return jsonb_build_object('allowed',v_existing.state='active','duplicate',true,'usageId',v_existing.id,'reservedSeconds',v_existing.reserved_seconds,'state',v_existing.state);
  end if;

  update public.ai_employee_call_usage
  set state='failed',ended_at=coalesce(ended_at,now()),metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('reason','stale_active_call_reaped')
  where owner_id=p_owner_id and state='active' and started_at<now()-interval '2 hours';

  select count(*) into v_active from public.ai_employee_call_usage where owner_id=p_owner_id and state='active';
  if v_active>=v_entitlement.concurrent_calls then return jsonb_build_object('allowed',false,'reason','employee_concurrency_limit_reached','activeCalls',v_active,'limit',v_entitlement.concurrent_calls); end if;

  select coalesce(sum(case when state='active' then reserved_seconds else billable_seconds end),0) into v_used_seconds
  from public.ai_employee_call_usage
  where owner_id=p_owner_id and started_at>=v_entitlement.current_period_start and started_at<v_entitlement.current_period_end and state in ('active','consumed');
  v_limit_seconds:=v_entitlement.included_minutes::bigint*60;
  v_remaining:=greatest(0,v_limit_seconds-v_used_seconds);
  if v_remaining<60 then return jsonb_build_object('allowed',false,'reason','employee_minutes_exhausted','remainingSeconds',v_remaining); end if;
  v_reserve:=least(v_entitlement.max_call_minutes*60,v_remaining)::integer;

  insert into public.ai_employee_call_usage(owner_id,employee_id,session_id,provider,external_session_id,state,reserved_seconds)
  values(p_owner_id,p_employee_id,p_session_id,left(coalesce(nullif(trim(p_provider),''),'elevenlabs-speech-engine'),80),left(p_external_session_id,240),'active',v_reserve)
  returning id into v_id;

  return jsonb_build_object('allowed',true,'usageId',v_id,'reservedSeconds',v_reserve,'remainingAfterReservation',v_remaining-v_reserve,'concurrentCalls',v_entitlement.concurrent_calls);
end;
$$;

create or replace function public.hay_employee_finish_call(
  p_owner_id uuid,
  p_usage_id uuid,
  p_duration_seconds integer,
  p_failed boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_row public.ai_employee_call_usage%rowtype;
  v_billable integer;
begin
  if p_owner_id is null or p_usage_id is null then return jsonb_build_object('finished',false,'reason','employee_call_identity_required'); end if;
  select * into v_row from public.ai_employee_call_usage where id=p_usage_id and owner_id=p_owner_id for update;
  if not found then return jsonb_build_object('finished',false,'reason','employee_call_usage_not_found'); end if;
  if v_row.state<>'active' then return jsonb_build_object('finished',true,'duplicate',true,'state',v_row.state,'billableSeconds',v_row.billable_seconds); end if;
  if p_failed and coalesce(p_duration_seconds,0)<=0 then v_billable:=0;
  else v_billable:=least(v_row.reserved_seconds,greatest(1,coalesce(p_duration_seconds,extract(epoch from (now()-v_row.started_at))::integer)));
  end if;
  update public.ai_employee_call_usage
  set state=case when p_failed then 'failed' else 'consumed' end,billable_seconds=v_billable,ended_at=now(),metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb)
  where id=v_row.id;
  return jsonb_build_object('finished',true,'state',case when p_failed then 'failed' else 'consumed' end,'billableSeconds',v_billable,'reservedSeconds',v_row.reserved_seconds);
end;
$$;

revoke all on function public.hay_employee_admit_call(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.hay_employee_finish_call(uuid,uuid,integer,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.hay_employee_admit_call(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.hay_employee_finish_call(uuid,uuid,integer,boolean,jsonb) to service_role;

comment on table public.ai_employee_entitlements is 'Separate monthly subscription entitlement for HAY AI Employee seats, minutes and call concurrency.';
comment on table public.ai_employee_call_usage is 'Atomic per-call reservation and final billable usage ledger. Raw call audio is not stored.';
