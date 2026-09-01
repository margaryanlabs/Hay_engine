-- HAY social OAuth credential storage.
-- Apply only to the dedicated HAY Supabase project.
-- Vault keeps secrets encrypted at rest; public social_connections stores only credential_ref.

create extension if not exists supabase_vault with schema vault;

create or replace function public.hay_store_oauth_secret(p_connection_id uuid, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing text;
  v_secret_id uuid;
begin
  select credential_ref into v_existing
  from public.social_connections
  where id = p_connection_id;

  if not found then
    raise exception 'social_connection_not_found';
  end if;

  if v_existing is not null and v_existing <> '' then
    v_secret_id := v_existing::uuid;
    perform vault.update_secret(v_secret_id, p_secret, null, 'HAY social OAuth credential');
  else
    select vault.create_secret(p_secret, null, 'HAY social OAuth credential') into v_secret_id;
    update public.social_connections set credential_ref = v_secret_id::text where id = p_connection_id;
  end if;

  return v_secret_id;
end;
$$;

create or replace function public.hay_get_oauth_secret(p_connection_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from public.social_connections sc
  join vault.decrypted_secrets ds on ds.id::text = sc.credential_ref
  where sc.id = p_connection_id
  limit 1;
$$;

revoke all on function public.hay_store_oauth_secret(uuid, text) from public, anon, authenticated;
revoke all on function public.hay_get_oauth_secret(uuid) from public, anon, authenticated;
grant execute on function public.hay_store_oauth_secret(uuid, text) to service_role;
grant execute on function public.hay_get_oauth_secret(uuid) to service_role;
