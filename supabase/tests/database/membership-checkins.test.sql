begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select is(
  (
    select count(*)::integer
    from information_schema.tables
    where table_schema = 'app'
      and table_name in (
        'membership_arrival_requests',
        'membership_checkins'
      )
  ),
  2,
  'arrival request and immutable attendance tables exist'
);

select ok(
  (
    select bool_and(c.relrowsecurity and c.relforcerowsecurity)
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'app'
      and c.relname in (
        'membership_arrival_requests',
        'membership_checkins'
      )
  ),
  'check-in tables force row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    join pg_roles as r on r.oid = c.relowner
    where n.nspname = 'app'
      and c.relname in (
        'membership_arrival_requests',
        'membership_checkins'
      )
      and r.rolname = 'app_owner'
  ),
  2,
  'app_owner owns both check-in tables'
);

select ok(
  not has_table_privilege(
    'app_runtime',
    'app.membership_arrival_requests',
    'select'
  )
    and not has_table_privilege(
      'app_runtime',
      'app.membership_checkins',
      'select'
    ),
  'runtime callers have no direct check-in table access'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'app'
      and table_name = 'membership_arrival_requests'
      and column_name in ('code_hash', 'presentation_code', 'raw_code')
  ),
  1,
  'arrival persistence stores the code hash and no raw presentation code'
);

select is(
  (
    select count(*)::integer
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and p.proname in (
        'reconcile_member_arrival_requests',
        'current_member_checkin_snapshot',
        'create_member_arrival_request',
        'cancel_member_arrival_request',
        'confirm_member_arrival'
      )
  ),
  5,
  'the bounded arrival and attendance functions exist'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.current_member_checkin_snapshot()',
    'execute'
  )
    and has_function_privilege(
      'app_runtime',
      'app.create_member_arrival_request(uuid,uuid,uuid,text)',
      'execute'
    )
    and has_function_privilege(
      'app_runtime',
      'app.cancel_member_arrival_request(uuid)',
      'execute'
    )
    and has_function_privilege(
      'app_runtime',
      'app.confirm_member_arrival(text)',
      'execute'
    ),
  'runtime callers may execute the bounded check-in boundary'
);

select ok(
  not has_function_privilege(
    'app_runtime',
    'app.reconcile_member_arrival_requests(uuid,uuid)',
    'execute'
  )
    and not has_function_privilege(
      'app_runtime',
      'app.enforce_membership_arrival_request_update()',
      'execute'
    )
    and not has_function_privilege(
      'app_runtime',
      'app.reject_membership_checkin_update()',
      'execute'
    ),
  'runtime callers cannot invoke reconciliation or trigger helpers'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'app'
      and indexname in (
        'membership_arrival_requests_one_pending_member_idx',
        'membership_arrival_requests_one_active_claim_idx',
        'membership_arrival_requests_member_history_idx',
        'membership_checkins_member_history_idx',
        'membership_checkins_venue_history_idx'
      )
  ),
  5,
  'pending, claim and private history indexes exist'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'membership_checkins_claim_key'
  )
    and exists (
      select 1
      from pg_constraint
      where conname = 'membership_checkins_arrival_key'
    )
    and exists (
      select 1
      from pg_constraint
      where conname = 'membership_checkins_reservation_key'
    ),
  'attendance is unique per claim, arrival and optional reservation'
);

select is(
  (
    select count(*)::integer
    from information_schema.triggers
    where event_object_schema = 'app'
      and trigger_name in (
        'membership_arrival_requests_guard',
        'membership_checkins_guard'
      )
  ),
  2,
  'arrival transitions and attendance immutability are trigger guarded'
);

select ok(
  obj_description('app.membership_arrival_requests'::regclass) is not null
    and obj_description('app.membership_checkins'::regclass) is not null,
  'check-in relations document privacy and evidence boundaries'
);

select * from finish();
rollback;
