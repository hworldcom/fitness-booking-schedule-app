-- MOV-226: optional confirmed-booking copies. No provisioning, backfill,
-- existing booking changes, Google calls or notification-queue changes.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='app_calendar_worker') then
    create role app_calendar_worker nologin nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;
grant usage on schema app to app_calendar_worker;

create table app.google_calendar_exports (
  run_id uuid not null,
  profile_id uuid not null,
  enabled boolean not null default false,
  version uuid not null default gen_random_uuid(),
  google_sub text,
  client_hash text,
  last_generation uuid,
  last_claim_at timestamptz,
  backfill_kind text not null default 'private' check(backfill_kind in ('private','group','done')),
  backfill_cursor uuid not null default '00000000-0000-0000-0000-000000000000',
  last_command uuid,
  last_command_hash text,
  primary key(run_id,profile_id),
  foreign key(run_id,profile_id) references app.google_calendar_connections on delete cascade
);
create table app.google_calendar_export_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  google_sub text not null,
  client_hash text not null,
  calendar_id text not null check(calendar_id<>'primary' and length(calendar_id) between 3 and 1024),
  source_kind text not null check(source_kind in ('private','group')),
  source_id uuid not null,
  event_id text not null default ('m'||replace(gen_random_uuid()::text,'-','')) check(length(event_id) between 5 and 1024 and event_id ~ '^[a-v0-9]+$'),
  marker uuid not null default gen_random_uuid(),
  active boolean not null default true,
  dispatched boolean not null default false,
  ever_delivered boolean not null default false,
  deleted_confirmed boolean not null default false,
  delivered_hash text,
  synced_at timestamptz,
  foreign key(run_id,profile_id) references app.google_calendar_connections on delete cascade,
  unique(calendar_id,event_id)
);
create unique index google_calendar_export_current_event on app.google_calendar_export_events
  (run_id,profile_id,google_sub,client_hash,calendar_id,source_kind,source_id) where active;
create table app.google_calendar_export_jobs (
  event_id uuid primary key references app.google_calendar_export_events on delete cascade,
  revision bigint not null default 1,
  state text not null default 'pending' check(state in ('pending','leased','delivered','retained','failed','suppressed')),
  attempts integer not null default 0 check(attempts between 0 and 8),
  next_at timestamptz not null default clock_timestamp(),
  lease_id uuid,
  lease_until timestamptz,
  lease_revision bigint,
  lease_version uuid,
  lease_generation uuid,
  lease_hash text,
  lease_credential_hash text,
  error text check(error in ('transient','authorization-required','calendar-missing','event-missing','ownership-conflict','outcome-unknown','retry-exhausted'))
);
create index google_calendar_export_pending on app.google_calendar_export_jobs(next_at,event_id) where state in ('pending','leased');
do $$ declare tab text; begin
  foreach tab in array array['google_calendar_exports','google_calendar_export_events','google_calendar_export_jobs'] loop
    execute format('alter table app.%I owner to app_owner',tab);
    execute format('alter table app.%I enable row level security',tab);
    execute format('alter table app.%I force row level security',tab);
    execute format('create policy export_owner on app.%I to app_owner using(true) with check(true)',tab);
    execute format('revoke all on app.%I from public,anon,authenticated,service_role,app_runtime,app_calendar_worker',tab);
  end loop;
end $$;

-- The projection never returns another participant's identity or private text.
-- Missing/no-longer-owned sources permit cleanup of a previously mapped copy,
-- never creation or disclosure of the newly unrelated source.
create function app.google_calendar_export_enter() returns jsonb language plpgsql set search_path='' as $$
declare flags jsonb:='{}'; flag text;
begin
  foreach flag in array array['app.coach_booking_management','app.coach_availability_management','app.group_session_management'] loop
    flags:=flags||jsonb_build_object(flag,coalesce(current_setting(flag,true),''));
    perform set_config(flag,'on',true);
  end loop;
  return flags;
end $$;
create function app.google_calendar_export_source_impl(dataset uuid,recipient uuid,kind text,source uuid)
returns jsonb language plpgsql stable set search_path='' as $$
declare b app.coach_private_bookings; g app.coach_group_sessions; venue text; path text; starts timestamptz; ends timestamptz;
begin
  if kind='private' then
    select * into b from app.coach_private_bookings where run_id=dataset and id=source and credit_projection_id is null;
    if b.id is null or recipient not in (b.coach_profile_id,coalesce(b.client_profile_id,b.coach_profile_id)) then return '{"action":"delete"}'; end if;
    if b.status='cancelled' then return '{"action":"delete"}'; end if;
    if b.status='completed' or (b.status in ('confirmed','cancellation-requested') and b.scheduled_start_at<=statement_timestamp()) then return '{"action":"retain"}'; end if;
    if b.status not in ('confirmed','cancellation-requested') then return '{"action":"delete"}'; end if;
    select left(coalesce(s.training_location_name,s.gym_name,s.public_location_label,''),500) into venue from app.coach_availability_slots s where s.run_id=dataset and s.id=b.slot_id;
    starts:=b.scheduled_start_at; ends:=b.scheduled_end_at;
    path:=case when recipient=b.coach_profile_id then '/coach/sessions/' else '/sessions/' end||b.id::text;
  elsif kind='group' then
    select * into g from app.coach_group_sessions where run_id=dataset and id=source;
    if g.id is null or (recipient<>g.coach_profile_id and not exists(
      select 1 from app.coach_group_registrations r where r.run_id=dataset and r.session_id=g.id and r.athlete_profile_id=recipient and r.status='active' and r.decision='approved'
    )) then return '{"action":"delete"}'; end if;
    if g.status<>'confirmed' then return '{"action":"delete"}'; end if;
    if g.starts_at<=statement_timestamp() then return '{"action":"retain"}'; end if;
    starts:=g.starts_at; ends:=g.ends_at; venue:=left(coalesce(g.venue_snapshot->>'label',g.venue_snapshot->>'name',''),500);
    path:=case when recipient=g.coach_profile_id then '/coach/events/'||g.id::text else '/sessions/groups' end;
  else raise exception 'Invalid export source'; end if;
  return jsonb_build_object('action','upsert','title',case kind when 'private' then 'MovX private session' else 'MovX group session' end,
    'startsAt',starts,'endsAt',ends,'location',coalesce(venue,''),'path',path);
end $$;

create function app.google_calendar_export_source(dataset uuid,recipient uuid,kind text,source uuid)
returns jsonb language plpgsql set search_path='' as $$
declare flags jsonb; result jsonb;
begin
  flags:=app.google_calendar_export_enter();
  result:=app.google_calendar_export_source_impl(dataset,recipient,kind,source);
  perform app.mail_trigger_leave(flags); return result;
exception when others then if flags is not null then perform app.mail_trigger_leave(flags); end if; raise;
end $$;

create function app.google_calendar_export_enqueue(dataset uuid,recipient uuid,kind text,source uuid,force_retry boolean default false)
returns void language plpgsql set search_path='' as $$
declare c app.google_calendar_connections; pref app.google_calendar_exports; calendar text; e app.google_calendar_export_events; desired jsonb;
begin
  select * into pref from app.google_calendar_exports where run_id=dataset and profile_id=recipient and enabled;
  if not found then return; end if;
  select * into c from app.google_calendar_connections where run_id=dataset and profile_id=recipient;
  if c.google_sub is distinct from pref.google_sub or c.client_hash is distinct from pref.client_hash or c.state='disconnected' then return; end if;
  select a.calendar_id into calendar from app.google_calendar_accounts a where a.run_id=dataset and a.profile_id=recipient
    and a.google_sub=c.google_sub and a.client_hash=c.client_hash and a.bootstrap_state='ready';
  if calendar is null or exists(select 1 from app.google_calendar_retirements r where r.run_id=dataset and r.profile_id=recipient and r.google_sub=c.google_sub and r.client_hash=c.client_hash and r.calendar_id=calendar) then return; end if;
  desired:=app.google_calendar_export_source(dataset,recipient,kind,source);
  select * into e from app.google_calendar_export_events where run_id=dataset and profile_id=recipient and google_sub=c.google_sub and client_hash=c.client_hash and calendar_id=calendar and source_kind=kind and source_id=source and active;
  if e.id is null and desired->>'action'<>'upsert' then return; end if;
  if e.deleted_confirmed and desired->>'action'='upsert' then
    update app.google_calendar_export_events set active=false where id=e.id;
    update app.google_calendar_export_jobs set state='suppressed',lease_id=null,lease_until=null where event_id=e.id;
    e.id:=null;
  end if;
  if e.id is null then
    insert into app.google_calendar_export_events(run_id,profile_id,google_sub,client_hash,calendar_id,source_kind,source_id)
      values(dataset,recipient,c.google_sub,c.client_hash,calendar,kind,source)
      on conflict(run_id,profile_id,google_sub,client_hash,calendar_id,source_kind,source_id) where active do nothing returning * into e;
    if e.id is null then select * into e from app.google_calendar_export_events where run_id=dataset and profile_id=recipient and google_sub=c.google_sub and client_hash=c.client_hash and calendar_id=calendar and source_kind=kind and source_id=source and active; end if;
  end if;
  insert into app.google_calendar_export_jobs(event_id) values(e.id)
    on conflict(event_id) do update set revision=app.google_calendar_export_jobs.revision+1,
      state=case when app.google_calendar_export_jobs.error in ('event-missing','ownership-conflict') and not force_retry then 'failed' else 'pending' end,
      attempts=0,
      next_at=clock_timestamp(),error=case when force_retry then null else app.google_calendar_export_jobs.error end;
end $$;

create function app.capture_google_calendar_export() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; kind text; source uuid; dataset uuid; flags jsonb;
begin
  flags:=app.google_calendar_export_enter();
  if tg_table_name='coach_private_bookings' then kind:='private'; source:=new.id; dataset:=new.run_id;
  elsif tg_table_name='session_booking_changes' then kind:='private'; source:=new.booking_id; select run_id into dataset from app.coach_private_bookings where id=source;
  elsif tg_table_name='coach_group_sessions' then kind:='group'; source:=new.id; dataset:=new.run_id;
  else kind:='group'; source:=new.session_id; dataset:=new.run_id; end if;
  -- Source commits lock only their own queue rows, never a user connection or
  -- preference. Worker/owner commands consistently lock connection first.
  for recipient in
    select distinct p.profile_id from app.google_calendar_exports p where p.run_id=dataset and p.enabled and
      (exists(select 1 from app.google_calendar_export_events e where e.run_id=dataset and e.profile_id=p.profile_id and e.source_kind=kind and e.source_id=source and e.active)
       or (kind='private' and exists(select 1 from app.coach_private_bookings b where b.id=source and p.profile_id in(b.coach_profile_id,b.client_profile_id)))
       or (kind='group' and (exists(select 1 from app.coach_group_sessions g where g.id=source and g.coach_profile_id=p.profile_id)
         or exists(select 1 from app.coach_group_registrations r where r.session_id=source and r.athlete_profile_id=p.profile_id))))
    order by p.profile_id
  loop perform app.google_calendar_export_enqueue(dataset,recipient,kind,source); end loop;
  perform app.mail_trigger_leave(flags); return new;
exception when others then if flags is not null then perform app.mail_trigger_leave(flags); end if; raise;
end $$;
create trigger google_calendar_private_export after insert or update on app.coach_private_bookings for each row execute function app.capture_google_calendar_export();
create trigger google_calendar_schedule_export after insert on app.session_booking_changes for each row execute function app.capture_google_calendar_export();
create trigger google_calendar_group_export after insert or update on app.coach_group_sessions for each row execute function app.capture_google_calendar_export();
create trigger google_calendar_participation_export after insert or update on app.coach_group_registrations for each row execute function app.capture_google_calendar_export();

create function app.google_calendar_export_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare pref app.google_calendar_exports; c app.google_calendar_connections; calendar text; summary jsonb;
  dataset uuid:=current_setting('app.current_run_id',true)::uuid; recipient uuid:=current_setting('app.current_profile_id',true)::uuid;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'Invalid Calendar actor'; end if;
  select * into pref from app.google_calendar_exports where run_id=dataset and profile_id=recipient;
  select * into c from app.google_calendar_connections where run_id=dataset and profile_id=recipient;
  select a.calendar_id into calendar from app.google_calendar_accounts a where a.run_id=dataset and a.profile_id=recipient and a.google_sub=c.google_sub and a.client_hash=c.client_hash and a.bootstrap_state='ready';
  select jsonb_build_object(
    'pending',count(*) filter(where j.state in ('pending','leased')),
    'failed',count(*) filter(where j.state='failed'),
    'missing',count(*) filter(where j.state='failed' and j.error='event-missing'),
    'issues',coalesce(jsonb_agg(distinct j.error) filter(where j.state in ('pending','failed') and j.error is not null),'[]'::jsonb),
    'lastSyncedAt',max(e.synced_at)
  ) into summary from app.google_calendar_export_events e left join app.google_calendar_export_jobs j on j.event_id=e.id
    where e.run_id=dataset and e.profile_id=recipient and e.active and e.google_sub=c.google_sub and e.client_hash=c.client_hash and e.calendar_id=calendar;
  return jsonb_build_object('enabled',coalesce(pref.enabled,false),'version',coalesce(pref.version,'00000000-0000-0000-0000-000000000000'::uuid),
    'backfillPending',coalesce(pref.enabled and pref.backfill_kind<>'done',false),
    'pending',summary->'pending','failed',summary->'failed','missing',summary->'missing','issues',summary->'issues','lastSyncedAt',summary->'lastSyncedAt');
end $$;

create function app.google_calendar_export_command(action text,expected uuid,connection_generation uuid,command_id uuid,acknowledged boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare dataset uuid:=current_setting('app.current_run_id',true)::uuid; recipient uuid:=current_setting('app.current_profile_id',true)::uuid;
  c app.google_calendar_connections; pref app.google_calendar_exports; mapping_record app.google_calendar_export_events; fingerprint text;
begin
  if not app.authorized_actor_context_valid(null,null,null) or action is null or action not in ('enable','disable','retry','repair') or command_id is null or expected is null or connection_generation is null then raise exception 'Invalid export command'; end if;
  select * into c from app.google_calendar_connections where run_id=dataset and profile_id=recipient for no key update;
  if c.profile_id is null then return 'conflict'; end if;
  select * into pref from app.google_calendar_exports where run_id=dataset and profile_id=recipient for no key update;
  fingerprint:=md5(jsonb_build_array(action,expected,connection_generation,acknowledged)::text);
  if pref.last_command=command_id then return case when pref.last_command_hash=fingerprint then 'ok' else 'conflict' end; end if;
  if coalesce(pref.version,'00000000-0000-0000-0000-000000000000'::uuid) is distinct from expected or c.generation is distinct from connection_generation then return 'conflict'; end if;
  if action<>'disable' and (c.state<>'connected' or c.credential_ciphertext is null or not exists(select 1 from app.google_calendar_accounts a where a.run_id=dataset and a.profile_id=recipient and a.google_sub=c.google_sub and a.client_hash=c.client_hash and a.bootstrap_state='ready' and a.calendar_id is not null)) then return 'connection-required'; end if;
  if action in ('retry','repair') and not coalesce(pref.enabled,false) then return 'conflict'; end if;
  if action='repair' and acknowledged is distinct from true then return 'invalid'; end if;
  insert into app.google_calendar_exports(run_id,profile_id) values(dataset,recipient) on conflict do nothing;
  if action in ('enable','disable') then
    update app.google_calendar_exports set enabled=action='enable',version=gen_random_uuid(),google_sub=c.google_sub,client_hash=c.client_hash,
      last_generation=c.generation,backfill_kind=case action when 'enable' then 'private' else 'done' end,backfill_cursor='00000000-0000-0000-0000-000000000000'
      where run_id=dataset and profile_id=recipient;
  elsif action='retry' then
    update app.google_calendar_exports set backfill_kind='private',backfill_cursor='00000000-0000-0000-0000-000000000000' where run_id=dataset and profile_id=recipient;
    update app.google_calendar_export_jobs j set state='pending',attempts=0,next_at=clock_timestamp(),error=null from app.google_calendar_export_events e
      where e.id=j.event_id and e.run_id=dataset and e.profile_id=recipient and e.active and e.google_sub=c.google_sub and e.client_hash=c.client_hash
      and exists(select 1 from app.google_calendar_accounts a where a.run_id=dataset and a.profile_id=recipient and a.google_sub=c.google_sub and a.client_hash=c.client_hash and a.bootstrap_state='ready' and a.calendar_id=e.calendar_id)
      and j.state='failed' and j.error <> 'event-missing';
  else
    for mapping_record in select m.* from app.google_calendar_export_events m join app.google_calendar_export_jobs j on j.event_id=m.id
      where m.run_id=dataset and m.profile_id=recipient and m.google_sub=c.google_sub and m.client_hash=c.client_hash and m.active and j.state='failed' and j.error='event-missing'
      and exists(select 1 from app.google_calendar_accounts a where a.run_id=dataset and a.profile_id=recipient and a.google_sub=c.google_sub and a.client_hash=c.client_hash and a.bootstrap_state='ready' and a.calendar_id=m.calendar_id)
      for update of m
    loop
      update app.google_calendar_export_events set active=false where id=mapping_record.id;
      update app.google_calendar_export_jobs set state='suppressed' where event_id=mapping_record.id;
      perform app.google_calendar_export_enqueue(dataset,recipient,mapping_record.source_kind,mapping_record.source_id,true);
    end loop;
  end if;
  -- Preempt only this preference's export lease, not an ordinary OAuth/check.
  if exists(select 1 from app.google_calendar_export_jobs j join app.google_calendar_export_events e on e.id=j.event_id where e.run_id=dataset and e.profile_id=recipient and j.lease_id=c.operation_id) then
    update app.google_calendar_connections set operation_id=null,expires_at=null where run_id=dataset and profile_id=recipient;
  end if;
  update app.google_calendar_exports set last_command=command_id,last_command_hash=fingerprint,
    version=case when action in ('retry','repair') then gen_random_uuid() else version end where run_id=dataset and profile_id=recipient;
  return 'ok';
end $$;

-- Reuse the connection's authority/fencing; do not expose another token owner.
create function app.capture_google_calendar_export_connection() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.state='disconnected' or (new.google_sub,new.client_hash) is distinct from (old.google_sub,old.client_hash) then
    update app.google_calendar_exports set enabled=false,version=gen_random_uuid(),backfill_kind='done',last_command=null,last_command_hash=null
      where run_id=new.run_id and profile_id=new.profile_id and enabled;
  elsif new.state='connected' then
    update app.google_calendar_exports set last_generation=new.generation,backfill_kind='private',backfill_cursor='00000000-0000-0000-0000-000000000000'
      where run_id=new.run_id and profile_id=new.profile_id and enabled and google_sub=new.google_sub and client_hash=new.client_hash and last_generation is distinct from new.generation;
  end if;
  return new;
end $$;
create trigger google_calendar_connection_export after update on app.google_calendar_connections for each row execute function app.capture_google_calendar_export_connection();

-- A delivery lease keeps connection state Connected, but serializes refresh
-- with a manual Check. OAuth begin/disconnect/delete still preempt it.
alter function app.google_calendar_connection_command(text,uuid,jsonb) rename to google_calendar_connection_command_v2;
revoke all on function app.google_calendar_connection_command_v2(text,uuid,jsonb) from public,anon,authenticated,service_role,app_runtime,app_calendar_worker;
create function app.google_calendar_connection_command(action text,expected uuid,input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c app.google_calendar_connections;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'Invalid Calendar actor'; end if;
  select * into c from app.google_calendar_connections where run_id=current_setting('app.current_run_id')::uuid and profile_id=current_setting('app.current_profile_id')::uuid for no key update;
  if action='claim-check' and c.state='connected' and c.operation_id is not null and c.expires_at>clock_timestamp() then return '{"kind":"conflict"}'; end if;
  return app.google_calendar_connection_command_v2(action,expected,input);
end $$;

-- Auth is checked only for an exact queued recipient; no role gains Auth access.
create function app.google_calendar_export_recipient_active(job uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.google_calendar_export_jobs j join app.google_calendar_export_events e on e.id=j.event_id
    join app.profiles p on p.id=e.profile_id join app.demo_run_participants m on m.run_id=e.run_id and m.profile_id=e.profile_id
    join app.demo_runs d on d.id=e.run_id join auth.users u on u.id=p.auth_user_id
    where j.event_id=job and p.record_source='user' and p.claimed_at is not null and m.status='active' and d.status='active' and d.catalogue_visibility='public'
      and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp()));
$$;
alter function app.google_calendar_export_recipient_active(uuid) owner to postgres;
revoke all on function app.google_calendar_export_recipient_active(uuid) from public,anon,authenticated,service_role,app_runtime,app_calendar_worker;
grant execute on function app.google_calendar_export_recipient_active(uuid) to app_owner;

create function app.google_calendar_export_claim_impl(configured_client text) returns jsonb
language plpgsql set search_path='' as $$
declare c app.google_calendar_connections; pref app.google_calendar_exports; e app.google_calendar_export_events;
  j app.google_calendar_export_jobs; source record; amount integer:=0; cursor_id uuid; lease uuid; calendar text;
begin
  if configured_client is null or configured_client !~ '^[a-f0-9]{64}$' then raise exception 'Invalid Calendar worker configuration'; end if;
  select x.* into c from app.google_calendar_connections x join app.google_calendar_exports p using(run_id,profile_id)
    where x.state='connected' and x.credential_ciphertext is not null and x.client_hash=configured_client and p.enabled
      and p.google_sub=x.google_sub and p.client_hash=x.client_hash
      and (x.operation_id is null or x.expires_at<=clock_timestamp())
      and not exists(select 1 from app.google_calendar_export_jobs q join app.google_calendar_export_events m on m.id=q.event_id
        where m.run_id=x.run_id and m.profile_id=x.profile_id and q.lease_until>clock_timestamp())
      and (p.backfill_kind<>'done' or exists(select 1 from app.google_calendar_export_jobs q join app.google_calendar_export_events m on m.id=q.event_id
        join app.google_calendar_accounts a on a.run_id=x.run_id and a.profile_id=x.profile_id and a.google_sub=x.google_sub and a.client_hash=x.client_hash and a.bootstrap_state='ready' and a.calendar_id=m.calendar_id
        where m.run_id=x.run_id and m.profile_id=x.profile_id and m.active and m.google_sub=x.google_sub and m.client_hash=x.client_hash
          and q.state in ('pending','leased') and q.next_at<=clock_timestamp()))
    order by p.last_claim_at nulls first,x.run_id,x.profile_id for no key update of x skip locked limit 1;
  if c.profile_id is null then return null; end if;
  select * into pref from app.google_calendar_exports where run_id=c.run_id and profile_id=c.profile_id for no key update;
  update app.google_calendar_exports set last_claim_at=clock_timestamp() where run_id=c.run_id and profile_id=c.profile_id;
  select a.calendar_id into calendar from app.google_calendar_accounts a where a.run_id=c.run_id and a.profile_id=c.profile_id
    and a.google_sub=c.google_sub and a.client_hash=c.client_hash and a.bootstrap_state='ready';
  if calendar is null or exists(select 1 from app.google_calendar_retirements r where r.run_id=c.run_id and r.profile_id=c.profile_id and r.google_sub=c.google_sub and r.client_hash=c.client_hash and r.calendar_id=calendar) then return null; end if;
  if pref.backfill_kind<>'done' then
    for source in
      select id from (
        select b.id from app.coach_private_bookings b where pref.backfill_kind='private' and b.run_id=c.run_id
          and c.profile_id in(b.coach_profile_id,b.client_profile_id) and b.credit_projection_id is null and b.status in ('confirmed','cancellation-requested') and b.scheduled_start_at>statement_timestamp()
        union
        select g.id from app.coach_group_sessions g where pref.backfill_kind='group' and g.run_id=c.run_id and g.status='confirmed' and g.starts_at>statement_timestamp()
          and (g.coach_profile_id=c.profile_id or exists(select 1 from app.coach_group_registrations r where r.run_id=c.run_id and r.session_id=g.id and r.athlete_profile_id=c.profile_id and r.status='active' and r.decision='approved'))
        union
        select m.source_id from app.google_calendar_export_events m where m.run_id=c.run_id and m.profile_id=c.profile_id and m.active
          and m.google_sub=c.google_sub and m.client_hash=c.client_hash and m.calendar_id=calendar and m.source_kind=pref.backfill_kind
      ) candidates where id>pref.backfill_cursor order by id limit 50
    loop
      perform app.google_calendar_export_enqueue(c.run_id,c.profile_id,pref.backfill_kind,source.id);
      cursor_id:=source.id;amount:=amount+1;
    end loop;
    update app.google_calendar_exports set backfill_kind=case when amount<50 then case pref.backfill_kind when 'private' then 'group' else 'done' end else pref.backfill_kind end,
      backfill_cursor=case when amount<50 then '00000000-0000-0000-0000-000000000000'::uuid else cursor_id end
      where run_id=c.run_id and profile_id=c.profile_id;
  end if;
  select q.* into j from app.google_calendar_export_jobs q join app.google_calendar_export_events m on m.id=q.event_id
    where m.run_id=c.run_id and m.profile_id=c.profile_id and m.google_sub=c.google_sub and m.client_hash=c.client_hash and m.calendar_id=calendar and m.active
      and q.state in ('pending','leased') and q.next_at<=clock_timestamp() and (q.lease_until is null or q.lease_until<=clock_timestamp())
    order by q.next_at,q.event_id for update of q skip locked limit 1;
  if j.event_id is null then return '{"kind":"progress"}'; end if;
  if not app.google_calendar_export_recipient_active(j.event_id) then
    update app.google_calendar_export_jobs set state='suppressed',lease_id=null,lease_until=null where event_id=j.event_id;
    return '{"kind":"progress"}';
  end if;
  if j.attempts>=8 then
    update app.google_calendar_export_jobs set state='failed',error='retry-exhausted',lease_id=null,lease_until=null where event_id=j.event_id;
    return '{"kind":"progress"}';
  end if;
  lease:=gen_random_uuid();
  update app.google_calendar_export_jobs set state='leased',lease_id=lease,lease_until=clock_timestamp()+interval '2 minutes',
    lease_revision=revision,lease_version=pref.version,lease_generation=c.generation,lease_hash=null,attempts=attempts+1 where event_id=j.event_id;
  update app.google_calendar_connections set operation_id=lease,expires_at=clock_timestamp()+interval '2 minutes' where run_id=c.run_id and profile_id=c.profile_id;
  return jsonb_build_object('kind','claimed','id',j.event_id,'leaseId',lease);
end $$;

create function app.google_calendar_export_claim(configured_client text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare flags jsonb; result jsonb;
begin
  flags:=app.google_calendar_export_enter();
  result:=app.google_calendar_export_claim_impl(configured_client);
  perform app.mail_trigger_leave(flags); return result;
exception when others then if flags is not null then perform app.mail_trigger_leave(flags); end if; raise;
end $$;

-- One private command surface for a previously claimed job, never a fabricated
-- user session. Each transaction rechecks source/consent/connection authority.
create function app.google_calendar_export_work(job uuid,lease uuid,action text,input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c app.google_calendar_connections; pref app.google_calendar_exports; e app.google_calendar_export_events; j app.google_calendar_export_jobs;
  desired jsonb; digest text; valid boolean; result text; delay integer;
begin
  if job is null or lease is null or action is null or action not in ('prepare','credential','checkpoint','dispatch','finish') or input is null or jsonb_typeof(input)<>'object' or pg_column_size(input)>20000 then raise exception 'Invalid export work'; end if;
  select * into e from app.google_calendar_export_events where id=job;
  if e.id is null then return '{"kind":"stale"}'; end if;
  select * into c from app.google_calendar_connections where run_id=e.run_id and profile_id=e.profile_id for no key update;
  select * into pref from app.google_calendar_exports where run_id=e.run_id and profile_id=e.profile_id for no key update;
  select * into e from app.google_calendar_export_events where id=job for no key update;
  select * into j from app.google_calendar_export_jobs where event_id=job for update;
  if j.lease_id is distinct from lease then return '{"kind":"stale"}'; end if;
  valid:=e.active and pref.enabled and pref.version=j.lease_version and c.state='connected' and c.generation=j.lease_generation
    and c.operation_id=lease and c.expires_at>clock_timestamp() and j.lease_until>clock_timestamp()
    and j.revision=j.lease_revision and c.google_sub=e.google_sub and c.client_hash=e.client_hash
    and pref.google_sub=e.google_sub and pref.client_hash=e.client_hash
    and exists(select 1 from app.google_calendar_accounts a where a.run_id=e.run_id and a.profile_id=e.profile_id and a.google_sub=e.google_sub and a.client_hash=e.client_hash and a.calendar_id=e.calendar_id and a.bootstrap_state='ready')
    and not exists(select 1 from app.google_calendar_retirements r where r.run_id=e.run_id and r.profile_id=e.profile_id and r.google_sub=e.google_sub and r.client_hash=e.client_hash and r.calendar_id=e.calendar_id)
    and app.google_calendar_export_recipient_active(job);
  desired:=app.google_calendar_export_source(e.run_id,e.profile_id,e.source_kind,e.source_id);
  digest:=md5(desired::text);
  if action<>'prepare' then valid:=valid and j.lease_hash=digest; end if;
  if action='credential' and not coalesce(valid,false)
    and j.lease_until>clock_timestamp() and c.state='connected' and c.generation=j.lease_generation
    and c.google_sub=e.google_sub and c.client_hash=e.client_hash and c.credential_ciphertext is not null
    and (c.operation_id is null or c.operation_id=lease) and md5(c.credential_ciphertext)=j.lease_credential_hash then
    if length(coalesce(input->>'credential','')) not between 1 and 16000 then raise exception 'Invalid encrypted Calendar credential'; end if;
    update app.google_calendar_connections set credential_ciphertext=input->>'credential' where run_id=e.run_id and profile_id=e.profile_id;
    return '{"kind":"stale"}';
  end if;
  if action='finish' then
    result:=input->>'result';
    if result is null or result not in ('upserted','deleted','retained','transient','authorization-required','calendar-missing','event-missing','ownership-conflict','outcome-unknown') then raise exception 'Invalid export outcome'; end if;
    if coalesce(valid,false) and ((result='upserted' and (desired->>'action'<>'upsert' or not e.dispatched))
      or (result='deleted' and desired->>'action'<>'delete') or (result='retained' and desired->>'action'<>'retain')) then
      raise exception 'Export outcome does not match current source';
    end if;
    -- Save a known deletion of this exact old event even if consent changed,
    -- without touching a replacement event or reactivating a connection.
    if result='deleted' then update app.google_calendar_export_events set deleted_confirmed=true where id=e.id; end if;
    if not coalesce(valid,false) then
      update app.google_calendar_export_jobs set state=case when e.active and pref.enabled then 'pending' else 'suppressed' end,
        lease_id=null,lease_until=null,next_at=clock_timestamp() where event_id=job and lease_id=lease;
    elsif result in ('upserted','deleted','retained') then
      update app.google_calendar_export_jobs set state=case result when 'retained' then 'retained' else 'delivered' end,error=null,attempts=0,lease_id=null,lease_until=null where event_id=job;
      update app.google_calendar_export_events set ever_delivered=ever_delivered or result='upserted',
        delivered_hash=case when result='upserted' then digest else delivered_hash end,
        synced_at=case when result in ('upserted','deleted') then clock_timestamp() else synced_at end where id=job;
    else
      delay:=least(3600,(15*power(2,least(j.attempts,7)))::integer);
      update app.google_calendar_export_jobs set state=case when result in ('transient','outcome-unknown') and attempts<8 then 'pending' else 'failed' end,
        error=case when result='transient' and attempts>=8 then 'retry-exhausted' else result end,
        next_at=clock_timestamp()+make_interval(secs=>delay),lease_id=null,lease_until=null where event_id=job;
      if result in ('authorization-required','calendar-missing') then
        update app.google_calendar_connections set state=case result when 'authorization-required' then 'reconnect-required' else 'recovery-required' end,
          generation=gen_random_uuid(),operation_id=null,expires_at=null where run_id=e.run_id and profile_id=e.profile_id and generation=j.lease_generation and operation_id=lease;
      end if;
    end if;
    update app.google_calendar_connections set operation_id=null,expires_at=null where run_id=e.run_id and profile_id=e.profile_id and operation_id=lease;
    if result='deleted' and not coalesce(valid,false) and e.active and pref.enabled and c.google_sub=e.google_sub and c.client_hash=e.client_hash then
      perform app.google_calendar_export_enqueue(e.run_id,e.profile_id,e.source_kind,e.source_id);
    end if;
    return jsonb_build_object('kind',case when coalesce(valid,false) then 'ok' else 'stale' end);
  end if;
  if not coalesce(valid,false) then return '{"kind":"stale"}'; end if;
  if action='prepare' then
    update app.google_calendar_export_jobs set lease_hash=digest,lease_credential_hash=md5(c.credential_ciphertext) where event_id=job;
    return jsonb_build_object('kind','prepared','profileId',e.profile_id,'runId',e.run_id,'calendarId',e.calendar_id,'eventId',e.event_id,
      'marker',e.marker,'credential',c.credential_ciphertext,'everDelivered',e.ever_delivered,'dispatched',e.dispatched,'desired',desired);
  elsif action='credential' then
    if length(coalesce(input->>'credential','')) not between 1 and 16000 then raise exception 'Invalid encrypted Calendar credential'; end if;
    update app.google_calendar_connections set credential_ciphertext=input->>'credential' where run_id=e.run_id and profile_id=e.profile_id;
  elsif action='dispatch' then
    update app.google_calendar_export_events set dispatched=true where id=job;
  end if;
  return '{"kind":"ok"}';
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and (p.proname in ('google_calendar_export_enter','google_calendar_export_source_impl','google_calendar_export_source','google_calendar_export_enqueue','capture_google_calendar_export',
      'google_calendar_export_status','google_calendar_export_command','capture_google_calendar_export_connection',
      'google_calendar_connection_command','google_calendar_export_claim_impl','google_calendar_export_claim','google_calendar_export_work'))
  loop
    execute format('alter function %s owner to app_owner',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime,app_calendar_worker',f.signature);
  end loop;
end $$;
grant execute on function app.google_calendar_export_status(),app.google_calendar_export_command(text,uuid,uuid,uuid,boolean),
  app.google_calendar_connection_command(text,uuid,jsonb) to app_runtime;
grant execute on function app.google_calendar_export_claim(text),app.google_calendar_export_work(uuid,uuid,text,jsonb) to app_calendar_worker;
