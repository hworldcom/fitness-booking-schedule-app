-- Introduce the approval-request eligibility boundary before request
-- persistence. PostgreSQL statement time is authoritative; browser clocks and
-- stale public projections can never authorize a write.

create function app.coach_booking_request_eligibility(
  requested_status text,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when requested_status is null
      or requested_starts_at is null
      or requested_ends_at is null
      or requested_ends_at - requested_starts_at <> interval '1 hour'
      or requested_starts_at <= pg_catalog.statement_timestamp()
      or requested_ends_at
        > pg_catalog.statement_timestamp() + interval '7 days'
      then 'unavailable'
    when requested_status = 'booked' then 'booked'
    when requested_status = 'withdrawn' then 'withdrawn'
    when requested_status <> 'open' then 'unavailable'
    else 'requestable'
  end
$$;

alter function app.coach_booking_request_eligibility(
  text,
  timestamptz,
  timestamptz
) owner to app_owner;
revoke all on function app.coach_booking_request_eligibility(
  text,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function app.coach_booking_request_eligibility(
  text,
  timestamptz,
  timestamptz
) to app_runtime;

drop policy coach_availability_slots_public_select
  on app.coach_availability_slots;
create policy coach_availability_slots_public_select
  on app.coach_availability_slots
  for select
  to app_runtime
  using (
    starts_at > pg_catalog.statement_timestamp()
    and ends_at <= pg_catalog.statement_timestamp() + interval '7 days'
    and exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = coach_availability_slots.run_id
        and coach.profile_id = coach_availability_slots.profile_id
        and coach.visibility = 'visible'
        and coach.location_confirmed_at is not null
    )
  );

create function app.current_coach_booking_request_eligibility(
  requested_slot_id uuid
)
returns table (
  slot_id uuid,
  eligibility text,
  database_time timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_slot app.coach_availability_slots%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_slot_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking request eligibility is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );

  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  join app.coach_profiles as coach
    on coach.run_id = slot.run_id
    and coach.profile_id = slot.profile_id
  where slot.id = requested_slot_id
    and slot.run_id = run_id_text::uuid
    and slot.profile_id <> profile_id_text::uuid
    and coach.visibility = 'visible'
    and coach.location_confirmed_at is not null
    and app.coach_trust_kind(coach.profile_id, coach.is_demo) is not null;

  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);

  if selected_slot.id is null then
    return query select
      requested_slot_id,
      'unavailable'::text,
      pg_catalog.statement_timestamp();
    return;
  end if;

  return query select
    selected_slot.id,
    app.coach_booking_request_eligibility(
      selected_slot.status,
      selected_slot.starts_at,
      selected_slot.ends_at
    ),
    pg_catalog.statement_timestamp();
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_profile_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.current_coach_booking_request_eligibility(uuid)
  owner to app_owner;
revoke all on function app.current_coach_booking_request_eligibility(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app.current_coach_booking_request_eligibility(uuid)
  to app_runtime;

-- Keep the historical signature so stale application instances fail closed.
-- DEV0188 will introduce the request-creation mutation; this function must not
-- remain an approval bypass in the meantime.
create or replace function app.book_direct_private_session(
  requested_slot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_slot_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking is invalid';
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'direct coach booking is disabled; coach confirmation is required';
end;
$$;

alter function app.book_direct_private_session(uuid) owner to app_owner;
revoke all on function app.book_direct_private_session(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app.book_direct_private_session(uuid)
  to app_runtime;

comment on function app.coach_booking_request_eligibility(
  text,
  timestamptz,
  timestamptz
) is
  'Classifies one occurrence from PostgreSQL statement time using its future start boundary and seven-day horizon.';
comment on function app.current_coach_booking_request_eligibility(uuid) is
  'Returns one actor-safe booking-request eligibility projection without creating a request or booking.';
comment on function app.book_direct_private_session(uuid) is
  'Historical fail-closed entry point retained for stale callers; direct booking is disabled because coach confirmation is required.';
