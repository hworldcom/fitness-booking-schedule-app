begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(21);

select has_table(
  'app',
  'membership_activation_operations',
  'activation operation table exists'
);
select has_table(
  'app',
  'membership_activation_operation_gyms',
  'activation gym snapshot table exists'
);
select has_table(
  'app',
  'membership_periods',
  'membership period table exists'
);
select has_table(
  'app',
  'membership_period_core_gyms',
  'period core-gym snapshot table exists'
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
        'membership_activation_operations',
        'membership_activation_operation_gyms',
        'membership_periods',
        'membership_period_core_gyms'
      )
      and owner.rolname = 'app_owner'
  ),
  4,
  'app_owner owns all activation and period tables'
);

select ok(
  (
    select bool_and(table_record.relrowsecurity)
    from pg_class table_record
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'membership_activation_operations',
        'membership_activation_operation_gyms',
        'membership_periods',
        'membership_period_core_gyms'
      )
  ),
  'activation and period tables enable row-level security'
);

select ok(
  (
    select bool_and(table_record.relforcerowsecurity)
    from pg_class table_record
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'membership_activation_operations',
        'membership_activation_operation_gyms',
        'membership_periods',
        'membership_period_core_gyms'
      )
  ),
  'activation and period tables force row-level security'
);

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) role_name
    cross join unnest(array[
      'app.membership_activation_operations',
      'app.membership_activation_operation_gyms',
      'app.membership_periods',
      'app.membership_period_core_gyms'
    ]) table_name
    cross join unnest(array['select', 'insert', 'update', 'delete']) privilege_name
    where has_table_privilege(role_name, table_name, privilege_name)
  ),
  'browser-facing roles have no activation or period table privileges'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'app.membership_activation_operations',
      'app.membership_activation_operation_gyms',
      'app.membership_periods',
      'app.membership_period_core_gyms'
    ]) table_name
    cross join unnest(array['select', 'insert', 'update', 'delete']) privilege_name
    where has_table_privilege('app_runtime', table_name, privilege_name)
  ),
  'app_runtime cannot bypass bounded functions with direct table access'
);

select has_function(
  'app',
  'prepare_membership_activation',
  array['uuid', 'text', 'text[]'],
  'prepare activation function exists'
);
select has_function(
  'app',
  'record_membership_activation_submission',
  array['uuid', 'text', 'text', 'text'],
  'submission recording function exists'
);
select has_function(
  'app',
  'fail_membership_activation',
  array['uuid', 'text'],
  'failure function exists'
);
select has_function(
  'app',
  'complete_verified_membership_activation',
  array['uuid', 'text', 'text', 'text', 'numeric'],
  'verified completion function exists'
);
select has_function(
  'app',
  'current_membership_state',
  array[]::text[],
  'bounded member read function exists'
);

select ok(
  (
    select bool_and(
      has_function_privilege('app_runtime', function_signature, 'execute')
    )
    from unnest(array[
      'app.prepare_membership_activation(uuid,text,text[])',
      'app.record_membership_activation_submission(uuid,text,text,text)',
      'app.fail_membership_activation(uuid,text)',
      'app.complete_verified_membership_activation(uuid,text,text,text,numeric)',
      'app.current_membership_state()'
    ]) function_signature
  ),
  'app_runtime can execute only the bounded activation API'
);

select ok(
  not exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) role_name
    cross join unnest(array[
      'app.prepare_membership_activation(uuid,text,text[])',
      'app.record_membership_activation_submission(uuid,text,text,text)',
      'app.fail_membership_activation(uuid,text)',
      'app.complete_verified_membership_activation(uuid,text,text,text,numeric)',
      'app.current_membership_state()'
    ]) function_signature
    where has_function_privilege(role_name, function_signature, 'execute')
  ),
  'browser-facing roles cannot execute activation functions'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'app'
      and policyname in (
        'membership_activation_operations_management_all',
        'membership_activation_operation_gyms_management_all',
        'membership_periods_management_all',
        'membership_period_core_gyms_management_all',
        'membership_products_activation_select',
        'membership_product_versions_activation_select',
        'participating_gyms_activation_select',
        'membership_product_gym_eligibility_activation_select',
        'venues_activation_select',
        'wallet_bindings_membership_activation_select'
      )
  ),
  10,
  'activation functions have explicit management and dependency policies'
);

select is(
  (
    select count(*)::integer
    from pg_constraint constraint_record
    join pg_class table_record on table_record.oid = constraint_record.conrelid
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'membership_periods'
      and constraint_record.conname = 'membership_periods_member_time_exclusion'
      and constraint_record.contype = 'x'
  ),
  1,
  'membership periods have a database-enforced non-overlap constraint'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'app'
      and indexname in (
        'membership_activation_operations_one_open_idx',
        'membership_activation_operations_transaction_idx'
      )
  ),
  2,
  'open-operation and transaction-signature uniqueness indexes exist'
);

select is(
  (
    select count(*)::integer
    from pg_trigger trigger_record
    join pg_class table_record on table_record.oid = trigger_record.tgrelid
    join pg_namespace namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and trigger_record.tgname in (
        'membership_activation_operations_gym_count',
        'membership_activation_operation_gyms_count',
        'membership_periods_gym_count',
        'membership_period_core_gyms_count'
      )
      and trigger_record.tgconstraint <> 0
  ),
  4,
  'deferred constraint triggers enforce four operation and period gyms'
);

select is(
  (
    (select count(*) from app.membership_activation_operations)
    + (select count(*) from app.membership_activation_operation_gyms)
    + (select count(*) from app.membership_periods)
    + (select count(*) from app.membership_period_core_gyms)
  )::integer,
  0,
  'catalogue seed creates no activation, payment or membership ownership'
);

select * from finish();
rollback;
