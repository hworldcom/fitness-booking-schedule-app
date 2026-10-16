revoke select, insert, update, delete on app.wallet_bindings from app_runtime;
revoke insert, update, delete
  on app.profiles, app.demo_runs, app.demo_run_memberships
  from app_runtime;

create policy profiles_actor_validation_select
  on app.profiles
  for select
  to app_owner
  using (current_setting('app.actor_validation', true) = 'on');

create policy demo_runs_actor_validation_select
  on app.demo_runs
  for select
  to app_owner
  using (current_setting('app.actor_validation', true) = 'on');

create policy demo_run_memberships_actor_validation_select
  on app.demo_run_memberships
  for select
  to app_owner
  using (current_setting('app.actor_validation', true) = 'on');

create policy wallet_bindings_actor_validation_select
  on app.wallet_bindings
  for select
  to app_owner
  using (current_setting('app.actor_validation', true) = 'on');

create function app.authorized_actor_context_valid(
  requested_profile_id uuid,
  requested_run_id uuid,
  requested_run_role text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  run_role_text text;
  wallet_binding_id_text text;
  context_is_valid boolean;
begin
  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  run_role_text := pg_catalog.current_setting('app.current_run_role', true);
  wallet_binding_id_text := pg_catalog.current_setting(
    'app.current_wallet_binding_id',
    true
  );

  if auth_user_id_text is null
    or profile_id_text is null
    or run_id_text is null
    or run_role_text not in ('member', 'operator')
    or wallet_binding_id_text is null
  then
    return false;
  end if;

  if requested_profile_id is not null
    and requested_profile_id <> profile_id_text::uuid
  then
    return false;
  end if;

  if requested_run_id is not null
    and requested_run_id <> run_id_text::uuid
  then
    return false;
  end if;

  if requested_run_role is not null
    and requested_run_role <> run_role_text
  then
    return false;
  end if;

  perform pg_catalog.set_config('app.actor_validation', 'on', true);

  select exists (
    select 1
    from app.profiles as profile
    join app.demo_run_memberships as membership
      on membership.profile_id = profile.id
    join app.demo_runs as demo_run
      on demo_run.id = membership.run_id
    join app.wallet_bindings as binding
      on binding.run_id = membership.run_id
      and binding.profile_id = profile.id
    where profile.id = profile_id_text::uuid
      and profile.auth_user_id = auth_user_id_text::uuid
      and membership.run_id = run_id_text::uuid
      and membership.role = run_role_text
      and membership.status = 'active'
      and demo_run.status = 'active'
      and binding.id = wallet_binding_id_text::uuid
      and binding.owner_type = 'personal'
      and binding.bound_by_auth_user_id = auth_user_id_text::uuid
      and binding.status = 'active'
  )
  into context_is_valid;

  perform pg_catalog.set_config('app.actor_validation', 'off', true);
  return context_is_valid;
exception
  when invalid_text_representation then
    perform pg_catalog.set_config('app.actor_validation', 'off', true);
    return false;
end;
$$;

alter function app.authorized_actor_context_valid(uuid, uuid, text)
  owner to app_owner;

revoke all on function app.authorized_actor_context_valid(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function app.authorized_actor_context_valid(uuid, uuid, text)
  to app_runtime;

create policy profiles_authorized_actor_select
  on app.profiles
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(id, null, null));

create policy demo_runs_authorized_actor_select
  on app.demo_runs
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(null, id, null));

create policy demo_run_memberships_authorized_actor_select
  on app.demo_run_memberships
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, run_id, role));

grant select on app.profiles, app.demo_runs, app.demo_run_memberships
  to app_runtime;
