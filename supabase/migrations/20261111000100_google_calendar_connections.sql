-- MOV-225. Additive, actor-bound Calendar connection storage. No provisioning,
-- backfill, Google calls or existing scheduling/Auth changes.
create table app.google_calendar_connections (
  run_id uuid not null references app.demo_runs(id) on delete cascade,
  profile_id uuid not null references app.profiles(id) on delete cascade,
  generation uuid not null default '00000000-0000-0000-0000-000000000000',
  state text not null default 'disconnected' check (state in ('disconnected','connecting','connected','reconnect-required','recovery-required')),
  previous_state text not null default 'disconnected' check (previous_state in ('disconnected','connected','reconnect-required','recovery-required')),
  google_sub text check (length(google_sub) between 1 and 255),
  google_email text check (length(google_email) between 3 and 320),
  client_hash text check (client_hash ~ '^[a-f0-9]{64}$'),
  credential_ciphertext text check (length(credential_ciphertext) between 1 and 16000),
  pending_state_hash text check (pending_state_hash ~ '^[a-f0-9]{64}$'),
  pending_browser_hash text check (pending_browser_hash ~ '^[a-f0-9]{64}$'),
  pending_session_id uuid,
  pending_verifier_ciphertext text check (length(pending_verifier_ciphertext) between 1 and 4000),
  operation_id uuid,
  expires_at timestamptz,
  checked_at timestamptz,
  primary key (run_id, profile_id)
);
create table app.google_calendar_accounts (
  run_id uuid not null,
  profile_id uuid not null,
  google_sub text not null check (length(google_sub) between 1 and 255),
  client_hash text not null check (client_hash ~ '^[a-f0-9]{64}$'),
  calendar_id text check (length(calendar_id) between 3 and 1024 and calendar_id <> 'primary'),
  bootstrap_state text not null check (bootstrap_state in ('uncertain','ready')),
  attempt_id uuid not null,
  primary key (run_id, profile_id, google_sub, client_hash),
  foreign key (run_id, profile_id) references app.google_calendar_connections(run_id,profile_id) on delete cascade
);
alter table app.google_calendar_connections owner to app_owner;
alter table app.google_calendar_accounts owner to app_owner;
alter table app.google_calendar_connections enable row level security;
alter table app.google_calendar_connections force row level security;
alter table app.google_calendar_accounts enable row level security;
alter table app.google_calendar_accounts force row level security;
create policy google_calendar_owner on app.google_calendar_connections to app_owner using (true) with check (true);
create policy google_calendar_owner on app.google_calendar_accounts to app_owner using (true) with check (true);
revoke all on app.google_calendar_connections, app.google_calendar_accounts from public, anon, authenticated, service_role, app_runtime;

create function app.google_calendar_connection_status() returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare c app.google_calendar_connections; calendar text;
begin
  if not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'Calendar actor is invalid';
  end if;
  select * into c from app.google_calendar_connections
    where run_id = pg_catalog.current_setting('app.current_run_id')::uuid
    and profile_id = pg_catalog.current_setting('app.current_profile_id')::uuid;
  if not found then
    return pg_catalog.jsonb_build_object('state','disconnected','generation','00000000-0000-0000-0000-000000000000','email',null,'calendarId',null,'checkedAt',null);
  end if;
  select calendar_id into calendar from app.google_calendar_accounts
    where run_id=c.run_id and profile_id=c.profile_id and google_sub=c.google_sub and client_hash=c.client_hash;
  return pg_catalog.jsonb_build_object(
    'state',case when c.state='connecting' and c.expires_at <= pg_catalog.clock_timestamp() then 'reconnect-required' else c.state end,
    'generation',c.generation,'email',c.google_email,'calendarId',calendar,'checkedAt',c.checked_at);
end;
$function$;

-- Private server protocol. Ciphertexts remain encrypted with server-held keys;
-- browser/database API roles cannot execute this or read the underlying tables.
create function app.google_calendar_connection_command(action text, expected uuid, input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  c app.google_calendar_connections; a app.google_calendar_accounts;
  run uuid := pg_catalog.current_setting('app.current_run_id',true)::uuid;
  profile uuid := pg_catalog.current_setting('app.current_profile_id',true)::uuid;
  verifier text; mode text; op uuid;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'Calendar actor is invalid'; end if;
  if input is null or pg_catalog.jsonb_typeof(input)<>'object' or pg_catalog.pg_column_size(input)>24000 then raise exception 'Calendar command is invalid'; end if;
  if action not in ('begin','claim-callback','credentials','claim-check','heartbeat','bootstrap','record-calendar','finish','disconnect') then raise exception 'Calendar command is invalid'; end if;
  if action='begin' then
    insert into app.google_calendar_connections(run_id,profile_id) values(run,profile) on conflict do nothing;
  end if;
  select * into c from app.google_calendar_connections where run_id=run and profile_id=profile for update;
  if not found then
    if action='disconnect' then return '{"kind":"ok"}'; end if;
    return '{"kind":"conflict"}';
  end if;
  if action='disconnect' and c.state='disconnected' then return '{"kind":"ok"}'; end if;
  if action not in ('claim-callback','record-calendar') and expected is distinct from c.generation then return '{"kind":"conflict"}'; end if;

  if action='disconnect' then
    update app.google_calendar_connections set generation=pg_catalog.gen_random_uuid(),state='disconnected',previous_state='disconnected',
      credential_ciphertext=null,pending_state_hash=null,pending_browser_hash=null,pending_session_id=null,pending_verifier_ciphertext=null,operation_id=null,expires_at=null,checked_at=null
      where run_id=run and profile_id=profile;
    return '{"kind":"ok"}';
  elsif action='begin' then
    if c.state='connecting' and c.expires_at > pg_catalog.clock_timestamp() then return '{"kind":"conflict"}'; end if;
    if coalesce(input->>'stateHash','') !~ '^[a-f0-9]{64}$' or coalesce(input->>'browserHash','') !~ '^[a-f0-9]{64}$' or
      length(coalesce(input->>'verifier','')) not between 1 and 4000 or input->>'sessionId' is null then raise exception 'Calendar command is invalid'; end if;
    update app.google_calendar_connections set generation=pg_catalog.gen_random_uuid(),
      previous_state=case when c.state='connecting' then 'reconnect-required' else c.state end,
      state='connecting',pending_state_hash=input->>'stateHash',pending_browser_hash=input->>'browserHash',pending_session_id=(input->>'sessionId')::uuid,
      pending_verifier_ciphertext=input->>'verifier',operation_id=null,expires_at=pg_catalog.clock_timestamp()+interval '10 minutes'
      where run_id=run and profile_id=profile returning * into c;
  elsif action='claim-callback' then
    if c.state<>'connecting' or c.pending_state_hash is null or c.pending_state_hash is distinct from input->>'stateHash' or
      c.pending_browser_hash is distinct from input->>'browserHash' or c.pending_session_id is distinct from (input->>'sessionId')::uuid or
      c.expires_at <= pg_catalog.clock_timestamp() then return '{"kind":"conflict"}'; end if;
    verifier := c.pending_verifier_ciphertext;
    update app.google_calendar_connections set pending_state_hash=null,pending_browser_hash=null,pending_session_id=null,pending_verifier_ciphertext=null,
      operation_id=(input->>'operationId')::uuid,expires_at=pg_catalog.clock_timestamp()+interval '2 minutes'
      where run_id=run and profile_id=profile returning * into c;
  elsif action='claim-check' then
    if c.state='disconnected' or c.credential_ciphertext is null then return '{"kind":"reconnect-required"}'; end if;
    if exists(select 1 from app.google_calendar_accounts x where x.run_id=run and x.profile_id=profile and x.attempt_id=(input->>'operationId')::uuid) then return '{"kind":"conflict"}'; end if;
    if c.state='connecting' and c.expires_at > pg_catalog.clock_timestamp() then return '{"kind":"conflict"}'; end if;
    update app.google_calendar_connections set previous_state=case when c.state='connecting' then 'reconnect-required' else c.state end,
      state='connecting',operation_id=(input->>'operationId')::uuid,expires_at=pg_catalog.clock_timestamp()+interval '2 minutes',
      pending_state_hash=null,pending_browser_hash=null,pending_session_id=null,pending_verifier_ciphertext=null
      where run_id=run and profile_id=profile returning * into c;
  elsif action='record-calendar' then
    -- A known response may arrive after disconnect. Save the mapping only;
    -- never reactivate the disconnected/replaced connection.
    if length(coalesce(input->>'calendarId','')) not between 3 and 1024 or input->>'calendarId'='primary' then raise exception 'Calendar response is invalid'; end if;
    update app.google_calendar_accounts set calendar_id=input->>'calendarId',bootstrap_state='ready'
      where run_id=run and profile_id=profile and google_sub=input->>'sub' and client_hash=input->>'clientHash'
      and attempt_id=(input->>'operationId')::uuid;
    if not found then return '{"kind":"conflict"}'; end if;
  else
    op := (input->>'operationId')::uuid;
    if c.state<>'connecting' or c.operation_id is null or c.operation_id is distinct from op or c.expires_at <= pg_catalog.clock_timestamp() then return '{"kind":"conflict"}'; end if;
    if action='credentials' then
      if c.previous_state<>'disconnected' and c.google_sub is not null and c.google_sub is distinct from input->>'sub' then return '{"kind":"account-mismatch"}'; end if;
      if length(coalesce(input->>'sub','')) not between 1 and 255 or length(coalesce(input->>'email','')) not between 3 and 320 or
        coalesce(input->>'clientHash','') !~ '^[a-f0-9]{64}$' or length(coalesce(input->>'credential','')) not between 1 and 16000 then raise exception 'Calendar credential is invalid'; end if;
      update app.google_calendar_connections set google_sub=input->>'sub',google_email=input->>'email',client_hash=input->>'clientHash',credential_ciphertext=input->>'credential'
        where run_id=run and profile_id=profile returning * into c;
    elsif action='bootstrap' then
      if c.google_sub is null or c.credential_ciphertext is null then return '{"kind":"reconnect-required"}'; end if;
      select * into a from app.google_calendar_accounts where run_id=run and profile_id=profile and google_sub=c.google_sub and client_hash=c.client_hash for update;
      if input->>'recoverId' is not null then
        if c.previous_state<>'recovery-required' then return '{"kind":"conflict"}'; end if;
        mode := 'recover';
      elsif coalesce((input->>'replace')::boolean,false) then
        if c.previous_state<>'recovery-required' then return '{"kind":"conflict"}'; end if;
        mode := 'create';
      elsif a.bootstrap_state='ready' then mode := 'verify';
      elsif a.bootstrap_state='uncertain' then return '{"kind":"recovery-required"}';
      else mode := 'create'; end if;
      if mode in ('create','recover') then
        insert into app.google_calendar_accounts(run_id,profile_id,google_sub,client_hash,bootstrap_state,attempt_id)
          values(run,profile,c.google_sub,c.client_hash,'uncertain',op)
          on conflict(run_id,profile_id,google_sub,client_hash) do update set bootstrap_state='uncertain',attempt_id=op;
      end if;
    elsif action='finish' then
      if input->>'state' not in ('disconnected','connected','reconnect-required','recovery-required') then raise exception 'Calendar result is invalid'; end if;
      if input->>'state'='connected' and (c.credential_ciphertext is null or not exists(select 1 from app.google_calendar_accounts x where x.run_id=run and x.profile_id=profile and x.google_sub=c.google_sub and x.client_hash=c.client_hash and x.bootstrap_state='ready' and x.calendar_id is not null)) then return '{"kind":"conflict"}'; end if;
      update app.google_calendar_connections set state=input->>'state',operation_id=null,expires_at=null,
        checked_at=case when input->>'state'='connected' and input->>'verified'='true' then pg_catalog.clock_timestamp() else checked_at end
        where run_id=run and profile_id=profile returning * into c;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('kind','ok','record',pg_catalog.to_jsonb(c),'verifier',verifier,'mode',mode,'calendarId',a.calendar_id);
end;
$function$;
alter function app.google_calendar_connection_status() owner to app_owner;
alter function app.google_calendar_connection_command(text,uuid,jsonb) owner to app_owner;
revoke all on function app.google_calendar_connection_status(), app.google_calendar_connection_command(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function app.google_calendar_connection_status(), app.google_calendar_connection_command(text,uuid,jsonb) to app_runtime;
