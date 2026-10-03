begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(27);

select has_table('app', 'coach_profiles', 'coach profiles table exists');
select has_table(
  'app',
  'coach_profile_disciplines',
  'coach disciplines table exists'
);

select is(
  (select count(*)::integer from app.coach_profiles),
  5,
  'five fictional coach profiles are seeded'
);

select is(
  (select count(*)::integer from app.coach_profile_disciplines),
  7,
  'fictional coaches have deterministic discipline rows'
);

select ok(
  not exists (
    select 1
    from app.coach_profiles as coach
    where coach.record_source <> 'fixture'
      or coach.visibility <> 'visible'
      or coach.service_mode <> 'private-training'
      or coach.location_confirmed_at is null
      or coach.latitude not between -90 and 90
      or coach.longitude not between -180 and 180
  ),
  'seeded coaches are visible bounded demo records'
);

select is(
  (
    select count(*)::integer
    from app.coach_profiles
    where location_kind = 'gym' and selected_gym_id is not null
  ),
  4,
  'four coaches use an optional fictional gym location'
);

select is(
  (
    select count(*)::integer
    from app.coach_profiles
    where location_kind = 'independent' and selected_gym_id is null
  ),
  1,
  'one coach demonstrates an independent location'
);

select ok(
  (
    select bool_and(table_record.relrowsecurity)
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'coach_profiles',
        'coach_profile_disciplines'
      )
  ),
  'coach tables enable row-level security'
);

select ok(
  (
    select bool_and(table_record.relforcerowsecurity)
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'app'
      and table_record.relname in (
        'coach_profiles',
        'coach_profile_disciplines'
      )
  ),
  'coach tables force row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and tablename in ('coach_profiles', 'coach_profile_disciplines')
      and policyname in (
        'coach_profiles_public_discovery_select',
        'coach_profiles_owner_select',
        'coach_profiles_management_all',
        'coach_profile_disciplines_public_select',
        'coach_profile_disciplines_owner_select',
        'coach_profile_disciplines_management_all'
      )
  ),
  6,
  'public, owner and non-login management policies exist'
);

select ok(
  has_table_privilege('app_runtime', 'app.coach_profiles', 'select'),
  'runtime may read policy-filtered coach profiles'
);

select ok(
  not has_table_privilege('app_runtime', 'app.coach_profiles', 'insert')
    and not has_table_privilege('app_runtime', 'app.coach_profiles', 'update')
    and not has_table_privilege('app_runtime', 'app.coach_profiles', 'delete'),
  'runtime cannot mutate coach profiles directly'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.upsert_owned_coach_profile(text,text,text[],text,text,uuid,text,numeric,numeric,text,text)',
    'execute'
  ),
  'runtime may call the bounded owner mutation function'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.upsert_owned_coach_profile(text,text,text[],text,text,uuid,text,numeric,numeric,text,text)',
    'execute'
  ),
  'Supabase anonymous role cannot call the owner mutation function'
);

select throws_ok(
  $$
    insert into app.coach_profiles (
      run_id, profile_id, public_slug, display_name, bio, timezone,
      location_kind, public_location_label, latitude, longitude,
      location_source, location_confirmed_at, visibility, record_source
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      'invalid-bio',
      'Invalid Coach',
      'too short',
      'Europe/Berlin',
      'independent',
      'Test place',
      52.5,
      13.4,
      'fixture',
      statement_timestamp(),
      'hidden',
      'fixture'
    )
  $$,
  '23514',
  null,
  'short biographies fail the database constraint'
);

select throws_ok(
  $$
    insert into app.coach_profiles (
      run_id, profile_id, public_slug, display_name, bio, timezone,
      location_kind, public_location_label, latitude, longitude,
      location_source, location_confirmed_at, visibility, record_source
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      'invalid-location',
      'Invalid Coach',
      'A sufficiently long biography used only to verify coordinate checks.',
      'Europe/Berlin',
      'independent',
      'Test place',
      91,
      13.4,
      'fixture',
      statement_timestamp(),
      'hidden',
      'fixture'
    )
  $$,
  '23514',
  null,
  'out-of-bounds coordinates fail the database constraint'
);

select throws_ok(
  $$
    insert into app.coach_profile_disciplines (
      run_id, profile_id, discipline, sort_order
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'Yoga',
      3
    )
  $$,
  '23514',
  null,
  'unsupported disciplines fail the database constraint'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_indexes
    where schemaname = 'app'
      and indexname in (
        'coach_profiles_run_visibility_name_idx',
        'coach_profiles_run_gym_visibility_idx',
        'coach_profiles_location_idx',
        'coach_profile_disciplines_lookup_idx'
      )
  ),
  4,
  'coach discovery and location indexes exist'
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
      and table_record.relname = 'coach_profiles'
      and constraint_record.contype = 'f'
  ),
  2,
  'coach profiles enforce same-run participant and gym references'
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
      and table_record.relname = 'coach_profiles'
      and trigger_record.tgname = 'coach_profiles_set_updated_at'
      and not trigger_record.tgisinternal
  ),
  1,
  'coach profiles maintain updated_at'
);

set local role app_runtime;

select set_config(
  'app.test_public_coach_count',
  (select count(*)::text from app.coach_profiles),
  true
);

select set_config(
  'app.test_public_discipline_count',
  (select count(*)::text from app.coach_profile_disciplines),
  true
);

reset role;

select is(
  current_setting('app.test_public_coach_count')::integer,
  5,
  'public runtime sees all five visible fixture coaches'
);

select is(
  current_setting('app.test_public_discipline_count')::integer,
  7,
  'public runtime sees disciplines only through visible coaches'
);

do $runtime_update_constraint$
begin
  begin
    set local role app_runtime;
    update app.coach_profiles
    set visibility = 'hidden'
    where public_slug = 'daniel-park';
    raise exception 'app_runtime updated a coach directly';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
end
$runtime_update_constraint$;

select pass('public runtime cannot update a coach directly');

do $unscoped_mutation_constraint$
begin
  begin
    set local role app_runtime;
    select app.upsert_owned_coach_profile(
      'Unscoped Coach',
      'A long enough biography that must still fail without actor context.',
      array['Boxing']::text[],
      'Europe/Berlin',
      'hidden',
      null,
      'Independent test place',
      52.5,
      13.4,
      'manual',
      null
    );
    raise exception 'unscoped coach profile mutation was accepted';
  exception
    when raise_exception then
      if sqlerrm <> 'coach profile actor context is invalid' then
        raise;
      end if;
  end;
  reset role;
end
$unscoped_mutation_constraint$;

select pass('owner mutation fails closed without verified actor context');

select ok(
  not exists (
    select 1
    from app.coach_profiles
    where selected_gym_id is not null
      and location_kind <> 'gym'
  ),
  'gym affiliations remain location-only and internally consistent'
);

select ok(
  not exists (
    select 1
    from app.coach_profiles
    where location_source = 'permanent-geocoding'
      and location_provider is null
  ),
  'permanent geocoding provenance cannot omit its provider'
);

select is(
  (
    select pg_catalog.obj_description(
      'app.coach_profiles'::pg_catalog.regclass,
      'pg_class'
    )
  ),
  'Self-declared coach discovery profiles with one confirmed public training location; selected gyms are labels/coordinates only and grant no authority.',
  'coach authority boundary is documented on the table'
);

select * from finish();
rollback;
