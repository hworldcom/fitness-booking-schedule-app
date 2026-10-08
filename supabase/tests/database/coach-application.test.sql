begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(18);

select has_table(
  'app',
  'coach_applications',
  'coach applications store current platform-review state'
);

select has_table(
  'app',
  'coach_application_review_events',
  'coach review events preserve immutable decision evidence'
);

select has_column(
  'app',
  'coach_profiles',
  'is_demo',
  'coach profiles distinguish fictional demo data from verified coaches'
);

select is(
  (
    select count(*)::integer
    from app.coach_profiles
    where is_demo
  ),
  5,
  'all five seeded coach profiles are explicit demo profiles'
);

select is(
  (
    select count(*)::integer
    from app.coach_applications
    where profile_id in (
      select profile_id from app.coach_profiles where is_demo
    )
  ),
  0,
  'demo coach profiles are not silently platform approved'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'app.coach_applications'::regclass
  ),
  'coach applications use forced row-level security'
);

select ok(
  (
    select relrowsecurity and relforcerowsecurity
    from pg_catalog.pg_class
    where oid = 'app.coach_application_review_events'::regclass
  ),
  'review events use forced row-level security'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'app'
      and tablename = 'coach_applications'
      and policyname = 'coach_applications_owner_select'
  ),
  1,
  'an actor may read only their own coach application'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.submit_owned_coach_application()',
    'execute'
  ),
  'runtime may submit the current actor coach application'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.submit_owned_coach_application()',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'app.submit_owned_coach_application()',
      'execute'
    ),
  'browser-facing Supabase roles cannot submit through the database directly'
);

select ok(
  not has_function_privilege(
    'app_runtime',
    'app.review_coach_application(uuid,text,text,text,text,text)',
    'execute'
  ),
  'runtime cannot make platform review decisions'
);

select ok(
  not has_function_privilege(
    'app_runtime',
    'app.activate_owned_coaching()',
    'execute'
  ),
  'runtime can no longer use historical self-activation'
);

select ok(
  not has_table_privilege('app_runtime', 'app.coach_applications', 'insert')
    and not has_table_privilege(
      'app_runtime',
      'app.coach_applications',
      'update'
    )
    and not has_table_privilege(
      'app_runtime',
      'app.coach_application_review_events',
      'insert'
    ),
  'runtime cannot write application or review state directly'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger
    where tgrelid = 'app.coach_profiles'::regclass
      and tgname = 'coach_profiles_require_application'
      and not tgisinternal
  ),
  1,
  'coach profiles enforce application eligibility'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_trigger
    where tgrelid = 'app.coach_profiles'::regclass
      and tgname = 'coach_profiles_require_activation'
      and not tgisinternal
  ),
  0,
  'the historical activation trigger no longer grants coach access'
);

select ok(
  (
    select prosecdef
    from pg_catalog.pg_proc
    where oid = 'app.submit_owned_coach_application()'::regprocedure
  ),
  'submission uses a security-definer function with verified actor context'
);

select ok(
  (
    select prosecdef
    from pg_catalog.pg_proc
    where oid =
      'app.review_coach_application(uuid,text,text,text,text,text)'::regprocedure
  ),
  'review uses an owner-controlled security-definer function'
);

select ok(
  has_function_privilege(
    'app_runtime',
    'app.coach_trust_kind(uuid,boolean)',
    'execute'
  ),
  'runtime may derive the bounded public coach trust projection'
);

select * from finish();
rollback;
