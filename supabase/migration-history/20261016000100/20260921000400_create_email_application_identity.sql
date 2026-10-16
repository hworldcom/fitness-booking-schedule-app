drop function if exists app.enroll_prepared_personal_identity(
  uuid,
  text,
  text,
  text,
  text
);
drop function if exists app.current_prepared_personal_identity(
  uuid,
  text,
  text,
  text,
  text
);

drop policy if exists profiles_identity_enrollment_select on app.profiles;
drop policy if exists profiles_identity_enrollment_update on app.profiles;
drop policy if exists demo_runs_identity_enrollment_select on app.demo_runs;
drop policy if exists demo_run_memberships_identity_enrollment_select
  on app.demo_run_memberships;
drop policy if exists wallet_bindings_identity_enrollment_select
  on app.wallet_bindings;
drop policy if exists wallet_bindings_identity_enrollment_insert
  on app.wallet_bindings;

create policy profiles_application_identity_select
  on app.profiles
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy profiles_application_identity_insert
  on app.profiles
  for insert
  to app_owner
  with check (current_setting('app.identity_enrollment', true) = 'on');

create policy demo_runs_application_identity_select
  on app.demo_runs
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy demo_run_memberships_application_identity_select
  on app.demo_run_memberships
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy demo_run_memberships_application_identity_insert
  on app.demo_run_memberships
  for insert
  to app_owner
  with check (current_setting('app.identity_enrollment', true) = 'on');

create function app.current_application_identity(
  requested_auth_user_id uuid
)
returns table (
  identity_profile_id uuid,
  identity_profile_slug text,
  identity_display_name text,
  identity_run_id uuid,
  identity_run_slug text,
  identity_run_name text,
  identity_role text
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  returned_rows integer;
begin
  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);

  return query
  select
    profile.id,
    profile.slug,
    profile.display_name,
    demo_run.id,
    demo_run.slug,
    demo_run.name,
    membership.role
  from app.profiles as profile
  join app.demo_run_memberships as membership
    on membership.profile_id = profile.id
  join app.demo_runs as demo_run
    on demo_run.id = membership.run_id
  where profile.auth_user_id = requested_auth_user_id
    and profile.record_source = 'user'
    and profile.claimed_at is not null
    and membership.role = 'member'
    and membership.status = 'active'
    and demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  get diagnostics returned_rows = row_count;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);

  if returned_rows > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'application identity conflicts with existing state';
  end if;
end;
$$;

create function app.enroll_application_identity(
  requested_auth_user_id uuid,
  requested_display_name text
)
returns table (
  identity_profile_id uuid,
  identity_profile_slug text,
  identity_display_name text,
  identity_run_id uuid,
  identity_run_slug text,
  identity_run_name text,
  identity_role text
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  normalized_display_name text;
  generated_slug_base text;
  generated_slug text;
  selected_run_id uuid;
  selected_profile_id uuid;
  selected_record_source text;
  returned_rows integer;
begin
  normalized_display_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_display_name, '[[:space:]]+', ' ', 'g')
  );

  if normalized_display_name is null
    or pg_catalog.char_length(normalized_display_name) not between 2 and 80
    or normalized_display_name ~ '[[:cntrl:]]'
    or normalized_display_name !~ '[[:alnum:]]'
  then
    raise exception using
      errcode = 'P0001',
      message = 'application profile details are invalid';
  end if;

  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);

  select demo_run.id
  into selected_run_id
  from app.demo_runs as demo_run
  where demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  if selected_run_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'application identity enrollment is unavailable';
  end if;

  select profile.id, profile.record_source
  into selected_profile_id, selected_record_source
  from app.profiles as profile
  where profile.auth_user_id = requested_auth_user_id;

  if selected_profile_id is null then
    generated_slug_base := pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.lower(normalized_display_name),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-'
    );
    if generated_slug_base = '' then
      generated_slug_base := 'member';
    end if;
    generated_slug := pg_catalog.concat(
      pg_catalog.btrim(pg_catalog.left(generated_slug_base, 60), '-'),
      '-',
      pg_catalog.left(
        pg_catalog.replace(requested_auth_user_id::text, '-', ''),
        12
      )
    );

    insert into app.profiles (
      auth_user_id,
      slug,
      display_name,
      initials,
      bio,
      avatar_color,
      record_source,
      claimed_at
    )
    values (
      requested_auth_user_id,
      generated_slug,
      normalized_display_name,
      pg_catalog.upper(pg_catalog.left(normalized_display_name, 2)),
      '',
      'lime',
      'user',
      pg_catalog.statement_timestamp()
    )
    on conflict (auth_user_id) do nothing;

    select profile.id, profile.record_source
    into selected_profile_id, selected_record_source
    from app.profiles as profile
    where profile.auth_user_id = requested_auth_user_id;
  end if;

  if selected_profile_id is null or selected_record_source <> 'user' then
    raise exception using
      errcode = 'P0001',
      message = 'application identity conflicts with existing state';
  end if;

  insert into app.demo_run_memberships (
    run_id,
    profile_id,
    role,
    status,
    joined_at,
    revoked_at
  )
  values (
    selected_run_id,
    selected_profile_id,
    'member',
    'active',
    pg_catalog.statement_timestamp(),
    null
  )
  on conflict (run_id, profile_id) do nothing;

  return query
  select
    profile.id,
    profile.slug,
    profile.display_name,
    demo_run.id,
    demo_run.slug,
    demo_run.name,
    membership.role
  from app.profiles as profile
  join app.demo_run_memberships as membership
    on membership.profile_id = profile.id
  join app.demo_runs as demo_run
    on demo_run.id = membership.run_id
  where profile.id = selected_profile_id
    and profile.auth_user_id = requested_auth_user_id
    and profile.record_source = 'user'
    and profile.claimed_at is not null
    and membership.run_id = selected_run_id
    and membership.role = 'member'
    and membership.status = 'active'
    and demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  get diagnostics returned_rows = row_count;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);

  if returned_rows <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'application identity conflicts with existing state';
  end if;
end;
$$;

alter function app.current_application_identity(uuid) owner to app_owner;
alter function app.enroll_application_identity(uuid, text) owner to app_owner;

revoke all on function app.current_application_identity(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.enroll_application_identity(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function app.current_application_identity(uuid)
  to app_runtime;
grant execute on function app.enroll_application_identity(uuid, text)
  to app_runtime;

create or replace function app.authorized_actor_context_valid(
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

  if auth_user_id_text is null
    or profile_id_text is null
    or run_id_text is null
    or run_role_text not in ('member', 'operator')
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
    where profile.id = profile_id_text::uuid
      and profile.auth_user_id = auth_user_id_text::uuid
      and profile.record_source = 'user'
      and profile.claimed_at is not null
      and membership.run_id = run_id_text::uuid
      and membership.role = run_role_text
      and membership.status = 'active'
      and demo_run.status = 'active'
      and demo_run.catalogue_visibility = 'public'
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
