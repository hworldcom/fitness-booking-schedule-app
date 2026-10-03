begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(9);

select has_column(
  'app',
  'profiles',
  'coaching_activated_at',
  'profiles store explicit coaching activation time'
);

select is(
  (
    select count(*)::integer
    from app.profiles as profile
    join app.coach_profiles as coach on coach.profile_id = profile.id
    where profile.coaching_activated_at is not null
  ),
  5,
  'all seeded coach profiles are activated'
);

select is(
  (
    select count(*)::integer
    from app.profiles as profile
    where profile.record_source = 'fixture'
      and profile.coaching_activated_at is not null
      and not exists (
        select 1
        from app.coach_profiles as coach
        where coach.profile_id = profile.id
      )
  ),
  0,
  'non-coach fixture profiles are not activated'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and tablename = 'profiles'
      and policyname = 'profiles_coach_activation_management_all'
  ),
  1,
  'forced-RLS management policy exists for the activation function'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.activate_owned_coaching()',
    'execute'
  ),
  'runtime may execute the owner-scoped activation function'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.activate_owned_coaching()',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'app.activate_owned_coaching()',
      'execute'
    ),
  'browser-facing Supabase roles cannot activate coaching directly'
);

select ok(
  not has_table_privilege('app_runtime', 'app.profiles', 'update'),
  'runtime cannot update profile activation directly'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger
    where tgrelid = 'app.coach_profiles'::regclass
      and tgname = 'coach_profiles_require_activation'
      and not tgisinternal
  ),
  1,
  'coach profiles have an activation enforcement trigger'
);

select ok(
  (
    select prosecdef
    from pg_catalog.pg_proc
    where oid = 'app.activate_owned_coaching()'::regprocedure
  ),
  'activation uses a security-definer function'
);

select * from finish();
rollback;
