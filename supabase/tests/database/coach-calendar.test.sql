-- DEV0254: prepared for execution after the deferred calendar migration.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public,pg_catalog;
select plan(8);
select has_function('app','owned_coach_calendar',array['jsonb'],'owner calendar has a narrow JSON entry point');
select ok(has_function_privilege('app_runtime','app.owned_coach_calendar(jsonb)','execute'),'restricted runtime can read its authorized calendar');
select ok(not has_function_privilege('anon','app.owned_coach_calendar(jsonb)','execute') and not has_function_privilege('authenticated','app.owned_coach_calendar(jsonb)','execute') and not has_function_privilege('service_role','app.owned_coach_calendar(jsonb)','execute'),'Data API roles cannot call the private calendar');
select ok(not has_table_privilege('app_runtime','app.coach_group_sessions','select'),'calendar does not broaden direct group-table access');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] and r.rolname='app_owner' from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid='app.owned_coach_calendar(jsonb)'::regprocedure),'calendar executes through the restricted owner with a fixed empty search path');
select throws_ok($$select app.owned_coach_calendar('{}')$$,'P0001','coach calendar query is invalid','calendar rejects a call without verified actor context');
select set_config('app.current_profile_id','10000000-0000-4000-8000-000000000001',true),set_config('app.current_run_id','20000000-0000-4000-8000-000000000001',true),set_config('app.current_auth_user_id','30000000-0000-4000-8000-000000000001',true),set_config('app.current_run_role','member',true);
select throws_ok($$select app.owned_coach_calendar('{"from":"2026-10-01","through":"2026-10-31","type":"all","venueId":null,"history":false,"after":null}')$$,'P0001','coach calendar query is invalid','forged context settings do not establish an owner or dataset');
select ok(not has_function_privilege('app_runtime','app.availability_enter()','execute'),'private read cannot expose its internal policy/RLS helper');
select * from finish();
rollback;
