-- Bind recurring availability to coach-owned training locations. Rules carry
-- stable lineage while dated slots keep immutable provider-neutral snapshots.

alter table app.coach_availability_rules
  add column coach_training_location_id uuid null,
  add constraint coach_availability_rules_location_fkey
    foreign key (run_id, profile_id, coach_training_location_id)
    references app.coach_training_locations (run_id, profile_id, id)
    on delete restrict;

update app.coach_availability_rules as rule
set coach_training_location_id = location.id
from app.coach_training_locations as location
where rule.run_id = location.run_id
  and rule.profile_id = location.profile_id
  and rule.status = 'active'
  and location.status = 'active'
  and location.is_primary;

alter table app.coach_availability_rules
  add constraint coach_availability_rules_active_location_check
    check (status <> 'active' or coach_training_location_id is not null);

create index coach_availability_rules_location_lookup_idx
  on app.coach_availability_rules (
    run_id,
    profile_id,
    coach_training_location_id,
    status,
    iso_weekday,
    local_start_time,
    id
  );

alter table app.coach_availability_slots
  add column coach_training_location_id uuid null,
  add column training_location_name text null,
  add constraint coach_availability_slots_training_location_fkey
    foreign key (run_id, profile_id, coach_training_location_id)
    references app.coach_training_locations (run_id, profile_id, id)
    on delete restrict,
  add constraint coach_availability_slots_training_location_name_check
    check (
      training_location_name is null
      or char_length(training_location_name) between 2 and 240
    );

update app.coach_availability_slots
set training_location_name = coalesce(
  gym_name,
  public_location_label
)
where training_location_name is null;

update app.coach_availability_slots as slot
set coach_training_location_id = location.id
from app.coach_availability_rules as rule
join app.coach_training_locations as location
  on location.run_id = rule.run_id
  and location.profile_id = rule.profile_id
  and location.id = rule.coach_training_location_id
where slot.run_id = rule.run_id
  and slot.profile_id = rule.profile_id
  and slot.recurrence_rule_id = rule.id
  and slot.location_kind = location.location_kind
  and slot.selected_gym_id is not distinct from location.selected_gym_id
  and slot.gym_name is not distinct from (
    select gym.name
    from app.gyms as gym
    where gym.run_id = location.run_id
      and gym.id = location.selected_gym_id
  )
  and slot.public_location_label = location.public_location_label
  and slot.latitude = location.latitude
  and slot.longitude = location.longitude
  and slot.location_source = location.location_source
  and slot.location_provider is not distinct from location.location_provider
  and slot.location_confirmed_at = location.location_confirmed_at;

create index coach_availability_slots_training_location_idx
  on app.coach_availability_slots (
    run_id,
    profile_id,
    coach_training_location_id,
    status,
    starts_at,
    id
  )
  where coach_training_location_id is not null;

-- Schedule replacement and location mutations take the same coach-scoped lock.
-- Keep the DEV0176 implementations private behind wrappers so the lock is
-- acquired before either function takes a location row lock.
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
) rename to update_owned_coach_training_location_without_schedule_lock;
revoke all on function
  app.update_owned_coach_training_location_without_schedule_lock(
    uuid,
    timestamptz,
    text,
    uuid,
    text,
    numeric,
    numeric,
    text,
    text
  ) from public, anon, authenticated, service_role, app_runtime;

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
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(run_id_text, ':', profile_id_text),
      0
    )
  );

  return app.update_owned_coach_training_location_without_schedule_lock(
    requested_location_id,
    expected_updated_at,
    requested_public_name,
    requested_gym_id,
    requested_public_location_label,
    requested_latitude,
    requested_longitude,
    requested_location_source,
    requested_location_provider
  );
end;
$$;

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

alter function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) rename to set_owned_coach_primary_location_without_schedule_lock;
revoke all on function app.set_owned_coach_primary_location_without_schedule_lock(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) from public, anon, authenticated, service_role, app_runtime;

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
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(run_id_text, ':', profile_id_text),
      0
    )
  );

  return app.set_owned_coach_primary_location_without_schedule_lock(
    requested_location_id,
    expected_location_updated_at,
    expected_primary_location_id,
    expected_primary_updated_at
  );
end;
$$;

alter function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) owner to app_owner;
revoke all on function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function app.set_owned_coach_primary_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) to app_runtime;

create function app.require_active_coach_availability_rule_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' and not exists (
    select 1
    from app.coach_training_locations as location
    where location.run_id = new.run_id
      and location.profile_id = new.profile_id
      and location.id = new.coach_training_location_id
      and location.status = 'active'
      and location.location_confirmed_at is not null
      and location.timezone = new.coach_timezone
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule location is unavailable';
  end if;
  return new;
end;
$$;

create trigger coach_availability_rules_require_active_location
before insert or update of
  run_id,
  profile_id,
  coach_training_location_id,
  coach_timezone,
  status
on app.coach_availability_rules
for each row execute function
  app.require_active_coach_availability_rule_location();

alter function app.require_active_coach_availability_rule_location()
  owner to app_owner;
revoke all on function app.require_active_coach_availability_rule_location()
  from public, anon, authenticated, service_role, app_runtime;

create or replace function app.protect_recurring_coach_availability_occurrence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.recurrence_rule_id is null then
    return new;
  end if;

  if new.recurrence_rule_id is distinct from old.recurrence_rule_id
    or new.recurrence_local_date is distinct from old.recurrence_local_date
    or new.run_id is distinct from old.run_id
    or new.profile_id is distinct from old.profile_id
    or new.coach_training_location_id
      is distinct from old.coach_training_location_id
    or new.training_location_name is distinct from old.training_location_name
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.coach_timezone is distinct from old.coach_timezone
    or new.location_kind is distinct from old.location_kind
    or new.selected_gym_id is distinct from old.selected_gym_id
    or new.gym_name is distinct from old.gym_name
    or new.public_location_label is distinct from old.public_location_label
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.location_source is distinct from old.location_source
    or new.location_provider is distinct from old.location_provider
    or new.location_confirmed_at is distinct from old.location_confirmed_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability recurring occurrence is immutable';
  end if;

  if new.status is distinct from old.status
    and coalesce(
      pg_catalog.current_setting(
        'app.coach_availability_rule_management',
        true
      ),
      ''
    ) <> 'on'
    and coalesce(
      pg_catalog.current_setting('app.coach_booking_management', true),
      ''
    ) <> 'on'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability recurring occurrence status is protected';
  end if;

  return new;
end;
$$;

alter function app.protect_recurring_coach_availability_occurrence()
  owner to app_owner;
revoke all on function app.protect_recurring_coach_availability_occurrence()
  from public, anon, authenticated, service_role, app_runtime;

create or replace function app.synchronize_coach_availability_occurrences(
  requested_run_id uuid,
  requested_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_coach app.coach_profiles%rowtype;
  selected_rule record;
  horizon_start timestamptz := pg_catalog.statement_timestamp();
  horizon_end timestamptz := pg_catalog.statement_timestamp()
    + interval '7 days';
  occurrence_date date;
  last_occurrence_date date;
  local_start timestamp without time zone;
  local_end timestamp without time zone;
  resolved_start timestamptz;
  resolved_end timestamptz;
  inserted_count integer;
  total_inserted integer := 0;
  previous_rule_management text := coalesce(
    pg_catalog.current_setting(
      'app.coach_availability_rule_management',
      true
    ),
    ''
  );
  previous_availability_management text := coalesce(
    pg_catalog.current_setting('app.coach_availability_management', true),
    ''
  );
  previous_location_management text := coalesce(
    pg_catalog.current_setting(
      'app.coach_training_location_management',
      true
    ),
    ''
  );
  previous_profile_management text := coalesce(
    pg_catalog.current_setting('app.coach_profile_management', true),
    ''
  );
begin
  if requested_run_id is null or requested_profile_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability synchronization target is invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(requested_run_id::text, ':', requested_profile_id::text),
      0
    )
  );
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
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
  where coach.run_id = requested_run_id
    and coach.profile_id = requested_profile_id
    and coach.visibility = 'visible'
    and exists (
      select 1
      from app.coach_training_locations as primary_location
      where primary_location.run_id = coach.run_id
        and primary_location.profile_id = coach.profile_id
        and primary_location.status = 'active'
        and primary_location.is_primary
        and primary_location.location_confirmed_at is not null
    )
  for share;

  if not found then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      previous_rule_management,
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      previous_availability_management,
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      previous_location_management,
      true
    );
    perform pg_catalog.set_config(
      'app.coach_profile_management',
      previous_profile_management,
      true
    );
    return 0;
  end if;

  for selected_rule in
    select
      rule.id,
      rule.iso_weekday,
      rule.local_start_time,
      rule.coach_timezone,
      location.id as location_id,
      location.public_name as location_name,
      location.location_kind,
      location.selected_gym_id,
      location.public_location_label,
      location.latitude,
      location.longitude,
      location.location_source,
      location.location_provider,
      location.location_confirmed_at,
      gym.name as gym_name
    from app.coach_availability_rules as rule
    join app.coach_training_locations as location
      on location.run_id = rule.run_id
      and location.profile_id = rule.profile_id
      and location.id = rule.coach_training_location_id
      and location.status = 'active'
      and location.location_confirmed_at is not null
      and location.timezone = rule.coach_timezone
    left join app.gyms as gym
      on gym.run_id = location.run_id
      and gym.id = location.selected_gym_id
      and gym.status = 'active'
    where rule.run_id = requested_run_id
      and rule.profile_id = requested_profile_id
      and rule.status = 'active'
    order by rule.iso_weekday, rule.local_start_time, rule.id
  loop
    if selected_rule.location_kind = 'gym'
      and selected_rule.gym_name is null
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach availability rule location is unavailable';
    end if;

    occurrence_date := (
      horizon_start at time zone selected_rule.coach_timezone
    )::date;
    last_occurrence_date := (
      horizon_end at time zone selected_rule.coach_timezone
    )::date;

    while occurrence_date <= last_occurrence_date loop
      if extract(isodow from occurrence_date)::smallint
        = selected_rule.iso_weekday
      then
        local_start := occurrence_date + selected_rule.local_start_time;
        local_end := local_start + interval '1 hour';

        if app.coach_local_time_is_unambiguous(
          local_start,
          selected_rule.coach_timezone
        ) and app.coach_local_time_is_unambiguous(
          local_end,
          selected_rule.coach_timezone
        ) then
          resolved_start := local_start
            at time zone selected_rule.coach_timezone;
          resolved_end := local_end
            at time zone selected_rule.coach_timezone;

          if resolved_start > horizon_start
            and resolved_end <= horizon_end
            and resolved_end - resolved_start = interval '1 hour'
            and not exists (
              select 1
              from app.coach_availability_slots as occupied_slot
              join app.coach_availability_rules as occupied_rule
                on occupied_rule.run_id = occupied_slot.run_id
                and occupied_rule.profile_id = occupied_slot.profile_id
                and occupied_rule.id = occupied_slot.recurrence_rule_id
                and occupied_rule.status = 'removed'
              where occupied_slot.run_id = requested_run_id
                and occupied_slot.profile_id = requested_profile_id
                and occupied_slot.status in ('open', 'held', 'booked')
                and pg_catalog.tstzrange(
                  occupied_slot.starts_at,
                  occupied_slot.ends_at,
                  '[)'
                ) && pg_catalog.tstzrange(
                  resolved_start,
                  resolved_end,
                  '[)'
                )
            )
          then
            insert into app.coach_availability_slots (
              run_id,
              profile_id,
              coach_training_location_id,
              training_location_name,
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
              location_confirmed_at,
              recurrence_rule_id,
              recurrence_local_date
            ) values (
              selected_coach.run_id,
              selected_coach.profile_id,
              selected_rule.location_id,
              selected_rule.location_name,
              resolved_start,
              resolved_end,
              selected_rule.coach_timezone,
              'open',
              selected_rule.location_kind,
              selected_rule.selected_gym_id,
              selected_rule.gym_name,
              selected_rule.public_location_label,
              selected_rule.latitude,
              selected_rule.longitude,
              selected_rule.location_source,
              selected_rule.location_provider,
              selected_rule.location_confirmed_at,
              selected_rule.id,
              occurrence_date
            )
            on conflict (
              recurrence_rule_id,
              recurrence_local_date
            ) where recurrence_rule_id is not null
            do nothing;
            get diagnostics inserted_count = row_count;
            total_inserted := total_inserted + inserted_count;
          end if;
        end if;
      end if;
      occurrence_date := occurrence_date + 1;
    end loop;
  end loop;

  if exists (
    select 1
    from app.coach_availability_rules as rule
    where rule.run_id = requested_run_id
      and rule.profile_id = requested_profile_id
      and rule.status = 'active'
      and not exists (
        select 1
        from app.coach_training_locations as location
        where location.run_id = rule.run_id
          and location.profile_id = rule.profile_id
          and location.id = rule.coach_training_location_id
          and location.status = 'active'
          and location.location_confirmed_at is not null
          and location.timezone = rule.coach_timezone
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule location is unavailable';
  end if;

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    previous_rule_management,
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    previous_availability_management,
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    previous_location_management,
    true
  );
  perform pg_catalog.set_config(
    'app.coach_profile_management',
    previous_profile_management,
    true
  );
  return total_inserted;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      previous_rule_management,
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      previous_availability_management,
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      previous_location_management,
      true
    );
    perform pg_catalog.set_config(
      'app.coach_profile_management',
      previous_profile_management,
      true
    );
    raise;
end;
$$;

alter function app.synchronize_coach_availability_occurrences(uuid, uuid)
  owner to app_owner;
revoke all on function app.synchronize_coach_availability_occurrences(
  uuid,
  uuid
) from public, anon, authenticated, service_role, app_runtime;

drop function app.create_owned_coach_availability_rule(
  requested_iso_weekday smallint,
  requested_local_start_time time without time zone
);

create function app.create_owned_coach_availability_rule(
  requested_location_id uuid,
  expected_location_updated_at timestamptz,
  requested_iso_weekday smallint,
  requested_local_start_time time without time zone
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
  selected_location app.coach_training_locations%rowtype;
  created_rule_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability actor context is invalid';
  end if;
  if requested_iso_weekday is null
    or requested_iso_weekday not between 1 and 7
    or requested_local_start_time is null
    or extract(minute from requested_local_start_time) <> 0
    or extract(second from requested_local_start_time) <> 0
    or requested_local_start_time >= time '23:00:00'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(run_id_text, ':', profile_id_text),
      0
    )
  );
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and coach.visibility = 'visible'
  for share;

  select location.*
  into selected_location
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.id = requested_location_id
    and location.status = 'active'
    and location.location_confirmed_at is not null
    and location.updated_at = expected_location_updated_at
  for share;

  if selected_coach.profile_id is null
    or selected_location.id is null
    or selected_location.timezone <> selected_coach.timezone
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  insert into app.coach_availability_rules (
    run_id,
    profile_id,
    coach_training_location_id,
    iso_weekday,
    local_start_time,
    coach_timezone,
    status,
    removed_at
  ) values (
    selected_coach.run_id,
    selected_coach.profile_id,
    selected_location.id,
    requested_iso_weekday,
    requested_local_start_time,
    selected_coach.timezone,
    'active',
    null
  )
  returning id into created_rule_id;

  perform app.synchronize_coach_availability_occurrences(
    selected_coach.run_id,
    selected_coach.profile_id
  );

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return created_rule_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.create_owned_coach_availability_rule(
  uuid,
  timestamptz,
  smallint,
  time without time zone
) owner to app_owner;
revoke all on function app.create_owned_coach_availability_rule(
  uuid,
  timestamptz,
  smallint,
  time without time zone
) from public, anon, authenticated, service_role;
grant execute on function app.create_owned_coach_availability_rule(
  uuid,
  timestamptz,
  smallint,
  time without time zone
) to app_runtime;

drop function app.replace_owned_coach_availability_rules(jsonb, jsonb);

create function app.replace_owned_coach_availability_rules(
  requested_rules jsonb,
  expected_rules jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach app.coach_profiles%rowtype;
  requested_count integer;
  expected_count integer;
  current_rules jsonb;
  normalized_requested_rules jsonb;
  normalized_expected_rules jsonb;
  removed_rule_ids uuid[];
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability actor context is invalid';
  end if;
  if requested_rules is null
    or pg_catalog.jsonb_typeof(requested_rules) <> 'array'
    or expected_rules is null
    or pg_catalog.jsonb_typeof(expected_rules) <> 'array'
    or pg_catalog.octet_length(requested_rules::text) > 32768
    or pg_catalog.octet_length(expected_rules::text) > 32768
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule set is invalid';
  end if;

  requested_count := pg_catalog.jsonb_array_length(requested_rules);
  expected_count := pg_catalog.jsonb_array_length(expected_rules);
  if requested_count > 161
    or expected_count > 161
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(requested_rules) as item(value)
      where pg_catalog.jsonb_typeof(item.value) <> 'object'
        or (
          select pg_catalog.count(*)
          from pg_catalog.jsonb_object_keys(item.value)
        ) <> 4
        or pg_catalog.jsonb_typeof(item.value -> 'locationId') <> 'string'
        or (item.value ->> 'locationId')
          !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or pg_catalog.jsonb_typeof(item.value -> 'locationUpdatedAt')
          <> 'string'
        or pg_catalog.char_length(item.value ->> 'locationUpdatedAt')
          not between 20 and 40
        or pg_catalog.jsonb_typeof(item.value -> 'isoWeekday') <> 'number'
        or (item.value ->> 'isoWeekday') !~ '^[1-7]$'
        or pg_catalog.jsonb_typeof(item.value -> 'localStartTime') <> 'string'
        or (item.value ->> 'localStartTime')
          !~ '^([01][0-9]|2[0-2]):00$'
    )
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(expected_rules) as item(value)
      where pg_catalog.jsonb_typeof(item.value) <> 'object'
        or (
          select pg_catalog.count(*)
          from pg_catalog.jsonb_object_keys(item.value)
        ) <> 4
        or pg_catalog.jsonb_typeof(item.value -> 'locationId') <> 'string'
        or (item.value ->> 'locationId')
          !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or pg_catalog.jsonb_typeof(item.value -> 'locationUpdatedAt')
          <> 'string'
        or pg_catalog.char_length(item.value ->> 'locationUpdatedAt')
          not between 20 and 40
        or pg_catalog.jsonb_typeof(item.value -> 'isoWeekday') <> 'number'
        or (item.value ->> 'isoWeekday') !~ '^[1-7]$'
        or pg_catalog.jsonb_typeof(item.value -> 'localStartTime') <> 'string'
        or (item.value ->> 'localStartTime')
          !~ '^([01][0-9]|2[0-2]):00$'
    )
    or requested_count <> (
      select pg_catalog.count(distinct pg_catalog.concat(
        item.value ->> 'isoWeekday',
        '|',
        item.value ->> 'localStartTime'
      ))
      from pg_catalog.jsonb_array_elements(requested_rules) as item(value)
    )
    or expected_count <> (
      select pg_catalog.count(distinct pg_catalog.concat(
        item.value ->> 'isoWeekday',
        '|',
        item.value ->> 'localStartTime'
      ))
      from pg_catalog.jsonb_array_elements(expected_rules) as item(value)
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule set is invalid';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(item.value order by
      (item.value ->> 'isoWeekday')::smallint,
      item.value ->> 'localStartTime',
      item.value ->> 'locationId'
    ),
    '[]'::jsonb
  )
  into normalized_requested_rules
  from pg_catalog.jsonb_array_elements(requested_rules) as item(value);

  select coalesce(
    pg_catalog.jsonb_agg(item.value order by
      (item.value ->> 'isoWeekday')::smallint,
      item.value ->> 'localStartTime',
      item.value ->> 'locationId'
    ),
    '[]'::jsonb
  )
  into normalized_expected_rules
  from pg_catalog.jsonb_array_elements(expected_rules) as item(value);

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(run_id_text, ':', profile_id_text),
      0
    )
  );
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and coach.visibility = 'visible'
    and exists (
      select 1
      from app.coach_training_locations as primary_location
      where primary_location.run_id = coach.run_id
        and primary_location.profile_id = coach.profile_id
        and primary_location.status = 'active'
        and primary_location.is_primary
        and primary_location.location_confirmed_at is not null
    )
  for share;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  perform 1
  from app.coach_training_locations as location
  where location.run_id = selected_coach.run_id
    and location.profile_id = selected_coach.profile_id
  order by location.id
  for update;

  perform 1
  from app.coach_availability_rules as rule
  where rule.run_id = selected_coach.run_id
    and rule.profile_id = selected_coach.profile_id
    and rule.status = 'active'
  order by rule.id
  for update;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'locationId', rule.coach_training_location_id::text,
        'locationUpdatedAt',
        pg_catalog.to_jsonb(location.updated_at) #>> '{}',
        'isoWeekday', rule.iso_weekday,
        'localStartTime', pg_catalog.to_char(
          rule.local_start_time,
          'HH24:MI'
        )
      ) order by
        rule.iso_weekday,
        rule.local_start_time,
        rule.coach_training_location_id
    ),
    '[]'::jsonb
  )
  into current_rules
  from app.coach_availability_rules as rule
  join app.coach_training_locations as location
    on location.run_id = rule.run_id
    and location.profile_id = rule.profile_id
    and location.id = rule.coach_training_location_id
  where rule.run_id = selected_coach.run_id
    and rule.profile_id = selected_coach.profile_id
    and rule.status = 'active';

  if current_rules <> normalized_expected_rules then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return -1;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(normalized_requested_rules)
      as requested(value)
    where not exists (
      select 1
      from app.coach_training_locations as location
      where location.run_id = selected_coach.run_id
        and location.profile_id = selected_coach.profile_id
        and location.id = (requested.value ->> 'locationId')::uuid
        and location.status = 'active'
        and location.location_confirmed_at is not null
        and location.timezone = selected_coach.timezone
        and pg_catalog.to_jsonb(location.updated_at) #>> '{}'
          = requested.value ->> 'locationUpdatedAt'
    )
  ) then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return -1;
  end if;

  if current_rules = normalized_requested_rules then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return requested_count;
  end if;

  with removed_rules as (
    update app.coach_availability_rules as rule
    set
      status = 'removed',
      removed_at = pg_catalog.statement_timestamp()
    where rule.run_id = selected_coach.run_id
      and rule.profile_id = selected_coach.profile_id
      and rule.status = 'active'
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(normalized_requested_rules)
          as requested(value)
        where requested.value ->> 'locationId'
            = rule.coach_training_location_id::text
          and (requested.value ->> 'isoWeekday')::smallint
            = rule.iso_weekday
          and (requested.value ->> 'localStartTime')::time
            = rule.local_start_time
      )
    returning rule.id
  )
  select coalesce(
    pg_catalog.array_agg(removed_rules.id),
    array[]::uuid[]
  )
  into removed_rule_ids
  from removed_rules;

  update app.coach_availability_slots as slot
  set status = 'withdrawn'
  where slot.recurrence_rule_id = any(removed_rule_ids)
    and slot.status = 'open'
    and slot.starts_at > pg_catalog.statement_timestamp();

  insert into app.coach_availability_rules (
    run_id,
    profile_id,
    coach_training_location_id,
    iso_weekday,
    local_start_time,
    coach_timezone,
    status,
    removed_at
  )
  select
    selected_coach.run_id,
    selected_coach.profile_id,
    (requested.value ->> 'locationId')::uuid,
    (requested.value ->> 'isoWeekday')::smallint,
    (requested.value ->> 'localStartTime')::time without time zone,
    selected_coach.timezone,
    'active',
    null
  from pg_catalog.jsonb_array_elements(normalized_requested_rules)
    as requested(value)
  where not exists (
    select 1
    from app.coach_availability_rules as rule
    where rule.run_id = selected_coach.run_id
      and rule.profile_id = selected_coach.profile_id
      and rule.status = 'active'
      and rule.coach_training_location_id
        = (requested.value ->> 'locationId')::uuid
      and rule.iso_weekday
        = (requested.value ->> 'isoWeekday')::smallint
      and rule.local_start_time
        = (requested.value ->> 'localStartTime')::time without time zone
  );

  perform app.synchronize_coach_availability_occurrences(
    selected_coach.run_id,
    selected_coach.profile_id
  );
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return requested_count;
exception
  when sqlstate 'P0001'
    or unique_violation
    or exclusion_violation
    or check_violation
    or foreign_key_violation
    or invalid_text_representation
    or invalid_datetime_format
  then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return -1;
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.replace_owned_coach_availability_rules(jsonb, jsonb)
  owner to app_owner;
revoke all on function app.replace_owned_coach_availability_rules(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function app.replace_owned_coach_availability_rules(jsonb, jsonb)
  to app_runtime;

create or replace function app.deactivate_owned_coach_training_location(
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
  removed_rule_ids uuid[];
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(run_id_text, ':', profile_id_text),
      0
    )
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );

  perform 1
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
  order by location.id
  for update;

  perform 1
  from app.coach_availability_rules as rule
  where rule.run_id = run_id_text::uuid
    and rule.profile_id = profile_id_text::uuid
    and rule.status = 'active'
  order by rule.id
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

  with removed_rules as (
    update app.coach_availability_rules as rule
    set
      status = 'removed',
      removed_at = pg_catalog.statement_timestamp()
    where rule.run_id = selected_location.run_id
      and rule.profile_id = selected_location.profile_id
      and rule.coach_training_location_id = selected_location.id
      and rule.status = 'active'
    returning rule.id
  )
  select coalesce(
    pg_catalog.array_agg(removed_rules.id),
    array[]::uuid[]
  )
  into removed_rule_ids
  from removed_rules;

  update app.coach_availability_slots as slot
  set status = 'withdrawn'
  where slot.recurrence_rule_id = any(removed_rule_ids)
    and slot.status = 'open'
    and slot.starts_at > pg_catalog.statement_timestamp();

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
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return selected_location.id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) owner to app_owner;
revoke all on function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) to app_runtime;

create function app.sync_coach_availability_timezone_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.timezone is not distinct from old.timezone then
    return new;
  end if;

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  update app.coach_availability_slots as slot
  set status = 'withdrawn'
  where slot.run_id = new.run_id
    and slot.profile_id = new.profile_id
    and slot.status = 'open'
    and slot.starts_at > pg_catalog.statement_timestamp()
    and slot.recurrence_rule_id in (
      select rule.id
      from app.coach_availability_rules as rule
      where rule.run_id = new.run_id
        and rule.profile_id = new.profile_id
        and rule.status = 'active'
    );

  with removed_rules as (
    update app.coach_availability_rules as rule
    set
      status = 'removed',
      removed_at = pg_catalog.statement_timestamp()
    where rule.run_id = new.run_id
      and rule.profile_id = new.profile_id
      and rule.status = 'active'
    returning
      rule.coach_training_location_id,
      rule.iso_weekday,
      rule.local_start_time
  )
  insert into app.coach_availability_rules (
    run_id,
    profile_id,
    coach_training_location_id,
    iso_weekday,
    local_start_time,
    coach_timezone,
    status,
    removed_at
  )
  select
    new.run_id,
    new.profile_id,
    removed_rule.coach_training_location_id,
    removed_rule.iso_weekday,
    removed_rule.local_start_time,
    new.timezone,
    'active',
    null
  from removed_rules as removed_rule;

  perform app.synchronize_coach_availability_occurrences(
    new.run_id,
    new.profile_id
  );

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;

create trigger coach_profiles_sync_training_schedule_timezone
after update of timezone on app.coach_profiles
for each row execute function
  app.sync_coach_availability_timezone_from_profile();

alter function app.sync_coach_availability_timezone_from_profile()
  owner to app_owner;
revoke all on function app.sync_coach_availability_timezone_from_profile()
  from public, anon, authenticated, service_role, app_runtime;

create or replace function app.cancel_direct_private_booking(
  requested_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking cancellation is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.credit_projection_id is null
    and profile_id_text::uuid in (
      booking.client_profile_id,
      booking.coach_profile_id
    )
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking cancellation is unauthorized';
  end if;

  if selected_booking.status = 'cancelled' then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;

  if selected_booking.status <> 'confirmed'
    or selected_booking.scheduled_start_at <= pg_catalog.statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking cannot be cancelled';
  end if;

  update app.coach_private_bookings
  set
    status = 'cancelled',
    cancelled_at = pg_catalog.statement_timestamp(),
    cancelled_by_profile_id = profile_id_text::uuid
  where id = selected_booking.id;

  update app.coach_availability_slots as slot
  set status = case
    when slot.recurrence_rule_id is null then 'open'
    when exists (
      select 1
      from app.coach_availability_rules as rule
      join app.coach_training_locations as location
        on location.run_id = rule.run_id
        and location.profile_id = rule.profile_id
        and location.id = rule.coach_training_location_id
      where rule.run_id = slot.run_id
        and rule.profile_id = slot.profile_id
        and rule.id = slot.recurrence_rule_id
        and rule.status = 'active'
        and location.status = 'active'
    ) then 'open'
    else 'withdrawn'
  end
  where slot.id = selected_booking.slot_id
    and slot.run_id = selected_booking.run_id
    and slot.status = 'booked'
    and slot.starts_at > pg_catalog.statement_timestamp();

  if exists (
    select 1
    from app.coach_availability_slots as slot
    where slot.id = selected_booking.slot_id
      and slot.run_id = selected_booking.run_id
      and slot.status = 'withdrawn'
      and slot.recurrence_rule_id is not null
  ) then
    perform app.synchronize_coach_availability_occurrences(
      selected_booking.run_id,
      selected_booking.coach_profile_id
    );
  end if;

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
  return selected_booking.id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

alter function app.cancel_direct_private_booking(uuid) owner to app_owner;
revoke all on function app.cancel_direct_private_booking(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app.cancel_direct_private_booking(uuid)
  to app_runtime;

drop function app.current_direct_private_bookings();

create function app.current_direct_private_bookings()
returns table (
  id uuid,
  run_id uuid,
  slot_id uuid,
  coach_profile_id uuid,
  coach_display_name text,
  coach_slug text,
  client_profile_id uuid,
  client_display_name text,
  status text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  coach_timezone text,
  coach_training_location_id uuid,
  training_location_name text,
  location_kind text,
  gym_name text,
  public_location_label text,
  cancelled_by_profile_id uuid,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking projection is unauthorized';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'on', true);

  return query
  select
    direct_booking.id,
    direct_booking.run_id,
    direct_booking.slot_id,
    direct_booking.coach_profile_id,
    coach.display_name,
    coach.public_slug,
    direct_booking.client_profile_id,
    client.display_name,
    direct_booking.status,
    direct_booking.scheduled_start_at,
    direct_booking.scheduled_end_at,
    slot.coach_timezone,
    slot.coach_training_location_id,
    coalesce(
      slot.training_location_name,
      slot.gym_name,
      slot.public_location_label
    ),
    slot.location_kind,
    slot.gym_name,
    slot.public_location_label,
    direct_booking.cancelled_by_profile_id,
    direct_booking.cancelled_at,
    direct_booking.completed_at,
    direct_booking.created_at
  from app.coach_private_bookings as direct_booking
  join app.coach_profiles as coach
    on coach.run_id = direct_booking.run_id
    and coach.profile_id = direct_booking.coach_profile_id
  join app.profiles as client
    on client.id = direct_booking.client_profile_id
  join app.coach_availability_slots as slot
    on slot.run_id = direct_booking.run_id
    and slot.id = direct_booking.slot_id
  where direct_booking.run_id = run_id_text::uuid
    and direct_booking.credit_projection_id is null
    and profile_id_text::uuid in (
      direct_booking.client_profile_id,
      direct_booking.coach_profile_id
    )
  order by direct_booking.scheduled_start_at desc, direct_booking.id;

  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

alter function app.current_direct_private_bookings() owner to app_owner;
revoke all on function app.current_direct_private_bookings()
  from public, anon, authenticated, service_role;
grant execute on function app.current_direct_private_bookings()
  to app_runtime;

comment on column app.coach_availability_rules.coach_training_location_id is
  'Stable owner-scoped training location assigned to this recurring hour; removed pre-migration rules may lack trustworthy lineage.';
comment on column app.coach_availability_slots.coach_training_location_id is
  'Stable location lineage when trustworthy; the immutable slot snapshot remains authoritative for historical display.';
comment on column app.coach_availability_slots.training_location_name is
  'Immutable public location name copied when the dated occurrence is materialized.';
comment on function app.replace_owned_coach_availability_rules(jsonb, jsonb) is
  'Atomically replaces an authorized coach working week from bounded versioned location assignments and synchronizes dated occurrences once.';
comment on function app.deactivate_owned_coach_training_location(
  uuid,
  timestamptz,
  uuid,
  timestamptz
) is
  'Soft-deactivates one owned location, removes its rules, withdraws future open occurrences and atomically replaces primary when required.';
comment on function app.current_direct_private_bookings() is
  'Returns bounded scheduling-only booking projections with immutable actual-location snapshots to the booking client or owning coach.';
