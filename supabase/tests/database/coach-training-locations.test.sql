begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(20);

select has_table(
  'app',
  'coach_training_locations',
  'coach training locations table exists'
);

select is(
  (select count(*)::integer from app.coach_training_locations),
  (select count(*)::integer from app.coach_profiles),
  'the migration backfills one location per existing coach'
);

select ok(
  not exists (
    select 1
    from app.coach_profiles as coach
    left join app.coach_training_locations as location
      on location.run_id = coach.run_id
      and location.profile_id = coach.profile_id
      and location.status = 'active'
      and location.is_primary
    where location.id is null
      or location.timezone <> coach.timezone
      or location.selected_gym_id is distinct from coach.selected_gym_id
      or location.location_kind <> coach.location_kind
      or location.public_location_label <> coach.public_location_label
      or location.latitude <> coach.latitude
      or location.longitude <> coach.longitude
      or location.location_source <> coach.location_source
      or location.location_provider is distinct from coach.location_provider
      or location.location_confirmed_at <> coach.location_confirmed_at
  ),
  'backfilled primaries preserve every singleton location field'
);

select ok(
  not exists (
    select 1
    from app.coach_profiles as coach
    left join app.coach_training_locations as location
      on location.run_id = coach.run_id
      and location.profile_id = coach.profile_id
      and location.status = 'active'
      and location.is_primary
    group by coach.run_id, coach.profile_id
    having count(location.id) <> 1
  ),
  'every existing coach has exactly one active primary location'
);

select ok(
  (
    select table_record.relrowsecurity
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'coach_training_locations'
  ),
  'training locations enable row-level security'
);

select ok(
  (
    select table_record.relforcerowsecurity
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'coach_training_locations'
  ),
  'training locations force row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and tablename = 'coach_training_locations'
      and policyname in (
        'coach_training_locations_management_all',
        'coach_training_locations_public_select',
        'coach_training_locations_owner_select'
      )
  ),
  3,
  'management, public and owner policies exist'
);

select ok(
  has_table_privilege(
    'app_runtime',
    'app.coach_training_locations',
    'select'
  ),
  'runtime may read policy-filtered training locations'
);

select ok(
  not has_table_privilege(
    'app_runtime',
    'app.coach_training_locations',
    'insert'
  )
    and not has_table_privilege(
      'app_runtime',
      'app.coach_training_locations',
      'update'
    )
    and not has_table_privilege(
      'app_runtime',
      'app.coach_training_locations',
      'delete'
    ),
  'runtime cannot mutate training locations directly'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.create_owned_coach_training_location(text,uuid,text,numeric,numeric,text,text)',
    'execute'
  )
    and has_function_privilege(
      'app_runtime',
      'app.update_owned_coach_training_location(uuid,timestamp with time zone,text,uuid,text,numeric,numeric,text,text)',
      'execute'
    )
    and has_function_privilege(
      'app_runtime',
      'app.set_owned_coach_primary_location(uuid,timestamp with time zone,uuid,timestamp with time zone)',
      'execute'
    )
    and has_function_privilege(
      'app_runtime',
      'app.deactivate_owned_coach_training_location(uuid,timestamp with time zone,uuid,timestamp with time zone)',
      'execute'
    ),
  'runtime may call only bounded location lifecycle functions'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.create_owned_coach_training_location(text,uuid,text,numeric,numeric,text,text)',
    'execute'
  ),
  'Supabase anonymous role cannot call location mutations'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'app'
      and indexname in (
        'coach_training_locations_active_primary_key',
        'coach_training_locations_active_gym_key',
        'coach_training_locations_owner_lookup_idx',
        'coach_training_locations_public_lookup_idx'
      )
  ),
  4,
  'primary, gym, owner and public indexes exist'
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
      and table_record.relname = 'coach_training_locations'
      and constraint_record.contype = 'f'
  ),
  2,
  'same-run coach and gym references are enforced'
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
      and table_record.relname = 'coach_training_locations'
      and trigger_record.tgname in (
        'coach_training_locations_set_updated_at',
        'coach_training_locations_require_coach_timezone',
        'coach_training_locations_validate_visible_coach'
      )
      and not trigger_record.tgisinternal
  ),
  3,
  'training locations maintain audit time, coach timezone and visible-primary integrity'
);

do $unscoped_mutation_constraint$
begin
  begin
    set local role app_runtime;
    perform app.create_owned_coach_training_location(
      'Unscoped place',
      null,
      'Unscoped place',
      52.5,
      13.4,
      'manual',
      null
    );
    raise exception 'unscoped training location mutation was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'coach training location actor context is invalid' then
        raise;
      end if;
  end;
  reset role;
end
$unscoped_mutation_constraint$;

select pass('location mutation fails closed without actor context');

do $runtime_update_constraint$
begin
  begin
    set local role app_runtime;
    update app.coach_training_locations set public_name = 'Changed';
    raise exception 'app_runtime updated a location directly';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end
$runtime_update_constraint$;

select pass('runtime cannot update a training location directly');

select throws_ok(
  $$
    insert into app.coach_training_locations (
      run_id,
      profile_id,
      public_name,
      timezone,
      location_kind,
      public_location_label,
      latitude,
      longitude,
      location_source,
      location_confirmed_at,
      status,
      is_primary,
      sort_order,
      record_source
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'Duplicate primary',
      'Europe/Berlin',
      'independent',
      'Duplicate primary test place',
      52.5,
      13.4,
      'manual',
      statement_timestamp(),
      'active',
      true,
      2,
      'user'
    )
  $$,
  '23505',
  null,
  'a database constraint prevents two active primary locations'
);

select throws_ok(
  $$
    insert into app.coach_training_locations (
      run_id,
      profile_id,
      public_name,
      timezone,
      selected_gym_id,
      location_kind,
      public_location_label,
      latitude,
      longitude,
      location_source,
      location_confirmed_at,
      status,
      is_primary,
      sort_order,
      record_source
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'Unknown gym',
      'Europe/Berlin',
      '49999999-0000-4000-8000-000000000099',
      'gym',
      'Unknown gym address',
      52.5,
      13.4,
      'manual',
      statement_timestamp(),
      'active',
      false,
      2,
      'user'
    )
  $$,
  '23503',
  null,
  'a location cannot reference an unavailable same-run gym'
);

set local role app_runtime;

select set_config(
  'app.test_public_training_location_count',
  (select count(*)::text from app.coach_training_locations),
  true
);

reset role;

select is(
  current_setting('app.test_public_training_location_count')::integer,
  5,
  'public runtime sees the five active confirmed fixture locations'
);

select is(
  (
    select pg_catalog.obj_description(
      'app.coach_training_locations'::pg_catalog.regclass,
      'pg_class'
    )
  ),
  'Owner-scoped confirmed coach training places. Optional reviewed gym references are location labels only and grant no gym or account authority.',
  'the location-only authority boundary is documented'
);

select * from finish();
rollback;
