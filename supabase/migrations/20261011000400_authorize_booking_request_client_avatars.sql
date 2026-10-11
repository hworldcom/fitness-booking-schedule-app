-- Let an owning coach recognize clients in the bounded booking-request queue
-- without exposing private Storage paths to the browser or unrelated actors.

drop function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
);

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
  client_avatar_updated_at timestamptz,
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

alter function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) owner to app_owner;
revoke all on function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) to app_runtime;

comment on function app.current_owned_coach_booking_requests(
  integer,
  timestamptz,
  uuid
) is
  'Returns one bounded owning-coach request page with opaque avatar version metadata and reconciles a bounded set of elapsed deadlines.';

create function app.current_coach_booking_request_client_avatar_reference(
  requested_request_id uuid
)
returns table (
  request_id uuid,
  client_profile_id uuid,
  avatar_storage_path text,
  avatar_updated_at timestamptz
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

alter function app.current_coach_booking_request_client_avatar_reference(uuid)
  owner to app_owner;
revoke all on function app.current_coach_booking_request_client_avatar_reference(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app.current_coach_booking_request_client_avatar_reference(uuid)
  to app_runtime;

comment on function app.current_coach_booking_request_client_avatar_reference(uuid) is
  'Returns one private client avatar reference only when the current actor owns the referenced booking request as coach.';

create function app.current_storage_actor_can_read_booking_request_client_avatar(
  requested_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

alter function app.current_storage_actor_can_read_booking_request_client_avatar(text)
  owner to postgres;
revoke all on function app.current_storage_actor_can_read_booking_request_client_avatar(text)
  from public, anon, service_role;
grant execute on function app.current_storage_actor_can_read_booking_request_client_avatar(text)
  to authenticated;

comment on function app.current_storage_actor_can_read_booking_request_client_avatar(text) is
  'Allows a signed-in owning coach to read a request participant current private avatar object.';

drop policy if exists account_avatars_booking_request_coach_select
  on storage.objects;
create policy account_avatars_booking_request_coach_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'account-avatars'
    and app.current_storage_actor_can_read_booking_request_client_avatar(name)
  );
