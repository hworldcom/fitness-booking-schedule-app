-- DEV0090: keep cancelled reservations immutable while allowing a fresh
-- eligible reservation for the same future class.

create or replace function app.current_member_class_schedule()
returns table (
  class_session_id uuid,
  class_session_slug text,
  class_title text,
  class_description text,
  discipline text,
  timezone text,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  venue_id uuid,
  venue_slug text,
  venue_name text,
  trainer_name text,
  trainer_title text,
  reserved_count integer,
  remaining_capacity integer,
  booking_status text,
  reservation_id uuid,
  reservation_status text,
  cancellation_reason text,
  service_date date,
  holds_basic_use boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'class reservation actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.class_reservation_management',
    'on',
    true
  );
  perform app.reconcile_member_class_reservations(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  return query
  with active_period as (
    select period.*
    from app.membership_periods as period
    where period.run_id = run_id_text::uuid
      and period.profile_id = profile_id_text::uuid
      and period.membership_status = 'active'
      and period.starts_at <= pg_catalog.statement_timestamp()
      and period.ends_at > pg_catalog.statement_timestamp()
    order by period.starts_at desc
    limit 1
  )
  select
    session.id,
    session.slug,
    session.title,
    session.description,
    session.discipline,
    session.timezone,
    session.starts_at,
    session.ends_at,
    session.capacity,
    venue.id,
    venue.slug,
    venue.name,
    trainer.display_name,
    affiliation.title,
    occupancy.reserved_count,
    greatest(
      session.capacity - occupancy.reserved_count,
      0
    )::integer,
    case
      when latest_reservation.reservation_status = 'reserved' then 'reserved'
      when latest_reservation.reservation_status = 'checked_in' then 'checked-in'
      when latest_reservation.reservation_status = 'no_show' then 'no-show'
      when session.status = 'cancelled' then 'session-cancelled'
      when session.starts_at <= pg_catalog.statement_timestamp() then 'past'
      when daily_conflict.has_conflict then 'same-day-conflict'
      when period.plan_code = 'basic'
        and period.included_checkins_used + held_claims.held_count
          >= period.included_checkins
        then 'allowance-exhausted'
      when occupancy.reserved_count >= session.capacity then 'full'
      else 'available'
    end,
    latest_reservation.id,
    latest_reservation.reservation_status,
    latest_reservation.cancellation_reason,
    (session.starts_at at time zone session.timezone)::date,
    latest_reservation.reservation_status = 'reserved'
      and period.plan_code = 'basic'
  from active_period as period
  join app.membership_period_core_gyms as core_gym
    on core_gym.run_id = period.run_id
    and core_gym.membership_period_id = period.id
  join app.class_sessions as session
    on session.run_id = core_gym.run_id
    and session.venue_id = core_gym.venue_id
    and session.starts_at >= period.starts_at
    and session.ends_at <= period.ends_at
  join app.venues as venue
    on venue.run_id = session.run_id
    and venue.id = session.venue_id
  join app.profiles as trainer
    on trainer.id = session.trainer_profile_id
  join app.trainer_affiliations as affiliation
    on affiliation.run_id = session.run_id
    and affiliation.venue_id = session.venue_id
    and affiliation.profile_id = session.trainer_profile_id
  left join lateral (
    select reservation.*
    from app.class_reservations as reservation
    where reservation.run_id = period.run_id
      and reservation.membership_period_id = period.id
      and reservation.profile_id = period.profile_id
      and reservation.class_session_id = session.id
      and reservation.reservation_status in (
        'reserved',
        'checked_in',
        'no_show'
      )
    order by reservation.created_at desc, reservation.id desc
    limit 1
  ) as latest_reservation on true
  cross join lateral (
    select count(*)::integer as reserved_count
    from app.class_reservations as reservation
    where reservation.run_id = session.run_id
      and reservation.class_session_id = session.id
      and reservation.reservation_status in ('reserved', 'checked_in')
  ) as occupancy
  cross join lateral (
    select count(*)::integer as held_count
    from app.membership_daily_access_claims as claim
    where claim.run_id = period.run_id
      and claim.membership_period_id = period.id
      and claim.claim_status = 'held'
  ) as held_claims
  cross join lateral (
    select exists (
      select 1
      from app.membership_daily_access_claims as claim
      where claim.run_id = period.run_id
        and claim.membership_period_id = period.id
        and claim.service_date =
          (session.starts_at at time zone session.timezone)::date
        and claim.claim_status in ('held', 'consumed')
        and claim.id is distinct from latest_reservation.access_claim_id
    ) as has_conflict
  ) as daily_conflict
  order by session.starts_at, venue.name, session.title;

  perform pg_catalog.set_config(
    'app.class_reservation_management',
    'off',
    true
  );
exception
  when others then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    raise;
end;
$$;

create or replace function app.reserve_member_class(
  requested_operation_id uuid,
  requested_class_session_id uuid
)
returns table (reservation_result text, reservation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_period record;
  selected_session record;
  existing_reservation record;
  selected_claim_id uuid;
  selected_reservation_id uuid;
  selected_service_date date;
  active_reservations integer;
  held_claims integer;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'class reservation actor context is invalid';
  end if;
  if requested_operation_id is null or requested_class_session_id is null then
    return query select 'invalid-request'::text, null::uuid;
    return;
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.class_reservation_management',
    'on',
    true
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      run_id_text || ':' || profile_id_text,
      6
    )
  );
  perform app.reconcile_member_class_reservations(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  select reservation.*
  into existing_reservation
  from app.class_reservations as reservation
  where reservation.run_id = run_id_text::uuid
    and reservation.profile_id = profile_id_text::uuid
    and reservation.operation_id = requested_operation_id;

  if found then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    if existing_reservation.class_session_id = requested_class_session_id then
      return query select 'existing'::text, existing_reservation.id;
    else
      return query select 'operation-conflict'::text, null::uuid;
    end if;
    return;
  end if;

  select period.*
  into selected_period
  from app.membership_periods as period
  where period.run_id = run_id_text::uuid
    and period.profile_id = profile_id_text::uuid
    and period.membership_status = 'active'
    and period.starts_at <= pg_catalog.statement_timestamp()
    and period.ends_at > pg_catalog.statement_timestamp()
  order by period.starts_at desc
  limit 1
  for update;

  if not found then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return query select 'no-active-membership'::text, null::uuid;
    return;
  end if;

  select session.*
  into selected_session
  from app.class_sessions as session
  join app.membership_period_core_gyms as core_gym
    on core_gym.run_id = session.run_id
    and core_gym.venue_id = session.venue_id
    and core_gym.membership_period_id = selected_period.id
  where session.run_id = selected_period.run_id
    and session.id = requested_class_session_id
    and session.starts_at >= selected_period.starts_at
    and session.ends_at <= selected_period.ends_at
  for update of session;

  if not found
    or selected_session.status <> 'scheduled'
    or selected_session.starts_at <= pg_catalog.statement_timestamp()
  then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return query select 'class-unavailable'::text, null::uuid;
    return;
  end if;

  select reservation.*
  into existing_reservation
  from app.class_reservations as reservation
  where reservation.run_id = selected_period.run_id
    and reservation.membership_period_id = selected_period.id
    and reservation.profile_id = selected_period.profile_id
    and reservation.class_session_id = selected_session.id
    and reservation.reservation_status in ('reserved', 'checked_in')
  order by reservation.created_at desc, reservation.id desc
  limit 1;

  if found then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return query select 'existing'::text, existing_reservation.id;
    return;
  end if;

  select count(*)::integer
  into active_reservations
  from app.class_reservations as reservation
  where reservation.run_id = selected_session.run_id
    and reservation.class_session_id = selected_session.id
    and reservation.reservation_status in ('reserved', 'checked_in');

  if active_reservations >= selected_session.capacity then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return query select 'full'::text, null::uuid;
    return;
  end if;

  selected_service_date := (
    selected_session.starts_at at time zone selected_session.timezone
  )::date;

  if exists (
    select 1
    from app.membership_daily_access_claims as claim
    where claim.run_id = selected_period.run_id
      and claim.membership_period_id = selected_period.id
      and claim.service_date = selected_service_date
      and claim.claim_status in ('held', 'consumed')
  ) then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return query select 'daily-conflict'::text, null::uuid;
    return;
  end if;

  if selected_period.plan_code = 'basic' then
    select count(*)::integer
    into held_claims
    from app.membership_daily_access_claims as claim
    where claim.run_id = selected_period.run_id
      and claim.membership_period_id = selected_period.id
      and claim.claim_status = 'held';

    if selected_period.included_checkins_used + held_claims
      >= selected_period.included_checkins
    then
      perform pg_catalog.set_config(
        'app.class_reservation_management',
        'off',
        true
      );
      return query select 'allowance-exhausted'::text, null::uuid;
      return;
    end if;
  end if;

  selected_claim_id := gen_random_uuid();
  selected_reservation_id := gen_random_uuid();

  insert into app.membership_daily_access_claims (
    id,
    run_id,
    membership_period_id,
    profile_id,
    service_date,
    claim_kind,
    claim_status
  )
  values (
    selected_claim_id,
    selected_period.run_id,
    selected_period.id,
    selected_period.profile_id,
    selected_service_date,
    'class_reservation',
    'held'
  );

  insert into app.class_reservations (
    id,
    operation_id,
    run_id,
    membership_period_id,
    profile_id,
    class_session_id,
    access_claim_id,
    service_date,
    reservation_status
  )
  values (
    selected_reservation_id,
    requested_operation_id,
    selected_period.run_id,
    selected_period.id,
    selected_period.profile_id,
    selected_session.id,
    selected_claim_id,
    selected_service_date,
    'reserved'
  );

  perform pg_catalog.set_config(
    'app.class_reservation_management',
    'off',
    true
  );
  return query select 'reserved'::text, selected_reservation_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    raise;
end;
$$;

comment on function app.current_member_class_schedule() is
  'Returns selected-gym classes and only active/attended member reservation state; a member-cancelled future class is evaluated normally for a fresh reservation.';
comment on function app.reserve_member_class(uuid, uuid) is
  'Creates one capacity-safe included reservation; a fresh operation may reserve a future class after an earlier member cancellation.';
