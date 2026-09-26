begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(30);

select has_table('app', 'membership_products', 'product identities exist');
select has_table('app', 'membership_product_versions', 'versioned plan terms exist');
select has_table('app', 'participating_gyms', 'participating gym metadata exists');
select has_table(
  'app',
  'membership_product_gym_eligibility',
  'plan-to-gym eligibility exists'
);

select is(
  (
    select count(*)::integer
    from pg_class table_record
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    join pg_roles owner on owner.oid = table_record.relowner
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'membership_products',
        'membership_product_versions',
        'participating_gyms',
        'membership_product_gym_eligibility'
      )
      and owner.rolname = 'app_owner'
  ),
  4,
  'app_owner owns all catalogue tables'
);

select ok(
  (
    select bool_and(table_record.relrowsecurity)
    from pg_class table_record
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'membership_products',
        'membership_product_versions',
        'participating_gyms',
        'membership_product_gym_eligibility'
      )
  ),
  'catalogue tables enable RLS'
);

select ok(
  (
    select bool_and(table_record.relforcerowsecurity)
    from pg_class table_record
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'membership_products',
        'membership_product_versions',
        'participating_gyms',
        'membership_product_gym_eligibility'
      )
  ),
  'catalogue tables force RLS'
);

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) role_name
    cross join unnest(array[
      'app.membership_products',
      'app.membership_product_versions',
      'app.participating_gyms',
      'app.membership_product_gym_eligibility'
    ]) table_name
    where has_table_privilege(role_name, table_name, 'select')
  ),
  'browser-facing roles have no direct catalogue access'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'app'
      and tablename in (
        'membership_products',
        'membership_product_versions',
        'participating_gyms',
        'membership_product_gym_eligibility'
      )
      and 'app_runtime' = any(roles)
  ),
  4,
  'each catalogue table has one narrow runtime read policy'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'app.membership_products',
      'app.membership_product_versions',
      'app.participating_gyms',
      'app.membership_product_gym_eligibility'
    ]) table_name
    cross join unnest(array['insert', 'update', 'delete']) privilege_name
    where has_table_privilege('app_runtime', table_name, privilege_name)
  ),
  'app_runtime has no catalogue write privilege'
);

select has_function(
  'app',
  'enforce_membership_product_version_lifecycle',
  array[]::text[],
  'membership version lifecycle trigger function exists'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.enforce_membership_product_version_lifecycle()',
    'execute'
  )
    and not has_function_privilege(
      'anon',
      'app.enforce_membership_product_version_lifecycle()',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'app.enforce_membership_product_version_lifecycle()',
      'execute'
    ),
  'only the server runtime can invoke the lifecycle trigger path'
);

select is(
  (select count(*)::integer from app.membership_products),
  2,
  'Basic and Classic product identities are seeded'
);

select is(
  (select count(*)::integer from app.membership_product_versions),
  2,
  'Basic and Classic versions are seeded'
);

select is(
  (
    select count(*)::integer
    from app.membership_products
    where scope = 'platform'
      and organization_id is null
      and status = 'active'
      and slug in ('basic', 'classic')
  ),
  2,
  'current plans are platform products rather than gym-owned offers'
);

select is(
  (
    select count(*)::integer
    from app.membership_product_versions
    where status = 'published'
      and period_policy = 'calendar_month'
      and duration_seconds is null
      and max_included_checkins_per_day = 1
      and required_core_gym_count = 4
      and non_core_visit_price_base_units = 15000000
      and not transferable
      and transfer_fee_base_units = 0
      and minimum_hold_seconds = 0
      and minimum_remaining_transfer_seconds = 0
      and (
        (
          plan_code = 'basic'
          and name = 'Basic'
          and price_base_units = 80000000
          and access_model = 'limited'
          and included_checkins = 10
        )
        or (
          plan_code = 'classic'
          and name = 'Classic'
          and price_base_units = 150000000
          and access_model = 'daily_uncapped'
          and included_checkins is null
        )
      )
  ),
  2,
  'published plan terms match the frozen Basic and Classic contract'
);

select is(
  (select count(*)::integer from app.participating_gyms),
  7,
  'seven participating gym records are seeded'
);

select is(
  (
    select count(*)::integer
    from app.participating_gyms gym
    join app.venues venue
      on venue.run_id = gym.run_id and venue.id = gym.venue_id
    where venue.name in (
      'Northside Combat',
      'Fabrik Training',
      'Studio Vela',
      'Groundline MMA',
      'Kiezstrike Club',
      'Quiet Current Recovery',
      'Nightshift Athletic Club'
    )
  ),
  7,
  'the intended fictional preview gym names are represented exactly'
);

select ok(
  not exists (
    select 1
    from app.participating_gyms
    where cardinality(coach_names) = 0
      or char_length(map_label) < 2
      or char_length(map_address) < 5
      or map_latitude not between -90 and 90
      or map_longitude not between -180 and 180
  ),
  'every participating gym has complete illustrative discovery metadata'
);

select is(
  (
    select count(*)::integer
    from app.membership_product_gym_eligibility eligibility
    join app.membership_product_versions version
      on version.run_id = eligibility.run_id
      and version.product_id = eligibility.product_id
    where version.plan_code = 'basic'
      and version.status = 'published'
      and eligibility.status = 'active'
  ),
  5,
  'Basic is eligible at five preview gyms'
);

select is(
  (
    select count(*)::integer
    from app.membership_product_gym_eligibility eligibility
    join app.membership_product_versions version
      on version.run_id = eligibility.run_id
      and version.product_id = eligibility.product_id
    where version.plan_code = 'classic'
      and version.status = 'published'
      and eligibility.status = 'active'
  ),
  7,
  'Classic is eligible at all seven preview gyms'
);

select is(
  (
    select count(*)::integer
    from app.participating_gyms gym
    join app.venues venue
      on venue.run_id = gym.run_id and venue.id = gym.venue_id
    where not gym.supports_non_core_visit
      and venue.name = 'Nightshift Athletic Club'
  ),
  1,
  'Nightshift is the one preview gym without non-core visits'
);

select is(
  (
    select count(*)::integer
    from app.membership_products
    where slug in ('annual-unlimited', 'six-month-flex-12')
  ),
  0,
  'obsolete single-gym fixtures are absent from the active seed'
);

select is(
  (
    with expected(index_name) as (
      values
        ('membership_products_run_slug_key'),
        ('membership_product_versions_one_published_plan_code_idx'),
        ('participating_gyms_run_status_idx'),
        ('membership_product_gym_eligibility_run_venue_status_idx')
    )
    select count(*)::integer
    from expected
    left join pg_indexes
      on pg_indexes.schemaname = 'app'
      and pg_indexes.indexname = expected.index_name
    where pg_indexes.indexname is null
  ),
  0,
  'current catalogue lookup and uniqueness indexes exist'
);

select is(
  (
    with expected(constraint_name) as (
      values
        ('membership_products_scope_organization_check'),
        ('membership_product_versions_current_price_check'),
        ('membership_product_versions_access_terms_check'),
        ('membership_product_versions_lifecycle_check'),
        ('participating_gyms_venue_fkey'),
        ('membership_product_gym_eligibility_product_fkey'),
        ('membership_product_gym_eligibility_venue_fkey')
    )
    select count(*)::integer
    from expected
    left join pg_constraint
      on pg_constraint.conname = expected.constraint_name
    where pg_constraint.conname is null
  ),
  0,
  'scope, term, lifecycle and same-dataset constraints exist'
);

set local role app_runtime;
select set_config(
  'app.test_runtime_membership_catalogue_count',
  (
    (select count(*) from app.membership_products)
    + (select count(*) from app.membership_product_versions)
    + (select count(*) from app.participating_gyms)
    + (select count(*) from app.membership_product_gym_eligibility)
  )::text,
  true
);
select set_config(
  'app.test_runtime_public_run_count',
  (select count(*) from app.demo_runs)::text,
  true
);
select set_config(
  'app.test_runtime_catalogue_venue_count',
  (select count(*) from app.venues)::text,
  true
);
reset role;

select is(
  current_setting('app.test_runtime_membership_catalogue_count')::integer,
  23,
  'app_runtime sees only the seeded public product, version, gym and eligibility rows'
);

select is(
  current_setting('app.test_runtime_public_run_count')::integer,
  1,
  'app_runtime sees the active public catalogue run'
);

select is(
  current_setting('app.test_runtime_catalogue_venue_count')::integer,
  7,
  'app_runtime sees only active participating-gym venues'
);

select ok(
  obj_description('app.participating_gyms'::regclass, 'pg_class')
    like '%not a partnership%'
    and obj_description(
      'app.membership_product_gym_eligibility'::regclass,
      'pg_class'
    ) like '%not a member selection%',
  'table comments distinguish configuration from commercial and user state'
);

select ok(
  to_regclass('app.membership_entitlements') is null,
  'the catalogue migration does not create customer entitlements'
);

select * from finish();
rollback;
