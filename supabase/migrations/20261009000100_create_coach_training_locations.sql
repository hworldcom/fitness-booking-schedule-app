-- Add owner-scoped coach training locations while keeping the legacy profile
-- snapshot synchronized for the remaining incremental multi-location work.

create table app.coach_training_locations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  public_name text not null,
  timezone text not null,
  selected_gym_id uuid null,
  location_kind text not null,
  public_location_label text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  location_source text not null,
  location_provider text null,
  location_confirmed_at timestamptz not null,
  status text not null default 'active',
  is_primary boolean not null default false,
  sort_order smallint not null,
  deactivated_at timestamptz null,
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_training_locations_owner_fkey
    foreign key (run_id, profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete cascade,
  constraint coach_training_locations_gym_fkey
    foreign key (run_id, selected_gym_id)
    references app.gyms (run_id, id)
    on delete restrict,
  constraint coach_training_locations_owner_id_key
    unique (run_id, profile_id, id),
  constraint coach_training_locations_owner_order_key
    unique (run_id, profile_id, sort_order),
  constraint coach_training_locations_name_length_check
    check (char_length(public_name) between 2 and 240),
  constraint coach_training_locations_timezone_format_check
    check (
      timezone = 'UTC'
      or timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
    ),
  constraint coach_training_locations_kind_check
    check (location_kind in ('gym', 'independent')),
  constraint coach_training_locations_gym_kind_check
    check (
      (location_kind = 'gym' and selected_gym_id is not null)
      or (location_kind = 'independent' and selected_gym_id is null)
    ),
  constraint coach_training_locations_label_length_check
    check (char_length(public_location_label) between 2 and 240),
  constraint coach_training_locations_latitude_check
    check (latitude between -90 and 90),
  constraint coach_training_locations_longitude_check
    check (longitude between -180 and 180),
  constraint coach_training_locations_source_check
    check (location_source in ('fixture', 'manual', 'permanent-geocoding')),
  constraint coach_training_locations_provider_check
    check (
      location_provider is null
      or (
        char_length(location_provider) between 2 and 40
        and location_provider ~ '^[a-z0-9-]+$'
      )
    ),
  constraint coach_training_locations_provenance_check
    check (
      (location_source in ('fixture', 'manual') and location_provider is null)
      or (
        location_source = 'permanent-geocoding'
        and location_provider is not null
      )
    ),
  constraint coach_training_locations_status_check
    check (status in ('active', 'inactive')),
  constraint coach_training_locations_primary_state_check
    check (not is_primary or status = 'active'),
  constraint coach_training_locations_deactivation_check
    check ((status = 'inactive') = (deactivated_at is not null)),
  constraint coach_training_locations_sort_order_check
    check (sort_order between 1 and 32767),
  constraint coach_training_locations_record_source_check
    check (record_source in ('fixture', 'user'))
);

create unique index coach_training_locations_active_primary_key
  on app.coach_training_locations (run_id, profile_id)
  where status = 'active' and is_primary;

create unique index coach_training_locations_active_gym_key
  on app.coach_training_locations (run_id, profile_id, selected_gym_id)
  where status = 'active' and selected_gym_id is not null;

create index coach_training_locations_owner_lookup_idx
  on app.coach_training_locations (
    run_id,
    profile_id,
    status,
    sort_order,
    id
  );

create index coach_training_locations_public_lookup_idx
  on app.coach_training_locations (run_id, status, is_primary, profile_id)
  where status = 'active';

create trigger coach_training_locations_set_updated_at
before update on app.coach_training_locations
for each row execute function app.set_updated_at();

alter table app.coach_training_locations enable row level security;
alter table app.coach_training_locations force row level security;
alter table app.coach_training_locations owner to app_owner;

revoke all on app.coach_training_locations
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_training_locations
  from app_runtime;
grant select on app.coach_training_locations to app_runtime;

create policy coach_training_locations_management_all
  on app.coach_training_locations
  for all
  to app_owner
  using (
    current_setting('app.coach_training_location_management', true) = 'on'
  )
  with check (
    current_setting('app.coach_training_location_management', true) = 'on'
  );

create policy coach_profiles_training_location_management_select
  on app.coach_profiles
  for select
  to app_owner
  using (
    current_setting('app.coach_training_location_management', true) = 'on'
  );

create policy gyms_training_location_management_select
  on app.gyms
  for select
  to app_owner
  using (
    current_setting('app.coach_training_location_management', true) = 'on'
  );

create policy demo_runs_training_location_management_select
  on app.demo_runs
  for select
  to app_owner
  using (
    current_setting('app.coach_training_location_management', true) = 'on'
  );

insert into app.coach_training_locations (
  run_id,
  profile_id,
  public_name,
  timezone,
  selected_gym_id,
  location_kind,
  public_location_label,
  latitude,
  longitude,
  location_source,
  location_provider,
  location_confirmed_at,
  status,
  is_primary,
  sort_order,
  record_source,
  created_at,
  updated_at
)
select
  coach.run_id,
  coach.profile_id,
  coalesce(gym.name, coach.public_location_label),
  coach.timezone,
  coach.selected_gym_id,
  coach.location_kind,
  coach.public_location_label,
  coach.latitude,
  coach.longitude,
  coach.location_source,
  coach.location_provider,
  coach.location_confirmed_at,
  'active',
  true,
  1,
  coach.record_source,
  coach.created_at,
  coach.updated_at
from app.coach_profiles as coach
left join app.gyms as gym
  on gym.run_id = coach.run_id
  and gym.id = coach.selected_gym_id;

create function app.require_coach_training_location_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  coach_timezone text;
  enabled_profile_management boolean := false;
begin
  if pg_catalog.current_setting('app.coach_profile_management', true)
    is distinct from 'on'
  then
    perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
    enabled_profile_management := true;
  end if;

  select coach.timezone
  into coach_timezone
  from app.coach_profiles as coach
  where coach.run_id = new.run_id
    and coach.profile_id = new.profile_id;

  if coach_timezone is null or coach_timezone <> new.timezone then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location timezone is invalid';
  end if;

  if enabled_profile_management then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  end if;
  return new;
exception
  when others then
    if enabled_profile_management then
      perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    end if;
    raise;
end;
$$;

create trigger coach_training_locations_require_coach_timezone
before insert or update of run_id, profile_id, timezone
on app.coach_training_locations
for each row execute function app.require_coach_training_location_timezone();

alter function app.require_coach_training_location_timezone()
  owner to app_owner;
revoke all on function app.require_coach_training_location_timezone()
  from public, anon, authenticated, service_role, app_runtime;

create function app.coach_has_publishable_primary_location(
  requested_run_id uuid,
  requested_profile_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  matching_count integer;
begin
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select pg_catalog.count(*)::integer
  into matching_count
  from app.coach_training_locations as location
  where location.run_id = requested_run_id
    and location.profile_id = requested_profile_id
    and location.status = 'active'
    and location.is_primary
    and location.location_confirmed_at is not null
    and (
      location.selected_gym_id is null
      or exists (
        select 1
        from app.gyms as gym
        where gym.run_id = location.run_id
          and gym.id = location.selected_gym_id
          and gym.status = 'active'
      )
    );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return matching_count = 1;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.coach_has_publishable_primary_location(uuid, uuid)
  owner to app_owner;
revoke all on function app.coach_has_publishable_primary_location(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function app.coach_has_publishable_primary_location(uuid, uuid)
  to app_runtime;

create function app.coach_training_location_publicly_visible(
  requested_run_id uuid,
  requested_profile_id uuid,
  requested_gym_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  is_visible boolean;
begin
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );
  select exists (
    select 1
    from app.coach_profiles as coach
    join app.demo_runs as run on run.id = coach.run_id
    where coach.run_id = requested_run_id
      and coach.profile_id = requested_profile_id
      and coach.visibility = 'visible'
      and app.coach_trust_kind(coach.profile_id, coach.is_demo) is not null
      and run.status = 'active'
      and run.catalogue_visibility = 'public'
      and (
        requested_gym_id is null
        or exists (
          select 1
          from app.gyms as gym
          where gym.run_id = requested_run_id
            and gym.id = requested_gym_id
            and gym.status = 'active'
        )
      )
  ) into is_visible;
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return is_visible;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.coach_training_location_publicly_visible(uuid, uuid, uuid)
  owner to app_owner;
revoke all on function app.coach_training_location_publicly_visible(
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function app.coach_training_location_publicly_visible(
  uuid,
  uuid,
  uuid
) to app_runtime;

create policy coach_training_locations_public_select
  on app.coach_training_locations
  for select
  to app_runtime
  using (
    status = 'active'
    and location_confirmed_at is not null
    and app.coach_training_location_publicly_visible(
      run_id,
      profile_id,
      selected_gym_id
    )
  );

create policy coach_training_locations_owner_select
  on app.coach_training_locations
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, run_id, null));

drop policy coach_profiles_public_discovery_select on app.coach_profiles;
create policy coach_profiles_public_discovery_select
  on app.coach_profiles
  for select
  to app_runtime
  using (
    visibility = 'visible'
    and app.coach_trust_kind(profile_id, is_demo) is not null
    and app.coach_has_publishable_primary_location(run_id, profile_id)
    and exists (
      select 1
      from app.demo_runs as run
      where run.id = coach_profiles.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
  );

create function app.sync_primary_training_location_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  primary_location_id uuid;
  resolved_public_name text;
begin
  if pg_catalog.current_setting(
    'app.coach_training_location_sync_to_profile',
    true
  ) = 'on' then
    return new;
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  update app.coach_training_locations
  set timezone = new.timezone
  where run_id = new.run_id
    and profile_id = new.profile_id
    and timezone <> new.timezone;

  if new.selected_gym_id is not null then
    select gym.name
    into resolved_public_name
    from app.gyms as gym
    where gym.run_id = new.run_id
      and gym.id = new.selected_gym_id;
  else
    resolved_public_name := new.public_location_label;
  end if;

  if resolved_public_name is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location gym is unavailable';
  end if;

  select location.id
  into primary_location_id
  from app.coach_training_locations as location
  where location.run_id = new.run_id
    and location.profile_id = new.profile_id
    and location.status = 'active'
    and location.is_primary
  for update;

  if primary_location_id is null then
    insert into app.coach_training_locations (
      run_id,
      profile_id,
      public_name,
      timezone,
      selected_gym_id,
      location_kind,
      public_location_label,
      latitude,
      longitude,
      location_source,
      location_provider,
      location_confirmed_at,
      status,
      is_primary,
      sort_order,
      record_source
    ) values (
      new.run_id,
      new.profile_id,
      resolved_public_name,
      new.timezone,
      new.selected_gym_id,
      new.location_kind,
      new.public_location_label,
      new.latitude,
      new.longitude,
      new.location_source,
      new.location_provider,
      new.location_confirmed_at,
      'active',
      true,
      1,
      new.record_source
    );
  else
    update app.coach_training_locations
    set
      public_name = case
        when new.selected_gym_id is not null then resolved_public_name
        when location_kind = 'gym' then new.public_location_label
        else public_name
      end,
      timezone = new.timezone,
      selected_gym_id = new.selected_gym_id,
      location_kind = new.location_kind,
      public_location_label = new.public_location_label,
      latitude = new.latitude,
      longitude = new.longitude,
      location_source = new.location_source,
      location_provider = new.location_provider,
      location_confirmed_at = new.location_confirmed_at,
      record_source = new.record_source
    where id = primary_location_id;
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

create trigger coach_profiles_sync_primary_training_location
after insert or update of
  timezone,
  selected_gym_id,
  location_kind,
  public_location_label,
  latitude,
  longitude,
  location_source,
  location_provider,
  location_confirmed_at
on app.coach_profiles
for each row execute function app.sync_primary_training_location_from_profile();

alter function app.sync_primary_training_location_from_profile()
  owner to app_owner;
revoke all on function app.sync_primary_training_location_from_profile()
  from public, anon, authenticated, service_role, app_runtime;

create function app.assert_visible_coach_primary_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_run_id uuid;
  affected_profile_id uuid;
  coach_visibility text;
  primary_count integer;
begin
  if tg_op = 'DELETE' then
    affected_run_id := old.run_id;
    affected_profile_id := old.profile_id;
  else
    affected_run_id := new.run_id;
    affected_profile_id := new.profile_id;
  end if;

  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select coach.visibility
  into coach_visibility
  from app.coach_profiles as coach
  where coach.run_id = affected_run_id
    and coach.profile_id = affected_profile_id;

  if coach_visibility = 'visible' then
    select pg_catalog.count(*)::integer
    into primary_count
    from app.coach_training_locations as location
    where location.run_id = affected_run_id
      and location.profile_id = affected_profile_id
      and location.status = 'active'
      and location.is_primary
      and location.location_confirmed_at is not null;

    if primary_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'visible coach requires exactly one active primary training location';
    end if;
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return null;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create constraint trigger coach_profiles_validate_primary_training_location
after insert or update of visibility on app.coach_profiles
deferrable initially deferred
for each row execute function app.assert_visible_coach_primary_location();

create constraint trigger coach_training_locations_validate_visible_coach
after insert or update or delete on app.coach_training_locations
deferrable initially deferred
for each row execute function app.assert_visible_coach_primary_location();

alter function app.assert_visible_coach_primary_location()
  owner to app_owner;
revoke all on function app.assert_visible_coach_primary_location()
  from public, anon, authenticated, service_role, app_runtime;

create function app.sync_coach_profile_from_primary_training_location(
  requested_run_id uuid,
  requested_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_sync_to_profile',
    'on',
    true
  );

  update app.coach_profiles as coach
  set
    timezone = location.timezone,
    selected_gym_id = location.selected_gym_id,
    location_kind = location.location_kind,
    public_location_label = location.public_location_label,
    latitude = location.latitude,
    longitude = location.longitude,
    location_source = location.location_source,
    location_provider = location.location_provider,
    location_confirmed_at = location.location_confirmed_at
  from app.coach_training_locations as location
  where coach.run_id = requested_run_id
    and coach.profile_id = requested_profile_id
    and location.run_id = coach.run_id
    and location.profile_id = coach.profile_id
    and location.status = 'active'
    and location.is_primary;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location primary is unavailable';
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_sync_to_profile',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_sync_to_profile',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.sync_coach_profile_from_primary_training_location(uuid, uuid)
  owner to app_owner;
revoke all on function app.sync_coach_profile_from_primary_training_location(
  uuid,
  uuid
) from public, anon, authenticated, service_role, app_runtime;

create function app.create_owned_coach_training_location(
  requested_public_name text,
  requested_gym_id uuid,
  requested_public_location_label text,
  requested_latitude numeric,
  requested_longitude numeric,
  requested_location_source text,
  requested_location_provider text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach app.coach_profiles%rowtype;
  selected_gym app.gyms%rowtype;
  normalized_public_name text;
  normalized_location_label text;
  resolved_public_name text;
  resolved_location_kind text;
  resolved_location_label text;
  resolved_latitude numeric(9, 6);
  resolved_longitude numeric(9, 6);
  resolved_location_source text;
  resolved_location_provider text;
  next_sort_order integer;
  created_location_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  normalized_public_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_public_name, '[[:space:]]+', ' ', 'g')
  );
  normalized_location_label := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_public_location_label,
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location owner is unavailable';
  end if;

  if requested_gym_id is not null then
    select gym.*
    into selected_gym
    from app.gyms as gym
    where gym.run_id = run_id_text::uuid
      and gym.id = requested_gym_id
      and gym.status = 'active';

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location gym is unavailable';
    end if;

    resolved_public_name := selected_gym.name;
    resolved_location_kind := 'gym';
    resolved_location_label := selected_gym.public_location_label;
    resolved_latitude := selected_gym.latitude;
    resolved_longitude := selected_gym.longitude;
    resolved_location_source := selected_gym.location_source;
    resolved_location_provider := selected_gym.location_provider;
  else
    if normalized_public_name is null
      or pg_catalog.char_length(normalized_public_name) not between 2 and 240
      or normalized_public_name ~ '[[:cntrl:]]'
      or normalized_location_label is null
      or pg_catalog.char_length(normalized_location_label) not between 2 and 240
      or normalized_location_label ~ '[[:cntrl:]]'
      or requested_latitude is null
      or requested_latitude not between -90 and 90
      or requested_longitude is null
      or requested_longitude not between -180 and 180
      or requested_location_source not in ('manual', 'permanent-geocoding')
      or (
        requested_location_source = 'manual'
        and requested_location_provider is not null
      )
      or (
        requested_location_source = 'permanent-geocoding'
        and (
          requested_location_provider is null
          or pg_catalog.char_length(requested_location_provider)
            not between 2 and 40
          or requested_location_provider !~ '^[a-z0-9-]+$'
        )
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location details are invalid';
    end if;

    resolved_public_name := normalized_public_name;
    resolved_location_kind := 'independent';
    resolved_location_label := normalized_location_label;
    resolved_latitude := requested_latitude;
    resolved_longitude := requested_longitude;
    resolved_location_source := requested_location_source;
    resolved_location_provider := requested_location_provider;
  end if;

  select coalesce(pg_catalog.max(location.sort_order), 0) + 1
  into next_sort_order
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid;

  if next_sort_order > 32767 then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location limit is reached';
  end if;

  insert into app.coach_training_locations (
    run_id,
    profile_id,
    public_name,
    timezone,
    selected_gym_id,
    location_kind,
    public_location_label,
    latitude,
    longitude,
    location_source,
    location_provider,
    location_confirmed_at,
    status,
    is_primary,
    sort_order,
    record_source
  ) values (
    run_id_text::uuid,
    profile_id_text::uuid,
    resolved_public_name,
    selected_coach.timezone,
    requested_gym_id,
    resolved_location_kind,
    resolved_location_label,
    resolved_latitude,
    resolved_longitude,
    resolved_location_source,
    resolved_location_provider,
    pg_catalog.statement_timestamp(),
    'active',
    false,
    next_sort_order,
    'user'
  ) returning id into created_location_id;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return created_location_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.update_owned_coach_training_location(
  requested_location_id uuid,
  expected_updated_at timestamptz,
  requested_public_name text,
  requested_gym_id uuid,
  requested_public_location_label text,
  requested_latitude numeric,
  requested_longitude numeric,
  requested_location_source text,
  requested_location_provider text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_location app.coach_training_locations%rowtype;
  selected_gym app.gyms%rowtype;
  normalized_public_name text;
  normalized_location_label text;
  resolved_public_name text;
  resolved_location_kind text;
  resolved_location_label text;
  resolved_latitude numeric(9, 6);
  resolved_longitude numeric(9, 6);
  resolved_location_source text;
  resolved_location_provider text;
  resulting_updated_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  normalized_public_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_public_name, '[[:space:]]+', ' ', 'g')
  );
  normalized_location_label := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_public_location_label,
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select location.*
  into selected_location
  from app.coach_training_locations as location
  where location.id = requested_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active'
  for update;

  if not found or selected_location.updated_at <> expected_updated_at then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location conflicts with current state';
  end if;

  if requested_gym_id is not null then
    select gym.*
    into selected_gym
    from app.gyms as gym
    where gym.run_id = run_id_text::uuid
      and gym.id = requested_gym_id
      and gym.status = 'active';

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location gym is unavailable';
    end if;

    resolved_public_name := selected_gym.name;
    resolved_location_kind := 'gym';
    resolved_location_label := selected_gym.public_location_label;
    resolved_latitude := selected_gym.latitude;
    resolved_longitude := selected_gym.longitude;
    resolved_location_source := selected_gym.location_source;
    resolved_location_provider := selected_gym.location_provider;
  else
    if normalized_public_name is null
      or pg_catalog.char_length(normalized_public_name) not between 2 and 240
      or normalized_public_name ~ '[[:cntrl:]]'
      or normalized_location_label is null
      or pg_catalog.char_length(normalized_location_label) not between 2 and 240
      or normalized_location_label ~ '[[:cntrl:]]'
      or requested_latitude is null
      or requested_latitude not between -90 and 90
      or requested_longitude is null
      or requested_longitude not between -180 and 180
      or requested_location_source not in ('manual', 'permanent-geocoding')
      or (
        requested_location_source = 'manual'
        and requested_location_provider is not null
      )
      or (
        requested_location_source = 'permanent-geocoding'
        and (
          requested_location_provider is null
          or pg_catalog.char_length(requested_location_provider)
            not between 2 and 40
          or requested_location_provider !~ '^[a-z0-9-]+$'
        )
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location details are invalid';
    end if;

    resolved_public_name := normalized_public_name;
    resolved_location_kind := 'independent';
    resolved_location_label := normalized_location_label;
    resolved_latitude := requested_latitude;
    resolved_longitude := requested_longitude;
    resolved_location_source := requested_location_source;
    resolved_location_provider := requested_location_provider;
  end if;

  update app.coach_training_locations
  set
    public_name = resolved_public_name,
    selected_gym_id = requested_gym_id,
    location_kind = resolved_location_kind,
    public_location_label = resolved_location_label,
    latitude = resolved_latitude,
    longitude = resolved_longitude,
    location_source = resolved_location_source,
    location_provider = resolved_location_provider,
    location_confirmed_at = pg_catalog.statement_timestamp()
  where id = selected_location.id
  returning updated_at into resulting_updated_at;

  if selected_location.is_primary then
    perform app.sync_coach_profile_from_primary_training_location(
      run_id_text::uuid,
      profile_id_text::uuid
    );
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return resulting_updated_at;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.set_owned_coach_primary_location(
  requested_location_id uuid,
  expected_location_updated_at timestamptz,
  expected_primary_location_id uuid,
  expected_primary_updated_at timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_location app.coach_training_locations%rowtype;
  selected_primary app.coach_training_locations%rowtype;
  resulting_updated_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  perform 1
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
  order by location.id
  for update;

  select location.*
  into selected_location
  from app.coach_training_locations as location
  where location.id = requested_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active';

  select location.*
  into selected_primary
  from app.coach_training_locations as location
  where location.id = expected_primary_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active'
    and location.is_primary;

  if selected_location.id is null
    or selected_location.updated_at <> expected_location_updated_at
    or selected_primary.id is null
    or selected_primary.updated_at <> expected_primary_updated_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location conflicts with current state';
  end if;

  if selected_location.id = selected_primary.id then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    return selected_location.updated_at;
  end if;

  update app.coach_training_locations
  set is_primary = false
  where id = selected_primary.id;

  update app.coach_training_locations
  set is_primary = true
  where id = selected_location.id
  returning updated_at into resulting_updated_at;

  perform app.sync_coach_profile_from_primary_training_location(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return resulting_updated_at;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.deactivate_owned_coach_training_location(
  requested_location_id uuid,
  expected_location_updated_at timestamptz,
  requested_replacement_id uuid,
  expected_replacement_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_location app.coach_training_locations%rowtype;
  selected_replacement app.coach_training_locations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  perform 1
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
  order by location.id
  for update;

  select location.*
  into selected_location
  from app.coach_training_locations as location
  where location.id = requested_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active';

  if selected_location.id is null
    or selected_location.updated_at <> expected_location_updated_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location conflicts with current state';
  end if;

  if selected_location.is_primary then
    select location.*
    into selected_replacement
    from app.coach_training_locations as location
    where location.id = requested_replacement_id
      and location.run_id = run_id_text::uuid
      and location.profile_id = profile_id_text::uuid
      and location.status = 'active'
      and not location.is_primary;

    if selected_replacement.id is null
      or selected_replacement.updated_at <> expected_replacement_updated_at
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location replacement is invalid';
    end if;
  elsif requested_replacement_id is not null
    or expected_replacement_updated_at is not null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location replacement is invalid';
  end if;

  update app.coach_training_locations
  set
    status = 'inactive',
    is_primary = false,
    deactivated_at = pg_catalog.statement_timestamp()
  where id = selected_location.id;

  if selected_location.is_primary then
    update app.coach_training_locations
    set is_primary = true
    where id = selected_replacement.id;

    perform app.sync_coach_profile_from_primary_training_location(
      run_id_text::uuid,
      profile_id_text::uuid
    );
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return selected_location.id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.create_owned_coach_training_location(
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) owner to app_owner;
alter function app.update_owned_coach_training_location(
  uuid,
  timestamptz,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) owner to app_owner;
alter function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) owner to app_owner;
alter function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) owner to app_owner;

revoke all on function app.create_owned_coach_training_location(
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) from public, anon, authenticated, service_role;
revoke all on function app.update_owned_coach_training_location(
  uuid,
  timestamptz,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) from public, anon, authenticated, service_role;
revoke all on function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) from public, anon, authenticated, service_role;

grant execute on function app.create_owned_coach_training_location(
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) to app_runtime;
grant execute on function app.update_owned_coach_training_location(
  uuid,
  timestamptz,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) to app_runtime;
grant execute on function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) to app_runtime;
grant execute on function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) to app_runtime;

comment on table app.coach_profiles is
  'Self-declared coach discovery profiles with a synchronized legacy primary-location snapshot; app.coach_training_locations is the location source of truth.';
comment on table app.coach_training_locations is
  'Owner-scoped confirmed coach training places. Optional reviewed gym references are location labels only and grant no gym or account authority.';
comment on column app.coach_training_locations.public_name is
  'Provider-neutral public place name; gym-backed rows copy the reviewed gym name.';
comment on column app.coach_training_locations.location_provider is
  'Optional provider provenance only; public rendering is provider-neutral.';
comment on function app.create_owned_coach_training_location(
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) is 'Creates one confirmed active non-primary location for the verified current coach owner.';
comment on function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) is 'Atomically replaces the current primary location using owner and optimistic-state checks.';
comment on function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) is 'Soft-deactivates an owned location and requires an atomic replacement when it is primary.';
