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

create schema if not exists app authorization app_owner;
alter schema app owner to app_owner;

revoke all on schema app from public, anon, authenticated, service_role;
grant usage on schema app to app_runtime;

create function app.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create table app.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null,
  slug text not null,
  display_name text not null,
  initials text not null,
  bio text not null default '',
  avatar_color text not null,
  record_source text not null,
  claimed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users (id) on delete restrict,
  constraint profiles_auth_user_id_key unique (auth_user_id),
  constraint profiles_slug_key unique (slug),
  constraint profiles_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint profiles_display_name_length_check
    check (char_length(display_name) between 2 and 80),
  constraint profiles_initials_length_check
    check (char_length(initials) between 1 and 4),
  constraint profiles_record_source_check
    check (record_source in ('fixture', 'user')),
  constraint profiles_claim_state_check
    check ((auth_user_id is null) = (claimed_at is null))
);

create table app.demo_runs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  status text not null,
  catalogue_visibility text not null,
  schedule_anchor_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  retired_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_runs_slug_key unique (slug),
  constraint demo_runs_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint demo_runs_status_check
    check (status in ('prepared', 'active', 'retired')),
  constraint demo_runs_catalogue_visibility_check
    check (catalogue_visibility in ('private', 'public')),
  constraint demo_runs_time_order_check check (ends_at > starts_at),
  constraint demo_runs_retired_state_check
    check ((status = 'retired') = (retired_at is not null))
);

create unique index demo_runs_one_active_public_idx
  on app.demo_runs (status, catalogue_visibility)
  where status = 'active' and catalogue_visibility = 'public';
create index demo_runs_status_visibility_idx
  on app.demo_runs (status, catalogue_visibility);

create table app.demo_run_memberships (
  run_id uuid not null,
  profile_id uuid not null,
  role text not null,
  status text not null,
  joined_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_run_memberships_pkey primary key (run_id, profile_id),
  constraint demo_run_memberships_run_id_fkey
    foreign key (run_id) references app.demo_runs (id) on delete restrict,
  constraint demo_run_memberships_profile_id_fkey
    foreign key (profile_id) references app.profiles (id) on delete restrict,
  constraint demo_run_memberships_role_check
    check (role in ('member', 'operator')),
  constraint demo_run_memberships_status_check
    check (status in ('active', 'revoked')),
  constraint demo_run_memberships_revoked_state_check
    check ((status = 'revoked') = (revoked_at is not null))
);

create index demo_run_memberships_profile_status_run_idx
  on app.demo_run_memberships (profile_id, status, run_id);

create table app.organizations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  slug text not null,
  name text not null,
  description text not null,
  kind text not null,
  status text not null,
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_run_id_fkey
    foreign key (run_id) references app.demo_runs (id) on delete restrict,
  constraint organizations_run_id_id_key unique (run_id, id),
  constraint organizations_run_id_slug_key unique (run_id, slug),
  constraint organizations_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_kind_check
    check (kind in ('gym', 'cafe', 'studio', 'community', 'sponsor')),
  constraint organizations_status_check
    check (status in ('active', 'inactive')),
  constraint organizations_record_source_check
    check (record_source in ('fixture', 'user'))
);

create index organizations_run_kind_status_idx
  on app.organizations (run_id, kind, status);

create table app.organization_memberships (
  run_id uuid not null,
  organization_id uuid not null,
  profile_id uuid not null,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint organization_memberships_pkey
    primary key (run_id, organization_id, profile_id),
  constraint organization_memberships_organization_fkey
    foreign key (run_id, organization_id)
    references app.organizations (run_id, id) on delete restrict,
  constraint organization_memberships_run_profile_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_memberships (run_id, profile_id) on delete restrict,
  constraint organization_memberships_role_check
    check (role in ('primary_admin', 'admin', 'member')),
  constraint organization_memberships_status_check
    check (status in ('active', 'revoked')),
  constraint organization_memberships_revoked_state_check
    check ((status = 'revoked') = (revoked_at is not null))
);

create index organization_memberships_run_profile_status_idx
  on app.organization_memberships (run_id, profile_id, status);

create table app.venues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  organization_id uuid not null,
  slug text not null,
  name text not null,
  area text not null,
  city text not null,
  country_code text not null,
  timezone text not null,
  description text not null,
  kind text not null,
  status text not null,
  record_source text not null,
  activity_tags text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_run_organization_fkey
    foreign key (run_id, organization_id)
    references app.organizations (run_id, id) on delete restrict,
  constraint venues_run_id_id_key unique (run_id, id),
  constraint venues_run_id_slug_key unique (run_id, slug),
  constraint venues_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint venues_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint venues_kind_check
    check (kind in ('gym', 'studio', 'cafe', 'outdoor', 'other')),
  constraint venues_status_check check (status in ('active', 'inactive')),
  constraint venues_record_source_check
    check (record_source in ('fixture', 'user')),
  constraint venues_activity_tags_check
    check (
      cardinality(activity_tags) > 0
      and activity_tags <@ array['Running', 'Strength', 'Muay Thai', 'Yoga']::text[]
    )
);

create index venues_run_kind_status_idx on app.venues (run_id, kind, status);
create index venues_activity_tags_idx on app.venues using gin (activity_tags);

create table app.venue_staff (
  run_id uuid not null,
  venue_id uuid not null,
  profile_id uuid not null,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz null,
  constraint venue_staff_pkey primary key (run_id, venue_id, profile_id),
  constraint venue_staff_run_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id) on delete restrict,
  constraint venue_staff_run_profile_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_memberships (run_id, profile_id) on delete restrict,
  constraint venue_staff_role_check
    check (role in ('manager', 'check_in_staff')),
  constraint venue_staff_status_check check (status in ('active', 'revoked')),
  constraint venue_staff_revoked_state_check
    check ((status = 'revoked') = (revoked_at is not null))
);

create index venue_staff_run_profile_status_idx
  on app.venue_staff (run_id, profile_id, status);

create table app.trainer_affiliations (
  run_id uuid not null,
  venue_id uuid not null,
  profile_id uuid not null,
  title text not null,
  activity_tags text[] not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_affiliations_pkey primary key (run_id, venue_id, profile_id),
  constraint trainer_affiliations_run_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id) on delete restrict,
  constraint trainer_affiliations_run_profile_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_memberships (run_id, profile_id) on delete restrict,
  constraint trainer_affiliations_activity_tags_check
    check (
      cardinality(activity_tags) > 0
      and activity_tags <@ array['Running', 'Strength', 'Muay Thai', 'Yoga']::text[]
    ),
  constraint trainer_affiliations_status_check
    check (status in ('active', 'inactive'))
);

create index trainer_affiliations_run_profile_status_idx
  on app.trainer_affiliations (run_id, profile_id, status);
create index trainer_affiliations_activity_tags_idx
  on app.trainer_affiliations using gin (activity_tags);

create table app.class_sessions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  venue_id uuid not null,
  trainer_profile_id uuid not null,
  slug text not null,
  title text not null,
  description text not null,
  discipline text not null,
  timezone text not null,
  currency_code text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null,
  price_base_units numeric(20, 0) not null,
  membership_eligible boolean not null,
  status text not null,
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_run_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id) on delete restrict,
  constraint class_sessions_trainer_affiliation_fkey
    foreign key (run_id, venue_id, trainer_profile_id)
    references app.trainer_affiliations (run_id, venue_id, profile_id)
    on delete restrict,
  constraint class_sessions_run_id_id_key unique (run_id, id),
  constraint class_sessions_run_id_slug_key unique (run_id, slug),
  constraint class_sessions_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint class_sessions_discipline_check
    check (discipline in ('Running', 'Strength', 'Muay Thai', 'Yoga')),
  constraint class_sessions_time_order_check check (ends_at > starts_at),
  constraint class_sessions_capacity_check check (capacity > 0),
  constraint class_sessions_price_check
    check (
      price_base_units >= 0
      and price_base_units <= 18446744073709551615
    ),
  constraint class_sessions_currency_code_check check (currency_code = 'EURC'),
  constraint class_sessions_status_check
    check (status in ('scheduled', 'cancelled')),
  constraint class_sessions_record_source_check
    check (record_source in ('fixture', 'user'))
);

create index class_sessions_run_starts_at_idx
  on app.class_sessions (run_id, starts_at);
create index class_sessions_run_venue_starts_at_idx
  on app.class_sessions (run_id, venue_id, starts_at);
create index class_sessions_run_discipline_starts_at_idx
  on app.class_sessions (run_id, discipline, starts_at);

create table app.membership_entitlements (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  venue_id uuid not null,
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null,
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_entitlements_run_profile_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_memberships (run_id, profile_id) on delete restrict,
  constraint membership_entitlements_run_venue_fkey
    foreign key (run_id, venue_id)
    references app.venues (run_id, id) on delete restrict,
  constraint membership_entitlements_run_id_id_key unique (run_id, id),
  constraint membership_entitlements_fixture_key
    unique (run_id, profile_id, venue_id, starts_at),
  constraint membership_entitlements_time_order_check check (ends_at > starts_at),
  constraint membership_entitlements_status_check
    check (status in ('active', 'revoked', 'expired')),
  constraint membership_entitlements_record_source_check
    check (record_source in ('fixture', 'user'))
);

create index membership_entitlements_lookup_idx
  on app.membership_entitlements (
    run_id,
    profile_id,
    venue_id,
    status,
    starts_at,
    ends_at
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'demo_runs',
    'demo_run_memberships',
    'organizations',
    'organization_memberships',
    'venues',
    'venue_staff',
    'trainer_affiliations',
    'class_sessions',
    'membership_entitlements'
  ]
  loop
    execute format(
      'create trigger %I before update on app.%I for each row execute function app.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
    execute format('alter table app.%I enable row level security', table_name);
    execute format('alter table app.%I force row level security', table_name);
    execute format('alter table app.%I owner to app_owner', table_name);
  end loop;
end
$$;

alter function app.set_updated_at() owner to app_owner;

revoke all on all tables in schema app from public, anon, authenticated, service_role;
revoke all on all functions in schema app from public, anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema app to app_runtime;
grant execute on function app.set_updated_at() to app_runtime;

alter default privileges for role app_owner in schema app
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role app_owner in schema app
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role app_owner in schema app
  grant select, insert, update, delete on tables to app_runtime;
