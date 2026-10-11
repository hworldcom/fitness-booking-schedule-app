create function app.current_client_coach_booking_request(
  requested_request_id uuid
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

create function app.current_client_pending_coach_booking_requests(
  requested_slot_ids uuid[]
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

alter function app.current_client_coach_booking_request(uuid)
  owner to app_owner;
alter function app.current_client_pending_coach_booking_requests(uuid[])
  owner to app_owner;

revoke all on function app.current_client_coach_booking_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.current_client_pending_coach_booking_requests(uuid[])
  from public, anon, authenticated, service_role;

grant execute on function app.current_client_coach_booking_request(uuid)
  to app_runtime;
grant execute on function app.current_client_pending_coach_booking_requests(
  uuid[]
) to app_runtime;

comment on function app.current_client_coach_booking_request(uuid) is
  'Returns one exact actor-owned client request and reconciles its elapsed deadline.';
comment on function app.current_client_pending_coach_booking_requests(uuid[]) is
  'Returns actor-owned pending requests for a bounded set of displayed occurrences and reconciles their elapsed deadlines.';
