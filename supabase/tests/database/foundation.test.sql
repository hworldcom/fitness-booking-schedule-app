begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(31);

select has_schema('app', 'app schema exists');

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'app'
      and table_type = 'BASE TABLE'
      and table_name in (
        'profiles',
        'demo_runs',
        'demo_run_participants',
        'organizations',
        'organization_memberships',
        'venues',
        'venue_staff',
        'trainer_affiliations',
        'class_sessions'
      )
  ),
  9,
  'app schema has exactly nine foundation tables'
);

select ok(
  to_regclass('app.demo_run_memberships') is null,
  'the ambiguous legacy dataset-membership relation is absent'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r'
  ),
  'RLS is enabled on every app table'
);

select ok(
  (
    select bool_and(c.relforcerowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r'
  ),
  'RLS is forced on every app table'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_roles r on r.oid = c.relowner
    where n.nspname = 'app'
      and c.relkind = 'r'
      and r.rolname = 'app_owner'
      and c.relname in (
        'profiles',
        'demo_runs',
        'demo_run_participants',
        'organizations',
        'organization_memberships',
        'venues',
        'venue_staff',
        'trainer_affiliations',
        'class_sessions'
      )
  ),
  9,
  'app_owner owns every foundation table'
);

select ok(
  exists (select 1 from pg_roles where rolname = 'app_owner'),
  'app_owner role exists'
);

select ok(
  exists (select 1 from pg_roles where rolname = 'app_runtime'),
  'app_runtime role exists'
);

select ok(
  (
    select not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolcanlogin and not rolbypassrls
    from pg_roles
    where rolname = 'app_owner'
  ),
  'app_owner has no login or elevated cluster privileges'
);

select ok(
  (
    select not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolcanlogin and not rolbypassrls
    from pg_roles
    where rolname = 'app_runtime'
  ),
  'app_runtime has no login or elevated cluster privileges'
);

select ok(
  has_schema_privilege('app_runtime', 'app', 'usage'),
  'app_runtime may use the private app schema'
);

select ok(
  not has_schema_privilege('anon', 'app', 'usage'),
  'anon cannot use the app schema'
);

select ok(
  not has_schema_privilege('authenticated', 'app', 'usage'),
  'authenticated cannot use the app schema directly'
);

select ok(
  not has_schema_privilege('service_role', 'app', 'usage'),
  'service_role cannot use the app schema directly'
);

select is(
  (
    select count(*)::integer
    from app.profiles
    where record_source = 'fixture'
  ),
  11,
  'eleven public fixture profiles are seeded without a prepared current user'
);
select is((select count(*)::integer from app.class_sessions), 42, 'forty-two classes are seeded');

select is(
  (select count(*)::integer from app.trainer_affiliations),
  9,
  'nine fictional trainer affiliations are seeded'
);

select is(
  (
    select count(*)::integer
    from (
      select gym.venue_id
      from app.participating_gyms as gym
      left join app.class_sessions as session
        on session.run_id = gym.run_id
        and session.venue_id = gym.venue_id
      group by gym.venue_id
      having count(session.id) <> 6
    ) as incorrect_venue
  ),
  0,
  'each participating gym has six seeded sessions'
);

select is(
  (
    select count(*)::integer
    from app.class_sessions as session
    join app.demo_runs as run on run.id = session.run_id
    left join app.trainer_affiliations as affiliation
      on affiliation.run_id = session.run_id
      and affiliation.venue_id = session.venue_id
      and affiliation.profile_id = session.trainer_profile_id
      and affiliation.status = 'active'
    where affiliation.profile_id is null
      or session.starts_at < run.starts_at
      or session.ends_at > run.ends_at
  ),
  0,
  'every session has an active same-venue trainer and stays inside the run window'
);

select ok(
  exists (
    select 1
    from app.class_sessions
    where (starts_at at time zone timezone)::time < time '09:00'
  )
    and exists (
      select 1
      from app.class_sessions
      where (starts_at at time zone timezone)::time between time '12:00' and time '13:59'
    )
    and exists (
      select 1
      from app.class_sessions
      where (starts_at at time zone timezone)::time >= time '18:00'
    )
    and exists (
      select 1
      from app.class_sessions
      where extract(isodow from starts_at at time zone timezone) in (6, 7)
    ),
  'the schedule covers morning, lunch, evening and weekend sessions'
);

select ok(
  (
    select count(*) = 2 and min(capacity) = 1 and max(capacity) = 1
    from app.class_sessions
    where discipline = 'Massage'
  )
    and (
      select count(*) = 4 and min(capacity) > 1
      from app.class_sessions
      where discipline = 'Wellness'
    ),
  'massage is capacity one while group recovery retains group capacity'
);
select ok(
  to_regclass('app.membership_entitlements') is null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'app'
        and table_name = 'class_sessions'
        and column_name = 'membership_eligible'
    ),
  'gym membership access is absent from the current schema'
);

select ok(
  not exists (
    select 1
    from app.profiles
    where record_source = 'fixture' and auth_user_id is not null
  ),
  'fixture profiles remain unclaimed'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'app'
      and indexname in (
        'class_sessions_run_starts_at_idx',
        'class_sessions_run_venue_starts_at_idx',
        'class_sessions_run_discipline_starts_at_idx'
      )
  ),
  3,
  'class schedule lookup indexes exist'
);

select ok(
  not exists (
    select 1
    from pg_constraint
    where conname like 'demo_run_memberships%'
  )
    and not exists (
      select 1
      from pg_indexes
      where schemaname = 'app'
        and indexname like 'demo_run_memberships%'
    )
    and not exists (
      select 1
      from pg_trigger
      where not tgisinternal
        and tgname like 'demo_run_memberships%'
    )
    and not exists (
      select 1
      from pg_policies
      where schemaname = 'app'
        and policyname like 'demo_run_memberships%'
    ),
  'participant-owned constraints, indexes, triggers and policies use the new name'
);

select ok(
  not exists (
    select 1
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'app'
      and routine.proname in (
        'current_application_identity',
        'enroll_application_identity',
        'authorized_actor_context_valid'
      )
      and pg_get_functiondef(routine.oid) like '%app.demo_run_memberships%'
  ),
  'current identity and actor functions contain no legacy relation reference'
);

select is(
  (
    with expected(table_name, column_count) as (
      values
        ('profiles', 11),
        ('demo_runs', 11),
        ('demo_run_participants', 8),
        ('organizations', 10),
        ('organization_memberships', 8),
        ('venues', 16),
        ('venue_staff', 8),
        ('trainer_affiliations', 8),
        ('class_sessions', 18)
    ),
    actual as (
      select table_name, count(*)::integer as column_count
      from information_schema.columns
      where table_schema = 'app'
        and table_name in (select expected.table_name from expected)
      group by table_name
    )
    select count(*)::integer
    from expected
    full join actual using (table_name, column_count)
    where expected.table_name is null or actual.table_name is null
  ),
  0,
  'every foundation table has its exact planned column count'
);

select is(
  (
    select count(*)::integer
    from pg_constraint constraint_record
    join pg_namespace namespace_record
      on namespace_record.oid = constraint_record.connamespace
    join pg_class table_record on table_record.oid = constraint_record.conrelid
    where namespace_record.nspname = 'app'
      and constraint_record.contype = 'f'
      and table_record.relname in (
        'profiles',
        'demo_runs',
        'demo_run_participants',
        'organizations',
        'organization_memberships',
        'venues',
        'venue_staff',
        'trainer_affiliations',
        'class_sessions'
      )
  ),
  13,
  'all thirteen foundation foreign keys exist'
);

select is(
  (
    select count(*)::integer
    from pg_trigger trigger_record
    join pg_class table_record on table_record.oid = trigger_record.tgrelid
    join pg_namespace namespace_record on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and not trigger_record.tgisinternal
      and trigger_record.tgname like '%_set_updated_at'
      and table_record.relname in (
        'profiles',
        'demo_runs',
        'demo_run_participants',
        'organizations',
        'organization_memberships',
        'venues',
        'venue_staff',
        'trainer_affiliations',
        'class_sessions'
      )
  ),
  9,
  'every foundation table maintains updated_at'
);

select is(
  (
    with expected(index_name) as (
      values
        ('demo_runs_one_active_public_idx'),
        ('demo_runs_status_visibility_idx'),
        ('demo_run_participants_profile_status_run_idx'),
        ('organizations_run_kind_status_idx'),
        ('organization_memberships_run_profile_status_idx'),
        ('venues_run_kind_status_idx'),
        ('venues_activity_tags_idx'),
        ('venue_staff_run_profile_status_idx'),
        ('trainer_affiliations_run_profile_status_idx'),
        ('trainer_affiliations_activity_tags_idx'),
        ('class_sessions_run_starts_at_idx'),
        ('class_sessions_run_venue_starts_at_idx'),
        ('class_sessions_run_discipline_starts_at_idx')
    )
    select count(*)::integer
    from expected
    left join pg_indexes
      on pg_indexes.schemaname = 'app'
      and pg_indexes.indexname = expected.index_name
    where pg_indexes.indexname is null
  ),
  0,
  'all required lookup and GIN indexes exist'
);

do $constraint_test$
begin
  begin
    insert into app.class_sessions (
      id, run_id, venue_id, trainer_profile_id, slug, title, description,
      discipline, timezone, currency_code, starts_at, ends_at, capacity,
      price_base_units, status, record_source
    )
    select
      gen_random_uuid(), run_id, venue_id, trainer_profile_id,
      'invalid-sql-test-price', title, description, discipline, timezone,
      currency_code, starts_at, ends_at, capacity, -1,
      status, record_source
    from app.class_sessions
    limit 1;
    raise exception 'negative class price was accepted';
  exception when check_violation then
    null;
  end;
end
$constraint_test$;

do $time_constraint_test$
begin
  begin
    insert into app.class_sessions (
      id, run_id, venue_id, trainer_profile_id, slug, title, description,
      discipline, timezone, currency_code, starts_at, ends_at, capacity,
      price_base_units, status, record_source
    )
    select
      gen_random_uuid(), run_id, venue_id, trainer_profile_id,
      'invalid-sql-test-time', title, description, discipline, timezone,
      currency_code, starts_at, starts_at, capacity, price_base_units,
      status, record_source
    from app.class_sessions
    limit 1;
    raise exception 'invalid class interval was accepted';
  exception when check_violation then
    null;
  end;
end
$time_constraint_test$;

do $activity_constraint_test$
begin
  begin
    insert into app.class_sessions (
      id, run_id, venue_id, trainer_profile_id, slug, title, description,
      discipline, timezone, currency_code, starts_at, ends_at, capacity,
      price_base_units, status, record_source
    )
    select
      gen_random_uuid(), run_id, venue_id, trainer_profile_id,
      'invalid-sql-test-activity', title, description, 'Parkour', timezone,
      currency_code, starts_at, ends_at, capacity, price_base_units,
      status, record_source
    from app.class_sessions
    limit 1;
    raise exception 'invalid class activity was accepted';
  exception when check_violation then
    null;
  end;
end
$activity_constraint_test$;

do $duplicate_constraint_test$
declare
  participant_record app.demo_run_participants%rowtype;
begin
  select * into participant_record from app.demo_run_participants limit 1;
  begin
    insert into app.demo_run_participants (
      run_id,
      profile_id,
      role,
      status,
      joined_at,
      revoked_at,
      created_at,
      updated_at
    )
    values (
      participant_record.run_id,
      participant_record.profile_id,
      participant_record.role,
      participant_record.status,
      participant_record.joined_at,
      participant_record.revoked_at,
      participant_record.created_at,
      participant_record.updated_at
    );
    raise exception 'duplicate run participant was accepted';
  exception when unique_violation then
    null;
  end;
end
$duplicate_constraint_test$;

do $cross_run_constraint_test$
declare
  original_run uuid := '20000000-0000-4000-8000-000000000001';
  other_run uuid := '90000000-0000-4000-8000-000000000001';
  other_organization uuid := '90000000-0000-4000-8000-000000000002';
begin
  insert into app.demo_runs (
    id, slug, name, status, catalogue_visibility, schedule_anchor_date,
    starts_at, ends_at
  )
  values (
    other_run, 'cross-run-test', 'Cross-run test', 'prepared', 'private',
    '2031-01-01', '2031-01-01T00:00:00Z', '2031-01-02T00:00:00Z'
  );

  insert into app.organizations (
    id, run_id, slug, name, description, kind, status, record_source
  )
  values (
    other_organization, other_run, 'cross-run-owner', 'Cross-run owner',
    'Constraint fixture', 'gym', 'active', 'fixture'
  );

  begin
    insert into app.venues (
      id, run_id, organization_id, slug, name, area, city, country_code,
      timezone, description, kind, status, record_source, activity_tags
    )
    values (
      gen_random_uuid(), original_run, other_organization,
      'invalid-cross-run-venue', 'Invalid cross-run venue', 'Kreuzberg',
      'Berlin', 'DE', 'Europe/Berlin', 'Must fail', 'gym', 'active',
      'fixture', array['Strength']
    );
    raise exception 'cross-run venue relationship was accepted';
  exception when foreign_key_violation then
    null;
  end;
end
$cross_run_constraint_test$;

set local role app_runtime;
select set_config(
  'app.test_runtime_profile_count',
  (select count(*)::text from app.profiles),
  true
);
reset role;
select is(
  current_setting('app.test_runtime_profile_count')::integer,
  0,
  'default-deny RLS hides profiles from app_runtime'
);

select * from finish();
rollback;
