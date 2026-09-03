-- HAY atomic commercial usage reservations.
-- Apply after 007_commercial_core.sql. This migration serializes quota-consuming
-- provider calls per account so concurrent requests cannot both spend the same
-- remaining plan capacity. Reservations count immediately and are committed on
-- provider success or released on provider failure.
--
-- Security model: these RPCs are SECURITY INVOKER and executable only by
-- service_role. The Next.js server authenticates the end user first, then its
-- server-only admin client supplies that authenticated owner UUID to these RPCs.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
alter extension pgcrypto set schema extensions;

alter table public.usage_events
  add column if not exists state text not null default 'consumed',
  add column if not exists reservation_token_hash text,
  add column if not exists reservation_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usage_events_state_check'
      and conrelid = 'public.usage_events'::regclass
  ) then
    alter table public.usage_events
      add constraint usage_events_state_check
      check (state in ('reserved','consumed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'usage_events_reservation_shape_check'
      and conrelid = 'public.usage_events'::regclass
  ) then
    alter table public.usage_events
      add constraint usage_events_reservation_shape_check
      check (
        (state = 'reserved' and reservation_token_hash is not null and reservation_expires_at is not null)
        or
        (state = 'consumed' and reservation_token_hash is null and reservation_expires_at is null)
      );
  end if;
end $$;

create index if not exists usage_events_active_reservation_idx
  on public.usage_events(owner_id, meter, reservation_expires_at)
  where state = 'reserved';

create or replace function public.hay_reserve_usage(
  p_owner_id uuid,
  p_meter text,
  p_quantity numeric,
  p_business_id uuid default null,
  p_source text default 'app',
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_release_token text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entitlement public.account_entitlements%rowtype;
  v_existing public.usage_events%rowtype;
  v_business_id uuid;
  v_used numeric := 0;
  v_limit numeric := 0;
  v_base_limit numeric := 0;
  v_override_key text;
  v_override_text text;
  v_event_id uuid;
  v_token_hash text;
  v_key text := nullif(left(trim(coalesce(p_idempotency_key,'')), 240), '');
  v_source text := left(coalesce(nullif(trim(p_source),''),'app'), 120);
begin
  if p_owner_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'owner_required');
  end if;
  if p_meter not in ('content_assets','ai_video_credits','voice_minutes') then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_meter');
  end if;
  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_quantity');
  end if;
  if p_release_token is null or char_length(p_release_token) < 32 then
    return jsonb_build_object('allowed', false, 'reason', 'release_token_required');
  end if;

  insert into public.account_entitlements(
    owner_id, plan_id, status, current_period_start, current_period_end
  ) values (
    p_owner_id,
    'free',
    'active',
    date_trunc('month', now()),
    date_trunc('month', now()) + interval '1 month'
  ) on conflict (owner_id) do nothing;

  select * into v_entitlement
  from public.account_entitlements
  where owner_id = p_owner_id
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'commercial_migration_required');
  end if;
  if v_entitlement.status not in ('active','trialing') then
    return jsonb_build_object('allowed', false, 'reason', 'subscription_inactive');
  end if;

  -- The entitlement row lock serializes every reservation for this account.
  delete from public.usage_events
  where owner_id = p_owner_id
    and state = 'reserved'
    and reservation_expires_at <= now();

  if v_key is not null then
    select * into v_existing
    from public.usage_events
    where owner_id = p_owner_id
      and idempotency_key = v_key
    limit 1;

    if found then
      if v_existing.state = 'consumed' then
        return jsonb_build_object(
          'allowed', true,
          'duplicate', true,
          'state', 'consumed',
          'eventId', v_existing.id,
          'metadata', coalesce(v_existing.metadata, '{}'::jsonb)
        );
      end if;
      return jsonb_build_object(
        'allowed', false,
        'duplicate', true,
        'reason', 'request_in_progress',
        'state', 'reserved',
        'eventId', v_existing.id
      );
    end if;
  end if;

  if p_business_id is not null then
    select id into v_business_id
    from public.businesses
    where id = p_business_id and owner_id = p_owner_id
    limit 1;
  end if;

  v_base_limit := case v_entitlement.plan_id
    when 'free' then case p_meter when 'content_assets' then 12 when 'ai_video_credits' then 1 else 5 end
    when 'creator' then case p_meter when 'content_assets' then 40 when 'ai_video_credits' then 6 else 30 end
    when 'growth' then case p_meter when 'content_assets' then 100 when 'ai_video_credits' then 20 else 120 end
    when 'business' then case p_meter when 'content_assets' then 300 when 'ai_video_credits' then 50 else 500 end
    when 'agency' then case p_meter when 'content_assets' then 1500 when 'ai_video_credits' then 250 else 2500 end
    else 0
  end;

  v_override_key := case p_meter
    when 'content_assets' then 'contentAssets'
    when 'ai_video_credits' then 'aiVideoCredits'
    else 'voiceMinutes'
  end;
  v_override_text := coalesce(v_entitlement.overrides, '{}'::jsonb) ->> v_override_key;
  if v_override_text is not null and v_override_text ~ '^[0-9]+([.][0-9]+)?$' then
    v_limit := greatest(0, v_override_text::numeric);
  else
    v_limit := v_base_limit;
  end if;

  select coalesce(sum(quantity),0) into v_used
  from public.usage_events
  where owner_id = p_owner_id
    and meter = p_meter
    and created_at >= v_entitlement.current_period_start
    and (
      state = 'consumed'
      or (state = 'reserved' and reservation_expires_at > now())
    );

  if v_used + p_quantity > v_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'plan_limit_reached',
      'used', v_used,
      'limit', v_limit,
      'requested', p_quantity
    );
  end if;

  v_token_hash := encode(extensions.digest(p_release_token, 'sha256'), 'hex');

  insert into public.usage_events(
    owner_id,
    business_id,
    meter,
    quantity,
    source,
    idempotency_key,
    metadata,
    state,
    reservation_token_hash,
    reservation_expires_at
  ) values (
    p_owner_id,
    v_business_id,
    p_meter,
    p_quantity,
    v_source,
    v_key,
    coalesce(p_metadata, '{}'::jsonb),
    'reserved',
    v_token_hash,
    now() + interval '1 hour'
  ) returning id into v_event_id;

  return jsonb_build_object(
    'allowed', true,
    'duplicate', false,
    'state', 'reserved',
    'eventId', v_event_id,
    'usedBefore', v_used,
    'limit', v_limit,
    'requested', p_quantity
  );
exception
  when unique_violation then
    if v_key is not null then
      select * into v_existing
      from public.usage_events
      where owner_id = p_owner_id and idempotency_key = v_key
      limit 1;
      if found and v_existing.state = 'consumed' then
        return jsonb_build_object('allowed', true, 'duplicate', true, 'state', 'consumed', 'eventId', v_existing.id, 'metadata', coalesce(v_existing.metadata,'{}'::jsonb));
      end if;
    end if;
    return jsonb_build_object('allowed', false, 'duplicate', true, 'reason', 'request_in_progress');
end;
$$;

create or replace function public.hay_commit_usage_reservation(
  p_owner_id uuid,
  p_event_id uuid,
  p_release_token text,
  p_metadata_patch jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.usage_events%rowtype;
  v_token_hash text;
begin
  if p_owner_id is null then
    return jsonb_build_object('committed', false, 'reason', 'owner_required');
  end if;
  if p_release_token is null then
    return jsonb_build_object('committed', false, 'reason', 'release_token_required');
  end if;
  v_token_hash := encode(extensions.digest(p_release_token, 'sha256'), 'hex');

  update public.usage_events
  set state = 'consumed',
      reservation_token_hash = null,
      reservation_expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata_patch, '{}'::jsonb)
  where id = p_event_id
    and owner_id = p_owner_id
    and state = 'reserved'
    and reservation_token_hash = v_token_hash
  returning * into v_event;

  if not found then
    select * into v_event
    from public.usage_events
    where id = p_event_id and owner_id = p_owner_id
    limit 1;
    if found and v_event.state = 'consumed' then
      return jsonb_build_object('committed', true, 'duplicate', true, 'eventId', v_event.id, 'metadata', coalesce(v_event.metadata,'{}'::jsonb));
    end if;
    return jsonb_build_object('committed', false, 'reason', 'reservation_not_found');
  end if;

  return jsonb_build_object('committed', true, 'duplicate', false, 'eventId', v_event.id, 'metadata', coalesce(v_event.metadata,'{}'::jsonb));
end;
$$;

create or replace function public.hay_release_usage_reservation(
  p_owner_id uuid,
  p_event_id uuid,
  p_release_token text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token_hash text;
  v_deleted uuid;
begin
  if p_owner_id is null then
    return jsonb_build_object('released', false, 'reason', 'owner_required');
  end if;
  if p_release_token is null then
    return jsonb_build_object('released', false, 'reason', 'release_token_required');
  end if;
  v_token_hash := encode(extensions.digest(p_release_token, 'sha256'), 'hex');

  delete from public.usage_events
  where id = p_event_id
    and owner_id = p_owner_id
    and state = 'reserved'
    and reservation_token_hash = v_token_hash
  returning id into v_deleted;

  if v_deleted is null then
    return jsonb_build_object('released', false, 'reason', 'reservation_not_found');
  end if;
  return jsonb_build_object('released', true, 'eventId', v_deleted);
end;
$$;

revoke all on function public.hay_reserve_usage(uuid,text,numeric,uuid,text,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.hay_commit_usage_reservation(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.hay_release_usage_reservation(uuid,uuid,text) from public, anon, authenticated;

grant execute on function public.hay_reserve_usage(uuid,text,numeric,uuid,text,text,jsonb,text) to service_role;
grant execute on function public.hay_commit_usage_reservation(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.hay_release_usage_reservation(uuid,uuid,text) to service_role;

comment on function public.hay_reserve_usage(uuid,text,numeric,uuid,text,text,jsonb,text) is
  'Server-only atomic HAY quota reservation. service_role supplies an already-authenticated owner UUID.';
comment on function public.hay_commit_usage_reservation(uuid,uuid,text,jsonb) is
  'Server-only commit of a provider usage reservation after successful provider work.';
comment on function public.hay_release_usage_reservation(uuid,uuid,text) is
  'Server-only release of a failed provider usage reservation; raw release token is never persisted.';
