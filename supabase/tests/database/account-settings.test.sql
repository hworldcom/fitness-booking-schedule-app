begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;
select plan(30);

select has_table('app', 'account_personal_details', 'private account details exist');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app.account_personal_details'::regclass), 'private details force row security');
select ok(not has_table_privilege('anon', 'app.account_personal_details', 'select') and not has_table_privilege('authenticated', 'app.account_personal_details', 'select'), 'browser roles have no direct private details access');
select ok(not has_table_privilege('app_runtime', 'app.account_personal_details', 'insert,update,delete'), 'runtime has no direct personal-details writes');
select ok(not has_table_privilege('app_runtime', 'app.profiles', 'update'), 'runtime still cannot directly edit identity');
select ok(not has_function_privilege('anon', 'app.current_account_settings()', 'execute') and not has_function_privilege('authenticated', 'app.save_current_account_settings(text,date,text,integer)', 'execute'), 'private functions deny browser roles');

insert into auth.users (id, is_sso_user, is_anonymous) values
 ('d0294000-0000-4000-8000-000000000001', false, false),
 ('d0294000-0000-4000-8000-000000000002', false, false);
select set_config('test.account_owner', (select identity_profile_id::text from app.enroll_application_identity('d0294000-0000-4000-8000-000000000001', 'Settings Owner')), true);
select set_config('test.account_other', (select identity_profile_id::text from app.enroll_application_identity('d0294000-0000-4000-8000-000000000002', 'Settings Other')), true);
select set_config('test.account_identity', (select md5(jsonb_build_array(auth_user_id,slug,avatar_storage_path,avatar_updated_at,record_source,coaching_activated_at)::text) from app.profiles where id = current_setting('test.account_owner')::uuid), true);
select set_config('test.account_coaches', (select md5(coalesce(jsonb_agg(to_jsonb(c) order by profile_id)::text, '')) from app.coach_profiles c), true);

select throws_ok('select app.current_account_settings()', '42501', 'account settings actor unavailable', 'missing context cannot read details');
select set_config('app.current_auth_user_id', 'd0294000-0000-4000-8000-000000000001', true);
select set_config('app.current_profile_id', current_setting('test.account_owner'), true);
select set_config('app.current_run_id', '20000000-0000-4000-8000-000000000001', true);
select set_config('app.current_run_role', 'member', true);
select is(app.current_account_settings()->>'revision', '0', 'existing identity starts at revision zero without fabricated stored fields');
select is(app.current_account_settings()->>'birthdate', null::text, 'existing identity birthdate is absent');
set local role app_runtime;
select set_config('test.account_first_save', app.save_current_account_settings('  Settings   Updated  ', date '2000-02-29', '  nonbinary  ', 0)::text, true);
reset role;
select is(current_setting('test.account_first_save')::jsonb->>'status', 'ready', 'runtime owner saves normalized name, leap birthdate and gender');
select is(app.current_account_settings()->>'displayName', 'Settings Updated', 'current personal name is updated');
select is(app.current_account_settings()->>'gender', 'nonbinary', 'gender is normalized');
select is(app.current_account_settings()->>'birthdate', '2000-02-29', 'date remains exact calendar date');
select is(app.save_current_account_settings('Settings Updated', date '2000-02-29', 'nonbinary', 0)->>'status', 'ready', 'exact previous-revision retry is recovered');
select is(app.current_account_settings()->>'revision', '1', 'retry does not increment revision twice');
select is(app.save_current_account_settings('Another Update', null, null, 0)->>'status', 'conflict', 'stale altered save cannot overwrite');
select is(app.save_current_account_settings('A', null, null, 1)->>'status', 'invalid', 'too-short name rejected');
select is(app.save_current_account_settings(E'Name\nInjected', null, null, 1)->>'status', 'invalid', 'control characters rejected');
select is(app.save_current_account_settings('Valid Name', date '1899-12-31', null, 1)->>'status', 'invalid', 'out-of-range birthdate rejected');
select is(app.save_current_account_settings('Valid Name', ((statement_timestamp() at time zone 'UTC')::date + 1), null, 1)->>'status', 'invalid', 'future birthdate rejected');
select is(app.save_current_account_settings('Valid Name', null, repeat('x',81), 1)->>'status', 'invalid', 'unbounded gender rejected');
select is(app.save_current_account_settings('Settings Updated', null, null, 1)->>'status', 'ready', 'optional fields can be cleared');
select ok((app.current_account_settings()->>'birthdate') is null and (app.current_account_settings()->>'gender') is null, 'cleared fields remain absent on reload');
set local role app_runtime;
select set_config('test.account_owner_rows', (select count(*)::text from app.account_personal_details), true);
reset role;
select is(current_setting('test.account_owner_rows')::integer, 1, 'owner sees only own private row');

select set_config('app.current_auth_user_id', 'd0294000-0000-4000-8000-000000000002', true);
select set_config('app.current_profile_id', current_setting('test.account_other'), true);
set local role app_runtime;
select set_config('test.account_other_rows', (select count(*)::text from app.account_personal_details), true);
reset role;
select is(current_setting('test.account_other_rows')::integer, 0, 'other actor cannot read first actor details');
select is(app.current_account_settings()->>'displayName', 'Settings Other', 'other actor retains own name');
select set_config('app.current_profile_id', current_setting('test.account_owner'), true);
select throws_ok('select app.save_current_account_settings(''Forged Actor'', null, null, 2)', '42501', 'account settings actor unavailable', 'forged profile context cannot save');
set local role app_runtime;
select set_config('test.account_forged_rows', (select count(*)::text from app.account_personal_details), true);
reset role;
select is(current_setting('test.account_forged_rows')::integer, 0, 'forged context reads no private rows');

reset role;
select is((select md5(jsonb_build_array(auth_user_id,slug,avatar_storage_path,avatar_updated_at,record_source,coaching_activated_at)::text) from app.profiles where id = current_setting('test.account_owner')::uuid), current_setting('test.account_identity'), 'identity, avatar and coach activation unchanged');
select is((select md5(coalesce(jsonb_agg(to_jsonb(c) order by profile_id)::text, '')) from app.coach_profiles c), current_setting('test.account_coaches'), 'public/private coach profiles unchanged');
select * from finish();
rollback;
