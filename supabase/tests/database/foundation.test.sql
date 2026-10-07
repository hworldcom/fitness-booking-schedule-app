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
  ),
  20,
  'app retains all current and historical migration tables'
);

select ok(
  not exists (
    select 1
    from information_schema.tables
    where table_schema = 'app'
      and table_name = any (array[
        'organizations',
        'organization_memberships',
        'organization_wallet_authorities',
        'venues',
        'venue_staff',
        'trainer_affiliations',
        'class_sessions',
        'participating_gyms',
        'membership_products',
        'membership_product_versions',
        'membership_product_gym_eligibility',
        'membership_activation_operations',
        'membership_activation_operation_gyms',
        'membership_periods',
        'membership_period_core_gyms',
        'membership_daily_access_claims',
        'class_reservations',
        'membership_arrival_requests',
        'membership_checkins'
      ])
  ),
  'legacy organization, membership, class and check-in tables are absent'
);

select ok(
  not exists (
    select 1
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'app'
      and (
        routine.proname like '%membership%'
        or routine.proname like '%member_class%'
        or routine.proname like '%member_arrival%'
        or routine.proname like '%club_wallet%'
        or routine.proname in (
          'reserve_member_class',
          'cancel_member_class_reservation',
          'create_member_arrival_request',
          'cancel_member_arrival_request',
          'confirm_member_arrival'
        )
      )
  ),
  'legacy membership, class, arrival and club-wallet functions are absent'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'app'
      and table_name in ('auth_challenges', 'wallet_bindings')
      and column_name in ('owner_type', 'organization_id', 'auth_session_id')
  ),
  'personal wallet tables contain no organization authority columns'
);

select ok(
  (
    select bool_and(c.relrowsecurity)
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r'
  ),
  'RLS is enabled on every app table'
);

select ok(
  (
    select bool_and(c.relforcerowsecurity)
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'app' and c.relkind = 'r'
  ),
  'RLS is forced on every app table'
);

select is(
  (
    select count(*)::integer
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    join pg_roles as r on r.oid = c.relowner
    where n.nspname = 'app'
      and c.relkind = 'r'
      and r.rolname = 'app_owner'
  ),
  20,
  'app_owner owns every app table'
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
  (select count(*)::integer from app.profiles where record_source = 'fixture'),
  11,
  'eleven fictional fixture profiles remain available'
);

select is(
  (select count(*)::integer from app.gyms where record_source = 'fixture'),
  7,
  'seven fictional public gym locations are seeded'
);

select ok(
  not exists (
    select 1
    from app.gyms
    where latitude not between -90 and 90
      or longitude not between -180 and 180
      or char_length(public_location_label) not between 2 and 240
      or location_source <> 'fixture'
      or location_provider is not null
      or location_confirmed_at is null
  ),
  'seeded gyms have bounded provider-neutral fixture locations'
);

select ok(
  (
    select array_agg(id order by id) = array[
      '40000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid,
      '40000000-0000-4000-8000-000000000003'::uuid,
      '40000000-0000-4000-8000-000000000005'::uuid,
      '40000000-0000-4000-8000-000000000006'::uuid,
      '40000000-0000-4000-8000-000000000007'::uuid,
      '40000000-0000-4000-8000-000000000008'::uuid
    ]
    from app.gyms
  ),
  'gym locations preserve the eligible legacy venue identifiers'
);

select ok(
  not exists (select 1 from app.gyms where slug = 'sunday-coffee'),
  'the non-gym cafe fixture is not preserved as a gym'
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
    with expected(table_name, column_count) as (
      values
        ('profiles', 12),
        ('demo_runs', 11),
        ('demo_run_participants', 8),
        ('gyms', 19)
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
  'foundation tables match the planned column counts'
);

select is(
  (
    select count(*)::integer
    from pg_constraint as constraint_record
    join pg_namespace as namespace_record
      on namespace_record.oid = constraint_record.connamespace
    join pg_class as table_record on table_record.oid = constraint_record.conrelid
    where namespace_record.nspname = 'app'
      and constraint_record.contype = 'f'
      and table_record.relname in (
        'profiles',
        'demo_runs',
        'demo_run_participants',
        'gyms'
      )
  ),
  4,
  'foundation tables retain exactly four foreign keys'
);

select is(
  (
    select count(*)::integer
    from pg_trigger as trigger_record
    join pg_class as table_record on table_record.oid = trigger_record.tgrelid
    join pg_namespace as namespace_record on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and not trigger_record.tgisinternal
      and trigger_record.tgname like '%_set_updated_at'
      and table_record.relname in (
        'profiles',
        'demo_runs',
        'demo_run_participants',
        'gyms'
      )
  ),
  4,
  'every foundation table maintains updated_at'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'app'
      and indexname in ('gyms_run_status_name_idx', 'gyms_run_city_area_idx')
  ),
  2,
  'gym status/name and city/area lookup indexes exist'
);

select is(
  (
    select count(*)::integer
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'app'
      and routine.proname in (
        'current_personal_wallet_binding',
        'issue_personal_wallet_challenge',
        'complete_personal_wallet_challenge',
        'unlink_personal_wallet'
      )
  ),
  4,
  'all personal wallet functions remain installed'
);

select ok(
  not exists (
    select 1
    from pg_proc as routine
    join pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'app'
      and routine.proname in (
        'current_personal_wallet_binding',
        'issue_personal_wallet_challenge',
        'complete_personal_wallet_challenge',
        'unlink_personal_wallet'
      )
      and (
        pg_get_functiondef(routine.oid) like '%owner_type%'
        or pg_get_functiondef(routine.oid) like '%organization_id%'
        or pg_get_functiondef(routine.oid) like '%authorize-club-wallet%'
      )
  ),
  'personal wallet functions contain no organization authority branch'
);

select ok(
  (
    select array_agg(column_name::text order by ordinal_position) = array[
      'id', 'run_id', 'auth_user_id', 'profile_id', 'purpose', 'cluster',
      'wallet_address', 'origin', 'message_version', 'nonce_hash',
      'message_hash', 'issued_at', 'expires_at', 'consumed_at',
      'consumed_result', 'created_at', 'updated_at'
    ]
    from information_schema.columns
    where table_schema = 'app' and table_name = 'auth_challenges'
  ),
  'auth challenges have the personal-only column contract'
);

select ok(
  (
    select array_agg(column_name::text order by ordinal_position) = array[
      'id', 'run_id', 'cluster', 'wallet_address', 'profile_id',
      'bound_by_auth_user_id', 'provenance', 'status', 'verified_at',
      'revoked_at', 'created_at', 'updated_at', 'verified_by_challenge_id',
      'reauthenticated_at', 'revocation_reason', 'replacement_binding_id'
    ]
    from information_schema.columns
    where table_schema = 'app' and table_name = 'wallet_bindings'
  ),
  'wallet bindings have the personal-only column contract'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'gyms'
      and policyname = 'gyms_public_discovery_select'
  )
    and exists (
      select 1
      from pg_policies
      where schemaname = 'app'
        and tablename = 'demo_runs'
        and policyname = 'demo_runs_public_discovery_select'
    ),
  'public discovery policies cover active gyms and their demo run'
);

do $gym_coordinate_constraint$
begin
  begin
    insert into app.gyms (
      id, run_id, slug, name, description, public_location_label,
      area, city, country_code, timezone, latitude, longitude,
      location_source, location_provider, location_confirmed_at,
      status, record_source
    )
    select
      gen_random_uuid(), run_id, 'invalid-latitude', name, description,
      public_location_label, area, city, country_code, timezone,
      91, longitude, location_source, location_provider,
      location_confirmed_at, status, record_source
    from app.gyms
    limit 1;
    raise exception 'out-of-range gym latitude was accepted';
  exception when check_violation then
    null;
  end;
end
$gym_coordinate_constraint$;

do $gym_provenance_constraint$
begin
  begin
    insert into app.gyms (
      id, run_id, slug, name, description, public_location_label,
      area, city, country_code, timezone, latitude, longitude,
      location_source, location_provider, location_confirmed_at,
      status, record_source
    )
    select
      gen_random_uuid(), run_id, 'invalid-provider', name, description,
      public_location_label, area, city, country_code, timezone,
      latitude, longitude, 'permanent-geocoding', null,
      location_confirmed_at, status, record_source
    from app.gyms
    limit 1;
    raise exception 'provider-backed gym location without a provider was accepted';
  exception when check_violation then
    null;
  end;
end
$gym_provenance_constraint$;

do $runtime_write_constraint$
begin
  begin
    set local role app_runtime;
    insert into app.gyms (id) values (gen_random_uuid());
    raise exception 'app_runtime inserted a gym directly';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end
$runtime_write_constraint$;

select * from finish();
rollback;
