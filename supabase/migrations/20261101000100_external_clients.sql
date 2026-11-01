-- MOV-158: real coach-owned contacts and canonical reservations without Auth identities.
create table app.coach_external_clients (
 id uuid primary key default gen_random_uuid(), run_id uuid not null, coach_profile_id uuid not null,
 name text not null check(name=btrim(name) and char_length(name) between 1 and 120 and octet_length(name)<=480 and name !~ '[[:cntrl:]]'),
 email text check(email=lower(btrim(email)) and char_length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 revision integer not null default 0 check(revision>=0), linked_profile_id uuid, linked_at timestamptz,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(run_id,coach_profile_id,id),
 foreign key(run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id),
 foreign key(run_id,linked_profile_id) references app.demo_run_participants(run_id,profile_id),
 check((linked_profile_id is null)=(linked_at is null)),check(linked_profile_id is distinct from coach_profile_id)
);
create unique index coach_external_clients_email on app.coach_external_clients(run_id,coach_profile_id,email) where email is not null;
create table app.external_client_operations (
 run_id uuid not null,actor_id uuid not null,operation_id uuid not null,payload jsonb not null,result jsonb not null,
 primary key(run_id,actor_id,operation_id),foreign key(run_id,actor_id) references app.demo_run_participants(run_id,profile_id)
);
alter table app.coach_external_clients owner to app_owner;
alter table app.external_client_operations owner to app_owner;
alter table app.coach_external_clients enable row level security;
alter table app.coach_external_clients force row level security;
alter table app.external_client_operations enable row level security;
alter table app.external_client_operations force row level security;
create policy owner_internal on app.coach_external_clients to app_owner using(true) with check(true);
create policy owner_internal on app.external_client_operations to app_owner using(true) with check(true);
revoke all on app.coach_external_clients,app.external_client_operations from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
alter table app.coach_private_bookings alter column client_profile_id drop not null;
alter table app.coach_private_bookings add column external_client_id uuid;
alter table app.coach_private_bookings add constraint private_booking_external_owner foreign key(run_id,coach_profile_id,external_client_id) references app.coach_external_clients(run_id,coach_profile_id,id);
alter table app.coach_private_bookings add constraint private_booking_real_participant check(client_profile_id is not null or (external_client_id is not null and credit_projection_id is null));
create index private_bookings_external_client on app.coach_private_bookings(external_client_id,scheduled_start_at desc,id) where external_client_id is not null;

create function app.guard_external_booking() returns trigger language plpgsql security definer set search_path='' as $$
declare e app.coach_external_clients;begin
 if tg_op='UPDATE' and old.external_client_id is not null then
  if old.external_client_id is distinct from new.external_client_id or (old.client_profile_id is not null and old.client_profile_id is distinct from new.client_profile_id) then
   raise exception 'external booking identity is immutable' using errcode='23514';end if;
 end if;
 if new.external_client_id is not null then
  select * into e from app.coach_external_clients where id=new.external_client_id and run_id=new.run_id and coach_profile_id=new.coach_profile_id;
  if e.id is null or new.client_profile_id is distinct from e.linked_profile_id or new.credit_projection_id is not null then raise exception 'external booking identity mismatch' using errcode='23514';end if;
 end if;return new;end $$;
alter function app.guard_external_booking() owner to app_owner;
revoke all on function app.guard_external_booking() from public,anon,authenticated,app_runtime;
create trigger guard_external_booking before insert or update on app.coach_private_bookings for each row execute function app.guard_external_booking();

create function app.external_client_json(e app.coach_external_clients) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e.id,'name',e.name,'email',e.email,'revision',e.revision,'linkedProfileId',e.linked_profile_id,'createdAt',e.created_at)
$$;
alter function app.external_client_json(app.coach_external_clients) owner to app_owner;
revoke all on function app.external_client_json(app.coach_external_clients) from public,anon,authenticated,app_runtime;

create function app.external_clients(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid;dataset uuid;flags jsonb;e app.coach_external_clients;op app.external_client_operations;answer jsonb;page jsonb;cursor uuid;offset_n integer;name_value text;email_value text;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'external client forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
 if action not in('list','detail','create','update') or action is null or jsonb_typeof(args) is distinct from 'object' or octet_length(args::text)>4096 then raise exception 'external client invalid' using errcode='22023';end if;
 flags:=app.availability_enter();
 if not exists(select 1 from app.coach_profiles where run_id=dataset and profile_id=actor) then raise exception 'external client forbidden' using errcode='42501';end if;
 if action='list' then
  if args-array['after','unlinked']<>'{}'::jsonb then raise exception 'external client invalid' using errcode='22023';end if;
  cursor:=(args->>'after')::uuid;
  with rows as(select * from app.coach_external_clients where run_id=dataset and coach_profile_id=actor and (cursor is null or id>cursor) and (coalesce((args->>'unlinked')::boolean,false)=false or linked_profile_id is null) order by id limit 21)
  select jsonb_build_object('items',coalesce((select jsonb_agg(app.external_client_json(r) order by r.id) from (select * from rows order by id limit 20) r),'[]'::jsonb),'next',case when (select count(*) from rows)>20 then (select id from rows order by id offset 19 limit 1) end) into answer;
 elsif action='detail' then
  if args-array['id','offset']<>'{}'::jsonb then raise exception 'external client invalid' using errcode='22023';end if;
  select * into e from app.coach_external_clients where id=(args->>'id')::uuid and run_id=dataset and coach_profile_id=actor;
  if e.id is null then raise exception 'external client forbidden' using errcode='42501';end if;
  offset_n:=coalesce((args->>'offset')::integer,0);
  if offset_n<0 or offset_n>500 then raise exception 'external client invalid' using errcode='22023';end if;
  with rows as(select * from app.coach_private_bookings where external_client_id=e.id order by scheduled_start_at desc,id limit 21 offset offset_n)
  select jsonb_build_object('client',app.external_client_json(e),'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'startsAt',r.scheduled_start_at,'endsAt',r.scheduled_end_at,'status',r.status) order by r.scheduled_start_at desc,r.id) from (select * from rows order by scheduled_start_at desc,id limit 20) r),'[]'::jsonb),'nextOffset',case when (select count(*) from rows)>20 then offset_n+20 end) into answer;
 else
  if not app.group_coach_enabled(dataset,actor,false) then raise exception 'external client forbidden' using errcode='42501';end if;
  if args-array['operationId','id','revision','name','email']<>'{}'::jsonb or args->>'operationId' is null or jsonb_typeof(args->'name') is distinct from 'string' or (args->'email' is not null and jsonb_typeof(args->'email') not in('null','string')) then raise exception 'external client invalid' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',actor::text),0));
  select * into op from app.external_client_operations where run_id=dataset and actor_id=actor and operation_id=(args->>'operationId')::uuid;
  if found then
   if op.payload is distinct from jsonb_build_object('action',action,'args',args) then raise exception 'external client altered retry' using errcode='P0001';end if;
   perform app.availability_leave(flags);return op.result;
  end if;
  name_value:=btrim(args->>'name');email_value:=nullif(lower(btrim(args->>'email')),'');
  if action='create' then
   if args?'id' or args?'revision' then raise exception 'external client invalid' using errcode='22023';end if;
   if (select count(*) from app.coach_external_clients where run_id=dataset and coach_profile_id=actor)>=1000 then raise exception 'external client limit' using errcode='P0001';end if;
   insert into app.coach_external_clients(run_id,coach_profile_id,name,email) values(dataset,actor,name_value,email_value) returning * into e;
  else
   select * into e from app.coach_external_clients where id=(args->>'id')::uuid and run_id=dataset and coach_profile_id=actor for update;
   if e.id is null then raise exception 'external client forbidden' using errcode='42501';end if;
   if e.revision is distinct from (args->>'revision')::integer or (e.linked_profile_id is not null and email_value is distinct from e.email) then raise exception 'external client changed' using errcode='P0001';end if;
   update app.coach_external_clients set name=name_value,email=email_value,revision=revision+1,updated_at=clock_timestamp() where id=e.id returning * into e;
  end if;
  answer:=jsonb_build_object('client',app.external_client_json(e));
  insert into app.external_client_operations values(dataset,actor,(args->>'operationId')::uuid,jsonb_build_object('action',action,'args',args),answer);
 end if;
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.external_clients(text,jsonb) owner to app_owner;
revoke all on function app.external_clients(text,jsonb) from public,anon,authenticated;
grant execute on function app.external_clients(text,jsonb) to app_runtime;

-- Extend existing authority boundaries; preserve all registered-client branches.
CREATE OR REPLACE FUNCTION app.coach_session_booking(command_id uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET jit TO 'off'
AS $function$
declare flags jsonb;actor uuid;dataset uuid;t app.coach_session_types;b app.coach_private_bookings;prior app.session_booking_commands;
  target_slot uuid;old_slot app.coach_availability_slots;s app.coach_availability_slots;created_id uuid;answer jsonb;athlete uuid;action text;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;action:=payload->>'action';
 if command_id is null or jsonb_typeof(payload) is distinct from 'object' or action not in ('create','override') or jsonb_typeof(payload->'durationMinutes') is distinct from 'number' or (payload->>'durationMinutes')!~'^(60|75|90)$' then raise exception 'typed booking invalid' using errcode='22023';end if;
 flags:=app.availability_enter()||jsonb_build_object('coach_connection_management',coalesce(current_setting('app.coach_connection_management',true),''));
 perform set_config('app.coach_connection_management','on',true);
 perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',actor::text),0));
 select * into prior from app.session_booking_commands c where c.run_id=dataset and c.actor_profile_id=actor and c.command_id=coach_session_booking.command_id;
 if found then if prior.payload<>payload then raise exception 'typed booking altered retry' using errcode='P0001';end if;perform app.availability_leave(flags);return prior.result;end if;
 select * into t from app.coach_session_types where id=(payload->>'typeId')::uuid and run_id=dataset and coach_profile_id=actor;
 if t.id is null then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if action='create' then
   athlete:=(payload->>'athleteId')::uuid;
   if payload ? 'externalClientId' then
     if athlete is not null or payload-array['action','externalClientId','typeId','typeRevision','locationId','startsAt','durationMinutes']<>'{}'::jsonb
       or not exists(select 1 from app.coach_external_clients e where e.id=(payload->>'externalClientId')::uuid and e.run_id=dataset and e.coach_profile_id=actor and e.linked_profile_id is null)
       then raise exception 'external client forbidden' using errcode='42501';end if;
     if (select count(*) from app.coach_private_bookings where external_client_id=(payload->>'externalClientId')::uuid)>=500 then raise exception 'external client session limit' using errcode='P0001';end if;
   elsif not exists(select 1 from app.coach_athlete_connection_pairs p join app.coach_athlete_connection_attempts a on a.pair_id=p.id where p.run_id=dataset and p.coach_profile_id=actor and p.athlete_profile_id=athlete and a.status='accepted') then raise exception 'typed booking requires connected athlete' using errcode='42501';end if;
 else
   select * into b from app.coach_private_bookings where id=(payload->>'bookingId')::uuid and run_id=dataset and coach_profile_id=actor and credit_projection_id is null for update;
   if not found then raise exception 'typed booking forbidden' using errcode='42501';end if;
   if b.status<>'confirmed' or b.scheduled_start_at<=clock_timestamp() or b.schedule_revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'typed booking stale or elapsed' using errcode='P0001';end if;
   athlete:=b.client_profile_id;select * into strict old_slot from app.coach_availability_slots where id=b.slot_id for update;
 end if;
 target_slot:=app.typed_session_slot(t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,(payload->>'durationMinutes')::integer,b.id);
 select * into strict s from app.coach_availability_slots where id=target_slot;
 update app.coach_availability_slots x set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(x.policy_revision,0) where x.run_id=dataset and x.profile_id=actor and x.id<>s.id and x.status='open' and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)');
 if action='create' then
   insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,external_client_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at)
   values(gen_random_uuid(),dataset,s.id,actor,athlete,(payload->>'externalClientId')::uuid,'confirmed',s.starts_at,s.ends_at,s.starts_at,s.starts_at) returning id into created_id;
 else
   update app.coach_availability_slots set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(old_slot.policy_revision,0) where id=old_slot.id;
   update app.coach_private_bookings set slot_id=s.id,scheduled_start_at=s.starts_at,scheduled_end_at=s.ends_at,early_return_until=s.starts_at,hold_expires_at=s.starts_at,schedule_revision=schedule_revision+1 where id=b.id;
   insert into app.session_booking_changes values(b.id,b.schedule_revision+1,actor,jsonb_build_object('booking',to_jsonb(b),'occurrence',to_jsonb(old_slot)),jsonb_build_object('startsAt',s.starts_at,'endsAt',s.ends_at,'venue',s.training_location_name,'sessionType',s.session_type_snapshot),clock_timestamp());
   created_id:=b.id;
 end if;
 update app.coach_availability_slots set status='booked' where id=s.id;
 perform set_config('app.coach_booking_request_management','on',true);
 update app.coach_booking_requests set status='not-selected',decided_at=clock_timestamp(),decided_by_profile_id=actor where slot_id=s.id and status='pending';
 answer:=jsonb_build_object('bookingId',created_id,'revision',case when action='create' then 0 else b.schedule_revision+1 end);
 insert into app.session_booking_commands values(dataset,actor,command_id,payload,answer);
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $function$;

CREATE OR REPLACE FUNCTION app.mail_booking_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare flags jsonb; begin
 if new.client_profile_id is null or new.credit_projection_id is not null then return new; end if;
 perform app.mail_source_lock(new.run_id,new.coach_profile_id,new.client_profile_id);flags:=app.mail_trigger_enter();
 if tg_op='INSERT' and app.mail_blocked(new.run_id,new.coach_profile_id,new.client_profile_id) then raise exception 'message unavailable: blocked session acceptance' using errcode='P0001'; end if;
 perform app.mail_trigger_leave(flags);return new;
end $function$;

CREATE OR REPLACE FUNCTION app.mail_booking_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare flags jsonb; request_id uuid; sender uuid:=nullif(current_setting('app.current_profile_id',true),'')::uuid; begin
 if new.client_profile_id is null or new.credit_projection_id is not null or old.status is not distinct from new.status then return new; end if;
 flags:=app.mail_trigger_enter();select r.id into request_id from app.coach_booking_requests r where r.accepted_booking_id=new.id;
 perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,case when request_id is null then 'booking' else 'request' end,coalesce(request_id,new.id),'booking:'||new.id::text||':'||new.status,new.status,sender,statement_timestamp(),'status');
 perform app.mail_trigger_leave(flags);return new;
end $function$;

CREATE OR REPLACE FUNCTION app.capture_private_booking_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare dataset uuid;coach uuid;athlete uuid;actor uuid;source uuid;slot uuid;
  event_kind text;source_kind text;key text;starts timestamptz;ends timestamptz;venue text;
  event_id uuid;booking app.coach_private_bookings;flags jsonb;
begin
  flags:=app.mail_trigger_enter();
  if tg_table_name='coach_booking_requests' then
    if tg_op='UPDATE' and old.status is not distinct from new.status then
      perform app.mail_trigger_leave(flags);return new;
    end if;
    -- Acceptance already inserts one confirmed booking. Do not emit twice.
    if new.status='accepted' then perform app.mail_trigger_leave(flags);return new;end if;
    dataset:=new.run_id;coach:=new.coach_profile_id;athlete:=new.client_profile_id;
    actor:=case when new.status='pending' then athlete else new.decided_by_profile_id end;
    event_kind:=case new.status when 'pending' then 'requested' when 'occurrence-closed' then 'unavailable' else new.status end;
    source_kind:='request';source:=new.id;slot:=new.slot_id;
    starts:=new.scheduled_start_at;ends:=new.scheduled_end_at;venue:=new.training_location_name;
    key:='request:'||new.id::text||':'||new.status;
  else
    if tg_table_name='session_booking_changes' then
      select * into strict booking from app.coach_private_bookings where id=new.booking_id;
      event_kind:='changed';actor:=new.actor_profile_id;
      key:='booking:'||booking.id::text||':changed:'||new.revision::text;
    else
      booking:=new;
      if tg_op='INSERT' and new.status='confirmed' then
        event_kind:='confirmed';actor:=nullif(current_setting('app.current_profile_id',true),'')::uuid;
        if actor not in(new.coach_profile_id,new.client_profile_id)
          or not app.authorized_actor_context_valid(actor,new.run_id,null) then actor:=null;end if;
      elsif tg_op='UPDATE' and old.status is distinct from new.status and new.status='cancelled' then
        event_kind:='cancelled';actor:=new.cancelled_by_profile_id;
      else perform app.mail_trigger_leave(flags);return new;end if;
      key:='booking:'||new.id::text||':'||event_kind;
    end if;
    if booking.client_profile_id is null or booking.credit_projection_id is not null then perform app.mail_trigger_leave(flags);return new;end if;
    dataset:=booking.run_id;coach:=booking.coach_profile_id;athlete:=booking.client_profile_id;
    source_kind:='booking';source:=booking.id;slot:=booking.slot_id;
    starts:=booking.scheduled_start_at;ends:=booking.scheduled_end_at;
    select coalesce(s.training_location_name,s.gym_name,s.public_location_label) into venue
      from app.coach_availability_slots s where s.id=booking.slot_id;
  end if;
  insert into app.booking_notification_events(run_id,coach_profile_id,athlete_profile_id,actor_profile_id,
    event_key,kind,source_kind,source_id,slot_id,starts_at,ends_at,venue_name)
  values(dataset,coach,athlete,actor,key,event_kind,source_kind,source,slot,starts,ends,venue)
  on conflict(event_key) do nothing returning id into event_id;
  if event_id is not null then
    -- Both get exactly one email; only a non-acting coach gets a bell item.
    insert into app.booking_notification_receipts(event_id,recipient_profile_id,notify_in_app)
      values(event_id,coach,actor is distinct from coach),(event_id,athlete,false);
  end if;
  perform app.mail_trigger_leave(flags);return new;
exception when others then perform app.mail_trigger_leave(flags);raise;
end $function$;

CREATE OR REPLACE FUNCTION app.current_direct_private_bookings()
 RETURNS TABLE(id uuid, run_id uuid, slot_id uuid, coach_profile_id uuid, coach_display_name text, coach_slug text, client_profile_id uuid, client_display_name text, status text, scheduled_start_at timestamp with time zone, scheduled_end_at timestamp with time zone, coach_timezone text, coach_training_location_id uuid, training_location_name text, location_kind text, gym_name text, public_location_label text, cancelled_by_profile_id uuid, cancelled_at timestamp with time zone, completed_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'direct coach booking projection is unauthorized';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'on', true);

  return query
  select
    direct_booking.id,
    direct_booking.run_id,
    direct_booking.slot_id,
    direct_booking.coach_profile_id,
    coach.display_name,
    coach.public_slug,
    direct_booking.client_profile_id,
    coalesce(client.display_name, external.name),
    direct_booking.status,
    direct_booking.scheduled_start_at,
    direct_booking.scheduled_end_at,
    slot.coach_timezone,
    slot.coach_training_location_id,
    coalesce(
      slot.training_location_name,
      slot.gym_name,
      slot.public_location_label
    ),
    slot.location_kind,
    slot.gym_name,
    slot.public_location_label,
    direct_booking.cancelled_by_profile_id,
    direct_booking.cancelled_at,
    direct_booking.completed_at,
    direct_booking.created_at
  from app.coach_private_bookings as direct_booking
  join app.coach_profiles as coach
    on coach.run_id = direct_booking.run_id
    and coach.profile_id = direct_booking.coach_profile_id
  left join app.coach_external_clients external
    on external.id = direct_booking.external_client_id
    and external.run_id = direct_booking.run_id
    and external.coach_profile_id = direct_booking.coach_profile_id
  left join app.profiles as client
    on client.id = direct_booking.client_profile_id
  join app.coach_availability_slots as slot
    on slot.run_id = direct_booking.run_id
    and slot.id = direct_booking.slot_id
  where direct_booking.run_id = run_id_text::uuid
    and direct_booking.credit_projection_id is null
    and profile_id_text::uuid in (
      direct_booking.client_profile_id,
      direct_booking.coach_profile_id
    )
  order by direct_booking.scheduled_start_at desc, direct_booking.id;

  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$function$;

CREATE OR REPLACE FUNCTION app.current_booking_connection_context(requested_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare booking app.coach_private_bookings%rowtype; pair app.coach_athlete_connection_pairs%rowtype;
  latest app.coach_athlete_connection_attempts%rowtype; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_booking_id is null then
    raise exception 'connection context is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  select b.* into booking from app.coach_private_bookings b
    where b.id = requested_booking_id and b.run_id::text = current_setting('app.current_run_id', true)
      and b.credit_projection_id is null and (b.client_profile_id is null or b.coach_profile_id <> b.client_profile_id)
      and current_setting('app.current_profile_id', true)::uuid in (b.coach_profile_id, b.client_profile_id);
  if not found then raise exception 'connection context is unavailable' using errcode = 'P0001'; end if;
  if booking.client_profile_id is null then
    perform app.connection_access_flags(false);
    return jsonb_build_object('connection',null,'canSend',false);
  end if;
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.run_id = booking.run_id and p.coach_profile_id = booking.coach_profile_id and p.athlete_profile_id = booking.client_profile_id;
  if pair.id is null then
    pair.run_id := booking.run_id; pair.coach_profile_id := booking.coach_profile_id; pair.athlete_profile_id := booking.client_profile_id;
  end if;
  select a.* into latest from app.coach_athlete_connection_attempts a where a.pair_id = pair.id order by a.attempt_number desc limit 1;
  result := jsonb_build_object('connection', app.connection_attempt_projection(latest.id),
    'canSend', coalesce(latest.status not in ('pending', 'accepted'), true) and app.connection_pair_eligible(pair));
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$function$;

CREATE OR REPLACE FUNCTION app.mail_session_details(b app.coach_private_bookings)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare c app.message_conversations; ctx app.message_contexts; editable boolean:=false; begin
 if b.client_profile_id is null then
  return jsonb_build_object('title',coalesce((select title from app.private_session_titles where booking_id=b.id),''),'titleRevision',coalesce((select revision from app.private_session_titles where booking_id=b.id),0),'canEditTitle',false);
 end if;
 select * into c from app.message_conversations where run_id=b.run_id and coach_profile_id=b.coach_profile_id and athlete_profile_id=b.client_profile_id;
 -- No empty conversation is needed to read a title or an untitled legacy booking.
 if c.id is null then
  c.id:=b.id;c.run_id:=b.run_id;c.coach_profile_id:=b.coach_profile_id;c.athlete_profile_id:=b.client_profile_id;
 end if;
 ctx.conversation_id:=c.id;ctx.kind:='booking';ctx.source_id:=b.id;
 editable:=app.mail_context_allowed(c,ctx);
 return jsonb_build_object('title',coalesce((select title from app.private_session_titles where booking_id=b.id),''),
  'titleRevision',coalesce((select revision from app.private_session_titles where booking_id=b.id),0),
  'canEditTitle',b.status in ('confirmed','completed') and editable);
end $function$;

CREATE OR REPLACE FUNCTION app.session_booking_detail(booking_id uuid, before_revision integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare flags jsonb;b app.coach_private_bookings;s app.coach_availability_slots;answer jsonb;begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if before_revision is not null and before_revision<1 then raise exception 'typed booking invalid history cursor' using errcode='22023';end if;
 flags:=app.availability_enter();
 select * into b from app.coach_private_bookings x where x.id=booking_id and x.run_id=current_setting('app.current_run_id')::uuid and current_setting('app.current_profile_id')::uuid in (x.coach_profile_id,x.client_profile_id) and x.credit_projection_id is null;
 if b.id is null then raise exception 'typed booking forbidden' using errcode='42501';end if;
 select * into strict s from app.coach_availability_slots where id=b.slot_id;
 answer:=jsonb_build_object('bookingId',b.id,'revision',b.schedule_revision,'status',b.status,'startsAt',b.scheduled_start_at,'endsAt',b.scheduled_end_at,'locationId',s.coach_training_location_id,'venueName',s.training_location_name,'sessionType',s.session_type_snapshot,'athleteId',b.client_profile_id,
 'externalClient',case when b.coach_profile_id=current_setting('app.current_profile_id')::uuid then (select jsonb_build_object('id',e.id,'name',e.name,'linkedProfileId',e.linked_profile_id) from app.coach_external_clients e where e.id=b.external_client_id) end,'viewerIsCoach',b.coach_profile_id=current_setting('app.current_profile_id')::uuid,
 'changes',coalesce((select jsonb_agg(jsonb_build_object('revision',c.revision,'changedAt',c.changed_at,'previousStart',c.previous_terms->'booking'->'scheduled_start_at','previousEnd',c.previous_terms->'booking'->'scheduled_end_at','previousVenue',c.previous_terms->'occurrence'->'training_location_name','newTerms',c.new_terms) order by c.revision desc) from (select * from app.session_booking_changes x where x.booking_id=b.id and (before_revision is null or x.revision<before_revision) order by x.revision desc limit 20) c),'[]'::jsonb),
 'historyTotal',(select count(*) from app.session_booking_changes x where x.booking_id=b.id),
 'nextHistoryRevision',case when (select count(*) from (select 1 from app.session_booking_changes x where x.booking_id=b.id and (before_revision is null or x.revision<before_revision) order by x.revision desc limit 21) h)>20 then (select x.revision from app.session_booking_changes x where x.booking_id=b.id and (before_revision is null or x.revision<before_revision) order by x.revision desc offset 19 limit 1) else null end);
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $function$;

CREATE OR REPLACE FUNCTION app.session_notes_impl(action text, args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare actor uuid:=current_setting('app.current_profile_id')::uuid;dataset uuid:=current_setting('app.current_run_id')::uuid;
 b app.coach_private_bookings;s app.coach_availability_slots;permission_context app.message_conversations;kind text:=args->>'kind';is_coach boolean;can_write boolean;
 entry app.session_note_entries;plan app.session_note_plans;existing app.session_note_operations;result jsonb;current_value jsonb;
 body text;videos jsonb;id uuid;expected integer;cursor_at timestamptz;cursor_id uuid;page jsonb;next_cursor jsonb;total integer;title text;conversation uuid;
begin
 if jsonb_typeof(args)<>'object' or octet_length(args::text)>65536 or action not in('read','save') or kind not in('shared','private','plan') or kind is null then raise exception 'invalid notes' using errcode='22023';end if;
 select * into b from app.coach_private_bookings where coach_private_bookings.id=(args->>'bookingId')::uuid and run_id=dataset and actor in(coach_profile_id,client_profile_id) and credit_projection_id is null;
 if b.id is null then raise exception 'notes forbidden' using errcode='42501';end if;
 -- Same pair lock as Messages and cancellation/block guards. Cancellation's
 -- nonblocking source guard aborts/retries rather than inverting this lock order.
 if b.external_client_id is not null then
  perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',b.coach_profile_id::text),0));
  -- A claim may have completed while this statement waited. Resolve the current
  -- participant before taking its pair lock and before locking the booking row.
  select * into b from app.coach_private_bookings where coach_private_bookings.id=b.id;
 end if;
 if b.client_profile_id is not null then perform app.mail_lock_pair(dataset,b.coach_profile_id,b.client_profile_id);end if;
 select * into b from app.coach_private_bookings where coach_private_bookings.id=b.id for update;
 -- Serialize shared permission checks against application suspension/review.
 perform 1 from app.coach_applications where profile_id=b.coach_profile_id for share;
 is_coach:=actor=b.coach_profile_id;
 if (kind='private' or kind='plan' and action='save') and not is_coach then raise exception 'notes forbidden' using errcode='42501';end if;
 can_write:=b.status in('confirmed','completed') and (kind='private' or (b.client_profile_id is null and is_coach and (app.group_coach_enabled(dataset,b.coach_profile_id,false) or b.scheduled_end_at+interval '336 hours'>clock_timestamp())) or coalesce((app.mail_session_details(b)->>'canEditTitle')::boolean,false));
 -- Waiting for a lock must not extend an existing M8 contact window. Reuse
 -- its branch order and captured deadlines, checked against time after locks.
 if can_write and kind<>'private' and b.client_profile_id is not null then
  permission_context.id:=b.id;permission_context.run_id:=b.run_id;permission_context.coach_profile_id:=b.coach_profile_id;permission_context.athlete_profile_id:=b.client_profile_id;
  if app.mail_blocked(dataset,b.coach_profile_id,b.client_profile_id) then
   can_write:=not exists(select 1 from app.message_blocks block where block.run_id=dataset
    and block.low_profile_id=least(b.coach_profile_id,b.client_profile_id) and block.high_profile_id=greatest(b.coach_profile_id,b.client_profile_id) and block.ended_at is null
    and not exists(select 1 from app.message_block_bookings snapshot where snapshot.block_id=block.id and snapshot.booking_id=b.id and snapshot.until_at>clock_timestamp()));
  elsif not app.mail_coach_enabled(permission_context) then can_write:=b.scheduled_end_at+interval '336 hours'>clock_timestamp();end if;
 end if;

 if action='read' then
  if kind='plan' or args-array['bookingId','kind','before']<>'{}'::jsonb then raise exception 'invalid notes query' using errcode='22023';end if;
  if args?'before' then
   if jsonb_typeof(args->'before')<>'object' or (args->'before')-array['at','id']<>'{}'::jsonb or args#>>'{before,at}' is null or args#>>'{before,id}' is null then raise exception 'invalid notes cursor' using errcode='22023';end if;
   cursor_at:=(args#>>'{before,at}')::timestamptz;cursor_id:=(args#>>'{before,id}')::uuid;
  end if;
  select * into s from app.coach_availability_slots slots where slots.id=b.slot_id;
  select coalesce(nullif(t.title,''),'Private session') into title from (select 1) x left join app.private_session_titles t on t.booking_id=b.id;
  select c.id into conversation from app.message_conversations c where c.run_id=dataset and c.coach_profile_id=b.coach_profile_id and c.athlete_profile_id=b.client_profile_id;
  with rows as(select e.* from app.session_note_entries e where e.booking_id=b.id and e.kind=kind and (cursor_at is null or (e.created_at,e.id)<(cursor_at,cursor_id)) order by e.created_at desc,e.id desc limit 21),
  shown as(select * from rows order by rows.created_at desc,rows.id desc limit 20)
  select coalesce((select jsonb_agg(app.session_note_projection(shown.id,shown.author_id,shown.body,shown.videos,shown.revision,shown.created_at,shown.updated_at) order by shown.created_at,shown.id) from shown),'[]'),
   case when (select count(*) from rows)>20 then (select jsonb_build_object('at',shown.created_at,'id',shown.id) from shown order by shown.created_at,shown.id limit 1) else null end into page,next_cursor;
  select count(*) into total from app.session_note_entries e where e.booking_id=b.id and e.kind=kind;
  if kind='shared' then select * into plan from app.session_note_plans p where p.booking_id=b.id;end if;
  return jsonb_build_object('bookingId',b.id,'title',title,'startsAt',b.scheduled_start_at,'endsAt',b.scheduled_end_at,'venue',coalesce(s.training_location_name,s.public_location_label,''),'status',b.status,
   'viewerId',actor,'viewerIsCoach',is_coach,'canWrite',can_write,'kind',kind,'conversationHref',case when conversation is not null then '/messages?booking='||b.id end,
   'plan',case when plan.booking_id is not null then app.session_note_projection(b.id,plan.author_id,plan.body,plan.videos,plan.revision,plan.created_at,plan.updated_at) end,
   'entries',page,'next',next_cursor,'total',total);
 end if;
 if args-array['bookingId','kind','operationId','entryId','revision','body','videos']<>'{}'::jsonb or args->>'operationId' is null or args->>'revision' is null or jsonb_typeof(args->'body')<>'string' then raise exception 'invalid note save' using errcode='22023';end if;
 if not can_write then raise exception 'notes read only' using errcode='42501';end if;
 select * into existing from app.session_note_operations o where o.booking_id=b.id and o.actor_id=actor and o.kind=kind and o.operation_id=(args->>'operationId')::uuid;
 if found then
  if existing.payload<>args then raise exception 'note retry changed' using errcode='40001';end if;
  return existing.result;
 end if;
 body:=regexp_replace(replace(replace(args->>'body',E'\r\n',E'\n'),E'\r',E'\n'),'^\s+|\s+$','','g');videos:=coalesce(args->'videos','[]');expected:=(args->>'revision')::integer;
 if expected<0 or not app.valid_training_videos(videos) or body is null or length(body)>(case when kind='plan' then 8000 else 2000 end) or octet_length(body)>(case when kind='plan' then 32000 else 8000 end) or translate(body,E'\n\t','')~'[[:cntrl:]]' or (body='' and (kind<>'plan' or videos<>'[]'::jsonb)) then raise exception 'invalid note text' using errcode='22023';end if;
 if kind='plan' then
  if args?'entryId' then raise exception 'invalid plan target' using errcode='22023';end if;
  select * into plan from app.session_note_plans p where p.booking_id=b.id;
  if coalesce(plan.revision,0)<>expected then
   return jsonb_build_object('conflict',true,'current',case when plan.booking_id is not null then app.session_note_projection(b.id,plan.author_id,plan.body,plan.videos,plan.revision,plan.created_at,plan.updated_at) end);
  end if;
  insert into app.session_note_plans(booking_id,author_id,body,videos,revision) values(b.id,actor,body,videos,expected+1)
   on conflict on constraint session_note_plans_pkey do update set body=excluded.body,videos=excluded.videos,revision=excluded.revision,updated_at=statement_timestamp();
  id:=b.id;
 else
  if args?'entryId' then
   select * into entry from app.session_note_entries e where e.id=(args->>'entryId')::uuid and e.booking_id=b.id and e.kind=kind and e.author_id=actor;
   if entry.id is null then raise exception 'note author forbidden' using errcode='42501';end if;
  elsif expected<>0 then raise exception 'invalid new note revision' using errcode='22023';end if;
  if coalesce(entry.revision,0)<>expected then return jsonb_build_object('conflict',true,'current',app.session_note_projection(entry.id,entry.author_id,entry.body,entry.videos,entry.revision,entry.created_at,entry.updated_at));end if;
  if entry.id is null and (select count(*) from app.session_note_entries e where e.booking_id=b.id and e.kind=kind)>=100 then return '{"limit":true}';end if;
  id:=coalesce(entry.id,gen_random_uuid());
  insert into app.session_note_entries(id,booking_id,kind,author_id,body,videos) values(id,b.id,kind,actor,body,videos)
   on conflict on constraint session_note_entries_pkey do update set body=excluded.body,videos=excluded.videos,revision=session_note_entries.revision+1,updated_at=statement_timestamp();
 end if;
 result:=jsonb_build_object('id',id,'revision',expected+1);
 insert into app.session_note_operations values(b.id,actor,kind,(args->>'operationId')::uuid,args,result);
 return result;
end $function$;
