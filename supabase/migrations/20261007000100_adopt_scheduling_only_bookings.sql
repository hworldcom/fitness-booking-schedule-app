alter table app.coach_private_bookings
  alter column credit_projection_id drop not null,
  add column cancelled_by_profile_id uuid null;

alter table app.coach_private_bookings
  add constraint coach_private_bookings_cancelled_by_fkey
  foreign key (run_id, cancelled_by_profile_id)
  references app.demo_run_participants (run_id, profile_id)
  on delete restrict,
  add constraint coach_private_bookings_direct_cancellation_check check (
    credit_projection_id is not null
    or (status = 'cancelled') = (cancelled_by_profile_id is not null)
  );

create function app.book_direct_private_session(requested_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_slot app.coach_availability_slots%rowtype;
  selected_coach app.coach_profiles%rowtype;
  existing_booking app.coach_private_bookings%rowtype;
  created_booking_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_slot_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_profile_management', 'on', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.id = requested_slot_id
    and slot.run_id = run_id_text::uuid
  for update;

  select booking.*
  into existing_booking
  from app.coach_private_bookings as booking
  where booking.slot_id = requested_slot_id
    and booking.status in (
      'pending',
      'confirmed',
      'cancellation-requested',
      'denied'
    )
  for update;

  if found then
    if existing_booking.client_profile_id = profile_id_text::uuid
      and existing_booking.credit_projection_id is null
      and existing_booking.status = 'confirmed'
    then
      perform set_config('app.coach_profile_management', 'off', true);
      perform set_config('app.coach_availability_management', 'off', true);
      perform set_config('app.coach_booking_management', 'off', true);
      return existing_booking.id;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking slot is unavailable';
  end if;

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = selected_slot.profile_id
    and coach.visibility = 'visible'
    and coach.location_confirmed_at is not null
  for share;

  if selected_slot.id is null
    or selected_slot.status <> 'open'
    or selected_slot.starts_at <= statement_timestamp()
    or selected_slot.ends_at - selected_slot.starts_at <> interval '1 hour'
    or selected_coach.profile_id is null
    or selected_coach.profile_id = profile_id_text::uuid
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking slot is unavailable';
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
    run_id_text::uuid,
    selected_slot.id,
    selected_slot.profile_id,
    profile_id_text::uuid,
    null,
    'confirmed',
    selected_slot.starts_at,
    selected_slot.ends_at,
    selected_slot.starts_at,
    selected_slot.starts_at
  );

  update app.coach_availability_slots
  set status = 'booked'
  where id = selected_slot.id
    and run_id = run_id_text::uuid
    and status = 'open';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking slot changed';
  end if;

  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return created_booking_id;
exception
  when others then
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.cancel_direct_private_booking(requested_booking_id uuid)
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

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

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
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;

  if selected_booking.status <> 'confirmed'
    or selected_booking.scheduled_start_at <= statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking cannot be cancelled';
  end if;

  update app.coach_private_bookings
  set
    status = 'cancelled',
    cancelled_at = statement_timestamp(),
    cancelled_by_profile_id = profile_id_text::uuid
  where id = selected_booking.id;

  update app.coach_availability_slots
  set status = 'open'
  where id = selected_booking.slot_id
    and run_id = selected_booking.run_id
    and status = 'booked'
    and starts_at > statement_timestamp();

  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_booking.id;
exception
  when others then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.complete_direct_private_booking(requested_booking_id uuid)
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
      message = 'direct coach booking completion is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.credit_projection_id is null
    and booking.coach_profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking completion is unauthorized';
  end if;

  if selected_booking.status = 'completed' then
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;

  if selected_booking.status <> 'confirmed'
    or selected_booking.scheduled_start_at > statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking cannot be completed';
  end if;

  update app.coach_private_bookings
  set
    status = 'completed',
    completed_at = statement_timestamp()
  where id = selected_booking.id;

  perform set_config('app.coach_booking_management', 'off', true);
  return selected_booking.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

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

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_profile_management', 'on', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

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

  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
exception
  when others then
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

alter function app.book_direct_private_session(uuid) owner to app_owner;
alter function app.cancel_direct_private_booking(uuid) owner to app_owner;
alter function app.complete_direct_private_booking(uuid) owner to app_owner;
alter function app.current_direct_private_bookings() owner to app_owner;

revoke all on function app.book_direct_private_session(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.cancel_direct_private_booking(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.complete_direct_private_booking(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.current_direct_private_bookings()
  from public, anon, authenticated, service_role;

grant execute on function app.book_direct_private_session(uuid)
  to app_runtime;
grant execute on function app.cancel_direct_private_booking(uuid)
  to app_runtime;
grant execute on function app.complete_direct_private_booking(uuid)
  to app_runtime;
grant execute on function app.current_direct_private_bookings()
  to app_runtime;

comment on function app.book_direct_private_session(uuid) is
  'Creates or recovers one authorized scheduling-only booking for a future open one-hour coach occurrence.';
comment on function app.cancel_direct_private_booking(uuid) is
  'Lets the booking client or coach idempotently cancel one future direct booking and reopen its occurrence.';
comment on function app.complete_direct_private_booking(uuid) is
  'Lets the owning coach idempotently complete one elapsed direct booking.';
comment on function app.current_direct_private_bookings() is
  'Returns bounded scheduling-only booking projections to the booking client or owning coach.';
