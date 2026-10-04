-- Add exact one-hour weekly availability rules while retaining dated slots as
-- the capacity-one booking boundary. Occurrences are materialized on mutations
-- and reads, so this slice requires no scheduler or browser-owned generation.

create table app.coach_availability_rules (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  iso_weekday smallint not null,
  local_start_time time without time zone not null,
  coach_timezone text not null,
  status text not null default 'active',
  removed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_availability_rules_coach_fkey
    foreign key (run_id, profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_availability_rules_run_profile_id_key
    unique (run_id, profile_id, id),
  constraint coach_availability_rules_weekday_check
    check (iso_weekday between 1 and 7),
  constraint coach_availability_rules_start_check
    check (
      extract(minute from local_start_time) = 0
      and extract(second from local_start_time) = 0
      and local_start_time < time '23:00:00'
    ),
  constraint coach_availability_rules_timezone_format_check
    check (
      coach_timezone = 'UTC'
      or coach_timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
    ),
  constraint coach_availability_rules_status_check
    check (status in ('active', 'removed')),
  constraint coach_availability_rules_removed_state_check
    check ((status = 'removed') = (removed_at is not null))
);

create unique index coach_availability_rules_active_time_key
  on app.coach_availability_rules (
    run_id,
    profile_id,
    iso_weekday,
    local_start_time
  )
  where status = 'active';
create index coach_availability_rules_owner_lookup_idx
  on app.coach_availability_rules (
    run_id,
    profile_id,
    status,
    iso_weekday,
    local_start_time,
    id
  );

create trigger coach_availability_rules_set_updated_at
before update on app.coach_availability_rules
for each row execute function app.set_updated_at();

alter table app.coach_availability_rules enable row level security;
alter table app.coach_availability_rules force row level security;
alter table app.coach_availability_rules owner to app_owner;

revoke all on app.coach_availability_rules
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_availability_rules from app_runtime;
grant select on app.coach_availability_rules to app_runtime;

create policy coach_availability_rules_management_all
  on app.coach_availability_rules
  for all
  to app_owner
  using (
    current_setting('app.coach_availability_rule_management', true) = 'on'
  )
  with check (
    current_setting('app.coach_availability_rule_management', true) = 'on'
  );

create policy coach_availability_rules_owner_select
  on app.coach_availability_rules
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, run_id, null));

create policy demo_runs_coach_availability_sync_select
  on app.demo_runs
  for select
  to app_owner
  using (
    current_setting('app.coach_availability_rule_management', true) = 'on'
  );

alter table app.coach_availability_slots
  add column recurrence_rule_id uuid null,
  add column recurrence_local_date date null,
  add constraint coach_availability_slots_rule_fkey
    foreign key (run_id, profile_id, recurrence_rule_id)
    references app.coach_availability_rules (run_id, profile_id, id)
    on delete restrict,
  add constraint coach_availability_slots_recurrence_pair_check
    check (
      (recurrence_rule_id is null) = (recurrence_local_date is null)
    ),
  add constraint coach_availability_slots_recurring_duration_check
    check (
      recurrence_rule_id is null
      or ends_at - starts_at = interval '1 hour'
    );

create unique index coach_availability_slots_rule_occurrence_key
  on app.coach_availability_slots (
    recurrence_rule_id,
    recurrence_local_date
  )
  where recurrence_rule_id is not null;
create index coach_availability_slots_rule_status_idx
  on app.coach_availability_slots (
    recurrence_rule_id,
    status,
    starts_at,
    id
  )
  where recurrence_rule_id is not null;

create function app.protect_recurring_coach_availability_occurrence()
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
      current_setting('app.coach_availability_rule_management', true),
      ''
    ) <> 'on'
    and coalesce(
      current_setting('app.coach_booking_management', true),
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

create trigger coach_availability_slots_protect_recurring
before update on app.coach_availability_slots
for each row execute function
  app.protect_recurring_coach_availability_occurrence();

create function app.coach_local_time_is_unambiguous(
  requested_local_time timestamp without time zone,
  requested_timezone text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    requested_local_time is not null
    and requested_timezone is not null
    and exists (
      select 1
      from pg_catalog.pg_timezone_names as timezone_record
      where timezone_record.name = requested_timezone
    )
    and (
      requested_local_time at time zone requested_timezone
    ) at time zone requested_timezone = requested_local_time
    and not exists (
      select 1
      from pg_catalog.generate_series(-180, 180, 15)
        as offset_minutes(value)
      where offset_minutes.value <> 0
        and (
          (requested_local_time at time zone requested_timezone)
          + pg_catalog.make_interval(mins => offset_minutes.value)
        ) at time zone requested_timezone = requested_local_time
    );
$$;

alter function app.coach_local_time_is_unambiguous(
  timestamp without time zone,
  text
) owner to app_owner;
revoke all on function app.coach_local_time_is_unambiguous(
  timestamp without time zone,
  text
) from public, anon, authenticated, service_role, app_runtime;

create function app.synchronize_coach_availability_occurrences(
  requested_run_id uuid,
  requested_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_coach record;
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
  where coach.run_id = requested_run_id
    and coach.profile_id = requested_profile_id
    and coach.visibility = 'visible'
    and coach.location_confirmed_at is not null
  for share of coach;

  if not found then
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
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return 0;
  end if;
  if selected_coach.location_kind = 'gym'
    and selected_coach.gym_name is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  for selected_rule in
    select rule.*
    from app.coach_availability_rules as rule
    where rule.run_id = requested_run_id
      and rule.profile_id = requested_profile_id
      and rule.status = 'active'
    order by rule.iso_weekday, rule.local_start_time, rule.id
  loop
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
          then
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
              location_confirmed_at,
              recurrence_rule_id,
              recurrence_local_date
            ) values (
              selected_coach.run_id,
              selected_coach.profile_id,
              resolved_start,
              resolved_end,
              selected_rule.coach_timezone,
              'open',
              selected_coach.location_kind,
              selected_coach.selected_gym_id,
              selected_coach.gym_name,
              selected_coach.public_location_label,
              selected_coach.latitude,
              selected_coach.longitude,
              selected_coach.location_source,
              selected_coach.location_provider,
              selected_coach.location_confirmed_at,
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
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return total_inserted;
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
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.synchronize_coach_availability_occurrences(uuid, uuid)
  owner to app_owner;
revoke all on function app.synchronize_coach_availability_occurrences(
  uuid,
  uuid
) from public, anon, authenticated, service_role, app_runtime;

create function app.synchronize_owned_coach_availability()
returns integer
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
      message = 'coach availability actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  return app.synchronize_coach_availability_occurrences(
    run_id_text::uuid,
    profile_id_text::uuid
  );
end;
$$;

create function app.synchronize_public_coach_availability(
  requested_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_run_id uuid;
  synchronized_count integer;
begin
  if requested_profile_id is null then
    return 0;
  end if;

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);

  select coach.run_id
  into selected_run_id
  from app.coach_profiles as coach
  join app.demo_runs as demo_run on demo_run.id = coach.run_id
  where coach.profile_id = requested_profile_id
    and coach.visibility = 'visible'
    and coach.location_confirmed_at is not null
    and demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  if selected_run_id is null then
    synchronized_count := 0;
  else
    synchronized_count := app.synchronize_coach_availability_occurrences(
      selected_run_id,
      requested_profile_id
    );
  end if;

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return synchronized_count;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.create_owned_coach_availability_rule(
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
  selected_coach record;
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

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and coach.visibility = 'visible'
    and coach.location_confirmed_at is not null
  for share;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  insert into app.coach_availability_rules (
    run_id,
    profile_id,
    iso_weekday,
    local_start_time,
    coach_timezone,
    status,
    removed_at
  ) values (
    selected_coach.run_id,
    selected_coach.profile_id,
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
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return created_rule_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.remove_owned_coach_availability_rule(
  requested_rule_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_rule app.coach_availability_rules%rowtype;
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

  select rule.*
  into selected_rule
  from app.coach_availability_rules as rule
  where rule.id = requested_rule_id
    and rule.run_id = run_id_text::uuid
    and rule.profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule cannot be removed';
  end if;

  if selected_rule.status = 'active' then
    update app.coach_availability_rules
    set
      status = 'removed',
      removed_at = pg_catalog.statement_timestamp()
    where id = selected_rule.id;

    update app.coach_availability_slots
    set status = 'withdrawn'
    where recurrence_rule_id = selected_rule.id
      and status = 'open'
      and starts_at > pg_catalog.statement_timestamp();
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
  return selected_rule.id;
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
    raise;
end;
$$;

alter function app.synchronize_owned_coach_availability() owner to app_owner;
alter function app.synchronize_public_coach_availability(uuid)
  owner to app_owner;
alter function app.create_owned_coach_availability_rule(
  smallint,
  time without time zone
) owner to app_owner;
alter function app.remove_owned_coach_availability_rule(uuid)
  owner to app_owner;

revoke all on function app.synchronize_owned_coach_availability()
  from public, anon, authenticated, service_role;
revoke all on function app.synchronize_public_coach_availability(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.create_owned_coach_availability_rule(
  smallint,
  time without time zone
) from public, anon, authenticated, service_role;
revoke all on function app.remove_owned_coach_availability_rule(uuid)
  from public, anon, authenticated, service_role;

grant execute on function app.synchronize_owned_coach_availability()
  to app_runtime;
grant execute on function app.synchronize_public_coach_availability(uuid)
  to app_runtime;
grant execute on function app.create_owned_coach_availability_rule(
  smallint,
  time without time zone
) to app_runtime;
grant execute on function app.remove_owned_coach_availability_rule(uuid)
  to app_runtime;

comment on table app.coach_availability_rules is
  'Owner-scoped exact one-hour weekly rules; dated slots remain booking inventory.';
comment on column app.coach_availability_rules.iso_weekday is
  'ISO weekday: Monday = 1 through Sunday = 7.';
comment on column app.coach_availability_rules.coach_timezone is
  'Timezone snapshot; profile timezone edits never shift an existing rule.';
comment on column app.coach_availability_slots.recurrence_rule_id is
  'Optional source rule. Null identifies an explicit DEV0104 slot.';
comment on column app.coach_availability_slots.recurrence_local_date is
  'Rule-local occurrence date used with recurrence_rule_id for idempotence.';
comment on function app.synchronize_owned_coach_availability() is
  'Materializes the authorized coach recurring rules into the rolling seven-day slot horizon.';
comment on function app.synchronize_public_coach_availability(uuid) is
  'Materializes visible public coach recurring rules before a schedule read.';
comment on function app.create_owned_coach_availability_rule(
  smallint,
  time without time zone
) is
  'Creates one owner-scoped weekly one-hour rule and synchronizes its dated occurrences.';
comment on function app.remove_owned_coach_availability_rule(uuid) is
  'Soft-removes one owner rule and withdraws only its future open occurrences.';
