-- DEV0265: equivalent fresh-database baseline through 20261016000100.
-- Original migrations and source/checksum manifest: ../migration-history/20261016000100/
-- Existing databases require the documented history transition; never replay over retained data.
do $$ begin
  if to_regnamespace('app') is not null then
    raise exception 'Baseline requires an empty app schema; preserve existing data and follow the migration-history transition guide';
  end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_owner') then
    create role app_owner nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime nologin nosuperuser nocreatedb nocreaterole inherit nobypassrls;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_roles
    where rolname in ('app_owner', 'app_runtime')
      and (rolsuper or rolbypassrls)
  ) then
    raise exception 'application roles must not be superuser or bypass RLS';
  end if;
end
$$;

alter role app_owner nologin nocreatedb nocreaterole noinherit;
alter role app_runtime nologin nocreatedb nocreaterole inherit;
grant app_owner, app_runtime to postgres;


create extension if not exists btree_gist with schema extensions;

--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: app_owner
--

CREATE SCHEMA app;


ALTER SCHEMA app OWNER TO app_owner;

--
-- Name: accept_coach_booking_request(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.accept_coach_booking_request(requested_request_id uuid) RETURNS TABLE(request_id uuid, request_status text, booking_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.accept_coach_booking_request(requested_request_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION accept_coach_booking_request(requested_request_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.accept_coach_booking_request(requested_request_id uuid) IS 'Atomically accepts one pending request, creates the capacity-one booking and closes the other candidates.';


--
-- Name: activate_owned_coaching(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.activate_owned_coaching() RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  activated_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach activation actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'on',
    true
  );

  update app.profiles as profile
  set
    coaching_activated_at = coalesce(
      profile.coaching_activated_at,
      pg_catalog.statement_timestamp()
    ),
    updated_at = case
      when profile.coaching_activated_at is null
        then pg_catalog.statement_timestamp()
      else profile.updated_at
    end
  where profile.id = profile_id_text::uuid
    and profile.record_source = 'user'
    and profile.auth_user_id is not null
    and profile.claimed_at is not null
  returning profile.coaching_activated_at into activated_at;

  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'off',
    true
  );

  if activated_at is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach activation profile is unavailable';
  end if;

  return activated_at;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_activation_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.activate_owned_coaching() OWNER TO app_owner;

--
-- Name: FUNCTION activate_owned_coaching(); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.activate_owned_coaching() IS 'Idempotently activates coaching for the verified current application profile.';


--
-- Name: assert_visible_coach_primary_location(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.assert_visible_coach_primary_location() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  affected_run_id uuid;
  affected_profile_id uuid;
  coach_visibility text;
  primary_count integer;
begin
  if tg_op = 'DELETE' then
    affected_run_id := old.run_id;
    affected_profile_id := old.profile_id;
  else
    affected_run_id := new.run_id;
    affected_profile_id := new.profile_id;
  end if;

  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select coach.visibility
  into coach_visibility
  from app.coach_profiles as coach
  where coach.run_id = affected_run_id
    and coach.profile_id = affected_profile_id;

  if coach_visibility = 'visible' then
    select pg_catalog.count(*)::integer
    into primary_count
    from app.coach_training_locations as location
    where location.run_id = affected_run_id
      and location.profile_id = affected_profile_id
      and location.status = 'active'
      and location.is_primary
      and location.location_confirmed_at is not null;

    if primary_count <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'visible coach requires exactly one active primary training location';
    end if;
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return null;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.assert_visible_coach_primary_location() OWNER TO app_owner;

--
-- Name: authorized_actor_context_valid(uuid, uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.authorized_actor_context_valid(requested_profile_id uuid, requested_run_id uuid, requested_run_role text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  run_role_text text;
  context_is_valid boolean;
begin
  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  run_role_text := pg_catalog.current_setting('app.current_run_role', true);

  if auth_user_id_text is null
    or profile_id_text is null
    or run_id_text is null
    or run_role_text not in ('member', 'operator')
  then
    return false;
  end if;

  if requested_profile_id is not null
    and requested_profile_id <> profile_id_text::uuid
  then
    return false;
  end if;

  if requested_run_id is not null
    and requested_run_id <> run_id_text::uuid
  then
    return false;
  end if;

  if requested_run_role is not null
    and requested_run_role <> run_role_text
  then
    return false;
  end if;

  perform pg_catalog.set_config('app.actor_validation', 'on', true);

  select exists (
    select 1
    from app.profiles as profile
    join app.demo_run_participants as membership
      on membership.profile_id = profile.id
    join app.demo_runs as demo_run
      on demo_run.id = membership.run_id
    where profile.id = profile_id_text::uuid
      and profile.auth_user_id = auth_user_id_text::uuid
      and profile.record_source = 'user'
      and profile.claimed_at is not null
      and membership.run_id = run_id_text::uuid
      and membership.role = run_role_text
      and membership.status = 'active'
      and demo_run.status = 'active'
      and demo_run.catalogue_visibility = 'public'
  )
  into context_is_valid;

  perform pg_catalog.set_config('app.actor_validation', 'off', true);
  return context_is_valid;
exception
  when invalid_text_representation then
    perform pg_catalog.set_config('app.actor_validation', 'off', true);
    return false;
end;
$$;


ALTER FUNCTION app.authorized_actor_context_valid(requested_profile_id uuid, requested_run_id uuid, requested_run_role text) OWNER TO app_owner;

--
-- Name: bind_owned_group_event_pool(uuid, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.bind_owned_group_event_pool(requested_event_id uuid, requested_program_address text, requested_event_pool_address text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_event record;
  selected_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  then
    raise exception using errcode = 'P0001', message = 'group event pool binding is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id
    and event.run_id = run_id_text::uuid
    and event.coach_profile_id = profile_id_text::uuid
  for update;
  if not found
    or selected_event.publication_status <> 'draft'
    or selected_event.starts_at <= pg_catalog.statement_timestamp()
  then
    raise exception using errcode = 'P0001', message = 'group event pool binding is unavailable';
  end if;

  select binding.wallet_address into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';
  if selected_wallet_address is null then
    raise exception using errcode = 'P0001', message = 'group event coach wallet is unavailable';
  end if;

  if selected_event.projection_availability <> 'unbound' then
    if selected_event.program_address = requested_program_address
      and selected_event.event_pool_address = requested_event_pool_address
      and selected_event.coach_wallet_address_snapshot = selected_wallet_address
    then
      perform pg_catalog.set_config('app.wallet_management', 'off', true);
      perform pg_catalog.set_config('app.group_event_management', 'off', true);
      return requested_event_id;
    end if;
    raise exception using errcode = 'P0001', message = 'group event already has a different pool binding';
  end if;

  update app.group_events
  set
    program_address = requested_program_address,
    event_pool_address = requested_event_pool_address,
    coach_wallet_address_snapshot = selected_wallet_address,
    projection_availability = 'pending',
    projection_status_updated_at = pg_catalog.statement_timestamp()
  where id = requested_event_id;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.bind_owned_group_event_pool(requested_event_id uuid, requested_program_address text, requested_event_pool_address text) OWNER TO app_owner;

--
-- Name: book_direct_private_session(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.book_direct_private_session(requested_slot_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.book_direct_private_session(requested_slot_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION book_direct_private_session(requested_slot_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.book_direct_private_session(requested_slot_id uuid) IS 'Historical fail-closed entry point retained for stale callers; direct booking is disabled because coach confirmation is required.';


--
-- Name: cancel_direct_private_booking(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.cancel_direct_private_booking(requested_booking_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.cancel_direct_private_booking(requested_booking_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION cancel_direct_private_booking(requested_booking_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.cancel_direct_private_booking(requested_booking_id uuid) IS 'Lets the booking client or coach idempotently cancel one future direct booking and reopen its occurrence.';


--
-- Name: close_coach_booking_request_occurrence(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.close_coach_booking_request_occurrence(requested_slot_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.close_coach_booking_request_occurrence(requested_slot_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION close_coach_booking_request_occurrence(requested_slot_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.close_coach_booking_request_occurrence(requested_slot_id uuid) IS 'Lets the owning coach withdraw one future occurrence and close its pending requests without changing the recurring rule.';


--
-- Name: close_pending_requests_for_hidden_coach(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.close_pending_requests_for_hidden_coach() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


ALTER FUNCTION app.close_pending_requests_for_hidden_coach() OWNER TO app_owner;

--
-- Name: close_pending_requests_for_withdrawn_occurrence(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.close_pending_requests_for_withdrawn_occurrence() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


ALTER FUNCTION app.close_pending_requests_for_withdrawn_occurrence() OWNER TO app_owner;

--
-- Name: coach_booking_request_eligibility(text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: FUNCTION coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone) IS 'Classifies one occurrence from PostgreSQL statement time using its future start boundary and seven-day horizon.';


--
-- Name: coach_has_publishable_primary_location(uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.coach_has_publishable_primary_location(requested_run_id uuid, requested_profile_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  matching_count integer;
begin
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select pg_catalog.count(*)::integer
  into matching_count
  from app.coach_training_locations as location
  where location.run_id = requested_run_id
    and location.profile_id = requested_profile_id
    and location.status = 'active'
    and location.is_primary
    and location.location_confirmed_at is not null
    and (
      location.selected_gym_id is null
      or exists (
        select 1
        from app.gyms as gym
        where gym.run_id = location.run_id
          and gym.id = location.selected_gym_id
          and gym.status = 'active'
      )
    );
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return matching_count = 1;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.coach_has_publishable_primary_location(requested_run_id uuid, requested_profile_id uuid) OWNER TO app_owner;

--
-- Name: coach_local_time_is_unambiguous(timestamp without time zone, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.coach_local_time_is_unambiguous(requested_local_time timestamp without time zone, requested_timezone text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.coach_local_time_is_unambiguous(requested_local_time timestamp without time zone, requested_timezone text) OWNER TO app_owner;

--
-- Name: coach_training_location_publicly_visible(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.coach_training_location_publicly_visible(requested_run_id uuid, requested_profile_id uuid, requested_gym_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  is_visible boolean;
begin
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );
  select exists (
    select 1
    from app.coach_profiles as coach
    join app.demo_runs as run on run.id = coach.run_id
    where coach.run_id = requested_run_id
      and coach.profile_id = requested_profile_id
      and coach.visibility = 'visible'
      and app.coach_trust_kind(coach.profile_id, coach.is_demo) is not null
      and run.status = 'active'
      and run.catalogue_visibility = 'public'
      and (
        requested_gym_id is null
        or exists (
          select 1
          from app.gyms as gym
          where gym.run_id = requested_run_id
            and gym.id = requested_gym_id
            and gym.status = 'active'
        )
      )
  ) into is_visible;
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return is_visible;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.coach_training_location_publicly_visible(requested_run_id uuid, requested_profile_id uuid, requested_gym_id uuid) OWNER TO app_owner;

--
-- Name: coach_trust_kind(uuid, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  application_status text;
begin
  if requested_profile_id is null or requested_is_demo is null then
    return null;
  end if;
  if requested_is_demo then
    return 'demo';
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  select application.status
  into application_status
  from app.coach_applications as application
  where application.profile_id = requested_profile_id;
  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );

  if application_status = 'approved' then
    return 'verified';
  end if;
  return null;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean) OWNER TO app_owner;

--
-- Name: FUNCTION coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean) IS 'Returns demo or verified presentation only for an actual fixture marker or current approved application.';


--
-- Name: complete_direct_private_booking(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.complete_direct_private_booking(requested_booking_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.complete_direct_private_booking(requested_booking_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION complete_direct_private_booking(requested_booking_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.complete_direct_private_booking(requested_booking_id uuid) IS 'Lets the owning coach idempotently complete one elapsed direct booking.';


--
-- Name: complete_personal_wallet_challenge(uuid, text, text, bytea, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.complete_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_message_hash bytea, requested_reauthenticated_at timestamp with time zone) RETURNS TABLE(completion_result text, binding_id uuid, binding_wallet_address text, binding_cluster text, binding_verified_at timestamp with time zone, binding_provenance text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  active_binding record;
  conflicting_binding_id uuid;
  new_binding_id uuid;
  new_binding record;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  if requested_purpose not in (
    'link-personal-wallet',
    'replace-personal-wallet'
  )
    or requested_wallet_address is null
    or pg_catalog.octet_length(requested_message_hash) <> 32
    or (
      requested_purpose = 'link-personal-wallet'
      and requested_reauthenticated_at is not null
    )
    or (
      requested_purpose = 'replace-personal-wallet'
      and (
        requested_reauthenticated_at is null
        or requested_reauthenticated_at <
          pg_catalog.statement_timestamp() - interval '10 minutes'
        or requested_reauthenticated_at >
          pg_catalog.statement_timestamp() + interval '30 seconds'
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'wallet proof request is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  new_binding_id := requested_challenge_id;
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  perform 1
  from app.auth_challenges as challenge
  where challenge.id = requested_challenge_id
    and challenge.run_id = run_id_text::uuid
    and challenge.auth_user_id = auth_user_id_text::uuid
    and challenge.profile_id = profile_id_text::uuid
    and challenge.purpose = requested_purpose
    and challenge.cluster = 'solana:devnet'
    and challenge.wallet_address = requested_wallet_address
    and challenge.message_hash = requested_message_hash
    and challenge.consumed_at is null
    and challenge.expires_at >= pg_catalog.statement_timestamp()
  for update;

  if not found then
    completion_result := 'invalid-proof';
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth_user_id_text, 47001)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat('solana:devnet:', requested_wallet_address),
      47002
    )
  );

  select binding.*
  into active_binding
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.status = 'active'
  for update;

  select binding.id
  into conflicting_binding_id
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.wallet_address = requested_wallet_address
    and binding.status = 'active'
    and (
      active_binding.id is null
      or binding.id <> active_binding.id
    )
  limit 1;

  if conflicting_binding_id is not null then
    update app.auth_challenges
    set
      consumed_at = pg_catalog.statement_timestamp(),
      consumed_result = 'wallet-conflict'
    where id = requested_challenge_id;

    completion_result := 'wallet-conflict';
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return next;
    return;
  end if;

  if (
    requested_purpose = 'link-personal-wallet'
    and active_binding.id is not null
  ) or (
    requested_purpose = 'replace-personal-wallet'
    and (
      active_binding.id is null
      or active_binding.wallet_address = requested_wallet_address
    )
  ) then
    update app.auth_challenges
    set
      consumed_at = pg_catalog.statement_timestamp(),
      consumed_result = 'state-conflict'
    where id = requested_challenge_id;

    completion_result := 'state-conflict';
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return next;
    return;
  end if;

  if requested_purpose = 'replace-personal-wallet' then
    update app.wallet_bindings
    set
      status = 'revoked',
      revoked_at = pg_catalog.statement_timestamp(),
      reauthenticated_at = requested_reauthenticated_at,
      revocation_reason = 'replaced',
      replacement_binding_id = new_binding_id
    where id = active_binding.id;
  end if;

  insert into app.wallet_bindings (
    id,
    run_id,
    cluster,
    wallet_address,
    profile_id,
    bound_by_auth_user_id,
    provenance,
    status,
    verified_at,
    revoked_at,
    verified_by_challenge_id,
    reauthenticated_at,
    revocation_reason,
    replacement_binding_id
  )
  values (
    new_binding_id,
    run_id_text::uuid,
    'solana:devnet',
    requested_wallet_address,
    profile_id_text::uuid,
    auth_user_id_text::uuid,
    'user-proof',
    'active',
    pg_catalog.statement_timestamp(),
    null,
    requested_challenge_id,
    requested_reauthenticated_at,
    null,
    null
  )
  returning * into new_binding;

  update app.auth_challenges
  set
    consumed_at = pg_catalog.statement_timestamp(),
    consumed_result = case
      when requested_purpose = 'replace-personal-wallet' then 'replaced'
      else 'linked'
    end
  where id = requested_challenge_id;

  completion_result := case
    when requested_purpose = 'replace-personal-wallet' then 'replaced'
    else 'linked'
  end;
  binding_id := new_binding.id;
  binding_wallet_address := new_binding.wallet_address;
  binding_cluster := new_binding.cluster;
  binding_verified_at := new_binding.verified_at;
  binding_provenance := new_binding.provenance;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return next;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.complete_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_message_hash bytea, requested_reauthenticated_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: connection_access_flags(boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.connection_access_flags(enabled boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare flag text;
begin
  foreach flag in array array[
    'app.coach_connection_management', 'app.coach_profile_management',
    'app.coach_application_management', 'app.coach_booking_management',
    'app.coach_availability_management',
    'app.coach_booking_request_management', 'app.profile_media_management'
  ] loop
    perform pg_catalog.set_config(flag, case when enabled then 'on' else 'off' end, true);
  end loop;
end;
$$;


ALTER FUNCTION app.connection_access_flags(enabled boolean) OWNER TO app_owner;

--
-- Name: connection_attempt_projection(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.connection_attempt_projection(requested_id uuid) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id', attempt.id, 'pairId', pair.id, 'attemptNumber', attempt.attempt_number,
    'coachProfileId', pair.coach_profile_id, 'athleteProfileId', pair.athlete_profile_id,
    'senderProfileId', attempt.sender_profile_id, 'recipientProfileId', attempt.recipient_profile_id,
    'status', attempt.status, 'createdAt', attempt.created_at, 'updatedAt', attempt.updated_at,
    'decidedAt', attempt.decided_at, 'removedAt', attempt.removed_at,
    'coachDisplayName', coach.display_name, 'athleteDisplayName', athlete.display_name,
    'coachSlug', coach.public_slug,
    'coachPublic', coalesce(coach.visibility = 'visible' and (coach.is_demo or application.status = 'approved') and app.coach_has_publishable_primary_location(coach.run_id, coach.profile_id), false),
    'coachPortrait', case when coach.visibility = 'visible' and (coach.is_demo or application.status = 'approved') and app.coach_has_publishable_primary_location(coach.run_id, coach.profile_id)
      then jsonb_build_object('source', coach.portrait_source, 'path', coach.portrait_path, 'updatedAt', coach.portrait_updated_at)
      else null end,
    'athleteAvatarUpdatedAt', case when attempt.status = 'accepted'
      and pair.coach_profile_id::text = current_setting('app.current_profile_id', true)
      then athlete.avatar_updated_at else null end,
    'canAccept', attempt.status = 'pending' and attempt.recipient_profile_id::text = current_setting('app.current_profile_id', true)
      and app.connection_pair_eligible(pair),
    'canDecline', attempt.status = 'pending' and attempt.recipient_profile_id::text = current_setting('app.current_profile_id', true),
    'canWithdraw', attempt.status = 'pending' and attempt.sender_profile_id::text = current_setting('app.current_profile_id', true),
    'canDisconnect', attempt.status = 'accepted'
  )
  from app.coach_athlete_connection_attempts attempt
  join app.coach_athlete_connection_pairs pair on pair.id = attempt.pair_id
  join app.coach_profiles coach on coach.run_id = pair.run_id and coach.profile_id = pair.coach_profile_id
  join app.profiles athlete on athlete.id = pair.athlete_profile_id
  left join app.coach_applications application on application.profile_id = coach.profile_id
  where attempt.id = requested_id and pair.run_id::text = current_setting('app.current_run_id', true)
    and current_setting('app.current_profile_id', true)::uuid in (pair.coach_profile_id, pair.athlete_profile_id)
$$;


ALTER FUNCTION app.connection_attempt_projection(requested_id uuid) OWNER TO app_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: coach_athlete_connection_pairs; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_athlete_connection_pairs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    athlete_profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    CONSTRAINT coach_athlete_connection_pairs_check CHECK ((coach_profile_id <> athlete_profile_id))
);

ALTER TABLE ONLY app.coach_athlete_connection_pairs FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_athlete_connection_pairs OWNER TO app_owner;

--
-- Name: connection_pair_eligible(app.coach_athlete_connection_pairs); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.connection_pair_eligible(requested_pair app.coach_athlete_connection_pairs) RETURNS boolean
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from app.coach_profiles coach
    join app.profiles coach_account on coach_account.id = coach.profile_id
    join app.demo_run_participants coach_member on coach_member.run_id = coach.run_id
      and coach_member.profile_id = coach.profile_id and coach_member.status = 'active'
    join app.demo_run_participants athlete_member on athlete_member.run_id = coach.run_id
      and athlete_member.profile_id = requested_pair.athlete_profile_id and athlete_member.status = 'active'
    join app.profiles athlete on athlete.id = athlete_member.profile_id
    left join app.coach_applications application on application.profile_id = coach.profile_id
    where coach.run_id = requested_pair.run_id and coach.profile_id = requested_pair.coach_profile_id
      and (coach.is_demo or application.status = 'approved')
      and coach_account.auth_user_id is not null and athlete.auth_user_id is not null
      and exists (
        select 1 from app.coach_private_bookings booking
        where booking.run_id = requested_pair.run_id
          and booking.coach_profile_id = requested_pair.coach_profile_id
          and booking.client_profile_id = requested_pair.athlete_profile_id
          and booking.credit_projection_id is null and booking.status in ('confirmed', 'completed')
      )
  )
$$;


ALTER FUNCTION app.connection_pair_eligible(requested_pair app.coach_athlete_connection_pairs) OWNER TO app_owner;

--
-- Name: create_coach_booking_request(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.create_coach_booking_request(requested_slot_id uuid) RETURNS TABLE(request_id uuid, request_status text, booking_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.create_coach_booking_request(requested_slot_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION create_coach_booking_request(requested_slot_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.create_coach_booking_request(requested_slot_id uuid) IS 'Creates or recovers one actor-owned pending request without holding the occurrence.';


--
-- Name: create_owned_coach_availability(timestamp without time zone, integer); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer) OWNER TO app_owner;

--
-- Name: FUNCTION create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer) IS 'Creates one owner-scoped open slot by interpreting local wall time in the coach profile timezone.';


--
-- Name: create_owned_coach_availability_rule(uuid, timestamp with time zone, smallint, time without time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.create_owned_coach_availability_rule(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_iso_weekday smallint, requested_local_start_time time without time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.create_owned_coach_availability_rule(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_iso_weekday smallint, requested_local_start_time time without time zone) OWNER TO app_owner;

--
-- Name: create_owned_coach_post(text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.create_owned_coach_post(requested_body text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor_profile_id uuid;
  actor_run_id uuid;
  normalized_body text;
  selected_post_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach post actor context is invalid';
  end if;

  actor_profile_id := pg_catalog.current_setting(
    'app.current_profile_id', true
  )::uuid;
  actor_run_id := pg_catalog.current_setting('app.current_run_id', true)::uuid;
  normalized_body := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      coalesce(requested_body, ''),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  if pg_catalog.char_length(normalized_body) not between 1 and 500 then
    raise exception using
      errcode = 'P0001',
      message = 'coach post body is invalid';
  end if;

  perform pg_catalog.set_config('app.coach_social_management', 'on', true);

  if not exists (
    select 1
    from app.coach_profiles as coach
    where coach.run_id = actor_run_id
      and coach.profile_id = actor_profile_id
      and coach.visibility = 'visible'
      and coach.record_source = 'user'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach post owner is unavailable';
  end if;

  insert into app.coach_posts (
    run_id,
    coach_profile_id,
    body,
    visibility,
    record_source
  )
  values (
    actor_run_id,
    actor_profile_id,
    normalized_body,
    'visible',
    'user'
  )
  returning id into selected_post_id;

  perform pg_catalog.set_config('app.coach_social_management', 'off', true);
  return selected_post_id;
exception
  when others then
    perform pg_catalog.set_config('app.coach_social_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.create_owned_coach_post(requested_body text) OWNER TO app_owner;

--
-- Name: create_owned_coach_training_location(text, uuid, text, numeric, numeric, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach app.coach_profiles%rowtype;
  selected_gym app.gyms%rowtype;
  normalized_public_name text;
  normalized_location_label text;
  resolved_public_name text;
  resolved_location_kind text;
  resolved_location_label text;
  resolved_latitude numeric(9, 6);
  resolved_longitude numeric(9, 6);
  resolved_location_source text;
  resolved_location_provider text;
  next_sort_order integer;
  created_location_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  normalized_public_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_public_name, '[[:space:]]+', ' ', 'g')
  );
  normalized_location_label := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_public_location_label,
      '[[:space:]]+',
      ' ',
      'g'
    )
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
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location owner is unavailable';
  end if;

  if requested_gym_id is not null then
    select gym.*
    into selected_gym
    from app.gyms as gym
    where gym.run_id = run_id_text::uuid
      and gym.id = requested_gym_id
      and gym.status = 'active';

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location gym is unavailable';
    end if;

    resolved_public_name := selected_gym.name;
    resolved_location_kind := 'gym';
    resolved_location_label := selected_gym.public_location_label;
    resolved_latitude := selected_gym.latitude;
    resolved_longitude := selected_gym.longitude;
    resolved_location_source := selected_gym.location_source;
    resolved_location_provider := selected_gym.location_provider;
  else
    if normalized_public_name is null
      or pg_catalog.char_length(normalized_public_name) not between 2 and 240
      or normalized_public_name ~ '[[:cntrl:]]'
      or normalized_location_label is null
      or pg_catalog.char_length(normalized_location_label) not between 2 and 240
      or normalized_location_label ~ '[[:cntrl:]]'
      or requested_latitude is null
      or requested_latitude not between -90 and 90
      or requested_longitude is null
      or requested_longitude not between -180 and 180
      or requested_location_source not in ('manual', 'permanent-geocoding')
      or (
        requested_location_source = 'manual'
        and requested_location_provider is not null
      )
      or (
        requested_location_source = 'permanent-geocoding'
        and (
          requested_location_provider is null
          or pg_catalog.char_length(requested_location_provider)
            not between 2 and 40
          or requested_location_provider !~ '^[a-z0-9-]+$'
        )
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location details are invalid';
    end if;

    resolved_public_name := normalized_public_name;
    resolved_location_kind := 'independent';
    resolved_location_label := normalized_location_label;
    resolved_latitude := requested_latitude;
    resolved_longitude := requested_longitude;
    resolved_location_source := requested_location_source;
    resolved_location_provider := requested_location_provider;
  end if;

  select coalesce(pg_catalog.max(location.sort_order), 0) + 1
  into next_sort_order
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid;

  if next_sort_order > 32767 then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location limit is reached';
  end if;

  insert into app.coach_training_locations (
    run_id,
    profile_id,
    public_name,
    timezone,
    selected_gym_id,
    location_kind,
    public_location_label,
    latitude,
    longitude,
    location_source,
    location_provider,
    location_confirmed_at,
    status,
    is_primary,
    sort_order,
    record_source
  ) values (
    run_id_text::uuid,
    profile_id_text::uuid,
    resolved_public_name,
    selected_coach.timezone,
    requested_gym_id,
    resolved_location_kind,
    resolved_location_label,
    resolved_latitude,
    resolved_longitude,
    resolved_location_source,
    resolved_location_provider,
    pg_catalog.statement_timestamp(),
    'active',
    false,
    next_sort_order,
    'user'
  ) returning id into created_location_id;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return created_location_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) OWNER TO app_owner;

--
-- Name: FUNCTION create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) IS 'Creates one confirmed active non-primary location for the verified current coach owner.';


--
-- Name: create_owned_group_event_draft(uuid, text, text, text, timestamp with time zone, timestamp with time zone, text, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.create_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  normalized_title text;
  normalized_description text;
  selected_coach record;
  slug_prefix text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;

  normalized_title := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_title, '[[:space:]]+', ' ', 'g')
  );
  normalized_description := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_description, '[[:space:]]+', ' ', 'g')
  );
  if requested_event_id is null
    or normalized_title is null
    or pg_catalog.char_length(normalized_title) not between 3 and 120
    or normalized_title ~ '[[:cntrl:]]'
    or normalized_description is null
    or pg_catalog.char_length(normalized_description) not between 20 and 2000
    or normalized_description ~ '[[:cntrl:]]'
    or requested_discipline not in (
      'Boxing', 'Muay Thai', 'Kickboxing',
      'Brazilian Jiu-Jitsu', 'MMA', 'Wrestling'
    )
    or requested_starts_at <= pg_catalog.statement_timestamp()
    or requested_ends_at - requested_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or (
      requested_media_url is not null
      and (
        pg_catalog.char_length(requested_media_url) not between 1 and 1024
        or requested_media_url ~ '[[:space:]]'
        or not (requested_media_url ~ '^https://' or requested_media_url ~ '^/')
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'group event draft details are invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);

  select
    coach.public_slug,
    coach.display_name,
    coach.location_kind,
    coach.public_location_label,
    coach.timezone,
    coach.latitude,
    coach.longitude
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid;
  if not found then
    raise exception using errcode = 'P0001', message = 'group event coach is unavailable';
  end if;

  slug_prefix := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.lower(normalized_title),
      '[^a-z0-9]+',
      '-',
      'g'
    ),
    '-'
  );
  if slug_prefix = '' then slug_prefix := 'group-event'; end if;

  insert into app.group_events (
    id,
    run_id,
    coach_profile_id,
    public_slug,
    title,
    discipline,
    description,
    coach_slug_snapshot,
    coach_display_name_snapshot,
    location_kind_snapshot,
    location_label_snapshot,
    location_timezone_snapshot,
    latitude_snapshot,
    longitude_snapshot,
    starts_at,
    ends_at,
    media_url,
    source_proposal_id,
    record_source
  ) values (
    requested_event_id,
    run_id_text::uuid,
    profile_id_text::uuid,
    pg_catalog.concat(
      pg_catalog.left(slug_prefix, 90),
      '-',
      pg_catalog.left(
        pg_catalog.replace(requested_event_id::text, '-', ''),
        12
      )
    ),
    normalized_title,
    requested_discipline,
    normalized_description,
    selected_coach.public_slug,
    selected_coach.display_name,
    selected_coach.location_kind,
    selected_coach.public_location_label,
    selected_coach.timezone,
    selected_coach.latitude,
    selected_coach.longitude,
    requested_starts_at,
    requested_ends_at,
    requested_media_url,
    requested_source_proposal_id,
    'user'
  );

  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.create_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) OWNER TO app_owner;

--
-- Name: current_application_identity(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_application_identity(requested_auth_user_id uuid) RETURNS TABLE(identity_profile_id uuid, identity_profile_slug text, identity_display_name text, identity_run_id uuid, identity_run_slug text, identity_run_name text, identity_role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
declare
  returned_rows integer;
begin
  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);

  return query
  select
    profile.id,
    profile.slug,
    profile.display_name,
    demo_run.id,
    demo_run.slug,
    demo_run.name,
    membership.role
  from app.profiles as profile
  join app.demo_run_participants as membership
    on membership.profile_id = profile.id
  join app.demo_runs as demo_run
    on demo_run.id = membership.run_id
  where profile.auth_user_id = requested_auth_user_id
    and profile.record_source = 'user'
    and profile.claimed_at is not null
    and membership.role = 'member'
    and membership.status = 'active'
    and demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  get diagnostics returned_rows = row_count;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);

  if returned_rows > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'application identity conflicts with existing state';
  end if;
end;
$$;


ALTER FUNCTION app.current_application_identity(requested_auth_user_id uuid) OWNER TO app_owner;

--
-- Name: current_booking_connection_context(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_booking_connection_context(requested_booking_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare booking app.coach_private_bookings%rowtype; pair app.coach_athlete_connection_pairs%rowtype;
  latest app.coach_athlete_connection_attempts%rowtype; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_booking_id is null then
    raise exception 'connection context is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  select b.* into booking from app.coach_private_bookings b
    where b.id = requested_booking_id and b.run_id::text = current_setting('app.current_run_id', true)
      and b.credit_projection_id is null and b.coach_profile_id <> b.client_profile_id
      and current_setting('app.current_profile_id', true)::uuid in (b.coach_profile_id, b.client_profile_id);
  if not found then raise exception 'connection context is unavailable' using errcode = 'P0001'; end if;
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.run_id = booking.run_id and p.coach_profile_id = booking.coach_profile_id and p.athlete_profile_id = booking.client_profile_id;
  if pair.id is null then
    pair.run_id := booking.run_id; pair.coach_profile_id := booking.coach_profile_id; pair.athlete_profile_id := booking.client_profile_id;
  end if;
  select a.* into latest from app.coach_athlete_connection_attempts a where a.pair_id = pair.id order by a.attempt_number desc limit 1;
  result := jsonb_build_object('connection', app.connection_attempt_projection(latest.id),
    'canSend', coalesce(latest.status not in ('pending', 'accepted'), true) and app.connection_pair_eligible(pair));
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;


ALTER FUNCTION app.current_booking_connection_context(requested_booking_id uuid) OWNER TO app_owner;

--
-- Name: current_client_coach_booking_request(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_client_coach_booking_request(requested_request_id uuid) RETURNS TABLE(id uuid, run_id uuid, slot_id uuid, coach_profile_id uuid, coach_display_name text, coach_slug text, client_profile_id uuid, client_display_name text, status text, scheduled_start_at timestamp with time zone, scheduled_end_at timestamp with time zone, coach_timezone text, coach_training_location_id uuid, training_location_name text, location_kind text, gym_name text, public_location_label text, decision_deadline_at timestamp with time zone, decided_at timestamp with time zone, accepted_booking_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_request_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'client coach booking request selection is invalid';
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

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = pg_catalog.statement_timestamp()
  where request.id = requested_request_id
    and request.run_id = run_id_text::uuid
    and request.client_profile_id = profile_id_text::uuid
    and request.status = 'pending'
    and request.decision_deadline_at <= pg_catalog.statement_timestamp();

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
  where request.id = requested_request_id
    and request.run_id = run_id_text::uuid
    and request.client_profile_id = profile_id_text::uuid;

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


ALTER FUNCTION app.current_client_coach_booking_request(requested_request_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION current_client_coach_booking_request(requested_request_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_client_coach_booking_request(requested_request_id uuid) IS 'Returns one exact actor-owned client request and reconciles its elapsed deadline.';


--
-- Name: current_client_coach_booking_requests(integer, timestamp with time zone, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) RETURNS TABLE(id uuid, run_id uuid, slot_id uuid, coach_profile_id uuid, coach_display_name text, coach_slug text, client_profile_id uuid, client_display_name text, status text, scheduled_start_at timestamp with time zone, scheduled_end_at timestamp with time zone, coach_timezone text, coach_training_location_id uuid, training_location_name text, location_kind text, gym_name text, public_location_label text, decision_deadline_at timestamp with time zone, decided_at timestamp with time zone, accepted_booking_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) IS 'Returns one bounded actor-owned client request page and reconciles a bounded set of its elapsed deadlines.';


--
-- Name: current_client_pending_coach_booking_requests(uuid[]); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_client_pending_coach_booking_requests(requested_slot_ids uuid[]) RETURNS TABLE(id uuid, run_id uuid, slot_id uuid, coach_profile_id uuid, coach_display_name text, coach_slug text, client_profile_id uuid, client_display_name text, status text, scheduled_start_at timestamp with time zone, scheduled_end_at timestamp with time zone, coach_timezone text, coach_training_location_id uuid, training_location_name text, location_kind text, gym_name text, public_location_label text, decision_deadline_at timestamp with time zone, decided_at timestamp with time zone, accepted_booking_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_slot_ids is null
    or pg_catalog.cardinality(requested_slot_ids) not between 1 and 200
    or pg_catalog.array_position(requested_slot_ids, null) is not null
    or (
      select pg_catalog.count(distinct selected.candidate_slot_id)
      from pg_catalog.unnest(requested_slot_ids)
        as selected(candidate_slot_id)
    ) <> pg_catalog.cardinality(requested_slot_ids)
  then
    raise exception using
      errcode = 'P0001',
      message = 'client coach booking request selection is invalid';
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

  update app.coach_booking_requests as request
  set
    status = 'expired',
    decided_at = pg_catalog.statement_timestamp()
  where request.run_id = run_id_text::uuid
    and request.client_profile_id = profile_id_text::uuid
    and request.slot_id = any(requested_slot_ids)
    and request.status = 'pending'
    and request.decision_deadline_at <= pg_catalog.statement_timestamp();

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
    and request.slot_id = any(requested_slot_ids)
    and request.status = 'pending'
  order by request.created_at desc, request.id desc;

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


ALTER FUNCTION app.current_client_pending_coach_booking_requests(requested_slot_ids uuid[]) OWNER TO app_owner;

--
-- Name: FUNCTION current_client_pending_coach_booking_requests(requested_slot_ids uuid[]); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_client_pending_coach_booking_requests(requested_slot_ids uuid[]) IS 'Returns actor-owned pending requests for a bounded set of displayed occurrences and reconciles their elapsed deadlines.';


--
-- Name: current_coach_athlete_connections(text, text, integer, timestamp with time zone, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_coach_athlete_connections(requested_role text, requested_section text, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) RETURNS TABLE(projection jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_role is null or requested_role not in ('coach', 'athlete')
    or requested_section is null or requested_section not in ('incoming', 'outgoing', 'accepted', 'history')
    or requested_limit is null or requested_limit not between 1 and 51
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'connection page is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  return query select app.connection_attempt_projection(a.id)
    from app.coach_athlete_connection_attempts a join app.coach_athlete_connection_pairs p on p.id = a.pair_id
    where p.run_id::text = current_setting('app.current_run_id', true)
      and (case requested_role when 'coach' then p.coach_profile_id else p.athlete_profile_id end)::text = current_setting('app.current_profile_id', true)
      and case requested_section
        when 'incoming' then a.status = 'pending' and a.recipient_profile_id::text = current_setting('app.current_profile_id', true)
        when 'outgoing' then a.status = 'pending' and a.sender_profile_id::text = current_setting('app.current_profile_id', true)
        when 'accepted' then a.status = 'accepted' else a.status in ('declined', 'withdrawn', 'removed') end
      and (before_created_at is null or (a.created_at, a.id) < (before_created_at, before_id))
    order by a.created_at desc, a.id desc limit requested_limit;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;


ALTER FUNCTION app.current_coach_athlete_connections(requested_role text, requested_section text, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) OWNER TO app_owner;

--
-- Name: current_coach_booking_request_client_avatar_reference(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_coach_booking_request_client_avatar_reference(requested_request_id uuid) RETURNS TABLE(request_id uuid, client_profile_id uuid, avatar_storage_path text, avatar_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_request_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'booking request client avatar reference is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.profile_media_management', 'on', true);

  return query
  select
    request.id,
    request.client_profile_id,
    client.avatar_storage_path,
    client.avatar_updated_at
  from app.coach_booking_requests as request
  join app.profiles as client
    on client.id = request.client_profile_id
  where request.id = requested_request_id
    and request.run_id = run_id_text::uuid
    and request.coach_profile_id = profile_id_text::uuid
    and client.avatar_storage_path is not null
    and client.avatar_updated_at is not null;

  perform pg_catalog.set_config('app.profile_media_management', 'off', true);
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
exception
  when others then
    perform pg_catalog.set_config('app.profile_media_management', 'off', true);
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.current_coach_booking_request_client_avatar_reference(requested_request_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION current_coach_booking_request_client_avatar_reference(requested_request_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_coach_booking_request_client_avatar_reference(requested_request_id uuid) IS 'Returns one private client avatar reference only when the current actor owns the referenced booking request as coach.';


--
-- Name: current_coach_booking_request_eligibility(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_coach_booking_request_eligibility(requested_slot_id uuid) RETURNS TABLE(slot_id uuid, eligibility text, database_time timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.current_coach_booking_request_eligibility(requested_slot_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION current_coach_booking_request_eligibility(requested_slot_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_coach_booking_request_eligibility(requested_slot_id uuid) IS 'Returns one actor-safe booking-request eligibility projection without creating a request or booking.';


--
-- Name: current_confirmed_booking_client_avatar_references(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_confirmed_booking_client_avatar_references(requested_booking_id uuid DEFAULT NULL::uuid) RETURNS TABLE(booking_id uuid, client_profile_id uuid, avatar_storage_path text, avatar_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'booking client avatar projection is unauthorized';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_booking_management', 'on', true);
  perform pg_catalog.set_config('app.profile_media_management', 'on', true);

  return query
  select
    booking.id,
    booking.client_profile_id,
    client.avatar_storage_path,
    client.avatar_updated_at
  from app.coach_private_bookings as booking
  join app.profiles as client
    on client.id = booking.client_profile_id
  where booking.run_id = run_id_text::uuid
    and booking.coach_profile_id = profile_id_text::uuid
    and booking.credit_projection_id is null
    and booking.status = 'confirmed'
    and (
      requested_booking_id is null
      or booking.id = requested_booking_id
    )
    and client.avatar_storage_path is not null
    and client.avatar_updated_at is not null
  order by booking.id;

  perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
  perform pg_catalog.set_config('app.profile_media_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
    perform pg_catalog.set_config('app.profile_media_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.current_confirmed_booking_client_avatar_references(requested_booking_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION current_confirmed_booking_client_avatar_references(requested_booking_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_confirmed_booking_client_avatar_references(requested_booking_id uuid) IS 'Returns private client avatar references only to the owning coach of confirmed direct bookings.';


--
-- Name: current_connection_athlete_avatar_reference(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_connection_athlete_avatar_reference(requested_id uuid) RETURNS TABLE(athlete_profile_id uuid, avatar_storage_path text, avatar_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_id is null then
    raise exception 'connection avatar is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  return query select p.athlete_profile_id, athlete.avatar_storage_path, athlete.avatar_updated_at
    from app.coach_athlete_connection_attempts a
    join app.coach_athlete_connection_pairs p on p.id = a.pair_id
    join app.profiles athlete on athlete.id = p.athlete_profile_id
    join app.demo_run_participants member on member.run_id = p.run_id and member.profile_id = p.athlete_profile_id and member.status = 'active'
    where a.id = requested_id and a.status = 'accepted'
      and p.run_id::text = current_setting('app.current_run_id', true)
      and p.coach_profile_id::text = current_setting('app.current_profile_id', true)
      and athlete.avatar_storage_path is not null and athlete.avatar_updated_at is not null;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;


ALTER FUNCTION app.current_connection_athlete_avatar_reference(requested_id uuid) OWNER TO app_owner;

--
-- Name: current_connection_shared_history(uuid, integer, timestamp with time zone, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_connection_shared_history(requested_pair_id uuid, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) RETURNS TABLE(projection jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare pair app.coach_athlete_connection_pairs%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_pair_id is null
    or requested_limit is null or requested_limit not between 1 and 51
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'connection history is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.id = requested_pair_id and p.run_id::text = current_setting('app.current_run_id', true)
      and current_setting('app.current_profile_id', true)::uuid in (p.coach_profile_id, p.athlete_profile_id)
      and exists (select 1 from app.coach_athlete_connection_attempts a where a.pair_id = p.id and a.status = 'accepted');
  if not found then raise exception 'connection history is unavailable' using errcode = 'P0001'; end if;
  return query with history as (
    select r.id, r.created_at, r.id as request_id, b.id as booking_id,
      case when r.status = 'pending' and r.decision_deadline_at <= statement_timestamp() then 'expired' else r.status end as request_status,
      b.status as booking_status, r.scheduled_start_at, r.scheduled_end_at, r.coach_timezone,
      r.training_location_name, r.public_location_label
    from app.coach_booking_requests r
    left join app.coach_private_bookings b on b.id = r.accepted_booking_id and b.credit_projection_id is null
    where r.run_id = pair.run_id and r.coach_profile_id = pair.coach_profile_id and r.client_profile_id = pair.athlete_profile_id
    union all
    select b.id, b.created_at, null::uuid, b.id, null::text, b.status,
      b.scheduled_start_at, b.scheduled_end_at, slot.coach_timezone, coalesce(slot.training_location_name, slot.public_location_label), slot.public_location_label
    from app.coach_private_bookings b
    join app.coach_availability_slots slot on slot.run_id = b.run_id and slot.id = b.slot_id
    where b.run_id = pair.run_id and b.coach_profile_id = pair.coach_profile_id and b.client_profile_id = pair.athlete_profile_id
      and b.credit_projection_id is null
      and not exists (select 1 from app.coach_booking_requests r where r.accepted_booking_id = b.id)
  ) select jsonb_build_object(
    'id', h.id, 'requestId', h.request_id, 'bookingId', h.booking_id,
    'requestStatus', h.request_status, 'bookingStatus', h.booking_status,
    'createdAt', h.created_at, 'scheduledStartAt', h.scheduled_start_at, 'scheduledEndAt', h.scheduled_end_at,
    'coachTimezone', h.coach_timezone, 'trainingLocationName', h.training_location_name, 'publicLocationLabel', h.public_location_label
  ) from history h
    where before_created_at is null or (h.created_at, h.id) < (before_created_at, before_id)
    order by h.created_at desc, h.id desc limit requested_limit;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;


ALTER FUNCTION app.current_connection_shared_history(requested_pair_id uuid, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) OWNER TO app_owner;

--
-- Name: current_direct_private_bookings(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_direct_private_bookings() RETURNS TABLE(id uuid, run_id uuid, slot_id uuid, coach_profile_id uuid, coach_display_name text, coach_slug text, client_profile_id uuid, client_display_name text, status text, scheduled_start_at timestamp with time zone, scheduled_end_at timestamp with time zone, coach_timezone text, coach_training_location_id uuid, training_location_name text, location_kind text, gym_name text, public_location_label text, cancelled_by_profile_id uuid, cancelled_at timestamp with time zone, completed_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.current_direct_private_bookings() OWNER TO app_owner;

--
-- Name: FUNCTION current_direct_private_bookings(); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_direct_private_bookings() IS 'Returns bounded scheduling-only booking projections with immutable actual-location snapshots to the booking client or owning coach.';


--
-- Name: current_owned_coach_booking_requests(integer, timestamp with time zone, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) RETURNS TABLE(id uuid, run_id uuid, slot_id uuid, coach_profile_id uuid, coach_display_name text, coach_slug text, client_profile_id uuid, client_display_name text, client_avatar_updated_at timestamp with time zone, status text, scheduled_start_at timestamp with time zone, scheduled_end_at timestamp with time zone, coach_timezone text, coach_training_location_id uuid, training_location_name text, location_kind text, gym_name text, public_location_label text, decision_deadline_at timestamp with time zone, decided_at timestamp with time zone, accepted_booking_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  perform pg_catalog.set_config('app.profile_media_management', 'on', true);

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
    client.avatar_updated_at,
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

  perform pg_catalog.set_config('app.profile_media_management', 'off', true);
  perform pg_catalog.set_config(
    'app.coach_booking_request_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.profile_media_management', 'off', true);
    perform pg_catalog.set_config(
      'app.coach_booking_request_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) IS 'Returns one bounded owning-coach request page with opaque avatar version metadata and reconciles a bounded set of elapsed deadlines.';


--
-- Name: current_personal_wallet_binding(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_personal_wallet_binding() RETURNS TABLE(binding_id uuid, binding_wallet_address text, binding_cluster text, binding_verified_at timestamp with time zone, binding_provenance text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  return query
  select
    binding.id,
    binding.wallet_address,
    binding.cluster,
    binding.verified_at,
    binding.provenance
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.status = 'active';

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.current_personal_wallet_binding() OWNER TO app_owner;

--
-- Name: current_session_title_details(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.current_session_title_details(booking uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare b app.coach_private_bookings; flags jsonb; result jsonb; begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'message unavailable' using errcode='P0001'; end if;
 flags:=app.mail_trigger_enter();
 select * into b from app.coach_private_bookings where id=booking and run_id=current_setting('app.current_run_id',true)::uuid and credit_projection_id is null
  and current_setting('app.current_profile_id',true)::uuid in(coach_profile_id,client_profile_id);
 if b.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
 result:=app.mail_session_details(b);perform app.mail_trigger_leave(flags);return result;
end $$;


ALTER FUNCTION app.current_session_title_details(booking uuid) OWNER TO app_owner;

--
-- Name: current_storage_actor_can_read_booking_request_client_avatar(text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.current_storage_actor_can_read_booking_request_client_avatar(requested_path text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select
    requested_path is not null
    and requested_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and exists (
      select 1
      from app.coach_booking_requests as request
      join app.profiles as coach
        on coach.id = request.coach_profile_id
      join app.profiles as client
        on client.id = request.client_profile_id
      where coach.auth_user_id = auth.uid()
        and client.avatar_storage_path = requested_path
    )
$_$;


ALTER FUNCTION app.current_storage_actor_can_read_booking_request_client_avatar(requested_path text) OWNER TO postgres;

--
-- Name: FUNCTION current_storage_actor_can_read_booking_request_client_avatar(requested_path text); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.current_storage_actor_can_read_booking_request_client_avatar(requested_path text) IS 'Allows a signed-in owning coach to read a request participant current private avatar object.';


--
-- Name: current_storage_actor_can_read_confirmed_booking_client_avatar(text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select
    requested_path is not null
    and requested_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and exists (
      select 1
      from app.coach_private_bookings as booking
      join app.profiles as coach
        on coach.id = booking.coach_profile_id
      join app.profiles as client
        on client.id = booking.client_profile_id
      where coach.auth_user_id = auth.uid()
        and booking.credit_projection_id is null
        and booking.status = 'confirmed'
        and client.avatar_storage_path = requested_path
    )
$_$;


ALTER FUNCTION app.current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text) OWNER TO postgres;

--
-- Name: FUNCTION current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text); Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON FUNCTION app.current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text) IS 'Allows a signed-in owning coach to read the current private avatar object for a confirmed direct booking client.';


--
-- Name: current_storage_actor_can_read_connection_athlete_avatar(text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.current_storage_actor_can_read_connection_athlete_avatar(requested_path text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select requested_path is not null
    and requested_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and exists (
      select 1 from app.coach_athlete_connection_pairs p
      join app.coach_athlete_connection_attempts a on a.pair_id = p.id and a.status = 'accepted'
      join app.profiles coach on coach.id = p.coach_profile_id and coach.auth_user_id = auth.uid()
      join app.profiles athlete on athlete.id = p.athlete_profile_id and athlete.avatar_storage_path = requested_path
      join app.demo_run_participants cm on cm.run_id = p.run_id and cm.profile_id = p.coach_profile_id and cm.status = 'active'
      join app.demo_run_participants am on am.run_id = p.run_id and am.profile_id = p.athlete_profile_id and am.status = 'active'
      join app.demo_runs dataset on dataset.id = p.run_id and dataset.status = 'active'
    )
$_$;


ALTER FUNCTION app.current_storage_actor_can_read_connection_athlete_avatar(requested_path text) OWNER TO postgres;

--
-- Name: current_storage_coach_profile_id(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.current_storage_coach_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select profile.id
  from app.profiles as profile
  join app.coach_profiles as coach
    on coach.profile_id = profile.id
  join app.demo_runs as run
    on run.id = coach.run_id
    and run.status = 'active'
    and run.catalogue_visibility = 'public'
  left join app.coach_applications as application
    on application.profile_id = profile.id
  where profile.auth_user_id = (select auth.uid())
    and profile.claimed_at is not null
    and (
      coach.is_demo
      or application.status = 'approved'
    )
  limit 1
$$;


ALTER FUNCTION app.current_storage_coach_profile_id() OWNER TO postgres;

--
-- Name: current_storage_profile_id(); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.current_storage_profile_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select profile.id
  from app.profiles as profile
  where profile.auth_user_id = (select auth.uid())
    and profile.record_source = 'user'
    and profile.claimed_at is not null
$$;


ALTER FUNCTION app.current_storage_profile_id() OWNER TO postgres;

--
-- Name: deactivate_owned_coach_training_location(uuid, timestamp with time zone, uuid, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: FUNCTION deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone) IS 'Soft-deactivates one owned location, removes its rules, withdraws future open occurrences and atomically replaces primary when required.';


--
-- Name: decide_coach_athlete_connection(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.decide_coach_athlete_connection(requested_id uuid, requested_action text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid; attempt app.coach_athlete_connection_attempts%rowtype;
  pair app.coach_athlete_connection_pairs%rowtype; wanted text; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_id is null
    or requested_action not in ('accept', 'decline', 'withdraw', 'disconnect') or requested_action is null then
    raise exception 'connection decision is invalid' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id', true)::uuid;
  perform app.connection_access_flags(true);
  select p.* into pair from app.coach_athlete_connection_pairs p
    join app.coach_athlete_connection_attempts a on a.pair_id = p.id
    where a.id = requested_id and p.run_id::text = current_setting('app.current_run_id', true)
      and actor in (p.coach_profile_id, p.athlete_profile_id);
  if not found then raise exception 'connection decision is unavailable' using errcode = 'P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'coach-athlete-connection:' || pair.run_id::text || ':' || pair.coach_profile_id::text || ':' || pair.athlete_profile_id::text, 0));
  select a.* into attempt from app.coach_athlete_connection_attempts a where a.id = requested_id for update;
  if (requested_action in ('accept', 'decline') and actor <> attempt.recipient_profile_id)
    or (requested_action = 'withdraw' and actor <> attempt.sender_profile_id) then
    raise exception 'connection decision is unavailable' using errcode = 'P0001';
  end if;
  wanted := case requested_action when 'accept' then 'accepted' when 'decline' then 'declined'
    when 'withdraw' then 'withdrawn' else 'removed' end;
  if attempt.status = wanted then
    result := app.connection_attempt_projection(attempt.id);
    perform app.connection_access_flags(false); return result;
  end if;
  if (requested_action = 'disconnect' and attempt.status <> 'accepted')
    or (requested_action <> 'disconnect' and attempt.status <> 'pending') then
    raise exception 'connection decision conflicts with current state' using errcode = 'P0001';
  end if;
  if requested_action = 'accept' then perform app.lock_connection_eligibility(pair); end if;
  if requested_action = 'disconnect' then
    update app.coach_athlete_connection_attempts set status = 'removed',
      removed_at = statement_timestamp(), removed_by_profile_id = actor where id = requested_id;
  else
    update app.coach_athlete_connection_attempts set status = wanted,
      decided_at = statement_timestamp(), decided_by_profile_id = actor where id = requested_id;
  end if;
  result := app.connection_attempt_projection(requested_id);
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;


ALTER FUNCTION app.decide_coach_athlete_connection(requested_id uuid, requested_action text) OWNER TO app_owner;

--
-- Name: decide_owned_late_booking_cancellation(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.decide_owned_late_booking_cancellation(requested_booking_id uuid, requested_decision text) RETURNS TABLE(outcome text, operation_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  selected_operation app.coach_booking_credit_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
    or requested_decision not in ('approved', 'denied')
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation decision is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.coach_profile_id = profile_id_text::uuid
  for update;

  if not found
    or selected_booking.scheduled_start_at <= statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation decision is unavailable';
  end if;

  if selected_booking.cancellation_decision is not null then
    if selected_booking.cancellation_decision <> requested_decision then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking cancellation was already decided';
    end if;
    select operation.*
    into selected_operation
    from app.coach_booking_credit_operations as operation
    where operation.booking_id = selected_booking.id
      and operation.kind = 'return';
    return query select
      case requested_decision
        when 'approved' then 'return-prepared'
        else 'denied'
      end,
      selected_operation.id;
    return;
  end if;

  if selected_booking.status <> 'cancellation-requested' then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking has no late cancellation request';
  end if;

  update app.coach_private_bookings
  set
    status = case
      when requested_decision = 'denied' then 'denied'
      else status
    end,
    cancellation_decision = requested_decision,
    cancellation_decided_at = statement_timestamp(),
    cancellation_decided_by_profile_id = profile_id_text::uuid
  where id = selected_booking.id;

  if requested_decision = 'denied' then
    perform set_config('app.coach_booking_management', 'off', true);
    return query select 'denied'::text, null::uuid;
    return;
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = selected_booking.credit_projection_id
  for update;
  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
    and operation.status = 'finalized';

  if selected_projection.id is null or reserve_operation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized reservation is unavailable';
  end if;

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    selected_booking.run_id,
    selected_booking.id,
    selected_projection.id,
    'return',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    selected_booking.scheduled_start_at,
    selected_booking.early_return_until
  )
  returning * into selected_operation;

  perform set_config('app.coach_booking_management', 'off', true);
  return query select 'return-prepared'::text, selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.decide_owned_late_booking_cancellation(requested_booking_id uuid, requested_decision text) OWNER TO app_owner;

--
-- Name: decline_coach_booking_request(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.decline_coach_booking_request(requested_request_id uuid) RETURNS TABLE(request_id uuid, request_status text, booking_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.decline_coach_booking_request(requested_request_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION decline_coach_booking_request(requested_request_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.decline_coach_booking_request(requested_request_id uuid) IS 'Lets the owning coach idempotently decline one pending attempt without consuming capacity.';


--
-- Name: enroll_application_identity(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.enroll_application_identity(requested_auth_user_id uuid, requested_display_name text) RETURNS TABLE(identity_profile_id uuid, identity_profile_slug text, identity_display_name text, identity_run_id uuid, identity_run_slug text, identity_run_name text, identity_role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
declare
  normalized_display_name text;
  generated_slug_base text;
  generated_slug text;
  selected_run_id uuid;
  selected_profile_id uuid;
  selected_record_source text;
  returned_rows integer;
begin
  normalized_display_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_display_name, '[[:space:]]+', ' ', 'g')
  );

  if normalized_display_name is null
    or pg_catalog.char_length(normalized_display_name) not between 2 and 80
    or normalized_display_name ~ '[[:cntrl:]]'
    or normalized_display_name !~ '[[:alnum:]]'
  then
    raise exception using
      errcode = 'P0001',
      message = 'application profile details are invalid';
  end if;

  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);

  select demo_run.id
  into selected_run_id
  from app.demo_runs as demo_run
  where demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  if selected_run_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'application identity enrollment is unavailable';
  end if;

  select profile.id, profile.record_source
  into selected_profile_id, selected_record_source
  from app.profiles as profile
  where profile.auth_user_id = requested_auth_user_id;

  if selected_profile_id is null then
    generated_slug_base := pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.lower(normalized_display_name),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-'
    );
    if generated_slug_base = '' then
      generated_slug_base := 'member';
    end if;
    generated_slug := pg_catalog.concat(
      pg_catalog.btrim(pg_catalog.left(generated_slug_base, 60), '-'),
      '-',
      pg_catalog.left(
        pg_catalog.replace(requested_auth_user_id::text, '-', ''),
        12
      )
    );

    insert into app.profiles (
      auth_user_id,
      slug,
      display_name,
      initials,
      bio,
      avatar_color,
      record_source,
      claimed_at
    )
    values (
      requested_auth_user_id,
      generated_slug,
      normalized_display_name,
      pg_catalog.upper(pg_catalog.left(normalized_display_name, 2)),
      '',
      'lime',
      'user',
      pg_catalog.statement_timestamp()
    )
    on conflict (auth_user_id) do nothing;

    select profile.id, profile.record_source
    into selected_profile_id, selected_record_source
    from app.profiles as profile
    where profile.auth_user_id = requested_auth_user_id;
  end if;

  if selected_profile_id is null or selected_record_source <> 'user' then
    raise exception using
      errcode = 'P0001',
      message = 'application identity conflicts with existing state';
  end if;

  insert into app.demo_run_participants (
    run_id,
    profile_id,
    role,
    status,
    joined_at,
    revoked_at
  )
  values (
    selected_run_id,
    selected_profile_id,
    'member',
    'active',
    pg_catalog.statement_timestamp(),
    null
  )
  on conflict (run_id, profile_id) do nothing;

  return query
  select
    profile.id,
    profile.slug,
    profile.display_name,
    demo_run.id,
    demo_run.slug,
    demo_run.name,
    membership.role
  from app.profiles as profile
  join app.demo_run_participants as membership
    on membership.profile_id = profile.id
  join app.demo_runs as demo_run
    on demo_run.id = membership.run_id
  where profile.id = selected_profile_id
    and profile.auth_user_id = requested_auth_user_id
    and profile.record_source = 'user'
    and profile.claimed_at is not null
    and membership.run_id = selected_run_id
    and membership.role = 'member'
    and membership.status = 'active'
    and demo_run.status = 'active'
    and demo_run.catalogue_visibility = 'public';

  get diagnostics returned_rows = row_count;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);

  if returned_rows <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'application identity conflicts with existing state';
  end if;
end;
$$;


ALTER FUNCTION app.enroll_application_identity(requested_auth_user_id uuid, requested_display_name text) OWNER TO app_owner;

--
-- Name: fail_booking_credit_operation(uuid, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.fail_booking_credit_operation(requested_operation_id uuid, requested_status text, requested_reason text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_status not in ('failed', 'expired')
    or requested_reason not in (
      'wallet-rejected',
      'simulation-failed',
      'blockhash-expired',
      'transaction-failed',
      'state-not-observed'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation failure is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);
  perform set_config('app.coach_availability_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;
  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
  end if;

  if selected_operation.id is null
    or (
      selected_operation.kind = 'reserve'
      and selected_booking.client_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
    or selected_operation.status not in (
      'prepared',
      'submitted',
      requested_status
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation failure is unauthorized';
  end if;

  update app.coach_booking_credit_operations
  set
    status = requested_status,
    failure_code = requested_reason,
    failed_at = statement_timestamp()
  where id = selected_operation.id;

  if selected_operation.kind = 'reserve' then
    update app.coach_private_bookings
    set
      status = 'expired',
      expired_at = statement_timestamp()
    where id = selected_booking.id
      and status = 'pending';
    update app.coach_availability_slots
    set status = 'open'
    where id = selected_booking.slot_id
      and status = 'held';
  end if;

  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.fail_booking_credit_operation(requested_operation_id uuid, requested_status text, requested_reason text) OWNER TO app_owner;

--
-- Name: fail_coach_pass_purchase_operation(uuid, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.fail_coach_pass_purchase_operation(requested_operation_id uuid, requested_status text, requested_reason text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  saved_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_status not in ('failed', 'expired')
    or requested_reason not in (
      'wallet-rejected',
      'simulation-failed',
      'blockhash-expired',
      'transaction-failed',
      'state-not-observed'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase failure is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);

  update app.coach_pass_purchase_operations
  set
    status = requested_status,
    failure_code = requested_reason,
    failed_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and client_profile_id = profile_id_text::uuid
    and status in ('prepared', 'submitted', requested_status)
  returning id into saved_id;
  if saved_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase failure is unauthorized';
  end if;

  perform set_config('app.coach_pass_management', 'off', true);
  return saved_id;
exception
  when others then
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.fail_coach_pass_purchase_operation(requested_operation_id uuid, requested_status text, requested_reason text) OWNER TO app_owner;

--
-- Name: fail_group_event_operation(uuid, text, text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.fail_group_event_operation(requested_operation_id uuid, requested_status text, requested_failure_code text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_status not in ('failed', 'expired')
    or requested_failure_code not in (
      'wallet-rejected',
      'simulation-failed',
      'blockhash-expired',
      'transaction-failed',
      'state-not-observed'
    )
  then
    raise exception using errcode = 'P0001', message = 'group event failure is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  update app.group_event_chain_operations
  set
    status = requested_status,
    failure_code = requested_failure_code,
    failed_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and actor_profile_id = profile_id_text::uuid
    and status in ('prepared', 'submitted');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event failure conflicts';
  end if;
  perform set_config('app.group_event_operation_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.group_event_operation_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.fail_group_event_operation(requested_operation_id uuid, requested_status text, requested_failure_code text) OWNER TO postgres;

--
-- Name: finalize_coach_pass_purchase_operation(uuid, text, bigint, bigint, bigint, bigint, bigint, bigint); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.finalize_coach_pass_purchase_operation(requested_operation_id uuid, verified_transaction_signature text, verified_available bigint, verified_reserved bigint, verified_total bigint, verified_purchase_count bigint, verified_next_nonce bigint, verified_observed_slot bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_pass_purchase_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or verified_transaction_signature
      !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_available not between 0 and 9000000000000000
    or verified_reserved not between 0 and 9000000000000000
    or verified_total not between 0 and 9000000000000000
    or verified_available + verified_reserved > verified_total
    or verified_purchase_count < 1
    or verified_next_nonce < 1
    or verified_observed_slot < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase evidence is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_pass_purchase_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.client_profile_id = profile_id_text::uuid
  for update;

  if selected_operation.id is null
    or selected_operation.status not in ('prepared', 'submitted', 'finalized')
    or (
      selected_operation.transaction_signature is not null
      and selected_operation.transaction_signature
        <> verified_transaction_signature
    )
    or verified_available
      <> selected_operation.baseline_available_credits
        + selected_operation.credits_purchased
    or verified_reserved <> selected_operation.baseline_reserved_credits
    or verified_total
      <> selected_operation.baseline_total_purchased
        + selected_operation.credits_purchased
    or verified_purchase_count
      <> selected_operation.baseline_purchase_count + 1
    or verified_next_nonce <> selected_operation.expected_purchase_nonce + 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase evidence conflicts with preparation';
  end if;

  if selected_operation.status = 'finalized' then
    if selected_operation.observed_available_credits <> verified_available
      or selected_operation.observed_reserved_credits <> verified_reserved
      or selected_operation.observed_total_purchased <> verified_total
      or selected_operation.observed_purchase_count <> verified_purchase_count
      or selected_operation.observed_next_purchase_nonce <> verified_next_nonce
      or selected_operation.observed_slot <> verified_observed_slot
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach pass purchase retry conflicts with evidence';
    end if;
    perform set_config('app.coach_pass_management', 'off', true);
    return selected_operation.id;
  end if;

  update app.coach_pass_purchase_operations
  set
    status = 'finalized',
    transaction_signature = verified_transaction_signature,
    submitted_at = coalesce(submitted_at, statement_timestamp()),
    observed_available_credits = verified_available,
    observed_reserved_credits = verified_reserved,
    observed_total_purchased = verified_total,
    observed_purchase_count = verified_purchase_count,
    observed_next_purchase_nonce = verified_next_nonce,
    observed_slot = verified_observed_slot,
    finalized_at = statement_timestamp(),
    failure_code = null,
    failed_at = null
  where id = selected_operation.id;

  perform set_config('app.coach_pass_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.finalize_coach_pass_purchase_operation(requested_operation_id uuid, verified_transaction_signature text, verified_available bigint, verified_reserved bigint, verified_total bigint, verified_purchase_count bigint, verified_next_nonce bigint, verified_observed_slot bigint) OWNER TO app_owner;

--
-- Name: finalize_group_event_operation(uuid, bigint); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.finalize_group_event_operation(requested_operation_id uuid, requested_observed_slot bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_observed_slot < 0
  then
    raise exception using errcode = 'P0001', message = 'group event finalization is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  update app.group_event_chain_operations
  set
    status = 'finalized',
    observed_slot = requested_observed_slot,
    finalized_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and actor_profile_id = profile_id_text::uuid
    and status = 'submitted'
    and transaction_signature is not null;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event finalization conflicts';
  end if;
  perform set_config('app.group_event_operation_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.group_event_operation_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.finalize_group_event_operation(requested_operation_id uuid, requested_observed_slot bigint) OWNER TO postgres;

--
-- Name: finalize_verified_booking_credit_operation(uuid, text, text, text, text, text, uuid, bigint, bigint, text, bigint, bigint, bigint, text, bigint); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  selected_slot app.coach_availability_slots%rowtype;
  expected_reservation_status text;
  expected_start_seconds bigint;
  expected_cutoff_seconds bigint;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or verified_booking_id is null
    or verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_client_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_credits_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_reservation_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_reservation_status not in ('reserved', 'returned', 'consumed')
    or verified_scheduled_start_unix_seconds <= 0
    or verified_early_return_until_unix_seconds
      > verified_scheduled_start_unix_seconds
    or verified_available_credits not between 0 and 9000000000000000
    or verified_reserved_credits not between 0 and 9000000000000000
    or verified_total_purchased not between 0 and 9000000000000000
    or verified_available_credits + verified_reserved_credits
      > verified_total_purchased
    or verified_observed_slot < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized evidence is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;

  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
    select projection.*
    into selected_projection
    from app.coach_client_credit_projections as projection
    where projection.id = selected_operation.credit_projection_id
      and projection.run_id = selected_operation.run_id
    for update;
    select slot.*
    into selected_slot
    from app.coach_availability_slots as slot
    where slot.id = selected_booking.slot_id
      and slot.run_id = selected_booking.run_id
    for update;
  end if;

  if not found
    or (
      selected_operation.kind = 'reserve'
      and selected_booking.client_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized evidence is unauthorized';
  end if;

  expected_reservation_status := case selected_operation.kind
    when 'reserve' then 'reserved'
    when 'return' then 'returned'
    when 'consume' then 'consumed'
  end;
  expected_start_seconds := extract(
    epoch from selected_operation.scheduled_start_at
  )::bigint;
  expected_cutoff_seconds := extract(
    epoch from selected_operation.early_return_until
  )::bigint;

  if selected_operation.program_address <> verified_program_address
    or selected_operation.coach_authority_address
      <> verified_coach_authority_address
    or selected_operation.client_wallet_address
      <> verified_client_wallet_address
    or selected_operation.coach_client_credits_address
      <> verified_credits_address
    or selected_operation.credit_reservation_address
      <> verified_reservation_address
    or selected_operation.booking_id <> verified_booking_id
    or expected_start_seconds <> verified_scheduled_start_unix_seconds
    or expected_cutoff_seconds <> verified_early_return_until_unix_seconds
    or expected_reservation_status <> verified_reservation_status
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized evidence does not match preparation';
  end if;

  if selected_operation.status = 'finalized' then
    if selected_operation.transaction_signature <> verified_transaction_signature
      or selected_operation.observed_reservation_status
        <> verified_reservation_status
      or selected_operation.observed_available_credits
        <> verified_available_credits
      or selected_operation.observed_reserved_credits
        <> verified_reserved_credits
      or selected_operation.observed_total_purchased
        <> verified_total_purchased
      or selected_operation.observed_slot <> verified_observed_slot
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking finalized retry conflicts with evidence';
    end if;
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;

  if selected_operation.status not in ('prepared', 'submitted')
    or (
      selected_operation.transaction_signature is not null
      and selected_operation.transaction_signature
        <> verified_transaction_signature
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation cannot be finalized';
  end if;

  if selected_operation.kind = 'reserve'
    and (
      selected_booking.status <> 'pending'
      or selected_slot.status <> 'held'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking reserve state conflicts with evidence';
  elsif selected_operation.kind = 'return'
    and (
      selected_booking.status not in ('confirmed', 'cancellation-requested')
      or (
        selected_booking.status = 'cancellation-requested'
        and selected_booking.cancellation_decision <> 'approved'
      )
      or selected_slot.status <> 'booked'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking return state conflicts with evidence';
  elsif selected_operation.kind = 'consume'
    and (
      selected_booking.status not in ('confirmed', 'denied')
      or selected_booking.scheduled_start_at > statement_timestamp()
      or selected_slot.status <> 'booked'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking consume state conflicts with evidence';
  end if;

  if verified_observed_slot > selected_projection.observed_slot
    and verified_total_purchased < selected_projection.total_purchased
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking projection would move purchase totals backward';
  end if;
  if verified_observed_slot = selected_projection.observed_slot
    and (
      verified_available_credits <> selected_projection.available_credits
      or verified_reserved_credits <> selected_projection.reserved_credits
      or verified_total_purchased <> selected_projection.total_purchased
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking equal-slot evidence conflicts with projection';
  end if;

  update app.coach_booking_credit_operations
  set
    status = 'finalized',
    transaction_signature = verified_transaction_signature,
    submitted_at = coalesce(submitted_at, statement_timestamp()),
    observed_reservation_status = verified_reservation_status,
    observed_available_credits = verified_available_credits,
    observed_reserved_credits = verified_reserved_credits,
    observed_total_purchased = verified_total_purchased,
    observed_slot = verified_observed_slot,
    finalized_at = statement_timestamp()
  where id = selected_operation.id;

  if verified_observed_slot > selected_projection.observed_slot then
    update app.coach_client_credit_projections
    set
      available_credits = verified_available_credits,
      reserved_credits = verified_reserved_credits,
      total_purchased = verified_total_purchased,
      transaction_signature = verified_transaction_signature,
      observed_slot = verified_observed_slot
    where id = selected_projection.id;
  end if;

  if selected_operation.kind = 'reserve' then
    update app.coach_private_bookings
    set status = 'confirmed'
    where id = selected_booking.id;
    update app.coach_availability_slots
    set status = 'booked'
    where id = selected_booking.slot_id;
  elsif selected_operation.kind = 'return' then
    update app.coach_private_bookings
    set
      status = 'cancelled',
      cancelled_at = statement_timestamp()
    where id = selected_booking.id;
    update app.coach_availability_slots
    set status = 'open'
    where id = selected_booking.slot_id;
  elsif selected_booking.status = 'confirmed' then
    update app.coach_private_bookings
    set
      status = 'completed',
      completed_at = statement_timestamp()
    where id = selected_booking.id;
  end if;

  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_booking.id;
exception
  when others then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint) OWNER TO app_owner;

--
-- Name: FUNCTION finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint) IS 'Persists evidence already verified by the trusted server adapter; this function does not query Solana.';


--
-- Name: group_coach_enabled(uuid, uuid, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_coach_enabled(dataset uuid, coach uuid, require_visible boolean DEFAULT true) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id = p.profile_id
    where p.run_id = dataset and p.profile_id = coach and (p.is_demo or a.status = 'approved') and (not require_visible or p.visibility = 'visible'));
$$;


ALTER FUNCTION app.group_coach_enabled(dataset uuid, coach uuid, require_visible boolean) OWNER TO app_owner;

--
-- Name: group_lock_coach(uuid, uuid, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_lock_coach(dataset uuid, coach uuid, require_visible boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare demo boolean;
begin
  select is_demo into demo from app.coach_profiles where run_id = dataset and profile_id = coach;
  if demo is not true then
    perform 1 from app.coach_applications where profile_id = coach and status = 'approved' for share;
    if not found then raise exception 'group coach is unavailable' using errcode = 'P0001'; end if;
  end if;
  perform 1 from app.coach_profiles where run_id = dataset and profile_id = coach and (not require_visible or visibility = 'visible') for share;
  if not found then raise exception 'group coach is unavailable' using errcode = 'P0001'; end if;
end;
$$;


ALTER FUNCTION app.group_lock_coach(dataset uuid, coach uuid, require_visible boolean) OWNER TO app_owner;

--
-- Name: group_page(jsonb, integer); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_page(entries jsonb, page_size integer) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select jsonb_build_object('items',coalesce((select jsonb_agg(value->'item' order by ordinality) from jsonb_array_elements(coalesce(entries,'[]')) with ordinality where ordinality <= page_size),'[]'),
    'nextCursor',case when jsonb_array_length(coalesce(entries,'[]')) > page_size then entries->(page_size - 1)->'cursor' else null end);
$$;


ALTER FUNCTION app.group_page(entries jsonb, page_size integer) OWNER TO app_owner;

--
-- Name: coach_group_sessions; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_group_sessions (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    discipline text NOT NULL,
    intended_level text NOT NULL,
    training_location_id uuid NOT NULL,
    venue_snapshot jsonb NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    decision_deadline_at timestamp with time zone NOT NULL,
    minimum_participants smallint NOT NULL,
    maximum_participants smallint NOT NULL,
    price_cents integer NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    published_at timestamp with time zone,
    confirmed_at timestamp with time zone,
    confirmed_by_profile_id uuid,
    closed_at timestamp with time zone,
    closed_by_profile_id uuid,
    published_from_revision integer,
    CONSTRAINT coach_group_sessions_check CHECK (((jsonb_typeof(venue_snapshot) = 'object'::text) AND (venue_snapshot ?& ARRAY['id'::text, 'name'::text, 'label'::text, 'kind'::text, 'latitude'::text, 'longitude'::text]) AND (jsonb_typeof((venue_snapshot -> 'id'::text)) = 'string'::text) AND (jsonb_typeof((venue_snapshot -> 'name'::text)) = 'string'::text) AND (jsonb_typeof((venue_snapshot -> 'label'::text)) = 'string'::text) AND (jsonb_typeof((venue_snapshot -> 'kind'::text)) = 'string'::text) AND ((venue_snapshot ->> 'id'::text) = (training_location_id)::text) AND ((char_length((venue_snapshot ->> 'name'::text)) >= 2) AND (char_length((venue_snapshot ->> 'name'::text)) <= 240)) AND ((char_length((venue_snapshot ->> 'label'::text)) >= 2) AND (char_length((venue_snapshot ->> 'label'::text)) <= 240)) AND ((venue_snapshot ->> 'kind'::text) = ANY (ARRAY['gym'::text, 'independent'::text])) AND (jsonb_typeof((venue_snapshot -> 'latitude'::text)) = 'number'::text) AND (jsonb_typeof((venue_snapshot -> 'longitude'::text)) = 'number'::text) AND ((((venue_snapshot ->> 'latitude'::text))::numeric >= ('-90'::integer)::numeric) AND (((venue_snapshot ->> 'latitude'::text))::numeric <= (90)::numeric)) AND ((((venue_snapshot ->> 'longitude'::text))::numeric >= ('-180'::integer)::numeric) AND (((venue_snapshot ->> 'longitude'::text))::numeric <= (180)::numeric)))),
    CONSTRAINT coach_group_sessions_check1 CHECK ((slug = ('group-'::text || replace((id)::text, '-'::text, ''::text)))),
    CONSTRAINT coach_group_sessions_check10 CHECK (((status <> ALL (ARRAY['draft'::text, 'open'::text, 'not-confirmed'::text])) OR (confirmed_at IS NULL))),
    CONSTRAINT coach_group_sessions_check11 CHECK (((status = ANY (ARRAY['cancelled'::text, 'not-confirmed'::text])) = (closed_at IS NOT NULL))),
    CONSTRAINT coach_group_sessions_check12 CHECK ((((status = 'cancelled'::text) AND (closed_by_profile_id = coach_profile_id)) OR ((status <> 'cancelled'::text) AND (closed_by_profile_id IS NULL)))),
    CONSTRAINT coach_group_sessions_check2 CHECK (((ends_at > starts_at) AND (((starts_at AT TIME ZONE 'Europe/Berlin'::text))::date = ((ends_at AT TIME ZONE 'Europe/Berlin'::text))::date))),
    CONSTRAINT coach_group_sessions_check3 CHECK ((decision_deadline_at < starts_at)),
    CONSTRAINT coach_group_sessions_check4 CHECK (((1 <= minimum_participants) AND (minimum_participants <= maximum_participants) AND (maximum_participants <= 100))),
    CONSTRAINT coach_group_sessions_check5 CHECK (((status = 'draft'::text) = (published_at IS NULL))),
    CONSTRAINT coach_group_sessions_check6 CHECK (((published_at IS NULL) OR (published_at < decision_deadline_at))),
    CONSTRAINT coach_group_sessions_check7 CHECK (((confirmed_at IS NULL) = (confirmed_by_profile_id IS NULL))),
    CONSTRAINT coach_group_sessions_check8 CHECK (((confirmed_at IS NULL) OR ((confirmed_by_profile_id = coach_profile_id) AND (confirmed_at < decision_deadline_at)))),
    CONSTRAINT coach_group_sessions_check9 CHECK (((status <> 'confirmed'::text) OR (confirmed_at IS NOT NULL))),
    CONSTRAINT coach_group_sessions_currency_check CHECK ((currency = 'EUR'::text)),
    CONSTRAINT coach_group_sessions_decision_deadline_at_check CHECK (isfinite(decision_deadline_at)),
    CONSTRAINT coach_group_sessions_description_check CHECK ((char_length(description) <= 2000)),
    CONSTRAINT coach_group_sessions_discipline_check CHECK ((discipline = ANY (ARRAY['Boxing'::text, 'Muay Thai'::text, 'Kickboxing'::text, 'Brazilian Jiu-Jitsu'::text, 'MMA'::text, 'Wrestling'::text]))),
    CONSTRAINT coach_group_sessions_ends_at_check CHECK (isfinite(ends_at)),
    CONSTRAINT coach_group_sessions_intended_level_check CHECK (((char_length(intended_level) >= 1) AND (char_length(intended_level) <= 80))),
    CONSTRAINT coach_group_sessions_price_cents_check CHECK ((price_cents >= 0)),
    CONSTRAINT coach_group_sessions_published_from_revision_check CHECK (((published_from_revision IS NULL) OR (published_from_revision >= 1))),
    CONSTRAINT coach_group_sessions_revision_check CHECK ((revision >= 1)),
    CONSTRAINT coach_group_sessions_starts_at_check CHECK (isfinite(starts_at)),
    CONSTRAINT coach_group_sessions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'confirmed'::text, 'cancelled'::text, 'not-confirmed'::text]))),
    CONSTRAINT coach_group_sessions_title_check CHECK ((((char_length(title) >= 3) AND (char_length(title) <= 120)) AND (title = btrim(title))))
);

ALTER TABLE ONLY app.coach_group_sessions FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_group_sessions OWNER TO app_owner;

--
-- Name: group_reconcile_session(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_reconcile_session(requested_id uuid) RETURNS app.coach_group_sessions
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare activity app.coach_group_sessions; checked_at timestamptz;
begin
  select * into activity from app.coach_group_sessions where id = requested_id for update;
  if not found then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
  checked_at := clock_timestamp();
  if activity.status = 'open' and activity.decision_deadline_at <= checked_at then
    update app.coach_group_sessions set status = 'not-confirmed',closed_at = checked_at,updated_at = checked_at,revision = revision + 1 where id = requested_id returning * into activity;
    update app.coach_group_registrations set status = 'session-not-confirmed',resolved_at = checked_at where session_id = requested_id and status = 'active';
  end if;
  return activity;
end;
$$;


ALTER FUNCTION app.group_reconcile_session(requested_id uuid) OWNER TO app_owner;

--
-- Name: group_registration_projection(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_registration_projection(requested_id uuid) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select jsonb_build_object('id',r.id,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at,
    'canWithdraw',r.status = 'active' and s.starts_at > clock_timestamp())
  from app.coach_group_registrations r join app.coach_group_sessions s on s.id = r.session_id where r.id = requested_id;
$$;


ALTER FUNCTION app.group_registration_projection(requested_id uuid) OWNER TO app_owner;

--
-- Name: group_schedule_lock(uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_schedule_lock(dataset uuid, coach uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if dataset is null or coach is null then raise exception 'coach schedule scope is invalid' using errcode = 'P0001'; end if;
  -- Same key as existing recurrence/location/rule operations. Row triggers can
  -- enter after a row lock: never wait here and invert that established order.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(pg_catalog.concat(dataset::text,':',coach::text),0)) then
    raise exception 'coach schedule changed; retry operation' using errcode = '40001';
  end if;
end;
$$;


ALTER FUNCTION app.group_schedule_lock(dataset uuid, coach uuid) OWNER TO app_owner;

--
-- Name: group_session_command(text, jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_session_command(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions; registration app.coach_group_registrations;
  location app.coach_training_locations; requested_id uuid; expected_revision integer; checked_at timestamptz; entries jsonb; result jsonb;
  after_at timestamptz; after_id uuid; candidate uuid; proposed app.coach_group_sessions;
begin
  if not app.authorized_actor_context_valid(null,null,null) or jsonb_typeof(args) is distinct from 'object' or pg_column_size(args) > 16384 then
    raise exception 'group operation is unavailable' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id',true)::uuid;
  dataset := current_setting('app.current_run_id',true)::uuid;
  perform app.group_session_flags(true);
  requested_id := (args->>'id')::uuid;
  after_at := (args->'after'->>'at')::timestamptz; after_id := (args->'after'->>'id')::uuid;
  if (after_at is null) <> (after_id is null) or (after_at is not null and not isfinite(after_at)) then raise exception 'group cursor is invalid' using errcode = 'P0001'; end if;

  if action = 'save-draft' then
    if requested_id is null then raise exception 'group draft identity is required' using errcode = 'P0001'; end if;
    perform app.group_lock_coach(dataset,actor,false);
    select * into location from app.coach_training_locations where id = (args->>'locationId')::uuid and run_id = dataset and profile_id = actor and status = 'active' for share;
    if not found then raise exception 'group location is unavailable' using errcode = 'P0001'; end if;
    if not exists(select 1 from app.coach_profile_disciplines where run_id = dataset and profile_id = actor and discipline = args->>'discipline') then raise exception 'group discipline is unavailable' using errcode = 'P0001'; end if;
    proposed.id := requested_id; proposed.run_id := dataset; proposed.coach_profile_id := actor;
    proposed.slug := 'group-' || replace(requested_id::text,'-','');
    proposed.title := btrim(args->>'title'); proposed.description := btrim(args->>'description'); proposed.discipline := args->>'discipline'; proposed.intended_level := btrim(args->>'intendedLevel');
    proposed.training_location_id := location.id;
    proposed.venue_snapshot := jsonb_build_object('id',location.id,'name',location.public_name,'label',location.public_location_label,'kind',location.location_kind,'latitude',location.latitude,'longitude',location.longitude);
    proposed.starts_at := (args->>'startsAt')::timestamptz; proposed.ends_at := (args->>'endsAt')::timestamptz; proposed.decision_deadline_at := (args->>'decisionDeadlineAt')::timestamptz;
    proposed.minimum_participants := (args->>'minimumParticipants')::smallint; proposed.maximum_participants := (args->>'maximumParticipants')::smallint; proposed.price_cents := (args->>'priceCents')::integer;
    if proposed.decision_deadline_at <= clock_timestamp() or not app.coach_local_time_is_unambiguous(proposed.starts_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(proposed.ends_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(proposed.decision_deadline_at at time zone 'Europe/Berlin','Europe/Berlin') then
      raise exception 'group time is unavailable or ambiguous' using errcode = 'P0001';
    end if;
    select * into activity from app.coach_group_sessions where id = requested_id for update;
    expected_revision := (args->>'expectedRevision')::integer;
    if found then
      if activity.run_id <> dataset or activity.coach_profile_id <> actor or activity.status <> 'draft' then raise exception 'group draft is unavailable' using errcode = 'P0001'; end if;
      if expected_revision is null and (activity.title,activity.description,activity.discipline,activity.intended_level,activity.training_location_id,activity.starts_at,activity.ends_at,activity.decision_deadline_at,activity.minimum_participants,activity.maximum_participants,activity.price_cents)
        is not distinct from (proposed.title,proposed.description,proposed.discipline,proposed.intended_level,proposed.training_location_id,proposed.starts_at,proposed.ends_at,proposed.decision_deadline_at,proposed.minimum_participants,proposed.maximum_participants,proposed.price_cents) then
        result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
      else
        if expected_revision is distinct from activity.revision then raise exception 'group draft changed' using errcode = 'P0001'; end if;
        update app.coach_group_sessions set title = proposed.title,description = proposed.description,discipline = proposed.discipline,intended_level = proposed.intended_level,
          training_location_id = proposed.training_location_id,venue_snapshot = proposed.venue_snapshot,starts_at = proposed.starts_at,ends_at = proposed.ends_at,decision_deadline_at = proposed.decision_deadline_at,
          minimum_participants = proposed.minimum_participants,maximum_participants = proposed.maximum_participants,price_cents = proposed.price_cents,revision = revision + 1,updated_at = clock_timestamp() where id = requested_id;
        result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
      end if;
    else
      if expected_revision is not null then raise exception 'group draft changed' using errcode = 'P0001'; end if;
      insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents)
        values(proposed.id,proposed.run_id,proposed.coach_profile_id,proposed.slug,proposed.title,proposed.description,proposed.discipline,proposed.intended_level,proposed.training_location_id,proposed.venue_snapshot,proposed.starts_at,proposed.ends_at,proposed.decision_deadline_at,proposed.minimum_participants,proposed.maximum_participants,proposed.price_cents);
      result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
    end if;
  elsif action in ('detail','delete-draft','join','withdraw','confirm','cancel','roster') then
    select * into activity from app.coach_group_sessions where id = requested_id and run_id = dataset;
    if not found then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
    if (action = 'confirm' and activity.status = 'open') or (action = 'join' and not exists(
      select 1 from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor
        and (id = (args->>'registrationId')::uuid or status = 'active')
    )) then perform app.group_lock_coach(dataset,activity.coach_profile_id,true); end if;
    activity := app.group_reconcile_session(requested_id);
    checked_at := clock_timestamp();
    if action = 'detail' then
      if activity.coach_profile_id <> actor and not exists(select 1 from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor)
        and (activity.status = 'draft' or not app.group_coach_enabled(dataset,activity.coach_profile_id,true)) then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
      select * into registration from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor order by created_at desc,id desc limit 1;
      result := jsonb_build_object('session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    elsif action = 'delete-draft' then
      if activity.coach_profile_id <> actor or activity.status <> 'draft' or activity.revision is distinct from (args->>'expectedRevision')::integer then raise exception 'group draft changed' using errcode = 'P0001'; end if;
      delete from app.coach_group_sessions where id = requested_id;
      result := jsonb_build_object('outcome','deleted');
    elsif action = 'roster' then
      if activity.coach_profile_id <> actor then raise exception 'group roster is unavailable' using errcode = 'P0001'; end if;
      select jsonb_agg(jsonb_build_object('item',jsonb_build_object('id',r.id,'name',p.display_name,'initials',p.initials,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at),
        'cursor',jsonb_build_object('at',r.created_at,'id',r.id)) order by r.created_at,r.id) into entries
        from (select * from app.coach_group_registrations where session_id = requested_id and (after_at is null or (created_at,id) > (after_at,after_id)) order by created_at,id limit 51) r join app.profiles p on p.id = r.athlete_profile_id;
      result := app.group_page(entries,50);
    elsif action = 'join' then
      if activity.coach_profile_id = actor then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
      select * into registration from app.coach_group_registrations where id = (args->>'registrationId')::uuid;
      if found then
        if registration.session_id <> requested_id or registration.athlete_profile_id <> actor or registration.run_id <> dataset then raise exception 'group registration changed' using errcode = 'P0001'; end if;
      else
        select * into registration from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor and status = 'active';
        if not found and activity.status in ('open','confirmed') and checked_at < activity.decision_deadline_at and checked_at < activity.starts_at then
          insert into app.coach_group_registrations(id,run_id,session_id,athlete_profile_id) values((args->>'registrationId')::uuid,dataset,requested_id,actor) returning * into registration;
        end if;
      end if;
      result := jsonb_build_object('outcome',case when registration.status = 'active' then 'joined' else 'unavailable' end,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    elsif action = 'withdraw' then
      select * into registration from app.coach_group_registrations where id = (args->>'registrationId')::uuid and session_id = requested_id and athlete_profile_id = actor;
      if not found then raise exception 'group registration is unavailable' using errcode = 'P0001'; end if;
      if registration.status = 'active' then
        if checked_at >= activity.starts_at then raise exception 'group registration is elapsed' using errcode = 'P0001'; end if;
        update app.coach_group_registrations set status = 'withdrawn',resolved_at = checked_at where id = registration.id returning * into registration;
      end if;
      result := jsonb_build_object('outcome',case when registration.status = 'withdrawn' then 'withdrawn' else 'unavailable' end,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    else
      if activity.coach_profile_id <> actor then raise exception 'group decision is unavailable' using errcode = 'P0001'; end if;
      if action = 'confirm' then
        if activity.status = 'confirmed' then null;
        elsif activity.status <> 'open' or checked_at >= activity.decision_deadline_at then
          result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor));
        else
          if (select count(*) from app.coach_group_registrations where session_id = requested_id and status = 'active') < activity.minimum_participants then raise exception 'group minimum is not met' using errcode = 'P0001'; end if;
          update app.coach_group_sessions set status = 'confirmed',confirmed_at = checked_at,confirmed_by_profile_id = actor,updated_at = checked_at,revision = revision + 1 where id = requested_id;
        end if;
      elsif activity.status = 'cancelled' then null;
      elsif activity.status not in ('open','confirmed') or checked_at >= activity.starts_at then
        result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor));
      else
        update app.coach_group_sessions set status = 'cancelled',closed_at = checked_at,closed_by_profile_id = actor,updated_at = checked_at,revision = revision + 1 where id = requested_id;
        update app.coach_group_registrations set status = 'session-cancelled',resolved_at = checked_at where session_id = requested_id and status = 'active';
      end if;
      result := coalesce(result,jsonb_build_object('outcome',case when action = 'confirm' then 'confirmed' else 'cancelled' end,'session',app.group_session_projection(requested_id,actor)));
    end if;
  elsif action in ('owner-list','registrations') then
    -- Reconcile the bounded requested page, not an unrelated first batch of
    -- expired records. Every returned item must reflect its effective deadline.
    for candidate in select s.id from app.coach_group_sessions s where s.status = 'open' and s.decision_deadline_at <= clock_timestamp() and (
      (action = 'owner-list' and s.id in (select id from app.coach_group_sessions where run_id = dataset and coach_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21))
      or (action = 'registrations' and s.id in (select session_id from app.coach_group_registrations where run_id = dataset and athlete_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21))
    ) order by s.id loop
      perform app.group_reconcile_session(candidate);
    end loop;
    if action = 'owner-list' then
      select jsonb_agg(jsonb_build_object('item',app.group_session_projection(s.id,actor),'cursor',jsonb_build_object('at',s.created_at,'id',s.id)) order by s.created_at desc,s.id desc) into entries
        from (select * from app.coach_group_sessions where run_id = dataset and coach_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21) s;
    else
      select jsonb_agg(jsonb_build_object('item',jsonb_build_object('session',app.group_session_projection(r.session_id,actor),'registration',app.group_registration_projection(r.id)),
        'cursor',jsonb_build_object('at',r.created_at,'id',r.id)) order by r.created_at desc,r.id desc) into entries
        from (select * from app.coach_group_registrations where run_id = dataset and athlete_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21) r;
    end if;
    result := app.group_page(entries,20);
  else
    raise exception 'group action is unavailable' using errcode = 'P0001';
  end if;
  perform app.group_session_flags(false);
  return result;
end;
$$;


ALTER FUNCTION app.group_session_command(action text, args jsonb) OWNER TO app_owner;

--
-- Name: group_session_flags(boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_session_flags(enabled boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  perform set_config('app.group_session_management',case when enabled then 'on' else 'off' end,true);
end;
$$;


ALTER FUNCTION app.group_session_flags(enabled boolean) OWNER TO app_owner;

--
-- Name: group_session_projection(uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_session_projection(requested_id uuid, actor uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id',s.id,'slug',s.slug,'title',s.title,'description',s.description,'discipline',s.discipline,'intendedLevel',s.intended_level,
    'venue',s.venue_snapshot,'startsAt',s.starts_at,'endsAt',s.ends_at,'decisionDeadlineAt',s.decision_deadline_at,
    'minimumParticipants',s.minimum_participants,'maximumParticipants',s.maximum_participants,'priceCents',s.price_cents,'currency',s.currency,
    'status',s.status,'displayStatus',case when s.status = 'confirmed' and s.ends_at <= clock_timestamp() then 'ended' else s.status end,
    'revision',s.revision,'createdAt',s.created_at,'updatedAt',s.updated_at,'publishedAt',s.published_at,'confirmedAt',s.confirmed_at,'closedAt',s.closed_at,
    'coach',jsonb_build_object('slug',p.public_slug,'name',p.display_name,'trustKind',app.coach_trust_kind(p.profile_id,p.is_demo)),
    'participantCount',(select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active'),
    'canJoin',s.status in ('open','confirmed') and s.starts_at > clock_timestamp() and s.decision_deadline_at > clock_timestamp()
      and app.group_coach_enabled(s.run_id,s.coach_profile_id,true) and (actor is null or actor <> s.coach_profile_id)
      and not exists(select 1 from app.coach_group_registrations where session_id = s.id and athlete_profile_id = actor and status = 'active')
      and (select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active') < s.maximum_participants,
    'canConfirm',coalesce(actor = s.coach_profile_id,false) and s.status = 'open' and s.decision_deadline_at > clock_timestamp()
      and app.group_coach_enabled(s.run_id,s.coach_profile_id,true)
      and (select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active') >= s.minimum_participants,
    'canCancel',coalesce(actor = s.coach_profile_id,false) and s.status in ('open','confirmed') and s.starts_at > clock_timestamp(),
    'canEdit',coalesce(actor = s.coach_profile_id,false) and s.status = 'draft' and app.group_coach_enabled(s.run_id,s.coach_profile_id,false)
  ) from app.coach_group_sessions s join app.coach_profiles p on p.run_id = s.run_id and p.profile_id = s.coach_profile_id where s.id = requested_id;
$$;


ALTER FUNCTION app.group_session_projection(requested_id uuid, actor uuid) OWNER TO app_owner;

--
-- Name: group_time_reserved(uuid, uuid, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.group_time_reserved(dataset uuid, coach uuid, from_time timestamp with time zone, to_time timestamp with time zone, excluding uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.group_time_reserved(dataset uuid, coach uuid, from_time timestamp with time zone, to_time timestamp with time zone, excluding uuid) OWNER TO app_owner;

--
-- Name: guard_coach_schedule_write(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.guard_coach_schedule_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.guard_coach_schedule_write() OWNER TO app_owner;

--
-- Name: guard_connection_attempt(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.guard_connection_attempt() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare pair app.coach_athlete_connection_pairs%rowtype;
begin
  if tg_op = 'DELETE' then
    if current_user = 'app_owner' then raise exception 'connection attempt must be retained' using errcode = 'P0001'; end if;
    return old;
  end if;
  select p.* into pair from app.coach_athlete_connection_pairs p where p.id = new.pair_id;
  if not found or new.run_id <> pair.run_id
    or new.sender_profile_id not in (pair.coach_profile_id, pair.athlete_profile_id)
    or new.recipient_profile_id not in (pair.coach_profile_id, pair.athlete_profile_id) then
    raise exception 'connection participants are invalid' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.run_id,new.pair_id,new.attempt_number,new.sender_profile_id,new.recipient_profile_id,new.created_at)
      is distinct from (old.id,old.run_id,old.pair_id,old.attempt_number,old.sender_profile_id,old.recipient_profile_id,old.created_at)
      or not ((old.status = 'pending' and new.status in ('accepted','declined','withdrawn')) or (old.status = 'accepted' and new.status = 'removed'))
      or (old.status = 'accepted' and (new.decided_at,new.decided_by_profile_id) is distinct from (old.decided_at,old.decided_by_profile_id)) then
      raise exception 'connection transition conflicts with retained state' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION app.guard_connection_attempt() OWNER TO app_owner;

--
-- Name: guard_connection_pair(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.guard_connection_pair() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'UPDATE' or (tg_op = 'DELETE' and current_user = 'app_owner') then
    raise exception 'connection pair identity must be retained' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;


ALTER FUNCTION app.guard_connection_pair() OWNER TO app_owner;

--
-- Name: guard_group_registration(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.guard_group_registration() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare activity app.coach_group_sessions;
begin
  if tg_op = 'DELETE' then
    if current_user = 'app_owner' then raise exception 'group registration history must be retained' using errcode = 'P0001'; end if;
    return old;
  end if;
  select * into activity from app.coach_group_sessions where id = new.session_id and run_id = new.run_id for update;
  if not found or new.athlete_profile_id = activity.coach_profile_id then
    raise exception 'group registration is unavailable' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and ((new.id,new.run_id,new.session_id,new.athlete_profile_id,new.created_at) is distinct from (old.id,old.run_id,old.session_id,old.athlete_profile_id,old.created_at)
    or old.status <> 'active' or new.status = 'active') then
    raise exception 'group registration attempt is terminal' using errcode = 'P0001';
  end if;
  if new.status = 'active' and (activity.status not in ('open','confirmed') or (select count(*) from app.coach_group_registrations where session_id = new.session_id and status = 'active') >= activity.maximum_participants) then
    raise exception 'group session is full or unavailable' using errcode = 'P0001';
  end if;
  if (new.status = 'session-cancelled' and activity.status <> 'cancelled') or (new.status = 'session-not-confirmed' and activity.status <> 'not-confirmed') then
    raise exception 'group registration resolution conflicts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;


ALTER FUNCTION app.guard_group_registration() OWNER TO app_owner;

--
-- Name: guard_group_session(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.guard_group_session() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.guard_group_session() OWNER TO app_owner;

--
-- Name: issue_personal_wallet_challenge(uuid, text, text, text, bytea, bytea, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.issue_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_origin text, requested_nonce_hash bytea, requested_message_hash bytea, requested_issued_at timestamp with time zone, requested_expires_at timestamp with time zone) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  if requested_purpose not in (
    'link-personal-wallet',
    'replace-personal-wallet'
  )
    or requested_wallet_address is null
    or pg_catalog.char_length(requested_wallet_address) not between 32 and 44
    or requested_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or requested_origin is null
    or pg_catalog.octet_length(requested_nonce_hash) <> 32
    or pg_catalog.octet_length(requested_message_hash) <> 32
    or requested_issued_at < pg_catalog.statement_timestamp() - interval '30 seconds'
    or requested_issued_at > pg_catalog.statement_timestamp() + interval '30 seconds'
    or requested_expires_at <> requested_issued_at + interval '5 minutes'
  then
    raise exception using
      errcode = 'P0001',
      message = 'wallet challenge request is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.status = 'active';

  if (
    requested_purpose = 'link-personal-wallet'
    and active_wallet_address is not null
  ) or (
    requested_purpose = 'replace-personal-wallet'
    and (
      active_wallet_address is null
      or active_wallet_address = requested_wallet_address
    )
  ) then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'state-conflict';
  end if;

  insert into app.auth_challenges (
    id,
    run_id,
    auth_user_id,
    profile_id,
    purpose,
    cluster,
    wallet_address,
    origin,
    message_version,
    nonce_hash,
    message_hash,
    issued_at,
    expires_at,
    consumed_at,
    consumed_result
  )
  values (
    requested_challenge_id,
    run_id_text::uuid,
    auth_user_id_text::uuid,
    profile_id_text::uuid,
    requested_purpose,
    'solana:devnet',
    requested_wallet_address,
    requested_origin,
    1,
    requested_nonce_hash,
    requested_message_hash,
    requested_issued_at,
    requested_expires_at,
    null,
    null
  );

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return 'issued';
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.issue_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_origin text, requested_nonce_hash bytea, requested_message_hash bytea, requested_issued_at timestamp with time zone, requested_expires_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: lock_connection_eligibility(app.coach_athlete_connection_pairs); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.lock_connection_eligibility(requested_pair app.coach_athlete_connection_pairs) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare demo_coach boolean;
begin
  select coach.is_demo into demo_coach from app.coach_profiles coach
    where coach.run_id = requested_pair.run_id and coach.profile_id = requested_pair.coach_profile_id;
  if demo_coach is not true then
    perform 1 from app.coach_applications application
      where application.profile_id = requested_pair.coach_profile_id and application.status = 'approved'
      for share;
    if not found then raise exception 'connection is not eligible' using errcode = 'P0001'; end if;
  end if;
  perform 1 from app.coach_profiles coach
    where coach.run_id = requested_pair.run_id and coach.profile_id = requested_pair.coach_profile_id for share;
  perform 1 from app.coach_private_bookings booking
    where booking.run_id = requested_pair.run_id
      and booking.coach_profile_id = requested_pair.coach_profile_id
      and booking.client_profile_id = requested_pair.athlete_profile_id
      and booking.credit_projection_id is null and booking.status in ('confirmed', 'completed')
    order by booking.id limit 1 for share;
  if not found or not app.connection_pair_eligible(requested_pair) then
    raise exception 'connection is not eligible' using errcode = 'P0001';
  end if;
end;
$$;


ALTER FUNCTION app.lock_connection_eligibility(requested_pair app.coach_athlete_connection_pairs) OWNER TO app_owner;

--
-- Name: message_conversations; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    athlete_profile_id uuid NOT NULL,
    last_seq integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    activity_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    CONSTRAINT message_conversations_check CHECK ((coach_profile_id <> athlete_profile_id)),
    CONSTRAINT message_conversations_last_seq_check CHECK ((last_seq >= 0))
);

ALTER TABLE ONLY app.message_conversations FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_conversations OWNER TO app_owner;

--
-- Name: mail_append(app.message_conversations, uuid, uuid, text, text, uuid, text, text, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_append(c app.message_conversations, ctx uuid, sender uuid, kind text, body text, submission uuid, event text, label text, at_time timestamp with time zone DEFAULT statement_timestamp()) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare n integer; id uuid; prior app.message_entries; begin
 if event is not null then select e.id into id from app.message_entries e where e.event_key=event; if found then return id; end if; end if;
 if submission is not null then
  select * into prior from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id=sender and e.submission_id=submission;
  if found then if (prior.body,prior.context_id,prior.kind) is distinct from (body,ctx,kind) then raise exception 'message submission conflicts' using errcode='P0001'; end if; return prior.id; end if;
 end if;
 if ctx is not null and not exists(select 1 from app.message_contexts x where x.id=ctx and x.conversation_id=c.id) then raise exception 'message context conflicts' using errcode='P0001'; end if;
 if sender is not null and sender not in(c.coach_profile_id,c.athlete_profile_id) then raise exception 'message sender conflicts' using errcode='P0001'; end if;
 update app.message_conversations set last_seq=last_seq+1,activity_at=greatest(activity_at,at_time) where message_conversations.id=c.id returning last_seq into n;
 insert into app.message_entries(conversation_id,seq,context_id,sender_profile_id,kind,body,submission_id,event_key,status_label,created_at)
 values(c.id,n,ctx,sender,kind,body,submission,event,label,at_time) returning message_entries.id into id;
 -- Own actions never make an unread item; never advance past earlier unread content.
 foreach sender in array array[c.coach_profile_id,c.athlete_profile_id] loop
  insert into app.message_reads(conversation_id,profile_id,last_seq) values(c.id,sender,0) on conflict do nothing;
 end loop;
 return id;
end $$;


ALTER FUNCTION app.mail_append(c app.message_conversations, ctx uuid, sender uuid, kind text, body text, submission uuid, event text, label text, at_time timestamp with time zone) OWNER TO app_owner;

--
-- Name: mail_blocked(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_blocked(run uuid, a uuid, b uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select exists(select 1 from app.message_blocks where run_id=run and low_profile_id=least(a,b) and high_profile_id=greatest(a,b) and ended_at is null)
$$;


ALTER FUNCTION app.mail_blocked(run uuid, a uuid, b uuid) OWNER TO app_owner;

--
-- Name: mail_booking_activity(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_booking_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare flags jsonb; request_id uuid; sender uuid:=nullif(current_setting('app.current_profile_id',true),'')::uuid; begin
 if new.credit_projection_id is not null or old.status is not distinct from new.status then return new; end if;
 flags:=app.mail_trigger_enter();select r.id into request_id from app.coach_booking_requests r where r.accepted_booking_id=new.id;
 perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,case when request_id is null then 'booking' else 'request' end,coalesce(request_id,new.id),'booking:'||new.id::text||':'||new.status,new.status,sender,statement_timestamp(),'status');
 perform app.mail_trigger_leave(flags);return new;
end $$;


ALTER FUNCTION app.mail_booking_activity() OWNER TO app_owner;

--
-- Name: mail_booking_guard(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_booking_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare flags jsonb; begin
 if new.credit_projection_id is not null then return new; end if;
 perform app.mail_source_lock(new.run_id,new.coach_profile_id,new.client_profile_id);flags:=app.mail_trigger_enter();
 if tg_op='INSERT' and app.mail_blocked(new.run_id,new.coach_profile_id,new.client_profile_id) then raise exception 'message unavailable: blocked session acceptance' using errcode='P0001'; end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;


ALTER FUNCTION app.mail_booking_guard() OWNER TO app_owner;

--
-- Name: mail_change_block(app.message_conversations, uuid, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_change_block(c app.message_conversations, actor uuid, blocking boolean) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare saved_block_id uuid; begin
 if not blocking then
  update app.message_blocks set ended_at=statement_timestamp() where run_id=c.run_id and low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and blocked_by_profile_id=actor and ended_at is null;return '{}'::jsonb;
 end if;
 select b.id into saved_block_id from app.message_blocks b where b.run_id=c.run_id and b.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and b.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and b.blocked_by_profile_id=actor and b.ended_at is null;
 if saved_block_id is not null then return '{}'::jsonb; end if;
 insert into app.message_blocks(run_id,low_profile_id,high_profile_id,blocked_by_profile_id) values(c.run_id,least(c.coach_profile_id,c.athlete_profile_id),greatest(c.coach_profile_id,c.athlete_profile_id),actor) returning message_blocks.id into saved_block_id;
 insert into app.message_block_bookings(block_id,booking_id,until_at) select saved_block_id,b.id,b.scheduled_end_at+interval '336 hours' from app.coach_private_bookings b where b.run_id=c.run_id and b.credit_projection_id is null and b.status='confirmed' and b.scheduled_end_at>statement_timestamp() and least(b.coach_profile_id,b.client_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(b.coach_profile_id,b.client_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id);
 update app.coach_athlete_connection_attempts a set status='removed',removed_at=statement_timestamp(),removed_by_profile_id=actor from app.coach_athlete_connection_pairs p where p.id=a.pair_id and p.run_id=c.run_id and least(p.coach_profile_id,p.athlete_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(p.coach_profile_id,p.athlete_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id) and a.status='accepted';
 update app.coach_athlete_connection_attempts a set status=case when a.sender_profile_id=actor then 'withdrawn' else 'declined' end,decided_at=statement_timestamp(),decided_by_profile_id=actor from app.coach_athlete_connection_pairs p where p.id=a.pair_id and p.run_id=c.run_id and least(p.coach_profile_id,p.athlete_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(p.coach_profile_id,p.athlete_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id) and a.status='pending';
 update app.message_consents a set status='revoked',decided_at=statement_timestamp() from app.message_conversations v where v.id=a.conversation_id and v.run_id=c.run_id and least(v.coach_profile_id,v.athlete_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(v.coach_profile_id,v.athlete_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id) and a.status in ('accepted','pending');
 return '{}'::jsonb;
end $$;


ALTER FUNCTION app.mail_change_block(c app.message_conversations, actor uuid, blocking boolean) OWNER TO app_owner;

--
-- Name: mail_coach_enabled(app.message_conversations); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_coach_enabled(c app.message_conversations) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id
 where p.run_id=c.run_id and p.profile_id=c.coach_profile_id and (p.is_demo or a.status='approved'))
$$;


ALTER FUNCTION app.mail_coach_enabled(c app.message_conversations) OWNER TO app_owner;

--
-- Name: mail_connection_guard(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_connection_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare flags jsonb; pair app.coach_athlete_connection_pairs; begin
 flags:=app.mail_trigger_enter();select * into strict pair from app.coach_athlete_connection_pairs where id=new.pair_id;
 perform app.mail_source_lock(pair.run_id,pair.coach_profile_id,pair.athlete_profile_id);
 if new.status in ('pending','accepted') and app.mail_blocked(pair.run_id,pair.coach_profile_id,pair.athlete_profile_id) then raise exception 'message unavailable: blocked connection' using errcode='P0001'; end if;
 if tg_op='UPDATE' and old.status='accepted' and new.status='removed' then
  update app.message_consents a set status='revoked',decided_at=statement_timestamp() from app.message_conversations c where c.id=a.conversation_id and c.run_id=pair.run_id and c.coach_profile_id=pair.coach_profile_id and c.athlete_profile_id=pair.athlete_profile_id and a.status in ('accepted','pending');
 end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;


ALTER FUNCTION app.mail_connection_guard() OWNER TO app_owner;

--
-- Name: message_contexts; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_contexts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    kind text NOT NULL,
    source_id uuid,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    CONSTRAINT message_contexts_check CHECK (((kind = 'inquiry'::text) = (source_id IS NULL))),
    CONSTRAINT message_contexts_kind_check CHECK ((kind = ANY (ARRAY['inquiry'::text, 'request'::text, 'booking'::text])))
);

ALTER TABLE ONLY app.message_contexts FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_contexts OWNER TO app_owner;

--
-- Name: mail_context_allowed(app.message_conversations, app.message_contexts); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_context_allowed(c app.message_conversations, ctx app.message_contexts) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare booking uuid; begin
 if ctx.conversation_id is distinct from c.id then return false; end if;
 if ctx.kind='request' and not exists(select 1 from app.coach_booking_requests r where r.id=ctx.source_id and r.run_id=c.run_id and r.coach_profile_id=c.coach_profile_id and r.client_profile_id=c.athlete_profile_id) then return false; end if;
 if ctx.kind='booking' and not exists(select 1 from app.coach_private_bookings b where b.id=ctx.source_id and b.run_id=c.run_id and b.coach_profile_id=c.coach_profile_id and b.client_profile_id=c.athlete_profile_id) then return false; end if;
 booking:=app.mail_context_booking(ctx);
 if app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id) then
  return booking is not null and exists(select 1 from app.coach_private_bookings b where b.id=booking and b.status in ('confirmed','completed'))
  and not exists(select 1 from app.message_blocks block where block.run_id=c.run_id and block.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and block.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and block.ended_at is null
   and not exists(select 1 from app.message_block_bookings snapshot where snapshot.block_id=block.id and snapshot.booking_id=booking and snapshot.until_at>statement_timestamp()));
 end if;
 if app.mail_coach_enabled(c) then return true; end if;
 return booking is not null and exists(select 1 from app.coach_private_bookings b where b.id=booking and b.status in ('confirmed','completed') and b.scheduled_end_at+interval '336 hours'>statement_timestamp());
end $$;


ALTER FUNCTION app.mail_context_allowed(c app.message_conversations, ctx app.message_contexts) OWNER TO app_owner;

--
-- Name: mail_context_booking(app.message_contexts); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_context_booking(ctx app.message_contexts) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select case when ctx.kind='booking' then ctx.source_id when ctx.kind='request' then (select accepted_booking_id from app.coach_booking_requests where id=ctx.source_id) end
$$;


ALTER FUNCTION app.mail_context_booking(ctx app.message_contexts) OWNER TO app_owner;

--
-- Name: mail_context_projection(app.message_conversations, app.message_contexts); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_context_projection(c app.message_conversations, ctx app.message_contexts) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select jsonb_build_object('id',ctx.id,'kind',ctx.kind,'requestId',r.id,'bookingId',b.id,'status',coalesce(b.status,r.status),
 'startsAt',coalesce(b.scheduled_start_at,r.scheduled_start_at),'endsAt',coalesce(b.scheduled_end_at,r.scheduled_end_at),
 'venue',coalesce(s.training_location_name,r.training_location_name),'deadline',r.decision_deadline_at,'canSend',app.mail_context_allowed(c,ctx))
 || case when b.id is null then jsonb_build_object('title','','titleRevision',0,'canEditTitle',false) else app.mail_session_details(b) end
 from (select 1) dummy left join app.coach_booking_requests r on ctx.kind='request' and r.id=ctx.source_id
 left join app.coach_private_bookings b on b.id=case when ctx.kind='booking' then ctx.source_id else r.accepted_booking_id end
 left join app.coach_availability_slots s on s.id=b.slot_id
$$;


ALTER FUNCTION app.mail_context_projection(c app.message_conversations, ctx app.message_contexts) OWNER TO app_owner;

--
-- Name: mail_conversation_projection(app.message_conversations, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_conversation_projection(c app.message_conversations, actor uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select jsonb_build_object('id',c.id,'coachProfileId',c.coach_profile_id,'athleteProfileId',c.athlete_profile_id,'actorProfileId',actor,
 'counterpartName',case when actor=c.coach_profile_id then athlete.display_name else coach.display_name end,'role',case when actor=c.coach_profile_id then 'coach' else 'athlete' end,
 'activityAt',c.activity_at,'canSendGeneral',app.mail_general_allowed(c),'canRequestGeneral',app.mail_general_eligible(c),'blocked',app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id),
 'blockedByMe',exists(select 1 from app.message_blocks b where b.run_id=c.run_id and b.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and b.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and b.ended_at is null and b.blocked_by_profile_id=actor),
 'unread',exists(select 1 from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id is distinct from actor and e.seq>coalesce((select last_seq from app.message_reads where conversation_id=c.id and profile_id=actor),0))
 or exists(select 1 from app.message_consents a where a.conversation_id=c.id and a.recipient_profile_id=actor and a.status='pending'),
 'consent',(select jsonb_build_object('id',a.id,'senderProfileId',a.sender_profile_id,'recipientProfileId',a.recipient_profile_id,'body',a.first_body,'status',a.status) from app.message_consents a where a.conversation_id=c.id order by a.created_at desc,a.id desc limit 1))
 from app.coach_profiles coach join app.profiles athlete on athlete.id=c.athlete_profile_id where coach.profile_id=c.coach_profile_id and coach.run_id=c.run_id
$$;


ALTER FUNCTION app.mail_conversation_projection(c app.message_conversations, actor uuid) OWNER TO app_owner;

--
-- Name: mail_dispatch(text, jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_dispatch(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare actor uuid:=current_setting('app.current_profile_id',true)::uuid; run uuid:=current_setting('app.current_run_id',true)::uuid;
 c app.message_conversations; ctx app.message_contexts; b app.coach_private_bookings; metadata app.private_session_titles;
 label text; expected integer; items jsonb; before_seq integer; after_seq integer; last_read integer; lo integer; hi integer;
begin
 if action='session-title' then
  select * into b from app.coach_private_bookings where id=(args->>'bookingId')::uuid and run_id=run and credit_projection_id is null and actor in(coach_profile_id,client_profile_id);
  if b.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
  perform app.mail_lock_pair(run,b.coach_profile_id,b.client_profile_id);
  select * into b from app.coach_private_bookings where id=b.id for update;
  -- Ensure existing capability and block-window checks apply even for legacy bookings.
  c:=app.mail_ensure_conversation(run,b.coach_profile_id,b.client_profile_id);
  if not (app.mail_session_details(b)->>'canEditTitle')::boolean then raise exception 'message title read only' using errcode='P0001'; end if;
  if jsonb_typeof(args->'title') is distinct from 'string' or jsonb_typeof(args->'expectedRevision') is distinct from 'number' then raise exception 'message invalid title' using errcode='P0001'; end if;
  label:=btrim(args->>'title');expected:=(args->>'expectedRevision')::integer;
  if expected is null or expected<0 or char_length(label)>100 or octet_length(label)>400 or label ~ '[[:cntrl:]]' or position(chr(8232) in label)>0 or position(chr(8233) in label)>0 then raise exception 'message invalid title' using errcode='P0001'; end if;
  select * into metadata from app.private_session_titles where booking_id=b.id;
  if coalesce(metadata.revision,0)<>expected then
   if metadata.revision=expected+1 and metadata.title=label then return app.mail_session_details(b); end if;
   raise exception 'message title changed' using errcode='P0001';
  end if;
  insert into app.private_session_titles(booking_id,title,revision,updated_by) values(b.id,label,expected+1,actor)
   on conflict(booking_id) do update set title=excluded.title,revision=excluded.revision,updated_by=excluded.updated_by;
  return app.mail_session_details(b);
 end if;
 if action<>'thread' then return app.mail_dispatch_before_session_labels(action,args); end if;
 select * into c from app.message_conversations where id=(args->>'conversationId')::uuid and run_id=run and actor in(coach_profile_id,athlete_profile_id);
 if c.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
 if args->>'contextId' is not null then
  select * into ctx from app.message_contexts where id=(args->>'contextId')::uuid and conversation_id=c.id;
  if ctx.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
 end if;
 select coalesce(r.last_seq,0) into last_read from (select 1) dummy left join app.message_reads r on r.conversation_id=c.id and r.profile_id=actor;
 before_seq:=nullif(args->>'before','')::integer;after_seq:=nullif(args->>'after','')::integer;
 if (before_seq is not null and before_seq<1) or (after_seq is not null and after_seq<0) or (before_seq is not null and after_seq is not null) then raise exception 'message invalid cursor' using errcode='P0001'; end if;
 if before_seq is null and after_seq is null then after_seq:=case when ctx.id is null then greatest(0,least(last_read,c.last_seq-50)) else 0 end;end if;
 select coalesce(jsonb_agg(v.data order by v.seq),'[]'::jsonb) into items from (
  select e.seq,jsonb_build_object('id',e.id,'seq',e.seq,'senderProfileId',e.sender_profile_id,'kind',e.kind,'body',e.body,'createdAt',e.created_at,'contextId',e.context_id,'status',e.status_label) data
  from app.message_entries e left join app.message_contexts x on x.id=e.context_id
  where e.conversation_id=c.id and (ctx.id is null or e.context_id=ctx.id or (app.mail_context_booking(ctx) is not null and app.mail_context_booking(x)=app.mail_context_booking(ctx)))
  and (after_seq is null or e.seq>after_seq) and (before_seq is null or e.seq<before_seq)
  order by case when before_seq is null then e.seq else -e.seq end limit 50) v;
 select min((e->>'seq')::integer),max((e->>'seq')::integer) into lo,hi from jsonb_array_elements(items) e;
 return jsonb_build_object('conversation',app.mail_conversation_projection(c,actor),'entries',items,'lastSeq',c.last_seq,'readThrough',last_read,
 'hasOlder',exists(select 1 from app.message_entries e left join app.message_contexts x on x.id=e.context_id where e.conversation_id=c.id and e.seq<coalesce(lo,before_seq,0) and (ctx.id is null or e.context_id=ctx.id or (app.mail_context_booking(ctx) is not null and app.mail_context_booking(x)=app.mail_context_booking(ctx)))),
 'hasNewer',exists(select 1 from app.message_entries e left join app.message_contexts x on x.id=e.context_id where e.conversation_id=c.id and e.seq>coalesce(hi,after_seq,c.last_seq) and (ctx.id is null or e.context_id=ctx.id or (app.mail_context_booking(ctx) is not null and app.mail_context_booking(x)=app.mail_context_booking(ctx)))),
 'contexts',(select coalesce(jsonb_agg(app.mail_context_projection(c,x) order by x.created_at,x.id),'[]'::jsonb) from (select x.* from app.message_contexts x where conversation_id=c.id order by (x.id=ctx.id) desc,exists(select 1 from jsonb_array_elements(items) e where e->>'contextId'=x.id::text) desc,created_at desc,id desc limit 50) x));
end $$;


ALTER FUNCTION app.mail_dispatch(action text, args jsonb) OWNER TO app_owner;

--
-- Name: mail_dispatch_before_session_labels(text, jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_dispatch_before_session_labels(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare actor uuid:=current_setting('app.current_profile_id',true)::uuid; run uuid:=current_setting('app.current_run_id',true)::uuid;
 c app.message_conversations; ctx app.message_contexts; attempt app.message_consents;
 coach uuid; athlete uuid; context_id uuid; id uuid; prior app.message_entries; items jsonb; n integer; before_seq integer; after_seq integer; last_read integer;
begin
 if action in ('inquire','send','request-consent') then perform pg_advisory_xact_lock(hashtextextended('mail-rate:'||run::text||':'||actor::text,0)); end if;
 if action='inbox' then
  if args->>'filter' is not null and args->>'filter' not in ('all','unread','requests') then raise exception 'message invalid filter' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(v.data order by v.activity_at desc,v.id desc),'[]'::jsonb) into items from (
   select p.id,p.activity_at,app.mail_conversation_projection(p,actor) data from app.message_conversations p where p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id)
   and (args->>'beforeAt' is null or (p.activity_at,p.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
   and (coalesce(args->>'filter','all')='all' or (args->>'filter'='unread' and (app.mail_conversation_projection(p,actor)->>'unread')::boolean)
   or (args->>'filter'='requests' and exists(select 1 from app.message_consents a where a.conversation_id=p.id and a.recipient_profile_id=actor and a.status='pending')))
   and (p.last_seq>0 or exists(select 1 from app.message_consents a where a.conversation_id=p.id))
   order by p.activity_at desc,p.id desc limit 20) v;
  return jsonb_build_object('items',items,'unreadCount',(select count(*) from app.message_conversations p where p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id) and (app.mail_conversation_projection(p,actor)->>'unread')::boolean));
 end if;
 if action='contact' then
  coach:=(args->>'coachId')::uuid;
  if coach=actor or not exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id where p.run_id=run and p.profile_id=coach and p.visibility='visible' and exists(select 1 from app.demo_run_participants member where member.run_id=run and member.profile_id=coach and member.status='active') and (p.is_demo or a.status='approved') and app.coach_has_publishable_primary_location(p.run_id,p.profile_id)) or app.mail_blocked(run,coach,actor) then raise exception 'message unavailable' using errcode='P0001'; end if;
  return (select jsonb_build_object('coachId',p.profile_id,'name',p.display_name) from app.coach_profiles p where p.run_id=run and p.profile_id=coach);
 end if;
 if action in ('inquire','open') then
  coach:=(args->>'coachId')::uuid; athlete:=actor;
  if action='open' and args->>'pairId' is not null then
   select p.coach_profile_id,p.athlete_profile_id into coach,athlete from app.coach_athlete_connection_pairs p where p.id=(args->>'pairId')::uuid and p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id);
   if not found then raise exception 'message unavailable' using errcode='P0001'; end if;
  end if;
  if coach is null or coach=athlete then raise exception 'message unavailable' using errcode='P0001'; end if;
  if action='inquire' then
   select e.* into prior from app.message_entries e join app.message_conversations v on v.id=e.conversation_id join app.message_contexts x on x.id=e.context_id where v.run_id=run and v.coach_profile_id=coach and v.athlete_profile_id=athlete and e.sender_profile_id=actor and e.submission_id=(args->>'submissionId')::uuid and x.kind='inquiry';
   if found then
    if prior.body is distinct from args->>'body' then raise exception 'message submission conflicts' using errcode='P0001'; end if;
    return jsonb_build_object('conversationId',prior.conversation_id,'entryId',prior.id);
   end if;
  end if;
  if action='inquire' and (not exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id where p.run_id=run and p.profile_id=coach and p.visibility='visible' and exists(select 1 from app.demo_run_participants member where member.run_id=run and member.profile_id=coach and member.status='active') and (p.is_demo or a.status='approved') and app.coach_has_publishable_primary_location(p.run_id,p.profile_id)) or app.mail_blocked(run,coach,athlete)) then raise exception 'message unavailable' using errcode='P0001'; end if;
  c:=app.mail_ensure_conversation(run,coach,athlete);
  if action='open' and not app.mail_general_allowed(c) and not app.mail_general_eligible(c) and not exists(select 1 from app.message_contexts where conversation_id=c.id) then raise exception 'message unavailable' using errcode='P0001'; end if;
  if action='inquire' then context_id:=app.mail_ensure_context(c,'inquiry',null); end if;
 else
  select * into c from app.message_conversations p where p.id=(args->>'conversationId')::uuid and p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id);
  if not found then raise exception 'message unavailable' using errcode='P0001'; end if;
 end if;
 if action<>'thread' then
  perform app.mail_lock_pair(run,c.coach_profile_id,c.athlete_profile_id);
  select * into strict c from app.message_conversations where message_conversations.id=c.id;
 end if;
 if action in ('block','unblock') then return app.mail_change_block(c,actor,action='block'); end if;
 if action in ('inquire','send') then
  if action='send' then context_id:=nullif(args->>'contextId','')::uuid; end if;
  select * into prior from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id=actor and e.submission_id=(args->>'submissionId')::uuid;
  if found then
   if (prior.body,prior.context_id) is distinct from (args->>'body',context_id) then raise exception 'message submission conflicts' using errcode='P0001'; end if;
   return jsonb_build_object('conversationId',c.id,'entryId',prior.id);
  end if;
  if context_id is null then
   if not app.mail_general_allowed(c) then raise exception 'message consent required' using errcode='P0001'; end if;
  else
   select * into ctx from app.message_contexts x where x.id=context_id and x.conversation_id=c.id;
   if not found or not app.mail_context_allowed(c,ctx) then raise exception 'message unavailable' using errcode='P0001'; end if;
  end if;
  if args->>'body' is null or args->>'submissionId' is null then raise exception 'message invalid body' using errcode='P0001'; end if;
  perform app.mail_rate(c,actor,not exists(select 1 from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id=actor));
  id:=app.mail_append(c,context_id,actor,'text',args->>'body',(args->>'submissionId')::uuid,null,null);
  return jsonb_build_object('conversationId',c.id,'entryId',id);
 end if;
 if action='open' then return jsonb_build_object('conversationId',c.id); end if;
 if action='request-consent' then
  if not app.mail_general_eligible(c) then raise exception 'message unavailable' using errcode='P0001'; end if;
  select * into attempt from app.message_consents a where a.id=(args->>'submissionId')::uuid;
  if found then if attempt.conversation_id<>c.id or attempt.sender_profile_id<>actor or attempt.first_body is distinct from args->>'body' then raise exception 'message submission conflicts' using errcode='P0001'; end if;
  else
   select * into attempt from app.message_consents a where a.conversation_id=c.id and a.status='pending';
   if not found then
    if exists(select 1 from app.message_consents a where a.conversation_id=c.id and a.status='declined' and a.decided_at>statement_timestamp()-interval '24 hours') then raise exception 'message rate limited' using errcode='P0001'; end if;
    perform app.mail_rate(c,actor,true);
    update app.message_conversations set activity_at=statement_timestamp() where message_conversations.id=c.id;
    insert into app.message_consents(id,conversation_id,sender_profile_id,recipient_profile_id,first_body)
    values((args->>'submissionId')::uuid,c.id,actor,case when actor=c.coach_profile_id then c.athlete_profile_id else c.coach_profile_id end,args->>'body') returning * into attempt;
   end if;
  end if;
  return jsonb_build_object('conversationId',c.id,'consentId',attempt.id);
 end if;
 if action='consent' then
  select * into attempt from app.message_consents a where a.id=(args->>'consentId')::uuid and a.conversation_id=c.id for update;
  if not found or args->>'decision' not in ('accept','decline','withdraw') then raise exception 'message unavailable' using errcode='P0001'; end if;
  if (args->>'decision'='withdraw' and attempt.sender_profile_id<>actor) or (args->>'decision'<>'withdraw' and attempt.recipient_profile_id<>actor) then raise exception 'message unavailable' using errcode='P0001'; end if;
  if attempt.status<>'pending' then
   if attempt.status=(case args->>'decision' when 'accept' then 'accepted' when 'decline' then 'declined' else 'withdrawn' end) then return '{}'::jsonb; end if;
   raise exception 'message consent conflicts' using errcode='P0001';
  end if;
  if args->>'decision'='accept' and not app.mail_general_eligible(c) then raise exception 'message unavailable' using errcode='P0001'; end if;
  update app.message_consents set status=case args->>'decision' when 'accept' then 'accepted' when 'decline' then 'declined' else 'withdrawn' end,decided_at=statement_timestamp() where message_consents.id=attempt.id;
  if args->>'decision'='accept' then
   perform app.mail_append(c,null,attempt.sender_profile_id,'text',attempt.first_body,attempt.id,null,null,attempt.created_at);
  end if;
  return '{}'::jsonb;
 end if;
 if action='read' then
  n:=(args->>'through')::integer;
  if n is null or n<0 or n>c.last_seq then raise exception 'message invalid read position' using errcode='P0001'; end if;
  insert into app.message_reads(conversation_id,profile_id,last_seq) values(c.id,actor,n) on conflict(conversation_id,profile_id) do update set last_seq=greatest(message_reads.last_seq,excluded.last_seq);
  return '{}'::jsonb;
 end if;
 if action='thread' then
  select coalesce(r.last_seq,0) into last_read from (select 1) dummy left join app.message_reads r on r.conversation_id=c.id and r.profile_id=actor;
  before_seq:=nullif(args->>'before','')::integer; after_seq:=nullif(args->>'after','')::integer;
  if (before_seq is not null and before_seq<1) or (after_seq is not null and after_seq<0) or (before_seq is not null and after_seq is not null) then raise exception 'message invalid cursor' using errcode='P0001'; end if;
  if after_seq is null and before_seq is null then after_seq:=greatest(0,least(last_read,c.last_seq-50)); end if;
  select coalesce(jsonb_agg(v.data order by v.seq),'[]'::jsonb) into items from (
   select e.seq,jsonb_build_object('id',e.id,'seq',e.seq,'senderProfileId',e.sender_profile_id,'kind',e.kind,'body',e.body,'createdAt',e.created_at,'contextId',e.context_id,'status',e.status_label) data
   from app.message_entries e where e.conversation_id=c.id and (after_seq is null or e.seq>after_seq) and (before_seq is null or e.seq<before_seq)
   order by case when before_seq is null then e.seq else -e.seq end limit 50) v;
  return jsonb_build_object('conversation',app.mail_conversation_projection(c,actor),'entries',items,'lastSeq',c.last_seq,'readThrough',last_read,
   'contexts',(select coalesce(jsonb_agg(app.mail_context_projection(c,x) order by x.created_at,x.id),'[]'::jsonb) from (select x.* from app.message_contexts x where conversation_id=c.id order by exists(select 1 from jsonb_array_elements(items) e where e->>'contextId'=x.id::text) desc,created_at desc,id desc limit 50) x));
 end if;
 raise exception 'message invalid operation' using errcode='P0001';
end $$;


ALTER FUNCTION app.mail_dispatch_before_session_labels(action text, args jsonb) OWNER TO app_owner;

--
-- Name: mail_ensure_context(app.message_conversations, text, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_ensure_context(c app.message_conversations, kind text, source uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare ctx app.message_contexts; begin
 if kind not in ('inquiry','request','booking') or (kind='inquiry')<>(source is null) then raise exception 'message unavailable' using errcode='P0001'; end if;
 -- Validate original entity ownership; no scheduling-row locks are acquired here.
 if kind='request' and not exists(select 1 from app.coach_booking_requests r where r.id=source and r.run_id=c.run_id and r.coach_profile_id=c.coach_profile_id and r.client_profile_id=c.athlete_profile_id) then raise exception 'message unavailable' using errcode='P0001'; end if;
 if kind='booking' and not exists(select 1 from app.coach_private_bookings b where b.id=source and b.run_id=c.run_id and b.coach_profile_id=c.coach_profile_id and b.client_profile_id=c.athlete_profile_id) then raise exception 'message unavailable' using errcode='P0001'; end if;
 insert into app.message_contexts(conversation_id,kind,source_id) values(c.id,kind,source) on conflict do nothing;
 select * into strict ctx from app.message_contexts x where x.conversation_id=c.id and x.kind=mail_ensure_context.kind and x.source_id is not distinct from source;
 return ctx.id;
end $$;


ALTER FUNCTION app.mail_ensure_context(c app.message_conversations, kind text, source uuid) OWNER TO app_owner;

--
-- Name: mail_ensure_conversation(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_ensure_conversation(run uuid, coach uuid, athlete uuid) RETURNS app.message_conversations
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare c app.message_conversations; begin
 perform app.mail_lock_pair(run,coach,athlete);
 if coach=athlete or not exists(select 1 from app.coach_profiles p where p.run_id=run and p.profile_id=coach)
 or not exists(select 1 from app.demo_run_participants p where p.run_id=run and p.profile_id=athlete) then raise exception 'message unavailable' using errcode='P0001'; end if;
 insert into app.message_conversations(run_id,coach_profile_id,athlete_profile_id) values(run,coach,athlete) on conflict(run_id,coach_profile_id,athlete_profile_id) do nothing;
 select * into strict c from app.message_conversations where run_id=run and coach_profile_id=coach and athlete_profile_id=athlete;
 return c;
end $$;


ALTER FUNCTION app.mail_ensure_conversation(run uuid, coach uuid, athlete uuid) OWNER TO app_owner;

--
-- Name: mail_flags(boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_flags(enabled boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ begin
 perform app.connection_access_flags(enabled);
 perform set_config('app.message_management',case when enabled then 'on' else 'off' end,true);
end $$;


ALTER FUNCTION app.mail_flags(enabled boolean) OWNER TO app_owner;

--
-- Name: mail_general_allowed(app.message_conversations); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_general_allowed(c app.message_conversations) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select not app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id) and app.mail_coach_enabled(c) and (
 exists(select 1 from app.coach_athlete_connection_pairs p join app.coach_athlete_connection_attempts a on a.pair_id=p.id
 where p.run_id=c.run_id and p.coach_profile_id=c.coach_profile_id and p.athlete_profile_id=c.athlete_profile_id and a.status='accepted')
 or exists(select 1 from app.message_consents a where a.conversation_id=c.id and a.status='accepted'))
$$;


ALTER FUNCTION app.mail_general_allowed(c app.message_conversations) OWNER TO app_owner;

--
-- Name: mail_general_eligible(app.message_conversations); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_general_eligible(c app.message_conversations) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select app.mail_coach_enabled(c) and not app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id) and exists(
 select 1 from app.coach_private_bookings b where b.run_id=c.run_id and b.coach_profile_id=c.coach_profile_id and b.client_profile_id=c.athlete_profile_id and b.credit_projection_id is null and b.status in ('confirmed','completed'))
$$;


ALTER FUNCTION app.mail_general_eligible(c app.message_conversations) OWNER TO app_owner;

--
-- Name: mail_guard_consent_submission(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_guard_consent_submission() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if new.kind='text' and exists(
  select 1 from app.message_consents a where a.conversation_id=new.conversation_id and a.sender_profile_id=new.sender_profile_id and a.id=new.submission_id
  and (a.status<>'accepted' or new.context_id is not null or a.first_body is distinct from new.body or a.created_at is distinct from new.created_at)
 ) then raise exception 'message submission conflicts' using errcode='P0001'; end if;
 return new;
end $$;


ALTER FUNCTION app.mail_guard_consent_submission() OWNER TO app_owner;

--
-- Name: mail_lock_pair(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_lock_pair(run uuid, a uuid, b uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$
 select pg_advisory_xact_lock(hashtextextended('mail:'||run::text||':'||least(a,b)::text||':'||greatest(a,b)::text,0))
$$;


ALTER FUNCTION app.mail_lock_pair(run uuid, a uuid, b uuid) OWNER TO app_owner;

--
-- Name: mail_rate(app.message_conversations, uuid, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_rate(c app.message_conversations, actor uuid, first_contact boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare per_pair integer; per_actor integer; new_pairs integer; begin
 -- Consent opening text counts immediately, before its eventual acceptance. Union
 -- deduplicates the same submission after it becomes an accepted text entry.
 with sends as (
  select e.conversation_id,e.submission_id,e.created_at from app.message_entries e join app.message_conversations v on v.id=e.conversation_id where e.sender_profile_id=actor and e.kind='text' and v.run_id=c.run_id
  union select a.conversation_id,a.id,a.created_at from app.message_consents a join app.message_conversations v on v.id=a.conversation_id where a.sender_profile_id=actor and v.run_id=c.run_id
 ) select count(*) filter(where conversation_id=c.id),count(*) into per_pair,per_actor from sends where created_at>statement_timestamp()-interval '1 minute';
 if per_pair>=20 or per_actor>=100 then raise exception 'message rate limited' using errcode='P0001'; end if;
 if first_contact then
  with sends as (
   select e.conversation_id,e.created_at from app.message_entries e join app.message_conversations v on v.id=e.conversation_id where e.sender_profile_id=actor and e.kind='text' and v.run_id=c.run_id
   union all select a.conversation_id,a.created_at from app.message_consents a join app.message_conversations v on v.id=a.conversation_id where a.sender_profile_id=actor and v.run_id=c.run_id
  ), firsts as (select conversation_id,min(created_at) at_time from sends group by conversation_id)
  select count(*) into new_pairs from firsts where at_time>statement_timestamp()-interval '24 hours' and conversation_id<>c.id;
  if new_pairs>=10 and not exists(select 1 from app.message_entries where conversation_id=c.id and sender_profile_id=actor and kind='text') and not exists(select 1 from app.message_consents where conversation_id=c.id and sender_profile_id=actor) then raise exception 'message rate limited' using errcode='P0001'; end if;
 end if;
end $$;


ALTER FUNCTION app.mail_rate(c app.message_conversations, actor uuid, first_contact boolean) OWNER TO app_owner;

--
-- Name: mail_request_activity(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_request_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare flags jsonb; sender uuid:=nullif(current_setting('app.current_profile_id',true),'')::uuid; begin
 flags:=app.mail_trigger_enter();
 if tg_op='INSERT' then
  perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,'request',new.id,'request:'||new.id::text||':created',new.status,new.client_profile_id,new.created_at,'request');
 elsif old.status is distinct from new.status then
  perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,'request',new.id,'request:'||new.id::text||':'||new.status,new.status,sender,statement_timestamp(),'status');
 end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;


ALTER FUNCTION app.mail_request_activity() OWNER TO app_owner;

--
-- Name: mail_request_guard(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_request_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare flags jsonb; begin
 perform app.mail_source_lock(new.run_id,new.coach_profile_id,new.client_profile_id);flags:=app.mail_trigger_enter();
 if (tg_op='INSERT' or (new.status='accepted' and old.status is distinct from new.status)) and app.mail_blocked(new.run_id,new.coach_profile_id,new.client_profile_id) then raise exception 'message unavailable: blocked session request' using errcode='P0001'; end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;


ALTER FUNCTION app.mail_request_guard() OWNER TO app_owner;

--
-- Name: coach_private_bookings; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_private_bookings (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    slot_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    client_profile_id uuid NOT NULL,
    credit_projection_id uuid,
    status text NOT NULL,
    scheduled_start_at timestamp with time zone NOT NULL,
    scheduled_end_at timestamp with time zone NOT NULL,
    early_return_until timestamp with time zone NOT NULL,
    hold_expires_at timestamp with time zone NOT NULL,
    cancellation_requested_at timestamp with time zone,
    cancellation_decision text,
    cancellation_decided_at timestamp with time zone,
    cancellation_decided_by_profile_id uuid,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    expired_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_by_profile_id uuid,
    CONSTRAINT coach_private_bookings_decision_check CHECK (((cancellation_decision IS NULL) OR (cancellation_decision = ANY (ARRAY['approved'::text, 'denied'::text])))),
    CONSTRAINT coach_private_bookings_decision_state_check CHECK ((((cancellation_decision IS NULL) AND (cancellation_decided_at IS NULL) AND (cancellation_decided_by_profile_id IS NULL)) OR ((cancellation_decision IS NOT NULL) AND (cancellation_requested_at IS NOT NULL) AND (cancellation_decided_at IS NOT NULL) AND (cancellation_decided_by_profile_id = coach_profile_id)))),
    CONSTRAINT coach_private_bookings_direct_cancellation_check CHECK (((credit_projection_id IS NOT NULL) OR ((status = 'cancelled'::text) = (cancelled_by_profile_id IS NOT NULL)))),
    CONSTRAINT coach_private_bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancellation-requested'::text, 'cancelled'::text, 'completed'::text, 'denied'::text, 'expired'::text]))),
    CONSTRAINT coach_private_bookings_terminal_state_check CHECK ((((status = 'cancelled'::text) = (cancelled_at IS NOT NULL)) AND ((status = 'completed'::text) = (completed_at IS NOT NULL)) AND ((status = 'expired'::text) = (expired_at IS NOT NULL)))),
    CONSTRAINT coach_private_bookings_time_check CHECK ((((scheduled_end_at - scheduled_start_at) = '01:00:00'::interval) AND (early_return_until <= scheduled_start_at) AND (hold_expires_at > created_at)))
);

ALTER TABLE ONLY app.coach_private_bookings FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_private_bookings OWNER TO app_owner;

--
-- Name: TABLE coach_private_bookings; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_private_bookings IS 'Capacity-one application booking and human cancellation-decision workflow.';


--
-- Name: mail_session_details(app.coach_private_bookings); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_session_details(b app.coach_private_bookings) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare c app.message_conversations; ctx app.message_contexts; editable boolean:=false; begin
 select * into c from app.message_conversations where run_id=b.run_id and coach_profile_id=b.coach_profile_id and athlete_profile_id=b.client_profile_id;
 -- No empty conversation is needed to read a title or an untitled legacy booking.
 if c.id is null then
  c.id:=b.id;c.run_id:=b.run_id;c.coach_profile_id:=b.coach_profile_id;c.athlete_profile_id:=b.client_profile_id;
 end if;
 ctx.conversation_id:=c.id;ctx.kind:='booking';ctx.source_id:=b.id;
 editable:=app.mail_context_allowed(c,ctx);
 return jsonb_build_object('title',coalesce((select title from app.private_session_titles where booking_id=b.id),''),
  'titleRevision',coalesce((select revision from app.private_session_titles where booking_id=b.id),0),
  'canEditTitle',b.status in ('confirmed','completed') and editable);
end $$;


ALTER FUNCTION app.mail_session_details(b app.coach_private_bookings) OWNER TO app_owner;

--
-- Name: mail_source_event(uuid, uuid, uuid, text, uuid, text, text, uuid, timestamp with time zone, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_source_event(run uuid, coach uuid, athlete uuid, kind text, source uuid, event text, label text, sender uuid, at_time timestamp with time zone, entry_kind text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare c app.message_conversations; ctx uuid; begin
 c:=app.mail_ensure_conversation(run,coach,athlete);ctx:=app.mail_ensure_context(c,kind,source);
 if sender not in(coach,athlete) then sender:=null; end if;
 perform app.mail_append(c,ctx,sender,entry_kind,null,null,event,label,at_time);
end $$;


ALTER FUNCTION app.mail_source_event(run uuid, coach uuid, athlete uuid, kind text, source uuid, event text, label text, sender uuid, at_time timestamp with time zone, entry_kind text) OWNER TO app_owner;

--
-- Name: mail_source_lock(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_source_lock(run uuid, a uuid, b uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ begin
 if not pg_try_advisory_xact_lock(hashtextextended('mail:'||run::text||':'||least(a,b)::text||':'||greatest(a,b)::text,0)) then raise exception 'message pair changed; retry operation' using errcode='40001'; end if;
end $$;


ALTER FUNCTION app.mail_source_lock(run uuid, a uuid, b uuid) OWNER TO app_owner;

--
-- Name: mail_trigger_enter(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_trigger_enter() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare flags jsonb:='{}'::jsonb; flag text; begin
 foreach flag in array array['app.coach_connection_management','app.coach_profile_management','app.coach_application_management','app.coach_booking_management','app.coach_availability_management','app.coach_booking_request_management','app.profile_media_management','app.message_management'] loop
  flags:=flags||jsonb_build_object(flag,coalesce(current_setting(flag,true),''));
 end loop;
 perform app.mail_flags(true); return flags;
end $$;


ALTER FUNCTION app.mail_trigger_enter() OWNER TO app_owner;

--
-- Name: mail_trigger_leave(jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_trigger_leave(flags jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare flag record; begin for flag in select * from jsonb_each_text(flags) loop perform set_config(flag.key,flag.value,true); end loop; end $$;


ALTER FUNCTION app.mail_trigger_leave(flags jsonb) OWNER TO app_owner;

--
-- Name: mail_valid_body(text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mail_valid_body(body text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select body is not null and char_length(body) between 1 and 4000 and octet_length(body)<=16000
 and regexp_replace(body,'[[:space:]'||U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'||']','','g')<>''
$$;


ALTER FUNCTION app.mail_valid_body(body text) OWNER TO app_owner;

--
-- Name: mark_booking_credit_operation_submitted(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mark_booking_credit_operation_submitted(requested_operation_id uuid, submitted_transaction_signature text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or submitted_transaction_signature
      !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking submitted operation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;
  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
  end if;

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if selected_operation.id is null
    or (
      selected_operation.authority_address is not null
      and (
        active_wallet_address is null
        or active_wallet_address <> selected_operation.authority_address
      )
    )
    or (
      selected_operation.kind = 'reserve'
      and selected_booking.client_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking submitted operation is unauthorized';
  end if;

  if selected_operation.status = 'finalized'
    and selected_operation.transaction_signature
      = submitted_transaction_signature
  then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_operation.id;
  end if;

  if selected_operation.status = 'submitted' then
    if selected_operation.transaction_signature
      <> submitted_transaction_signature
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking operation has another transaction';
    end if;
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_operation.id;
  end if;

  if selected_operation.status <> 'prepared' then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation cannot be submitted';
  end if;

  update app.coach_booking_credit_operations
  set
    status = 'submitted',
    transaction_signature = submitted_transaction_signature,
    submitted_at = statement_timestamp()
  where id = selected_operation.id;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.mark_booking_credit_operation_submitted(requested_operation_id uuid, submitted_transaction_signature text) OWNER TO app_owner;

--
-- Name: mark_coach_pass_purchase_submitted(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mark_coach_pass_purchase_submitted(requested_operation_id uuid, submitted_transaction_signature text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_pass_purchase_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or submitted_transaction_signature
      !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase submission is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);
  select operation.*
  into selected_operation
  from app.coach_pass_purchase_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.client_profile_id = profile_id_text::uuid
  for update;

  if selected_operation.id is null
    or (
      selected_operation.status = 'submitted'
      and selected_operation.transaction_signature
        <> submitted_transaction_signature
    )
    or selected_operation.status not in ('prepared', 'submitted')
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase cannot be submitted';
  end if;

  update app.coach_pass_purchase_operations
  set
    status = 'submitted',
    transaction_signature = submitted_transaction_signature,
    submitted_at = coalesce(submitted_at, statement_timestamp())
  where id = selected_operation.id;

  perform set_config('app.coach_pass_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.mark_coach_pass_purchase_submitted(requested_operation_id uuid, submitted_transaction_signature text) OWNER TO app_owner;

--
-- Name: mark_group_event_operation_submitted(uuid, text); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.mark_group_event_operation_submitted(requested_operation_id uuid, requested_transaction_signature text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  then
    raise exception using errcode = 'P0001', message = 'group event submission is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  update app.group_event_chain_operations
  set
    status = 'submitted',
    transaction_signature = requested_transaction_signature,
    submitted_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and actor_profile_id = profile_id_text::uuid
    and status = 'prepared';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event submission conflicts';
  end if;
  perform set_config('app.group_event_operation_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.group_event_operation_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.mark_group_event_operation_submitted(requested_operation_id uuid, requested_transaction_signature text) OWNER TO postgres;

--
-- Name: mark_group_event_projection_availability(uuid, text, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.mark_group_event_projection_availability(requested_event_id uuid, requested_program_address text, requested_event_pool_address text, requested_availability text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  affected_rows integer;
begin
  if requested_availability not in ('pending', 'unavailable') then
    raise exception using errcode = 'P0001', message = 'group event projection availability is invalid';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events
  set
    projection_availability = requested_availability,
    projection_status_updated_at = pg_catalog.statement_timestamp()
  where id = requested_event_id
    and program_address = requested_program_address
    and event_pool_address = requested_event_pool_address
    and projection_availability <> 'unbound';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event projection is unavailable';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.mark_group_event_projection_availability(requested_event_id uuid, requested_program_address text, requested_event_pool_address text, requested_availability text) OWNER TO app_owner;

--
-- Name: message_command(text, jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.message_command(action text, args jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb; begin
 if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>32768 then raise exception 'message unavailable' using errcode='P0001'; end if;
 perform app.mail_flags(true);
 result:=app.mail_dispatch(action,args);
 perform app.mail_flags(false);
 return result;
exception when others then perform app.mail_flags(false); raise;
end $$;


ALTER FUNCTION app.message_command(action text, args jsonb) OWNER TO app_owner;

--
-- Name: prepare_credit_backed_private_booking(uuid, uuid, uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.prepare_credit_backed_private_booking(requested_booking_id uuid, requested_slot_id uuid, requested_credit_projection_id uuid, requested_reservation_address text) RETURNS TABLE(booking_id uuid, operation_id uuid, booking_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_wallet_address text;
  selected_projection app.coach_client_credit_projections%rowtype;
  selected_slot app.coach_availability_slots%rowtype;
  selected_coach app.coach_profiles%rowtype;
  existing_booking app.coach_private_bookings%rowtype;
  created_operation_id uuid;
  pending_hold_count bigint;
  resolved_hold_expiry timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
    or requested_slot_id is null
    or requested_credit_projection_id is null
    or requested_reservation_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.wallet_management', 'on', true);
  perform set_config('app.coach_profile_management', 'on', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select binding.wallet_address
  into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active'
  for share;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = requested_credit_projection_id
    and projection.run_id = run_id_text::uuid
    and projection.client_profile_id = profile_id_text::uuid
    and projection.client_wallet_address = selected_wallet_address
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking credit projection is unavailable';
  end if;

  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.id = requested_slot_id
    and slot.run_id = run_id_text::uuid
    and slot.profile_id = selected_projection.coach_profile_id
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
      and existing_booking.credit_projection_id = selected_projection.id
      and existing_booking.status in ('pending', 'confirmed')
    then
      select operation.id
      into created_operation_id
      from app.coach_booking_credit_operations as operation
      where operation.booking_id = existing_booking.id
        and operation.kind = 'reserve';
      return query select
        existing_booking.id,
        created_operation_id,
        existing_booking.status;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'coach booking slot is already reserved';
  end if;

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = selected_projection.coach_profile_id
    and coach.visibility = 'visible'
  for share;

  if selected_wallet_address is null
    or selected_slot.id is null
    or selected_slot.status <> 'open'
    or selected_slot.starts_at <= statement_timestamp()
    or selected_slot.ends_at - selected_slot.starts_at <> interval '1 hour'
    or selected_coach.profile_id is null
    or selected_coach.profile_id = profile_id_text::uuid
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking slot is unavailable';
  end if;

  select count(*)
  into pending_hold_count
  from app.coach_private_bookings as booking
  where booking.credit_projection_id = selected_projection.id
    and booking.status = 'pending'
    and booking.hold_expires_at > statement_timestamp();

  if selected_projection.available_credits <= pending_hold_count then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking has no unpromised credit';
  end if;

  resolved_hold_expiry := least(
    statement_timestamp() + interval '10 minutes',
    selected_slot.starts_at
  );
  if resolved_hold_expiry <= statement_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold cannot be created';
  end if;

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
    requested_booking_id,
    run_id_text::uuid,
    selected_slot.id,
    selected_slot.profile_id,
    profile_id_text::uuid,
    selected_projection.id,
    'pending',
    selected_slot.starts_at,
    selected_slot.ends_at,
    selected_slot.starts_at
      - make_interval(mins => selected_coach.early_cancellation_minutes),
    resolved_hold_expiry
  );

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    run_id_text::uuid,
    requested_booking_id,
    selected_projection.id,
    'reserve',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    requested_reservation_address,
    selected_slot.starts_at,
    selected_slot.starts_at
      - make_interval(mins => selected_coach.early_cancellation_minutes)
  )
  returning id into created_operation_id;

  update app.coach_availability_slots
  set status = 'held'
  where id = selected_slot.id;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return query select requested_booking_id, created_operation_id, 'pending'::text;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.prepare_credit_backed_private_booking(requested_booking_id uuid, requested_slot_id uuid, requested_credit_projection_id uuid, requested_reservation_address text) OWNER TO app_owner;

--
-- Name: prepare_owned_private_booking_consumption(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.prepare_owned_private_booking_consumption(requested_booking_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  selected_operation app.coach_booking_credit_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking consumption request is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.coach_profile_id = profile_id_text::uuid
  for update;

  if not found
    or selected_booking.status not in ('confirmed', 'denied')
    or selected_booking.scheduled_start_at > statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cannot be consumed';
  end if;

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'consume';
  if found then
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_operation.id;
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = selected_booking.credit_projection_id
  for update;
  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
    and operation.status = 'finalized';

  if selected_projection.id is null or reserve_operation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized reservation is unavailable';
  end if;

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    selected_booking.run_id,
    selected_booking.id,
    selected_projection.id,
    'consume',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    selected_booking.scheduled_start_at,
    selected_booking.early_return_until
  )
  returning * into selected_operation;

  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.prepare_owned_private_booking_consumption(requested_booking_id uuid) OWNER TO app_owner;

--
-- Name: protect_recurring_coach_availability_occurrence(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.protect_recurring_coach_availability_occurrence() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.protect_recurring_coach_availability_occurrence() OWNER TO app_owner;

--
-- Name: public_group_sessions(text, jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.public_group_sessions(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare dataset uuid; candidate uuid; entries jsonb; result jsonb; after_at timestamptz; after_id uuid; activity app.coach_group_sessions;
begin
  if jsonb_typeof(args) is distinct from 'object' or pg_column_size(args) > 16384 or coalesce(char_length(args->>'location'),0) > 160 then raise exception 'group filters are invalid' using errcode = 'P0001'; end if;
  perform app.group_session_flags(true);
  select id into dataset from app.demo_runs where status = 'active' and catalogue_visibility = 'public';
  after_at := (args->'after'->>'at')::timestamptz; after_id := (args->'after'->>'id')::uuid;
  if (after_at is null) <> (after_id is null) or (after_at is not null and not isfinite(after_at)) then raise exception 'group cursor is invalid' using errcode = 'P0001'; end if;
  if action = 'list' then
    for candidate in select id from app.coach_group_sessions where run_id = dataset and status = 'open' and decision_deadline_at <= clock_timestamp() order by id limit 100 loop perform app.group_reconcile_session(candidate); end loop;
    select jsonb_agg(jsonb_build_object('item',app.group_session_projection(s.id,null),'cursor',jsonb_build_object('at',s.starts_at,'id',s.id)) order by s.starts_at,s.id) into entries
      from (select * from app.coach_group_sessions where run_id = dataset and status in ('open','confirmed') and starts_at > clock_timestamp()
        and (status = 'confirmed' or decision_deadline_at > clock_timestamp()) and app.group_coach_enabled(run_id,coach_profile_id,true)
        and (nullif(args->>'discipline','') is null or discipline = args->>'discipline')
        and strpos(lower(venue_snapshot->>'name' || ' ' || (venue_snapshot->>'label')),lower(coalesce(args->>'location',''))) > 0
        and (after_at is null or (starts_at,id) > (after_at,after_id)) order by starts_at,id limit 21) s;
    result := app.group_page(entries,20);
  elsif action = 'detail' then
    select * into activity from app.coach_group_sessions where run_id = dataset and slug = args->>'slug' and status <> 'draft';
    if found and app.group_coach_enabled(dataset,activity.coach_profile_id,true) then
      activity := app.group_reconcile_session(activity.id);
      result := jsonb_build_object('session',app.group_session_projection(activity.id,null));
    else result := jsonb_build_object('session',null); end if;
  else raise exception 'group action is unavailable' using errcode = 'P0001'; end if;
  perform app.group_session_flags(false);
  return result;
end;
$$;


ALTER FUNCTION app.public_group_sessions(action text, args jsonb) OWNER TO app_owner;

--
-- Name: publish_group_session(uuid, integer); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.publish_group_session(requested_id uuid, expected_revision integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.publish_group_session(requested_id uuid, expected_revision integer) OWNER TO app_owner;

--
-- Name: publish_owned_group_event(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.publish_owned_group_event(requested_event_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;
  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events as event
  set publication_status = 'published', published_at = pg_catalog.statement_timestamp()
  where event.id = requested_event_id
    and event.run_id = run_id_text::uuid
    and event.coach_profile_id = profile_id_text::uuid
    and event.publication_status = 'draft'
    and event.projection_availability = 'current'
    and event.starts_at > pg_catalog.statement_timestamp()
    and exists (
      select 1
      from app.group_event_pool_projections as projection
      where projection.event_id = event.id
        and projection.run_id = event.run_id
        and projection.program_address = event.program_address
        and projection.event_pool_address = event.event_pool_address
    );
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event is not ready to publish';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.publish_owned_group_event(requested_event_id uuid) OWNER TO app_owner;

--
-- Name: record_booking_credit_operation_preparation(uuid, text, jsonb, text, text, text, bigint, bigint, bigint); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or jsonb_typeof(requested_summary) <> 'object'
    or char_length(requested_transaction_base64) not between 4 and 2000
    or char_length(requested_message_base64) not between 4 and 2000
    or requested_recent_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_last_valid_block_height < 0
    or requested_simulation_slot < 0
    or requested_simulation_units < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;
  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
  end if;

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if selected_operation.id is null
    or active_wallet_address is null
    or active_wallet_address <> requested_authority_address
    or (
      selected_operation.kind = 'reserve'
      and (
        selected_booking.client_profile_id <> profile_id_text::uuid
        or selected_operation.client_wallet_address
          <> requested_authority_address
      )
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
    or selected_operation.status in ('submitted', 'finalized')
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation preparation is unauthorized';
  end if;

  update app.coach_booking_credit_operations
  set
    status = 'prepared',
    authority_address = requested_authority_address,
    prepared_summary = requested_summary,
    prepared_transaction_base64 = requested_transaction_base64,
    prepared_message_base64 = requested_message_base64,
    recent_blockhash = requested_recent_blockhash,
    last_valid_block_height = requested_last_valid_block_height,
    prepared_at = statement_timestamp(),
    simulation_slot = requested_simulation_slot,
    simulation_units_consumed = requested_simulation_units,
    prior_transaction_signatures = case
      when transaction_signature is null then prior_transaction_signatures
      else array_append(prior_transaction_signatures, transaction_signature)
    end,
    transaction_signature = null,
    submitted_at = null,
    failure_code = null,
    failed_at = null
  where id = selected_operation.id;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) OWNER TO app_owner;

--
-- Name: FUNCTION record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) IS 'Persists the simulated exact transaction for an authorized booking-credit operation and supports safe re-preparation after a terminal failed attempt.';


--
-- Name: record_coach_pass_purchase_preparation(uuid, uuid, text, text, text, text, text, text, bigint, smallint, bigint, boolean, bigint, bigint, bigint, bigint, jsonb, text, text, text, bigint, bigint, bigint); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.record_coach_pass_purchase_preparation(requested_operation_id uuid, requested_coach_profile_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_offer_address text, requested_credits_address text, requested_price bigint, requested_credits smallint, requested_expected_nonce bigint, requested_baseline_ledger_exists boolean, requested_baseline_available bigint, requested_baseline_reserved bigint, requested_baseline_total bigint, requested_baseline_purchase_count bigint, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  active_wallet_address text;
  saved_operation_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_coach_profile_id is null
    or requested_operation_kind not in (
      'purchase-first-offer',
      'purchase-offer'
    )
    or requested_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_coach_authority_address
      !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_offer_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_credits_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_price <= 0
    or requested_credits not in (1, 10)
    or requested_expected_nonce < 0
    or requested_baseline_available not between 0 and 9000000000000000
    or requested_baseline_reserved not between 0 and 9000000000000000
    or requested_baseline_total not between 0 and 9000000000000000
    or requested_baseline_purchase_count < 0
    or requested_baseline_available + requested_baseline_reserved
      > requested_baseline_total
    or jsonb_typeof(requested_summary) <> 'object'
    or char_length(requested_transaction_base64) not between 4 and 2000
    or char_length(requested_message_base64) not between 4 and 2000
    or requested_recent_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_last_valid_block_height < 0
    or requested_simulation_slot < 0
    or requested_simulation_units < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);
  perform set_config('app.coach_profile_management', 'on', true);

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if active_wallet_address is null
    or active_wallet_address <> requested_authority_address
    or requested_coach_profile_id = profile_id_text::uuid
    or not exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = run_id_text::uuid
        and coach.profile_id = requested_coach_profile_id
        and coach.visibility = 'visible'
    )
    or requested_baseline_ledger_exists
      <> (requested_operation_kind = 'purchase-offer')
    or (
      not requested_baseline_ledger_exists
      and (
        requested_expected_nonce <> 0
        or requested_baseline_available <> 0
        or requested_baseline_reserved <> 0
        or requested_baseline_total <> 0
        or requested_baseline_purchase_count <> 0
      )
    )
    or (
      select count(*)
      from app.coach_pass_purchase_operations as recent
      where recent.run_id = run_id_text::uuid
        and recent.client_profile_id = profile_id_text::uuid
        and recent.created_at > statement_timestamp() - interval '1 minute'
    ) >= 6
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase preparation is unauthorized';
  end if;

  insert into app.coach_pass_purchase_operations (
    id,
    run_id,
    client_profile_id,
    coach_profile_id,
    status,
    operation_kind,
    program_address,
    authority_address,
    coach_authority_address,
    offer_address,
    client_wallet_address,
    coach_client_credits_address,
    price_eurc_base_units,
    credits_purchased,
    expected_purchase_nonce,
    baseline_ledger_exists,
    baseline_available_credits,
    baseline_reserved_credits,
    baseline_total_purchased,
    baseline_purchase_count,
    prepared_summary,
    prepared_transaction_base64,
    prepared_message_base64,
    recent_blockhash,
    last_valid_block_height,
    simulation_slot,
    simulation_units_consumed
  ) values (
    requested_operation_id,
    run_id_text::uuid,
    profile_id_text::uuid,
    requested_coach_profile_id,
    'prepared',
    requested_operation_kind,
    requested_program_address,
    requested_authority_address,
    requested_coach_authority_address,
    requested_offer_address,
    requested_authority_address,
    requested_credits_address,
    requested_price,
    requested_credits,
    requested_expected_nonce,
    requested_baseline_ledger_exists,
    requested_baseline_available,
    requested_baseline_reserved,
    requested_baseline_total,
    requested_baseline_purchase_count,
    requested_summary,
    requested_transaction_base64,
    requested_message_base64,
    requested_recent_blockhash,
    requested_last_valid_block_height,
    requested_simulation_slot,
    requested_simulation_units
  )
  on conflict (
    run_id,
    client_profile_id,
    coach_profile_id,
    offer_address,
    expected_purchase_nonce,
    recent_blockhash
  ) do update
  set prepared_summary = excluded.prepared_summary
  where coach_pass_purchase_operations.status = 'prepared'
    and coach_pass_purchase_operations.transaction_signature is null
  returning id into saved_operation_id;

  if saved_operation_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase attempt is already submitted';
  end if;

  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_pass_management', 'off', true);
  return saved_operation_id;
exception
  when others then
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.record_coach_pass_purchase_preparation(requested_operation_id uuid, requested_coach_profile_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_offer_address text, requested_credits_address text, requested_price bigint, requested_credits smallint, requested_expected_nonce bigint, requested_baseline_ledger_exists boolean, requested_baseline_available bigint, requested_baseline_reserved bigint, requested_baseline_total bigint, requested_baseline_purchase_count bigint, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) OWNER TO app_owner;

--
-- Name: record_group_event_operation_preparation(uuid, uuid, text, text, text, text, text, text, text, jsonb, text, text, text, bigint, bigint, bigint); Type: FUNCTION; Schema: app; Owner: postgres
--

CREATE FUNCTION app.record_group_event_operation_preparation(requested_operation_id uuid, requested_event_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_event_pool_address text, requested_vault_address text, requested_contribution_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_event app.group_events%rowtype;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_operation_kind not in (
      'create-event-pool',
      'fund-event-seat',
      'settle-event-pool',
      'claim-event-payout',
      'claim-event-refund'
    )
    or requested_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_vault_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or (
      requested_operation_kind in ('fund-event-seat', 'claim-event-refund')
      and requested_contribution_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    )
    or (
      requested_operation_kind not in ('fund-event-seat', 'claim-event-refund')
      and requested_contribution_address is not null
    )
    or jsonb_typeof(requested_summary) <> 'object'
    or char_length(requested_transaction_base64) not between 4 and 2000
    or char_length(requested_message_base64) not between 4 and 2000
    or requested_recent_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_last_valid_block_height < 0
    or requested_simulation_slot < 0
    or requested_simulation_units < 0
  then
    raise exception using errcode = 'P0001', message = 'group event preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_management', 'on', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);

  select event.* into selected_event
  from app.group_events as event
  where event.id = requested_event_id
    and event.run_id = run_id_text::uuid
  for update;

  select binding.wallet_address into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if selected_event.id is null
    or active_wallet_address is null
    or active_wallet_address <> requested_authority_address
    or (
      requested_operation_kind in ('create-event-pool', 'fund-event-seat')
      and selected_event.starts_at <= statement_timestamp()
    )
    or (
      requested_operation_kind in ('create-event-pool', 'claim-event-payout')
      and selected_event.coach_profile_id <> profile_id_text::uuid
    )
    or (
      requested_operation_kind = 'create-event-pool'
      and (
        selected_event.publication_status <> 'draft'
        or (
          selected_event.projection_availability <> 'unbound'
          and not (
            selected_event.projection_availability = 'pending'
            and selected_event.program_address = requested_program_address
            and selected_event.event_pool_address = requested_event_pool_address
            and selected_event.coach_wallet_address_snapshot = requested_authority_address
          )
        )
      )
    )
    or (
      requested_operation_kind <> 'create-event-pool'
      and (
        selected_event.program_address <> requested_program_address
        or selected_event.event_pool_address <> requested_event_pool_address
        or selected_event.projection_availability = 'unbound'
      )
    )
    or (
      requested_operation_kind in ('fund-event-seat', 'settle-event-pool')
      and selected_event.publication_status <> 'published'
    )
  then
    raise exception using errcode = 'P0001', message = 'group event preparation is unauthorized';
  end if;

  if requested_operation_kind = 'create-event-pool'
    and selected_event.projection_availability = 'unbound'
  then
    update app.group_events
    set
      program_address = requested_program_address,
      event_pool_address = requested_event_pool_address,
      coach_wallet_address_snapshot = requested_authority_address,
      projection_availability = 'pending',
      projection_status_updated_at = statement_timestamp()
    where id = selected_event.id;
  end if;

  insert into app.group_event_chain_operations (
    id,
    run_id,
    event_id,
    actor_profile_id,
    operation_kind,
    status,
    program_address,
    authority_address,
    coach_authority_address,
    event_pool_address,
    vault_address,
    contribution_address,
    prepared_summary,
    prepared_transaction_base64,
    prepared_message_base64,
    recent_blockhash,
    last_valid_block_height,
    simulation_slot,
    simulation_units_consumed
  ) values (
    requested_operation_id,
    run_id_text::uuid,
    requested_event_id,
    profile_id_text::uuid,
    requested_operation_kind,
    'prepared',
    requested_program_address,
    requested_authority_address,
    requested_coach_authority_address,
    requested_event_pool_address,
    requested_vault_address,
    requested_contribution_address,
    requested_summary,
    requested_transaction_base64,
    requested_message_base64,
    requested_recent_blockhash,
    requested_last_valid_block_height,
    requested_simulation_slot,
    requested_simulation_units
  );

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.group_event_operation_management', 'off', true);
  perform set_config('app.group_event_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.group_event_operation_management', 'off', true);
    perform set_config('app.group_event_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.record_group_event_operation_preparation(requested_operation_id uuid, requested_event_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_event_pool_address text, requested_vault_address text, requested_contribution_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) OWNER TO postgres;

--
-- Name: record_verified_coach_credit_projection(uuid, text, text, text, text, bigint, bigint, bigint, bigint, bigint, text, timestamp with time zone, text, bigint); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.record_verified_coach_credit_projection(requested_coach_profile_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_purchase_count bigint, verified_next_purchase_nonce bigint, verified_last_offer_address text, verified_last_purchase_at timestamp with time zone, verified_transaction_signature text, verified_observed_slot bigint) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_wallet_address text;
  selected_projection app.coach_client_credit_projections%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_coach_profile_id is null
    or verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_client_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_credits_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_last_offer_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_available_credits not between 0 and 9000000000000000
    or verified_reserved_credits not between 0 and 9000000000000000
    or verified_total_purchased not between 0 and 9000000000000000
    or verified_available_credits + verified_reserved_credits
      > verified_total_purchased
    or verified_purchase_count not between 1 and 9000000000000000
    or verified_next_purchase_nonce not between 1 and 9000000000000000
    or verified_last_purchase_at is null
    or verified_observed_slot < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking credit projection evidence is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.wallet_management', 'on', true);
  perform set_config('app.coach_profile_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select binding.wallet_address
  into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active'
  for share;

  if selected_wallet_address is null
    or selected_wallet_address <> verified_client_wallet_address
    or requested_coach_profile_id = profile_id_text::uuid
    or not exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = run_id_text::uuid
        and coach.profile_id = requested_coach_profile_id
        and coach.visibility = 'visible'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking credit relationship is unauthorized';
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.run_id = run_id_text::uuid
    and projection.coach_profile_id = requested_coach_profile_id
    and projection.client_wallet_address = verified_client_wallet_address
  for update;

  if found then
    if selected_projection.client_profile_id <> profile_id_text::uuid
      or selected_projection.program_address <> verified_program_address
      or selected_projection.coach_authority_address
        <> verified_coach_authority_address
      or selected_projection.coach_client_credits_address
        <> verified_credits_address
      or verified_total_purchased < selected_projection.total_purchased
      or verified_purchase_count < selected_projection.purchase_count
      or verified_next_purchase_nonce < selected_projection.next_purchase_nonce
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking credit projection conflicts with authority';
    end if;

    if verified_observed_slot < selected_projection.observed_slot then
      perform set_config('app.wallet_management', 'off', true);
      perform set_config('app.coach_profile_management', 'off', true);
      perform set_config('app.coach_booking_management', 'off', true);
      return selected_projection.id;
    end if;

    if verified_observed_slot = selected_projection.observed_slot
      and (
        verified_available_credits <> selected_projection.available_credits
        or verified_reserved_credits <> selected_projection.reserved_credits
        or verified_total_purchased <> selected_projection.total_purchased
        or verified_purchase_count <> selected_projection.purchase_count
        or verified_next_purchase_nonce <> selected_projection.next_purchase_nonce
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking equal-slot projection conflicts with state';
    end if;

    update app.coach_client_credit_projections
    set
      available_credits = verified_available_credits,
      reserved_credits = verified_reserved_credits,
      total_purchased = verified_total_purchased,
      purchase_count = verified_purchase_count,
      next_purchase_nonce = verified_next_purchase_nonce,
      last_offer_address = verified_last_offer_address,
      last_purchase_at = verified_last_purchase_at,
      transaction_signature = verified_transaction_signature,
      observed_slot = verified_observed_slot
    where id = selected_projection.id;
  else
    insert into app.coach_client_credit_projections (
      run_id,
      coach_profile_id,
      client_profile_id,
      program_address,
      coach_authority_address,
      client_wallet_address,
      coach_client_credits_address,
      available_credits,
      reserved_credits,
      total_purchased,
      purchase_count,
      next_purchase_nonce,
      last_offer_address,
      last_purchase_at,
      transaction_signature,
      observed_slot
    ) values (
      run_id_text::uuid,
      requested_coach_profile_id,
      profile_id_text::uuid,
      verified_program_address,
      verified_coach_authority_address,
      verified_client_wallet_address,
      verified_credits_address,
      verified_available_credits,
      verified_reserved_credits,
      verified_total_purchased,
      verified_purchase_count,
      verified_next_purchase_nonce,
      verified_last_offer_address,
      verified_last_purchase_at,
      verified_transaction_signature,
      verified_observed_slot
    )
    returning * into selected_projection;
  end if;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_projection.id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.record_verified_coach_credit_projection(requested_coach_profile_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_purchase_count bigint, verified_next_purchase_nonce bigint, verified_last_offer_address text, verified_last_purchase_at timestamp with time zone, verified_transaction_signature text, verified_observed_slot bigint) OWNER TO app_owner;

--
-- Name: record_verified_group_event_contribution_projection(uuid, text, text, text, text, bigint, text, text, bigint, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.record_verified_group_event_contribution_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_contribution_address text, verified_participant_wallet_address text, verified_amount_base_units bigint, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  selected_event record;
  selected_pool record;
  participant_profile_id_value uuid;
  existing_projection record;
  projection_id uuid;
begin
  if verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_contribution_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_participant_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_amount_base_units not between 1 and 9000000000000000
    or verified_lifecycle_status not in ('funded', 'refundable', 'refunded', 'successful')
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_observed_slot < 0
    or verified_finalized_at is null
  then
    raise exception using errcode = 'P0001', message = 'group event contribution evidence is invalid';
  end if;

  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);
  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id;
  select * into selected_pool
  from app.group_event_pool_projections as projection
  where projection.event_id = requested_event_id;
  if selected_event.id is null
    or selected_pool.event_id is null
    or selected_event.program_address <> verified_program_address
    or selected_event.event_pool_address <> verified_event_pool_address
    or selected_pool.seat_price_base_units <> verified_amount_base_units
  then
    raise exception using errcode = 'P0001', message = 'group event contribution does not match pool';
  end if;

  select binding.profile_id into participant_profile_id_value
  from app.wallet_bindings as binding
  where binding.run_id = selected_event.run_id
    and binding.cluster = 'solana:devnet'
    and binding.wallet_address = verified_participant_wallet_address
    and binding.status = 'active';
  if participant_profile_id_value is null then
    raise exception using errcode = 'P0001', message = 'group event participant wallet is not linked';
  end if;

  select * into existing_projection
  from app.group_event_contribution_projections as projection
  where projection.event_id = requested_event_id
    and projection.participant_wallet_address = verified_participant_wallet_address
  for update;
  if found then
    if verified_observed_slot < existing_projection.observed_slot
      or existing_projection.program_address <> verified_program_address
      or existing_projection.event_pool_address <> verified_event_pool_address
      or existing_projection.contribution_address <> verified_contribution_address
      or existing_projection.amount_base_units <> verified_amount_base_units
      or existing_projection.participant_profile_id <> participant_profile_id_value
      or not (
        (existing_projection.lifecycle_status = 'funded' and verified_lifecycle_status in ('funded', 'refundable', 'refunded', 'successful'))
        or (existing_projection.lifecycle_status = 'refundable' and verified_lifecycle_status in ('refundable', 'refunded'))
        or (existing_projection.lifecycle_status = 'refunded' and verified_lifecycle_status = 'refunded')
        or (existing_projection.lifecycle_status = 'successful' and verified_lifecycle_status = 'successful')
      )
    then
      raise exception using errcode = 'P0001', message = 'group event contribution evidence is stale or conflicting';
    end if;
    if verified_observed_slot = existing_projection.observed_slot then
      if existing_projection.lifecycle_status <> verified_lifecycle_status
        or existing_projection.transaction_signature <> verified_transaction_signature
        or existing_projection.finalized_at <> verified_finalized_at
      then
        raise exception using errcode = 'P0001', message = 'group event contribution conflicts at the same slot';
      end if;
    else
      update app.group_event_contribution_projections
      set
        lifecycle_status = verified_lifecycle_status,
        transaction_signature = verified_transaction_signature,
        observed_slot = verified_observed_slot,
        finalized_at = verified_finalized_at
      where id = existing_projection.id;
    end if;
    projection_id := existing_projection.id;
  else
    insert into app.group_event_contribution_projections (
      run_id,
      event_id,
      participant_profile_id,
      program_address,
      event_pool_address,
      contribution_address,
      participant_wallet_address,
      amount_base_units,
      lifecycle_status,
      transaction_signature,
      observed_slot,
      finalized_at
    ) values (
      selected_event.run_id,
      requested_event_id,
      participant_profile_id_value,
      verified_program_address,
      verified_event_pool_address,
      verified_contribution_address,
      verified_participant_wallet_address,
      verified_amount_base_units,
      verified_lifecycle_status,
      verified_transaction_signature,
      verified_observed_slot,
      verified_finalized_at
    ) returning id into projection_id;
  end if;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return projection_id;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.record_verified_group_event_contribution_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_contribution_address text, verified_participant_wallet_address text, verified_amount_base_units bigint, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: record_verified_group_event_pool_projection(uuid, text, text, text, text, text, text, text, bigint, smallint, smallint, smallint, timestamp with time zone, timestamp with time zone, timestamp with time zone, text, text, bigint, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  selected_event record;
  existing_projection record;
begin
  if verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_vault_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_payout_recipient_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_mint_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_token_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_mint_address <> 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'
    or verified_token_program_address <> 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_seat_price_base_units not between 1 and 9000000000000000
    or verified_minimum_participants not between 2 and 50
    or verified_maximum_participants not between verified_minimum_participants and 50
    or verified_participant_count not between 0 and verified_maximum_participants
    or verified_funding_deadline >= verified_event_starts_at
    or verified_event_ends_at - verified_event_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or verified_lifecycle_status not in ('funding', 'succeeded', 'paid', 'failed')
    or (
      verified_lifecycle_status in ('succeeded', 'paid')
      and verified_participant_count < verified_minimum_participants
    )
    or (
      verified_lifecycle_status = 'failed'
      and verified_participant_count >= verified_minimum_participants
    )
    or verified_observed_slot < 0
    or verified_finalized_at is null
  then
    raise exception using errcode = 'P0001', message = 'group event pool evidence is invalid';
  end if;

  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id
  for update;
  if not found
    or selected_event.program_address <> verified_program_address
    or selected_event.event_pool_address <> verified_event_pool_address
    or selected_event.coach_wallet_address_snapshot <> verified_payout_recipient_address
    or selected_event.starts_at <> verified_event_starts_at
    or selected_event.ends_at <> verified_event_ends_at
  then
    raise exception using errcode = 'P0001', message = 'group event pool evidence does not match metadata';
  end if;

  select * into existing_projection
  from app.group_event_pool_projections as projection
  where projection.event_id = requested_event_id
  for update;

  if found then
    if verified_observed_slot < existing_projection.observed_slot
      or existing_projection.program_address <> verified_program_address
      or existing_projection.event_pool_address <> verified_event_pool_address
      or existing_projection.vault_address <> verified_vault_address
      or existing_projection.coach_authority_address <> verified_coach_authority_address
      or existing_projection.payout_recipient_address <> verified_payout_recipient_address
      or existing_projection.mint_address <> verified_mint_address
      or existing_projection.token_program_address <> verified_token_program_address
      or existing_projection.seat_price_base_units <> verified_seat_price_base_units
      or existing_projection.minimum_participants <> verified_minimum_participants
      or existing_projection.maximum_participants <> verified_maximum_participants
      or existing_projection.funding_deadline <> verified_funding_deadline
      or existing_projection.event_starts_at <> verified_event_starts_at
      or existing_projection.event_ends_at <> verified_event_ends_at
      or verified_participant_count < existing_projection.participant_count
      or not (
        (existing_projection.lifecycle_status = 'funding' and verified_lifecycle_status in ('funding', 'succeeded', 'failed'))
        or (existing_projection.lifecycle_status = 'succeeded' and verified_lifecycle_status in ('succeeded', 'paid'))
        or (existing_projection.lifecycle_status = 'paid' and verified_lifecycle_status = 'paid')
        or (existing_projection.lifecycle_status = 'failed' and verified_lifecycle_status = 'failed')
      )
    then
      raise exception using errcode = 'P0001', message = 'group event pool evidence is stale or conflicting';
    end if;

    if verified_observed_slot = existing_projection.observed_slot then
      if existing_projection.participant_count <> verified_participant_count
        or existing_projection.lifecycle_status <> verified_lifecycle_status
        or existing_projection.transaction_signature <> verified_transaction_signature
        or existing_projection.finalized_at <> verified_finalized_at
      then
        raise exception using errcode = 'P0001', message = 'group event pool evidence conflicts at the same slot';
      end if;
    else
      update app.group_event_pool_projections
      set
        participant_count = verified_participant_count,
        lifecycle_status = verified_lifecycle_status,
        transaction_signature = verified_transaction_signature,
        observed_slot = verified_observed_slot,
        finalized_at = verified_finalized_at
      where event_id = requested_event_id;
    end if;
  else
    insert into app.group_event_pool_projections (
      event_id,
      run_id,
      program_address,
      event_pool_address,
      vault_address,
      coach_authority_address,
      payout_recipient_address,
      mint_address,
      token_program_address,
      seat_price_base_units,
      minimum_participants,
      maximum_participants,
      participant_count,
      funding_deadline,
      event_starts_at,
      event_ends_at,
      lifecycle_status,
      transaction_signature,
      observed_slot,
      finalized_at
    ) values (
      requested_event_id,
      selected_event.run_id,
      verified_program_address,
      verified_event_pool_address,
      verified_vault_address,
      verified_coach_authority_address,
      verified_payout_recipient_address,
      verified_mint_address,
      verified_token_program_address,
      verified_seat_price_base_units,
      verified_minimum_participants,
      verified_maximum_participants,
      verified_participant_count,
      verified_funding_deadline,
      verified_event_starts_at,
      verified_event_ends_at,
      verified_lifecycle_status,
      verified_transaction_signature,
      verified_observed_slot,
      verified_finalized_at
    );
  end if;

  update app.group_events
  set
    projection_availability = 'current',
    projection_status_updated_at = verified_finalized_at
  where id = requested_event_id;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: FUNCTION record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) IS 'Persists finalized monotonic EventPool evidence while keeping the CoachAuthority PDA distinct from the immutable coach-wallet payout recipient.';


--
-- Name: release_owned_private_booking_hold(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.release_owned_private_booking_hold(requested_booking_id uuid, requested_reason text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  resolved_operation_status text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
    or requested_reason not in (
      'wallet-rejected',
      'simulation-failed',
      'reservation-absent'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold release is invalid';
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
    and booking.client_profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold release is unauthorized';
  end if;
  if selected_booking.status = 'expired' then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;
  if selected_booking.status <> 'pending'
    or (
      requested_reason = 'reservation-absent'
      and selected_booking.hold_expires_at > statement_timestamp()
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold cannot be released';
  end if;

  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
  for update;

  if reserve_operation.id is null
    or reserve_operation.status not in ('prepared', 'submitted')
    or (
      reserve_operation.status = 'submitted'
      and requested_reason <> 'reservation-absent'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking reserve operation cannot be released';
  end if;

  resolved_operation_status := case requested_reason
    when 'reservation-absent' then 'expired'
    else 'failed'
  end;
  update app.coach_booking_credit_operations
  set
    status = resolved_operation_status,
    failure_code = requested_reason,
    failed_at = statement_timestamp()
  where id = reserve_operation.id;
  update app.coach_private_bookings
  set
    status = 'expired',
    expired_at = statement_timestamp()
  where id = selected_booking.id;
  update app.coach_availability_slots
  set status = 'open'
  where id = selected_booking.slot_id
    and status = 'held';

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


ALTER FUNCTION app.release_owned_private_booking_hold(requested_booking_id uuid, requested_reason text) OWNER TO app_owner;

--
-- Name: remove_owned_coach_availability_rule(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.remove_owned_coach_availability_rule(requested_rule_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.remove_owned_coach_availability_rule(requested_rule_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION remove_owned_coach_availability_rule(requested_rule_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.remove_owned_coach_availability_rule(requested_rule_id uuid) IS 'Soft-removes one owner rule and withdraws only its future open occurrences.';


--
-- Name: replace_owned_coach_availability_rules(jsonb, jsonb); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


ALTER FUNCTION app.replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb) OWNER TO app_owner;

--
-- Name: FUNCTION replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb) IS 'Atomically replaces an authorized coach working week from bounded versioned location assignments and synchronizes dated occurrences once.';


--
-- Name: request_owned_private_booking_cancellation(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.request_owned_private_booking_cancellation(requested_booking_id uuid) RETURNS TABLE(outcome text, operation_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  selected_operation app.coach_booking_credit_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation request is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.client_profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation is unauthorized';
  end if;

  if selected_booking.status = 'cancelled' then
    select operation.*
    into selected_operation
    from app.coach_booking_credit_operations as operation
    where operation.booking_id = selected_booking.id
      and operation.kind = 'return';
    return query select 'cancelled'::text, selected_operation.id;
    return;
  end if;

  if selected_booking.status = 'cancellation-requested' then
    return query select 'coach-decision-required'::text, null::uuid;
    return;
  end if;

  if selected_booking.status <> 'confirmed'
    or selected_booking.scheduled_start_at <= statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cannot be cancelled';
  end if;

  if statement_timestamp() > selected_booking.early_return_until then
    update app.coach_private_bookings
    set
      status = 'cancellation-requested',
      cancellation_requested_at = statement_timestamp()
    where id = selected_booking.id;
    perform set_config('app.coach_booking_management', 'off', true);
    return query select 'coach-decision-required'::text, null::uuid;
    return;
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = selected_booking.credit_projection_id
  for update;
  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
    and operation.status = 'finalized';

  if selected_projection.id is null or reserve_operation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized reservation is unavailable';
  end if;

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    selected_booking.run_id,
    selected_booking.id,
    selected_projection.id,
    'return',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    selected_booking.scheduled_start_at,
    selected_booking.early_return_until
  )
  on conflict (booking_id, kind) do update
  set booking_id = excluded.booking_id
  returning * into selected_operation;

  perform set_config('app.coach_booking_management', 'off', true);
  return query select 'return-prepared'::text, selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.request_owned_private_booking_cancellation(requested_booking_id uuid) OWNER TO app_owner;

--
-- Name: require_active_coach_availability_rule_location(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.require_active_coach_availability_rule_location() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.require_active_coach_availability_rule_location() OWNER TO app_owner;

--
-- Name: require_coach_application_access(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.require_coach_application_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  application_status text;
begin
  if tg_op = 'UPDATE' and new.is_demo <> old.is_demo then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile demo identity is immutable';
  end if;

  if new.is_demo
    or pg_catalog.current_setting(
      'app.coach_review_management',
      true
    ) = 'on'
  then
    return new;
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  select application.status
  into application_status
  from app.coach_applications as application
  where application.profile_id = new.profile_id
  for share;
  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );

  if application_status = 'approved'
    or (
      application_status in ('pending', 'rejected')
      and new.visibility = 'hidden'
    )
  then
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'coach profile requires an eligible coach application';
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.require_coach_application_access() OWNER TO app_owner;

--
-- Name: require_coach_training_location_timezone(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.require_coach_training_location_timezone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  coach_timezone text;
  enabled_profile_management boolean := false;
begin
  if pg_catalog.current_setting('app.coach_profile_management', true)
    is distinct from 'on'
  then
    perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
    enabled_profile_management := true;
  end if;

  select coach.timezone
  into coach_timezone
  from app.coach_profiles as coach
  where coach.run_id = new.run_id
    and coach.profile_id = new.profile_id;

  if coach_timezone is null or coach_timezone <> new.timezone then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location timezone is invalid';
  end if;

  if enabled_profile_management then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  end if;
  return new;
exception
  when others then
    if enabled_profile_management then
      perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    end if;
    raise;
end;
$$;


ALTER FUNCTION app.require_coach_training_location_timezone() OWNER TO app_owner;

--
-- Name: review_coach_application(uuid, text, text, text, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  selected_application app.coach_applications%rowtype;
  normalized_reason text;
  normalized_reviewer_reference text;
  repeated_event_id uuid;
begin
  normalized_reason := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_reason, '[[:space:]]+', ' ', 'g')
  );
  normalized_reviewer_reference := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_reviewer_reference,
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  if requested_profile_id is null
    or expected_status not in ('pending', 'approved')
    or requested_decision not in ('approved', 'rejected', 'suspended')
    or not (
      (expected_status = 'pending'
        and requested_decision in ('approved', 'rejected'))
      or (expected_status = 'approved' and requested_decision = 'suspended')
    )
    or normalized_reason is null
    or pg_catalog.char_length(normalized_reason) not between 10 and 500
    or normalized_reason ~ '[[:cntrl:]]'
    or normalized_reviewer_reference is null
    or pg_catalog.char_length(normalized_reviewer_reference)
      not between 3 and 120
    or normalized_reviewer_reference ~ '[[:cntrl:]]'
    or requested_policy_version is null
    or requested_policy_version
      !~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach application review is invalid';
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config('app.coach_review_management', 'on', true);

  select application.*
  into selected_application
  from app.coach_applications as application
  where application.profile_id = requested_profile_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach application review target is unavailable';
  end if;

  if selected_application.status = requested_decision then
    select event.id
    into repeated_event_id
    from app.coach_application_review_events as event
    where event.profile_id = selected_application.profile_id
      and event.application_revision = selected_application.revision
      and event.previous_status = expected_status
      and event.decision = requested_decision
      and event.reason = normalized_reason
      and event.reviewer_reference = normalized_reviewer_reference
      and event.review_source = 'owner-command'
      and event.verification_policy_version = requested_policy_version;

    if repeated_event_id is not null then
      perform pg_catalog.set_config(
        'app.coach_application_management',
        'off',
        true
      );
      perform pg_catalog.set_config(
        'app.coach_profile_management',
        'off',
        true
      );
      perform pg_catalog.set_config(
        'app.coach_review_management',
        'off',
        true
      );
      return selected_application.status;
    end if;
  end if;

  if selected_application.status <> expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'coach application review conflicts with current state';
  end if;

  if requested_decision = 'approved' and not exists (
    select 1
    from app.coach_profiles as coach
    where coach.profile_id = selected_application.profile_id
      and not coach.is_demo
      and coach.record_source = 'user'
      and coach.visibility = 'hidden'
      and coach.location_confirmed_at is not null
      and exists (
        select 1
        from app.coach_profile_disciplines as discipline
        where discipline.run_id = coach.run_id
          and discipline.profile_id = coach.profile_id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach application requires a completed hidden profile';
  end if;

  update app.coach_applications
  set
    status = requested_decision,
    decided_at = pg_catalog.statement_timestamp(),
    decision_reason = normalized_reason,
    reviewer_reference = normalized_reviewer_reference,
    review_source = 'owner-command',
    verification_policy_version = requested_policy_version
  where profile_id = selected_application.profile_id;

  insert into app.coach_application_review_events (
    profile_id,
    application_revision,
    previous_status,
    decision,
    reason,
    reviewer_reference,
    review_source,
    verification_policy_version
  ) values (
    selected_application.profile_id,
    selected_application.revision,
    selected_application.status,
    requested_decision,
    normalized_reason,
    normalized_reviewer_reference,
    'owner-command',
    requested_policy_version
  );

  if requested_decision in ('rejected', 'suspended') then
    update app.coach_profiles
    set visibility = 'hidden'
    where profile_id = selected_application.profile_id
      and not is_demo;
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  perform pg_catalog.set_config('app.coach_review_management', 'off', true);
  return requested_decision;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    perform pg_catalog.set_config('app.coach_review_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text) OWNER TO app_owner;

--
-- Name: FUNCTION review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text) IS 'Owner-only expected-state coach review operation; appends immutable evidence and is never granted to the application runtime.';


--
-- Name: send_coach_athlete_connection(uuid, uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.send_coach_athlete_connection(requested_booking_id uuid, requested_attempt_id uuid, expected_previous_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid; dataset uuid; booking app.coach_private_bookings%rowtype;
  pair app.coach_athlete_connection_pairs%rowtype;
  prior app.coach_athlete_connection_attempts%rowtype; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null or requested_attempt_id is null then
    raise exception 'connection operation is invalid' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id', true)::uuid;
  dataset := current_setting('app.current_run_id', true)::uuid;
  perform app.connection_access_flags(true);
  select b.* into booking from app.coach_private_bookings b
    where b.id = requested_booking_id and b.run_id = dataset and b.credit_projection_id is null
      and actor in (b.coach_profile_id, b.client_profile_id) and b.coach_profile_id <> b.client_profile_id;
  if not found then raise exception 'connection operation is unavailable' using errcode = 'P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'coach-athlete-connection:' || dataset::text || ':' || booking.coach_profile_id::text || ':' || booking.client_profile_id::text, 0));
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.run_id = dataset and p.coach_profile_id = booking.coach_profile_id and p.athlete_profile_id = booking.client_profile_id;
  select a.* into prior from app.coach_athlete_connection_attempts a where a.id = requested_attempt_id;
  if found then
    if prior.pair_id is distinct from pair.id or prior.sender_profile_id <> actor then
      raise exception 'connection operation conflicts with current state' using errcode = 'P0001';
    end if;
    result := app.connection_attempt_projection(prior.id);
    perform app.connection_access_flags(false); return result;
  end if;
  select a.* into prior from app.coach_athlete_connection_attempts a
    where a.pair_id = pair.id order by a.attempt_number desc limit 1;
  if prior.status in ('pending', 'accepted') then
    result := app.connection_attempt_projection(prior.id);
    perform app.connection_access_flags(false); return result;
  end if;
  if prior.id is distinct from expected_previous_id then
    raise exception 'connection operation conflicts with current state' using errcode = 'P0001';
  end if;
  if pair.id is null then
    pair.run_id := dataset; pair.coach_profile_id := booking.coach_profile_id; pair.athlete_profile_id := booking.client_profile_id;
  end if;
  perform app.lock_connection_eligibility(pair);
  if pair.id is null then
    insert into app.coach_athlete_connection_pairs (run_id, coach_profile_id, athlete_profile_id)
      values (dataset, booking.coach_profile_id, booking.client_profile_id) returning * into pair;
  end if;
  insert into app.coach_athlete_connection_attempts
    (id, run_id, pair_id, attempt_number, sender_profile_id, recipient_profile_id)
    values (requested_attempt_id, dataset, pair.id, coalesce(prior.attempt_number, 0) + 1, actor,
      case when actor = pair.coach_profile_id then pair.athlete_profile_id else pair.coach_profile_id end);
  result := app.connection_attempt_projection(requested_attempt_id);
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;


ALTER FUNCTION app.send_coach_athlete_connection(requested_booking_id uuid, requested_attempt_id uuid, expected_previous_id uuid) OWNER TO app_owner;

--
-- Name: set_current_account_avatar_reference(text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_current_account_avatar_reference(requested_path text, expected_path text) RETURNS TABLE(previous_path text, media_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  selected_profile app.profiles%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'account avatar actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  if requested_path is not null
    and (
      requested_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      or pg_catalog.split_part(requested_path, '/', 1) <> profile_id_text
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'account avatar reference is invalid';
  end if;

  perform pg_catalog.set_config('app.profile_media_management', 'on', true);
  select profile.*
  into selected_profile
  from app.profiles as profile
  where profile.id = profile_id_text::uuid
  for update;

  if not found
    or selected_profile.avatar_storage_path is distinct from expected_path
  then
    raise exception using
      errcode = 'P0001',
      message = 'account avatar reference conflicts with current state';
  end if;

  previous_path := selected_profile.avatar_storage_path;
  update app.profiles as profile
  set avatar_storage_path = requested_path,
      avatar_updated_at = case
        when requested_path is null then null
        else pg_catalog.statement_timestamp()
      end
  where profile.id = selected_profile.id
  returning profile.avatar_updated_at into media_updated_at;

  perform pg_catalog.set_config('app.profile_media_management', 'off', true);
  return next;
exception
  when others then
    perform pg_catalog.set_config('app.profile_media_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.set_current_account_avatar_reference(requested_path text, expected_path text) OWNER TO app_owner;

--
-- Name: FUNCTION set_current_account_avatar_reference(requested_path text, expected_path text); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.set_current_account_avatar_reference(requested_path text, expected_path text) IS 'Compare-and-swap attachment/removal for the authorized actor private account-avatar reference.';


--
-- Name: set_current_coach_portrait_reference(text, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text) RETURNS TABLE(previous_source text, previous_path text, media_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach app.coach_profiles%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach portrait actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  if requested_path is not null
    and (
      requested_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      or pg_catalog.split_part(requested_path, '/', 1) <> profile_id_text
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach portrait reference is invalid';
  end if;

  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and app.coach_trust_kind(coach.profile_id, coach.is_demo)
      in ('demo', 'verified')
  for update of coach;

  if not found
    or selected_coach.portrait_source is distinct from expected_source
    or selected_coach.portrait_path is distinct from expected_path
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach portrait reference conflicts with current state';
  end if;

  previous_source := selected_coach.portrait_source;
  previous_path := selected_coach.portrait_path;
  update app.coach_profiles as coach
  set portrait_source = case
        when requested_path is null then null
        else 'storage'
      end,
      portrait_path = requested_path,
      portrait_updated_at = case
        when requested_path is null then null
        else pg_catalog.statement_timestamp()
      end
  where coach.run_id = selected_coach.run_id
    and coach.profile_id = selected_coach.profile_id
  returning coach.portrait_updated_at into media_updated_at;

  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return next;
exception
  when others then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text) OWNER TO app_owner;

--
-- Name: FUNCTION set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text) IS 'Compare-and-swap attachment/removal for an approved or demo coach public portrait reference.';


--
-- Name: set_owned_coach_follow(uuid, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_owned_coach_follow(requested_coach_profile_id uuid, requested_following boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor_profile_id uuid;
  actor_run_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach follow actor context is invalid';
  end if;

  actor_profile_id := pg_catalog.current_setting(
    'app.current_profile_id', true
  )::uuid;
  actor_run_id := pg_catalog.current_setting('app.current_run_id', true)::uuid;

  if requested_coach_profile_id is null
    or requested_coach_profile_id = actor_profile_id
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach follow target is invalid';
  end if;

  perform pg_catalog.set_config('app.coach_social_management', 'on', true);

  if requested_following then
    if not exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = actor_run_id
        and coach.profile_id = requested_coach_profile_id
        and coach.visibility = 'visible'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'coach follow target is unavailable';
    end if;

    insert into app.coach_follows (
      run_id,
      follower_profile_id,
      coach_profile_id
    )
    values (
      actor_run_id,
      actor_profile_id,
      requested_coach_profile_id
    )
    on conflict (run_id, follower_profile_id, coach_profile_id) do nothing;
  else
    delete from app.coach_follows
    where run_id = actor_run_id
      and follower_profile_id = actor_profile_id
      and coach_profile_id = requested_coach_profile_id;
  end if;

  perform pg_catalog.set_config('app.coach_social_management', 'off', true);
  return requested_following;
exception
  when others then
    perform pg_catalog.set_config('app.coach_social_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.set_owned_coach_follow(requested_coach_profile_id uuid, requested_following boolean) OWNER TO app_owner;

--
-- Name: set_owned_coach_post_visibility(uuid, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_owned_coach_post_visibility(requested_post_id uuid, requested_visibility text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor_profile_id uuid;
  actor_run_id uuid;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach post actor context is invalid';
  end if;

  if requested_visibility not in ('visible', 'hidden') then
    raise exception using
      errcode = 'P0001',
      message = 'coach post visibility is invalid';
  end if;

  actor_profile_id := pg_catalog.current_setting(
    'app.current_profile_id', true
  )::uuid;
  actor_run_id := pg_catalog.current_setting('app.current_run_id', true)::uuid;
  perform pg_catalog.set_config('app.coach_social_management', 'on', true);

  update app.coach_posts
  set visibility = requested_visibility
  where run_id = actor_run_id
    and id = requested_post_id
    and coach_profile_id = actor_profile_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'coach post owner is invalid';
  end if;

  perform pg_catalog.set_config('app.coach_social_management', 'off', true);
  return requested_visibility;
exception
  when others then
    perform pg_catalog.set_config('app.coach_social_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.set_owned_coach_post_visibility(requested_post_id uuid, requested_visibility text) OWNER TO app_owner;

--
-- Name: set_owned_coach_primary_location(uuid, timestamp with time zone, uuid, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_owned_coach_primary_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.set_owned_coach_primary_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: set_owned_coach_primary_location_without_schedule_lock(uuid, timestamp with time zone, uuid, timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_owned_coach_primary_location_without_schedule_lock(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  selected_location app.coach_training_locations%rowtype;
  selected_primary app.coach_training_locations%rowtype;
  resulting_updated_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  perform 1
  from app.coach_training_locations as location
  where location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
  order by location.id
  for update;

  select location.*
  into selected_location
  from app.coach_training_locations as location
  where location.id = requested_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active';

  select location.*
  into selected_primary
  from app.coach_training_locations as location
  where location.id = expected_primary_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active'
    and location.is_primary;

  if selected_location.id is null
    or selected_location.updated_at <> expected_location_updated_at
    or selected_primary.id is null
    or selected_primary.updated_at <> expected_primary_updated_at
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location conflicts with current state';
  end if;

  if selected_location.id = selected_primary.id then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    return selected_location.updated_at;
  end if;

  update app.coach_training_locations
  set is_primary = false
  where id = selected_primary.id;

  update app.coach_training_locations
  set is_primary = true
  where id = selected_location.id
  returning updated_at into resulting_updated_at;

  perform app.sync_coach_profile_from_primary_training_location(
    run_id_text::uuid,
    profile_id_text::uuid
  );

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return resulting_updated_at;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.set_owned_coach_primary_location_without_schedule_lock(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: FUNCTION set_owned_coach_primary_location_without_schedule_lock(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.set_owned_coach_primary_location_without_schedule_lock(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) IS 'Atomically replaces the current primary location using owner and optimistic-state checks.';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;


ALTER FUNCTION app.set_updated_at() OWNER TO app_owner;

--
-- Name: submit_owned_coach_application(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.submit_owned_coach_application() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  selected_profile app.profiles%rowtype;
  selected_application app.coach_applications%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach application actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'on',
    true
  );

  select profile.*
  into selected_profile
  from app.profiles as profile
  where profile.id = profile_id_text::uuid
    and profile.record_source = 'user'
    and profile.auth_user_id is not null
    and profile.claimed_at is not null
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach application profile is unavailable';
  end if;

  select application.*
  into selected_application
  from app.coach_applications as application
  where application.profile_id = selected_profile.id
  for update;

  if not found then
    insert into app.coach_applications (
      profile_id,
      status,
      revision,
      submitted_at
    ) values (
      selected_profile.id,
      'pending',
      1,
      pg_catalog.statement_timestamp()
    );
    selected_application.status := 'pending';
  elsif selected_application.status = 'rejected' then
    update app.coach_applications
    set
      status = 'pending',
      revision = revision + 1,
      submitted_at = pg_catalog.statement_timestamp(),
      decided_at = null,
      decision_reason = null,
      reviewer_reference = null,
      review_source = null,
      verification_policy_version = null
    where profile_id = selected_profile.id;
    selected_application.status := 'pending';
  end if;

  update app.profiles
  set
    coaching_activated_at = coalesce(
      coaching_activated_at,
      pg_catalog.statement_timestamp()
    ),
    updated_at = case
      when coaching_activated_at is null
        then pg_catalog.statement_timestamp()
      else updated_at
    end
  where id = selected_profile.id;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'off',
    true
  );
  return selected_application.status;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_activation_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.submit_owned_coach_application() OWNER TO app_owner;

--
-- Name: FUNCTION submit_owned_coach_application(); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.submit_owned_coach_application() IS 'Creates or resubmits the verified current account coach application without granting coach authority.';


--
-- Name: sync_coach_availability_timezone_from_profile(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.sync_coach_availability_timezone_from_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.sync_coach_availability_timezone_from_profile() OWNER TO app_owner;

--
-- Name: sync_coach_profile_from_primary_training_location(uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.sync_coach_profile_from_primary_training_location(requested_run_id uuid, requested_profile_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_training_location_sync_to_profile',
    'on',
    true
  );

  update app.coach_profiles as coach
  set
    timezone = location.timezone,
    selected_gym_id = location.selected_gym_id,
    location_kind = location.location_kind,
    public_location_label = location.public_location_label,
    latitude = location.latitude,
    longitude = location.longitude,
    location_source = location.location_source,
    location_provider = location.location_provider,
    location_confirmed_at = location.location_confirmed_at
  from app.coach_training_locations as location
  where coach.run_id = requested_run_id
    and coach.profile_id = requested_profile_id
    and location.run_id = coach.run_id
    and location.profile_id = coach.profile_id
    and location.status = 'active'
    and location.is_primary;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location primary is unavailable';
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_sync_to_profile',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_sync_to_profile',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.sync_coach_profile_from_primary_training_location(requested_run_id uuid, requested_profile_id uuid) OWNER TO app_owner;

--
-- Name: sync_primary_training_location_from_profile(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.sync_primary_training_location_from_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  primary_location_id uuid;
  resolved_public_name text;
begin
  if pg_catalog.current_setting(
    'app.coach_training_location_sync_to_profile',
    true
  ) = 'on' then
    return new;
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  update app.coach_training_locations
  set timezone = new.timezone
  where run_id = new.run_id
    and profile_id = new.profile_id
    and timezone <> new.timezone;

  if new.selected_gym_id is not null then
    select gym.name
    into resolved_public_name
    from app.gyms as gym
    where gym.run_id = new.run_id
      and gym.id = new.selected_gym_id;
  else
    resolved_public_name := new.public_location_label;
  end if;

  if resolved_public_name is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location gym is unavailable';
  end if;

  select location.id
  into primary_location_id
  from app.coach_training_locations as location
  where location.run_id = new.run_id
    and location.profile_id = new.profile_id
    and location.status = 'active'
    and location.is_primary
  for update;

  if primary_location_id is null then
    insert into app.coach_training_locations (
      run_id,
      profile_id,
      public_name,
      timezone,
      selected_gym_id,
      location_kind,
      public_location_label,
      latitude,
      longitude,
      location_source,
      location_provider,
      location_confirmed_at,
      status,
      is_primary,
      sort_order,
      record_source
    ) values (
      new.run_id,
      new.profile_id,
      resolved_public_name,
      new.timezone,
      new.selected_gym_id,
      new.location_kind,
      new.public_location_label,
      new.latitude,
      new.longitude,
      new.location_source,
      new.location_provider,
      new.location_confirmed_at,
      'active',
      true,
      1,
      new.record_source
    );
  else
    update app.coach_training_locations
    set
      public_name = case
        when new.selected_gym_id is not null then resolved_public_name
        when location_kind = 'gym' then new.public_location_label
        else public_name
      end,
      timezone = new.timezone,
      selected_gym_id = new.selected_gym_id,
      location_kind = new.location_kind,
      public_location_label = new.public_location_label,
      latitude = new.latitude,
      longitude = new.longitude,
      location_source = new.location_source,
      location_provider = new.location_provider,
      location_confirmed_at = new.location_confirmed_at,
      record_source = new.record_source
    where id = primary_location_id;
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$$;


ALTER FUNCTION app.sync_primary_training_location_from_profile() OWNER TO app_owner;

--
-- Name: synchronize_coach_availability_occurrences(uuid, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.synchronize_coach_availability_occurrences(requested_run_id uuid, requested_profile_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.synchronize_coach_availability_occurrences(requested_run_id uuid, requested_profile_id uuid) OWNER TO app_owner;

--
-- Name: synchronize_owned_coach_availability(); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.synchronize_owned_coach_availability() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.synchronize_owned_coach_availability() OWNER TO app_owner;

--
-- Name: FUNCTION synchronize_owned_coach_availability(); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.synchronize_owned_coach_availability() IS 'Materializes the authorized coach recurring rules into the rolling seven-day slot horizon.';


--
-- Name: synchronize_public_coach_availability(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.synchronize_public_coach_availability(requested_profile_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.synchronize_public_coach_availability(requested_profile_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION synchronize_public_coach_availability(requested_profile_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.synchronize_public_coach_availability(requested_profile_id uuid) IS 'Materializes visible public coach recurring rules before a schedule read.';


--
-- Name: unlink_personal_wallet(timestamp with time zone); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.unlink_personal_wallet(requested_reauthenticated_at timestamp with time zone) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  active_binding_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  if requested_reauthenticated_at is null
    or requested_reauthenticated_at <
      pg_catalog.statement_timestamp() - interval '10 minutes'
    or requested_reauthenticated_at >
      pg_catalog.statement_timestamp() + interval '30 seconds'
  then
    raise exception using
      errcode = 'P0001',
      message = 'recent email authentication is required';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth_user_id_text, 47001)
  );

  select binding.id
  into active_binding_id
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.status = 'active'
  for update;

  if active_binding_id is null then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'state-conflict';
  end if;

  update app.wallet_bindings
  set
    status = 'revoked',
    revoked_at = pg_catalog.statement_timestamp(),
    reauthenticated_at = requested_reauthenticated_at,
    revocation_reason = 'unlinked'
  where id = active_binding_id;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return 'unlinked';
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.unlink_personal_wallet(requested_reauthenticated_at timestamp with time zone) OWNER TO app_owner;

--
-- Name: update_owned_coach_availability(uuid, timestamp without time zone, integer, boolean); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean) OWNER TO app_owner;

--
-- Name: FUNCTION update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean) IS 'Moves an owner-scoped future open slot and refreshes its location only when explicitly requested.';


--
-- Name: update_owned_coach_cancellation_policy(integer); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.update_owned_coach_cancellation_policy(requested_minutes integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  updated_minutes integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_minutes is null
    or requested_minutes not between 0 and 10080
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation policy is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_profile_management', 'on', true);

  update app.coach_profiles
  set early_cancellation_minutes = requested_minutes
  where run_id = run_id_text::uuid
    and profile_id = profile_id_text::uuid
  returning early_cancellation_minutes into updated_minutes;

  if updated_minutes is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking profile is unavailable';
  end if;

  perform set_config('app.coach_profile_management', 'off', true);
  return updated_minutes;
exception
  when others then
    perform set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.update_owned_coach_cancellation_policy(requested_minutes integer) OWNER TO app_owner;

--
-- Name: update_owned_coach_training_location(uuid, timestamp with time zone, text, uuid, text, numeric, numeric, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.update_owned_coach_training_location(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.update_owned_coach_training_location(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) OWNER TO app_owner;

--
-- Name: update_owned_coach_training_location_without_schedule_lock(uuid, timestamp with time zone, text, uuid, text, numeric, numeric, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.update_owned_coach_training_location_without_schedule_lock(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_location app.coach_training_locations%rowtype;
  selected_gym app.gyms%rowtype;
  normalized_public_name text;
  normalized_location_label text;
  resolved_public_name text;
  resolved_location_kind text;
  resolved_location_label text;
  resolved_latitude numeric(9, 6);
  resolved_longitude numeric(9, 6);
  resolved_location_source text;
  resolved_location_provider text;
  resulting_updated_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  normalized_public_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_public_name, '[[:space:]]+', ' ', 'g')
  );
  normalized_location_label := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_public_location_label,
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'on',
    true
  );

  select location.*
  into selected_location
  from app.coach_training_locations as location
  where location.id = requested_location_id
    and location.run_id = run_id_text::uuid
    and location.profile_id = profile_id_text::uuid
    and location.status = 'active'
  for update;

  if not found or selected_location.updated_at <> expected_updated_at then
    raise exception using
      errcode = 'P0001',
      message = 'coach training location conflicts with current state';
  end if;

  if requested_gym_id is not null then
    select gym.*
    into selected_gym
    from app.gyms as gym
    where gym.run_id = run_id_text::uuid
      and gym.id = requested_gym_id
      and gym.status = 'active';

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location gym is unavailable';
    end if;

    resolved_public_name := selected_gym.name;
    resolved_location_kind := 'gym';
    resolved_location_label := selected_gym.public_location_label;
    resolved_latitude := selected_gym.latitude;
    resolved_longitude := selected_gym.longitude;
    resolved_location_source := selected_gym.location_source;
    resolved_location_provider := selected_gym.location_provider;
  else
    if normalized_public_name is null
      or pg_catalog.char_length(normalized_public_name) not between 2 and 240
      or normalized_public_name ~ '[[:cntrl:]]'
      or normalized_location_label is null
      or pg_catalog.char_length(normalized_location_label) not between 2 and 240
      or normalized_location_label ~ '[[:cntrl:]]'
      or requested_latitude is null
      or requested_latitude not between -90 and 90
      or requested_longitude is null
      or requested_longitude not between -180 and 180
      or requested_location_source not in ('manual', 'permanent-geocoding')
      or (
        requested_location_source = 'manual'
        and requested_location_provider is not null
      )
      or (
        requested_location_source = 'permanent-geocoding'
        and (
          requested_location_provider is null
          or pg_catalog.char_length(requested_location_provider)
            not between 2 and 40
          or requested_location_provider !~ '^[a-z0-9-]+$'
        )
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach training location details are invalid';
    end if;

    resolved_public_name := normalized_public_name;
    resolved_location_kind := 'independent';
    resolved_location_label := normalized_location_label;
    resolved_latitude := requested_latitude;
    resolved_longitude := requested_longitude;
    resolved_location_source := requested_location_source;
    resolved_location_provider := requested_location_provider;
  end if;

  update app.coach_training_locations
  set
    public_name = resolved_public_name,
    selected_gym_id = requested_gym_id,
    location_kind = resolved_location_kind,
    public_location_label = resolved_location_label,
    latitude = resolved_latitude,
    longitude = resolved_longitude,
    location_source = resolved_location_source,
    location_provider = resolved_location_provider,
    location_confirmed_at = pg_catalog.statement_timestamp()
  where id = selected_location.id
  returning updated_at into resulting_updated_at;

  if selected_location.is_primary then
    perform app.sync_coach_profile_from_primary_training_location(
      run_id_text::uuid,
      profile_id_text::uuid
    );
  end if;

  perform pg_catalog.set_config(
    'app.coach_training_location_management',
    'off',
    true
  );
  return resulting_updated_at;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_training_location_management',
      'off',
      true
    );
    raise;
end;
$_$;


ALTER FUNCTION app.update_owned_coach_training_location_without_schedule_lock(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) OWNER TO app_owner;

--
-- Name: update_owned_group_event_draft(uuid, text, text, text, timestamp with time zone, timestamp with time zone, text, uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.update_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  normalized_title text;
  normalized_description text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;
  normalized_title := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_title, '[[:space:]]+', ' ', 'g')
  );
  normalized_description := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_description, '[[:space:]]+', ' ', 'g')
  );
  if normalized_title is null
    or pg_catalog.char_length(normalized_title) not between 3 and 120
    or normalized_title ~ '[[:cntrl:]]'
    or normalized_description is null
    or pg_catalog.char_length(normalized_description) not between 20 and 2000
    or normalized_description ~ '[[:cntrl:]]'
    or requested_discipline not in (
      'Boxing', 'Muay Thai', 'Kickboxing',
      'Brazilian Jiu-Jitsu', 'MMA', 'Wrestling'
    )
    or requested_starts_at <= pg_catalog.statement_timestamp()
    or requested_ends_at - requested_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or (
      requested_media_url is not null
      and (
        pg_catalog.char_length(requested_media_url) not between 1 and 1024
        or requested_media_url ~ '[[:space:]]'
        or not (requested_media_url ~ '^https://' or requested_media_url ~ '^/')
      )
    )
  then
    raise exception using errcode = 'P0001', message = 'group event draft details are invalid';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events
  set
    title = normalized_title,
    discipline = requested_discipline,
    description = normalized_description,
    starts_at = requested_starts_at,
    ends_at = requested_ends_at,
    media_url = requested_media_url,
    source_proposal_id = requested_source_proposal_id
  where id = requested_event_id
    and run_id = run_id_text::uuid
    and coach_profile_id = profile_id_text::uuid
    and publication_status = 'draft'
    and projection_availability = 'unbound';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event draft cannot be updated';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.update_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) OWNER TO app_owner;

--
-- Name: upsert_owned_coach_profile(text, text, text[], text, text, uuid, text, numeric, numeric, text, text); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.upsert_owned_coach_profile(requested_display_name text, requested_bio text, requested_disciplines text[], requested_timezone text, requested_visibility text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  profile_id_text text;
  run_id_text text;
  selected_profile_slug text;
  selected_gym record;
  normalized_display_name text;
  normalized_bio text;
  normalized_location_label text;
  resolved_timezone text;
  resolved_location_kind text;
  resolved_location_label text;
  resolved_latitude numeric(9, 6);
  resolved_longitude numeric(9, 6);
  resolved_location_source text;
  resolved_location_provider text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile actor context is invalid';
  end if;

  normalized_display_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_display_name, '[[:space:]]+', ' ', 'g')
  );
  normalized_bio := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_bio, '[[:space:]]+', ' ', 'g')
  );
  normalized_location_label := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_public_location_label,
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  if normalized_display_name is null
    or pg_catalog.char_length(normalized_display_name) not between 2 and 80
    or normalized_display_name ~ '[[:cntrl:]]'
    or normalized_bio is null
    or pg_catalog.char_length(normalized_bio) not between 40 and 1200
    or normalized_bio ~ '[[:cntrl:]]'
    or requested_visibility not in ('visible', 'hidden')
    or requested_timezone is null
    or requested_disciplines is null
    or pg_catalog.cardinality(requested_disciplines) not between 1 and 4
    or exists (
      select 1
      from pg_catalog.unnest(requested_disciplines) as discipline(value)
      where value not in (
        'Boxing',
        'Muay Thai',
        'Kickboxing',
        'Brazilian Jiu-Jitsu',
        'MMA',
        'Wrestling'
      )
    )
    or (
      select pg_catalog.count(distinct discipline.value)
      from pg_catalog.unnest(requested_disciplines) as discipline(value)
    ) <> pg_catalog.cardinality(requested_disciplines)
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile details are invalid';
  end if;

  perform 1
  from pg_catalog.pg_timezone_names as timezone_record
  where timezone_record.name = requested_timezone;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile timezone is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);

  select profile.slug
  into selected_profile_slug
  from app.profiles as profile
  where profile.id = profile_id_text::uuid;

  if selected_profile_slug is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile owner is unavailable';
  end if;

  if requested_gym_id is not null then
    select gym.*
    into selected_gym
    from app.gyms as gym
    where gym.run_id = run_id_text::uuid
      and gym.id = requested_gym_id
      and gym.status = 'active';

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'coach profile gym is unavailable';
    end if;

    resolved_timezone := selected_gym.timezone;
    resolved_location_kind := 'gym';
    resolved_location_label := selected_gym.public_location_label;
    resolved_latitude := selected_gym.latitude;
    resolved_longitude := selected_gym.longitude;
    resolved_location_source := selected_gym.location_source;
    resolved_location_provider := selected_gym.location_provider;
  else
    if normalized_location_label is null
      or pg_catalog.char_length(normalized_location_label) not between 2 and 240
      or requested_latitude is null
      or requested_latitude not between -90 and 90
      or requested_longitude is null
      or requested_longitude not between -180 and 180
      or requested_location_source not in ('manual', 'permanent-geocoding')
      or (
        requested_location_source = 'manual'
        and requested_location_provider is not null
      )
      or (
        requested_location_source = 'permanent-geocoding'
        and (
          requested_location_provider is null
          or pg_catalog.char_length(requested_location_provider)
            not between 2 and 40
          or requested_location_provider !~ '^[a-z0-9-]+$'
        )
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach profile location is invalid';
    end if;

    resolved_timezone := requested_timezone;
    resolved_location_kind := 'independent';
    resolved_location_label := normalized_location_label;
    resolved_latitude := requested_latitude;
    resolved_longitude := requested_longitude;
    resolved_location_source := requested_location_source;
    resolved_location_provider := requested_location_provider;
  end if;

  insert into app.coach_profiles (
    run_id,
    profile_id,
    public_slug,
    display_name,
    bio,
    service_mode,
    timezone,
    selected_gym_id,
    location_kind,
    public_location_label,
    latitude,
    longitude,
    location_source,
    location_provider,
    location_confirmed_at,
    visibility,
    record_source
  )
  values (
    run_id_text::uuid,
    profile_id_text::uuid,
    selected_profile_slug,
    normalized_display_name,
    normalized_bio,
    'private-training',
    resolved_timezone,
    requested_gym_id,
    resolved_location_kind,
    resolved_location_label,
    resolved_latitude,
    resolved_longitude,
    resolved_location_source,
    resolved_location_provider,
    pg_catalog.statement_timestamp(),
    requested_visibility,
    'user'
  )
  on conflict (run_id, profile_id) do update
  set
    display_name = excluded.display_name,
    bio = excluded.bio,
    service_mode = excluded.service_mode,
    timezone = excluded.timezone,
    selected_gym_id = excluded.selected_gym_id,
    location_kind = excluded.location_kind,
    public_location_label = excluded.public_location_label,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    location_source = excluded.location_source,
    location_provider = excluded.location_provider,
    location_confirmed_at = excluded.location_confirmed_at,
    visibility = excluded.visibility
  where coach_profiles.record_source = 'user';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'fixture coach profiles cannot be claimed or changed';
  end if;

  delete from app.coach_profile_disciplines
  where run_id = run_id_text::uuid
    and profile_id = profile_id_text::uuid;

  insert into app.coach_profile_disciplines (
    run_id,
    profile_id,
    discipline,
    sort_order
  )
  select
    run_id_text::uuid,
    profile_id_text::uuid,
    discipline.value,
    discipline.ordinality::smallint
  from pg_catalog.unnest(requested_disciplines)
    with ordinality as discipline(value, ordinality);

  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return selected_profile_slug;
exception
  when others then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$_$;


ALTER FUNCTION app.upsert_owned_coach_profile(requested_display_name text, requested_bio text, requested_disciplines text[], requested_timezone text, requested_visibility text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) OWNER TO app_owner;

--
-- Name: withdraw_coach_booking_request(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.withdraw_coach_booking_request(requested_request_id uuid) RETURNS TABLE(request_id uuid, request_status text, booking_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.withdraw_coach_booking_request(requested_request_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION withdraw_coach_booking_request(requested_request_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.withdraw_coach_booking_request(requested_request_id uuid) IS 'Lets the requesting client idempotently withdraw one pending attempt.';


--
-- Name: withdraw_owned_coach_availability(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.withdraw_owned_coach_availability(requested_slot_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


ALTER FUNCTION app.withdraw_owned_coach_availability(requested_slot_id uuid) OWNER TO app_owner;

--
-- Name: FUNCTION withdraw_owned_coach_availability(requested_slot_id uuid); Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON FUNCTION app.withdraw_owned_coach_availability(requested_slot_id uuid) IS 'Withdraws one owner-scoped future open slot without deleting its audit record.';


--
-- Name: withdraw_owned_group_event_draft(uuid); Type: FUNCTION; Schema: app; Owner: app_owner
--

CREATE FUNCTION app.withdraw_owned_group_event_draft(requested_event_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'group event actor context is invalid';
  end if;
  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  update app.group_events
  set publication_status = 'withdrawn', withdrawn_at = pg_catalog.statement_timestamp()
  where id = requested_event_id
    and run_id = run_id_text::uuid
    and coach_profile_id = profile_id_text::uuid
    and publication_status = 'draft'
    and projection_availability = 'unbound';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event draft cannot be withdrawn';
  end if;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;


ALTER FUNCTION app.withdraw_owned_group_event_draft(requested_event_id uuid) OWNER TO app_owner;

--
-- Name: auth_challenges; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.auth_challenges (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    auth_user_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    purpose text NOT NULL,
    cluster text NOT NULL,
    wallet_address text NOT NULL,
    origin text NOT NULL,
    message_version integer NOT NULL,
    nonce_hash bytea NOT NULL,
    message_hash bytea NOT NULL,
    issued_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    consumed_result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_challenges_cluster_check CHECK ((cluster = 'solana:devnet'::text)),
    CONSTRAINT auth_challenges_consumed_result_check CHECK (((consumed_result IS NULL) OR (consumed_result = ANY (ARRAY['linked'::text, 'replaced'::text, 'wallet-conflict'::text, 'state-conflict'::text])))),
    CONSTRAINT auth_challenges_consumed_state_check CHECK (((consumed_at IS NULL) = (consumed_result IS NULL))),
    CONSTRAINT auth_challenges_lifetime_check CHECK ((expires_at = (issued_at + '00:05:00'::interval))),
    CONSTRAINT auth_challenges_message_hash_check CHECK ((octet_length(message_hash) = 32)),
    CONSTRAINT auth_challenges_message_version_check CHECK ((message_version = 1)),
    CONSTRAINT auth_challenges_nonce_hash_check CHECK ((octet_length(nonce_hash) = 32)),
    CONSTRAINT auth_challenges_origin_check CHECK ((((char_length(origin) >= 8) AND (char_length(origin) <= 255)) AND (origin !~ '[[:space:]]'::text) AND ((origin ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'::text) OR (origin ~ '^http://localhost:[0-9]{2,5}$'::text)))),
    CONSTRAINT auth_challenges_purpose_check CHECK ((purpose = ANY (ARRAY['link-personal-wallet'::text, 'replace-personal-wallet'::text]))),
    CONSTRAINT auth_challenges_wallet_address_check CHECK ((((char_length(wallet_address) >= 32) AND (char_length(wallet_address) <= 44)) AND (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'::text)))
);

ALTER TABLE ONLY app.auth_challenges FORCE ROW LEVEL SECURITY;


ALTER TABLE app.auth_challenges OWNER TO app_owner;

--
-- Name: TABLE auth_challenges; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.auth_challenges IS 'Personal wallet link or replacement challenges only.';


--
-- Name: coach_application_review_events; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_application_review_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    application_revision integer NOT NULL,
    previous_status text NOT NULL,
    decision text NOT NULL,
    reason text NOT NULL,
    reviewer_reference text NOT NULL,
    review_source text NOT NULL,
    verification_policy_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_application_review_events_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text, 'suspended'::text]))),
    CONSTRAINT coach_application_review_events_policy_check CHECK ((verification_policy_version ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$'::text)),
    CONSTRAINT coach_application_review_events_previous_status_check CHECK ((previous_status = ANY (ARRAY['pending'::text, 'approved'::text]))),
    CONSTRAINT coach_application_review_events_reason_check CHECK ((((char_length(reason) >= 10) AND (char_length(reason) <= 500)) AND (reason !~ '[[:cntrl:]]'::text))),
    CONSTRAINT coach_application_review_events_reviewer_check CHECK ((((char_length(reviewer_reference) >= 3) AND (char_length(reviewer_reference) <= 120)) AND (reviewer_reference !~ '[[:cntrl:]]'::text))),
    CONSTRAINT coach_application_review_events_revision_check CHECK (((application_revision >= 1) AND (application_revision <= 1000000))),
    CONSTRAINT coach_application_review_events_source_check CHECK ((review_source = 'owner-command'::text)),
    CONSTRAINT coach_application_review_events_transition_check CHECK ((((previous_status = 'pending'::text) AND (decision = ANY (ARRAY['approved'::text, 'rejected'::text]))) OR ((previous_status = 'approved'::text) AND (decision = 'suspended'::text))))
);

ALTER TABLE ONLY app.coach_application_review_events FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_application_review_events OWNER TO app_owner;

--
-- Name: TABLE coach_application_review_events; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_application_review_events IS 'Append-only platform decision evidence for coach applications.';


--
-- Name: coach_applications; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_applications (
    profile_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decision_reason text,
    reviewer_reference text,
    review_source text,
    verification_policy_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_applications_decision_state_check CHECK ((((status = 'pending'::text) AND (decided_at IS NULL) AND (decision_reason IS NULL) AND (reviewer_reference IS NULL) AND (review_source IS NULL) AND (verification_policy_version IS NULL)) OR ((status = ANY (ARRAY['approved'::text, 'rejected'::text, 'suspended'::text])) AND (decided_at IS NOT NULL) AND ((char_length(decision_reason) >= 10) AND (char_length(decision_reason) <= 500)) AND (decision_reason !~ '[[:cntrl:]]'::text) AND ((char_length(reviewer_reference) >= 3) AND (char_length(reviewer_reference) <= 120)) AND (reviewer_reference !~ '[[:cntrl:]]'::text) AND (review_source = 'owner-command'::text) AND (verification_policy_version ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$'::text)))),
    CONSTRAINT coach_applications_revision_check CHECK (((revision >= 1) AND (revision <= 1000000))),
    CONSTRAINT coach_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'suspended'::text])))
);

ALTER TABLE ONLY app.coach_applications FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_applications OWNER TO app_owner;

--
-- Name: TABLE coach_applications; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_applications IS 'Current server-authoritative coach application state for one email-backed application profile.';


--
-- Name: coach_athlete_connection_attempts; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_athlete_connection_attempts (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    pair_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    sender_profile_id uuid NOT NULL,
    recipient_profile_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_by_profile_id uuid,
    decided_at timestamp with time zone,
    removed_by_profile_id uuid,
    removed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    CONSTRAINT coach_athlete_connection_attempts_attempt_number_check CHECK ((attempt_number > 0)),
    CONSTRAINT coach_athlete_connection_attempts_check CHECK ((sender_profile_id <> recipient_profile_id)),
    CONSTRAINT coach_athlete_connection_attempts_check1 CHECK (((status = 'pending'::text) = ((decided_at IS NULL) AND (decided_by_profile_id IS NULL)))),
    CONSTRAINT coach_athlete_connection_attempts_check2 CHECK (((decided_at IS NULL) = (decided_by_profile_id IS NULL))),
    CONSTRAINT coach_athlete_connection_attempts_check3 CHECK (((status <> ALL (ARRAY['accepted'::text, 'declined'::text, 'removed'::text])) OR (decided_by_profile_id = recipient_profile_id))),
    CONSTRAINT coach_athlete_connection_attempts_check4 CHECK (((status <> 'withdrawn'::text) OR (decided_by_profile_id = sender_profile_id))),
    CONSTRAINT coach_athlete_connection_attempts_check5 CHECK (((status = 'removed'::text) = ((removed_at IS NOT NULL) AND (removed_by_profile_id IS NOT NULL)))),
    CONSTRAINT coach_athlete_connection_attempts_check6 CHECK (((removed_at IS NULL) = (removed_by_profile_id IS NULL))),
    CONSTRAINT coach_athlete_connection_attempts_check7 CHECK (((removed_by_profile_id IS NULL) OR ((removed_by_profile_id = sender_profile_id) OR (removed_by_profile_id = recipient_profile_id)))),
    CONSTRAINT coach_athlete_connection_attempts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text, 'removed'::text])))
);

ALTER TABLE ONLY app.coach_athlete_connection_attempts FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_athlete_connection_attempts OWNER TO app_owner;

--
-- Name: coach_availability_rules; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_availability_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    iso_weekday smallint NOT NULL,
    local_start_time time without time zone NOT NULL,
    coach_timezone text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    removed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    coach_training_location_id uuid,
    CONSTRAINT coach_availability_rules_active_location_check CHECK (((status <> 'active'::text) OR (coach_training_location_id IS NOT NULL))),
    CONSTRAINT coach_availability_rules_removed_state_check CHECK (((status = 'removed'::text) = (removed_at IS NOT NULL))),
    CONSTRAINT coach_availability_rules_start_check CHECK (((EXTRACT(minute FROM local_start_time) = (0)::numeric) AND (EXTRACT(second FROM local_start_time) = (0)::numeric) AND (local_start_time < '23:00:00'::time without time zone))),
    CONSTRAINT coach_availability_rules_status_check CHECK ((status = ANY (ARRAY['active'::text, 'removed'::text]))),
    CONSTRAINT coach_availability_rules_timezone_format_check CHECK (((coach_timezone = 'UTC'::text) OR (coach_timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text))),
    CONSTRAINT coach_availability_rules_weekday_check CHECK (((iso_weekday >= 1) AND (iso_weekday <= 7)))
);

ALTER TABLE ONLY app.coach_availability_rules FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_availability_rules OWNER TO app_owner;

--
-- Name: TABLE coach_availability_rules; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_availability_rules IS 'Owner-scoped exact one-hour weekly rules; dated slots remain booking inventory.';


--
-- Name: COLUMN coach_availability_rules.iso_weekday; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_rules.iso_weekday IS 'ISO weekday: Monday = 1 through Sunday = 7.';


--
-- Name: COLUMN coach_availability_rules.coach_timezone; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_rules.coach_timezone IS 'Timezone snapshot; profile timezone edits never shift an existing rule.';


--
-- Name: COLUMN coach_availability_rules.coach_training_location_id; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_rules.coach_training_location_id IS 'Stable owner-scoped training location assigned to this recurring hour; removed pre-migration rules may lack trustworthy lineage.';


--
-- Name: coach_availability_slots; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_availability_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    coach_timezone text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    location_kind text NOT NULL,
    selected_gym_id uuid,
    gym_name text,
    public_location_label text NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    location_source text NOT NULL,
    location_provider text,
    location_confirmed_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recurrence_rule_id uuid,
    recurrence_local_date date,
    coach_training_location_id uuid,
    training_location_name text,
    CONSTRAINT coach_availability_slots_duration_check CHECK (((((ends_at - starts_at) >= '00:30:00'::interval) AND ((ends_at - starts_at) <= '03:00:00'::interval)) AND (((EXTRACT(epoch FROM (ends_at - starts_at)))::bigint % (900)::bigint) = 0))),
    CONSTRAINT coach_availability_slots_gym_location_check CHECK ((((location_kind = 'gym'::text) AND (selected_gym_id IS NOT NULL) AND (gym_name IS NOT NULL) AND ((char_length(gym_name) >= 2) AND (char_length(gym_name) <= 120))) OR ((location_kind = 'independent'::text) AND (selected_gym_id IS NULL) AND (gym_name IS NULL)))),
    CONSTRAINT coach_availability_slots_latitude_check CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT coach_availability_slots_location_kind_check CHECK ((location_kind = ANY (ARRAY['gym'::text, 'independent'::text]))),
    CONSTRAINT coach_availability_slots_location_label_length_check CHECK (((char_length(public_location_label) >= 2) AND (char_length(public_location_label) <= 240))),
    CONSTRAINT coach_availability_slots_location_provenance_check CHECK ((((location_source = ANY (ARRAY['fixture'::text, 'manual'::text])) AND (location_provider IS NULL)) OR ((location_source = 'permanent-geocoding'::text) AND (location_provider IS NOT NULL)))),
    CONSTRAINT coach_availability_slots_location_provider_check CHECK (((location_provider IS NULL) OR (((char_length(location_provider) >= 2) AND (char_length(location_provider) <= 40)) AND (location_provider ~ '^[a-z0-9-]+$'::text)))),
    CONSTRAINT coach_availability_slots_location_source_check CHECK ((location_source = ANY (ARRAY['fixture'::text, 'manual'::text, 'permanent-geocoding'::text]))),
    CONSTRAINT coach_availability_slots_longitude_check CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
    CONSTRAINT coach_availability_slots_recurrence_pair_check CHECK (((recurrence_rule_id IS NULL) = (recurrence_local_date IS NULL))),
    CONSTRAINT coach_availability_slots_recurring_duration_check CHECK (((recurrence_rule_id IS NULL) OR ((ends_at - starts_at) = '01:00:00'::interval))),
    CONSTRAINT coach_availability_slots_start_boundary_check CHECK ((((EXTRACT(epoch FROM starts_at))::bigint % (900)::bigint) = 0)),
    CONSTRAINT coach_availability_slots_status_check CHECK ((status = ANY (ARRAY['open'::text, 'held'::text, 'booked'::text, 'withdrawn'::text]))),
    CONSTRAINT coach_availability_slots_time_order_check CHECK ((ends_at > starts_at)),
    CONSTRAINT coach_availability_slots_timezone_format_check CHECK (((coach_timezone = 'UTC'::text) OR (coach_timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text))),
    CONSTRAINT coach_availability_slots_training_location_name_check CHECK (((training_location_name IS NULL) OR ((char_length(training_location_name) >= 2) AND (char_length(training_location_name) <= 240))))
);

ALTER TABLE ONLY app.coach_availability_slots FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_availability_slots OWNER TO app_owner;

--
-- Name: TABLE coach_availability_slots; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_availability_slots IS 'Explicit capacity-one coach slots with immutable-by-default public location snapshots.';


--
-- Name: COLUMN coach_availability_slots.status; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_slots.status IS 'Availability lifecycle only; DEV0105 owns held/booked transitions and client booking data.';


--
-- Name: COLUMN coach_availability_slots.recurrence_rule_id; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_slots.recurrence_rule_id IS 'Optional source rule. Null identifies an explicit DEV0104 slot.';


--
-- Name: COLUMN coach_availability_slots.recurrence_local_date; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_slots.recurrence_local_date IS 'Rule-local occurrence date used with recurrence_rule_id for idempotence.';


--
-- Name: COLUMN coach_availability_slots.coach_training_location_id; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_slots.coach_training_location_id IS 'Stable location lineage when trustworthy; the immutable slot snapshot remains authoritative for historical display.';


--
-- Name: COLUMN coach_availability_slots.training_location_name; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_availability_slots.training_location_name IS 'Immutable public location name copied when the dated occurrence is materialized.';


--
-- Name: coach_booking_credit_operations; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_booking_credit_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    credit_projection_id uuid NOT NULL,
    kind text NOT NULL,
    status text NOT NULL,
    program_address text NOT NULL,
    coach_authority_address text NOT NULL,
    client_wallet_address text NOT NULL,
    coach_client_credits_address text NOT NULL,
    credit_reservation_address text NOT NULL,
    scheduled_start_at timestamp with time zone NOT NULL,
    early_return_until timestamp with time zone NOT NULL,
    transaction_signature text,
    submitted_at timestamp with time zone,
    observed_reservation_status text,
    observed_available_credits bigint,
    observed_reserved_credits bigint,
    observed_total_purchased bigint,
    observed_slot bigint,
    finalized_at timestamp with time zone,
    failure_code text,
    failed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    authority_address text,
    prepared_summary jsonb,
    prepared_transaction_base64 text,
    prepared_message_base64 text,
    recent_blockhash text,
    last_valid_block_height bigint,
    prepared_at timestamp with time zone,
    simulation_slot bigint,
    simulation_units_consumed bigint,
    prior_transaction_signatures text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT coach_booking_credit_operations_address_check CHECK (((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (client_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_client_credits_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (credit_reservation_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text))),
    CONSTRAINT coach_booking_credit_operations_evidence_group_check CHECK ((((observed_reservation_status IS NULL) = (observed_available_credits IS NULL)) AND ((observed_reservation_status IS NULL) = (observed_reserved_credits IS NULL)) AND ((observed_reservation_status IS NULL) = (observed_total_purchased IS NULL)) AND ((observed_reservation_status IS NULL) = (observed_slot IS NULL)))),
    CONSTRAINT coach_booking_credit_operations_failure_state_check CHECK ((((status = ANY (ARRAY['failed'::text, 'expired'::text])) = (failure_code IS NOT NULL)) AND ((status = ANY (ARRAY['failed'::text, 'expired'::text])) = (failed_at IS NOT NULL)))),
    CONSTRAINT coach_booking_credit_operations_finalized_state_check CHECK ((((status = 'finalized'::text) = (finalized_at IS NOT NULL)) AND ((status = 'finalized'::text) = (observed_reservation_status IS NOT NULL)))),
    CONSTRAINT coach_booking_credit_operations_kind_check CHECK ((kind = ANY (ARRAY['reserve'::text, 'return'::text, 'consume'::text]))),
    CONSTRAINT coach_booking_credit_operations_observed_balance_check CHECK (((observed_available_credits IS NULL) OR (((observed_available_credits >= 0) AND (observed_available_credits <= '9000000000000000'::bigint)) AND ((observed_reserved_credits >= 0) AND (observed_reserved_credits <= '9000000000000000'::bigint)) AND ((observed_total_purchased >= 0) AND (observed_total_purchased <= '9000000000000000'::bigint)) AND ((observed_available_credits + observed_reserved_credits) <= observed_total_purchased) AND (observed_slot >= 0)))),
    CONSTRAINT coach_booking_credit_operations_preparation_check CHECK ((((authority_address IS NULL) AND (prepared_summary IS NULL) AND (prepared_transaction_base64 IS NULL) AND (prepared_message_base64 IS NULL) AND (recent_blockhash IS NULL) AND (last_valid_block_height IS NULL) AND (prepared_at IS NULL) AND (simulation_slot IS NULL) AND (simulation_units_consumed IS NULL)) OR ((authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (jsonb_typeof(prepared_summary) = 'object'::text) AND ((char_length(prepared_transaction_base64) >= 4) AND (char_length(prepared_transaction_base64) <= 2000)) AND ((char_length(prepared_message_base64) >= 4) AND (char_length(prepared_message_base64) <= 2000)) AND (recent_blockhash ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (last_valid_block_height >= 0) AND (prepared_at IS NOT NULL) AND (simulation_slot >= 0) AND ((simulation_units_consumed IS NULL) OR (simulation_units_consumed >= 0))))),
    CONSTRAINT coach_booking_credit_operations_reservation_status_check CHECK (((observed_reservation_status IS NULL) OR (observed_reservation_status = ANY (ARRAY['reserved'::text, 'returned'::text, 'consumed'::text])))),
    CONSTRAINT coach_booking_credit_operations_signature_check CHECK (((transaction_signature IS NULL) OR (transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'::text))),
    CONSTRAINT coach_booking_credit_operations_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'submitted'::text, 'finalized'::text, 'failed'::text, 'expired'::text])))
);

ALTER TABLE ONLY app.coach_booking_credit_operations FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_booking_credit_operations OWNER TO app_owner;

--
-- Name: TABLE coach_booking_credit_operations; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_booking_credit_operations IS 'Idempotent prepared/submitted/finalized evidence records for one Solana reservation transition.';


--
-- Name: coach_booking_requests; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_booking_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    slot_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    client_profile_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_start_at timestamp with time zone NOT NULL,
    scheduled_end_at timestamp with time zone NOT NULL,
    coach_timezone text NOT NULL,
    coach_training_location_id uuid,
    training_location_name text NOT NULL,
    location_kind text NOT NULL,
    gym_name text,
    public_location_label text NOT NULL,
    decision_deadline_at timestamp with time zone NOT NULL,
    decided_by_profile_id uuid,
    decided_at timestamp with time zone,
    accepted_booking_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_booking_requests_distinct_participants_check CHECK ((coach_profile_id <> client_profile_id)),
    CONSTRAINT coach_booking_requests_location_check CHECK ((((char_length(training_location_name) >= 2) AND (char_length(training_location_name) <= 240)) AND ((char_length(public_location_label) >= 2) AND (char_length(public_location_label) <= 240)) AND (((location_kind = 'gym'::text) AND (gym_name IS NOT NULL) AND ((char_length(gym_name) >= 2) AND (char_length(gym_name) <= 120))) OR ((location_kind = 'independent'::text) AND (gym_name IS NULL))))),
    CONSTRAINT coach_booking_requests_state_check CHECK ((((status = 'pending'::text) AND (decided_by_profile_id IS NULL) AND (decided_at IS NULL) AND (accepted_booking_id IS NULL)) OR ((status = 'accepted'::text) AND (decided_by_profile_id = coach_profile_id) AND (decided_at IS NOT NULL) AND (accepted_booking_id IS NOT NULL)) OR ((status = ANY (ARRAY['declined'::text, 'not-selected'::text])) AND (decided_by_profile_id = coach_profile_id) AND (decided_at IS NOT NULL) AND (accepted_booking_id IS NULL)) OR ((status = 'withdrawn'::text) AND (decided_by_profile_id = client_profile_id) AND (decided_at IS NOT NULL) AND (accepted_booking_id IS NULL)) OR ((status = 'expired'::text) AND (decided_by_profile_id IS NULL) AND (decided_at IS NOT NULL) AND (accepted_booking_id IS NULL)) OR ((status = 'occurrence-closed'::text) AND ((decided_by_profile_id IS NULL) OR (decided_by_profile_id = coach_profile_id)) AND (decided_at IS NOT NULL) AND (accepted_booking_id IS NULL)))),
    CONSTRAINT coach_booking_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text, 'expired'::text, 'not-selected'::text, 'occurrence-closed'::text]))),
    CONSTRAINT coach_booking_requests_time_check CHECK ((((scheduled_end_at - scheduled_start_at) = '01:00:00'::interval) AND (decision_deadline_at > created_at) AND (decision_deadline_at <= scheduled_start_at))),
    CONSTRAINT coach_booking_requests_timezone_check CHECK (((coach_timezone = 'UTC'::text) OR (coach_timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text)))
);

ALTER TABLE ONLY app.coach_booking_requests FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_booking_requests OWNER TO app_owner;

--
-- Name: TABLE coach_booking_requests; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_booking_requests IS 'Independent client attempts for coach approval; pending rows never reserve occurrence capacity.';


--
-- Name: COLUMN coach_booking_requests.decision_deadline_at; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_booking_requests.decision_deadline_at IS 'Earlier of twelve hours after database creation or the immutable occurrence start.';


--
-- Name: coach_client_credit_projections; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_client_credit_projections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    client_profile_id uuid NOT NULL,
    program_address text NOT NULL,
    coach_authority_address text NOT NULL,
    client_wallet_address text NOT NULL,
    coach_client_credits_address text NOT NULL,
    available_credits bigint NOT NULL,
    reserved_credits bigint NOT NULL,
    total_purchased bigint NOT NULL,
    purchase_count bigint NOT NULL,
    next_purchase_nonce bigint NOT NULL,
    last_offer_address text NOT NULL,
    last_purchase_at timestamp with time zone NOT NULL,
    transaction_signature text NOT NULL,
    observed_slot bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_client_credit_projections_address_check CHECK (((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (client_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_client_credits_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (last_offer_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text))),
    CONSTRAINT coach_client_credit_projections_balance_check CHECK ((((available_credits >= 0) AND (available_credits <= '9000000000000000'::bigint)) AND ((reserved_credits >= 0) AND (reserved_credits <= '9000000000000000'::bigint)) AND ((total_purchased >= 0) AND (total_purchased <= '9000000000000000'::bigint)) AND ((available_credits + reserved_credits) <= total_purchased))),
    CONSTRAINT coach_client_credit_projections_purchase_check CHECK ((((purchase_count >= 1) AND (purchase_count <= '9000000000000000'::bigint)) AND ((next_purchase_nonce >= 1) AND (next_purchase_nonce <= '9000000000000000'::bigint)) AND (observed_slot >= 0))),
    CONSTRAINT coach_client_credit_projections_signature_check CHECK ((transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'::text))
);

ALTER TABLE ONLY app.coach_client_credit_projections FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_client_credit_projections OWNER TO app_owner;

--
-- Name: TABLE coach_client_credit_projections; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_client_credit_projections IS 'Finalized Solana coach-client ledger projections; rows never create credits.';


--
-- Name: coach_follows; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_follows (
    run_id uuid NOT NULL,
    follower_profile_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_follows_no_self_follow_check CHECK ((follower_profile_id <> coach_profile_id))
);

ALTER TABLE ONLY app.coach_follows FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_follows OWNER TO app_owner;

--
-- Name: coach_group_registrations; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_group_registrations (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    session_id uuid NOT NULL,
    athlete_profile_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT coach_group_registrations_check CHECK (((status = 'active'::text) = (resolved_at IS NULL))),
    CONSTRAINT coach_group_registrations_check1 CHECK (((resolved_at IS NULL) OR (resolved_at >= created_at))),
    CONSTRAINT coach_group_registrations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'withdrawn'::text, 'session-cancelled'::text, 'session-not-confirmed'::text])))
);

ALTER TABLE ONLY app.coach_group_registrations FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_group_registrations OWNER TO app_owner;

--
-- Name: coach_pass_purchase_operations; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_pass_purchase_operations (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    client_profile_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    status text NOT NULL,
    operation_kind text NOT NULL,
    program_address text NOT NULL,
    authority_address text NOT NULL,
    coach_authority_address text NOT NULL,
    offer_address text NOT NULL,
    client_wallet_address text NOT NULL,
    coach_client_credits_address text NOT NULL,
    price_eurc_base_units bigint NOT NULL,
    credits_purchased smallint NOT NULL,
    expected_purchase_nonce bigint NOT NULL,
    baseline_ledger_exists boolean NOT NULL,
    baseline_available_credits bigint NOT NULL,
    baseline_reserved_credits bigint NOT NULL,
    baseline_total_purchased bigint NOT NULL,
    baseline_purchase_count bigint NOT NULL,
    prepared_summary jsonb NOT NULL,
    prepared_transaction_base64 text NOT NULL,
    prepared_message_base64 text NOT NULL,
    recent_blockhash text NOT NULL,
    last_valid_block_height bigint NOT NULL,
    prepared_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    simulation_slot bigint NOT NULL,
    simulation_units_consumed bigint,
    transaction_signature text,
    submitted_at timestamp with time zone,
    observed_available_credits bigint,
    observed_reserved_credits bigint,
    observed_total_purchased bigint,
    observed_purchase_count bigint,
    observed_next_purchase_nonce bigint,
    observed_slot bigint,
    finalized_at timestamp with time zone,
    failure_code text,
    failed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_pass_purchase_operations_actor_check CHECK ((client_profile_id <> coach_profile_id)),
    CONSTRAINT coach_pass_purchase_operations_address_check CHECK (((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (offer_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (client_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_client_credits_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (recent_blockhash ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text))),
    CONSTRAINT coach_pass_purchase_operations_failure_state_check CHECK ((((status = ANY (ARRAY['failed'::text, 'expired'::text])) = (failure_code IS NOT NULL)) AND ((status = ANY (ARRAY['failed'::text, 'expired'::text])) = (failed_at IS NOT NULL)))),
    CONSTRAINT coach_pass_purchase_operations_finalized_state_check CHECK ((((status = 'finalized'::text) = (finalized_at IS NOT NULL)) AND ((status = 'finalized'::text) = (observed_available_credits IS NOT NULL)))),
    CONSTRAINT coach_pass_purchase_operations_kind_check CHECK ((operation_kind = ANY (ARRAY['purchase-first-offer'::text, 'purchase-offer'::text]))),
    CONSTRAINT coach_pass_purchase_operations_observed_check CHECK ((((observed_available_credits IS NULL) = (observed_reserved_credits IS NULL)) AND ((observed_available_credits IS NULL) = (observed_total_purchased IS NULL)) AND ((observed_available_credits IS NULL) = (observed_purchase_count IS NULL)) AND ((observed_available_credits IS NULL) = (observed_next_purchase_nonce IS NULL)) AND ((observed_available_credits IS NULL) = (observed_slot IS NULL)) AND ((observed_available_credits IS NULL) OR (((observed_available_credits >= 0) AND (observed_available_credits <= '9000000000000000'::bigint)) AND ((observed_reserved_credits >= 0) AND (observed_reserved_credits <= '9000000000000000'::bigint)) AND ((observed_total_purchased >= 0) AND (observed_total_purchased <= '9000000000000000'::bigint)) AND ((observed_available_credits + observed_reserved_credits) <= observed_total_purchased) AND (observed_purchase_count >= 1) AND (observed_next_purchase_nonce >= 1) AND (observed_slot >= 0))))),
    CONSTRAINT coach_pass_purchase_operations_preparation_check CHECK (((jsonb_typeof(prepared_summary) = 'object'::text) AND ((char_length(prepared_transaction_base64) >= 4) AND (char_length(prepared_transaction_base64) <= 2000)) AND ((char_length(prepared_message_base64) >= 4) AND (char_length(prepared_message_base64) <= 2000)) AND (last_valid_block_height >= 0) AND (simulation_slot >= 0) AND ((simulation_units_consumed IS NULL) OR (simulation_units_consumed >= 0)))),
    CONSTRAINT coach_pass_purchase_operations_signature_check CHECK (((transaction_signature IS NULL) OR (transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'::text))),
    CONSTRAINT coach_pass_purchase_operations_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'submitted'::text, 'finalized'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT coach_pass_purchase_operations_submission_state_check CHECK ((((status <> ALL (ARRAY['submitted'::text, 'finalized'::text])) OR (transaction_signature IS NOT NULL)) AND ((transaction_signature IS NULL) = (submitted_at IS NULL)))),
    CONSTRAINT coach_pass_purchase_operations_terms_check CHECK (((price_eurc_base_units > 0) AND (credits_purchased = ANY (ARRAY[1, 10])) AND (expected_purchase_nonce >= 0) AND ((baseline_available_credits >= 0) AND (baseline_available_credits <= '9000000000000000'::bigint)) AND ((baseline_reserved_credits >= 0) AND (baseline_reserved_credits <= '9000000000000000'::bigint)) AND ((baseline_total_purchased >= 0) AND (baseline_total_purchased <= '9000000000000000'::bigint)) AND (baseline_purchase_count >= 0) AND ((baseline_available_credits + baseline_reserved_credits) <= baseline_total_purchased) AND ((baseline_ledger_exists AND (operation_kind = 'purchase-offer'::text)) OR ((NOT baseline_ledger_exists) AND (operation_kind = 'purchase-first-offer'::text) AND (expected_purchase_nonce = 0) AND (baseline_available_credits = 0) AND (baseline_reserved_credits = 0) AND (baseline_total_purchased = 0) AND (baseline_purchase_count = 0)))))
);

ALTER TABLE ONLY app.coach_pass_purchase_operations FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_pass_purchase_operations OWNER TO app_owner;

--
-- Name: TABLE coach_pass_purchase_operations; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_pass_purchase_operations IS 'Actor-scoped Devnet coach-pass purchase attempts with exact prepared messages, submission identity and finalized ledger evidence.';


--
-- Name: coach_posts; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_posts (
    run_id uuid NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_profile_id uuid NOT NULL,
    body text NOT NULL,
    visibility text DEFAULT 'visible'::text NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    record_source text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_posts_body_length_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 500))),
    CONSTRAINT coach_posts_body_normalized_check CHECK ((body = btrim(regexp_replace(body, '[[:space:]]+'::text, ' '::text, 'g'::text)))),
    CONSTRAINT coach_posts_record_source_check CHECK ((record_source = ANY (ARRAY['fixture'::text, 'user'::text]))),
    CONSTRAINT coach_posts_visibility_check CHECK ((visibility = ANY (ARRAY['visible'::text, 'hidden'::text])))
);

ALTER TABLE ONLY app.coach_posts FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_posts OWNER TO app_owner;

--
-- Name: coach_profile_disciplines; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_profile_disciplines (
    run_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    discipline text NOT NULL,
    sort_order smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_profile_disciplines_sort_order_check CHECK (((sort_order >= 1) AND (sort_order <= 4))),
    CONSTRAINT coach_profile_disciplines_value_check CHECK ((discipline = ANY (ARRAY['Boxing'::text, 'Muay Thai'::text, 'Kickboxing'::text, 'Brazilian Jiu-Jitsu'::text, 'MMA'::text, 'Wrestling'::text])))
);

ALTER TABLE ONLY app.coach_profile_disciplines FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_profile_disciplines OWNER TO app_owner;

--
-- Name: coach_profiles; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_profiles (
    run_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    public_slug text NOT NULL,
    display_name text NOT NULL,
    bio text NOT NULL,
    service_mode text DEFAULT 'private-training'::text NOT NULL,
    timezone text NOT NULL,
    selected_gym_id uuid,
    location_kind text NOT NULL,
    public_location_label text NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    location_source text NOT NULL,
    location_provider text,
    location_confirmed_at timestamp with time zone NOT NULL,
    visibility text DEFAULT 'hidden'::text NOT NULL,
    record_source text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    early_cancellation_minutes integer DEFAULT 1440 NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    portrait_source text,
    portrait_path text,
    portrait_updated_at timestamp with time zone,
    CONSTRAINT coach_profiles_bio_length_check CHECK (((char_length(bio) >= 40) AND (char_length(bio) <= 1200))),
    CONSTRAINT coach_profiles_display_name_length_check CHECK (((char_length(display_name) >= 2) AND (char_length(display_name) <= 80))),
    CONSTRAINT coach_profiles_early_cancellation_check CHECK (((early_cancellation_minutes >= 0) AND (early_cancellation_minutes <= 10080))),
    CONSTRAINT coach_profiles_gym_location_check CHECK ((((location_kind = 'gym'::text) AND (selected_gym_id IS NOT NULL)) OR ((location_kind = 'independent'::text) AND (selected_gym_id IS NULL)))),
    CONSTRAINT coach_profiles_latitude_check CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT coach_profiles_location_kind_check CHECK ((location_kind = ANY (ARRAY['gym'::text, 'independent'::text]))),
    CONSTRAINT coach_profiles_location_label_length_check CHECK (((char_length(public_location_label) >= 2) AND (char_length(public_location_label) <= 240))),
    CONSTRAINT coach_profiles_location_provenance_check CHECK ((((location_source = ANY (ARRAY['fixture'::text, 'manual'::text])) AND (location_provider IS NULL)) OR ((location_source = 'permanent-geocoding'::text) AND (location_provider IS NOT NULL)))),
    CONSTRAINT coach_profiles_location_provider_check CHECK (((location_provider IS NULL) OR (((char_length(location_provider) >= 2) AND (char_length(location_provider) <= 40)) AND (location_provider ~ '^[a-z0-9-]+$'::text)))),
    CONSTRAINT coach_profiles_location_source_check CHECK ((location_source = ANY (ARRAY['fixture'::text, 'manual'::text, 'permanent-geocoding'::text]))),
    CONSTRAINT coach_profiles_longitude_check CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
    CONSTRAINT coach_profiles_portrait_reference_check CHECK ((((portrait_source IS NULL) AND (portrait_path IS NULL) AND (portrait_updated_at IS NULL)) OR ((portrait_source = ANY (ARRAY['fixture'::text, 'storage'::text])) AND (portrait_path IS NOT NULL) AND (portrait_updated_at IS NOT NULL) AND (((portrait_source = 'fixture'::text) AND is_demo AND (portrait_path = concat('/images/coaches/', public_slug, '.webp'))) OR ((portrait_source = 'storage'::text) AND (portrait_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'::text) AND (split_part(portrait_path, '/'::text, 1) = (profile_id)::text)))))),
    CONSTRAINT coach_profiles_record_source_check CHECK ((record_source = ANY (ARRAY['fixture'::text, 'user'::text]))),
    CONSTRAINT coach_profiles_service_mode_check CHECK ((service_mode = 'private-training'::text)),
    CONSTRAINT coach_profiles_slug_format_check CHECK ((public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT coach_profiles_timezone_format_check CHECK (((timezone = 'UTC'::text) OR (timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text))),
    CONSTRAINT coach_profiles_visibility_check CHECK ((visibility = ANY (ARRAY['visible'::text, 'hidden'::text])))
);

ALTER TABLE ONLY app.coach_profiles FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_profiles OWNER TO app_owner;

--
-- Name: TABLE coach_profiles; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_profiles IS 'Self-declared coach discovery profiles with a synchronized legacy primary-location snapshot; app.coach_training_locations is the location source of truth.';


--
-- Name: COLUMN coach_profiles.public_location_label; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_profiles.public_location_label IS 'Coach-confirmed public discovery label, not live location or proof of current presence.';


--
-- Name: COLUMN coach_profiles.location_provider; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_profiles.location_provider IS 'Optional provider provenance only; public rendering is provider-neutral.';


--
-- Name: COLUMN coach_profiles.early_cancellation_minutes; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_profiles.early_cancellation_minutes IS 'Coach-owned policy; each prepared booking snapshots its resulting cutoff.';


--
-- Name: COLUMN coach_profiles.is_demo; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_profiles.is_demo IS 'Immutable marker for fictional demonstration coaches; demo profiles never receive the real verified-coach badge.';


--
-- Name: COLUMN coach_profiles.portrait_source; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_profiles.portrait_source IS 'Optional public portrait source: a checked-in fictional fixture or owner-uploaded Storage object.';


--
-- Name: coach_training_locations; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.coach_training_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    public_name text NOT NULL,
    timezone text NOT NULL,
    selected_gym_id uuid,
    location_kind text NOT NULL,
    public_location_label text NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    location_source text NOT NULL,
    location_provider text,
    location_confirmed_at timestamp with time zone NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order smallint NOT NULL,
    deactivated_at timestamp with time zone,
    record_source text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coach_training_locations_deactivation_check CHECK (((status = 'inactive'::text) = (deactivated_at IS NOT NULL))),
    CONSTRAINT coach_training_locations_gym_kind_check CHECK ((((location_kind = 'gym'::text) AND (selected_gym_id IS NOT NULL)) OR ((location_kind = 'independent'::text) AND (selected_gym_id IS NULL)))),
    CONSTRAINT coach_training_locations_kind_check CHECK ((location_kind = ANY (ARRAY['gym'::text, 'independent'::text]))),
    CONSTRAINT coach_training_locations_label_length_check CHECK (((char_length(public_location_label) >= 2) AND (char_length(public_location_label) <= 240))),
    CONSTRAINT coach_training_locations_latitude_check CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT coach_training_locations_longitude_check CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
    CONSTRAINT coach_training_locations_name_length_check CHECK (((char_length(public_name) >= 2) AND (char_length(public_name) <= 240))),
    CONSTRAINT coach_training_locations_primary_state_check CHECK (((NOT is_primary) OR (status = 'active'::text))),
    CONSTRAINT coach_training_locations_provenance_check CHECK ((((location_source = ANY (ARRAY['fixture'::text, 'manual'::text])) AND (location_provider IS NULL)) OR ((location_source = 'permanent-geocoding'::text) AND (location_provider IS NOT NULL)))),
    CONSTRAINT coach_training_locations_provider_check CHECK (((location_provider IS NULL) OR (((char_length(location_provider) >= 2) AND (char_length(location_provider) <= 40)) AND (location_provider ~ '^[a-z0-9-]+$'::text)))),
    CONSTRAINT coach_training_locations_record_source_check CHECK ((record_source = ANY (ARRAY['fixture'::text, 'user'::text]))),
    CONSTRAINT coach_training_locations_sort_order_check CHECK (((sort_order >= 1) AND (sort_order <= 32767))),
    CONSTRAINT coach_training_locations_source_check CHECK ((location_source = ANY (ARRAY['fixture'::text, 'manual'::text, 'permanent-geocoding'::text]))),
    CONSTRAINT coach_training_locations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT coach_training_locations_timezone_format_check CHECK (((timezone = 'UTC'::text) OR (timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text)))
);

ALTER TABLE ONLY app.coach_training_locations FORCE ROW LEVEL SECURITY;


ALTER TABLE app.coach_training_locations OWNER TO app_owner;

--
-- Name: TABLE coach_training_locations; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.coach_training_locations IS 'Owner-scoped confirmed coach training places. Optional reviewed gym references are location labels only and grant no gym or account authority.';


--
-- Name: COLUMN coach_training_locations.public_name; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_training_locations.public_name IS 'Provider-neutral public place name; gym-backed rows copy the reviewed gym name.';


--
-- Name: COLUMN coach_training_locations.location_provider; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.coach_training_locations.location_provider IS 'Optional provider provenance only; public rendering is provider-neutral.';


--
-- Name: demo_run_participants; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.demo_run_participants (
    run_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    role text NOT NULL,
    status text NOT NULL,
    joined_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT demo_run_participants_revoked_state_check CHECK (((status = 'revoked'::text) = (revoked_at IS NOT NULL))),
    CONSTRAINT demo_run_participants_role_check CHECK ((role = ANY (ARRAY['member'::text, 'operator'::text]))),
    CONSTRAINT demo_run_participants_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text])))
);

ALTER TABLE ONLY app.demo_run_participants FORCE ROW LEVEL SECURITY;


ALTER TABLE app.demo_run_participants OWNER TO app_owner;

--
-- Name: TABLE demo_run_participants; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.demo_run_participants IS 'Profiles participating in an isolated application demo dataset; not customer fitness memberships.';


--
-- Name: demo_runs; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.demo_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    catalogue_visibility text NOT NULL,
    schedule_anchor_date date NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    retired_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT demo_runs_catalogue_visibility_check CHECK ((catalogue_visibility = ANY (ARRAY['private'::text, 'public'::text]))),
    CONSTRAINT demo_runs_retired_state_check CHECK (((status = 'retired'::text) = (retired_at IS NOT NULL))),
    CONSTRAINT demo_runs_slug_format_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT demo_runs_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'active'::text, 'retired'::text]))),
    CONSTRAINT demo_runs_time_order_check CHECK ((ends_at > starts_at))
);

ALTER TABLE ONLY app.demo_runs FORCE ROW LEVEL SECURITY;


ALTER TABLE app.demo_runs OWNER TO app_owner;

--
-- Name: group_event_chain_operations; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.group_event_chain_operations (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    event_id uuid NOT NULL,
    actor_profile_id uuid NOT NULL,
    operation_kind text NOT NULL,
    status text NOT NULL,
    program_address text NOT NULL,
    authority_address text NOT NULL,
    coach_authority_address text NOT NULL,
    event_pool_address text NOT NULL,
    vault_address text NOT NULL,
    contribution_address text,
    prepared_summary jsonb NOT NULL,
    prepared_transaction_base64 text NOT NULL,
    prepared_message_base64 text NOT NULL,
    recent_blockhash text NOT NULL,
    last_valid_block_height bigint NOT NULL,
    prepared_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    simulation_slot bigint NOT NULL,
    simulation_units_consumed bigint,
    transaction_signature text,
    prior_transaction_signatures text[] DEFAULT '{}'::text[] NOT NULL,
    submitted_at timestamp with time zone,
    observed_slot bigint,
    finalized_at timestamp with time zone,
    failure_code text,
    failed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_event_chain_operations_address_check CHECK (((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (vault_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND ((contribution_address IS NULL) OR (contribution_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text)))),
    CONSTRAINT group_event_chain_operations_contribution_check CHECK ((((operation_kind = ANY (ARRAY['fund-event-seat'::text, 'claim-event-refund'::text])) AND (contribution_address IS NOT NULL)) OR ((operation_kind <> ALL (ARRAY['fund-event-seat'::text, 'claim-event-refund'::text])) AND (contribution_address IS NULL)))),
    CONSTRAINT group_event_chain_operations_failure_check CHECK ((((status = ANY (ARRAY['failed'::text, 'expired'::text])) = (failure_code IS NOT NULL)) AND ((status = ANY (ARRAY['failed'::text, 'expired'::text])) = (failed_at IS NOT NULL)) AND ((failure_code IS NULL) OR (failure_code = ANY (ARRAY['wallet-rejected'::text, 'simulation-failed'::text, 'blockhash-expired'::text, 'transaction-failed'::text, 'state-not-observed'::text]))))),
    CONSTRAINT group_event_chain_operations_finalization_check CHECK ((((status = 'finalized'::text) = (observed_slot IS NOT NULL)) AND ((status = 'finalized'::text) = (finalized_at IS NOT NULL)) AND ((observed_slot IS NULL) OR (observed_slot >= 0)))),
    CONSTRAINT group_event_chain_operations_kind_check CHECK ((operation_kind = ANY (ARRAY['create-event-pool'::text, 'fund-event-seat'::text, 'settle-event-pool'::text, 'claim-event-payout'::text, 'claim-event-refund'::text]))),
    CONSTRAINT group_event_chain_operations_preparation_check CHECK (((jsonb_typeof(prepared_summary) = 'object'::text) AND ((char_length(prepared_transaction_base64) >= 4) AND (char_length(prepared_transaction_base64) <= 2000)) AND ((char_length(prepared_message_base64) >= 4) AND (char_length(prepared_message_base64) <= 2000)) AND (recent_blockhash ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (last_valid_block_height >= 0) AND (simulation_slot >= 0) AND ((simulation_units_consumed IS NULL) OR (simulation_units_consumed >= 0)))),
    CONSTRAINT group_event_chain_operations_signature_check CHECK (((transaction_signature IS NULL) OR (transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'::text))),
    CONSTRAINT group_event_chain_operations_status_check CHECK ((status = ANY (ARRAY['prepared'::text, 'submitted'::text, 'finalized'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT group_event_chain_operations_submission_check CHECK ((((transaction_signature IS NULL) = (submitted_at IS NULL)) AND ((status <> ALL (ARRAY['submitted'::text, 'finalized'::text])) OR (transaction_signature IS NOT NULL))))
);

ALTER TABLE ONLY app.group_event_chain_operations FORCE ROW LEVEL SECURITY;


ALTER TABLE app.group_event_chain_operations OWNER TO app_owner;

--
-- Name: TABLE group_event_chain_operations; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.group_event_chain_operations IS 'Recoverable platform-funded Devnet EventPool operations; actor wallet keeps business authority.';


--
-- Name: group_event_contribution_projections; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.group_event_contribution_projections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    event_id uuid NOT NULL,
    participant_profile_id uuid NOT NULL,
    program_address text NOT NULL,
    event_pool_address text NOT NULL,
    contribution_address text NOT NULL,
    participant_wallet_address text NOT NULL,
    amount_base_units bigint NOT NULL,
    lifecycle_status text NOT NULL,
    transaction_signature text NOT NULL,
    observed_slot bigint NOT NULL,
    finalized_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_event_contribution_projections_address_check CHECK (((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (contribution_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (participant_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text))),
    CONSTRAINT group_event_contribution_projections_amount_check CHECK (((amount_base_units >= 1) AND (amount_base_units <= '9000000000000000'::bigint))),
    CONSTRAINT group_event_contribution_projections_lifecycle_check CHECK ((lifecycle_status = ANY (ARRAY['funded'::text, 'refundable'::text, 'refunded'::text, 'successful'::text]))),
    CONSTRAINT group_event_contribution_projections_signature_check CHECK ((transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'::text)),
    CONSTRAINT group_event_contribution_projections_slot_check CHECK ((observed_slot >= 0))
);

ALTER TABLE ONLY app.group_event_contribution_projections FORCE ROW LEVEL SECURITY;


ALTER TABLE app.group_event_contribution_projections OWNER TO app_owner;

--
-- Name: TABLE group_event_contribution_projections; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.group_event_contribution_projections IS 'Actor-scoped finalized Contribution projections; never a public participant list.';


--
-- Name: group_event_pool_projections; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.group_event_pool_projections (
    event_id uuid NOT NULL,
    run_id uuid NOT NULL,
    program_address text NOT NULL,
    event_pool_address text NOT NULL,
    vault_address text NOT NULL,
    coach_authority_address text NOT NULL,
    payout_recipient_address text NOT NULL,
    mint_address text NOT NULL,
    token_program_address text NOT NULL,
    seat_price_base_units bigint NOT NULL,
    minimum_participants smallint NOT NULL,
    maximum_participants smallint NOT NULL,
    participant_count smallint NOT NULL,
    funding_deadline timestamp with time zone NOT NULL,
    event_starts_at timestamp with time zone NOT NULL,
    event_ends_at timestamp with time zone NOT NULL,
    lifecycle_status text NOT NULL,
    transaction_signature text NOT NULL,
    observed_slot bigint NOT NULL,
    finalized_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_event_pool_projections_address_check CHECK (((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (vault_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (payout_recipient_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (mint_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (token_program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text))),
    CONSTRAINT group_event_pool_projections_capacity_check CHECK ((((minimum_participants >= 2) AND (minimum_participants <= 50)) AND ((maximum_participants >= minimum_participants) AND (maximum_participants <= 50)) AND ((participant_count >= 0) AND (participant_count <= maximum_participants)))),
    CONSTRAINT group_event_pool_projections_lifecycle_check CHECK ((lifecycle_status = ANY (ARRAY['funding'::text, 'succeeded'::text, 'paid'::text, 'failed'::text]))),
    CONSTRAINT group_event_pool_projections_lifecycle_count_check CHECK (((lifecycle_status = 'funding'::text) OR ((lifecycle_status = ANY (ARRAY['succeeded'::text, 'paid'::text])) AND (participant_count >= minimum_participants)) OR ((lifecycle_status = 'failed'::text) AND (participant_count < minimum_participants)))),
    CONSTRAINT group_event_pool_projections_price_check CHECK (((seat_price_base_units >= 1) AND (seat_price_base_units <= '9000000000000000'::bigint))),
    CONSTRAINT group_event_pool_projections_signature_check CHECK ((transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'::text)),
    CONSTRAINT group_event_pool_projections_slot_check CHECK ((observed_slot >= 0)),
    CONSTRAINT group_event_pool_projections_time_check CHECK (((funding_deadline < event_starts_at) AND (((event_ends_at - event_starts_at) >= '00:30:00'::interval) AND ((event_ends_at - event_starts_at) <= '12:00:00'::interval)))),
    CONSTRAINT group_event_pool_projections_token_check CHECK (((mint_address = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'::text) AND (token_program_address = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'::text)))
);

ALTER TABLE ONLY app.group_event_pool_projections FORCE ROW LEVEL SECURITY;


ALTER TABLE app.group_event_pool_projections OWNER TO app_owner;

--
-- Name: TABLE group_event_pool_projections; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.group_event_pool_projections IS 'Last finalized EventPool projection supplied by the trusted DEV0122 verifier.';


--
-- Name: CONSTRAINT group_event_pool_projections_token_check ON group_event_pool_projections; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON CONSTRAINT group_event_pool_projections_token_check ON app.group_event_pool_projections IS 'Finalized group-event projections must use Circle official Solana Devnet EURC through the legacy SPL Token program.';


--
-- Name: group_events; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.group_events (
    id uuid NOT NULL,
    run_id uuid NOT NULL,
    coach_profile_id uuid NOT NULL,
    public_slug text NOT NULL,
    title text NOT NULL,
    discipline text NOT NULL,
    description text NOT NULL,
    coach_slug_snapshot text NOT NULL,
    coach_display_name_snapshot text NOT NULL,
    location_kind_snapshot text NOT NULL,
    location_label_snapshot text NOT NULL,
    location_timezone_snapshot text NOT NULL,
    latitude_snapshot numeric(9,6) NOT NULL,
    longitude_snapshot numeric(9,6) NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    media_url text,
    source_proposal_id uuid,
    publication_status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    withdrawn_at timestamp with time zone,
    program_address text,
    event_pool_address text,
    coach_wallet_address_snapshot text,
    projection_availability text DEFAULT 'unbound'::text NOT NULL,
    projection_status_updated_at timestamp with time zone,
    record_source text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_events_binding_address_check CHECK ((((program_address IS NULL) AND (event_pool_address IS NULL) AND (coach_wallet_address_snapshot IS NULL)) OR ((program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text) AND (coach_wallet_address_snapshot ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'::text)))),
    CONSTRAINT group_events_coach_snapshot_check CHECK (((coach_slug_snapshot ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text) AND ((char_length(coach_display_name_snapshot) >= 2) AND (char_length(coach_display_name_snapshot) <= 80)))),
    CONSTRAINT group_events_description_check CHECK ((((char_length(description) >= 20) AND (char_length(description) <= 2000)) AND (description !~ '[[:cntrl:]]'::text))),
    CONSTRAINT group_events_discipline_check CHECK ((discipline = ANY (ARRAY['Boxing'::text, 'Muay Thai'::text, 'Kickboxing'::text, 'Brazilian Jiu-Jitsu'::text, 'MMA'::text, 'Wrestling'::text]))),
    CONSTRAINT group_events_latitude_check CHECK (((latitude_snapshot >= ('-90'::integer)::numeric) AND (latitude_snapshot <= (90)::numeric))),
    CONSTRAINT group_events_location_kind_check CHECK ((location_kind_snapshot = ANY (ARRAY['gym'::text, 'independent'::text]))),
    CONSTRAINT group_events_location_label_check CHECK (((char_length(location_label_snapshot) >= 2) AND (char_length(location_label_snapshot) <= 240))),
    CONSTRAINT group_events_location_timezone_check CHECK (((location_timezone_snapshot = 'UTC'::text) OR (location_timezone_snapshot ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text))),
    CONSTRAINT group_events_longitude_check CHECK (((longitude_snapshot >= ('-180'::integer)::numeric) AND (longitude_snapshot <= (180)::numeric))),
    CONSTRAINT group_events_media_url_check CHECK (((media_url IS NULL) OR (((char_length(media_url) >= 1) AND (char_length(media_url) <= 1024)) AND (media_url !~ '[[:space:]]'::text) AND ((media_url ~ '^https://'::text) OR (media_url ~ '^/'::text))))),
    CONSTRAINT group_events_projection_availability_check CHECK ((projection_availability = ANY (ARRAY['unbound'::text, 'pending'::text, 'current'::text, 'unavailable'::text]))),
    CONSTRAINT group_events_projection_binding_check CHECK ((((projection_availability = 'unbound'::text) AND (program_address IS NULL) AND (event_pool_address IS NULL) AND (coach_wallet_address_snapshot IS NULL) AND (projection_status_updated_at IS NULL)) OR ((projection_availability <> 'unbound'::text) AND (program_address IS NOT NULL) AND (event_pool_address IS NOT NULL) AND (coach_wallet_address_snapshot IS NOT NULL) AND (projection_status_updated_at IS NOT NULL)))),
    CONSTRAINT group_events_publication_state_check CHECK ((((publication_status = 'draft'::text) AND (published_at IS NULL) AND (withdrawn_at IS NULL)) OR ((publication_status = 'published'::text) AND (published_at IS NOT NULL) AND (withdrawn_at IS NULL)) OR ((publication_status = 'withdrawn'::text) AND (published_at IS NULL) AND (withdrawn_at IS NOT NULL)))),
    CONSTRAINT group_events_publication_status_check CHECK ((publication_status = ANY (ARRAY['draft'::text, 'published'::text, 'withdrawn'::text]))),
    CONSTRAINT group_events_published_binding_check CHECK (((publication_status <> 'published'::text) OR ((program_address IS NOT NULL) AND (event_pool_address IS NOT NULL) AND (projection_availability <> 'unbound'::text)))),
    CONSTRAINT group_events_record_source_check CHECK ((record_source = ANY (ARRAY['fixture'::text, 'user'::text]))),
    CONSTRAINT group_events_slug_check CHECK ((public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT group_events_time_check CHECK ((((ends_at - starts_at) >= '00:30:00'::interval) AND ((ends_at - starts_at) <= '12:00:00'::interval))),
    CONSTRAINT group_events_title_check CHECK ((((char_length(title) >= 3) AND (char_length(title) <= 120)) AND (title !~ '[[:cntrl:]]'::text)))
);

ALTER TABLE ONLY app.group_events FORCE ROW LEVEL SECURITY;


ALTER TABLE app.group_events OWNER TO app_owner;

--
-- Name: TABLE group_events; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.group_events IS 'Coach-owned event metadata and immutable coach/location snapshots; never financial authority.';


--
-- Name: COLUMN group_events.source_proposal_id; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.group_events.source_proposal_id IS 'Optional non-authoritative proposal UUID; DEV0118 may add referential integrity later.';


--
-- Name: gyms; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.gyms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    public_location_label text NOT NULL,
    area text NOT NULL,
    city text NOT NULL,
    country_code text NOT NULL,
    timezone text NOT NULL,
    latitude numeric(9,6) NOT NULL,
    longitude numeric(9,6) NOT NULL,
    location_source text NOT NULL,
    location_provider text,
    location_confirmed_at timestamp with time zone NOT NULL,
    status text NOT NULL,
    record_source text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gyms_area_length_check CHECK (((char_length(area) >= 1) AND (char_length(area) <= 120))),
    CONSTRAINT gyms_city_length_check CHECK (((char_length(city) >= 1) AND (char_length(city) <= 120))),
    CONSTRAINT gyms_country_code_check CHECK ((country_code ~ '^[A-Z]{2}$'::text)),
    CONSTRAINT gyms_description_length_check CHECK (((char_length(description) >= 1) AND (char_length(description) <= 2000))),
    CONSTRAINT gyms_latitude_check CHECK (((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))),
    CONSTRAINT gyms_location_provenance_check CHECK ((((location_source = ANY (ARRAY['fixture'::text, 'manual'::text])) AND (location_provider IS NULL)) OR ((location_source = 'permanent-geocoding'::text) AND (location_provider IS NOT NULL)))),
    CONSTRAINT gyms_location_provider_check CHECK (((location_provider IS NULL) OR (((char_length(location_provider) >= 2) AND (char_length(location_provider) <= 40)) AND (location_provider ~ '^[a-z0-9-]+$'::text)))),
    CONSTRAINT gyms_location_source_check CHECK ((location_source = ANY (ARRAY['fixture'::text, 'manual'::text, 'permanent-geocoding'::text]))),
    CONSTRAINT gyms_longitude_check CHECK (((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))),
    CONSTRAINT gyms_name_length_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 160))),
    CONSTRAINT gyms_public_location_label_length_check CHECK (((char_length(public_location_label) >= 2) AND (char_length(public_location_label) <= 240))),
    CONSTRAINT gyms_record_source_check CHECK ((record_source = ANY (ARRAY['fixture'::text, 'user'::text]))),
    CONSTRAINT gyms_slug_format_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT gyms_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text]))),
    CONSTRAINT gyms_timezone_format_check CHECK (((timezone = 'UTC'::text) OR (timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'::text)))
);

ALTER TABLE ONLY app.gyms FORCE ROW LEVEL SECURITY;


ALTER TABLE app.gyms OWNER TO app_owner;

--
-- Name: TABLE gyms; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.gyms IS 'Fictional public training locations that coaches may optionally select; gyms have no account, wallet, membership, class, booking or check-in authority.';


--
-- Name: COLUMN gyms.public_location_label; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.gyms.public_location_label IS 'Reviewed public label for discovery; it is not live location or proof that a coach is present.';


--
-- Name: COLUMN gyms.location_source; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.gyms.location_source IS 'Provider-neutral provenance for the confirmed coordinate pair.';


--
-- Name: message_block_bookings; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_block_bookings (
    block_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    until_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY app.message_block_bookings FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_block_bookings OWNER TO app_owner;

--
-- Name: message_blocks; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    low_profile_id uuid NOT NULL,
    high_profile_id uuid NOT NULL,
    blocked_by_profile_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    ended_at timestamp with time zone,
    CONSTRAINT message_blocks_check CHECK ((low_profile_id < high_profile_id)),
    CONSTRAINT message_blocks_check1 CHECK (((blocked_by_profile_id = low_profile_id) OR (blocked_by_profile_id = high_profile_id)))
);

ALTER TABLE ONLY app.message_blocks FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_blocks OWNER TO app_owner;

--
-- Name: message_consents; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_consents (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    sender_profile_id uuid NOT NULL,
    recipient_profile_id uuid NOT NULL,
    first_body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    decided_at timestamp with time zone,
    CONSTRAINT message_consents_check CHECK ((sender_profile_id <> recipient_profile_id)),
    CONSTRAINT message_consents_check1 CHECK (((status = 'pending'::text) = (decided_at IS NULL))),
    CONSTRAINT message_consents_first_body_check CHECK ((((char_length(first_body) >= 1) AND (char_length(first_body) <= 4000)) AND (octet_length(first_body) <= 16000) AND (first_body ~ '[^[:space:]]'::text))),
    CONSTRAINT message_consents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text, 'revoked'::text]))),
    CONSTRAINT message_nonblank_unicode_opening CHECK (app.mail_valid_body(first_body))
);

ALTER TABLE ONLY app.message_consents FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_consents OWNER TO app_owner;

--
-- Name: message_entries; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    seq integer NOT NULL,
    context_id uuid,
    sender_profile_id uuid,
    kind text NOT NULL,
    body text,
    submission_id uuid,
    event_key text,
    status_label text,
    created_at timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
    CONSTRAINT message_entries_body_check CHECK (((body IS NULL) OR (((char_length(body) >= 1) AND (char_length(body) <= 4000)) AND (octet_length(body) <= 16000) AND (body ~ '[^[:space:]]'::text)))),
    CONSTRAINT message_entries_check CHECK ((((kind = 'text'::text) AND (body IS NOT NULL) AND (submission_id IS NOT NULL) AND (sender_profile_id IS NOT NULL)) OR ((kind <> 'text'::text) AND (body IS NULL) AND (submission_id IS NULL) AND (event_key IS NOT NULL)))),
    CONSTRAINT message_entries_kind_check CHECK ((kind = ANY (ARRAY['text'::text, 'request'::text, 'status'::text]))),
    CONSTRAINT message_entries_seq_check CHECK ((seq > 0)),
    CONSTRAINT message_nonblank_unicode_body CHECK (((body IS NULL) OR app.mail_valid_body(body)))
);

ALTER TABLE ONLY app.message_entries FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_entries OWNER TO app_owner;

--
-- Name: message_reads; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.message_reads (
    conversation_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    last_seq integer DEFAULT 0 NOT NULL,
    CONSTRAINT message_reads_last_seq_check CHECK ((last_seq >= 0))
);

ALTER TABLE ONLY app.message_reads FORCE ROW LEVEL SECURITY;


ALTER TABLE app.message_reads OWNER TO app_owner;

--
-- Name: private_session_titles; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.private_session_titles (
    booking_id uuid NOT NULL,
    title text NOT NULL,
    revision integer NOT NULL,
    updated_by uuid NOT NULL,
    CONSTRAINT private_session_title_bounds CHECK (((title = btrim(title)) AND (char_length(title) <= 100) AND (octet_length(title) <= 400) AND (title !~ '[[:cntrl:]]'::text) AND (POSITION((chr(8232)) IN (title)) = 0) AND (POSITION((chr(8233)) IN (title)) = 0))),
    CONSTRAINT private_session_titles_revision_check CHECK ((revision > 0))
);

ALTER TABLE ONLY app.private_session_titles FORCE ROW LEVEL SECURITY;


ALTER TABLE app.private_session_titles OWNER TO app_owner;

--
-- Name: profiles; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid,
    slug text NOT NULL,
    display_name text NOT NULL,
    initials text NOT NULL,
    bio text DEFAULT ''::text NOT NULL,
    avatar_color text NOT NULL,
    record_source text NOT NULL,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    coaching_activated_at timestamp with time zone,
    avatar_storage_path text,
    avatar_updated_at timestamp with time zone,
    CONSTRAINT profiles_avatar_reference_check CHECK ((((avatar_storage_path IS NULL) AND (avatar_updated_at IS NULL)) OR ((avatar_storage_path IS NOT NULL) AND (avatar_updated_at IS NOT NULL) AND (avatar_storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'::text) AND (split_part(avatar_storage_path, '/'::text, 1) = (id)::text)))),
    CONSTRAINT profiles_claim_state_check CHECK (((auth_user_id IS NULL) = (claimed_at IS NULL))),
    CONSTRAINT profiles_display_name_length_check CHECK (((char_length(display_name) >= 2) AND (char_length(display_name) <= 80))),
    CONSTRAINT profiles_initials_length_check CHECK (((char_length(initials) >= 1) AND (char_length(initials) <= 4))),
    CONSTRAINT profiles_record_source_check CHECK ((record_source = ANY (ARRAY['fixture'::text, 'user'::text]))),
    CONSTRAINT profiles_slug_format_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);

ALTER TABLE ONLY app.profiles FORCE ROW LEVEL SECURITY;


ALTER TABLE app.profiles OWNER TO app_owner;

--
-- Name: COLUMN profiles.coaching_activated_at; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.profiles.coaching_activated_at IS 'Historical owner-declared coaching intent; current coach authority comes only from an approved coach application or explicit demo fixture status.';


--
-- Name: COLUMN profiles.avatar_storage_path; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON COLUMN app.profiles.avatar_storage_path IS 'Private canonical account-avatar object path in the account-avatars bucket.';


--
-- Name: wallet_bindings; Type: TABLE; Schema: app; Owner: app_owner
--

CREATE TABLE app.wallet_bindings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    cluster text NOT NULL,
    wallet_address text NOT NULL,
    profile_id uuid NOT NULL,
    bound_by_auth_user_id uuid NOT NULL,
    provenance text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    verified_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verified_by_challenge_id uuid,
    reauthenticated_at timestamp with time zone,
    revocation_reason text,
    replacement_binding_id uuid,
    CONSTRAINT wallet_bindings_cluster_check CHECK ((cluster = 'solana:devnet'::text)),
    CONSTRAINT wallet_bindings_proof_state_check CHECK ((((provenance = 'prepared'::text) AND (verified_by_challenge_id IS NULL)) OR ((provenance = 'user-proof'::text) AND (verified_by_challenge_id IS NOT NULL)))),
    CONSTRAINT wallet_bindings_provenance_check CHECK ((provenance = ANY (ARRAY['prepared'::text, 'user-proof'::text]))),
    CONSTRAINT wallet_bindings_revocation_reason_check CHECK (((revocation_reason IS NULL) OR (revocation_reason = ANY (ARRAY['legacy'::text, 'unlinked'::text, 'replaced'::text])))),
    CONSTRAINT wallet_bindings_revoked_state_check CHECK ((((status = 'active'::text) AND (revoked_at IS NULL) AND (revocation_reason IS NULL) AND (replacement_binding_id IS NULL)) OR ((status = 'revoked'::text) AND (revoked_at IS NOT NULL) AND (revocation_reason IS NOT NULL) AND (((revocation_reason = 'replaced'::text) AND (replacement_binding_id IS NOT NULL)) OR ((revocation_reason <> 'replaced'::text) AND (replacement_binding_id IS NULL))) AND ((revocation_reason = 'legacy'::text) OR (reauthenticated_at IS NOT NULL))))),
    CONSTRAINT wallet_bindings_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text]))),
    CONSTRAINT wallet_bindings_wallet_address_check CHECK ((((char_length(wallet_address) >= 32) AND (char_length(wallet_address) <= 44)) AND (wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'::text)))
);

ALTER TABLE ONLY app.wallet_bindings FORCE ROW LEVEL SECURITY;


ALTER TABLE app.wallet_bindings OWNER TO app_owner;

--
-- Name: TABLE wallet_bindings; Type: COMMENT; Schema: app; Owner: app_owner
--

COMMENT ON TABLE app.wallet_bindings IS 'Personal Devnet wallet ownership only; gyms have no wallet or authorization branch.';


--
-- Name: auth_challenges auth_challenges_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.auth_challenges
    ADD CONSTRAINT auth_challenges_pkey PRIMARY KEY (id);


--
-- Name: auth_challenges auth_challenges_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.auth_challenges
    ADD CONSTRAINT auth_challenges_run_id_id_key UNIQUE (run_id, id);


--
-- Name: coach_application_review_events coach_application_review_events_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_application_review_events
    ADD CONSTRAINT coach_application_review_events_pkey PRIMARY KEY (id);


--
-- Name: coach_applications coach_applications_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_applications
    ADD CONSTRAINT coach_applications_pkey PRIMARY KEY (profile_id);


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_attempts_pair_id_attempt_number_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_attempts_pair_id_attempt_number_key UNIQUE (pair_id, attempt_number);


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_attempts_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_attempts_pkey PRIMARY KEY (id);


--
-- Name: coach_athlete_connection_pairs coach_athlete_connection_pair_run_id_coach_profile_id_athle_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_pairs
    ADD CONSTRAINT coach_athlete_connection_pair_run_id_coach_profile_id_athle_key UNIQUE (run_id, coach_profile_id, athlete_profile_id);


--
-- Name: coach_athlete_connection_pairs coach_athlete_connection_pairs_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_pairs
    ADD CONSTRAINT coach_athlete_connection_pairs_pkey PRIMARY KEY (id);


--
-- Name: coach_athlete_connection_pairs coach_athlete_connection_pairs_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_pairs
    ADD CONSTRAINT coach_athlete_connection_pairs_run_id_id_key UNIQUE (run_id, id);


--
-- Name: coach_availability_rules coach_availability_rules_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_rules
    ADD CONSTRAINT coach_availability_rules_pkey PRIMARY KEY (id);


--
-- Name: coach_availability_rules coach_availability_rules_run_profile_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_rules
    ADD CONSTRAINT coach_availability_rules_run_profile_id_key UNIQUE (run_id, profile_id, id);


--
-- Name: coach_availability_slots coach_availability_slots_active_time_excl; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_slots
    ADD CONSTRAINT coach_availability_slots_active_time_excl EXCLUDE USING gist (run_id WITH =, profile_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['open'::text, 'held'::text, 'booked'::text])));


--
-- Name: coach_availability_slots coach_availability_slots_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_slots
    ADD CONSTRAINT coach_availability_slots_pkey PRIMARY KEY (id);


--
-- Name: coach_availability_slots coach_availability_slots_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_slots
    ADD CONSTRAINT coach_availability_slots_run_id_id_key UNIQUE (run_id, id);


--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_booking_kind_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_credit_operations
    ADD CONSTRAINT coach_booking_credit_operations_booking_kind_key UNIQUE (booking_id, kind);


--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_credit_operations
    ADD CONSTRAINT coach_booking_credit_operations_pkey PRIMARY KEY (id);


--
-- Name: coach_booking_requests coach_booking_requests_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_pkey PRIMARY KEY (id);


--
-- Name: coach_client_credit_projections coach_client_credit_projections_ledger_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_client_credit_projections
    ADD CONSTRAINT coach_client_credit_projections_ledger_key UNIQUE (program_address, coach_client_credits_address);


--
-- Name: coach_client_credit_projections coach_client_credit_projections_pair_wallet_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_client_credit_projections
    ADD CONSTRAINT coach_client_credit_projections_pair_wallet_key UNIQUE (run_id, coach_profile_id, client_wallet_address);


--
-- Name: coach_client_credit_projections coach_client_credit_projections_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_client_credit_projections
    ADD CONSTRAINT coach_client_credit_projections_pkey PRIMARY KEY (id);


--
-- Name: coach_client_credit_projections coach_client_credit_projections_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_client_credit_projections
    ADD CONSTRAINT coach_client_credit_projections_run_id_id_key UNIQUE (run_id, id);


--
-- Name: coach_follows coach_follows_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_follows
    ADD CONSTRAINT coach_follows_pkey PRIMARY KEY (run_id, follower_profile_id, coach_profile_id);


--
-- Name: coach_group_registrations coach_group_registrations_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_registrations
    ADD CONSTRAINT coach_group_registrations_pkey PRIMARY KEY (id);


--
-- Name: coach_group_sessions coach_group_sessions_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_sessions
    ADD CONSTRAINT coach_group_sessions_pkey PRIMARY KEY (id);


--
-- Name: coach_group_sessions coach_group_sessions_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_sessions
    ADD CONSTRAINT coach_group_sessions_run_id_id_key UNIQUE (run_id, id);


--
-- Name: coach_group_sessions coach_group_sessions_slug_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_sessions
    ADD CONSTRAINT coach_group_sessions_slug_key UNIQUE (slug);


--
-- Name: coach_pass_purchase_operations coach_pass_purchase_operations_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_pass_purchase_operations
    ADD CONSTRAINT coach_pass_purchase_operations_pkey PRIMARY KEY (id);


--
-- Name: coach_posts coach_posts_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_posts
    ADD CONSTRAINT coach_posts_pkey PRIMARY KEY (run_id, id);


--
-- Name: coach_private_bookings coach_private_bookings_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_pkey PRIMARY KEY (id);


--
-- Name: coach_private_bookings coach_private_bookings_request_link_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_request_link_key UNIQUE (run_id, id, slot_id, coach_profile_id, client_profile_id);


--
-- Name: coach_profile_disciplines coach_profile_disciplines_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profile_disciplines
    ADD CONSTRAINT coach_profile_disciplines_pkey PRIMARY KEY (run_id, profile_id, discipline);


--
-- Name: coach_profile_disciplines coach_profile_disciplines_sort_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profile_disciplines
    ADD CONSTRAINT coach_profile_disciplines_sort_key UNIQUE (run_id, profile_id, sort_order);


--
-- Name: coach_profiles coach_profiles_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profiles
    ADD CONSTRAINT coach_profiles_pkey PRIMARY KEY (run_id, profile_id);


--
-- Name: coach_profiles coach_profiles_run_slug_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profiles
    ADD CONSTRAINT coach_profiles_run_slug_key UNIQUE (run_id, public_slug);


--
-- Name: coach_training_locations coach_training_locations_owner_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_training_locations
    ADD CONSTRAINT coach_training_locations_owner_id_key UNIQUE (run_id, profile_id, id);


--
-- Name: coach_training_locations coach_training_locations_owner_order_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_training_locations
    ADD CONSTRAINT coach_training_locations_owner_order_key UNIQUE (run_id, profile_id, sort_order);


--
-- Name: coach_training_locations coach_training_locations_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_training_locations
    ADD CONSTRAINT coach_training_locations_pkey PRIMARY KEY (id);


--
-- Name: demo_run_participants demo_run_participants_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.demo_run_participants
    ADD CONSTRAINT demo_run_participants_pkey PRIMARY KEY (run_id, profile_id);


--
-- Name: demo_runs demo_runs_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.demo_runs
    ADD CONSTRAINT demo_runs_pkey PRIMARY KEY (id);


--
-- Name: demo_runs demo_runs_slug_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.demo_runs
    ADD CONSTRAINT demo_runs_slug_key UNIQUE (slug);


--
-- Name: group_event_chain_operations group_event_chain_operations_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_chain_operations
    ADD CONSTRAINT group_event_chain_operations_pkey PRIMARY KEY (id);


--
-- Name: group_event_contribution_projections group_event_contribution_projections_address_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_contribution_projections
    ADD CONSTRAINT group_event_contribution_projections_address_key UNIQUE (program_address, contribution_address);


--
-- Name: group_event_contribution_projections group_event_contribution_projections_event_wallet_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_contribution_projections
    ADD CONSTRAINT group_event_contribution_projections_event_wallet_key UNIQUE (event_id, participant_wallet_address);


--
-- Name: group_event_contribution_projections group_event_contribution_projections_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_contribution_projections
    ADD CONSTRAINT group_event_contribution_projections_pkey PRIMARY KEY (id);


--
-- Name: group_event_pool_projections group_event_pool_projections_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_pool_projections
    ADD CONSTRAINT group_event_pool_projections_pkey PRIMARY KEY (event_id);


--
-- Name: group_event_pool_projections group_event_pool_projections_pool_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_pool_projections
    ADD CONSTRAINT group_event_pool_projections_pool_key UNIQUE (program_address, event_pool_address);


--
-- Name: group_events group_events_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_events
    ADD CONSTRAINT group_events_pkey PRIMARY KEY (id);


--
-- Name: group_events group_events_pool_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_events
    ADD CONSTRAINT group_events_pool_key UNIQUE (program_address, event_pool_address);


--
-- Name: group_events group_events_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_events
    ADD CONSTRAINT group_events_run_id_id_key UNIQUE (run_id, id);


--
-- Name: group_events group_events_run_slug_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_events
    ADD CONSTRAINT group_events_run_slug_key UNIQUE (run_id, public_slug);


--
-- Name: gyms gyms_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.gyms
    ADD CONSTRAINT gyms_pkey PRIMARY KEY (id);


--
-- Name: gyms gyms_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.gyms
    ADD CONSTRAINT gyms_run_id_id_key UNIQUE (run_id, id);


--
-- Name: gyms gyms_run_id_slug_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.gyms
    ADD CONSTRAINT gyms_run_id_slug_key UNIQUE (run_id, slug);


--
-- Name: message_block_bookings message_block_bookings_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_block_bookings
    ADD CONSTRAINT message_block_bookings_pkey PRIMARY KEY (block_id, booking_id);


--
-- Name: message_blocks message_blocks_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_blocks
    ADD CONSTRAINT message_blocks_pkey PRIMARY KEY (id);


--
-- Name: message_consents message_consents_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_consents
    ADD CONSTRAINT message_consents_pkey PRIMARY KEY (id);


--
-- Name: message_contexts message_contexts_conversation_id_kind_source_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_contexts
    ADD CONSTRAINT message_contexts_conversation_id_kind_source_id_key UNIQUE NULLS NOT DISTINCT (conversation_id, kind, source_id);


--
-- Name: message_contexts message_contexts_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_contexts
    ADD CONSTRAINT message_contexts_pkey PRIMARY KEY (id);


--
-- Name: message_conversations message_conversations_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_conversations
    ADD CONSTRAINT message_conversations_pkey PRIMARY KEY (id);


--
-- Name: message_conversations message_conversations_run_id_coach_profile_id_athlete_profi_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_conversations
    ADD CONSTRAINT message_conversations_run_id_coach_profile_id_athlete_profi_key UNIQUE (run_id, coach_profile_id, athlete_profile_id);


--
-- Name: message_conversations message_conversations_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_conversations
    ADD CONSTRAINT message_conversations_run_id_id_key UNIQUE (run_id, id);


--
-- Name: message_entries message_entries_conversation_id_sender_profile_id_submissio_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_conversation_id_sender_profile_id_submissio_key UNIQUE (conversation_id, sender_profile_id, submission_id);


--
-- Name: message_entries message_entries_conversation_id_seq_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_conversation_id_seq_key UNIQUE (conversation_id, seq);


--
-- Name: message_entries message_entries_event_key_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_event_key_key UNIQUE (event_key);


--
-- Name: message_entries message_entries_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_pkey PRIMARY KEY (id);


--
-- Name: message_reads message_reads_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_reads
    ADD CONSTRAINT message_reads_pkey PRIMARY KEY (conversation_id, profile_id);


--
-- Name: private_session_titles private_session_titles_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.private_session_titles
    ADD CONSTRAINT private_session_titles_pkey PRIMARY KEY (booking_id);


--
-- Name: profiles profiles_auth_user_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.profiles
    ADD CONSTRAINT profiles_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_slug_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.profiles
    ADD CONSTRAINT profiles_slug_key UNIQUE (slug);


--
-- Name: wallet_bindings wallet_bindings_pkey; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_pkey PRIMARY KEY (id);


--
-- Name: wallet_bindings wallet_bindings_run_id_id_key; Type: CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_run_id_id_key UNIQUE (run_id, id);


--
-- Name: auth_challenges_actor_expiry_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX auth_challenges_actor_expiry_idx ON app.auth_challenges USING btree (auth_user_id, run_id, purpose, expires_at DESC);


--
-- Name: auth_challenges_unconsumed_expiry_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX auth_challenges_unconsumed_expiry_idx ON app.auth_challenges USING btree (expires_at) WHERE (consumed_at IS NULL);


--
-- Name: coach_application_review_events_decision_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_application_review_events_decision_key ON app.coach_application_review_events USING btree (profile_id, application_revision, previous_status, decision);


--
-- Name: coach_application_review_events_profile_created_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_application_review_events_profile_created_idx ON app.coach_application_review_events USING btree (profile_id, created_at, id);


--
-- Name: coach_applications_status_submitted_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_applications_status_submitted_idx ON app.coach_applications USING btree (status, submitted_at, profile_id);


--
-- Name: coach_athlete_connection_attempts_page; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_athlete_connection_attempts_page ON app.coach_athlete_connection_attempts USING btree (run_id, created_at DESC, id DESC);


--
-- Name: coach_athlete_connection_pairs_athlete; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_athlete_connection_pairs_athlete ON app.coach_athlete_connection_pairs USING btree (run_id, athlete_profile_id);


--
-- Name: coach_athlete_connection_pairs_coach; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_athlete_connection_pairs_coach ON app.coach_athlete_connection_pairs USING btree (run_id, coach_profile_id);


--
-- Name: coach_athlete_connections_one_active_pair; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_athlete_connections_one_active_pair ON app.coach_athlete_connection_attempts USING btree (pair_id) WHERE (status = ANY (ARRAY['pending'::text, 'accepted'::text]));


--
-- Name: coach_availability_rules_active_time_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_availability_rules_active_time_key ON app.coach_availability_rules USING btree (run_id, profile_id, iso_weekday, local_start_time) WHERE (status = 'active'::text);


--
-- Name: coach_availability_rules_location_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_rules_location_lookup_idx ON app.coach_availability_rules USING btree (run_id, profile_id, coach_training_location_id, status, iso_weekday, local_start_time, id);


--
-- Name: coach_availability_rules_owner_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_rules_owner_lookup_idx ON app.coach_availability_rules USING btree (run_id, profile_id, status, iso_weekday, local_start_time, id);


--
-- Name: coach_availability_slots_owner_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_slots_owner_lookup_idx ON app.coach_availability_slots USING btree (run_id, profile_id, status, starts_at, id);


--
-- Name: coach_availability_slots_public_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_slots_public_lookup_idx ON app.coach_availability_slots USING btree (run_id, profile_id, starts_at, id) WHERE (status = 'open'::text);


--
-- Name: coach_availability_slots_rule_occurrence_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_availability_slots_rule_occurrence_key ON app.coach_availability_slots USING btree (recurrence_rule_id, recurrence_local_date) WHERE (recurrence_rule_id IS NOT NULL);


--
-- Name: coach_availability_slots_rule_status_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_slots_rule_status_idx ON app.coach_availability_slots USING btree (recurrence_rule_id, status, starts_at, id) WHERE (recurrence_rule_id IS NOT NULL);


--
-- Name: coach_availability_slots_training_location_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_slots_training_location_idx ON app.coach_availability_slots USING btree (run_id, profile_id, coach_training_location_id, status, starts_at, id) WHERE (coach_training_location_id IS NOT NULL);


--
-- Name: coach_availability_withdrawn_time; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_availability_withdrawn_time ON app.coach_availability_slots USING btree (run_id, profile_id, starts_at, ends_at) WHERE (status = 'withdrawn'::text);


--
-- Name: coach_booking_credit_operations_signature_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_booking_credit_operations_signature_key ON app.coach_booking_credit_operations USING btree (transaction_signature) WHERE (transaction_signature IS NOT NULL);


--
-- Name: coach_booking_credit_operations_status_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_booking_credit_operations_status_idx ON app.coach_booking_credit_operations USING btree (status, created_at, id);


--
-- Name: coach_booking_credit_operations_terminal_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_booking_credit_operations_terminal_key ON app.coach_booking_credit_operations USING btree (booking_id) WHERE (kind = ANY (ARRAY['return'::text, 'consume'::text]));


--
-- Name: coach_booking_requests_accepted_slot_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_booking_requests_accepted_slot_key ON app.coach_booking_requests USING btree (run_id, slot_id) WHERE (status = 'accepted'::text);


--
-- Name: coach_booking_requests_active_client_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_booking_requests_active_client_key ON app.coach_booking_requests USING btree (run_id, slot_id, client_profile_id) WHERE (status = 'pending'::text);


--
-- Name: coach_booking_requests_booking_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_booking_requests_booking_key ON app.coach_booking_requests USING btree (accepted_booking_id) WHERE (accepted_booking_id IS NOT NULL);


--
-- Name: coach_booking_requests_client_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_booking_requests_client_idx ON app.coach_booking_requests USING btree (run_id, client_profile_id, created_at DESC, id DESC);


--
-- Name: coach_booking_requests_coach_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_booking_requests_coach_idx ON app.coach_booking_requests USING btree (run_id, coach_profile_id, created_at DESC, id DESC);


--
-- Name: coach_booking_requests_pending_deadline_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_booking_requests_pending_deadline_idx ON app.coach_booking_requests USING btree (run_id, decision_deadline_at, id) WHERE (status = 'pending'::text);


--
-- Name: coach_client_credit_projections_client_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_client_credit_projections_client_idx ON app.coach_client_credit_projections USING btree (run_id, client_profile_id, coach_profile_id);


--
-- Name: coach_client_credit_projections_coach_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_client_credit_projections_coach_idx ON app.coach_client_credit_projections USING btree (run_id, coach_profile_id, client_profile_id);


--
-- Name: coach_follows_coach_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_follows_coach_lookup_idx ON app.coach_follows USING btree (run_id, coach_profile_id, follower_profile_id);


--
-- Name: coach_follows_following_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_follows_following_lookup_idx ON app.coach_follows USING btree (run_id, follower_profile_id, coach_profile_id);


--
-- Name: coach_group_athlete_page; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_group_athlete_page ON app.coach_group_registrations USING btree (run_id, athlete_profile_id, created_at DESC, id DESC);


--
-- Name: coach_group_one_active_registration; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_group_one_active_registration ON app.coach_group_registrations USING btree (session_id, athlete_profile_id) WHERE (status = 'active'::text);


--
-- Name: coach_group_owner_page; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_group_owner_page ON app.coach_group_sessions USING btree (run_id, coach_profile_id, created_at DESC, id DESC);


--
-- Name: coach_group_public_upcoming; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_group_public_upcoming ON app.coach_group_sessions USING btree (run_id, starts_at, id) WHERE (status = ANY (ARRAY['open'::text, 'confirmed'::text]));


--
-- Name: coach_group_reserved_time; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_group_reserved_time ON app.coach_group_sessions USING btree (run_id, coach_profile_id, starts_at, ends_at) WHERE (status = ANY (ARRAY['open'::text, 'confirmed'::text]));


--
-- Name: coach_group_roster; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_group_roster ON app.coach_group_registrations USING btree (session_id, created_at, id);


--
-- Name: coach_pass_purchase_operations_actor_status_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_pass_purchase_operations_actor_status_idx ON app.coach_pass_purchase_operations USING btree (run_id, client_profile_id, status, created_at);


--
-- Name: coach_pass_purchase_operations_attempt_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_pass_purchase_operations_attempt_key ON app.coach_pass_purchase_operations USING btree (run_id, client_profile_id, coach_profile_id, offer_address, expected_purchase_nonce, recent_blockhash);


--
-- Name: coach_pass_purchase_operations_signature_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_pass_purchase_operations_signature_key ON app.coach_pass_purchase_operations USING btree (transaction_signature) WHERE (transaction_signature IS NOT NULL);


--
-- Name: coach_posts_coach_feed_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_posts_coach_feed_idx ON app.coach_posts USING btree (run_id, coach_profile_id, visibility, published_at DESC, id DESC);


--
-- Name: coach_posts_public_feed_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_posts_public_feed_idx ON app.coach_posts USING btree (published_at DESC, id DESC) WHERE (visibility = 'visible'::text);


--
-- Name: coach_private_bookings_active_slot_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_private_bookings_active_slot_key ON app.coach_private_bookings USING btree (slot_id) WHERE (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancellation-requested'::text, 'denied'::text]));


--
-- Name: coach_private_bookings_client_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_private_bookings_client_idx ON app.coach_private_bookings USING btree (run_id, client_profile_id, scheduled_start_at, id);


--
-- Name: coach_private_bookings_coach_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_private_bookings_coach_idx ON app.coach_private_bookings USING btree (run_id, coach_profile_id, scheduled_start_at, id);


--
-- Name: coach_private_bookings_projection_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_private_bookings_projection_idx ON app.coach_private_bookings USING btree (credit_projection_id, status, hold_expires_at);


--
-- Name: coach_profile_disciplines_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_profile_disciplines_lookup_idx ON app.coach_profile_disciplines USING btree (run_id, discipline, profile_id);


--
-- Name: coach_profiles_location_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_profiles_location_idx ON app.coach_profiles USING btree (latitude, longitude) WHERE (visibility = 'visible'::text);


--
-- Name: coach_profiles_run_gym_visibility_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_profiles_run_gym_visibility_idx ON app.coach_profiles USING btree (run_id, selected_gym_id, visibility);


--
-- Name: coach_profiles_run_visibility_name_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_profiles_run_visibility_name_idx ON app.coach_profiles USING btree (run_id, visibility, display_name, profile_id);


--
-- Name: coach_training_locations_active_gym_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_training_locations_active_gym_key ON app.coach_training_locations USING btree (run_id, profile_id, selected_gym_id) WHERE ((status = 'active'::text) AND (selected_gym_id IS NOT NULL));


--
-- Name: coach_training_locations_active_primary_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX coach_training_locations_active_primary_key ON app.coach_training_locations USING btree (run_id, profile_id) WHERE ((status = 'active'::text) AND is_primary);


--
-- Name: coach_training_locations_owner_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_training_locations_owner_lookup_idx ON app.coach_training_locations USING btree (run_id, profile_id, status, sort_order, id);


--
-- Name: coach_training_locations_public_lookup_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX coach_training_locations_public_lookup_idx ON app.coach_training_locations USING btree (run_id, status, is_primary, profile_id) WHERE (status = 'active'::text);


--
-- Name: demo_run_participants_profile_status_run_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX demo_run_participants_profile_status_run_idx ON app.demo_run_participants USING btree (profile_id, status, run_id);


--
-- Name: demo_runs_one_active_public_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX demo_runs_one_active_public_idx ON app.demo_runs USING btree (status, catalogue_visibility) WHERE ((status = 'active'::text) AND (catalogue_visibility = 'public'::text));


--
-- Name: demo_runs_status_visibility_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX demo_runs_status_visibility_idx ON app.demo_runs USING btree (status, catalogue_visibility);


--
-- Name: group_event_chain_operations_active_actor_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX group_event_chain_operations_active_actor_key ON app.group_event_chain_operations USING btree (run_id, event_id, actor_profile_id, operation_kind) WHERE (status = ANY (ARRAY['prepared'::text, 'submitted'::text]));


--
-- Name: group_event_chain_operations_actor_status_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX group_event_chain_operations_actor_status_idx ON app.group_event_chain_operations USING btree (run_id, actor_profile_id, status, created_at DESC);


--
-- Name: group_event_chain_operations_signature_key; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX group_event_chain_operations_signature_key ON app.group_event_chain_operations USING btree (transaction_signature) WHERE (transaction_signature IS NOT NULL);


--
-- Name: group_event_contribution_projections_participant_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX group_event_contribution_projections_participant_idx ON app.group_event_contribution_projections USING btree (run_id, participant_profile_id, finalized_at DESC, id);


--
-- Name: group_event_pool_projections_lifecycle_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX group_event_pool_projections_lifecycle_idx ON app.group_event_pool_projections USING btree (lifecycle_status, funding_deadline, event_id);


--
-- Name: group_events_owner_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX group_events_owner_idx ON app.group_events USING btree (run_id, coach_profile_id, created_at DESC, id);


--
-- Name: group_events_pool_availability_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX group_events_pool_availability_idx ON app.group_events USING btree (projection_availability, projection_status_updated_at, id) WHERE (event_pool_address IS NOT NULL);


--
-- Name: group_events_public_catalogue_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX group_events_public_catalogue_idx ON app.group_events USING btree (publication_status, starts_at, id);


--
-- Name: gyms_run_city_area_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX gyms_run_city_area_idx ON app.gyms USING btree (run_id, city, area);


--
-- Name: gyms_run_status_name_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX gyms_run_status_name_idx ON app.gyms USING btree (run_id, status, name);


--
-- Name: message_consent_sender; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX message_consent_sender ON app.message_consents USING btree (sender_profile_id, created_at);


--
-- Name: message_context_source; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX message_context_source ON app.message_contexts USING btree (kind, source_id);


--
-- Name: message_inbox; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX message_inbox ON app.message_conversations USING btree (run_id, activity_at DESC, id DESC);


--
-- Name: message_one_active_block; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX message_one_active_block ON app.message_blocks USING btree (run_id, low_profile_id, high_profile_id, blocked_by_profile_id) WHERE (ended_at IS NULL);


--
-- Name: message_one_pending_consent; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX message_one_pending_consent ON app.message_consents USING btree (conversation_id) WHERE (status = 'pending'::text);


--
-- Name: message_text_rate; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX message_text_rate ON app.message_entries USING btree (sender_profile_id, created_at) WHERE (kind = 'text'::text);


--
-- Name: wallet_bindings_active_auth_user_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX wallet_bindings_active_auth_user_idx ON app.wallet_bindings USING btree (run_id, bound_by_auth_user_id) WHERE (status = 'active'::text);


--
-- Name: wallet_bindings_active_profile_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX wallet_bindings_active_profile_idx ON app.wallet_bindings USING btree (run_id, profile_id) WHERE (status = 'active'::text);


--
-- Name: wallet_bindings_active_wallet_owner_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE UNIQUE INDEX wallet_bindings_active_wallet_owner_idx ON app.wallet_bindings USING btree (run_id, cluster, wallet_address) WHERE (status = 'active'::text);


--
-- Name: wallet_bindings_auth_user_status_run_idx; Type: INDEX; Schema: app; Owner: app_owner
--

CREATE INDEX wallet_bindings_auth_user_status_run_idx ON app.wallet_bindings USING btree (bound_by_auth_user_id, status, run_id);


--
-- Name: coach_applications aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_applications FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_availability_rules aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_availability_rules FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_availability_slots aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_availability_slots FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_booking_requests aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_booking_requests FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_private_bookings aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_private_bookings FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_profile_disciplines aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_profile_disciplines FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_profiles aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_profiles FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: coach_training_locations aaa_group_schedule_write; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER aaa_group_schedule_write BEFORE INSERT OR DELETE OR UPDATE ON app.coach_training_locations FOR EACH ROW EXECUTE FUNCTION app.guard_coach_schedule_write();


--
-- Name: auth_challenges auth_challenges_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER auth_challenges_set_updated_at BEFORE UPDATE ON app.auth_challenges FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_applications coach_applications_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_applications_set_updated_at BEFORE UPDATE ON app.coach_applications FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_attempts_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_athlete_connection_attempts_updated_at BEFORE UPDATE ON app.coach_athlete_connection_attempts FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_availability_rules coach_availability_rules_require_active_location; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_availability_rules_require_active_location BEFORE INSERT OR UPDATE OF run_id, profile_id, coach_training_location_id, coach_timezone, status ON app.coach_availability_rules FOR EACH ROW EXECUTE FUNCTION app.require_active_coach_availability_rule_location();


--
-- Name: coach_availability_rules coach_availability_rules_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_availability_rules_set_updated_at BEFORE UPDATE ON app.coach_availability_rules FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_availability_slots coach_availability_slots_close_booking_requests; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_availability_slots_close_booking_requests AFTER UPDATE OF status ON app.coach_availability_slots FOR EACH ROW EXECUTE FUNCTION app.close_pending_requests_for_withdrawn_occurrence();


--
-- Name: coach_availability_slots coach_availability_slots_protect_recurring; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_availability_slots_protect_recurring BEFORE UPDATE ON app.coach_availability_slots FOR EACH ROW EXECUTE FUNCTION app.protect_recurring_coach_availability_occurrence();


--
-- Name: coach_availability_slots coach_availability_slots_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_availability_slots_set_updated_at BEFORE UPDATE ON app.coach_availability_slots FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_booking_credit_operations_set_updated_at BEFORE UPDATE ON app.coach_booking_credit_operations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_booking_requests coach_booking_requests_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_booking_requests_set_updated_at BEFORE UPDATE ON app.coach_booking_requests FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_client_credit_projections coach_client_credit_projections_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_client_credit_projections_set_updated_at BEFORE UPDATE ON app.coach_client_credit_projections FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_pass_purchase_operations coach_pass_purchase_operations_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_pass_purchase_operations_set_updated_at BEFORE UPDATE ON app.coach_pass_purchase_operations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_posts coach_posts_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_posts_set_updated_at BEFORE UPDATE ON app.coach_posts FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_private_bookings coach_private_bookings_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_private_bookings_set_updated_at BEFORE UPDATE ON app.coach_private_bookings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_profiles coach_profiles_close_booking_requests; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_profiles_close_booking_requests AFTER UPDATE OF visibility ON app.coach_profiles FOR EACH ROW EXECUTE FUNCTION app.close_pending_requests_for_hidden_coach();


--
-- Name: coach_profiles coach_profiles_require_application; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_profiles_require_application AFTER INSERT OR UPDATE ON app.coach_profiles FOR EACH ROW EXECUTE FUNCTION app.require_coach_application_access();


--
-- Name: coach_profiles coach_profiles_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_profiles_set_updated_at BEFORE UPDATE ON app.coach_profiles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_profiles coach_profiles_sync_primary_training_location; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_profiles_sync_primary_training_location AFTER INSERT OR UPDATE OF timezone, selected_gym_id, location_kind, public_location_label, latitude, longitude, location_source, location_provider, location_confirmed_at ON app.coach_profiles FOR EACH ROW EXECUTE FUNCTION app.sync_primary_training_location_from_profile();


--
-- Name: coach_profiles coach_profiles_sync_training_schedule_timezone; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_profiles_sync_training_schedule_timezone AFTER UPDATE OF timezone ON app.coach_profiles FOR EACH ROW EXECUTE FUNCTION app.sync_coach_availability_timezone_from_profile();


--
-- Name: coach_profiles coach_profiles_validate_primary_training_location; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE CONSTRAINT TRIGGER coach_profiles_validate_primary_training_location AFTER INSERT OR UPDATE OF visibility ON app.coach_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.assert_visible_coach_primary_location();


--
-- Name: coach_training_locations coach_training_locations_require_coach_timezone; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_training_locations_require_coach_timezone BEFORE INSERT OR UPDATE OF run_id, profile_id, timezone ON app.coach_training_locations FOR EACH ROW EXECUTE FUNCTION app.require_coach_training_location_timezone();


--
-- Name: coach_training_locations coach_training_locations_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER coach_training_locations_set_updated_at BEFORE UPDATE ON app.coach_training_locations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_training_locations coach_training_locations_validate_visible_coach; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE CONSTRAINT TRIGGER coach_training_locations_validate_visible_coach AFTER INSERT OR DELETE OR UPDATE ON app.coach_training_locations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.assert_visible_coach_primary_location();


--
-- Name: demo_run_participants demo_run_participants_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER demo_run_participants_set_updated_at BEFORE UPDATE ON app.demo_run_participants FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: demo_runs demo_runs_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER demo_runs_set_updated_at BEFORE UPDATE ON app.demo_runs FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: group_event_chain_operations group_event_chain_operations_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER group_event_chain_operations_set_updated_at BEFORE UPDATE ON app.group_event_chain_operations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: group_event_contribution_projections group_event_contribution_projections_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER group_event_contribution_projections_set_updated_at BEFORE UPDATE ON app.group_event_contribution_projections FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: group_event_pool_projections group_event_pool_projections_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER group_event_pool_projections_set_updated_at BEFORE UPDATE ON app.group_event_pool_projections FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: group_events group_events_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER group_events_set_updated_at BEFORE UPDATE ON app.group_events FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_athlete_connection_attempts guard_connection_attempt; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER guard_connection_attempt BEFORE INSERT OR DELETE OR UPDATE ON app.coach_athlete_connection_attempts FOR EACH ROW EXECUTE FUNCTION app.guard_connection_attempt();


--
-- Name: coach_athlete_connection_pairs guard_connection_pair; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER guard_connection_pair BEFORE DELETE OR UPDATE ON app.coach_athlete_connection_pairs FOR EACH ROW EXECUTE FUNCTION app.guard_connection_pair();


--
-- Name: coach_group_registrations guard_group_registration; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER guard_group_registration BEFORE INSERT OR DELETE OR UPDATE ON app.coach_group_registrations FOR EACH ROW EXECUTE FUNCTION app.guard_group_registration();


--
-- Name: coach_group_sessions guard_group_session; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER guard_group_session BEFORE INSERT OR DELETE OR UPDATE ON app.coach_group_sessions FOR EACH ROW EXECUTE FUNCTION app.guard_group_session();


--
-- Name: gyms gyms_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER gyms_set_updated_at BEFORE UPDATE ON app.gyms FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: coach_private_bookings mail_booking_activity; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER mail_booking_activity AFTER UPDATE ON app.coach_private_bookings FOR EACH ROW EXECUTE FUNCTION app.mail_booking_activity();


--
-- Name: coach_private_bookings mail_booking_guard; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER mail_booking_guard BEFORE INSERT OR UPDATE ON app.coach_private_bookings FOR EACH ROW EXECUTE FUNCTION app.mail_booking_guard();


--
-- Name: coach_athlete_connection_attempts mail_connection_guard; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER mail_connection_guard BEFORE INSERT OR UPDATE ON app.coach_athlete_connection_attempts FOR EACH ROW EXECUTE FUNCTION app.mail_connection_guard();


--
-- Name: message_entries mail_guard_consent_submission; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER mail_guard_consent_submission BEFORE INSERT ON app.message_entries FOR EACH ROW EXECUTE FUNCTION app.mail_guard_consent_submission();


--
-- Name: coach_booking_requests mail_request_activity; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER mail_request_activity AFTER INSERT OR UPDATE ON app.coach_booking_requests FOR EACH ROW EXECUTE FUNCTION app.mail_request_activity();


--
-- Name: coach_booking_requests mail_request_guard; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER mail_request_guard BEFORE INSERT OR UPDATE ON app.coach_booking_requests FOR EACH ROW EXECUTE FUNCTION app.mail_request_guard();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON app.profiles FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: wallet_bindings wallet_bindings_set_updated_at; Type: TRIGGER; Schema: app; Owner: app_owner
--

CREATE TRIGGER wallet_bindings_set_updated_at BEFORE UPDATE ON app.wallet_bindings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();


--
-- Name: auth_challenges auth_challenges_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.auth_challenges
    ADD CONSTRAINT auth_challenges_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: auth_challenges auth_challenges_personal_target_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.auth_challenges
    ADD CONSTRAINT auth_challenges_personal_target_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: auth_challenges auth_challenges_run_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.auth_challenges
    ADD CONSTRAINT auth_challenges_run_id_fkey FOREIGN KEY (run_id) REFERENCES app.demo_runs(id) ON DELETE RESTRICT;


--
-- Name: coach_application_review_events coach_application_review_events_application_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_application_review_events
    ADD CONSTRAINT coach_application_review_events_application_fkey FOREIGN KEY (profile_id) REFERENCES app.coach_applications(profile_id) ON DELETE RESTRICT;


--
-- Name: coach_applications coach_applications_profile_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_applications
    ADD CONSTRAINT coach_applications_profile_fkey FOREIGN KEY (profile_id) REFERENCES app.profiles(id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_atte_run_id_decided_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_atte_run_id_decided_by_profile_id_fkey FOREIGN KEY (run_id, decided_by_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_atte_run_id_removed_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_atte_run_id_removed_by_profile_id_fkey FOREIGN KEY (run_id, removed_by_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_attem_run_id_recipient_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_attem_run_id_recipient_profile_id_fkey FOREIGN KEY (run_id, recipient_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_attempts_run_id_pair_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_attempts_run_id_pair_id_fkey FOREIGN KEY (run_id, pair_id) REFERENCES app.coach_athlete_connection_pairs(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_attempts coach_athlete_connection_attempts_run_id_sender_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_attempts
    ADD CONSTRAINT coach_athlete_connection_attempts_run_id_sender_profile_id_fkey FOREIGN KEY (run_id, sender_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_pairs coach_athlete_connection_pairs_run_id_athlete_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_pairs
    ADD CONSTRAINT coach_athlete_connection_pairs_run_id_athlete_profile_id_fkey FOREIGN KEY (run_id, athlete_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_athlete_connection_pairs coach_athlete_connection_pairs_run_id_coach_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_athlete_connection_pairs
    ADD CONSTRAINT coach_athlete_connection_pairs_run_id_coach_profile_id_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_availability_rules coach_availability_rules_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_rules
    ADD CONSTRAINT coach_availability_rules_coach_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_availability_rules coach_availability_rules_location_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_rules
    ADD CONSTRAINT coach_availability_rules_location_fkey FOREIGN KEY (run_id, profile_id, coach_training_location_id) REFERENCES app.coach_training_locations(run_id, profile_id, id) ON DELETE RESTRICT;


--
-- Name: coach_availability_slots coach_availability_slots_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_slots
    ADD CONSTRAINT coach_availability_slots_coach_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_availability_slots coach_availability_slots_rule_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_slots
    ADD CONSTRAINT coach_availability_slots_rule_fkey FOREIGN KEY (run_id, profile_id, recurrence_rule_id) REFERENCES app.coach_availability_rules(run_id, profile_id, id) ON DELETE RESTRICT;


--
-- Name: coach_availability_slots coach_availability_slots_training_location_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_availability_slots
    ADD CONSTRAINT coach_availability_slots_training_location_fkey FOREIGN KEY (run_id, profile_id, coach_training_location_id) REFERENCES app.coach_training_locations(run_id, profile_id, id) ON DELETE RESTRICT;


--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_booking_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_credit_operations
    ADD CONSTRAINT coach_booking_credit_operations_booking_fkey FOREIGN KEY (booking_id) REFERENCES app.coach_private_bookings(id) ON DELETE RESTRICT;


--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_projection_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_credit_operations
    ADD CONSTRAINT coach_booking_credit_operations_projection_fkey FOREIGN KEY (run_id, credit_projection_id) REFERENCES app.coach_client_credit_projections(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_booking_requests coach_booking_requests_booking_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_booking_fkey FOREIGN KEY (run_id, accepted_booking_id, slot_id, coach_profile_id, client_profile_id) REFERENCES app.coach_private_bookings(run_id, id, slot_id, coach_profile_id, client_profile_id) ON DELETE RESTRICT;


--
-- Name: coach_booking_requests coach_booking_requests_client_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_client_fkey FOREIGN KEY (run_id, client_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_booking_requests coach_booking_requests_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_booking_requests coach_booking_requests_decider_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_decider_fkey FOREIGN KEY (run_id, decided_by_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_booking_requests coach_booking_requests_slot_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_slot_fkey FOREIGN KEY (run_id, slot_id) REFERENCES app.coach_availability_slots(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_booking_requests coach_booking_requests_training_location_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_booking_requests
    ADD CONSTRAINT coach_booking_requests_training_location_fkey FOREIGN KEY (run_id, coach_profile_id, coach_training_location_id) REFERENCES app.coach_training_locations(run_id, profile_id, id) ON DELETE RESTRICT;


--
-- Name: coach_client_credit_projections coach_client_credit_projections_client_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_client_credit_projections
    ADD CONSTRAINT coach_client_credit_projections_client_fkey FOREIGN KEY (run_id, client_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_client_credit_projections coach_client_credit_projections_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_client_credit_projections
    ADD CONSTRAINT coach_client_credit_projections_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_follows coach_follows_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_follows
    ADD CONSTRAINT coach_follows_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_follows coach_follows_follower_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_follows
    ADD CONSTRAINT coach_follows_follower_fkey FOREIGN KEY (run_id, follower_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_group_registrations coach_group_registrations_run_id_athlete_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_registrations
    ADD CONSTRAINT coach_group_registrations_run_id_athlete_profile_id_fkey FOREIGN KEY (run_id, athlete_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id);


--
-- Name: coach_group_registrations coach_group_registrations_run_id_session_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_registrations
    ADD CONSTRAINT coach_group_registrations_run_id_session_id_fkey FOREIGN KEY (run_id, session_id) REFERENCES app.coach_group_sessions(run_id, id) ON DELETE CASCADE;


--
-- Name: coach_group_sessions coach_group_sessions_run_id_coach_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_sessions
    ADD CONSTRAINT coach_group_sessions_run_id_coach_profile_id_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id);


--
-- Name: coach_group_sessions coach_group_sessions_run_id_coach_profile_id_training_loca_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_group_sessions
    ADD CONSTRAINT coach_group_sessions_run_id_coach_profile_id_training_loca_fkey FOREIGN KEY (run_id, coach_profile_id, training_location_id) REFERENCES app.coach_training_locations(run_id, profile_id, id);


--
-- Name: coach_pass_purchase_operations coach_pass_purchase_operations_client_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_pass_purchase_operations
    ADD CONSTRAINT coach_pass_purchase_operations_client_fkey FOREIGN KEY (run_id, client_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_pass_purchase_operations coach_pass_purchase_operations_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_pass_purchase_operations
    ADD CONSTRAINT coach_pass_purchase_operations_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_posts coach_posts_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_posts
    ADD CONSTRAINT coach_posts_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_private_bookings coach_private_bookings_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_cancelled_by_fkey FOREIGN KEY (run_id, cancelled_by_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_private_bookings coach_private_bookings_client_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_client_fkey FOREIGN KEY (run_id, client_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_private_bookings coach_private_bookings_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_private_bookings coach_private_bookings_credit_projection_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_credit_projection_fkey FOREIGN KEY (run_id, credit_projection_id) REFERENCES app.coach_client_credit_projections(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_private_bookings coach_private_bookings_decider_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_decider_fkey FOREIGN KEY (run_id, cancellation_decided_by_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_private_bookings coach_private_bookings_slot_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_private_bookings
    ADD CONSTRAINT coach_private_bookings_slot_fkey FOREIGN KEY (run_id, slot_id) REFERENCES app.coach_availability_slots(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_profile_disciplines coach_profile_disciplines_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profile_disciplines
    ADD CONSTRAINT coach_profile_disciplines_coach_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_profiles coach_profiles_run_gym_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profiles
    ADD CONSTRAINT coach_profiles_run_gym_fkey FOREIGN KEY (run_id, selected_gym_id) REFERENCES app.gyms(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_profiles coach_profiles_run_profile_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_profiles
    ADD CONSTRAINT coach_profiles_run_profile_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: coach_training_locations coach_training_locations_gym_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_training_locations
    ADD CONSTRAINT coach_training_locations_gym_fkey FOREIGN KEY (run_id, selected_gym_id) REFERENCES app.gyms(run_id, id) ON DELETE RESTRICT;


--
-- Name: coach_training_locations coach_training_locations_owner_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.coach_training_locations
    ADD CONSTRAINT coach_training_locations_owner_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE CASCADE;


--
-- Name: demo_run_participants demo_run_participants_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.demo_run_participants
    ADD CONSTRAINT demo_run_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES app.profiles(id) ON DELETE RESTRICT;


--
-- Name: demo_run_participants demo_run_participants_run_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.demo_run_participants
    ADD CONSTRAINT demo_run_participants_run_id_fkey FOREIGN KEY (run_id) REFERENCES app.demo_runs(id) ON DELETE RESTRICT;


--
-- Name: group_event_chain_operations group_event_chain_operations_actor_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_chain_operations
    ADD CONSTRAINT group_event_chain_operations_actor_fkey FOREIGN KEY (run_id, actor_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: group_event_chain_operations group_event_chain_operations_event_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_chain_operations
    ADD CONSTRAINT group_event_chain_operations_event_fkey FOREIGN KEY (run_id, event_id) REFERENCES app.group_events(run_id, id) ON DELETE RESTRICT;


--
-- Name: group_event_contribution_projections group_event_contribution_projections_event_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_contribution_projections
    ADD CONSTRAINT group_event_contribution_projections_event_fkey FOREIGN KEY (run_id, event_id) REFERENCES app.group_events(run_id, id) ON DELETE RESTRICT;


--
-- Name: group_event_contribution_projections group_event_contribution_projections_participant_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_contribution_projections
    ADD CONSTRAINT group_event_contribution_projections_participant_fkey FOREIGN KEY (run_id, participant_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: group_event_pool_projections group_event_pool_projections_event_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_event_pool_projections
    ADD CONSTRAINT group_event_pool_projections_event_fkey FOREIGN KEY (run_id, event_id) REFERENCES app.group_events(run_id, id) ON DELETE RESTRICT;


--
-- Name: group_events group_events_coach_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.group_events
    ADD CONSTRAINT group_events_coach_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: gyms gyms_run_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.gyms
    ADD CONSTRAINT gyms_run_id_fkey FOREIGN KEY (run_id) REFERENCES app.demo_runs(id) ON DELETE RESTRICT;


--
-- Name: message_block_bookings message_block_bookings_block_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_block_bookings
    ADD CONSTRAINT message_block_bookings_block_id_fkey FOREIGN KEY (block_id) REFERENCES app.message_blocks(id) ON DELETE CASCADE;


--
-- Name: message_blocks message_blocks_blocked_by_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_blocks
    ADD CONSTRAINT message_blocks_blocked_by_profile_id_fkey FOREIGN KEY (blocked_by_profile_id) REFERENCES app.profiles(id);


--
-- Name: message_blocks message_blocks_high_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_blocks
    ADD CONSTRAINT message_blocks_high_profile_id_fkey FOREIGN KEY (high_profile_id) REFERENCES app.profiles(id);


--
-- Name: message_blocks message_blocks_low_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_blocks
    ADD CONSTRAINT message_blocks_low_profile_id_fkey FOREIGN KEY (low_profile_id) REFERENCES app.profiles(id);


--
-- Name: message_consents message_consents_conversation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_consents
    ADD CONSTRAINT message_consents_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES app.message_conversations(id) ON DELETE CASCADE;


--
-- Name: message_consents message_consents_recipient_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_consents
    ADD CONSTRAINT message_consents_recipient_profile_id_fkey FOREIGN KEY (recipient_profile_id) REFERENCES app.profiles(id);


--
-- Name: message_consents message_consents_sender_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_consents
    ADD CONSTRAINT message_consents_sender_profile_id_fkey FOREIGN KEY (sender_profile_id) REFERENCES app.profiles(id);


--
-- Name: message_contexts message_contexts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_contexts
    ADD CONSTRAINT message_contexts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES app.message_conversations(id) ON DELETE CASCADE;


--
-- Name: message_conversations message_conversations_run_id_athlete_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_conversations
    ADD CONSTRAINT message_conversations_run_id_athlete_profile_id_fkey FOREIGN KEY (run_id, athlete_profile_id) REFERENCES app.demo_run_participants(run_id, profile_id);


--
-- Name: message_conversations message_conversations_run_id_coach_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_conversations
    ADD CONSTRAINT message_conversations_run_id_coach_profile_id_fkey FOREIGN KEY (run_id, coach_profile_id) REFERENCES app.coach_profiles(run_id, profile_id);


--
-- Name: message_entries message_entries_context_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_context_id_fkey FOREIGN KEY (context_id) REFERENCES app.message_contexts(id);


--
-- Name: message_entries message_entries_conversation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES app.message_conversations(id) ON DELETE CASCADE;


--
-- Name: message_entries message_entries_sender_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_entries
    ADD CONSTRAINT message_entries_sender_profile_id_fkey FOREIGN KEY (sender_profile_id) REFERENCES app.profiles(id);


--
-- Name: message_reads message_reads_conversation_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_reads
    ADD CONSTRAINT message_reads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES app.message_conversations(id) ON DELETE CASCADE;


--
-- Name: message_reads message_reads_profile_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.message_reads
    ADD CONSTRAINT message_reads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES app.profiles(id);


--
-- Name: private_session_titles private_session_titles_booking_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.private_session_titles
    ADD CONSTRAINT private_session_titles_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES app.coach_private_bookings(id) ON DELETE CASCADE;


--
-- Name: private_session_titles private_session_titles_updated_by_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.private_session_titles
    ADD CONSTRAINT private_session_titles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES app.profiles(id);


--
-- Name: profiles profiles_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.profiles
    ADD CONSTRAINT profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: wallet_bindings wallet_bindings_bound_by_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_bound_by_auth_user_id_fkey FOREIGN KEY (bound_by_auth_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: wallet_bindings wallet_bindings_personal_target_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_personal_target_fkey FOREIGN KEY (run_id, profile_id) REFERENCES app.demo_run_participants(run_id, profile_id) ON DELETE RESTRICT;


--
-- Name: wallet_bindings wallet_bindings_replacement_binding_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_replacement_binding_id_fkey FOREIGN KEY (replacement_binding_id) REFERENCES app.wallet_bindings(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;


--
-- Name: wallet_bindings wallet_bindings_run_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_run_id_fkey FOREIGN KEY (run_id) REFERENCES app.demo_runs(id) ON DELETE RESTRICT;


--
-- Name: wallet_bindings wallet_bindings_verified_by_challenge_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: app_owner
--

ALTER TABLE ONLY app.wallet_bindings
    ADD CONSTRAINT wallet_bindings_verified_by_challenge_id_fkey FOREIGN KEY (verified_by_challenge_id) REFERENCES app.auth_challenges(id) ON DELETE RESTRICT;


--
-- Name: auth_challenges; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.auth_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: auth_challenges auth_challenges_wallet_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY auth_challenges_wallet_management_all ON app.auth_challenges TO app_owner USING ((current_setting('app.wallet_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.wallet_management'::text, true) = 'on'::text));


--
-- Name: coach_application_review_events; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_application_review_events ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_application_review_events coach_application_review_events_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_application_review_events_management_all ON app.coach_application_review_events TO app_owner USING ((current_setting('app.coach_application_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_application_management'::text, true) = 'on'::text));


--
-- Name: coach_application_review_events coach_application_review_events_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_application_review_events_owner_select ON app.coach_application_review_events FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, NULL::uuid, NULL::text));


--
-- Name: coach_applications; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_applications coach_applications_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_applications_management_all ON app.coach_applications TO app_owner USING ((current_setting('app.coach_application_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_application_management'::text, true) = 'on'::text));


--
-- Name: coach_applications coach_applications_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_applications_owner_select ON app.coach_applications FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, NULL::uuid, NULL::text));


--
-- Name: coach_athlete_connection_attempts; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_athlete_connection_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_athlete_connection_pairs; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_athlete_connection_pairs ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_availability_rules; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_availability_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_availability_rules coach_availability_rules_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_availability_rules_management_all ON app.coach_availability_rules TO app_owner USING ((current_setting('app.coach_availability_rule_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_availability_rule_management'::text, true) = 'on'::text));


--
-- Name: coach_availability_rules coach_availability_rules_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_availability_rules_owner_select ON app.coach_availability_rules FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, run_id, NULL::text));


--
-- Name: coach_availability_slots; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_availability_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_availability_slots coach_availability_slots_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_availability_slots_management_all ON app.coach_availability_slots TO app_owner USING ((current_setting('app.coach_availability_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_availability_management'::text, true) = 'on'::text));


--
-- Name: coach_availability_slots coach_availability_slots_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_availability_slots_owner_select ON app.coach_availability_slots FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, run_id, NULL::text));


--
-- Name: coach_availability_slots coach_availability_slots_public_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_availability_slots_public_select ON app.coach_availability_slots FOR SELECT TO app_runtime USING (((starts_at > statement_timestamp()) AND (ends_at <= (statement_timestamp() + '7 days'::interval)) AND (EXISTS ( SELECT 1
   FROM app.coach_profiles coach
  WHERE ((coach.run_id = coach_availability_slots.run_id) AND (coach.profile_id = coach_availability_slots.profile_id) AND (coach.visibility = 'visible'::text) AND (coach.location_confirmed_at IS NOT NULL))))));


--
-- Name: coach_booking_credit_operations; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_booking_credit_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_booking_credit_operations_actor_select ON app.coach_booking_credit_operations FOR SELECT TO app_runtime USING ((EXISTS ( SELECT 1
   FROM app.coach_private_bookings booking
  WHERE ((booking.id = coach_booking_credit_operations.booking_id) AND (booking.run_id = coach_booking_credit_operations.run_id) AND app.authorized_actor_context_valid(NULL::uuid, booking.run_id, NULL::text) AND (((NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid = booking.coach_profile_id) OR ((NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid = booking.client_profile_id))))));


--
-- Name: coach_booking_credit_operations coach_booking_credit_operations_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_booking_credit_operations_management_all ON app.coach_booking_credit_operations TO app_owner USING ((current_setting('app.coach_booking_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_booking_management'::text, true) = 'on'::text));


--
-- Name: coach_booking_requests; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_booking_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_booking_requests coach_booking_requests_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_booking_requests_management_all ON app.coach_booking_requests TO app_owner USING ((current_setting('app.coach_booking_request_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_booking_request_management'::text, true) = 'on'::text));


--
-- Name: coach_client_credit_projections; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_client_credit_projections ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_client_credit_projections coach_client_credit_projections_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_client_credit_projections_actor_select ON app.coach_client_credit_projections FOR SELECT TO app_runtime USING ((app.authorized_actor_context_valid(NULL::uuid, run_id, NULL::text) AND (((NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid = coach_profile_id) OR ((NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid = client_profile_id))));


--
-- Name: coach_client_credit_projections coach_client_credit_projections_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_client_credit_projections_management_all ON app.coach_client_credit_projections TO app_owner USING ((current_setting('app.coach_booking_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_booking_management'::text, true) = 'on'::text));


--
-- Name: coach_follows; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_follows ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_follows coach_follows_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_follows_management_all ON app.coach_follows TO app_owner USING ((current_setting('app.coach_social_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_social_management'::text, true) = 'on'::text));


--
-- Name: coach_follows coach_follows_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_follows_owner_select ON app.coach_follows FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(follower_profile_id, run_id, NULL::text));


--
-- Name: coach_group_registrations; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_group_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_group_sessions; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_group_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_pass_purchase_operations; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_pass_purchase_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_pass_purchase_operations coach_pass_purchase_operations_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_pass_purchase_operations_actor_select ON app.coach_pass_purchase_operations FOR SELECT TO app_runtime USING ((app.authorized_actor_context_valid(NULL::uuid, run_id, NULL::text) AND (client_profile_id = (NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid)));


--
-- Name: coach_pass_purchase_operations coach_pass_purchase_operations_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_pass_purchase_operations_management_all ON app.coach_pass_purchase_operations TO app_owner USING ((current_setting('app.coach_pass_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_pass_management'::text, true) = 'on'::text));


--
-- Name: coach_posts; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_posts coach_posts_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_posts_management_all ON app.coach_posts TO app_owner USING ((current_setting('app.coach_social_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_social_management'::text, true) = 'on'::text));


--
-- Name: coach_posts coach_posts_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_posts_owner_select ON app.coach_posts FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(coach_profile_id, run_id, NULL::text));


--
-- Name: coach_posts coach_posts_public_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_posts_public_select ON app.coach_posts FOR SELECT TO app_runtime USING (((visibility = 'visible'::text) AND (EXISTS ( SELECT 1
   FROM app.coach_profiles coach
  WHERE ((coach.run_id = coach_posts.run_id) AND (coach.profile_id = coach_posts.coach_profile_id) AND (coach.visibility = 'visible'::text))))));


--
-- Name: coach_private_bookings; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_private_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_private_bookings coach_private_bookings_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_private_bookings_actor_select ON app.coach_private_bookings FOR SELECT TO app_runtime USING ((app.authorized_actor_context_valid(NULL::uuid, run_id, NULL::text) AND (((NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid = coach_profile_id) OR ((NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid = client_profile_id))));


--
-- Name: coach_private_bookings coach_private_bookings_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_private_bookings_management_all ON app.coach_private_bookings TO app_owner USING ((current_setting('app.coach_booking_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_booking_management'::text, true) = 'on'::text));


--
-- Name: coach_profile_disciplines; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_profile_disciplines ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_profile_disciplines coach_profile_disciplines_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profile_disciplines_management_all ON app.coach_profile_disciplines TO app_owner USING ((current_setting('app.coach_profile_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_profile_management'::text, true) = 'on'::text));


--
-- Name: coach_profile_disciplines coach_profile_disciplines_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profile_disciplines_owner_select ON app.coach_profile_disciplines FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, run_id, NULL::text));


--
-- Name: coach_profile_disciplines coach_profile_disciplines_public_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profile_disciplines_public_select ON app.coach_profile_disciplines FOR SELECT TO app_runtime USING ((EXISTS ( SELECT 1
   FROM app.coach_profiles coach
  WHERE ((coach.run_id = coach_profile_disciplines.run_id) AND (coach.profile_id = coach_profile_disciplines.profile_id) AND (coach.visibility = 'visible'::text)))));


--
-- Name: coach_profiles; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_profiles coach_profiles_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profiles_management_all ON app.coach_profiles TO app_owner USING ((current_setting('app.coach_profile_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_profile_management'::text, true) = 'on'::text));


--
-- Name: coach_profiles coach_profiles_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profiles_owner_select ON app.coach_profiles FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, run_id, NULL::text));


--
-- Name: coach_profiles coach_profiles_public_discovery_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profiles_public_discovery_select ON app.coach_profiles FOR SELECT TO app_runtime USING (((visibility = 'visible'::text) AND (app.coach_trust_kind(profile_id, is_demo) IS NOT NULL) AND app.coach_has_publishable_primary_location(run_id, profile_id) AND (EXISTS ( SELECT 1
   FROM app.demo_runs run
  WHERE ((run.id = coach_profiles.run_id) AND (run.status = 'active'::text) AND (run.catalogue_visibility = 'public'::text))))));


--
-- Name: coach_profiles coach_profiles_social_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profiles_social_management_select ON app.coach_profiles FOR SELECT TO app_owner USING ((current_setting('app.coach_social_management'::text, true) = 'on'::text));


--
-- Name: coach_profiles coach_profiles_training_location_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_profiles_training_location_management_select ON app.coach_profiles FOR SELECT TO app_owner USING ((current_setting('app.coach_training_location_management'::text, true) = 'on'::text));


--
-- Name: coach_training_locations; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.coach_training_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_training_locations coach_training_locations_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_training_locations_management_all ON app.coach_training_locations TO app_owner USING ((current_setting('app.coach_training_location_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_training_location_management'::text, true) = 'on'::text));


--
-- Name: coach_training_locations coach_training_locations_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_training_locations_owner_select ON app.coach_training_locations FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, run_id, NULL::text));


--
-- Name: coach_training_locations coach_training_locations_public_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY coach_training_locations_public_select ON app.coach_training_locations FOR SELECT TO app_runtime USING (((status = 'active'::text) AND (location_confirmed_at IS NOT NULL) AND app.coach_training_location_publicly_visible(run_id, profile_id, selected_gym_id)));


--
-- Name: coach_athlete_connection_attempts connection_attempts_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY connection_attempts_management ON app.coach_athlete_connection_attempts TO app_owner USING ((current_setting('app.coach_connection_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_connection_management'::text, true) = 'on'::text));


--
-- Name: coach_athlete_connection_pairs connection_pairs_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY connection_pairs_management ON app.coach_athlete_connection_pairs TO app_owner USING ((current_setting('app.coach_connection_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_connection_management'::text, true) = 'on'::text));


--
-- Name: demo_run_participants connection_participants_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY connection_participants_lookup ON app.demo_run_participants FOR SELECT TO app_owner USING (((current_setting('app.coach_connection_management'::text, true) = 'on'::text) AND ((run_id)::text = current_setting('app.current_run_id'::text, true))));


--
-- Name: demo_run_participants; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.demo_run_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: demo_run_participants demo_run_participants_actor_validation_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_run_participants_actor_validation_select ON app.demo_run_participants FOR SELECT TO app_owner USING ((current_setting('app.actor_validation'::text, true) = 'on'::text));


--
-- Name: demo_run_participants demo_run_participants_application_identity_insert; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_run_participants_application_identity_insert ON app.demo_run_participants FOR INSERT TO app_owner WITH CHECK ((current_setting('app.identity_enrollment'::text, true) = 'on'::text));


--
-- Name: demo_run_participants demo_run_participants_application_identity_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_run_participants_application_identity_select ON app.demo_run_participants FOR SELECT TO app_owner USING ((current_setting('app.identity_enrollment'::text, true) = 'on'::text));


--
-- Name: demo_run_participants demo_run_participants_authorized_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_run_participants_authorized_actor_select ON app.demo_run_participants FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(profile_id, run_id, role));


--
-- Name: demo_runs; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.demo_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: demo_runs demo_runs_actor_validation_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_runs_actor_validation_select ON app.demo_runs FOR SELECT TO app_owner USING ((current_setting('app.actor_validation'::text, true) = 'on'::text));


--
-- Name: demo_runs demo_runs_application_identity_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_runs_application_identity_select ON app.demo_runs FOR SELECT TO app_owner USING ((current_setting('app.identity_enrollment'::text, true) = 'on'::text));


--
-- Name: demo_runs demo_runs_authorized_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_runs_authorized_actor_select ON app.demo_runs FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(NULL::uuid, id, NULL::text));


--
-- Name: demo_runs demo_runs_coach_availability_sync_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_runs_coach_availability_sync_select ON app.demo_runs FOR SELECT TO app_owner USING ((current_setting('app.coach_availability_rule_management'::text, true) = 'on'::text));


--
-- Name: demo_runs demo_runs_public_discovery_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_runs_public_discovery_select ON app.demo_runs FOR SELECT TO app_runtime USING (((status = 'active'::text) AND (catalogue_visibility = 'public'::text)));


--
-- Name: demo_runs demo_runs_training_location_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY demo_runs_training_location_management_select ON app.demo_runs FOR SELECT TO app_owner USING ((current_setting('app.coach_training_location_management'::text, true) = 'on'::text));


--
-- Name: group_event_chain_operations; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.group_event_chain_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: group_event_chain_operations group_event_chain_operations_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_chain_operations_actor_select ON app.group_event_chain_operations FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(actor_profile_id, run_id, NULL::text));


--
-- Name: group_event_chain_operations group_event_chain_operations_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_chain_operations_management_all ON app.group_event_chain_operations TO app_owner USING ((current_setting('app.group_event_operation_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.group_event_operation_management'::text, true) = 'on'::text));


--
-- Name: group_event_contribution_projections; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.group_event_contribution_projections ENABLE ROW LEVEL SECURITY;

--
-- Name: group_event_contribution_projections group_event_contribution_projections_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_contribution_projections_actor_select ON app.group_event_contribution_projections FOR SELECT TO app_runtime USING ((app.authorized_actor_context_valid(participant_profile_id, run_id, NULL::text) OR (EXISTS ( SELECT 1
   FROM app.group_events event
  WHERE ((event.id = group_event_contribution_projections.event_id) AND (event.run_id = group_event_contribution_projections.run_id) AND app.authorized_actor_context_valid(event.coach_profile_id, event.run_id, NULL::text))))));


--
-- Name: group_event_contribution_projections group_event_contribution_projections_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_contribution_projections_management_all ON app.group_event_contribution_projections TO app_owner USING ((current_setting('app.group_event_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.group_event_management'::text, true) = 'on'::text));


--
-- Name: group_event_pool_projections; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.group_event_pool_projections ENABLE ROW LEVEL SECURITY;

--
-- Name: group_event_pool_projections group_event_pool_projections_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_pool_projections_management_all ON app.group_event_pool_projections TO app_owner USING ((current_setting('app.group_event_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.group_event_management'::text, true) = 'on'::text));


--
-- Name: group_event_pool_projections group_event_pool_projections_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_pool_projections_owner_select ON app.group_event_pool_projections FOR SELECT TO app_runtime USING ((EXISTS ( SELECT 1
   FROM app.group_events event
  WHERE ((event.id = group_event_pool_projections.event_id) AND (event.run_id = group_event_pool_projections.run_id) AND app.authorized_actor_context_valid(event.coach_profile_id, event.run_id, NULL::text)))));


--
-- Name: group_event_pool_projections group_event_pool_projections_public_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_event_pool_projections_public_select ON app.group_event_pool_projections FOR SELECT TO app_runtime USING ((EXISTS ( SELECT 1
   FROM app.group_events event
  WHERE ((event.id = group_event_pool_projections.event_id) AND (event.run_id = group_event_pool_projections.run_id) AND (event.publication_status = 'published'::text)))));


--
-- Name: group_events; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.group_events ENABLE ROW LEVEL SECURITY;

--
-- Name: group_events group_events_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_events_management_all ON app.group_events TO app_owner USING ((current_setting('app.group_event_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.group_event_management'::text, true) = 'on'::text));


--
-- Name: group_events group_events_owner_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_events_owner_select ON app.group_events FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(coach_profile_id, run_id, NULL::text));


--
-- Name: group_events group_events_public_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_events_public_select ON app.group_events FOR SELECT TO app_runtime USING (((publication_status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM app.demo_runs run
  WHERE ((run.id = group_events.run_id) AND (run.status = 'active'::text) AND (run.catalogue_visibility = 'public'::text))))));


--
-- Name: coach_group_registrations group_registration_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_registration_management ON app.coach_group_registrations TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_availability_slots group_schedule_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_schedule_lookup ON app.coach_availability_slots FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_private_bookings group_schedule_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_schedule_lookup ON app.coach_private_bookings FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_applications group_session_lock; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lock ON app.coach_applications FOR UPDATE TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text)) WITH CHECK (false);


--
-- Name: coach_profiles group_session_lock; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lock ON app.coach_profiles FOR UPDATE TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text)) WITH CHECK (false);


--
-- Name: coach_training_locations group_session_lock; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lock ON app.coach_training_locations FOR UPDATE TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text)) WITH CHECK (false);


--
-- Name: coach_applications group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.coach_applications FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_profile_disciplines group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.coach_profile_disciplines FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_profiles group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.coach_profiles FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_training_locations group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.coach_training_locations FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: demo_run_participants group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.demo_run_participants FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: demo_runs group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.demo_runs FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: profiles group_session_lookup; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_lookup ON app.profiles FOR SELECT TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: coach_group_sessions group_session_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY group_session_management ON app.coach_group_sessions TO app_owner USING ((current_setting('app.group_session_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.group_session_management'::text, true) = 'on'::text));


--
-- Name: gyms; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.gyms ENABLE ROW LEVEL SECURITY;

--
-- Name: gyms gyms_coach_profile_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY gyms_coach_profile_management_select ON app.gyms FOR SELECT TO app_owner USING ((current_setting('app.coach_profile_management'::text, true) = 'on'::text));


--
-- Name: gyms gyms_public_discovery_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY gyms_public_discovery_select ON app.gyms FOR SELECT TO app_runtime USING (((status = 'active'::text) AND (EXISTS ( SELECT 1
   FROM app.demo_runs run
  WHERE ((run.id = gyms.run_id) AND (run.status = 'active'::text) AND (run.catalogue_visibility = 'public'::text))))));


--
-- Name: gyms gyms_training_location_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY gyms_training_location_management_select ON app.gyms FOR SELECT TO app_owner USING ((current_setting('app.coach_training_location_management'::text, true) = 'on'::text));


--
-- Name: message_block_bookings; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_block_bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: message_blocks; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: message_consents; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: message_contexts; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_contexts ENABLE ROW LEVEL SECURITY;

--
-- Name: message_conversations; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: message_entries; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: message_block_bookings message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_block_bookings TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_blocks message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_blocks TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_consents message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_consents TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_contexts message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_contexts TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_conversations message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_conversations TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_entries message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_entries TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_reads message_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_management ON app.message_reads TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: demo_run_participants message_membership_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY message_membership_select ON app.demo_run_participants FOR SELECT TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: message_reads; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.message_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: private_session_titles; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.private_session_titles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_actor_validation_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_actor_validation_select ON app.profiles FOR SELECT TO app_owner USING ((current_setting('app.actor_validation'::text, true) = 'on'::text));


--
-- Name: profiles profiles_application_identity_insert; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_application_identity_insert ON app.profiles FOR INSERT TO app_owner WITH CHECK ((current_setting('app.identity_enrollment'::text, true) = 'on'::text));


--
-- Name: profiles profiles_application_identity_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_application_identity_select ON app.profiles FOR SELECT TO app_owner USING ((current_setting('app.identity_enrollment'::text, true) = 'on'::text));


--
-- Name: profiles profiles_authorized_actor_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_authorized_actor_select ON app.profiles FOR SELECT TO app_runtime USING (app.authorized_actor_context_valid(id, NULL::uuid, NULL::text));


--
-- Name: profiles profiles_coach_activation_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_coach_activation_management_all ON app.profiles TO app_owner USING ((current_setting('app.coach_activation_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.coach_activation_management'::text, true) = 'on'::text));


--
-- Name: profiles profiles_coach_client_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_coach_client_select ON app.profiles FOR SELECT TO app_runtime USING ((EXISTS ( SELECT 1
   FROM app.coach_client_credit_projections projection
  WHERE ((projection.run_id = (NULLIF(current_setting('app.current_run_id'::text, true), ''::text))::uuid) AND (projection.client_profile_id = profiles.id) AND (projection.coach_profile_id = (NULLIF(current_setting('app.current_profile_id'::text, true), ''::text))::uuid) AND app.authorized_actor_context_valid(projection.coach_profile_id, projection.run_id, NULL::text)))));


--
-- Name: profiles profiles_coach_profile_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_coach_profile_management_select ON app.profiles FOR SELECT TO app_owner USING ((current_setting('app.coach_profile_management'::text, true) = 'on'::text));


--
-- Name: profiles profiles_profile_media_management_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_profile_media_management_select ON app.profiles FOR SELECT TO app_owner USING ((current_setting('app.profile_media_management'::text, true) = 'on'::text));


--
-- Name: profiles profiles_profile_media_management_update; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY profiles_profile_media_management_update ON app.profiles FOR UPDATE TO app_owner USING ((current_setting('app.profile_media_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.profile_media_management'::text, true) = 'on'::text));


--
-- Name: private_session_titles session_title_management; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY session_title_management ON app.private_session_titles TO app_owner USING ((current_setting('app.message_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.message_management'::text, true) = 'on'::text));


--
-- Name: wallet_bindings; Type: ROW SECURITY; Schema: app; Owner: app_owner
--

ALTER TABLE app.wallet_bindings ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet_bindings wallet_bindings_actor_validation_select; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY wallet_bindings_actor_validation_select ON app.wallet_bindings FOR SELECT TO app_owner USING ((current_setting('app.actor_validation'::text, true) = 'on'::text));


--
-- Name: wallet_bindings wallet_bindings_wallet_management_all; Type: POLICY; Schema: app; Owner: app_owner
--

CREATE POLICY wallet_bindings_wallet_management_all ON app.wallet_bindings TO app_owner USING ((current_setting('app.wallet_management'::text, true) = 'on'::text)) WITH CHECK ((current_setting('app.wallet_management'::text, true) = 'on'::text));


--
-- Name: SCHEMA app; Type: ACL; Schema: -; Owner: app_owner
--

GRANT USAGE ON SCHEMA app TO app_runtime;


--
-- Name: FUNCTION accept_coach_booking_request(requested_request_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.accept_coach_booking_request(requested_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.accept_coach_booking_request(requested_request_id uuid) TO app_runtime;


--
-- Name: FUNCTION activate_owned_coaching(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.activate_owned_coaching() FROM PUBLIC;


--
-- Name: FUNCTION assert_visible_coach_primary_location(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.assert_visible_coach_primary_location() FROM PUBLIC;


--
-- Name: FUNCTION authorized_actor_context_valid(requested_profile_id uuid, requested_run_id uuid, requested_run_role text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.authorized_actor_context_valid(requested_profile_id uuid, requested_run_id uuid, requested_run_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.authorized_actor_context_valid(requested_profile_id uuid, requested_run_id uuid, requested_run_role text) TO app_runtime;


--
-- Name: FUNCTION bind_owned_group_event_pool(requested_event_id uuid, requested_program_address text, requested_event_pool_address text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.bind_owned_group_event_pool(requested_event_id uuid, requested_program_address text, requested_event_pool_address text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.bind_owned_group_event_pool(requested_event_id uuid, requested_program_address text, requested_event_pool_address text) TO app_runtime;


--
-- Name: FUNCTION book_direct_private_session(requested_slot_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.book_direct_private_session(requested_slot_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.book_direct_private_session(requested_slot_id uuid) TO app_runtime;


--
-- Name: FUNCTION cancel_direct_private_booking(requested_booking_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.cancel_direct_private_booking(requested_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.cancel_direct_private_booking(requested_booking_id uuid) TO app_runtime;


--
-- Name: FUNCTION close_coach_booking_request_occurrence(requested_slot_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.close_coach_booking_request_occurrence(requested_slot_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.close_coach_booking_request_occurrence(requested_slot_id uuid) TO app_runtime;


--
-- Name: FUNCTION close_pending_requests_for_hidden_coach(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.close_pending_requests_for_hidden_coach() FROM PUBLIC;


--
-- Name: FUNCTION close_pending_requests_for_withdrawn_occurrence(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.close_pending_requests_for_withdrawn_occurrence() FROM PUBLIC;


--
-- Name: FUNCTION coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.coach_booking_request_eligibility(requested_status text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION coach_has_publishable_primary_location(requested_run_id uuid, requested_profile_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.coach_has_publishable_primary_location(requested_run_id uuid, requested_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.coach_has_publishable_primary_location(requested_run_id uuid, requested_profile_id uuid) TO app_runtime;


--
-- Name: FUNCTION coach_local_time_is_unambiguous(requested_local_time timestamp without time zone, requested_timezone text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.coach_local_time_is_unambiguous(requested_local_time timestamp without time zone, requested_timezone text) FROM PUBLIC;


--
-- Name: FUNCTION coach_training_location_publicly_visible(requested_run_id uuid, requested_profile_id uuid, requested_gym_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.coach_training_location_publicly_visible(requested_run_id uuid, requested_profile_id uuid, requested_gym_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.coach_training_location_publicly_visible(requested_run_id uuid, requested_profile_id uuid, requested_gym_id uuid) TO app_runtime;


--
-- Name: FUNCTION coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION app.coach_trust_kind(requested_profile_id uuid, requested_is_demo boolean) TO app_runtime;


--
-- Name: FUNCTION complete_direct_private_booking(requested_booking_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.complete_direct_private_booking(requested_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.complete_direct_private_booking(requested_booking_id uuid) TO app_runtime;


--
-- Name: FUNCTION complete_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_message_hash bytea, requested_reauthenticated_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.complete_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_message_hash bytea, requested_reauthenticated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.complete_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_message_hash bytea, requested_reauthenticated_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION connection_access_flags(enabled boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.connection_access_flags(enabled boolean) FROM PUBLIC;


--
-- Name: FUNCTION connection_attempt_projection(requested_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.connection_attempt_projection(requested_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION connection_pair_eligible(requested_pair app.coach_athlete_connection_pairs); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.connection_pair_eligible(requested_pair app.coach_athlete_connection_pairs) FROM PUBLIC;


--
-- Name: FUNCTION create_coach_booking_request(requested_slot_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.create_coach_booking_request(requested_slot_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.create_coach_booking_request(requested_slot_id uuid) TO app_runtime;


--
-- Name: FUNCTION create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION app.create_owned_coach_availability(requested_local_start timestamp without time zone, requested_duration_minutes integer) TO app_runtime;


--
-- Name: FUNCTION create_owned_coach_availability_rule(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_iso_weekday smallint, requested_local_start_time time without time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.create_owned_coach_availability_rule(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_iso_weekday smallint, requested_local_start_time time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.create_owned_coach_availability_rule(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_iso_weekday smallint, requested_local_start_time time without time zone) TO app_runtime;


--
-- Name: FUNCTION create_owned_coach_post(requested_body text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.create_owned_coach_post(requested_body text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.create_owned_coach_post(requested_body text) TO app_runtime;


--
-- Name: FUNCTION create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.create_owned_coach_training_location(requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) TO app_runtime;


--
-- Name: FUNCTION create_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.create_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.create_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_application_identity(requested_auth_user_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_application_identity(requested_auth_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_application_identity(requested_auth_user_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_booking_connection_context(requested_booking_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_booking_connection_context(requested_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_booking_connection_context(requested_booking_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_client_coach_booking_request(requested_request_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_client_coach_booking_request(requested_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_client_coach_booking_request(requested_request_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_client_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_client_pending_coach_booking_requests(requested_slot_ids uuid[]); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_client_pending_coach_booking_requests(requested_slot_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_client_pending_coach_booking_requests(requested_slot_ids uuid[]) TO app_runtime;


--
-- Name: FUNCTION current_coach_athlete_connections(requested_role text, requested_section text, requested_limit integer, before_created_at timestamp with time zone, before_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_coach_athlete_connections(requested_role text, requested_section text, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_coach_athlete_connections(requested_role text, requested_section text, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_coach_booking_request_client_avatar_reference(requested_request_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_coach_booking_request_client_avatar_reference(requested_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_coach_booking_request_client_avatar_reference(requested_request_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_coach_booking_request_eligibility(requested_slot_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_coach_booking_request_eligibility(requested_slot_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_coach_booking_request_eligibility(requested_slot_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_confirmed_booking_client_avatar_references(requested_booking_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_confirmed_booking_client_avatar_references(requested_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_confirmed_booking_client_avatar_references(requested_booking_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_connection_athlete_avatar_reference(requested_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_connection_athlete_avatar_reference(requested_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_connection_athlete_avatar_reference(requested_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_connection_shared_history(requested_pair_id uuid, requested_limit integer, before_created_at timestamp with time zone, before_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_connection_shared_history(requested_pair_id uuid, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_connection_shared_history(requested_pair_id uuid, requested_limit integer, before_created_at timestamp with time zone, before_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_direct_private_bookings(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_direct_private_bookings() FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_direct_private_bookings() TO app_runtime;


--
-- Name: FUNCTION current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_owned_coach_booking_requests(requested_limit integer, requested_before_created_at timestamp with time zone, requested_before_id uuid) TO app_runtime;


--
-- Name: FUNCTION current_personal_wallet_binding(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_personal_wallet_binding() FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_personal_wallet_binding() TO app_runtime;


--
-- Name: FUNCTION current_session_title_details(booking uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.current_session_title_details(booking uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_session_title_details(booking uuid) TO app_runtime;


--
-- Name: FUNCTION current_storage_actor_can_read_booking_request_client_avatar(requested_path text); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.current_storage_actor_can_read_booking_request_client_avatar(requested_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_storage_actor_can_read_booking_request_client_avatar(requested_path text) TO authenticated;


--
-- Name: FUNCTION current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_storage_actor_can_read_confirmed_booking_client_avatar(requested_path text) TO authenticated;


--
-- Name: FUNCTION current_storage_actor_can_read_connection_athlete_avatar(requested_path text); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.current_storage_actor_can_read_connection_athlete_avatar(requested_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_storage_actor_can_read_connection_athlete_avatar(requested_path text) TO authenticated;


--
-- Name: FUNCTION current_storage_coach_profile_id(); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.current_storage_coach_profile_id() FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_storage_coach_profile_id() TO authenticated;


--
-- Name: FUNCTION current_storage_profile_id(); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.current_storage_profile_id() FROM PUBLIC;
GRANT ALL ON FUNCTION app.current_storage_profile_id() TO authenticated;


--
-- Name: FUNCTION deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.deactivate_owned_coach_training_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, requested_replacement_id uuid, expected_replacement_updated_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION decide_coach_athlete_connection(requested_id uuid, requested_action text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.decide_coach_athlete_connection(requested_id uuid, requested_action text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.decide_coach_athlete_connection(requested_id uuid, requested_action text) TO app_runtime;


--
-- Name: FUNCTION decide_owned_late_booking_cancellation(requested_booking_id uuid, requested_decision text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.decide_owned_late_booking_cancellation(requested_booking_id uuid, requested_decision text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.decide_owned_late_booking_cancellation(requested_booking_id uuid, requested_decision text) TO app_runtime;


--
-- Name: FUNCTION decline_coach_booking_request(requested_request_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.decline_coach_booking_request(requested_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.decline_coach_booking_request(requested_request_id uuid) TO app_runtime;


--
-- Name: FUNCTION enroll_application_identity(requested_auth_user_id uuid, requested_display_name text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.enroll_application_identity(requested_auth_user_id uuid, requested_display_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.enroll_application_identity(requested_auth_user_id uuid, requested_display_name text) TO app_runtime;


--
-- Name: FUNCTION fail_booking_credit_operation(requested_operation_id uuid, requested_status text, requested_reason text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.fail_booking_credit_operation(requested_operation_id uuid, requested_status text, requested_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.fail_booking_credit_operation(requested_operation_id uuid, requested_status text, requested_reason text) TO app_runtime;


--
-- Name: FUNCTION fail_coach_pass_purchase_operation(requested_operation_id uuid, requested_status text, requested_reason text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.fail_coach_pass_purchase_operation(requested_operation_id uuid, requested_status text, requested_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.fail_coach_pass_purchase_operation(requested_operation_id uuid, requested_status text, requested_reason text) TO app_runtime;


--
-- Name: FUNCTION fail_group_event_operation(requested_operation_id uuid, requested_status text, requested_failure_code text); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.fail_group_event_operation(requested_operation_id uuid, requested_status text, requested_failure_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.fail_group_event_operation(requested_operation_id uuid, requested_status text, requested_failure_code text) TO app_runtime;


--
-- Name: FUNCTION finalize_coach_pass_purchase_operation(requested_operation_id uuid, verified_transaction_signature text, verified_available bigint, verified_reserved bigint, verified_total bigint, verified_purchase_count bigint, verified_next_nonce bigint, verified_observed_slot bigint); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.finalize_coach_pass_purchase_operation(requested_operation_id uuid, verified_transaction_signature text, verified_available bigint, verified_reserved bigint, verified_total bigint, verified_purchase_count bigint, verified_next_nonce bigint, verified_observed_slot bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.finalize_coach_pass_purchase_operation(requested_operation_id uuid, verified_transaction_signature text, verified_available bigint, verified_reserved bigint, verified_total bigint, verified_purchase_count bigint, verified_next_nonce bigint, verified_observed_slot bigint) TO app_runtime;


--
-- Name: FUNCTION finalize_group_event_operation(requested_operation_id uuid, requested_observed_slot bigint); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.finalize_group_event_operation(requested_operation_id uuid, requested_observed_slot bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.finalize_group_event_operation(requested_operation_id uuid, requested_observed_slot bigint) TO app_runtime;


--
-- Name: FUNCTION finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.finalize_verified_booking_credit_operation(requested_operation_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_reservation_address text, verified_booking_id uuid, verified_scheduled_start_unix_seconds bigint, verified_early_return_until_unix_seconds bigint, verified_reservation_status text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_transaction_signature text, verified_observed_slot bigint) TO app_runtime;


--
-- Name: FUNCTION group_coach_enabled(dataset uuid, coach uuid, require_visible boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_coach_enabled(dataset uuid, coach uuid, require_visible boolean) FROM PUBLIC;


--
-- Name: FUNCTION group_lock_coach(dataset uuid, coach uuid, require_visible boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_lock_coach(dataset uuid, coach uuid, require_visible boolean) FROM PUBLIC;


--
-- Name: FUNCTION group_page(entries jsonb, page_size integer); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_page(entries jsonb, page_size integer) FROM PUBLIC;


--
-- Name: FUNCTION group_reconcile_session(requested_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_reconcile_session(requested_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION group_registration_projection(requested_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_registration_projection(requested_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION group_schedule_lock(dataset uuid, coach uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_schedule_lock(dataset uuid, coach uuid) FROM PUBLIC;


--
-- Name: FUNCTION group_session_command(action text, args jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_session_command(action text, args jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION app.group_session_command(action text, args jsonb) TO app_runtime;


--
-- Name: FUNCTION group_session_flags(enabled boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_session_flags(enabled boolean) FROM PUBLIC;


--
-- Name: FUNCTION group_session_projection(requested_id uuid, actor uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_session_projection(requested_id uuid, actor uuid) FROM PUBLIC;


--
-- Name: FUNCTION group_time_reserved(dataset uuid, coach uuid, from_time timestamp with time zone, to_time timestamp with time zone, excluding uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.group_time_reserved(dataset uuid, coach uuid, from_time timestamp with time zone, to_time timestamp with time zone, excluding uuid) FROM PUBLIC;


--
-- Name: FUNCTION guard_coach_schedule_write(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.guard_coach_schedule_write() FROM PUBLIC;


--
-- Name: FUNCTION guard_connection_attempt(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.guard_connection_attempt() FROM PUBLIC;


--
-- Name: FUNCTION guard_connection_pair(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.guard_connection_pair() FROM PUBLIC;


--
-- Name: FUNCTION guard_group_registration(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.guard_group_registration() FROM PUBLIC;


--
-- Name: FUNCTION guard_group_session(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.guard_group_session() FROM PUBLIC;


--
-- Name: FUNCTION issue_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_origin text, requested_nonce_hash bytea, requested_message_hash bytea, requested_issued_at timestamp with time zone, requested_expires_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.issue_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_origin text, requested_nonce_hash bytea, requested_message_hash bytea, requested_issued_at timestamp with time zone, requested_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.issue_personal_wallet_challenge(requested_challenge_id uuid, requested_purpose text, requested_wallet_address text, requested_origin text, requested_nonce_hash bytea, requested_message_hash bytea, requested_issued_at timestamp with time zone, requested_expires_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION lock_connection_eligibility(requested_pair app.coach_athlete_connection_pairs); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.lock_connection_eligibility(requested_pair app.coach_athlete_connection_pairs) FROM PUBLIC;


--
-- Name: FUNCTION mail_append(c app.message_conversations, ctx uuid, sender uuid, kind text, body text, submission uuid, event text, label text, at_time timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_append(c app.message_conversations, ctx uuid, sender uuid, kind text, body text, submission uuid, event text, label text, at_time timestamp with time zone) FROM PUBLIC;


--
-- Name: FUNCTION mail_blocked(run uuid, a uuid, b uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_blocked(run uuid, a uuid, b uuid) FROM PUBLIC;


--
-- Name: FUNCTION mail_booking_activity(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_booking_activity() FROM PUBLIC;


--
-- Name: FUNCTION mail_booking_guard(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_booking_guard() FROM PUBLIC;


--
-- Name: FUNCTION mail_change_block(c app.message_conversations, actor uuid, blocking boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_change_block(c app.message_conversations, actor uuid, blocking boolean) FROM PUBLIC;


--
-- Name: FUNCTION mail_coach_enabled(c app.message_conversations); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_coach_enabled(c app.message_conversations) FROM PUBLIC;


--
-- Name: FUNCTION mail_connection_guard(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_connection_guard() FROM PUBLIC;


--
-- Name: FUNCTION mail_context_allowed(c app.message_conversations, ctx app.message_contexts); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_context_allowed(c app.message_conversations, ctx app.message_contexts) FROM PUBLIC;


--
-- Name: FUNCTION mail_context_booking(ctx app.message_contexts); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_context_booking(ctx app.message_contexts) FROM PUBLIC;


--
-- Name: FUNCTION mail_context_projection(c app.message_conversations, ctx app.message_contexts); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_context_projection(c app.message_conversations, ctx app.message_contexts) FROM PUBLIC;


--
-- Name: FUNCTION mail_conversation_projection(c app.message_conversations, actor uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_conversation_projection(c app.message_conversations, actor uuid) FROM PUBLIC;


--
-- Name: FUNCTION mail_dispatch(action text, args jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_dispatch(action text, args jsonb) FROM PUBLIC;


--
-- Name: FUNCTION mail_dispatch_before_session_labels(action text, args jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_dispatch_before_session_labels(action text, args jsonb) FROM PUBLIC;


--
-- Name: FUNCTION mail_ensure_context(c app.message_conversations, kind text, source uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_ensure_context(c app.message_conversations, kind text, source uuid) FROM PUBLIC;


--
-- Name: FUNCTION mail_ensure_conversation(run uuid, coach uuid, athlete uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_ensure_conversation(run uuid, coach uuid, athlete uuid) FROM PUBLIC;


--
-- Name: FUNCTION mail_flags(enabled boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_flags(enabled boolean) FROM PUBLIC;


--
-- Name: FUNCTION mail_general_allowed(c app.message_conversations); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_general_allowed(c app.message_conversations) FROM PUBLIC;


--
-- Name: FUNCTION mail_general_eligible(c app.message_conversations); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_general_eligible(c app.message_conversations) FROM PUBLIC;


--
-- Name: FUNCTION mail_guard_consent_submission(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_guard_consent_submission() FROM PUBLIC;


--
-- Name: FUNCTION mail_lock_pair(run uuid, a uuid, b uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_lock_pair(run uuid, a uuid, b uuid) FROM PUBLIC;


--
-- Name: FUNCTION mail_rate(c app.message_conversations, actor uuid, first_contact boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_rate(c app.message_conversations, actor uuid, first_contact boolean) FROM PUBLIC;


--
-- Name: FUNCTION mail_request_activity(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_request_activity() FROM PUBLIC;


--
-- Name: FUNCTION mail_request_guard(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_request_guard() FROM PUBLIC;


--
-- Name: TABLE coach_private_bookings; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_private_bookings TO app_runtime;


--
-- Name: FUNCTION mail_session_details(b app.coach_private_bookings); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_session_details(b app.coach_private_bookings) FROM PUBLIC;


--
-- Name: FUNCTION mail_source_event(run uuid, coach uuid, athlete uuid, kind text, source uuid, event text, label text, sender uuid, at_time timestamp with time zone, entry_kind text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_source_event(run uuid, coach uuid, athlete uuid, kind text, source uuid, event text, label text, sender uuid, at_time timestamp with time zone, entry_kind text) FROM PUBLIC;


--
-- Name: FUNCTION mail_source_lock(run uuid, a uuid, b uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_source_lock(run uuid, a uuid, b uuid) FROM PUBLIC;


--
-- Name: FUNCTION mail_trigger_enter(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_trigger_enter() FROM PUBLIC;


--
-- Name: FUNCTION mail_trigger_leave(flags jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_trigger_leave(flags jsonb) FROM PUBLIC;


--
-- Name: FUNCTION mail_valid_body(body text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mail_valid_body(body text) FROM PUBLIC;


--
-- Name: FUNCTION mark_booking_credit_operation_submitted(requested_operation_id uuid, submitted_transaction_signature text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mark_booking_credit_operation_submitted(requested_operation_id uuid, submitted_transaction_signature text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.mark_booking_credit_operation_submitted(requested_operation_id uuid, submitted_transaction_signature text) TO app_runtime;


--
-- Name: FUNCTION mark_coach_pass_purchase_submitted(requested_operation_id uuid, submitted_transaction_signature text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mark_coach_pass_purchase_submitted(requested_operation_id uuid, submitted_transaction_signature text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.mark_coach_pass_purchase_submitted(requested_operation_id uuid, submitted_transaction_signature text) TO app_runtime;


--
-- Name: FUNCTION mark_group_event_operation_submitted(requested_operation_id uuid, requested_transaction_signature text); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.mark_group_event_operation_submitted(requested_operation_id uuid, requested_transaction_signature text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.mark_group_event_operation_submitted(requested_operation_id uuid, requested_transaction_signature text) TO app_runtime;


--
-- Name: FUNCTION mark_group_event_projection_availability(requested_event_id uuid, requested_program_address text, requested_event_pool_address text, requested_availability text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.mark_group_event_projection_availability(requested_event_id uuid, requested_program_address text, requested_event_pool_address text, requested_availability text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.mark_group_event_projection_availability(requested_event_id uuid, requested_program_address text, requested_event_pool_address text, requested_availability text) TO app_runtime;


--
-- Name: FUNCTION message_command(action text, args jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.message_command(action text, args jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION app.message_command(action text, args jsonb) TO app_runtime;


--
-- Name: FUNCTION prepare_credit_backed_private_booking(requested_booking_id uuid, requested_slot_id uuid, requested_credit_projection_id uuid, requested_reservation_address text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.prepare_credit_backed_private_booking(requested_booking_id uuid, requested_slot_id uuid, requested_credit_projection_id uuid, requested_reservation_address text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.prepare_credit_backed_private_booking(requested_booking_id uuid, requested_slot_id uuid, requested_credit_projection_id uuid, requested_reservation_address text) TO app_runtime;


--
-- Name: FUNCTION prepare_owned_private_booking_consumption(requested_booking_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.prepare_owned_private_booking_consumption(requested_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.prepare_owned_private_booking_consumption(requested_booking_id uuid) TO app_runtime;


--
-- Name: FUNCTION protect_recurring_coach_availability_occurrence(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.protect_recurring_coach_availability_occurrence() FROM PUBLIC;


--
-- Name: FUNCTION public_group_sessions(action text, args jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.public_group_sessions(action text, args jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION app.public_group_sessions(action text, args jsonb) TO app_runtime;


--
-- Name: FUNCTION publish_group_session(requested_id uuid, expected_revision integer); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.publish_group_session(requested_id uuid, expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION app.publish_group_session(requested_id uuid, expected_revision integer) TO app_runtime;


--
-- Name: FUNCTION publish_owned_group_event(requested_event_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.publish_owned_group_event(requested_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.publish_owned_group_event(requested_event_id uuid) TO app_runtime;


--
-- Name: FUNCTION record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.record_booking_credit_operation_preparation(requested_operation_id uuid, requested_authority_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) TO app_runtime;


--
-- Name: FUNCTION record_coach_pass_purchase_preparation(requested_operation_id uuid, requested_coach_profile_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_offer_address text, requested_credits_address text, requested_price bigint, requested_credits smallint, requested_expected_nonce bigint, requested_baseline_ledger_exists boolean, requested_baseline_available bigint, requested_baseline_reserved bigint, requested_baseline_total bigint, requested_baseline_purchase_count bigint, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.record_coach_pass_purchase_preparation(requested_operation_id uuid, requested_coach_profile_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_offer_address text, requested_credits_address text, requested_price bigint, requested_credits smallint, requested_expected_nonce bigint, requested_baseline_ledger_exists boolean, requested_baseline_available bigint, requested_baseline_reserved bigint, requested_baseline_total bigint, requested_baseline_purchase_count bigint, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.record_coach_pass_purchase_preparation(requested_operation_id uuid, requested_coach_profile_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_offer_address text, requested_credits_address text, requested_price bigint, requested_credits smallint, requested_expected_nonce bigint, requested_baseline_ledger_exists boolean, requested_baseline_available bigint, requested_baseline_reserved bigint, requested_baseline_total bigint, requested_baseline_purchase_count bigint, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) TO app_runtime;


--
-- Name: FUNCTION record_group_event_operation_preparation(requested_operation_id uuid, requested_event_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_event_pool_address text, requested_vault_address text, requested_contribution_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint); Type: ACL; Schema: app; Owner: postgres
--

REVOKE ALL ON FUNCTION app.record_group_event_operation_preparation(requested_operation_id uuid, requested_event_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_event_pool_address text, requested_vault_address text, requested_contribution_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.record_group_event_operation_preparation(requested_operation_id uuid, requested_event_id uuid, requested_operation_kind text, requested_program_address text, requested_authority_address text, requested_coach_authority_address text, requested_event_pool_address text, requested_vault_address text, requested_contribution_address text, requested_summary jsonb, requested_transaction_base64 text, requested_message_base64 text, requested_recent_blockhash text, requested_last_valid_block_height bigint, requested_simulation_slot bigint, requested_simulation_units bigint) TO app_runtime;


--
-- Name: FUNCTION record_verified_coach_credit_projection(requested_coach_profile_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_purchase_count bigint, verified_next_purchase_nonce bigint, verified_last_offer_address text, verified_last_purchase_at timestamp with time zone, verified_transaction_signature text, verified_observed_slot bigint); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.record_verified_coach_credit_projection(requested_coach_profile_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_purchase_count bigint, verified_next_purchase_nonce bigint, verified_last_offer_address text, verified_last_purchase_at timestamp with time zone, verified_transaction_signature text, verified_observed_slot bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION app.record_verified_coach_credit_projection(requested_coach_profile_id uuid, verified_program_address text, verified_coach_authority_address text, verified_client_wallet_address text, verified_credits_address text, verified_available_credits bigint, verified_reserved_credits bigint, verified_total_purchased bigint, verified_purchase_count bigint, verified_next_purchase_nonce bigint, verified_last_offer_address text, verified_last_purchase_at timestamp with time zone, verified_transaction_signature text, verified_observed_slot bigint) TO app_runtime;


--
-- Name: FUNCTION record_verified_group_event_contribution_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_contribution_address text, verified_participant_wallet_address text, verified_amount_base_units bigint, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.record_verified_group_event_contribution_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_contribution_address text, verified_participant_wallet_address text, verified_amount_base_units bigint, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.record_verified_group_event_contribution_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_contribution_address text, verified_participant_wallet_address text, verified_amount_base_units bigint, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.record_verified_group_event_pool_projection(requested_event_id uuid, verified_program_address text, verified_event_pool_address text, verified_vault_address text, verified_coach_authority_address text, verified_payout_recipient_address text, verified_mint_address text, verified_token_program_address text, verified_seat_price_base_units bigint, verified_minimum_participants smallint, verified_maximum_participants smallint, verified_participant_count smallint, verified_funding_deadline timestamp with time zone, verified_event_starts_at timestamp with time zone, verified_event_ends_at timestamp with time zone, verified_lifecycle_status text, verified_transaction_signature text, verified_observed_slot bigint, verified_finalized_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION release_owned_private_booking_hold(requested_booking_id uuid, requested_reason text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.release_owned_private_booking_hold(requested_booking_id uuid, requested_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.release_owned_private_booking_hold(requested_booking_id uuid, requested_reason text) TO app_runtime;


--
-- Name: FUNCTION remove_owned_coach_availability_rule(requested_rule_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.remove_owned_coach_availability_rule(requested_rule_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.remove_owned_coach_availability_rule(requested_rule_id uuid) TO app_runtime;


--
-- Name: FUNCTION replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION app.replace_owned_coach_availability_rules(requested_rules jsonb, expected_rules jsonb) TO app_runtime;


--
-- Name: FUNCTION request_owned_private_booking_cancellation(requested_booking_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.request_owned_private_booking_cancellation(requested_booking_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.request_owned_private_booking_cancellation(requested_booking_id uuid) TO app_runtime;


--
-- Name: FUNCTION require_active_coach_availability_rule_location(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.require_active_coach_availability_rule_location() FROM PUBLIC;


--
-- Name: FUNCTION require_coach_application_access(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.require_coach_application_access() FROM PUBLIC;


--
-- Name: FUNCTION require_coach_training_location_timezone(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.require_coach_training_location_timezone() FROM PUBLIC;


--
-- Name: FUNCTION review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text) FROM PUBLIC;


--
-- Name: FUNCTION send_coach_athlete_connection(requested_booking_id uuid, requested_attempt_id uuid, expected_previous_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.send_coach_athlete_connection(requested_booking_id uuid, requested_attempt_id uuid, expected_previous_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.send_coach_athlete_connection(requested_booking_id uuid, requested_attempt_id uuid, expected_previous_id uuid) TO app_runtime;


--
-- Name: FUNCTION set_current_account_avatar_reference(requested_path text, expected_path text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_current_account_avatar_reference(requested_path text, expected_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.set_current_account_avatar_reference(requested_path text, expected_path text) TO app_runtime;


--
-- Name: FUNCTION set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.set_current_coach_portrait_reference(requested_path text, expected_source text, expected_path text) TO app_runtime;


--
-- Name: FUNCTION set_owned_coach_follow(requested_coach_profile_id uuid, requested_following boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_owned_coach_follow(requested_coach_profile_id uuid, requested_following boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION app.set_owned_coach_follow(requested_coach_profile_id uuid, requested_following boolean) TO app_runtime;


--
-- Name: FUNCTION set_owned_coach_post_visibility(requested_post_id uuid, requested_visibility text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_owned_coach_post_visibility(requested_post_id uuid, requested_visibility text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.set_owned_coach_post_visibility(requested_post_id uuid, requested_visibility text) TO app_runtime;


--
-- Name: FUNCTION set_owned_coach_primary_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_owned_coach_primary_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.set_owned_coach_primary_location(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION set_owned_coach_primary_location_without_schedule_lock(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_owned_coach_primary_location_without_schedule_lock(requested_location_id uuid, expected_location_updated_at timestamp with time zone, expected_primary_location_id uuid, expected_primary_updated_at timestamp with time zone) FROM PUBLIC;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION app.set_updated_at() TO app_runtime;


--
-- Name: FUNCTION submit_owned_coach_application(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.submit_owned_coach_application() FROM PUBLIC;
GRANT ALL ON FUNCTION app.submit_owned_coach_application() TO app_runtime;


--
-- Name: FUNCTION sync_coach_availability_timezone_from_profile(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.sync_coach_availability_timezone_from_profile() FROM PUBLIC;


--
-- Name: FUNCTION sync_coach_profile_from_primary_training_location(requested_run_id uuid, requested_profile_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.sync_coach_profile_from_primary_training_location(requested_run_id uuid, requested_profile_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION sync_primary_training_location_from_profile(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.sync_primary_training_location_from_profile() FROM PUBLIC;


--
-- Name: FUNCTION synchronize_coach_availability_occurrences(requested_run_id uuid, requested_profile_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.synchronize_coach_availability_occurrences(requested_run_id uuid, requested_profile_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION synchronize_owned_coach_availability(); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.synchronize_owned_coach_availability() FROM PUBLIC;
GRANT ALL ON FUNCTION app.synchronize_owned_coach_availability() TO app_runtime;


--
-- Name: FUNCTION synchronize_public_coach_availability(requested_profile_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.synchronize_public_coach_availability(requested_profile_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.synchronize_public_coach_availability(requested_profile_id uuid) TO app_runtime;


--
-- Name: FUNCTION unlink_personal_wallet(requested_reauthenticated_at timestamp with time zone); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.unlink_personal_wallet(requested_reauthenticated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION app.unlink_personal_wallet(requested_reauthenticated_at timestamp with time zone) TO app_runtime;


--
-- Name: FUNCTION update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION app.update_owned_coach_availability(requested_slot_id uuid, requested_local_start timestamp without time zone, requested_duration_minutes integer, requested_refresh_location boolean) TO app_runtime;


--
-- Name: FUNCTION update_owned_coach_cancellation_policy(requested_minutes integer); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.update_owned_coach_cancellation_policy(requested_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION app.update_owned_coach_cancellation_policy(requested_minutes integer) TO app_runtime;


--
-- Name: FUNCTION update_owned_coach_training_location(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.update_owned_coach_training_location(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.update_owned_coach_training_location(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) TO app_runtime;


--
-- Name: FUNCTION update_owned_coach_training_location_without_schedule_lock(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.update_owned_coach_training_location_without_schedule_lock(requested_location_id uuid, expected_updated_at timestamp with time zone, requested_public_name text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) FROM PUBLIC;


--
-- Name: FUNCTION update_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.update_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.update_owned_group_event_draft(requested_event_id uuid, requested_title text, requested_discipline text, requested_description text, requested_starts_at timestamp with time zone, requested_ends_at timestamp with time zone, requested_media_url text, requested_source_proposal_id uuid) TO app_runtime;


--
-- Name: FUNCTION upsert_owned_coach_profile(requested_display_name text, requested_bio text, requested_disciplines text[], requested_timezone text, requested_visibility text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.upsert_owned_coach_profile(requested_display_name text, requested_bio text, requested_disciplines text[], requested_timezone text, requested_visibility text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) FROM PUBLIC;
GRANT ALL ON FUNCTION app.upsert_owned_coach_profile(requested_display_name text, requested_bio text, requested_disciplines text[], requested_timezone text, requested_visibility text, requested_gym_id uuid, requested_public_location_label text, requested_latitude numeric, requested_longitude numeric, requested_location_source text, requested_location_provider text) TO app_runtime;


--
-- Name: FUNCTION withdraw_coach_booking_request(requested_request_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.withdraw_coach_booking_request(requested_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.withdraw_coach_booking_request(requested_request_id uuid) TO app_runtime;


--
-- Name: FUNCTION withdraw_owned_coach_availability(requested_slot_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.withdraw_owned_coach_availability(requested_slot_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.withdraw_owned_coach_availability(requested_slot_id uuid) TO app_runtime;


--
-- Name: FUNCTION withdraw_owned_group_event_draft(requested_event_id uuid); Type: ACL; Schema: app; Owner: app_owner
--

REVOKE ALL ON FUNCTION app.withdraw_owned_group_event_draft(requested_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION app.withdraw_owned_group_event_draft(requested_event_id uuid) TO app_runtime;


--
-- Name: TABLE coach_application_review_events; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_application_review_events TO app_runtime;


--
-- Name: TABLE coach_applications; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_applications TO app_runtime;


--
-- Name: TABLE coach_availability_rules; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_availability_rules TO app_runtime;


--
-- Name: TABLE coach_availability_slots; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_availability_slots TO app_runtime;


--
-- Name: TABLE coach_booking_credit_operations; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_booking_credit_operations TO app_runtime;


--
-- Name: TABLE coach_client_credit_projections; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_client_credit_projections TO app_runtime;


--
-- Name: TABLE coach_follows; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_follows TO app_runtime;


--
-- Name: TABLE coach_pass_purchase_operations; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_pass_purchase_operations TO app_runtime;


--
-- Name: TABLE coach_posts; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_posts TO app_runtime;


--
-- Name: TABLE coach_profile_disciplines; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_profile_disciplines TO app_runtime;


--
-- Name: TABLE coach_profiles; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_profiles TO app_runtime;


--
-- Name: TABLE coach_training_locations; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.coach_training_locations TO app_runtime;


--
-- Name: TABLE demo_run_participants; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.demo_run_participants TO app_runtime;


--
-- Name: TABLE demo_runs; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.demo_runs TO app_runtime;


--
-- Name: TABLE group_event_chain_operations; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.group_event_chain_operations TO app_runtime;


--
-- Name: TABLE group_event_contribution_projections; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.group_event_contribution_projections TO app_runtime;


--
-- Name: TABLE group_event_pool_projections; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.group_event_pool_projections TO app_runtime;


--
-- Name: TABLE group_events; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.group_events TO app_runtime;


--
-- Name: TABLE gyms; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.gyms TO app_runtime;


--
-- Name: TABLE profiles; Type: ACL; Schema: app; Owner: app_owner
--

GRANT SELECT ON TABLE app.profiles TO app_runtime;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: app; Owner: app_owner
--

ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO app_runtime;


--
-- PostgreSQL database dump complete
--



-- External project policies and required setup rows are outside a schema-only app dump.
SET row_security = on;
CREATE POLICY account_avatars_booking_request_coach_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'account-avatars'::text) AND app.current_storage_actor_can_read_booking_request_client_avatar(name)));
CREATE POLICY account_avatars_confirmed_booking_coach_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'account-avatars'::text) AND app.current_storage_actor_can_read_confirmed_booking_client_avatar(name)));
CREATE POLICY account_avatars_connected_coach_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'account-avatars'::text) AND app.current_storage_actor_can_read_connection_athlete_avatar(name)));
CREATE POLICY account_avatars_owner_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'account-avatars'::text) AND ((storage.foldername(name))[1] = (app.current_storage_profile_id())::text)));
CREATE POLICY account_avatars_owner_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'account-avatars'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'::text) AND ((storage.foldername(name))[1] = (app.current_storage_profile_id())::text)));
CREATE POLICY account_avatars_owner_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'account-avatars'::text) AND ((storage.foldername(name))[1] = (app.current_storage_profile_id())::text)));
CREATE POLICY coach_portraits_owner_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'coach-portraits'::text) AND ((storage.foldername(name))[1] = (app.current_storage_coach_profile_id())::text)));
CREATE POLICY coach_portraits_owner_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'coach-portraits'::text) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'::text) AND ((storage.foldername(name))[1] = (app.current_storage_coach_profile_id())::text)));
CREATE POLICY coach_portraits_owner_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'coach-portraits'::text) AND ((storage.foldername(name))[1] = (app.current_storage_coach_profile_id())::text)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('account-avatars','account-avatars',false,524288,array['image/webp']::text[]),
('coach-portraits','coach-portraits',true,524288,array['image/webp']::text[])
on conflict(id) do update set name=excluded.name,public=excluded.public,
  file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
SET check_function_bodies = true;
