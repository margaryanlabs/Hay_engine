-- HAY atomic reservation resizing.
-- Apply after 010_atomic_usage_reservations.sql.
-- Voice/text preprocessing can change the final billable quantity after the initial
-- pre-provider reservation. This RPC adjusts that reservation under the same account
-- entitlement lock without opening a concurrent quota race.

create or replace function public.hay_resize_usage_reservation(
  p_owner_id uuid,
  p_event_id uuid,
  p_release_token text,
  p_quantity numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entitlement public.account_entitlements%rowtype;
  v_event public.usage_events%rowtype;
  v_used_other numeric := 0;
  v_limit numeric := 0;
  v_base_limit numeric := 0;
  v_override_key text;
  v_override_text text;
  v_token_hash text;
begin
  if p_owner_id is null then
    return jsonb_build_object('resized', false, 'reason', 'owner_required');
  end if;
  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('resized', false, 'reason', 'invalid_quantity');
  end if;
  if p_release_token is null then
    return jsonb_build_object('resized', false, 'reason', 'release_token_required');
  end if;

  select * into v_entitlement
  from public.account_entitlements
  where owner_id = p_owner_id
  for update;

  if not found then
    return jsonb_build_object('resized', false, 'reason', 'commercial_migration_required');
  end if;
  if v_entitlement.status not in ('active','trialing') then
    return jsonb_build_object('resized', false, 'reason', 'subscription_inactive');
  end if;

  delete from public.usage_events
  where owner_id = p_owner_id
    and state = 'reserved'
    and reservation_expires_at <= now();

  v_token_hash := encode(extensions.digest(p_release_token, 'sha256'), 'hex');
  select * into v_event
  from public.usage_events
  where id = p_event_id
    and owner_id = p_owner_id
    and state = 'reserved'
    and reservation_token_hash = v_token_hash
  for update;

  if not found then
    return jsonb_build_object('resized', false, 'reason', 'reservation_not_found');
  end if;

  v_base_limit := case v_entitlement.plan_id
    when 'free' then case v_event.meter when 'content_assets' then 12 when 'ai_video_credits' then 1 else 5 end
    when 'creator' then case v_event.meter when 'content_assets' then 40 when 'ai_video_credits' then 6 else 30 end
    when 'growth' then case v_event.meter when 'content_assets' then 100 when 'ai_video_credits' then 20 else 120 end
    when 'business' then case v_event.meter when 'content_assets' then 300 when 'ai_video_credits' then 50 else 500 end
    when 'agency' then case v_event.meter when 'content_assets' then 1500 when 'ai_video_credits' then 250 else 2500 end
    else 0
  end;

  v_override_key := case v_event.meter
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

  select coalesce(sum(quantity),0) into v_used_other
  from public.usage_events
  where owner_id = p_owner_id
    and meter = v_event.meter
    and id <> v_event.id
    and created_at >= v_entitlement.current_period_start
    and (
      state = 'consumed'
      or (state = 'reserved' and reservation_expires_at > now())
    );

  if v_used_other + p_quantity > v_limit then
    return jsonb_build_object(
      'resized', false,
      'reason', 'plan_limit_reached',
      'used', v_used_other,
      'limit', v_limit,
      'requested', p_quantity
    );
  end if;

  update public.usage_events
  set quantity = p_quantity
  where id = v_event.id;

  return jsonb_build_object(
    'resized', true,
    'eventId', v_event.id,
    'previousQuantity', v_event.quantity,
    'quantity', p_quantity,
    'usedOther', v_used_other,
    'limit', v_limit
  );
end;
$$;

revoke all on function public.hay_resize_usage_reservation(uuid,uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.hay_resize_usage_reservation(uuid,uuid,text,numeric) to service_role;

comment on function public.hay_resize_usage_reservation(uuid,uuid,text,numeric) is
  'Server-only atomic resize of an active usage reservation under the account entitlement lock.';
