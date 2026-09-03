-- HAY verified billing event ordering + replay protection.
-- Apply after 012_atomic_developer_api_requests.sql.
--
-- A billing provider adapter must verify the provider webhook/signature first, then call
-- /api/billing/sync with the provider event id, provider event creation time and exact
-- billing period. This migration makes that trusted sync atomic and replay-safe.

alter table public.account_entitlements
  add column if not exists billing_event_created_at timestamptz,
  add column if not exists billing_event_id text;

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 1 and 64),
  event_id text not null check (char_length(btrim(event_id)) between 1 and 255),
  event_created_at timestamptz not null,
  plan_id text not null check (plan_id in ('free','creator','growth','business','agency')),
  status text not null check (status in ('active','trialing','past_due','canceled','paused')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  overrides jsonb not null default '{}'::jsonb,
  applied boolean not null default false,
  reason text,
  received_at timestamptz not null default now(),
  unique (provider, event_id),
  check (current_period_end > current_period_start)
);

create index if not exists billing_events_owner_created_idx
  on public.billing_events(owner_id, event_created_at desc, received_at desc);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;
grant select, insert on public.billing_events to service_role;

create or replace function public.hay_apply_billing_entitlement(
  p_owner_id uuid,
  p_plan_id text,
  p_status text,
  p_provider text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_overrides jsonb,
  p_event_id text,
  p_event_created_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entitlement public.account_entitlements%rowtype;
  v_existing public.billing_events%rowtype;
  v_provider text := lower(left(btrim(coalesce(p_provider,'')),64));
  v_event_id text := left(btrim(coalesce(p_event_id,'')),255);
  v_customer text := nullif(left(btrim(coalesce(p_provider_customer_id,'')),255),'');
  v_subscription text := nullif(left(btrim(coalesce(p_provider_subscription_id,'')),255),'');
  v_overrides jsonb := coalesce(p_overrides,'{}'::jsonb);
begin
  if p_owner_id is null then
    return jsonb_build_object('applied',false,'reason','owner_required');
  end if;
  if p_plan_id not in ('free','creator','growth','business','agency') then
    return jsonb_build_object('applied',false,'reason','invalid_plan');
  end if;
  if p_status not in ('active','trialing','past_due','canceled','paused') then
    return jsonb_build_object('applied',false,'reason','invalid_status');
  end if;
  if v_provider = '' then
    return jsonb_build_object('applied',false,'reason','provider_required');
  end if;
  if v_event_id = '' then
    return jsonb_build_object('applied',false,'reason','provider_event_id_required');
  end if;
  if p_event_created_at is null then
    return jsonb_build_object('applied',false,'reason','provider_event_created_at_required');
  end if;
  if p_event_created_at > now() + interval '10 minutes' then
    return jsonb_build_object('applied',false,'reason','provider_event_time_in_future');
  end if;
  if p_current_period_start is null or p_current_period_end is null or p_current_period_end <= p_current_period_start then
    return jsonb_build_object('applied',false,'reason','invalid_billing_period');
  end if;
  if jsonb_typeof(v_overrides) <> 'object' then
    return jsonb_build_object('applied',false,'reason','invalid_overrides');
  end if;

  -- Ensure there is exactly one owner row to lock. The auth.users FK prevents creating
  -- an entitlement for an unknown owner. Any exception rolls back the whole event.
  insert into public.account_entitlements(
    owner_id, plan_id, status, current_period_start, current_period_end
  ) values (
    p_owner_id, 'free', 'active', p_current_period_start, p_current_period_end
  ) on conflict (owner_id) do nothing;

  select * into v_entitlement
  from public.account_entitlements
  where owner_id = p_owner_id
  for update;

  if not found then
    return jsonb_build_object('applied',false,'reason','owner_not_found');
  end if;

  select * into v_existing
  from public.billing_events
  where provider = v_provider and event_id = v_event_id
  limit 1;

  if found then
    return jsonb_build_object(
      'applied',v_existing.applied,
      'duplicate',true,
      'stale',coalesce(v_existing.reason='stale_event',false),
      'reason',coalesce(v_existing.reason,'duplicate_event'),
      'eventId',v_existing.id,
      'planId',v_entitlement.plan_id,
      'status',v_entitlement.status,
      'billingEventCreatedAt',v_entitlement.billing_event_created_at,
      'billingEventId',v_entitlement.billing_event_id
    );
  end if;

  -- Strictly older verified provider events may be recorded for audit but must never
  -- overwrite a newer entitlement. Equal provider timestamps are serialized by this
  -- owner-row lock and therefore resolve in trusted adapter arrival order.
  if v_entitlement.billing_event_created_at is not null
     and p_event_created_at < v_entitlement.billing_event_created_at then
    insert into public.billing_events(
      owner_id,provider,event_id,event_created_at,plan_id,status,
      provider_customer_id,provider_subscription_id,
      current_period_start,current_period_end,overrides,applied,reason
    ) values (
      p_owner_id,v_provider,v_event_id,p_event_created_at,p_plan_id,p_status,
      v_customer,v_subscription,p_current_period_start,p_current_period_end,
      v_overrides,false,'stale_event'
    ) returning * into v_existing;

    return jsonb_build_object(
      'applied',false,
      'duplicate',false,
      'stale',true,
      'reason','stale_event',
      'eventId',v_existing.id,
      'planId',v_entitlement.plan_id,
      'status',v_entitlement.status,
      'billingEventCreatedAt',v_entitlement.billing_event_created_at,
      'billingEventId',v_entitlement.billing_event_id
    );
  end if;

  update public.account_entitlements
  set plan_id = p_plan_id,
      status = p_status,
      provider = v_provider,
      provider_customer_id = v_customer,
      provider_subscription_id = v_subscription,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      overrides = v_overrides,
      billing_event_created_at = p_event_created_at,
      billing_event_id = v_event_id,
      updated_at = now()
  where owner_id = p_owner_id
  returning * into v_entitlement;

  insert into public.billing_events(
    owner_id,provider,event_id,event_created_at,plan_id,status,
    provider_customer_id,provider_subscription_id,
    current_period_start,current_period_end,overrides,applied,reason
  ) values (
    p_owner_id,v_provider,v_event_id,p_event_created_at,p_plan_id,p_status,
    v_customer,v_subscription,p_current_period_start,p_current_period_end,
    v_overrides,true,null
  ) returning * into v_existing;

  return jsonb_build_object(
    'applied',true,
    'duplicate',false,
    'stale',false,
    'eventId',v_existing.id,
    'planId',v_entitlement.plan_id,
    'status',v_entitlement.status,
    'currentPeriodStart',v_entitlement.current_period_start,
    'currentPeriodEnd',v_entitlement.current_period_end,
    'billingEventCreatedAt',v_entitlement.billing_event_created_at,
    'billingEventId',v_entitlement.billing_event_id
  );
exception
  when foreign_key_violation then
    return jsonb_build_object('applied',false,'reason','owner_not_found');
  when unique_violation then
    select * into v_existing
    from public.billing_events
    where provider = v_provider and event_id = v_event_id
    limit 1;
    if found then
      select * into v_entitlement
      from public.account_entitlements
      where owner_id = p_owner_id
      limit 1;
      return jsonb_build_object(
        'applied',v_existing.applied,
        'duplicate',true,
        'stale',coalesce(v_existing.reason='stale_event',false),
        'reason',coalesce(v_existing.reason,'duplicate_event'),
        'eventId',v_existing.id,
        'planId',v_entitlement.plan_id,
        'status',v_entitlement.status,
        'billingEventCreatedAt',v_entitlement.billing_event_created_at,
        'billingEventId',v_entitlement.billing_event_id
      );
    end if;
    return jsonb_build_object('applied',false,'reason','billing_event_conflict');
end;
$$;

revoke all on function public.hay_apply_billing_entitlement(uuid,text,text,text,text,text,timestamptz,timestamptz,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function public.hay_apply_billing_entitlement(uuid,text,text,text,text,text,timestamptz,timestamptz,jsonb,text,timestamptz) to service_role;

comment on table public.billing_events is
  'Append-only verified billing event audit. provider+event_id is replay-protected; stale events are recorded but never applied.';
comment on function public.hay_apply_billing_entitlement(uuid,text,text,text,text,text,timestamptz,timestamptz,jsonb,text,timestamptz) is
  'Server-only atomic entitlement application for already-verified provider events, with replay and stale-event protection.';
