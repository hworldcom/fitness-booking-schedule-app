begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select has_column(
  'app',
  'coach_availability_rules',
  'coach_training_location_id',
  'recurring rules identify their assigned training location'
);

select has_column(
  'app',
  'coach_availability_slots',
  'coach_training_location_id',
  'dated occurrences retain trustworthy training-location lineage'
);

select has_column(
  'app',
  'coach_availability_slots',
  'training_location_name',
  'dated occurrences retain an immutable public location name'
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
      and constraint_record.conname in (
        'coach_availability_rules_location_fkey',
        'coach_availability_slots_training_location_fkey'
      )
      and constraint_record.contype = 'f'
  ),
  2,
  'rules and trustworthy slot lineage use same-owner location foreign keys'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'app'
      and indexname in (
        'coach_availability_rules_location_lookup_idx',
        'coach_availability_slots_training_location_idx'
      )
  ),
  2,
  'rule and occurrence location lookups are indexed'
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
        'coach_availability_rules_require_active_location',
        'coach_profiles_sync_training_schedule_timezone'
      )
  ),
  2,
  'active-location and single-timezone rule integrity is trigger-enforced'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.replace_owned_coach_availability_rules(jsonb,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app.replace_owned_coach_availability_rules(jsonb,jsonb)',
    'execute'
  ),
  'only the authorized runtime may call complete working-week replacement'
);

select ok(
  not exists (
    select 1
    from app.coach_availability_rules as rule
    where rule.status = 'active'
      and rule.coach_training_location_id is null
  ),
  'every migrated active recurring rule has location lineage'
);

select ok(
  not exists (
    select 1
    from app.coach_availability_rules as rule
    join app.coach_training_locations as location
      on location.run_id = rule.run_id
      and location.profile_id = rule.profile_id
      and location.id = rule.coach_training_location_id
    where rule.status = 'active'
      and (
        location.status <> 'active'
        or not location.is_primary
        or location.timezone <> rule.coach_timezone
      )
  ),
  'pre-existing active rules migrate to the active primary in one timezone'
);

select ok(
  not exists (
    select 1
    from app.coach_availability_slots as slot
    where slot.training_location_name is null
  ),
  'all existing slot snapshots receive a bounded display-name fallback'
);

select ok(
  not exists (
    select 1
    from app.coach_availability_slots as slot
    join app.coach_availability_rules as rule
      on rule.run_id = slot.run_id
      and rule.profile_id = slot.profile_id
      and rule.id = slot.recurrence_rule_id
    join app.coach_training_locations as location
      on location.run_id = rule.run_id
      and location.profile_id = rule.profile_id
      and location.id = rule.coach_training_location_id
    where slot.coach_training_location_id is not null
      and slot.coach_training_location_id <> location.id
  ),
  'trusted migrated recurrence lineage agrees with the assigned rule location'
);

select ok(
  (
    select procedure_record.proargnames @> array[
      'coach_training_location_id',
      'training_location_name'
    ]::text[]
    from pg_catalog.pg_proc as procedure_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    where namespace_record.nspname = 'app'
      and procedure_record.proname = 'current_direct_private_bookings'
  ),
  'private booking projections expose actual-location identity and name'
);

select * from finish();
rollback;
