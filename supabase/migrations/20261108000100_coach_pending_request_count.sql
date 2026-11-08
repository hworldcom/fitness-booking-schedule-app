-- MOV-208: one owner-scoped scalar; never reconcile or change request history.
create function app.current_owned_pending_coach_booking_request_count()
returns bigint
language plpgsql security definer
set search_path = ''
as $function$
declare
  result bigint;
  previous_management text := pg_catalog.current_setting('app.coach_booking_request_management', true);
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using errcode = 'P0001', message = 'coach booking request count is invalid';
  end if;
  perform pg_catalog.set_config('app.coach_booking_request_management', 'on', true);
  select count(*) into result
  from app.coach_booking_requests r
  where r.run_id = pg_catalog.current_setting('app.current_run_id', true)::uuid
    and r.coach_profile_id = pg_catalog.current_setting('app.current_profile_id', true)::uuid
    and r.status = 'pending'
    and r.decision_deadline_at > pg_catalog.statement_timestamp()
    and r.scheduled_start_at > pg_catalog.statement_timestamp();
  perform pg_catalog.set_config('app.coach_booking_request_management', coalesce(previous_management, 'off'), true);
  return result;
exception when others then
  perform pg_catalog.set_config('app.coach_booking_request_management', coalesce(previous_management, 'off'), true);
  raise;
end;
$function$;
alter function app.current_owned_pending_coach_booking_request_count() owner to app_owner;
revoke all on function app.current_owned_pending_coach_booking_request_count() from public, anon, authenticated, service_role;
grant execute on function app.current_owned_pending_coach_booking_request_count() to app_runtime;
comment on function app.current_owned_pending_coach_booking_request_count() is
  'Exact owning actor/dataset pending request count across all pages; elapsed deadlines excluded without mutation.';
