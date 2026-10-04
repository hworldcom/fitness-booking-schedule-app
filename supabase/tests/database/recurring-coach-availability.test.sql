begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(14);

select has_table(
  'app',
  'coach_availability_rules',
  'weekly coach availability rule table exists'
);

select has_column(
  'app',
  'coach_availability_slots',
  'recurrence_rule_id',
  'dated slots optionally identify their recurrence rule'
);

select has_column(
  'app',
  'coach_availability_slots',
  'recurrence_local_date',
  'dated slots retain their rule-local occurrence date'
);

select ok(
  (
    select table_record.relrowsecurity and table_record.relforcerowsecurity
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'coach_availability_rules'
  ),
  'weekly rules enable and force row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and policyname in (
        'coach_availability_rules_management_all',
        'coach_availability_rules_owner_select',
        'demo_runs_coach_availability_sync_select'
      )
  ),
  3,
  'rule management, owner read and public-sync support policies exist'
);

select ok(
  has_table_privilege(
    'app_runtime',
    'app.coach_availability_rules',
    'select'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_availability_rules',
    'insert'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_availability_rules',
    'update'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_availability_rules',
    'delete'
  ),
  'runtime may read only its policy-filtered weekly rules'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.create_owned_coach_availability_rule(smallint,time without time zone)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.remove_owned_coach_availability_rule(uuid)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.synchronize_owned_coach_availability()',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.synchronize_public_coach_availability(uuid)',
    'execute'
  ),
  'runtime may call bounded rule mutations and synchronization wrappers'
);

select ok(
  not has_function_privilege(
    'app_runtime',
    'app.synchronize_coach_availability_occurrences(uuid,uuid)',
    'execute'
  )
  and not has_function_privilege(
    'app_runtime',
    'app.coach_local_time_is_unambiguous(timestamp without time zone,text)',
    'execute'
  ),
  'runtime cannot call internal recurrence helpers directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.create_owned_coach_availability_rule(smallint,time without time zone)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app.remove_owned_coach_availability_rule(uuid)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app.synchronize_public_coach_availability(uuid)',
    'execute'
  ),
  'Supabase anonymous role cannot mutate or synchronize recurrence'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'app'
      and indexname in (
        'coach_availability_rules_active_time_key',
        'coach_availability_rules_owner_lookup_idx',
        'coach_availability_slots_rule_occurrence_key',
        'coach_availability_slots_rule_status_idx'
      )
  ),
  4,
  'rule uniqueness, owner reads and occurrence lookups are indexed'
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
      and table_record.relname = 'coach_availability_rules'
      and constraint_record.contype = 'c'
  ),
  5,
  'weekday, hour, timezone, lifecycle and removed-state checks exist'
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
      and table_record.relname = 'coach_availability_slots'
      and constraint_record.conname in (
        'coach_availability_slots_rule_fkey',
        'coach_availability_slots_recurrence_pair_check',
        'coach_availability_slots_recurring_duration_check'
      )
  ),
  3,
  'recurring slots enforce source ownership, identity pairing and one hour'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger as trigger_record
    join pg_catalog.pg_class as table_record
      on table_record.oid = trigger_record.tgrelid
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and not trigger_record.tgisinternal
      and trigger_record.tgname in (
        'coach_availability_rules_set_updated_at',
        'coach_availability_slots_protect_recurring'
      )
  ),
  2,
  'rules maintain audit timestamps and generated occurrences are protected'
);

select ok(
  not app.coach_local_time_is_unambiguous(
    timestamp '2027-03-28 02:00:00',
    'Europe/Berlin'
  )
  and not app.coach_local_time_is_unambiguous(
    timestamp '2026-10-25 02:00:00',
    'Europe/Berlin'
  )
  and app.coach_local_time_is_unambiguous(
    timestamp '2026-10-25 04:00:00',
    'Europe/Berlin'
  ),
  'nonexistent and ambiguous local times are omitted rather than shifted'
);

select * from finish();
rollback;
