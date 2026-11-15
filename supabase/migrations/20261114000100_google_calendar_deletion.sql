-- MOV-230. Retire the exact target before a destructive Google request.
create table app.google_calendar_retirements (
  run_id uuid not null,
  profile_id uuid not null,
  operation_id uuid not null,
  generation uuid not null,
  google_sub text not null,
  client_hash text not null check (client_hash ~ '^[a-f0-9]{64}$'),
  calendar_id text not null check (length(calendar_id) between 3 and 1024 and calendar_id <> 'primary'),
  previous_attempt_id uuid not null,
  state text not null check (state in ('prepared','sent','uncertain','confirmed')),
  primary key (run_id,profile_id,operation_id),
  foreign key (run_id,profile_id) references app.google_calendar_connections(run_id,profile_id) on delete cascade
);
alter table app.google_calendar_retirements owner to app_owner;
alter table app.google_calendar_retirements enable row level security;
alter table app.google_calendar_retirements force row level security;
create policy google_calendar_retirement_owner on app.google_calendar_retirements to app_owner using (true) with check (true);
revoke all on app.google_calendar_retirements from public,anon,authenticated,service_role,app_runtime;

alter function app.google_calendar_connection_command(text,uuid,jsonb) rename to google_calendar_connection_command_v1;
revoke all on function app.google_calendar_connection_command_v1(text,uuid,jsonb) from public,anon,authenticated,service_role,app_runtime;

create function app.google_calendar_connection_command(action text, expected uuid, input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  c app.google_calendar_connections; a app.google_calendar_accounts;
  r app.google_calendar_retirements; result jsonb; op uuid; uncertain boolean;
  run uuid := pg_catalog.current_setting('app.current_run_id',true)::uuid;
  profile uuid := pg_catalog.current_setting('app.current_profile_id',true)::uuid;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'Calendar actor is invalid'; end if;
  if input is null or pg_catalog.jsonb_typeof(input)<>'object' or pg_catalog.pg_column_size(input)>24000 then raise exception 'Calendar command is invalid'; end if;
  select * into c from app.google_calendar_connections where run_id=run and profile_id=profile for update;
  if action='delete-claim' then
    if c.profile_id is null or c.generation is distinct from expected then return '{"kind":"conflict"}'; end if;
    if c.state='connecting' and c.expires_at>pg_catalog.clock_timestamp() then return '{"kind":"conflict"}'; end if;
    if c.credential_ciphertext is null or c.client_hash is distinct from input->>'clientHash' then return '{"kind":"reconnect-required"}'; end if;
    op := (input->>'operationId')::uuid;
    if op is null or exists(select 1 from app.google_calendar_retirements where run_id=run and profile_id=profile and operation_id=op) then return '{"kind":"conflict"}'; end if;
    select * into a from app.google_calendar_accounts where run_id=run and profile_id=profile and google_sub=c.google_sub and client_hash=c.client_hash for update;
    if a.calendar_id is null or a.calendar_id='primary' then return '{"kind":"recovery-required"}'; end if;
    if a.bootstrap_state<>'ready' and not exists(select 1 from app.google_calendar_retirements x where x.run_id=run and x.profile_id=profile and x.google_sub=a.google_sub and x.client_hash=a.client_hash and x.calendar_id=a.calendar_id) then return '{"kind":"recovery-required"}'; end if;
    update app.google_calendar_connections set generation=pg_catalog.gen_random_uuid(),previous_state=case when state='connecting' then 'recovery-required' else state end,
      state='connecting',operation_id=op,expires_at=pg_catalog.clock_timestamp()+interval '2 minutes',
      pending_state_hash=null,pending_browser_hash=null,pending_session_id=null,pending_verifier_ciphertext=null
      where run_id=run and profile_id=profile returning * into c;
    insert into app.google_calendar_retirements values(run,profile,op,c.generation,c.google_sub,c.client_hash,a.calendar_id,a.attempt_id,'prepared');
    update app.google_calendar_accounts set bootstrap_state='uncertain',attempt_id=op where run_id=run and profile_id=profile and google_sub=c.google_sub and client_hash=c.client_hash;
    return pg_catalog.jsonb_build_object('kind','ok','record',pg_catalog.to_jsonb(c),'calendarId',a.calendar_id);
  elsif action in ('delete-dispatch','delete-confirm','delete-fail') then
    op := (input->>'operationId')::uuid;
    select * into r from app.google_calendar_retirements where run_id=run and profile_id=profile and operation_id=op and generation=expected for update;
    if not found then return '{"kind":"conflict"}'; end if;
    if action='delete-dispatch' then
      if r.state<>'prepared' or c.generation is distinct from expected or c.operation_id is distinct from op or c.state<>'connecting' or c.expires_at<=pg_catalog.clock_timestamp() then return '{"kind":"conflict"}'; end if;
      update app.google_calendar_retirements set state='sent' where run_id=run and profile_id=profile and operation_id=op;
    else
      if r.state='confirmed' then return '{"kind":"ok"}'; end if;
      if action='delete-confirm' then
        if r.state not in ('sent','uncertain') then return '{"kind":"conflict"}'; end if;
        update app.google_calendar_retirements set state='confirmed' where run_id=run and profile_id=profile and operation_id=op;
        delete from app.google_calendar_accounts where run_id=run and profile_id=profile and google_sub=r.google_sub and client_hash=r.client_hash and calendar_id=r.calendar_id and attempt_id=op;
      elsif r.state='prepared' then
        delete from app.google_calendar_retirements where run_id=run and profile_id=profile and operation_id=op;
        if not exists(select 1 from app.google_calendar_retirements x where x.run_id=run and x.profile_id=profile and x.google_sub=r.google_sub and x.client_hash=r.client_hash and x.calendar_id=r.calendar_id) then
          update app.google_calendar_accounts set bootstrap_state='ready',attempt_id=r.previous_attempt_id where run_id=run and profile_id=profile and google_sub=r.google_sub and client_hash=r.client_hash and calendar_id=r.calendar_id and attempt_id=op;
        end if;
      else
        update app.google_calendar_retirements set state='uncertain' where run_id=run and profile_id=profile and operation_id=op;
      end if;
      uncertain := action='delete-fail' and exists(select 1 from app.google_calendar_retirements x where x.run_id=run and x.profile_id=profile and x.google_sub=r.google_sub and x.client_hash=r.client_hash and x.calendar_id=r.calendar_id);
      -- Late results reconcile only their pinned target, never a newer connection.
      if c.generation=expected and c.operation_id=op then
        update app.google_calendar_connections set generation=pg_catalog.gen_random_uuid(),state=case when uncertain then 'recovery-required' else 'disconnected' end,
          previous_state='disconnected',credential_ciphertext=null,pending_state_hash=null,pending_browser_hash=null,pending_session_id=null,pending_verifier_ciphertext=null,
          operation_id=null,expires_at=null,checked_at=null where run_id=run and profile_id=profile;
      end if;
    end if;
    return '{"kind":"ok"}';
  end if;
  if action='bootstrap' then
    if input->>'recoverId' is not null and exists(select 1 from app.google_calendar_retirements x where x.run_id=run and x.profile_id=profile and x.google_sub=c.google_sub and x.client_hash=c.client_hash and x.calendar_id=input->>'recoverId') then return '{"kind":"recovery-required"}'; end if;
    if input->>'recoverId' is null and not coalesce((input->>'replace')::boolean,false) and exists(select 1 from app.google_calendar_retirements x join app.google_calendar_accounts y on y.run_id=x.run_id and y.profile_id=x.profile_id and y.google_sub=x.google_sub and y.client_hash=x.client_hash and y.calendar_id=x.calendar_id where x.run_id=run and x.profile_id=profile and x.google_sub=c.google_sub and x.client_hash=c.client_hash) then return '{"kind":"recovery-required"}'; end if;
  elsif action='record-calendar' and exists(select 1 from app.google_calendar_retirements x where x.run_id=run and x.profile_id=profile and x.google_sub=input->>'sub' and x.client_hash=input->>'clientHash' and x.calendar_id=input->>'calendarId') then return '{"kind":"conflict"}';
  end if;
  result := app.google_calendar_connection_command_v1(action,expected,input);
  if action='disconnect' and result->>'kind'='ok' then
    -- The disconnect fence prevents prepared requests dispatching. Sent targets
    -- stay retired even when the user removes credentials in another tab.
    for r in delete from app.google_calendar_retirements where run_id=run and profile_id=profile and state='prepared' returning * loop
      if not exists(select 1 from app.google_calendar_retirements x where x.run_id=run and x.profile_id=profile and x.google_sub=r.google_sub and x.client_hash=r.client_hash and x.calendar_id=r.calendar_id) then
        update app.google_calendar_accounts set bootstrap_state='ready',attempt_id=r.previous_attempt_id where run_id=run and profile_id=profile and google_sub=r.google_sub and client_hash=r.client_hash and calendar_id=r.calendar_id and attempt_id=r.operation_id;
      end if;
    end loop;
  end if;
  return result;
end;
$function$;
alter function app.google_calendar_connection_command(text,uuid,jsonb) owner to app_owner;
revoke all on function app.google_calendar_connection_command(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function app.google_calendar_connection_command(text,uuid,jsonb) to app_runtime;
