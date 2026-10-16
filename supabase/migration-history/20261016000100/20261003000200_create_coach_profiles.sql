-- Add the coach-first discovery identity without reintroducing gym authority.
-- A coach profile is a self-declared product role; demo-run roles continue to
-- authorize dataset access only.

create table app.coach_profiles (
  run_id uuid not null,
  profile_id uuid not null,
  public_slug text not null,
  display_name text not null,
  bio text not null,
  service_mode text not null default 'private-training',
  timezone text not null,
  selected_gym_id uuid null,
  location_kind text not null,
  public_location_label text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  location_source text not null,
  location_provider text null,
  location_confirmed_at timestamptz not null,
  visibility text not null default 'hidden',
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_profiles_pkey primary key (run_id, profile_id),
  constraint coach_profiles_run_profile_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_profiles_run_gym_fkey
    foreign key (run_id, selected_gym_id)
    references app.gyms (run_id, id)
    on delete restrict,
  constraint coach_profiles_run_slug_key unique (run_id, public_slug),
  constraint coach_profiles_slug_format_check
    check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint coach_profiles_display_name_length_check
    check (char_length(display_name) between 2 and 80),
  constraint coach_profiles_bio_length_check
    check (char_length(bio) between 40 and 1200),
  constraint coach_profiles_service_mode_check
    check (service_mode = 'private-training'),
  constraint coach_profiles_timezone_format_check
    check (
      timezone = 'UTC'
      or timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
    ),
  constraint coach_profiles_location_kind_check
    check (location_kind in ('gym', 'independent')),
  constraint coach_profiles_gym_location_check
    check (
      (location_kind = 'gym' and selected_gym_id is not null)
      or (location_kind = 'independent' and selected_gym_id is null)
    ),
  constraint coach_profiles_location_label_length_check
    check (char_length(public_location_label) between 2 and 240),
  constraint coach_profiles_latitude_check check (latitude between -90 and 90),
  constraint coach_profiles_longitude_check check (longitude between -180 and 180),
  constraint coach_profiles_location_source_check
    check (location_source in ('fixture', 'manual', 'permanent-geocoding')),
  constraint coach_profiles_location_provider_check
    check (
      location_provider is null
      or (
        char_length(location_provider) between 2 and 40
        and location_provider ~ '^[a-z0-9-]+$'
      )
    ),
  constraint coach_profiles_location_provenance_check
    check (
      (location_source in ('fixture', 'manual') and location_provider is null)
      or (
        location_source = 'permanent-geocoding'
        and location_provider is not null
      )
    ),
  constraint coach_profiles_visibility_check
    check (visibility in ('visible', 'hidden')),
  constraint coach_profiles_record_source_check
    check (record_source in ('fixture', 'user'))
);

create table app.coach_profile_disciplines (
  run_id uuid not null,
  profile_id uuid not null,
  discipline text not null,
  sort_order smallint not null,
  created_at timestamptz not null default now(),
  constraint coach_profile_disciplines_pkey
    primary key (run_id, profile_id, discipline),
  constraint coach_profile_disciplines_coach_fkey
    foreign key (run_id, profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_profile_disciplines_sort_key
    unique (run_id, profile_id, sort_order),
  constraint coach_profile_disciplines_value_check
    check (
      discipline in (
        'Boxing',
        'Muay Thai',
        'Kickboxing',
        'Brazilian Jiu-Jitsu',
        'MMA',
        'Wrestling'
      )
    ),
  constraint coach_profile_disciplines_sort_order_check
    check (sort_order between 1 and 4)
);

create index coach_profiles_run_visibility_name_idx
  on app.coach_profiles (run_id, visibility, display_name, profile_id);
create index coach_profiles_run_gym_visibility_idx
  on app.coach_profiles (run_id, selected_gym_id, visibility);
create index coach_profiles_location_idx
  on app.coach_profiles (latitude, longitude)
  where visibility = 'visible';
create index coach_profile_disciplines_lookup_idx
  on app.coach_profile_disciplines (run_id, discipline, profile_id);

create trigger coach_profiles_set_updated_at
before update on app.coach_profiles
for each row execute function app.set_updated_at();

alter table app.coach_profiles enable row level security;
alter table app.coach_profiles force row level security;
alter table app.coach_profile_disciplines enable row level security;
alter table app.coach_profile_disciplines force row level security;
alter table app.coach_profiles owner to app_owner;
alter table app.coach_profile_disciplines owner to app_owner;

revoke all on app.coach_profiles from public, anon, authenticated, service_role;
revoke all on app.coach_profile_disciplines
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_profiles from app_runtime;
revoke insert, update, delete on app.coach_profile_disciplines from app_runtime;
grant select on app.coach_profiles, app.coach_profile_disciplines
  to app_runtime;

create policy profiles_coach_profile_management_select
  on app.profiles
  for select
  to app_owner
  using (current_setting('app.coach_profile_management', true) = 'on');

create policy gyms_coach_profile_management_select
  on app.gyms
  for select
  to app_owner
  using (current_setting('app.coach_profile_management', true) = 'on');

create policy coach_profiles_management_all
  on app.coach_profiles
  for all
  to app_owner
  using (current_setting('app.coach_profile_management', true) = 'on')
  with check (current_setting('app.coach_profile_management', true) = 'on');

create policy coach_profile_disciplines_management_all
  on app.coach_profile_disciplines
  for all
  to app_owner
  using (current_setting('app.coach_profile_management', true) = 'on')
  with check (current_setting('app.coach_profile_management', true) = 'on');

create policy coach_profiles_public_discovery_select
  on app.coach_profiles
  for select
  to app_runtime
  using (
    visibility = 'visible'
    and location_confirmed_at is not null
    and exists (
      select 1
      from app.demo_runs as run
      where run.id = coach_profiles.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
    and (
      selected_gym_id is null
      or exists (
        select 1
        from app.gyms as gym
        where gym.run_id = coach_profiles.run_id
          and gym.id = coach_profiles.selected_gym_id
          and gym.status = 'active'
      )
    )
  );

create policy coach_profiles_owner_select
  on app.coach_profiles
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, run_id, null));

create policy coach_profile_disciplines_public_select
  on app.coach_profile_disciplines
  for select
  to app_runtime
  using (
    exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = coach_profile_disciplines.run_id
        and coach.profile_id = coach_profile_disciplines.profile_id
        and coach.visibility = 'visible'
    )
  );

create policy coach_profile_disciplines_owner_select
  on app.coach_profile_disciplines
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, run_id, null));

create function app.upsert_owned_coach_profile(
  requested_display_name text,
  requested_bio text,
  requested_disciplines text[],
  requested_timezone text,
  requested_visibility text,
  requested_gym_id uuid,
  requested_public_location_label text,
  requested_latitude numeric,
  requested_longitude numeric,
  requested_location_source text,
  requested_location_provider text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

alter function app.upsert_owned_coach_profile(
  text,
  text,
  text[],
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) owner to app_owner;

revoke all on function app.upsert_owned_coach_profile(
  text,
  text,
  text[],
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function app.upsert_owned_coach_profile(
  text,
  text,
  text[],
  text,
  text,
  uuid,
  text,
  numeric,
  numeric,
  text,
  text
) to app_runtime;

comment on table app.coach_profiles is
  'Self-declared coach discovery profiles with one confirmed public training location; selected gyms are labels/coordinates only and grant no authority.';
comment on column app.coach_profiles.public_location_label is
  'Coach-confirmed public discovery label, not live location or proof of current presence.';
comment on column app.coach_profiles.location_provider is
  'Optional provider provenance only; public rendering is provider-neutral.';
