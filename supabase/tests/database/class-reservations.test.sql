begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(10);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'app'
      and table_name in (
        'membership_daily_access_claims',
        'class_reservations'
      )
  ),
  2,
  'reservation and daily-access claim tables exist'
);

select ok(
  (
    select bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'app'
      and c.relname in (
        'membership_daily_access_claims',
        'class_reservations'
      )
  ),
  'reservation tables enforce row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    join pg_roles as r on r.oid = c.relowner
    where n.nspname = 'app'
      and c.relname in (
        'membership_daily_access_claims',
        'class_reservations'
      )
      and r.rolname = 'app_owner'
  ),
  2,
  'app_owner owns both reservation tables'
);

select ok(
  not has_table_privilege(
    'app_runtime',
    'app.membership_daily_access_claims',
    'select'
  )
    and not has_table_privilege(
      'app_runtime',
      'app.class_reservations',
      'select'
    ),
  'runtime callers have no direct reservation table access'
);

select is(
  (
    select count(*)::integer
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in (
        'reconcile_member_class_reservations',
        'current_member_class_schedule',
        'reserve_member_class',
        'cancel_member_class_reservation'
      )
  ),
  4,
  'the bounded reservation functions exist'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.current_member_class_schedule()',
    'execute'
  )
    and has_function_privilege(
      'app_runtime',
      'app.reserve_member_class(uuid,uuid)',
      'execute'
    )
    and has_function_privilege(
      'app_runtime',
      'app.cancel_member_class_reservation(uuid)',
      'execute'
    ),
  'runtime callers may execute only the public reservation boundary'
);

select ok(
  not has_function_privilege(
    'app_runtime',
    'app.reconcile_member_class_reservations(uuid,uuid)',
    'execute'
  ),
  'runtime callers cannot invoke internal reconciliation directly'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'app'
      and indexname in (
        'membership_daily_access_claims_active_date_idx',
        'membership_daily_access_claims_member_history_idx',
        'class_reservations_one_active_member_session_idx',
        'class_reservations_session_capacity_idx',
        'class_reservations_member_history_idx'
      )
  ),
  5,
  'daily uniqueness, capacity and history indexes exist'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'membership_periods_run_id_id_profile_key'
  ),
  'daily claims bind to one member-owned membership period'
);

select ok(
  obj_description('app.membership_daily_access_claims'::regclass) is not null
    and obj_description('app.class_reservations'::regclass) is not null,
  'reservation relations document claim and attendance boundaries'
);

select * from finish();
rollback;
