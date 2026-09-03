-- Atomic HAY Developer API request admission.
-- Apply after 007_commercial_core.sql. This serializes each API key's rolling-hour
-- request budget so concurrent requests cannot all pass the same final slot.

create or replace function public.hay_reserve_developer_api_request(
  p_owner_id uuid,
  p_api_key_id uuid,
  p_hourly_limit integer,
  p_endpoint text,
  p_operation text
)
returns table (
  allowed boolean,
  reason text,
  usage_id uuid,
  current_count bigint
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_key public.developer_api_keys%rowtype;
  v_count bigint := 0;
  v_usage_id uuid;
begin
  if p_owner_id is null or p_api_key_id is null then
    return query select false, 'invalid_api_key'::text, null::uuid, 0::bigint;
    return;
  end if;

  if p_hourly_limit is null or p_hourly_limit <= 0 then
    return query select false, 'developer_api_rate_limit_unconfigured'::text, null::uuid, 0::bigint;
    return;
  end if;

  -- The key row is the serialization point. Every concurrent request for this key
  -- must acquire this lock before counting and inserting its request slot.
  select * into v_key
  from public.developer_api_keys
  where id = p_api_key_id
    and owner_id = p_owner_id
  for update;

  if not found or v_key.revoked_at is not null then
    return query select false, 'invalid_api_key'::text, null::uuid, 0::bigint;
    return;
  end if;

  if v_key.expires_at is not null and v_key.expires_at <= now() then
    return query select false, 'api_key_expired'::text, null::uuid, 0::bigint;
    return;
  end if;

  select coalesce(sum(u.request_count), 0)::bigint into v_count
  from public.developer_api_usage u
  where u.api_key_id = p_api_key_id
    and u.created_at >= now() - interval '1 hour';

  if v_count >= p_hourly_limit then
    return query select false, 'developer_api_rate_limit_reached'::text, null::uuid, v_count;
    return;
  end if;

  insert into public.developer_api_usage (
    owner_id,
    api_key_id,
    endpoint,
    operation,
    request_count,
    input_chars,
    audio_bytes,
    metadata
  ) values (
    p_owner_id,
    p_api_key_id,
    left(coalesce(nullif(btrim(p_endpoint), ''), 'unknown'), 240),
    left(coalesce(nullif(btrim(p_operation), ''), 'unknown'), 120),
    1,
    0,
    0,
    jsonb_build_object('state', 'accepted')
  ) returning id into v_usage_id;

  update public.developer_api_keys
  set last_used_at = now()
  where id = p_api_key_id and owner_id = p_owner_id;

  return query select true, null::text, v_usage_id, v_count + 1;
end;
$$;

revoke all on function public.hay_reserve_developer_api_request(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.hay_reserve_developer_api_request(uuid, uuid, integer, text, text) to service_role;

comment on function public.hay_reserve_developer_api_request(uuid, uuid, integer, text, text)
is 'Service-role-only atomic admission for one HAY Developer API request. Locks the API key, checks rolling-hour usage, then inserts the request slot before provider work.';
