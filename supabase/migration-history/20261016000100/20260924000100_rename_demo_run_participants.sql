alter table app.demo_run_memberships
  rename to demo_run_participants;

alter table app.demo_run_participants
  rename constraint demo_run_memberships_pkey
  to demo_run_participants_pkey;
alter table app.demo_run_participants
  rename constraint demo_run_memberships_run_id_fkey
  to demo_run_participants_run_id_fkey;
alter table app.demo_run_participants
  rename constraint demo_run_memberships_profile_id_fkey
  to demo_run_participants_profile_id_fkey;
alter table app.demo_run_participants
  rename constraint demo_run_memberships_role_check
  to demo_run_participants_role_check;
alter table app.demo_run_participants
  rename constraint demo_run_memberships_status_check
  to demo_run_participants_status_check;
alter table app.demo_run_participants
  rename constraint demo_run_memberships_revoked_state_check
  to demo_run_participants_revoked_state_check;

alter index app.demo_run_memberships_profile_status_run_idx
  rename to demo_run_participants_profile_status_run_idx;

alter trigger demo_run_memberships_set_updated_at
  on app.demo_run_participants
  rename to demo_run_participants_set_updated_at;

alter policy demo_run_memberships_application_identity_select
  on app.demo_run_participants
  rename to demo_run_participants_application_identity_select;
alter policy demo_run_memberships_application_identity_insert
  on app.demo_run_participants
  rename to demo_run_participants_application_identity_insert;
alter policy demo_run_memberships_actor_validation_select
  on app.demo_run_participants
  rename to demo_run_participants_actor_validation_select;
alter policy demo_run_memberships_authorized_actor_select
  on app.demo_run_participants
  rename to demo_run_participants_authorized_actor_select;

do $refresh_participant_function_references$
declare
  target_function regprocedure;
  function_definition text;
begin
  foreach target_function in array array[
    'app.current_application_identity(uuid)'::regprocedure,
    'app.enroll_application_identity(uuid,text)'::regprocedure,
    'app.authorized_actor_context_valid(uuid,uuid,text)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(target_function::oid)
    into function_definition;

    if pg_catalog.strpos(
      function_definition,
      'app.demo_run_memberships'
    ) = 0 then
      raise exception 'expected old participant relation in function %',
        target_function;
    end if;

    execute pg_catalog.replace(
      function_definition,
      'app.demo_run_memberships',
      'app.demo_run_participants'
    );
  end loop;
end;
$refresh_participant_function_references$;

comment on table app.demo_run_participants is
  'Profiles participating in an isolated application demo dataset; not customer fitness memberships.';
