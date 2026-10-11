begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select has_table(
  'app',
  'coach_booking_requests',
  'coach booking request table exists'
);

select ok(
  (
    select table_record.relrowsecurity and table_record.relforcerowsecurity
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'coach_booking_requests'
  ),
  'booking requests enable and force row-level security'
);

select ok(
  not has_table_privilege(
    'app_runtime',
    'app.coach_booking_requests',
    'select'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_booking_requests',
    'insert'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_booking_requests',
    'update'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_booking_requests',
    'delete'
  ),
  'runtime cannot read or mutate raw booking requests'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.create_coach_booking_request(uuid)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.withdraw_coach_booking_request(uuid)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.decline_coach_booking_request(uuid)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.accept_coach_booking_request(uuid)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.close_coach_booking_request_occurrence(uuid)',
    'execute'
  ),
  'runtime may execute the bounded request mutations'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.current_client_coach_booking_requests(integer,timestamp with time zone,uuid)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.current_owned_coach_booking_requests(integer,timestamp with time zone,uuid)',
    'execute'
  ),
  'runtime may execute the separate bounded participant projections'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.create_coach_booking_request(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'app.create_coach_booking_request(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'app.create_coach_booking_request(uuid)',
    'execute'
  ),
  'browser and service roles cannot bypass the server request boundary'
);

select ok(
  not has_function_privilege(
    'app_runtime',
    'app.close_pending_requests_for_withdrawn_occurrence()',
    'execute'
  )
  and not has_function_privilege(
    'app_runtime',
    'app.close_pending_requests_for_hidden_coach()',
    'execute'
  ),
  'runtime cannot invoke internal closure triggers directly'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'app'
      and indexname in (
        'coach_booking_requests_active_client_key',
        'coach_booking_requests_accepted_slot_key',
        'coach_booking_requests_booking_key',
        'coach_booking_requests_client_idx',
        'coach_booking_requests_coach_idx',
        'coach_booking_requests_pending_deadline_idx'
      )
  ),
  6,
  'active identity, acceptance, pagination and deadline indexes exist'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as table_record
      on table_record.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'coach_booking_requests'
      and constraint_record.conname in (
        'coach_booking_requests_status_check',
        'coach_booking_requests_time_check',
        'coach_booking_requests_state_check',
        'coach_booking_requests_booking_fkey',
        'coach_booking_requests_training_location_fkey'
      )
  ),
  5,
  'request lifecycle, deadline and exact booking/location constraints exist'
);

select ok(
  (
    select array_length(constraint_record.conkey, 1) = 5
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conname = 'coach_booking_requests_booking_fkey'
  ),
  'accepted requests reference the exact run, booking, occurrence, coach and client'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger as trigger_record
    where trigger_record.tgname in (
      'coach_booking_requests_set_updated_at',
      'coach_availability_slots_close_booking_requests',
      'coach_profiles_close_booking_requests'
    )
      and not trigger_record.tgisinternal
  ),
  3,
  'request timestamps and occurrence/coach closure triggers exist'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and tablename = 'coach_booking_requests'
      and policyname = 'coach_booking_requests_management_all'
  ),
  1,
  'only the internal management policy exists on raw requests'
);

select * from finish();
rollback;
