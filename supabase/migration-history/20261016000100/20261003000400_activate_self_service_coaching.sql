-- Make coaching an explicit self-service capability on the ordinary account.
-- It remains independent from dataset roles, profile visibility and wallets.

alter table app.profiles
  add column coaching_activated_at timestamptz null;

update app.profiles as profile
set coaching_activated_at = existing_coach.first_created_at
from (
  select coach.profile_id, min(coach.created_at) as first_created_at
  from app.coach_profiles as coach
  group by coach.profile_id
) as existing_coach
where profile.id = existing_coach.profile_id
  and profile.coaching_activated_at is null;

create policy profiles_coach_activation_management_all
  on app.profiles
  for all
  to app_owner
  using (current_setting('app.coach_activation_management', true) = 'on')
  with check (current_setting('app.coach_activation_management', true) = 'on');

create function app.activate_owned_coaching()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  activated_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach activation actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'on',
    true
  );

  update app.profiles as profile
  set
    coaching_activated_at = coalesce(
      profile.coaching_activated_at,
      pg_catalog.statement_timestamp()
    ),
    updated_at = case
      when profile.coaching_activated_at is null
        then pg_catalog.statement_timestamp()
      else profile.updated_at
    end
  where profile.id = profile_id_text::uuid
    and profile.record_source = 'user'
    and profile.auth_user_id is not null
    and profile.claimed_at is not null
  returning profile.coaching_activated_at into activated_at;

  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'off',
    true
  );

  if activated_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach activation profile is unavailable';
  end if;

  return activated_at;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.activate_owned_coaching() owner to app_owner;
revoke all on function app.activate_owned_coaching()
  from public, anon, authenticated, service_role;
grant execute on function app.activate_owned_coaching() to app_runtime;

create function app.require_activated_coach_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from app.profiles as profile
    where profile.id = new.profile_id
      and profile.coaching_activated_at is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile requires activated coaching';
  end if;

  return new;
end;
$$;

alter function app.require_activated_coach_profile() owner to app_owner;
revoke all on function app.require_activated_coach_profile()
  from public, anon, authenticated, service_role, app_runtime;

create trigger coach_profiles_require_activation
after insert or update on app.coach_profiles
for each row execute function app.require_activated_coach_profile();

comment on column app.profiles.coaching_activated_at is
  'Owner-initiated self-service coaching activation; not approval or public visibility.';
comment on function app.activate_owned_coaching() is
  'Idempotently activates coaching for the verified current application profile.';
