begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(19);

select has_table(
  'app',
  'coach_availability_slots',
  'coach availability table exists'
);

select ok(
  (
    select table_record.relrowsecurity and table_record.relforcerowsecurity
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname = 'coach_availability_slots'
  ),
  'availability enables and forces row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and policyname in (
        'coach_availability_slots_management_all',
        'coach_availability_slots_owner_select',
        'coach_availability_slots_public_select'
      )
  ),
  3,
  'management, owner and public slot policies exist'
);

select ok(
  has_table_privilege(
    'app_runtime',
    'app.coach_availability_slots',
    'select'
  ),
  'runtime may read policy-filtered availability'
);

select ok(
  not has_table_privilege(
    'app_runtime',
    'app.coach_availability_slots',
    'insert'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_availability_slots',
    'update'
  )
  and not has_table_privilege(
    'app_runtime',
    'app.coach_availability_slots',
    'delete'
  ),
  'runtime cannot mutate availability directly'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.create_owned_coach_availability(timestamp without time zone,integer)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.update_owned_coach_availability(uuid,timestamp without time zone,integer,boolean)',
    'execute'
  )
  and has_function_privilege(
    'app_runtime',
    'app.withdraw_owned_coach_availability(uuid)',
    'execute'
  ),
  'runtime may call only bounded owner mutation functions'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.create_owned_coach_availability(timestamp without time zone,integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app.update_owned_coach_availability(uuid,timestamp without time zone,integer,boolean)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'app.withdraw_owned_coach_availability(uuid)',
    'execute'
  ),
  'Supabase anonymous role cannot call availability mutations'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'app'
      and indexname in (
        'coach_availability_slots_public_lookup_idx',
        'coach_availability_slots_owner_lookup_idx'
      )
  ),
  2,
  'public and owner availability indexes exist'
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
      and constraint_record.conname = 'coach_availability_slots_active_time_excl'
      and constraint_record.contype = 'x'
  ),
  1,
  'one database exclusion constraint prevents active overlap'
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
      and constraint_record.contype = 'c'
  ),
  15,
  'slot time, lifecycle and location checks exist'
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
      and table_record.relname = 'coach_availability_slots'
      and trigger_record.tgname = 'coach_availability_slots_set_updated_at'
      and not trigger_record.tgisinternal
  ),
  1,
  'availability maintains updated_at'
);

select lives_ok(
  $$
    insert into app.coach_availability_slots (
      id, run_id, profile_id, starts_at, ends_at, coach_timezone, status,
      location_kind, selected_gym_id, gym_name, public_location_label,
      latitude, longitude, location_source, location_provider,
      location_confirmed_at
    ) values (
      '96000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      date_trunc('hour', statement_timestamp()) + interval '2 hours',
      date_trunc('hour', statement_timestamp()) + interval '3 hours',
      'Europe/Berlin',
      'open',
      'independent',
      null,
      null,
      'Tempelhofer Feld — Columbiadamm, 12101 Berlin',
      52.473086,
      13.403665,
      'fixture',
      null,
      statement_timestamp()
    )
  $$,
  'one valid open slot can be stored'
);

select throws_ok(
  $$
    insert into app.coach_availability_slots (
      id, run_id, profile_id, starts_at, ends_at, coach_timezone, status,
      location_kind, selected_gym_id, gym_name, public_location_label,
      latitude, longitude, location_source, location_confirmed_at
    )
    select
      '96000000-0000-4000-8000-000000000002', run_id, profile_id,
      starts_at + interval '15 minutes', ends_at + interval '15 minutes',
      coach_timezone, 'open', location_kind, selected_gym_id, gym_name,
      public_location_label, latitude, longitude, location_source,
      location_confirmed_at
    from app.coach_availability_slots
    where id = '96000000-0000-4000-8000-000000000001'
  $$,
  '23P01',
  null,
  'overlapping active capacity fails atomically'
);

select throws_ok(
  $$
    insert into app.coach_availability_slots (
      id, run_id, profile_id, starts_at, ends_at, coach_timezone, status,
      location_kind, public_location_label, latitude, longitude,
      location_source, location_confirmed_at
    ) values (
      '96000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      date_trunc('hour', statement_timestamp()) + interval '4 hours',
      date_trunc('hour', statement_timestamp()) + interval '4 hours 20 minutes',
      'Europe/Berlin', 'open', 'independent', 'Test place', 52.5, 13.4,
      'fixture', statement_timestamp()
    )
  $$,
  '23514',
  null,
  'unsupported duration fails the database constraint'
);

select throws_ok(
  $$
    insert into app.coach_availability_slots (
      id, run_id, profile_id, starts_at, ends_at, coach_timezone, status,
      location_kind, selected_gym_id, gym_name, public_location_label,
      latitude, longitude, location_source, location_confirmed_at
    ) values (
      '96000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      date_trunc('hour', statement_timestamp()) + interval '5 hours',
      date_trunc('hour', statement_timestamp()) + interval '6 hours',
      'Europe/Berlin', 'open', 'independent', null, 'Unexpected gym',
      'Test place', 52.5, 13.4, 'fixture', statement_timestamp()
    )
  $$,
  '23514',
  null,
  'inconsistent independent location snapshots fail'
);

insert into app.coach_availability_slots (
  id, run_id, profile_id, starts_at, ends_at, coach_timezone, status,
  location_kind, public_location_label, latitude, longitude,
  location_source, location_confirmed_at
)
values
  (
    '96000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    date_trunc('hour', statement_timestamp()) + interval '4 hours',
    date_trunc('hour', statement_timestamp()) + interval '5 hours',
    'Europe/Berlin', 'held', 'independent', 'Test place', 52.5, 13.4,
    'fixture', statement_timestamp()
  ),
  (
    '96000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    date_trunc('hour', statement_timestamp()) + interval '8 days',
    date_trunc('hour', statement_timestamp()) + interval '8 days 1 hour',
    'Europe/Berlin', 'open', 'independent', 'Test place', 52.5, 13.4,
    'fixture', statement_timestamp()
  );

set local role app_runtime;
select set_config(
  'app.test_public_availability_count',
  (select count(*)::text from app.coach_availability_slots),
  true
);
reset role;

select is(
  current_setting('app.test_public_availability_count')::integer,
  1,
  'public runtime sees only open slots inside the rolling horizon'
);

do $runtime_update_constraint$
begin
  begin
    set local role app_runtime;
    update app.coach_availability_slots set status = 'withdrawn';
    raise exception 'app_runtime updated availability directly';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end
$runtime_update_constraint$;

select pass('public runtime cannot update availability directly');

do $unscoped_mutation_constraint$
begin
  begin
    set local role app_runtime;
    perform app.create_owned_coach_availability(
      (date_trunc('hour', statement_timestamp()) + interval '6 hours')::timestamp,
      60
    );
    raise exception 'unscoped availability mutation was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'coach availability actor context is invalid' then
        raise;
      end if;
  end;
  reset role;
end
$unscoped_mutation_constraint$;

select pass('owner mutation fails closed without verified actor context');

select is(
  (
    select pg_catalog.obj_description(
      'app.coach_availability_slots'::pg_catalog.regclass,
      'pg_class'
    )
  ),
  'Explicit capacity-one coach slots with immutable-by-default public location snapshots.',
  'slot snapshot and capacity boundary is documented'
);

select * from finish();
rollback;
