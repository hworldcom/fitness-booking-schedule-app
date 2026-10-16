-- Add optional, owner-scoped account avatars and coach portraits. Image bytes
-- stay in Supabase Storage; application tables retain only bounded references.

alter table app.profiles
  add column avatar_storage_path text,
  add column avatar_updated_at timestamp with time zone,
  add constraint profiles_avatar_reference_check check (
    (
      avatar_storage_path is null
      and avatar_updated_at is null
    )
    or (
      avatar_storage_path is not null
      and avatar_updated_at is not null
      and avatar_storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      and pg_catalog.split_part(avatar_storage_path, '/', 1) = id::text
    )
  );

alter table app.coach_profiles
  add column portrait_source text,
  add column portrait_path text,
  add column portrait_updated_at timestamp with time zone,
  add constraint coach_profiles_portrait_reference_check check (
    (
      portrait_source is null
      and portrait_path is null
      and portrait_updated_at is null
    )
    or (
      portrait_source in ('fixture', 'storage')
      and portrait_path is not null
      and portrait_updated_at is not null
      and (
        (
          portrait_source = 'fixture'
          and record_source = 'fixture'
          and is_demo
          and portrait_path = pg_catalog.concat(
            '/images/coaches/',
            public_slug,
            '.webp'
          )
        )
        or (
          portrait_source = 'storage'
          and portrait_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
          and pg_catalog.split_part(portrait_path, '/', 1) = profile_id::text
        )
      )
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'account-avatars',
    'account-avatars',
    false,
    524288,
    array['image/webp']::text[]
  ),
  (
    'coach-portraits',
    'coach-portraits',
    true,
    524288,
    array['image/webp']::text[]
  )
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create function app.current_storage_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id
  from app.profiles as profile
  where profile.auth_user_id = (select auth.uid())
    and profile.record_source = 'user'
    and profile.claimed_at is not null
$$;

alter function app.current_storage_profile_id() owner to postgres;
revoke all on function app.current_storage_profile_id()
  from public, anon, service_role;
grant execute on function app.current_storage_profile_id() to authenticated;

create function app.current_storage_coach_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
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

alter function app.current_storage_coach_profile_id() owner to postgres;
revoke all on function app.current_storage_coach_profile_id()
  from public, anon, service_role;
grant execute on function app.current_storage_coach_profile_id()
  to authenticated;

drop policy if exists account_avatars_owner_insert on storage.objects;
create policy account_avatars_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'account-avatars'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and (storage.foldername(name))[1]
      = app.current_storage_profile_id()::text
  );

drop policy if exists account_avatars_owner_select on storage.objects;
create policy account_avatars_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'account-avatars'
    and (storage.foldername(name))[1]
      = app.current_storage_profile_id()::text
  );

drop policy if exists account_avatars_owner_delete on storage.objects;
create policy account_avatars_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'account-avatars'
    and (storage.foldername(name))[1]
      = app.current_storage_profile_id()::text
  );

drop policy if exists coach_portraits_owner_insert on storage.objects;
create policy coach_portraits_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'coach-portraits'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and (storage.foldername(name))[1]
      = app.current_storage_coach_profile_id()::text
  );

drop policy if exists coach_portraits_owner_select on storage.objects;
create policy coach_portraits_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'coach-portraits'
    and (storage.foldername(name))[1]
      = app.current_storage_coach_profile_id()::text
  );

drop policy if exists coach_portraits_owner_delete on storage.objects;
create policy coach_portraits_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'coach-portraits'
    and (storage.foldername(name))[1]
      = app.current_storage_coach_profile_id()::text
  );

create policy profiles_profile_media_management_select
  on app.profiles
  for select
  to app_owner
  using (pg_catalog.current_setting('app.profile_media_management', true) = 'on');

create policy profiles_profile_media_management_update
  on app.profiles
  for update
  to app_owner
  using (pg_catalog.current_setting('app.profile_media_management', true) = 'on')
  with check (pg_catalog.current_setting('app.profile_media_management', true) = 'on');

create function app.set_current_account_avatar_reference(
  requested_path text,
  expected_path text
)
returns table (
  previous_path text,
  media_updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

alter function app.set_current_account_avatar_reference(text, text)
  owner to app_owner;
revoke all on function app.set_current_account_avatar_reference(text, text)
  from public, anon, authenticated, service_role;
grant execute on function app.set_current_account_avatar_reference(text, text)
  to app_runtime;

create function app.set_current_coach_portrait_reference(
  requested_path text,
  expected_source text,
  expected_path text
)
returns table (
  previous_source text,
  previous_path text,
  media_updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
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
  left join app.coach_applications as application
    on application.profile_id = coach.profile_id
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and (
      coach.is_demo
      or application.status = 'approved'
    )
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
$$;

alter function app.set_current_coach_portrait_reference(text, text, text)
  owner to app_owner;
revoke all on function app.set_current_coach_portrait_reference(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function app.set_current_coach_portrait_reference(text, text, text)
  to app_runtime;

comment on column app.profiles.avatar_storage_path is
  'Private canonical account-avatar object path in the account-avatars bucket.';
comment on column app.coach_profiles.portrait_source is
  'Optional public portrait source: a checked-in fictional fixture or owner-uploaded Storage object.';
comment on function app.set_current_account_avatar_reference(text, text) is
  'Compare-and-swap attachment/removal for the authorized actor private account-avatar reference.';
comment on function app.set_current_coach_portrait_reference(text, text, text) is
  'Compare-and-swap attachment/removal for an approved or demo coach public portrait reference.';
