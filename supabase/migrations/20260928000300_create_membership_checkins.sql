create table app.membership_arrival_requests (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  run_id uuid not null,
  membership_period_id uuid not null,
  profile_id uuid not null,
  venue_id uuid not null,
  reservation_id uuid null,
  access_claim_id uuid not null,
  service_date date not null,
  code_hash text not null,
  request_status text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz null,
  confirmed_by_profile_id uuid null,
  expired_at timestamptz null,
  cancelled_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint membership_arrival_requests_period_fkey
    foreign key (run_id, membership_period_id, profile_id)
    references app.membership_periods (run_id, id, profile_id)
    on delete restrict,
  constraint membership_arrival_requests_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id)
    on delete restrict,
  constraint membership_arrival_requests_reservation_fkey
    foreign key (run_id, reservation_id)
    references app.class_reservations (run_id, id)
    on delete restrict,
  constraint membership_arrival_requests_claim_fkey
    foreign key (
      run_id,
      access_claim_id,
      membership_period_id,
      profile_id,
      service_date
    )
    references app.membership_daily_access_claims (
      run_id,
      id,
      membership_period_id,
      profile_id,
      service_date
    )
    on delete restrict,
  constraint membership_arrival_requests_confirmer_fkey
    foreign key (confirmed_by_profile_id)
    references app.profiles (id)
    on delete restrict,
  constraint membership_arrival_requests_run_id_id_key
    unique (run_id, id),
  constraint membership_arrival_requests_operation_key
    unique (run_id, profile_id, operation_id),
  constraint membership_arrival_requests_code_hash_key
    unique (run_id, code_hash),
  constraint membership_arrival_requests_status_check
    check (request_status in ('pending', 'confirmed', 'expired', 'cancelled')),
  constraint membership_arrival_requests_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint membership_arrival_requests_expiry_check
    check (expires_at > created_at),
  constraint membership_arrival_requests_state_check
    check (
      (
        request_status = 'pending'
        and confirmed_at is null
        and confirmed_by_profile_id is null
        and expired_at is null
        and cancelled_at is null
      )
      or (
        request_status = 'confirmed'
        and confirmed_at is not null
        and confirmed_at >= created_at
        and confirmed_by_profile_id is not null
        and expired_at is null
        and cancelled_at is null
      )
      or (
        request_status = 'expired'
        and confirmed_at is null
        and confirmed_by_profile_id is null
        and expired_at is not null
        and expired_at >= created_at
        and cancelled_at is null
      )
      or (
        request_status = 'cancelled'
        and confirmed_at is null
        and confirmed_by_profile_id is null
        and expired_at is null
        and cancelled_at is not null
        and cancelled_at >= created_at
      )
    )
);

create unique index membership_arrival_requests_one_pending_member_idx
  on app.membership_arrival_requests (run_id, membership_period_id, profile_id)
  where request_status = 'pending';

create unique index membership_arrival_requests_one_active_claim_idx
  on app.membership_arrival_requests (run_id, access_claim_id)
  where request_status in ('pending', 'confirmed');

create index membership_arrival_requests_member_history_idx
  on app.membership_arrival_requests (
    run_id,
    profile_id,
    created_at desc
  );

create table app.membership_checkins (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  membership_period_id uuid not null,
  profile_id uuid not null,
  venue_id uuid not null,
  reservation_id uuid null,
  class_session_id uuid null,
  access_claim_id uuid not null,
  arrival_request_id uuid not null,
  confirmed_by_profile_id uuid not null,
  service_date date not null,
  attendance_kind text not null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint membership_checkins_period_fkey
    foreign key (run_id, membership_period_id, profile_id)
    references app.membership_periods (run_id, id, profile_id)
    on delete restrict,
  constraint membership_checkins_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id)
    on delete restrict,
  constraint membership_checkins_reservation_fkey
    foreign key (run_id, reservation_id)
    references app.class_reservations (run_id, id)
    on delete restrict,
  constraint membership_checkins_session_fkey
    foreign key (run_id, class_session_id)
    references app.class_sessions (run_id, id)
    on delete restrict,
  constraint membership_checkins_claim_fkey
    foreign key (
      run_id,
      access_claim_id,
      membership_period_id,
      profile_id,
      service_date
    )
    references app.membership_daily_access_claims (
      run_id,
      id,
      membership_period_id,
      profile_id,
      service_date
    )
    on delete restrict,
  constraint membership_checkins_arrival_fkey
    foreign key (run_id, arrival_request_id)
    references app.membership_arrival_requests (run_id, id)
    on delete restrict,
  constraint membership_checkins_confirmer_fkey
    foreign key (confirmed_by_profile_id)
    references app.profiles (id)
    on delete restrict,
  constraint membership_checkins_run_id_id_key unique (run_id, id),
  constraint membership_checkins_claim_key unique (access_claim_id),
  constraint membership_checkins_arrival_key unique (arrival_request_id),
  constraint membership_checkins_reservation_key unique (reservation_id),
  constraint membership_checkins_kind_check
    check (attendance_kind in ('class', 'open_gym')),
  constraint membership_checkins_kind_reference_check
    check (
      (
        attendance_kind = 'class'
        and reservation_id is not null
        and class_session_id is not null
      )
      or (
        attendance_kind = 'open_gym'
        and reservation_id is null
        and class_session_id is null
      )
    ),
  constraint membership_checkins_timestamp_check
    check (confirmed_at >= created_at)
);

create index membership_checkins_member_history_idx
  on app.membership_checkins (
    run_id,
    profile_id,
    confirmed_at desc
  );

create index membership_checkins_venue_history_idx
  on app.membership_checkins (
    run_id,
    venue_id,
    service_date desc,
    confirmed_at desc
  );

create function app.enforce_membership_arrival_request_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if row(
    new.id,
    new.operation_id,
    new.run_id,
    new.membership_period_id,
    new.profile_id,
    new.venue_id,
    new.reservation_id,
    new.access_claim_id,
    new.service_date,
    new.code_hash,
    new.created_at,
    new.expires_at
  ) is distinct from row(
    old.id,
    old.operation_id,
    old.run_id,
    old.membership_period_id,
    old.profile_id,
    old.venue_id,
    old.reservation_id,
    old.access_claim_id,
    old.service_date,
    old.code_hash,
    old.created_at,
    old.expires_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership arrival request identity is immutable';
  end if;

  if old.request_status <> new.request_status and not (
    old.request_status = 'pending'
    and new.request_status in ('confirmed', 'expired', 'cancelled')
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership arrival request transition is invalid';
  end if;

  if old.request_status = new.request_status and row(
    new.confirmed_at,
    new.confirmed_by_profile_id,
    new.expired_at,
    new.cancelled_at
  ) is distinct from row(
    old.confirmed_at,
    old.confirmed_by_profile_id,
    old.expired_at,
    old.cancelled_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership arrival request evidence is immutable';
  end if;

  return new;
end;
$$;

create function app.reject_membership_checkin_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '23514',
    message = 'membership check-in evidence is immutable';
end;
$$;

create trigger membership_arrival_requests_set_updated_at
before update on app.membership_arrival_requests
for each row execute function app.set_updated_at();

create trigger membership_arrival_requests_guard
before update on app.membership_arrival_requests
for each row execute function app.enforce_membership_arrival_request_update();

create trigger membership_checkins_guard
before update on app.membership_checkins
for each row execute function app.reject_membership_checkin_update();

alter table app.membership_arrival_requests enable row level security;
alter table app.membership_arrival_requests force row level security;
alter table app.membership_checkins enable row level security;
alter table app.membership_checkins force row level security;

alter table app.membership_arrival_requests owner to app_owner;
alter table app.membership_checkins owner to app_owner;
alter function app.enforce_membership_arrival_request_update() owner to app_owner;
alter function app.reject_membership_checkin_update() owner to app_owner;

revoke all on app.membership_arrival_requests
  from public, anon, authenticated, service_role, app_runtime;
revoke all on app.membership_checkins
  from public, anon, authenticated, service_role, app_runtime;

create policy membership_arrival_requests_checkin_all
  on app.membership_arrival_requests
  for all
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on')
  with check (current_setting('app.checkin_management', true) = 'on');

create policy membership_checkins_checkin_all
  on app.membership_checkins
  for all
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on')
  with check (current_setting('app.checkin_management', true) = 'on');

create policy membership_periods_checkin_select
  on app.membership_periods
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create policy membership_periods_checkin_update
  on app.membership_periods
  for update
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on')
  with check (current_setting('app.checkin_management', true) = 'on');

create policy membership_period_core_gyms_checkin_select
  on app.membership_period_core_gyms
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create policy membership_daily_access_claims_checkin_all
  on app.membership_daily_access_claims
  for all
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on')
  with check (current_setting('app.checkin_management', true) = 'on');

create policy class_reservations_checkin_select
  on app.class_reservations
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create policy class_reservations_checkin_update
  on app.class_reservations
  for update
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on')
  with check (current_setting('app.checkin_management', true) = 'on');

create policy class_sessions_checkin_select
  on app.class_sessions
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create policy venues_checkin_select
  on app.venues
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create policy venue_staff_checkin_select
  on app.venue_staff
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create policy profiles_checkin_select
  on app.profiles
  for select
  to app_owner
  using (current_setting('app.checkin_management', true) = 'on');

create function app.reconcile_member_arrival_requests(
  selected_run_id uuid,
  selected_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with transitioned as (
    update app.membership_arrival_requests as arrival
    set
      request_status = 'expired',
      expired_at = pg_catalog.statement_timestamp()
    where arrival.run_id = selected_run_id
      and arrival.profile_id = selected_profile_id
      and arrival.request_status = 'pending'
      and arrival.expires_at <= pg_catalog.statement_timestamp()
    returning arrival.access_claim_id, arrival.reservation_id
  )
  update app.membership_daily_access_claims as claim
  set
    claim_status = 'released',
    released_at = pg_catalog.statement_timestamp()
  where claim.id in (
      select access_claim_id
      from transitioned
      where reservation_id is null
    )
    and claim.claim_status = 'held';
end;
$$;

create function app.current_member_checkin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  snapshot jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership check-in actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.checkin_management', 'on', true);
  perform app.reconcile_member_arrival_requests(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  select pg_catalog.jsonb_build_object(
    'activePeriod', (
      select pg_catalog.jsonb_build_object(
        'membershipPeriodId', period.id,
        'planCode', period.plan_code,
        'includedCheckins', period.included_checkins,
        'includedCheckinsUsed', period.included_checkins_used,
        'heldCheckins', (
          select count(*)::integer
          from app.membership_daily_access_claims as claim
          where claim.run_id = period.run_id
            and claim.membership_period_id = period.id
            and claim.claim_status = 'held'
        )
      )
      from app.membership_periods as period
      where period.run_id = run_id_text::uuid
        and period.profile_id = profile_id_text::uuid
        and period.membership_status = 'active'
        and period.starts_at <= pg_catalog.statement_timestamp()
        and period.ends_at > pg_catalog.statement_timestamp()
      order by period.starts_at desc
      limit 1
    ),
    'pendingArrival', (
      select pg_catalog.jsonb_build_object(
        'requestId', arrival.id,
        'operationId', arrival.operation_id,
        'venueId', arrival.venue_id,
        'venueSlug', venue.slug,
        'venueName', venue.name,
        'reservationId', arrival.reservation_id,
        'classSessionId', reservation.class_session_id,
        'classTitle', session.title,
        'serviceDate', arrival.service_date,
        'status', arrival.request_status,
        'createdAt', arrival.created_at,
        'expiresAt', arrival.expires_at
      )
      from app.membership_arrival_requests as arrival
      join app.venues as venue
        on venue.run_id = arrival.run_id
        and venue.id = arrival.venue_id
      left join app.class_reservations as reservation
        on reservation.run_id = arrival.run_id
        and reservation.id = arrival.reservation_id
      left join app.class_sessions as session
        on session.run_id = reservation.run_id
        and session.id = reservation.class_session_id
      where arrival.run_id = run_id_text::uuid
        and arrival.profile_id = profile_id_text::uuid
        and arrival.request_status = 'pending'
      order by arrival.created_at desc
      limit 1
    ),
    'history', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'checkinId', checkin.id,
          'membershipPeriodId', checkin.membership_period_id,
          'venueId', checkin.venue_id,
          'venueSlug', venue.slug,
          'venueName', venue.name,
          'reservationId', checkin.reservation_id,
          'classSessionId', checkin.class_session_id,
          'classTitle', session.title,
          'serviceDate', checkin.service_date,
          'attendanceKind', checkin.attendance_kind,
          'confirmedAt', checkin.confirmed_at
        )
        order by checkin.confirmed_at desc, checkin.id desc
      )
      from app.membership_checkins as checkin
      join app.venues as venue
        on venue.run_id = checkin.run_id
        and venue.id = checkin.venue_id
      left join app.class_sessions as session
        on session.run_id = checkin.run_id
        and session.id = checkin.class_session_id
      where checkin.run_id = run_id_text::uuid
        and checkin.profile_id = profile_id_text::uuid
    ), '[]'::jsonb)
  )
  into snapshot;

  perform pg_catalog.set_config('app.checkin_management', 'off', true);
  return snapshot;
exception
  when others then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    raise;
end;
$$;

create function app.create_member_arrival_request(
  requested_operation_id uuid,
  requested_venue_id uuid,
  requested_reservation_id uuid,
  requested_code_hash text
)
returns table (
  arrival_result text,
  arrival_request_id uuid,
  arrival_status text,
  arrival_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_period record;
  selected_venue record;
  selected_reservation record;
  existing_arrival record;
  selected_claim_id uuid;
  selected_request_id uuid;
  selected_service_date date;
  selected_expires_at timestamptz;
  held_claims integer;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership check-in actor context is invalid';
  end if;
  if requested_operation_id is null
    or requested_venue_id is null
    or requested_code_hash is null
    or requested_code_hash !~ '^[0-9a-f]{64}$'
  then
    return query select
      'invalid-request'::text,
      null::uuid,
      null::text,
      null::timestamptz;
    return;
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.checkin_management', 'on', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(run_id_text || ':' || profile_id_text, 7)
  );
  perform app.reconcile_member_arrival_requests(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  select arrival.*
  into existing_arrival
  from app.membership_arrival_requests as arrival
  where arrival.run_id = run_id_text::uuid
    and arrival.profile_id = profile_id_text::uuid
    and arrival.operation_id = requested_operation_id;

  if found then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    if existing_arrival.venue_id = requested_venue_id
      and existing_arrival.reservation_id is not distinct from requested_reservation_id
    then
      return query select
        'existing'::text,
        existing_arrival.id,
        existing_arrival.request_status,
        existing_arrival.expires_at;
    else
      return query select
        'operation-conflict'::text,
        null::uuid,
        null::text,
        null::timestamptz;
    end if;
    return;
  end if;

  select arrival.*
  into existing_arrival
  from app.membership_arrival_requests as arrival
  where arrival.run_id = run_id_text::uuid
    and arrival.profile_id = profile_id_text::uuid
    and arrival.request_status = 'pending'
  order by arrival.created_at desc
  limit 1;

  if found then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select
      'pending-conflict'::text,
      existing_arrival.id,
      existing_arrival.request_status,
      existing_arrival.expires_at;
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
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select
      'no-active-membership'::text,
      null::uuid,
      null::text,
      null::timestamptz;
    return;
  end if;

  select venue.*
  into selected_venue
  from app.membership_period_core_gyms as core_gym
  join app.venues as venue
    on venue.run_id = core_gym.run_id
    and venue.id = core_gym.venue_id
  where core_gym.run_id = selected_period.run_id
    and core_gym.membership_period_id = selected_period.id
    and core_gym.venue_id = requested_venue_id;

  if not found then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select
      'venue-unavailable'::text,
      null::uuid,
      null::text,
      null::timestamptz;
    return;
  end if;

  if requested_reservation_id is not null then
    select
      reservation.*,
      claim.claim_status,
      session.venue_id as session_venue_id,
      session.starts_at,
      session.ends_at,
      session.status as session_status,
      session.timezone,
      session.id as selected_class_session_id
    into selected_reservation
    from app.class_reservations as reservation
    join app.membership_daily_access_claims as claim
      on claim.run_id = reservation.run_id
      and claim.id = reservation.access_claim_id
    join app.class_sessions as session
      on session.run_id = reservation.run_id
      and session.id = reservation.class_session_id
    where reservation.id = requested_reservation_id
      and reservation.run_id = selected_period.run_id
      and reservation.membership_period_id = selected_period.id
      and reservation.profile_id = selected_period.profile_id
    for update of reservation, claim;

    if not found
      or selected_reservation.reservation_status <> 'reserved'
      or selected_reservation.claim_status <> 'held'
      or selected_reservation.session_status <> 'scheduled'
      or selected_reservation.session_venue_id <> requested_venue_id
    then
      perform pg_catalog.set_config('app.checkin_management', 'off', true);
      return query select
        'reservation-unavailable'::text,
        null::uuid,
        null::text,
        null::timestamptz;
      return;
    end if;
    if pg_catalog.statement_timestamp()
      < selected_reservation.starts_at - interval '30 minutes'
    then
      perform pg_catalog.set_config('app.checkin_management', 'off', true);
      return query select
        'too-early'::text,
        null::uuid,
        null::text,
        null::timestamptz;
      return;
    end if;
    if pg_catalog.statement_timestamp() >= selected_reservation.ends_at then
      perform pg_catalog.set_config('app.checkin_management', 'off', true);
      return query select
        'too-late'::text,
        null::uuid,
        null::text,
        null::timestamptz;
      return;
    end if;

    selected_claim_id := selected_reservation.access_claim_id;
    selected_service_date := selected_reservation.service_date;
    selected_expires_at := least(
      pg_catalog.statement_timestamp() + interval '15 minutes',
      selected_reservation.ends_at
    );
  else
    selected_service_date := (
      pg_catalog.statement_timestamp() at time zone selected_venue.timezone
    )::date;

    if exists (
      select 1
      from app.membership_daily_access_claims as claim
      where claim.run_id = selected_period.run_id
        and claim.membership_period_id = selected_period.id
        and claim.service_date = selected_service_date
        and claim.claim_status in ('held', 'consumed')
    ) then
      perform pg_catalog.set_config('app.checkin_management', 'off', true);
      return query select
        'daily-conflict'::text,
        null::uuid,
        null::text,
        null::timestamptz;
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
        perform pg_catalog.set_config('app.checkin_management', 'off', true);
        return query select
          'allowance-exhausted'::text,
          null::uuid,
          null::text,
          null::timestamptz;
        return;
      end if;
    end if;

    selected_claim_id := gen_random_uuid();
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
      'open_gym',
      'held'
    );
    selected_expires_at :=
      pg_catalog.statement_timestamp() + interval '15 minutes';
  end if;

  selected_request_id := gen_random_uuid();
  insert into app.membership_arrival_requests (
    id,
    operation_id,
    run_id,
    membership_period_id,
    profile_id,
    venue_id,
    reservation_id,
    access_claim_id,
    service_date,
    code_hash,
    request_status,
    expires_at
  )
  values (
    selected_request_id,
    requested_operation_id,
    selected_period.run_id,
    selected_period.id,
    selected_period.profile_id,
    requested_venue_id,
    requested_reservation_id,
    selected_claim_id,
    selected_service_date,
    requested_code_hash,
    'pending',
    selected_expires_at
  );

  perform pg_catalog.set_config('app.checkin_management', 'off', true);
  return query select
    'created'::text,
    selected_request_id,
    'pending'::text,
    selected_expires_at;
exception
  when others then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    raise;
end;
$$;

create function app.cancel_member_arrival_request(
  requested_arrival_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_arrival record;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership check-in actor context is invalid';
  end if;
  if requested_arrival_request_id is null then
    return 'invalid-request';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.checkin_management', 'on', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(run_id_text || ':' || profile_id_text, 7)
  );
  perform app.reconcile_member_arrival_requests(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  select arrival.*
  into selected_arrival
  from app.membership_arrival_requests as arrival
  where arrival.id = requested_arrival_request_id
    and arrival.run_id = run_id_text::uuid
    and arrival.profile_id = profile_id_text::uuid
  for update;

  if not found then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return 'not-found';
  end if;
  if selected_arrival.request_status = 'cancelled' then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return 'existing';
  end if;
  if selected_arrival.request_status = 'expired' then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return 'expired';
  end if;
  if selected_arrival.request_status = 'confirmed' then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return 'confirmed';
  end if;

  update app.membership_arrival_requests
  set
    request_status = 'cancelled',
    cancelled_at = pg_catalog.statement_timestamp()
  where id = selected_arrival.id;

  if selected_arrival.reservation_id is null then
    update app.membership_daily_access_claims
    set
      claim_status = 'released',
      released_at = pg_catalog.statement_timestamp()
    where id = selected_arrival.access_claim_id
      and claim_status = 'held';
  end if;

  perform pg_catalog.set_config('app.checkin_management', 'off', true);
  return 'cancelled';
exception
  when others then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    raise;
end;
$$;

create function app.confirm_member_arrival(
  requested_code_hash text
)
returns table (confirmation_result text, checkin_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id_text text;
  run_id_text text;
  selected_arrival record;
  selected_period record;
  selected_claim record;
  selected_reservation record;
  selected_class_session_id uuid;
  existing_checkin_id uuid;
  selected_checkin_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'membership check-in actor context is invalid';
  end if;
  if requested_code_hash is null
    or requested_code_hash !~ '^[0-9a-f]{64}$'
  then
    return query select 'invalid-request'::text, null::uuid;
    return;
  end if;

  actor_profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.checkin_management', 'on', true);

  select arrival.*
  into selected_arrival
  from app.membership_arrival_requests as arrival
  where arrival.run_id = run_id_text::uuid
    and arrival.code_hash = requested_code_hash
  for update;

  if not found then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'not-found'::text, null::uuid;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      run_id_text || ':' || selected_arrival.profile_id::text,
      7
    )
  );

  if not exists (
    select 1
    from app.venue_staff as staff
    where staff.run_id = selected_arrival.run_id
      and staff.venue_id = selected_arrival.venue_id
      and staff.profile_id = actor_profile_id_text::uuid
      and staff.role in ('manager', 'check_in_staff')
      and staff.status = 'active'
  ) then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'forbidden'::text, null::uuid;
    return;
  end if;

  if selected_arrival.request_status = 'confirmed' then
    select checkin.id
    into existing_checkin_id
    from app.membership_checkins as checkin
    where checkin.arrival_request_id = selected_arrival.id;
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'existing'::text, existing_checkin_id;
    return;
  end if;
  if selected_arrival.request_status = 'cancelled' then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'cancelled'::text, null::uuid;
    return;
  end if;
  if selected_arrival.request_status = 'expired'
    or selected_arrival.expires_at <= pg_catalog.statement_timestamp()
  then
    if selected_arrival.request_status = 'pending' then
      update app.membership_arrival_requests
      set
        request_status = 'expired',
        expired_at = pg_catalog.statement_timestamp()
      where id = selected_arrival.id;
      if selected_arrival.reservation_id is null then
        update app.membership_daily_access_claims
        set
          claim_status = 'released',
          released_at = pg_catalog.statement_timestamp()
        where id = selected_arrival.access_claim_id
          and claim_status = 'held';
      end if;
    end if;
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'expired'::text, null::uuid;
    return;
  end if;

  select period.*
  into selected_period
  from app.membership_periods as period
  where period.run_id = selected_arrival.run_id
    and period.id = selected_arrival.membership_period_id
    and period.profile_id = selected_arrival.profile_id
  for update;

  if not found
    or selected_period.membership_status <> 'active'
    or selected_period.starts_at > pg_catalog.statement_timestamp()
    or selected_period.ends_at <= pg_catalog.statement_timestamp()
  then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'membership-inactive'::text, null::uuid;
    return;
  end if;

  select claim.*
  into selected_claim
  from app.membership_daily_access_claims as claim
  where claim.run_id = selected_arrival.run_id
    and claim.id = selected_arrival.access_claim_id
    and claim.membership_period_id = selected_arrival.membership_period_id
    and claim.profile_id = selected_arrival.profile_id
    and claim.service_date = selected_arrival.service_date
  for update;

  if not found or selected_claim.claim_status <> 'held' then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'claim-unavailable'::text, null::uuid;
    return;
  end if;

  if selected_period.plan_code = 'basic'
    and selected_period.included_checkins_used >= selected_period.included_checkins
  then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    return query select 'allowance-exhausted'::text, null::uuid;
    return;
  end if;

  if selected_arrival.reservation_id is not null then
    select
      reservation.*,
      session.status as session_status,
      session.venue_id as session_venue_id,
      session.starts_at,
      session.ends_at,
      session.id as selected_class_session_id
    into selected_reservation
    from app.class_reservations as reservation
    join app.class_sessions as session
      on session.run_id = reservation.run_id
      and session.id = reservation.class_session_id
    where reservation.run_id = selected_arrival.run_id
      and reservation.id = selected_arrival.reservation_id
      and reservation.membership_period_id = selected_arrival.membership_period_id
      and reservation.profile_id = selected_arrival.profile_id
      and reservation.access_claim_id = selected_arrival.access_claim_id
    for update of reservation;

    if not found
      or selected_reservation.reservation_status <> 'reserved'
      or selected_reservation.session_status <> 'scheduled'
      or selected_reservation.session_venue_id <> selected_arrival.venue_id
      or selected_reservation.ends_at <= pg_catalog.statement_timestamp()
    then
      perform pg_catalog.set_config('app.checkin_management', 'off', true);
      return query select 'reservation-unavailable'::text, null::uuid;
      return;
    end if;
    if pg_catalog.statement_timestamp()
      < selected_reservation.starts_at - interval '30 minutes'
    then
      perform pg_catalog.set_config('app.checkin_management', 'off', true);
      return query select 'too-early'::text, null::uuid;
      return;
    end if;

    update app.class_reservations
    set
      reservation_status = 'checked_in',
      checked_in_at = pg_catalog.statement_timestamp()
    where id = selected_reservation.id;
    selected_class_session_id := selected_reservation.selected_class_session_id;
  end if;

  update app.membership_daily_access_claims
  set
    claim_status = 'consumed',
    consumed_at = pg_catalog.statement_timestamp()
  where id = selected_arrival.access_claim_id;

  if selected_period.plan_code = 'basic' then
    update app.membership_periods
    set
      included_checkins_used = included_checkins_used + 1,
      last_included_service_date = selected_arrival.service_date
    where id = selected_arrival.membership_period_id;
  end if;

  update app.membership_arrival_requests
  set
    request_status = 'confirmed',
    confirmed_at = pg_catalog.statement_timestamp(),
    confirmed_by_profile_id = actor_profile_id_text::uuid
  where id = selected_arrival.id;

  selected_checkin_id := gen_random_uuid();
  insert into app.membership_checkins (
    id,
    run_id,
    membership_period_id,
    profile_id,
    venue_id,
    reservation_id,
    class_session_id,
    access_claim_id,
    arrival_request_id,
    confirmed_by_profile_id,
    service_date,
    attendance_kind,
    confirmed_at
  )
  values (
    selected_checkin_id,
    selected_arrival.run_id,
    selected_arrival.membership_period_id,
    selected_arrival.profile_id,
    selected_arrival.venue_id,
    selected_arrival.reservation_id,
    selected_class_session_id,
    selected_arrival.access_claim_id,
    selected_arrival.id,
    actor_profile_id_text::uuid,
    selected_arrival.service_date,
    case
      when selected_arrival.reservation_id is null then 'open_gym'
      else 'class'
    end,
    pg_catalog.statement_timestamp()
  );

  perform pg_catalog.set_config('app.checkin_management', 'off', true);
  return query select 'confirmed'::text, selected_checkin_id;
exception
  when others then
    perform pg_catalog.set_config('app.checkin_management', 'off', true);
    raise;
end;
$$;

alter function app.reconcile_member_arrival_requests(uuid, uuid)
  owner to app_owner;
alter function app.current_member_checkin_snapshot() owner to app_owner;
alter function app.create_member_arrival_request(uuid, uuid, uuid, text)
  owner to app_owner;
alter function app.cancel_member_arrival_request(uuid) owner to app_owner;
alter function app.confirm_member_arrival(text) owner to app_owner;

revoke all on function app.reconcile_member_arrival_requests(uuid, uuid)
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.current_member_checkin_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function app.create_member_arrival_request(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.cancel_member_arrival_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.confirm_member_arrival(text)
  from public, anon, authenticated, service_role;
revoke all on function app.enforce_membership_arrival_request_update()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.reject_membership_checkin_update()
  from public, anon, authenticated, service_role, app_runtime;

grant execute on function app.current_member_checkin_snapshot()
  to app_runtime;
grant execute on function app.create_member_arrival_request(uuid, uuid, uuid, text)
  to app_runtime;
grant execute on function app.cancel_member_arrival_request(uuid)
  to app_runtime;
grant execute on function app.confirm_member_arrival(text)
  to app_runtime;

comment on table app.membership_arrival_requests is
  'Short-lived member arrival requests containing only a SHA-256 presentation-code hash and bounded venue/reservation context.';
comment on table app.membership_checkins is
  'Immutable private staff-confirmed included-attendance evidence; it is not social publication or a monetary allocation.';
comment on function app.current_member_checkin_snapshot() is
  'Returns only the current member pending arrival, allowance summary and private confirmed attendance history.';
comment on function app.create_member_arrival_request(uuid, uuid, uuid, text) is
  'Creates one idempotent 15-minute selected-venue arrival request and obtains or reuses its daily access claim.';
comment on function app.confirm_member_arrival(text) is
  'Lets active same-venue staff atomically consume one arrival, daily claim and optional class reservation into immutable attendance.';
