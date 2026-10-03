-- Add explicit capacity-one private-class inventory for the rolling seven-day
-- coach publication window. Slots keep a provider-neutral location snapshot so
-- later coach-profile or fictional-gym edits cannot move an offered class.

create extension if not exists btree_gist with schema extensions;

create table app.coach_availability_slots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  coach_timezone text not null,
  status text not null default 'open',
  location_kind text not null,
  selected_gym_id uuid null,
  gym_name text null,
  public_location_label text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  location_source text not null,
  location_provider text null,
  location_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_availability_slots_coach_fkey
    foreign key (run_id, profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_availability_slots_time_order_check
    check (ends_at > starts_at),
  constraint coach_availability_slots_duration_check
    check (
      ends_at - starts_at between interval '30 minutes' and interval '180 minutes'
      and extract(epoch from (ends_at - starts_at))::bigint % 900 = 0
    ),
  constraint coach_availability_slots_start_boundary_check
    check (extract(epoch from starts_at)::bigint % 900 = 0),
  constraint coach_availability_slots_timezone_format_check
    check (
      coach_timezone = 'UTC'
      or coach_timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
    ),
  constraint coach_availability_slots_status_check
    check (status in ('open', 'held', 'booked', 'withdrawn')),
  constraint coach_availability_slots_location_kind_check
    check (location_kind in ('gym', 'independent')),
  constraint coach_availability_slots_gym_location_check
    check (
      (
        location_kind = 'gym'
        and selected_gym_id is not null
        and gym_name is not null
        and char_length(gym_name) between 2 and 120
      )
      or (
        location_kind = 'independent'
        and selected_gym_id is null
        and gym_name is null
      )
    ),
  constraint coach_availability_slots_location_label_length_check
    check (char_length(public_location_label) between 2 and 240),
  constraint coach_availability_slots_latitude_check
    check (latitude between -90 and 90),
  constraint coach_availability_slots_longitude_check
    check (longitude between -180 and 180),
  constraint coach_availability_slots_location_source_check
    check (location_source in ('fixture', 'manual', 'permanent-geocoding')),
  constraint coach_availability_slots_location_provider_check
    check (
      location_provider is null
      or (
        char_length(location_provider) between 2 and 40
        and location_provider ~ '^[a-z0-9-]+$'
      )
    ),
  constraint coach_availability_slots_location_provenance_check
    check (
      (location_source in ('fixture', 'manual') and location_provider is null)
      or (
        location_source = 'permanent-geocoding'
        and location_provider is not null
      )
    ),
  constraint coach_availability_slots_active_time_excl
    exclude using gist (
      run_id with =,
      profile_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status in ('open', 'held', 'booked'))
);

create index coach_availability_slots_public_lookup_idx
  on app.coach_availability_slots (run_id, profile_id, starts_at, id)
  where status = 'open';
create index coach_availability_slots_owner_lookup_idx
  on app.coach_availability_slots (run_id, profile_id, status, starts_at, id);

create trigger coach_availability_slots_set_updated_at
before update on app.coach_availability_slots
for each row execute function app.set_updated_at();

alter table app.coach_availability_slots enable row level security;
alter table app.coach_availability_slots force row level security;
alter table app.coach_availability_slots owner to app_owner;

revoke all on app.coach_availability_slots
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_availability_slots from app_runtime;
grant select on app.coach_availability_slots to app_runtime;

create policy coach_availability_slots_management_all
  on app.coach_availability_slots
  for all
  to app_owner
  using (current_setting('app.coach_availability_management', true) = 'on')
  with check (
    current_setting('app.coach_availability_management', true) = 'on'
  );

create policy coach_availability_slots_owner_select
  on app.coach_availability_slots
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, run_id, null));

create policy coach_availability_slots_public_select
  on app.coach_availability_slots
  for select
  to app_runtime
  using (
    status = 'open'
    and starts_at > statement_timestamp()
    and ends_at <= statement_timestamp() + interval '7 days'
    and exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = coach_availability_slots.run_id
        and coach.profile_id = coach_availability_slots.profile_id
        and coach.visibility = 'visible'
        and coach.location_confirmed_at is not null
    )
  );

create function app.create_owned_coach_availability(
  requested_local_start timestamp without time zone,
  requested_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach record;
  resolved_start timestamptz;
  resolved_end timestamptz;
  created_slot_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);

  select
    coach.*,
    gym.name as gym_name
  into selected_coach
  from app.coach_profiles as coach
  left join app.gyms as gym
    on gym.run_id = coach.run_id
    and gym.id = coach.selected_gym_id
    and gym.status = 'active'
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and coach.visibility = 'visible'
  for share of coach;

  if not found
    or (selected_coach.location_kind = 'gym' and selected_coach.gym_name is null)
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  if requested_local_start is null
    or requested_duration_minutes is null
    or requested_duration_minutes not between 30 and 180
    or requested_duration_minutes % 15 <> 0
    or extract(second from requested_local_start) <> 0
    or extract(minute from requested_local_start)::integer % 15 <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability time is invalid';
  end if;

  resolved_start := requested_local_start at time zone selected_coach.timezone;
  if resolved_start at time zone selected_coach.timezone
    <> requested_local_start
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability local time does not exist';
  end if;
  if exists (
    select 1
    from pg_catalog.generate_series(-180, 180, 15) as offset_minutes(value)
    where offset_minutes.value <> 0
      and (
        resolved_start
        + pg_catalog.make_interval(mins => offset_minutes.value)
      ) at time zone selected_coach.timezone = requested_local_start
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability local time is ambiguous';
  end if;

  resolved_end := resolved_start
    + pg_catalog.make_interval(mins => requested_duration_minutes);
  if resolved_start <= pg_catalog.statement_timestamp()
    or resolved_end > pg_catalog.statement_timestamp() + interval '7 days'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability is outside the publication window';
  end if;

  insert into app.coach_availability_slots (
    run_id,
    profile_id,
    starts_at,
    ends_at,
    coach_timezone,
    status,
    location_kind,
    selected_gym_id,
    gym_name,
    public_location_label,
    latitude,
    longitude,
    location_source,
    location_provider,
    location_confirmed_at
  ) values (
    selected_coach.run_id,
    selected_coach.profile_id,
    resolved_start,
    resolved_end,
    selected_coach.timezone,
    'open',
    selected_coach.location_kind,
    selected_coach.selected_gym_id,
    selected_coach.gym_name,
    selected_coach.public_location_label,
    selected_coach.latitude,
    selected_coach.longitude,
    selected_coach.location_source,
    selected_coach.location_provider,
    selected_coach.location_confirmed_at
  )
  returning id into created_slot_id;

  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return created_slot_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.update_owned_coach_availability(
  requested_slot_id uuid,
  requested_local_start timestamp without time zone,
  requested_duration_minutes integer,
  requested_refresh_location boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_slot app.coach_availability_slots%rowtype;
  selected_coach record;
  resolved_start timestamptz;
  resolved_end timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);

  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.id = requested_slot_id
    and slot.run_id = run_id_text::uuid
    and slot.profile_id = profile_id_text::uuid
  for update;

  if not found
    or selected_slot.status <> 'open'
    or selected_slot.starts_at <= pg_catalog.statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability slot cannot be changed';
  end if;

  select
    coach.*,
    gym.name as gym_name
  into selected_coach
  from app.coach_profiles as coach
  left join app.gyms as gym
    on gym.run_id = coach.run_id
    and gym.id = coach.selected_gym_id
    and gym.status = 'active'
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and coach.visibility = 'visible'
  for share of coach;

  if not found
    or (
      requested_refresh_location
      and selected_coach.location_kind = 'gym'
      and selected_coach.gym_name is null
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  if requested_local_start is null
    or requested_duration_minutes is null
    or requested_refresh_location is null
    or requested_duration_minutes not between 30 and 180
    or requested_duration_minutes % 15 <> 0
    or extract(second from requested_local_start) <> 0
    or extract(minute from requested_local_start)::integer % 15 <> 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability time is invalid';
  end if;

  resolved_start := requested_local_start at time zone selected_coach.timezone;
  if resolved_start at time zone selected_coach.timezone
    <> requested_local_start
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability local time does not exist';
  end if;
  if exists (
    select 1
    from pg_catalog.generate_series(-180, 180, 15) as offset_minutes(value)
    where offset_minutes.value <> 0
      and (
        resolved_start
        + pg_catalog.make_interval(mins => offset_minutes.value)
      ) at time zone selected_coach.timezone = requested_local_start
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability local time is ambiguous';
  end if;

  resolved_end := resolved_start
    + pg_catalog.make_interval(mins => requested_duration_minutes);
  if resolved_start <= pg_catalog.statement_timestamp()
    or resolved_end > pg_catalog.statement_timestamp() + interval '7 days'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability is outside the publication window';
  end if;

  update app.coach_availability_slots
  set
    starts_at = resolved_start,
    ends_at = resolved_end,
    coach_timezone = selected_coach.timezone,
    location_kind = case
      when requested_refresh_location then selected_coach.location_kind
      else location_kind
    end,
    selected_gym_id = case
      when requested_refresh_location then selected_coach.selected_gym_id
      else selected_gym_id
    end,
    gym_name = case
      when requested_refresh_location then selected_coach.gym_name
      else gym_name
    end,
    public_location_label = case
      when requested_refresh_location then selected_coach.public_location_label
      else public_location_label
    end,
    latitude = case
      when requested_refresh_location then selected_coach.latitude
      else latitude
    end,
    longitude = case
      when requested_refresh_location then selected_coach.longitude
      else longitude
    end,
    location_source = case
      when requested_refresh_location then selected_coach.location_source
      else location_source
    end,
    location_provider = case
      when requested_refresh_location then selected_coach.location_provider
      else location_provider
    end,
    location_confirmed_at = case
      when requested_refresh_location then selected_coach.location_confirmed_at
      else location_confirmed_at
    end
  where id = selected_slot.id;

  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return selected_slot.id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.withdraw_owned_coach_availability(
  requested_slot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  withdrawn_slot_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );

  update app.coach_availability_slots
  set status = 'withdrawn'
  where id = requested_slot_id
    and run_id = run_id_text::uuid
    and profile_id = profile_id_text::uuid
    and status = 'open'
    and starts_at > pg_catalog.statement_timestamp()
  returning id into withdrawn_slot_id;

  if withdrawn_slot_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability slot cannot be withdrawn';
  end if;

  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  return withdrawn_slot_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.create_owned_coach_availability(
  timestamp without time zone,
  integer
) owner to app_owner;
alter function app.update_owned_coach_availability(
  uuid,
  timestamp without time zone,
  integer,
  boolean
) owner to app_owner;
alter function app.withdraw_owned_coach_availability(uuid) owner to app_owner;

revoke all on function app.create_owned_coach_availability(
  timestamp without time zone,
  integer
) from public, anon, authenticated, service_role;
revoke all on function app.update_owned_coach_availability(
  uuid,
  timestamp without time zone,
  integer,
  boolean
) from public, anon, authenticated, service_role;
revoke all on function app.withdraw_owned_coach_availability(uuid)
  from public, anon, authenticated, service_role;

grant execute on function app.create_owned_coach_availability(
  timestamp without time zone,
  integer
) to app_runtime;
grant execute on function app.update_owned_coach_availability(
  uuid,
  timestamp without time zone,
  integer,
  boolean
) to app_runtime;
grant execute on function app.withdraw_owned_coach_availability(uuid)
  to app_runtime;

comment on table app.coach_availability_slots is
  'Explicit capacity-one coach slots with immutable-by-default public location snapshots.';
comment on column app.coach_availability_slots.status is
  'Availability lifecycle only; DEV0105 owns held/booked transitions and client booking data.';
comment on function app.create_owned_coach_availability(
  timestamp without time zone,
  integer
) is
  'Creates one owner-scoped open slot by interpreting local wall time in the coach profile timezone.';
comment on function app.update_owned_coach_availability(
  uuid,
  timestamp without time zone,
  integer,
  boolean
) is
  'Moves an owner-scoped future open slot and refreshes its location only when explicitly requested.';
comment on function app.withdraw_owned_coach_availability(uuid) is
  'Withdraws one owner-scoped future open slot without deleting its audit record.';
