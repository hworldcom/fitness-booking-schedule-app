create function app.current_confirmed_booking_client_avatar_references(
  requested_booking_id uuid default null
)
returns table (
  booking_id uuid,
  client_profile_id uuid,
  avatar_storage_path text,
  avatar_updated_at timestamp with time zone
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

alter function app.current_confirmed_booking_client_avatar_references(uuid)
  owner to app_owner;
revoke all on function app.current_confirmed_booking_client_avatar_references(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app.current_confirmed_booking_client_avatar_references(uuid)
  to app_runtime;

comment on function app.current_confirmed_booking_client_avatar_references(uuid) is
  'Returns private client avatar references only to the owning coach of confirmed direct bookings.';

create function app.current_storage_actor_can_read_confirmed_booking_client_avatar(
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
$$;

alter function app.current_storage_actor_can_read_confirmed_booking_client_avatar(text)
  owner to postgres;
revoke all on function app.current_storage_actor_can_read_confirmed_booking_client_avatar(text)
  from public, anon, service_role;
grant execute on function app.current_storage_actor_can_read_confirmed_booking_client_avatar(text)
  to authenticated;

comment on function app.current_storage_actor_can_read_confirmed_booking_client_avatar(text) is
  'Allows a signed-in owning coach to read the current private avatar object for a confirmed direct booking client.';

drop policy if exists account_avatars_confirmed_booking_coach_select
  on storage.objects;
create policy account_avatars_confirmed_booking_coach_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'account-avatars'
    and app.current_storage_actor_can_read_confirmed_booking_client_avatar(name)
  );
