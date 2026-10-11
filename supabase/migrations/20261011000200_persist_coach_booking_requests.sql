-- Persist independent approval requests without holding occurrence capacity.
-- Only accepting one pending request creates the existing capacity-one booking.

alter table app.coach_private_bookings
  add constraint coach_private_bookings_request_link_key unique (
    run_id,
    id,
    slot_id,
    coach_profile_id,
    client_profile_id
  );

create table app.coach_booking_requests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  slot_id uuid not null,
  coach_profile_id uuid not null,
  client_profile_id uuid not null,
  status text not null default 'pending',
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  coach_timezone text not null,
  coach_training_location_id uuid null,
  training_location_name text not null,
  location_kind text not null,
  gym_name text null,
  public_location_label text not null,
  decision_deadline_at timestamptz not null,
  decided_by_profile_id uuid null,
  decided_at timestamptz null,
  accepted_booking_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_booking_requests_slot_fkey
    foreign key (run_id, slot_id)
    references app.coach_availability_slots (run_id, id)
    on delete restrict,
  constraint coach_booking_requests_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_booking_requests_training_location_fkey
    foreign key (
      run_id,
      coach_profile_id,
      coach_training_location_id
    )
    references app.coach_training_locations (run_id, profile_id, id)
    on delete restrict,
  constraint coach_booking_requests_client_fkey
    foreign key (run_id, client_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_booking_requests_decider_fkey
    foreign key (run_id, decided_by_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_booking_requests_booking_fkey
    foreign key (
      run_id,
      accepted_booking_id,
      slot_id,
      coach_profile_id,
      client_profile_id
    )
    references app.coach_private_bookings (
      run_id,
      id,
      slot_id,
      coach_profile_id,
      client_profile_id
    )
    on delete restrict,
  constraint coach_booking_requests_distinct_participants_check
    check (coach_profile_id <> client_profile_id),
  constraint coach_booking_requests_status_check check (
    status in (
      'pending',
      'accepted',
      'declined',
      'withdrawn',
      'expired',
      'not-selected',
      'occurrence-closed'
    )
  ),
  constraint coach_booking_requests_time_check check (
    scheduled_end_at - scheduled_start_at = interval '1 hour'
    and decision_deadline_at > created_at
    and decision_deadline_at <= scheduled_start_at
  ),
  constraint coach_booking_requests_timezone_check check (
    coach_timezone = 'UTC'
    or coach_timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
  ),
  constraint coach_booking_requests_location_check check (
    char_length(training_location_name) between 2 and 240
    and char_length(public_location_label) between 2 and 240
    and (
      (
        location_kind = 'gym'
        and gym_name is not null
        and char_length(gym_name) between 2 and 120
      )
      or (location_kind = 'independent' and gym_name is null)
    )
  ),
  constraint coach_booking_requests_state_check check (
    (
      status = 'pending'
      and decided_by_profile_id is null
      and decided_at is null
      and accepted_booking_id is null
    )
    or (
      status = 'accepted'
      and decided_by_profile_id = coach_profile_id
      and decided_at is not null
      and accepted_booking_id is not null
    )
    or (
      status in ('declined', 'not-selected')
      and decided_by_profile_id = coach_profile_id
      and decided_at is not null
      and accepted_booking_id is null
    )
    or (
      status = 'withdrawn'
      and decided_by_profile_id = client_profile_id
      and decided_at is not null
      and accepted_booking_id is null
    )
    or (
      status = 'expired'
      and decided_by_profile_id is null
      and decided_at is not null
      and accepted_booking_id is null
    )
    or (
      status = 'occurrence-closed'
      and (
        decided_by_profile_id is null
        or decided_by_profile_id = coach_profile_id
      )
      and decided_at is not null
      and accepted_booking_id is null
    )
  )
);

create unique index coach_booking_requests_active_client_key
  on app.coach_booking_requests (run_id, slot_id, client_profile_id)
  where status = 'pending';
create unique index coach_booking_requests_accepted_slot_key
  on app.coach_booking_requests (run_id, slot_id)
  where status = 'accepted';
create unique index coach_booking_requests_booking_key
  on app.coach_booking_requests (accepted_booking_id)
  where accepted_booking_id is not null;
create index coach_booking_requests_client_idx
  on app.coach_booking_requests (
    run_id,
    client_profile_id,
    created_at desc,
    id desc
  );
create index coach_booking_requests_coach_idx
  on app.coach_booking_requests (
    run_id,
    coach_profile_id,
    created_at desc,
    id desc
  );
create index coach_booking_requests_pending_deadline_idx
  on app.coach_booking_requests (
    run_id,
    decision_deadline_at,
    id
  )
  where status = 'pending';

create trigger coach_booking_requests_set_updated_at
before update on app.coach_booking_requests
for each row execute function app.set_updated_at();

alter table app.coach_booking_requests enable row level security;
alter table app.coach_booking_requests force row level security;
alter table app.coach_booking_requests owner to app_owner;

revoke all on app.coach_booking_requests
  from public, anon, authenticated, service_role;
revoke all on app.coach_booking_requests from app_runtime;

create policy coach_booking_requests_management_all
  on app.coach_booking_requests
  for all
  to app_owner
  using (
    pg_catalog.current_setting(
      'app.coach_booking_request_management',
      true
    ) = 'on'
  )
  with check (
    pg_catalog.current_setting(
      'app.coach_booking_request_management',
      true
    ) = 'on'
  );

create function app.create_coach_booking_request(requested_slot_id uuid)
returns table (
  request_id uuid,
  request_status text,
  booking_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  initial_slot app.coach_availability_slots%rowtype;
  selected_slot app.coach_availability_slots%rowtype;
  selected_coach app.coach_profiles%rowtype;
  selected_request app.coach_booking_requests%rowtype;
  created_request_id uuid;
  request_time timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_slot_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request creation is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  -- Cursor timestamps cross the JavaScript boundary, whose Date precision is
  -- milliseconds. Persist at that same precision so a keyset cursor cannot
  -- round past rows created within the same millisecond.
  request_time := pg_catalog.date_trunc(
    'milliseconds',
    pg_catalog.statement_timestamp()
  );
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

  select slot.*
  into initial_slot
  from app.coach_availability_slots as slot
  where slot.run_id = run_id_text::uuid
    and slot.id = requested_slot_id;

  if initial_slot.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request occurrence is unavailable';
  end if;

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = initial_slot.run_id
    and coach.profile_id = initial_slot.profile_id
  for share;

  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.run_id = initial_slot.run_id
    and slot.id = initial_slot.id
  for update;

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = request_time
  where request.run_id = selected_slot.run_id
    and request.slot_id = selected_slot.id
    and request.client_profile_id = profile_id_text::uuid
    and request.status = 'pending'
    and request.decision_deadline_at <= request_time;

  select request.*
  into selected_request
  from app.coach_booking_requests as request
  where request.run_id = selected_slot.run_id
    and request.slot_id = selected_slot.id
    and request.client_profile_id = profile_id_text::uuid
    and request.status = 'pending'
  for update;

  if selected_request.id is not null then
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
    return query select
      selected_request.id,
      selected_request.status,
      selected_request.accepted_booking_id;
    return;
  end if;

  if selected_coach.profile_id is null
    or selected_coach.profile_id = profile_id_text::uuid
    or selected_coach.visibility <> 'visible'
    or selected_coach.location_confirmed_at is null
    or app.coach_trust_kind(
      selected_coach.profile_id,
      selected_coach.is_demo
    ) is null
    or app.coach_booking_request_eligibility(
      selected_slot.status,
      selected_slot.starts_at,
      selected_slot.ends_at
    ) <> 'requestable'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request occurrence is unavailable';
  end if;

  created_request_id := gen_random_uuid();
  insert into app.coach_booking_requests (
    id,
    run_id,
    slot_id,
    coach_profile_id,
    client_profile_id,
    status,
    scheduled_start_at,
    scheduled_end_at,
    coach_timezone,
    coach_training_location_id,
    training_location_name,
    location_kind,
    gym_name,
    public_location_label,
    decision_deadline_at,
    created_at,
    updated_at
  ) values (
    created_request_id,
    selected_slot.run_id,
    selected_slot.id,
    selected_slot.profile_id,
    profile_id_text::uuid,
    'pending',
    selected_slot.starts_at,
    selected_slot.ends_at,
    selected_slot.coach_timezone,
    selected_slot.coach_training_location_id,
    coalesce(
      selected_slot.training_location_name,
      selected_slot.gym_name,
      selected_slot.public_location_label
    ),
    selected_slot.location_kind,
    selected_slot.gym_name,
    selected_slot.public_location_label,
    least(request_time + interval '12 hours', selected_slot.starts_at),
    request_time,
    request_time
  );

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
  return query select created_request_id, 'pending'::text, null::uuid;
exception
  when others then
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

create function app.withdraw_coach_booking_request(
  requested_request_id uuid
)
returns table (
  request_id uuid,
  request_status text,
  booking_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  initial_request app.coach_booking_requests%rowtype;
  selected_request app.coach_booking_requests%rowtype;
  request_time timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_request_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request withdrawal is invalid';
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

  select request.*
  into initial_request
  from app.coach_booking_requests as request
  where request.run_id = run_id_text::uuid
    and request.id = requested_request_id
    and request.client_profile_id = profile_id_text::uuid;

  if initial_request.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request withdrawal is unauthorized';
  end if;

  perform 1
  from app.coach_profiles as coach
  where coach.run_id = initial_request.run_id
    and coach.profile_id = initial_request.coach_profile_id
  for share;
  perform 1
  from app.coach_availability_slots as slot
  where slot.run_id = initial_request.run_id
    and slot.id = initial_request.slot_id
  for update;
  perform request.id
  from app.coach_booking_requests as request
  where request.run_id = initial_request.run_id
    and request.slot_id = initial_request.slot_id
    and request.status = 'pending'
  order by request.id
  for update;

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = request_time
  where request.run_id = initial_request.run_id
    and request.slot_id = initial_request.slot_id
    and request.status = 'pending'
    and request.decision_deadline_at <= request_time;

  select request.*
  into selected_request
  from app.coach_booking_requests as request
  where request.run_id = initial_request.run_id
    and request.id = initial_request.id
  for update;

  if selected_request.status = 'pending' then
    update app.coach_booking_requests
    set
      status = 'withdrawn',
      decided_by_profile_id = profile_id_text::uuid,
      decided_at = request_time
    where id = selected_request.id
    returning * into selected_request;
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
  return query select
    selected_request.id,
    selected_request.status,
    selected_request.accepted_booking_id;
exception
  when others then
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

create function app.decline_coach_booking_request(requested_request_id uuid)
returns table (
  request_id uuid,
  request_status text,
  booking_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  initial_request app.coach_booking_requests%rowtype;
  selected_request app.coach_booking_requests%rowtype;
  request_time timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_request_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request decline is invalid';
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

  select request.*
  into initial_request
  from app.coach_booking_requests as request
  where request.run_id = run_id_text::uuid
    and request.id = requested_request_id
    and request.coach_profile_id = profile_id_text::uuid;

  if initial_request.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request decline is unauthorized';
  end if;

  perform 1
  from app.coach_profiles as coach
  where coach.run_id = initial_request.run_id
    and coach.profile_id = initial_request.coach_profile_id
  for share;
  perform 1
  from app.coach_availability_slots as slot
  where slot.run_id = initial_request.run_id
    and slot.id = initial_request.slot_id
  for update;
  perform request.id
  from app.coach_booking_requests as request
  where request.run_id = initial_request.run_id
    and request.slot_id = initial_request.slot_id
    and request.status = 'pending'
  order by request.id
  for update;

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = request_time
  where request.run_id = initial_request.run_id
    and request.slot_id = initial_request.slot_id
    and request.status = 'pending'
    and request.decision_deadline_at <= request_time;

  select request.*
  into selected_request
  from app.coach_booking_requests as request
  where request.run_id = initial_request.run_id
    and request.id = initial_request.id
  for update;

  if selected_request.status = 'pending' then
    update app.coach_booking_requests
    set
      status = 'declined',
      decided_by_profile_id = profile_id_text::uuid,
      decided_at = request_time
    where id = selected_request.id
    returning * into selected_request;
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
  return query select
    selected_request.id,
    selected_request.status,
    selected_request.accepted_booking_id;
exception
  when others then
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

create function app.accept_coach_booking_request(requested_request_id uuid)
returns table (
  request_id uuid,
  request_status text,
  booking_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  initial_request app.coach_booking_requests%rowtype;
  selected_request app.coach_booking_requests%rowtype;
  selected_slot app.coach_availability_slots%rowtype;
  selected_coach app.coach_profiles%rowtype;
  created_booking_id uuid;
  request_time timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_request_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request acceptance is invalid';
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
  perform pg_catalog.set_config('app.coach_booking_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );

  select request.*
  into initial_request
  from app.coach_booking_requests as request
  where request.run_id = run_id_text::uuid
    and request.id = requested_request_id
    and request.coach_profile_id = profile_id_text::uuid;

  if initial_request.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request acceptance is unauthorized';
  end if;

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = initial_request.run_id
    and coach.profile_id = initial_request.coach_profile_id
  for share;
  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.run_id = initial_request.run_id
    and slot.id = initial_request.slot_id
  for update;
  perform request.id
  from app.coach_booking_requests as request
  where request.run_id = initial_request.run_id
    and request.slot_id = initial_request.slot_id
    and request.status = 'pending'
  order by request.id
  for update;

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = request_time
  where request.run_id = initial_request.run_id
    and request.slot_id = initial_request.slot_id
    and request.status = 'pending'
    and request.decision_deadline_at <= request_time;

  select request.*
  into selected_request
  from app.coach_booking_requests as request
  where request.run_id = initial_request.run_id
    and request.id = initial_request.id
  for update;

  if selected_request.status = 'pending' then
    if selected_coach.profile_id is null
      or selected_coach.visibility <> 'visible'
      or selected_coach.location_confirmed_at is null
      or app.coach_trust_kind(
        selected_coach.profile_id,
        selected_coach.is_demo
      ) is null
      or selected_slot.id is null
      or selected_slot.status <> 'open'
      or selected_slot.starts_at <= request_time
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking request acceptance conflicts with occurrence';
    end if;

    created_booking_id := gen_random_uuid();
    insert into app.coach_private_bookings (
      id,
      run_id,
      slot_id,
      coach_profile_id,
      client_profile_id,
      credit_projection_id,
      status,
      scheduled_start_at,
      scheduled_end_at,
      early_return_until,
      hold_expires_at
    ) values (
      created_booking_id,
      selected_request.run_id,
      selected_request.slot_id,
      selected_request.coach_profile_id,
      selected_request.client_profile_id,
      null,
      'confirmed',
      selected_request.scheduled_start_at,
      selected_request.scheduled_end_at,
      selected_request.scheduled_start_at,
      selected_request.scheduled_start_at
    );

    update app.coach_availability_slots
    set status = 'booked'
    where run_id = selected_slot.run_id
      and id = selected_slot.id
      and status = 'open';

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking request occurrence changed';
    end if;

    update app.coach_booking_requests
    set
      status = 'accepted',
      decided_by_profile_id = profile_id_text::uuid,
      decided_at = request_time,
      accepted_booking_id = created_booking_id
    where id = selected_request.id;

    update app.coach_booking_requests
    set
      status = 'not-selected',
      decided_by_profile_id = profile_id_text::uuid,
      decided_at = request_time
    where run_id = selected_request.run_id
      and slot_id = selected_request.slot_id
      and id <> selected_request.id
      and status = 'pending';

    select request.*
    into selected_request
    from app.coach_booking_requests as request
    where request.id = initial_request.id;
  end if;

  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return query select
    selected_request.id,
    selected_request.status,
    selected_request.accepted_booking_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.close_coach_booking_request_occurrence(
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
  return occurrence_status;
exception
  when others then
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

create function app.close_pending_requests_for_withdrawn_occurrence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
begin
  if new.status <> 'withdrawn'
    or old.status is not distinct from new.status
  then
    return new;
  end if;

  if pg_catalog.current_setting('app.current_profile_id', true)
      ~ '^[0-9a-fA-F-]{36}$'
    and pg_catalog.current_setting(
      'app.current_profile_id',
      true
    )::uuid = new.profile_id
  then
    actor_profile_id := new.profile_id;
  end if;

  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );
  update app.coach_booking_requests
  set
    status = 'occurrence-closed',
    decided_by_profile_id = actor_profile_id,
    decided_at = pg_catalog.statement_timestamp()
  where run_id = new.run_id
    and slot_id = new.id
    and status = 'pending';
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    raise;
end;
$$;

create trigger coach_availability_slots_close_booking_requests
after update of status on app.coach_availability_slots
for each row execute function
  app.close_pending_requests_for_withdrawn_occurrence();

create function app.close_pending_requests_for_hidden_coach()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
begin
  if new.visibility <> 'hidden'
    or old.visibility is not distinct from new.visibility
  then
    return new;
  end if;

  if pg_catalog.current_setting('app.current_profile_id', true)
      ~ '^[0-9a-fA-F-]{36}$'
    and pg_catalog.current_setting(
      'app.current_profile_id',
      true
    )::uuid = new.profile_id
  then
    actor_profile_id := new.profile_id;
  end if;

  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );
  update app.coach_booking_requests
  set
    status = 'occurrence-closed',
    decided_by_profile_id = actor_profile_id,
    decided_at = pg_catalog.statement_timestamp()
  where run_id = new.run_id
    and coach_profile_id = new.profile_id
    and status = 'pending';
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    raise;
end;
$$;

create trigger coach_profiles_close_booking_requests
after update of visibility on app.coach_profiles
for each row execute function app.close_pending_requests_for_hidden_coach();

create function app.current_client_coach_booking_requests(
  requested_limit integer,
  requested_before_created_at timestamptz,
  requested_before_id uuid
)
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
  decision_deadline_at timestamptz,
  decided_at timestamptz,
  accepted_booking_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_limit not between 1 and 50
    or (requested_before_created_at is null) <> (requested_before_id is null)
  then
    raise exception using
      errcode = 'P0001',
      message = 'client coach booking request projection is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );

  with due as (
    select request.id
    from app.coach_booking_requests as request
    where request.run_id = run_id_text::uuid
      and request.client_profile_id = profile_id_text::uuid
      and request.status = 'pending'
      and request.decision_deadline_at <= pg_catalog.statement_timestamp()
    order by request.created_at desc, request.id desc
    for update skip locked
    limit 100
  )
  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = pg_catalog.statement_timestamp()
  from due
  where request.id = due.id;

  return query
  select
    request.id,
    request.run_id,
    request.slot_id,
    request.coach_profile_id,
    coach.display_name,
    coach.public_slug,
    request.client_profile_id,
    client.display_name,
    request.status,
    request.scheduled_start_at,
    request.scheduled_end_at,
    request.coach_timezone,
    request.coach_training_location_id,
    request.training_location_name,
    request.location_kind,
    request.gym_name,
    request.public_location_label,
    request.decision_deadline_at,
    request.decided_at,
    request.accepted_booking_id,
    request.created_at,
    request.updated_at
  from app.coach_booking_requests as request
  join app.coach_profiles as coach
    on coach.run_id = request.run_id
    and coach.profile_id = request.coach_profile_id
  join app.profiles as client
    on client.id = request.client_profile_id
  where request.run_id = run_id_text::uuid
    and request.client_profile_id = profile_id_text::uuid
    and (
      requested_before_created_at is null
      or (request.created_at, request.id)
        < (requested_before_created_at, requested_before_id)
    )
  order by request.created_at desc, request.id desc
  limit requested_limit;

  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.current_owned_coach_booking_requests(
  requested_limit integer,
  requested_before_created_at timestamptz,
  requested_before_id uuid
)
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
  decision_deadline_at timestamptz,
  decided_at timestamptz,
  accepted_booking_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_limit not between 1 and 50
    or (requested_before_created_at is null) <> (requested_before_id is null)
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request projection is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );

  with due as (
    select request.id
    from app.coach_booking_requests as request
    where request.run_id = run_id_text::uuid
      and request.coach_profile_id = profile_id_text::uuid
      and request.status = 'pending'
      and request.decision_deadline_at <= pg_catalog.statement_timestamp()
    order by request.created_at desc, request.id desc
    for update skip locked
    limit 100
  )
  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = pg_catalog.statement_timestamp()
  from due
  where request.id = due.id;

  return query
  select
    request.id,
    request.run_id,
    request.slot_id,
    request.coach_profile_id,
    coach.display_name,
    coach.public_slug,
    request.client_profile_id,
    client.display_name,
    request.status,
    request.scheduled_start_at,
    request.scheduled_end_at,
    request.coach_timezone,
    request.coach_training_location_id,
    request.training_location_name,
    request.location_kind,
    request.gym_name,
    request.public_location_label,
    request.decision_deadline_at,
    request.decided_at,
    request.accepted_booking_id,
    request.created_at,
    request.updated_at
  from app.coach_booking_requests as request
  join app.coach_profiles as coach
    on coach.run_id = request.run_id
    and coach.profile_id = request.coach_profile_id
  join app.profiles as client
    on client.id = request.client_profile_id
  where request.run_id = run_id_text::uuid
    and request.coach_profile_id = profile_id_text::uuid
    and (
      requested_before_created_at is null
      or (request.created_at, request.id)
        < (requested_before_created_at, requested_before_id)
    )
  order by request.created_at desc, request.id desc
  limit requested_limit;

  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.create_coach_booking_request(uuid) owner to app_owner;
alter function app.withdraw_coach_booking_request(uuid) owner to app_owner;
alter function app.decline_coach_booking_request(uuid) owner to app_owner;
alter function app.accept_coach_booking_request(uuid) owner to app_owner;
alter function app.close_coach_booking_request_occurrence(uuid)
  owner to app_owner;
alter function app.close_pending_requests_for_withdrawn_occurrence()
  owner to app_owner;
alter function app.close_pending_requests_for_hidden_coach()
  owner to app_owner;
alter function app.current_client_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) owner to app_owner;
alter function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) owner to app_owner;

revoke all on function app.create_coach_booking_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.withdraw_coach_booking_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.decline_coach_booking_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.accept_coach_booking_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.close_coach_booking_request_occurrence(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.close_pending_requests_for_withdrawn_occurrence()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.close_pending_requests_for_hidden_coach()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.current_client_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) from public, anon, authenticated, service_role;
revoke all on function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) from public, anon, authenticated, service_role;

grant execute on function app.create_coach_booking_request(uuid)
  to app_runtime;
grant execute on function app.withdraw_coach_booking_request(uuid)
  to app_runtime;
grant execute on function app.decline_coach_booking_request(uuid)
  to app_runtime;
grant execute on function app.accept_coach_booking_request(uuid)
  to app_runtime;
grant execute on function app.close_coach_booking_request_occurrence(uuid)
  to app_runtime;
grant execute on function app.current_client_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) to app_runtime;
grant execute on function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) to app_runtime;

comment on table app.coach_booking_requests is
  'Independent client attempts for coach approval; pending rows never reserve occurrence capacity.';
comment on column app.coach_booking_requests.decision_deadline_at is
  'Earlier of twelve hours after database creation or the immutable occurrence start.';
comment on function app.create_coach_booking_request(uuid) is
  'Creates or recovers one actor-owned pending request without holding the occurrence.';
comment on function app.withdraw_coach_booking_request(uuid) is
  'Lets the requesting client idempotently withdraw one pending attempt.';
comment on function app.decline_coach_booking_request(uuid) is
  'Lets the owning coach idempotently decline one pending attempt without consuming capacity.';
comment on function app.accept_coach_booking_request(uuid) is
  'Atomically accepts one pending request, creates the capacity-one booking and closes the other candidates.';
comment on function app.close_coach_booking_request_occurrence(uuid) is
  'Lets the owning coach withdraw one future occurrence and close its pending requests without changing the recurring rule.';
comment on function app.current_client_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) is
  'Returns one bounded actor-owned client request page and reconciles a bounded set of its elapsed deadlines.';
comment on function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) is
  'Returns one bounded owning-coach request page and reconciles a bounded set of its elapsed deadlines.';
