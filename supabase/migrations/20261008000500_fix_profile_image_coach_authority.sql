-- The initial portrait function joined the forced-RLS application table as
-- app_owner without enabling its management policy. Reuse the existing
-- security-definer trust classifier so approved and demo coaches are resolved
-- through the same authorization contract as public coach projections.

create or replace function app.set_current_coach_portrait_reference(
  requested_path text,
  expected_source text,
  expected_path text
)
returns table (
  previous_source text,
  previous_path text,
  media_updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach app.coach_profiles%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach portrait actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  if requested_path is not null
    and (
      requested_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
      or pg_catalog.split_part(requested_path, '/', 1) <> profile_id_text
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach portrait reference is invalid';
  end if;

  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and app.coach_trust_kind(coach.profile_id, coach.is_demo)
      in ('demo', 'verified')
  for update of coach;

  if not found
    or selected_coach.portrait_source is distinct from expected_source
    or selected_coach.portrait_path is distinct from expected_path
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach portrait reference conflicts with current state';
  end if;

  previous_source := selected_coach.portrait_source;
  previous_path := selected_coach.portrait_path;
  update app.coach_profiles as coach
  set portrait_source = case
        when requested_path is null then null
        else 'storage'
      end,
      portrait_path = requested_path,
      portrait_updated_at = case
        when requested_path is null then null
        else pg_catalog.statement_timestamp()
      end
  where coach.run_id = selected_coach.run_id
    and coach.profile_id = selected_coach.profile_id
  returning coach.portrait_updated_at into media_updated_at;

  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return next;
exception
  when others then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.set_current_coach_portrait_reference(text, text, text)
  owner to app_owner;
revoke all on function app.set_current_coach_portrait_reference(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function app.set_current_coach_portrait_reference(text, text, text)
  to app_runtime;
