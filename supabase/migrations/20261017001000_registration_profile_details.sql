-- DEV0325: atomic confirmed-registration details using the existing unique handle.
create function app.enroll_application_identity(
  requested_auth_user_id uuid,
  requested_display_name text,
  requested_full_name text,
  requested_username text
) returns table (
  identity_profile_id uuid, identity_profile_slug text, identity_display_name text,
  identity_run_id uuid, identity_run_slug text, identity_run_name text, identity_role text
)
language plpgsql security definer set search_path = '' as $$
declare
  display_value text := btrim(regexp_replace(requested_display_name, '[[:space:]]+', ' ', 'g'));
  full_value text := btrim(regexp_replace(requested_full_name, '[[:space:]]+', ' ', 'g'));
  handle text := regexp_replace(lower(btrim(requested_username)), '^@', '');
  enrolled record;
  existing_profile boolean;
  previous_profile text := current_setting('app.current_profile_id', true);
begin
  if requested_auth_user_id is null or handle is null or handle !~ '^[a-z][a-z0-9_]{2,29}$'
    or display_value is null or char_length(display_value) not between 2 and 80 or display_value !~ '[[:alnum:]]'
    or full_value is null or char_length(full_value) not between 2 and 80 or full_value !~ '[[:alnum:]]'
    or requested_display_name ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
    or requested_full_name ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
  then
    raise exception 'registration profile details are invalid' using errcode = '22023';
  end if;

  -- Serialize retries for one identity; the existing unique constraint arbitrates
  -- different identities and ordinary Account username edits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requested_auth_user_id::text, 325));
  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);
  select exists (select 1 from app.profiles p where p.auth_user_id = requested_auth_user_id) into existing_profile;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);
  if existing_profile then
    return query select * from app.enroll_application_identity(requested_auth_user_id, display_value);
    return;
  end if;

  select * into strict enrolled from app.enroll_application_identity(requested_auth_user_id, display_value);
  perform pg_catalog.set_config('app.current_profile_id', enrolled.identity_profile_id::text, true);
  perform pg_catalog.set_config('app.account_settings_management', 'on', true);
  insert into app.account_personal_details(profile_id, legal_name, preferred_first_name, username)
  values (enrolled.identity_profile_id, full_value, display_value, handle);
  update app.profiles set chat_first_name = display_value where id = enrolled.identity_profile_id;
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  perform pg_catalog.set_config('app.current_profile_id', coalesce(previous_profile, ''), true);
  return query select enrolled.identity_profile_id, enrolled.identity_profile_slug, enrolled.identity_display_name,
    enrolled.identity_run_id, enrolled.identity_run_slug, enrolled.identity_run_name, enrolled.identity_role;
exception when others then
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  perform pg_catalog.set_config('app.current_profile_id', coalesce(previous_profile, ''), true);
  raise;
end;
$$;
alter function app.enroll_application_identity(uuid,text,text,text) owner to app_owner;
revoke all on function app.enroll_application_identity(uuid,text,text,text) from public, anon, authenticated;
grant execute on function app.enroll_application_identity(uuid,text,text,text) to app_runtime;
comment on function app.enroll_application_identity(uuid,text,text,text) is
  'DEV0325: trusted-server confirmed signup; atomic profile/private full name/display preference/unique username. Existing identities are preserved. Two-argument helper remains for trusted legacy fixtures.';
