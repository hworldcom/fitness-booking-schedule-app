alter table app.membership_periods
  add constraint membership_periods_run_id_id_profile_key
  unique (run_id, id, profile_id);

create table app.membership_daily_access_claims (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  membership_period_id uuid not null,
  profile_id uuid not null,
  service_date date not null,
  claim_kind text not null,
  claim_status text not null,
  held_at timestamptz not null default now(),
  consumed_at timestamptz null,
  released_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_daily_access_claims_period_fkey
    foreign key (run_id, membership_period_id, profile_id)
    references app.membership_periods (run_id, id, profile_id)
    on delete restrict,
  constraint membership_daily_access_claims_run_id_id_key
    unique (run_id, id),
  constraint membership_daily_access_claims_reference_key
    unique (run_id, id, membership_period_id, profile_id, service_date),
  constraint membership_daily_access_claims_kind_check
    check (claim_kind in ('class_reservation', 'open_gym')),
  constraint membership_daily_access_claims_status_check
    check (claim_status in ('held', 'consumed', 'released')),
  constraint membership_daily_access_claims_state_check
    check (
      (
        claim_status = 'held'
        and consumed_at is null
        and released_at is null
      )
      or (
        claim_status = 'consumed'
        and consumed_at is not null
        and consumed_at >= held_at
        and released_at is null
      )
      or (
        claim_status = 'released'
        and consumed_at is null
        and released_at is not null
        and released_at >= held_at
      )
    )
);

create unique index membership_daily_access_claims_active_date_idx
  on app.membership_daily_access_claims (
    run_id,
    membership_period_id,
    service_date
  )
  where claim_status in ('held', 'consumed');

create index membership_daily_access_claims_member_history_idx
  on app.membership_daily_access_claims (
    run_id,
    profile_id,
    service_date desc
  );

create table app.class_reservations (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  run_id uuid not null,
  membership_period_id uuid not null,
  profile_id uuid not null,
  class_session_id uuid not null,
  access_claim_id uuid not null,
  service_date date not null,
  reservation_status text not null,
  cancellation_reason text null,
  reserved_at timestamptz not null default now(),
  cancelled_at timestamptz null,
  checked_in_at timestamptz null,
  no_show_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_reservations_period_fkey
    foreign key (run_id, membership_period_id, profile_id)
    references app.membership_periods (run_id, id, profile_id)
    on delete restrict,
  constraint class_reservations_session_fkey
    foreign key (run_id, class_session_id)
    references app.class_sessions (run_id, id)
    on delete restrict,
  constraint class_reservations_claim_fkey
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
  constraint class_reservations_run_id_id_key unique (run_id, id),
  constraint class_reservations_operation_key
    unique (run_id, profile_id, operation_id),
  constraint class_reservations_claim_key unique (access_claim_id),
  constraint class_reservations_status_check
    check (
      reservation_status in ('reserved', 'cancelled', 'checked_in', 'no_show')
    ),
  constraint class_reservations_cancellation_reason_check
    check (
      cancellation_reason is null
      or cancellation_reason in ('member', 'session')
    ),
  constraint class_reservations_state_check
    check (
      (
        reservation_status = 'reserved'
        and cancellation_reason is null
        and cancelled_at is null
        and checked_in_at is null
        and no_show_at is null
      )
      or (
        reservation_status = 'cancelled'
        and cancellation_reason is not null
        and cancelled_at is not null
        and cancelled_at >= reserved_at
        and checked_in_at is null
        and no_show_at is null
      )
      or (
        reservation_status = 'checked_in'
        and cancellation_reason is null
        and cancelled_at is null
        and checked_in_at is not null
        and checked_in_at >= reserved_at
        and no_show_at is null
      )
      or (
        reservation_status = 'no_show'
        and cancellation_reason is null
        and cancelled_at is null
        and checked_in_at is null
        and no_show_at is not null
        and no_show_at >= reserved_at
      )
    )
);

create unique index class_reservations_one_active_member_session_idx
  on app.class_reservations (
    run_id,
    membership_period_id,
    profile_id,
    class_session_id
  )
  where reservation_status in ('reserved', 'checked_in');

create index class_reservations_session_capacity_idx
  on app.class_reservations (run_id, class_session_id, reservation_status);

create index class_reservations_member_history_idx
  on app.class_reservations (
    run_id,
    profile_id,
    service_date desc,
    created_at desc
  );

create function app.enforce_daily_access_claim_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if row(
    new.id,
    new.run_id,
    new.membership_period_id,
    new.profile_id,
    new.service_date,
    new.claim_kind,
    new.held_at,
    new.created_at
  ) is distinct from row(
    old.id,
    old.run_id,
    old.membership_period_id,
    old.profile_id,
    old.service_date,
    old.claim_kind,
    old.held_at,
    old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'daily access claim identity is immutable';
  end if;

  if old.claim_status <> new.claim_status and not (
    old.claim_status = 'held'
    and new.claim_status in ('consumed', 'released')
  ) then
    raise exception using
      errcode = '23514',
      message = 'daily access claim transition is invalid';
  end if;

  if old.claim_status = new.claim_status and row(
    new.consumed_at,
    new.released_at
  ) is distinct from row(
    old.consumed_at,
    old.released_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'daily access claim evidence is immutable';
  end if;

  return new;
end;
$$;

create function app.enforce_class_reservation_update()
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
    new.class_session_id,
    new.access_claim_id,
    new.service_date,
    new.reserved_at,
    new.created_at
  ) is distinct from row(
    old.id,
    old.operation_id,
    old.run_id,
    old.membership_period_id,
    old.profile_id,
    old.class_session_id,
    old.access_claim_id,
    old.service_date,
    old.reserved_at,
    old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'class reservation identity is immutable';
  end if;

  if old.reservation_status <> new.reservation_status and not (
    old.reservation_status = 'reserved'
    and new.reservation_status in ('cancelled', 'checked_in', 'no_show')
  ) then
    raise exception using
      errcode = '23514',
      message = 'class reservation transition is invalid';
  end if;

  if old.reservation_status = new.reservation_status and row(
    new.cancellation_reason,
    new.cancelled_at,
    new.checked_in_at,
    new.no_show_at
  ) is distinct from row(
    old.cancellation_reason,
    old.cancelled_at,
    old.checked_in_at,
    old.no_show_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'class reservation evidence is immutable';
  end if;

  return new;
end;
$$;

create trigger membership_daily_access_claims_set_updated_at
before update on app.membership_daily_access_claims
for each row execute function app.set_updated_at();

create trigger membership_daily_access_claims_guard
before update on app.membership_daily_access_claims
for each row execute function app.enforce_daily_access_claim_update();

create trigger class_reservations_set_updated_at
before update on app.class_reservations
for each row execute function app.set_updated_at();

create trigger class_reservations_guard
before update on app.class_reservations
for each row execute function app.enforce_class_reservation_update();

alter table app.membership_daily_access_claims enable row level security;
alter table app.membership_daily_access_claims force row level security;
alter table app.class_reservations enable row level security;
alter table app.class_reservations force row level security;

alter table app.membership_daily_access_claims owner to app_owner;
alter table app.class_reservations owner to app_owner;
alter function app.enforce_daily_access_claim_update() owner to app_owner;
alter function app.enforce_class_reservation_update() owner to app_owner;

revoke all on app.membership_daily_access_claims
  from public, anon, authenticated, service_role, app_runtime;
revoke all on app.class_reservations
  from public, anon, authenticated, service_role, app_runtime;

create policy membership_daily_access_claims_management_all
  on app.membership_daily_access_claims
  for all
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  )
  with check (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy class_reservations_management_all
  on app.class_reservations
  for all
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  )
  with check (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy membership_periods_reservation_select
  on app.membership_periods
  for select
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy membership_periods_reservation_lock
  on app.membership_periods
  for update
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  )
  with check (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy membership_period_core_gyms_reservation_select
  on app.membership_period_core_gyms
  for select
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy class_sessions_reservation_select
  on app.class_sessions
  for select
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy class_sessions_reservation_lock
  on app.class_sessions
  for update
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  )
  with check (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy venues_reservation_select
  on app.venues
  for select
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy profiles_reservation_select
  on app.profiles
  for select
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create policy trainer_affiliations_reservation_select
  on app.trainer_affiliations
  for select
  to app_owner
  using (
    current_setting('app.class_reservation_management', true) = 'on'
  );

create function app.reconcile_member_class_reservations(
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
    update app.class_reservations as reservation
    set
      reservation_status = 'cancelled',
      cancellation_reason = 'session',
      cancelled_at = pg_catalog.statement_timestamp()
    from app.class_sessions as session
    where reservation.run_id = selected_run_id
      and reservation.profile_id = selected_profile_id
      and reservation.reservation_status = 'reserved'
      and session.run_id = reservation.run_id
      and session.id = reservation.class_session_id
      and session.status = 'cancelled'
    returning reservation.access_claim_id
  )
  update app.membership_daily_access_claims as claim
  set
    claim_status = 'released',
    released_at = pg_catalog.statement_timestamp()
  where claim.id in (select access_claim_id from transitioned)
    and claim.claim_status = 'held';

  with transitioned as (
    update app.class_reservations as reservation
    set
      reservation_status = 'no_show',
      no_show_at = pg_catalog.statement_timestamp()
    from app.class_sessions as session
    where reservation.run_id = selected_run_id
      and reservation.profile_id = selected_profile_id
      and reservation.reservation_status = 'reserved'
      and session.run_id = reservation.run_id
      and session.id = reservation.class_session_id
      and session.ends_at <= pg_catalog.statement_timestamp()
    returning reservation.access_claim_id
  )
  update app.membership_daily_access_claims as claim
  set
    claim_status = 'released',
    released_at = pg_catalog.statement_timestamp()
  where claim.id in (select access_claim_id from transitioned)
    and claim.claim_status = 'held';
end;
$$;

create function app.current_member_class_schedule()
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
      when latest_reservation.reservation_status = 'cancelled'
        and latest_reservation.cancellation_reason = 'session'
        then 'session-cancelled'
      when latest_reservation.reservation_status = 'cancelled'
        then 'member-cancelled'
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

create function app.reserve_member_class(
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
  order by reservation.created_at desc, reservation.id desc
  limit 1;

  if found then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    if existing_reservation.reservation_status in ('reserved', 'checked_in') then
      return query select 'existing'::text, existing_reservation.id;
    else
      return query select 'state-conflict'::text, null::uuid;
    end if;
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

create function app.cancel_member_class_reservation(
  requested_reservation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_reservation record;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'class reservation actor context is invalid';
  end if;
  if requested_reservation_id is null then
    return 'invalid-request';
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

  select reservation.*, session.starts_at
  into selected_reservation
  from app.class_reservations as reservation
  join app.class_sessions as session
    on session.run_id = reservation.run_id
    and session.id = reservation.class_session_id
  where reservation.id = requested_reservation_id
    and reservation.run_id = run_id_text::uuid
    and reservation.profile_id = profile_id_text::uuid
  for update of reservation;

  if not found then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return 'not-found';
  end if;

  if selected_reservation.reservation_status = 'cancelled' then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return 'existing';
  end if;
  if selected_reservation.reservation_status <> 'reserved' then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return 'state-conflict';
  end if;
  if selected_reservation.starts_at <= pg_catalog.statement_timestamp() then
    perform pg_catalog.set_config(
      'app.class_reservation_management',
      'off',
      true
    );
    return 'too-late';
  end if;

  update app.class_reservations
  set
    reservation_status = 'cancelled',
    cancellation_reason = 'member',
    cancelled_at = pg_catalog.statement_timestamp()
  where id = selected_reservation.id;

  update app.membership_daily_access_claims
  set
    claim_status = 'released',
    released_at = pg_catalog.statement_timestamp()
  where id = selected_reservation.access_claim_id
    and claim_status = 'held';

  perform pg_catalog.set_config(
    'app.class_reservation_management',
    'off',
    true
  );
  return 'cancelled';
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

alter function app.reconcile_member_class_reservations(uuid, uuid)
  owner to app_owner;
alter function app.current_member_class_schedule() owner to app_owner;
alter function app.reserve_member_class(uuid, uuid) owner to app_owner;
alter function app.cancel_member_class_reservation(uuid) owner to app_owner;

revoke all on function app.reconcile_member_class_reservations(uuid, uuid)
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.current_member_class_schedule()
  from public, anon, authenticated, service_role;
revoke all on function app.reserve_member_class(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.cancel_member_class_reservation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.enforce_daily_access_claim_update()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.enforce_class_reservation_update()
  from public, anon, authenticated, service_role, app_runtime;

grant execute on function app.current_member_class_schedule()
  to app_runtime;
grant execute on function app.reserve_member_class(uuid, uuid)
  to app_runtime;
grant execute on function app.cancel_member_class_reservation(uuid)
  to app_runtime;

comment on table app.membership_daily_access_claims is
  'One held, consumed or released included-access claim per membership and venue-local service date; a claim is coordination state, not attendance evidence.';
comment on table app.class_reservations is
  'Actor-owned scheduled-class reservations with immutable session/date snapshots and terminal cancellation, check-in or no-show outcomes.';
comment on function app.current_member_class_schedule() is
  'Returns the current member schedule for frozen core gyms after reconciling cancelled sessions and ended unconfirmed reservations.';
comment on function app.reserve_member_class(uuid, uuid) is
  'Atomically reserves one eligible class seat and one daily access claim with operation-id retry safety.';
comment on function app.cancel_member_class_reservation(uuid) is
  'Cancels one actor-owned future reservation and releases its held daily access claim.';
