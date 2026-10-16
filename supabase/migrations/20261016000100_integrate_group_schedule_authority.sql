-- DEV0238: one coach-wide authority for group and private time.
alter table app.coach_group_sessions add column published_from_revision integer
  check (published_from_revision is null or published_from_revision >= 1);
update app.coach_group_sessions set published_from_revision = greatest(revision - 1,1) where published_at is not null;
create index coach_group_reserved_time on app.coach_group_sessions(run_id,coach_profile_id,starts_at,ends_at)
  where status in ('open','confirmed');

create index coach_availability_withdrawn_time on app.coach_availability_slots(run_id,profile_id,starts_at,ends_at) where status = 'withdrawn';

create function app.group_schedule_lock(dataset uuid, coach uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if dataset is null or coach is null then raise exception 'coach schedule scope is invalid' using errcode = 'P0001'; end if;
  -- Same key as existing recurrence/location/rule operations. Row triggers can
  -- enter after a row lock: never wait here and invert that established order.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.concat(dataset::text,':',coach::text),0)) then
    raise exception 'coach schedule changed; retry operation' using errcode = '40001';
  end if;
end;
$$;

create function app.group_time_reserved(dataset uuid, coach uuid, from_time timestamptz, to_time timestamptz, excluding uuid default null)
returns boolean language plpgsql set search_path = '' as $$
declare candidate uuid; occupied boolean; previous_flag text := coalesce(current_setting('app.group_session_management',true),'');
begin
  perform app.group_schedule_lock(dataset,coach);
  perform set_config('app.group_session_management','on',true);
  for candidate in select id from app.coach_group_sessions
    where run_id = dataset and coach_profile_id = coach and status = 'open'
      and decision_deadline_at <= clock_timestamp() and id is distinct from excluding
      and tstzrange(starts_at,ends_at,'[)') && tstzrange(from_time,to_time,'[)') order by id loop
    perform app.group_reconcile_session(candidate);
  end loop;
  select exists(select 1 from app.coach_group_sessions
    where run_id = dataset and coach_profile_id = coach and id is distinct from excluding
      and (status = 'confirmed' or (status = 'open' and decision_deadline_at > clock_timestamp()))
      and tstzrange(starts_at,ends_at,'[)') && tstzrange(from_time,to_time,'[)')) into occupied;
  perform set_config('app.group_session_management',previous_flag,true);
  return occupied;
exception when others then
  perform set_config('app.group_session_management',previous_flag,true); raise;
end;
$$;

-- Only owner functions need these lookups; runtime raw-table grants do not change.
create policy group_schedule_lookup on app.coach_availability_slots for select to app_owner
  using (current_setting('app.group_session_management',true) = 'on');
create policy group_schedule_lookup on app.coach_private_bookings for select to app_owner
  using (current_setting('app.group_session_management',true) = 'on');

create function app.guard_coach_schedule_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; dataset uuid; coach uuid; administrator boolean; previous_flag text := coalesce(current_setting('app.group_session_management',true),'');
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  coach := coalesce(row_data->>'coach_profile_id',row_data->>'profile_id')::uuid;
  perform set_config('app.group_session_management','on',true);
  if tg_table_name = 'coach_applications' then
    for dataset in select run_id from app.coach_profiles where profile_id = coach order by run_id loop
      perform app.group_schedule_lock(dataset,coach);
    end loop;
  else
    dataset := (row_data->>'run_id')::uuid;
    perform app.group_schedule_lock(dataset,coach);
    if tg_op = 'UPDATE' and (old.run_id is distinct from new.run_id) then
      raise exception 'coach schedule identity must be retained' using errcode = 'P0001';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select (rolsuper or (rolcreatedb and rolcreaterole and rolbypassrls)) and current_setting('role',true) <> 'app_runtime'
      into administrator from pg_roles where rolname = session_user;
    if tg_table_name = 'coach_availability_slots' and row_data->>'status' <> 'withdrawn' then
      if not administrator and (tg_op = 'INSERT' or old.status = 'withdrawn' or old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at)
        and (row_data->>'starts_at')::timestamptz <= clock_timestamp() then
        raise exception 'coach availability is elapsed' using errcode = 'P0001';
      end if;
      if app.group_time_reserved(dataset,coach,(row_data->>'starts_at')::timestamptz,(row_data->>'ends_at')::timestamptz) then
        raise exception 'coach availability conflicts with a group session' using errcode = 'P0001';
      end if;
    elsif tg_table_name = 'coach_private_bookings' and row_data->>'status' = 'confirmed' then
      if not administrator and (tg_op = 'INSERT' or old.status <> 'confirmed') and (row_data->>'scheduled_start_at')::timestamptz <= clock_timestamp() then
        raise exception 'direct coach booking is elapsed' using errcode = 'P0001';
      end if;
      if app.group_time_reserved(dataset,coach,(row_data->>'scheduled_start_at')::timestamptz,(row_data->>'scheduled_end_at')::timestamptz) then
        raise exception 'direct coach booking conflicts with a group session' using errcode = 'P0001';
      end if;
    end if;
  end if;
  perform set_config('app.group_session_management',previous_flag,true);
  if tg_op = 'DELETE' then return old; else return new; end if;
exception when others then
  perform set_config('app.group_session_management',previous_flag,true); raise;
end;
$$;
do $$ declare relation text; begin
  foreach relation in array array['coach_profiles','coach_applications','coach_profile_disciplines','coach_training_locations','coach_availability_rules','coach_availability_slots','coach_booking_requests','coach_private_bookings'] loop
    execute format('create trigger aaa_group_schedule_write before insert or update or delete on app.%I for each row execute function app.guard_coach_schedule_write()',relation);
  end loop;
end $$;

create or replace function app.guard_group_session() returns trigger language plpgsql set search_path = '' as $$
declare administrator boolean;
begin
  if tg_op = 'DELETE' then
    perform app.group_schedule_lock(old.run_id,old.coach_profile_id);
    if old.status <> 'draft' and current_user = 'app_owner' then raise exception 'group history must be retained' using errcode = 'P0001'; end if;
    return old;
  end if;
  perform app.group_schedule_lock(new.run_id,new.coach_profile_id);
  select rolsuper or (rolcreatedb and rolcreaterole and rolbypassrls) into administrator from pg_roles where rolname = current_user;
  if ((tg_op = 'INSERT' and new.status <> 'draft') or (tg_op = 'UPDATE' and old.status = 'draft' and new.status <> 'draft')) and not administrator then
    if tg_op = 'INSERT' or current_setting('app.group_publication_management',true) is distinct from 'on'
      or not app.authorized_actor_context_valid(new.coach_profile_id,new.run_id,null)
      or not app.group_coach_enabled(new.run_id,new.coach_profile_id,true) then
      raise exception 'group publication is unavailable' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.run_id,new.coach_profile_id,new.slug,new.created_at) is distinct from (old.id,old.run_id,old.coach_profile_id,old.slug,old.created_at) then
      raise exception 'group identity must be retained' using errcode = 'P0001';
    end if;
    if old.status <> 'draft' and (new.title,new.description,new.discipline,new.intended_level,new.training_location_id,new.venue_snapshot,new.starts_at,new.ends_at,new.decision_deadline_at,new.minimum_participants,new.maximum_participants,new.price_cents,new.currency,new.published_at,new.published_from_revision)
      is distinct from (old.title,old.description,old.discipline,old.intended_level,old.training_location_id,old.venue_snapshot,old.starts_at,old.ends_at,old.decision_deadline_at,old.minimum_participants,old.maximum_participants,old.price_cents,old.currency,old.published_at,old.published_from_revision) then
      raise exception 'published group terms are immutable' using errcode = 'P0001';
    end if;
    if new.status <> old.status and not ((old.status = 'open' and new.status in ('confirmed','cancelled','not-confirmed')) or (old.status = 'confirmed' and new.status = 'cancelled') or (old.status = 'draft' and new.status = 'open')) then
      raise exception 'group transition is terminal' using errcode = 'P0001';
    end if;
    if old.confirmed_at is not null and (new.confirmed_at,new.confirmed_by_profile_id) is distinct from (old.confirmed_at,old.confirmed_by_profile_id) then
      raise exception 'group confirmation must be retained' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create function app.publish_group_session(requested_id uuid, expected_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions; venue app.coach_training_locations;
  snapshot jsonb; checked_at timestamptz; result jsonb; outcome text; reason text;
  previous_group text := coalesce(current_setting('app.group_session_management',true),'');
  previous_publication text := coalesce(current_setting('app.group_publication_management',true),'');
begin
  if requested_id is null or expected_revision is null or expected_revision < 1 or not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'group publication is unavailable' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id',true)::uuid; dataset := current_setting('app.current_run_id',true)::uuid;
  perform app.group_schedule_lock(dataset,actor);
  perform set_config('app.group_session_management','on',true);
  select * into activity from app.coach_group_sessions where id = requested_id and run_id = dataset and coach_profile_id = actor;
  if not found then raise exception 'group publication is unavailable' using errcode = 'P0001'; end if;
  -- Lock eligibility before the draft row, preserving the current application/coach order.
  if activity.status = 'draft' then perform app.group_lock_coach(dataset,actor,true); end if;
  activity := app.group_reconcile_session(requested_id);
  if activity.status in ('open','confirmed') and activity.published_from_revision = expected_revision then
    outcome := 'published';
  elsif activity.status <> 'draft' then outcome := 'unavailable'; reason := 'unavailable';
  elsif activity.revision <> expected_revision then outcome := 'changed'; reason := 'draft-changed';
  else
    select * into venue from app.coach_training_locations where id = activity.training_location_id and run_id = dataset and profile_id = actor and status = 'active' and location_confirmed_at is not null for share;
    checked_at := clock_timestamp();
    if not found or venue.timezone <> 'Europe/Berlin' or activity.decision_deadline_at <= checked_at
      or not exists(select 1 from app.coach_profile_disciplines where run_id = dataset and profile_id = actor and discipline = activity.discipline)
      or not app.coach_local_time_is_unambiguous(activity.starts_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(activity.ends_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(activity.decision_deadline_at at time zone 'Europe/Berlin','Europe/Berlin') then
      outcome := 'unavailable'; reason := 'unavailable';
    else
      snapshot := jsonb_build_object('id',venue.id,'name',venue.public_name,'label',venue.public_location_label,'kind',venue.location_kind,'latitude',venue.latitude,'longitude',venue.longitude);
      if snapshot is distinct from activity.venue_snapshot then outcome := 'changed'; reason := 'venue-changed';
      elsif app.group_time_reserved(dataset,actor,activity.starts_at,activity.ends_at,activity.id)
        or exists(select 1 from app.coach_availability_slots where run_id = dataset and profile_id = actor and status <> 'withdrawn' and tstzrange(starts_at,ends_at,'[)') && tstzrange(activity.starts_at,activity.ends_at,'[)'))
        or exists(select 1 from app.coach_private_bookings where run_id = dataset and coach_profile_id = actor and status = 'confirmed' and tstzrange(scheduled_start_at,scheduled_end_at,'[)') && tstzrange(activity.starts_at,activity.ends_at,'[)')) then
        outcome := 'conflict'; reason := 'schedule-conflict';
      else
        -- Recheck after all potentially waiting locks, including expiry reconciliation.
        checked_at := clock_timestamp();
        if activity.decision_deadline_at <= checked_at then outcome := 'unavailable'; reason := 'unavailable';
        else
          perform set_config('app.group_publication_management','on',true);
          update app.coach_group_sessions set status = 'open',published_at = checked_at,published_from_revision = expected_revision,revision = revision + 1,updated_at = checked_at where id = requested_id;
          outcome := 'published';
        end if;
      end if;
    end if;
  end if;
  result := jsonb_build_object('outcome',outcome,'reason',reason,'session',app.group_session_projection(requested_id,actor));
  perform set_config('app.group_session_management',previous_group,true);
  perform set_config('app.group_publication_management',previous_publication,true);
  return result;
exception when others then
  perform set_config('app.group_session_management',previous_group,true);
  perform set_config('app.group_publication_management',previous_publication,true); raise;
end;
$$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname in ('group_schedule_lock','group_time_reserved','guard_coach_schedule_write','publish_group_session') loop
    execute format('alter function %s owner to app_owner',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime',f.signature);
  end loop;
end $$;
grant execute on function app.publish_group_session(uuid,integer) to app_runtime;

-- Preserve location/rule/date identity and all existing recurrence behavior.
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
  horizon_start timestamptz;
  horizon_end timestamptz;
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
  horizon_start := clock_timestamp();
  horizon_end := horizon_start + interval '7 days';
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
            and not app.group_time_reserved(requested_run_id,requested_profile_id,resolved_start,resolved_end)
            and not exists (select 1 from app.coach_availability_slots closed_date where closed_date.run_id = requested_run_id and closed_date.profile_id = requested_profile_id and closed_date.status = 'withdrawn' and closed_date.starts_at = resolved_start and closed_date.ends_at = resolved_end)
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


-- Owner closure may terminate a recurring date without changing its identity.
create or replace function app.close_coach_booking_request_occurrence(
  requested_slot_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_slot app.coach_availability_slots%rowtype;
  occurrence_status text;
  request_time timestamptz;
  previous_rule_management text := coalesce(current_setting('app.coach_availability_rule_management',true),'');
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_slot_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request occurrence closure is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  request_time := pg_catalog.statement_timestamp();
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );

  perform 1
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
  for share;
  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.run_id = run_id_text::uuid
    and slot.id = requested_slot_id
    and slot.profile_id = profile_id_text::uuid
  for update;

  if selected_slot.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request occurrence closure is unauthorized';
  end if;

  perform request.id
  from app.coach_booking_requests as request
  where request.run_id = selected_slot.run_id
    and request.slot_id = selected_slot.id
    and request.status = 'pending'
  order by request.id
  for update;

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = request_time
  where request.run_id = selected_slot.run_id
    and request.slot_id = selected_slot.id
    and request.status = 'pending'
    and request.decision_deadline_at <= request_time;

  request_time := clock_timestamp();
  perform set_config('app.coach_availability_rule_management','on',true);
  occurrence_status := selected_slot.status;
  if selected_slot.status = 'open'
    and selected_slot.starts_at > request_time
  then
    update app.coach_availability_slots
    set status = 'withdrawn'
    where run_id = selected_slot.run_id
      and id = selected_slot.id
      and status = 'open';
    occurrence_status := 'withdrawn';
  end if;

  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_availability_rule_management',previous_rule_management,true);
  return occurrence_status;
exception
  when others then
    perform set_config('app.coach_availability_rule_management',previous_rule_management,true);
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
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
