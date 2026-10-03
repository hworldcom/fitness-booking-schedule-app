-- Add the deliberately small coach-led social layer: one-way follows and
-- bounded text posts. Identity is always derived from the verified actor
-- context; the browser never chooses the acting profile or demo run.

create table app.coach_follows (
  run_id uuid not null,
  follower_profile_id uuid not null,
  coach_profile_id uuid not null,
  created_at timestamptz not null default now(),
  constraint coach_follows_pkey
    primary key (run_id, follower_profile_id, coach_profile_id),
  constraint coach_follows_follower_fkey
    foreign key (run_id, follower_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_follows_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_follows_no_self_follow_check
    check (follower_profile_id <> coach_profile_id)
);

create table app.coach_posts (
  run_id uuid not null,
  id uuid not null default gen_random_uuid(),
  coach_profile_id uuid not null,
  body text not null,
  visibility text not null default 'visible',
  published_at timestamptz not null default now(),
  record_source text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_posts_pkey primary key (run_id, id),
  constraint coach_posts_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_posts_body_length_check
    check (char_length(body) between 1 and 500),
  constraint coach_posts_body_normalized_check
    check (body = btrim(regexp_replace(body, '[[:space:]]+', ' ', 'g'))),
  constraint coach_posts_visibility_check
    check (visibility in ('visible', 'hidden')),
  constraint coach_posts_record_source_check
    check (record_source in ('fixture', 'user'))
);

create index coach_follows_following_lookup_idx
  on app.coach_follows (run_id, follower_profile_id, coach_profile_id);
create index coach_follows_coach_lookup_idx
  on app.coach_follows (run_id, coach_profile_id, follower_profile_id);
create index coach_posts_public_feed_idx
  on app.coach_posts (published_at desc, id desc)
  where visibility = 'visible';
create index coach_posts_coach_feed_idx
  on app.coach_posts (
    run_id,
    coach_profile_id,
    visibility,
    published_at desc,
    id desc
  );

create trigger coach_posts_set_updated_at
before update on app.coach_posts
for each row execute function app.set_updated_at();

alter table app.coach_follows enable row level security;
alter table app.coach_follows force row level security;
alter table app.coach_posts enable row level security;
alter table app.coach_posts force row level security;
alter table app.coach_follows owner to app_owner;
alter table app.coach_posts owner to app_owner;

revoke all on app.coach_follows, app.coach_posts
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_follows, app.coach_posts
  from app_runtime;
grant select on app.coach_follows, app.coach_posts to app_runtime;

create policy coach_profiles_social_management_select
  on app.coach_profiles
  for select
  to app_owner
  using (current_setting('app.coach_social_management', true) = 'on');

create policy coach_follows_management_all
  on app.coach_follows
  for all
  to app_owner
  using (current_setting('app.coach_social_management', true) = 'on')
  with check (current_setting('app.coach_social_management', true) = 'on');

create policy coach_posts_management_all
  on app.coach_posts
  for all
  to app_owner
  using (current_setting('app.coach_social_management', true) = 'on')
  with check (current_setting('app.coach_social_management', true) = 'on');

create policy coach_follows_owner_select
  on app.coach_follows
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(follower_profile_id, run_id, null)
  );

create policy coach_posts_public_select
  on app.coach_posts
  for select
  to app_runtime
  using (
    visibility = 'visible'
    and exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = coach_posts.run_id
        and coach.profile_id = coach_posts.coach_profile_id
        and coach.visibility = 'visible'
    )
  );

create policy coach_posts_owner_select
  on app.coach_posts
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(coach_profile_id, run_id, null)
  );

create function app.set_owned_coach_follow(
  requested_coach_profile_id uuid,
  requested_following boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

create function app.create_owned_coach_post(requested_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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

create function app.set_owned_coach_post_visibility(
  requested_post_id uuid,
  requested_visibility text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
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

alter function app.set_owned_coach_follow(uuid, boolean) owner to app_owner;
alter function app.create_owned_coach_post(text) owner to app_owner;
alter function app.set_owned_coach_post_visibility(uuid, text)
  owner to app_owner;

revoke all on function app.set_owned_coach_follow(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function app.create_owned_coach_post(text)
  from public, anon, authenticated, service_role;
revoke all on function app.set_owned_coach_post_visibility(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function app.set_owned_coach_follow(uuid, boolean)
  to app_runtime;
grant execute on function app.create_owned_coach_post(text)
  to app_runtime;
grant execute on function app.set_owned_coach_post_visibility(uuid, text)
  to app_runtime;
