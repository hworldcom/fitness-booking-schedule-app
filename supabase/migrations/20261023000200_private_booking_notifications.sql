-- MOV-85: new canonical private-booking activity only. Old message APIs/workers
-- remain compatible; booking jobs require the new bounded mixed worker.
create table app.booking_notification_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  coach_profile_id uuid not null,
  athlete_profile_id uuid not null,
  actor_profile_id uuid,
  event_key text not null unique check(length(event_key)<=200),
  kind text not null check(kind in ('requested','confirmed','declined','withdrawn','expired','not-selected','unavailable','cancelled','changed')),
  source_kind text not null check(source_kind in ('request','booking')),
  source_id uuid not null,
  slot_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at),
  venue_name text not null check(length(venue_name) between 1 and 240),
  created_at timestamptz not null default statement_timestamp(),
  check(coach_profile_id<>athlete_profile_id),
  check(actor_profile_id is null or actor_profile_id in(coach_profile_id,athlete_profile_id)),
  foreign key(run_id,coach_profile_id) references app.demo_run_participants(run_id,profile_id),
  foreign key(run_id,athlete_profile_id) references app.demo_run_participants(run_id,profile_id)
);
create table app.booking_notification_receipts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references app.booking_notification_events(id) on delete cascade,
  recipient_profile_id uuid not null references app.profiles(id),
  notify_in_app boolean not null,
  read_at timestamptz,
  due_at timestamptz not null default statement_timestamp(),
  state text not null default 'queued' check(state in ('queued','claimed','sending','accepted','suppressed','failed','unknown')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text check(length(provider_id)<=200),
  finished_at timestamptz,
  unique(event_id,recipient_profile_id),
  check((lease_id is null)=(lease_until is null))
);
create index booking_notification_recipient on app.booking_notification_receipts(recipient_profile_id,event_id);
create index booking_notification_due on app.booking_notification_receipts(due_at,id) where state in ('queued','claimed','sending');
do $$ declare relation text;begin
  foreach relation in array array['booking_notification_events','booking_notification_receipts'] loop
    execute format('alter table app.%I owner to app_owner',relation);
    execute format('alter table app.%I enable row level security',relation);
    execute format('alter table app.%I force row level security',relation);
    execute format('revoke all on app.%I from public,anon,authenticated,service_role,app_runtime,app_notification_worker',relation);
    execute format('create policy internal on app.%I to app_owner using(true) with check(true)',relation);
  end loop;
end $$;

-- Private trigger helper: no execution grant to ordinary app/worker roles.
create function app.capture_private_booking_event() returns trigger
language plpgsql security definer set search_path='' as $$
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
    if booking.credit_projection_id is not null then perform app.mail_trigger_leave(flags);return new;end if;
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
end $$;
alter function app.capture_private_booking_event() owner to app_owner;
revoke all on function app.capture_private_booking_event() from public;
create trigger capture_private_booking_request after insert or update on app.coach_booking_requests
  for each row execute function app.capture_private_booking_event();
create trigger capture_private_booking_state after insert or update on app.coach_private_bookings
  for each row execute function app.capture_private_booking_event();
create trigger capture_private_booking_change after insert on app.session_booking_changes
  for each row execute function app.capture_private_booking_event();

create function app.booking_notification_allowed(event uuid,recipient uuid) returns boolean
language sql stable set search_path='' as $$
  -- API actor validation and the private email resolver separately require the
  -- active dataset. This helper checks only the exact source/member boundary.
  select exists(select 1 from app.booking_notification_events e
    join app.demo_run_participants m on m.run_id=e.run_id and m.profile_id=recipient
    where e.id=event and recipient in(e.coach_profile_id,e.athlete_profile_id)
      and m.status='active'
      and ((e.source_kind='request' and exists(select 1 from app.coach_booking_requests r where r.id=e.source_id
        and (r.run_id,r.coach_profile_id,r.client_profile_id)=(e.run_id,e.coach_profile_id,e.athlete_profile_id)))
      or (e.source_kind='booking' and exists(select 1 from app.coach_private_bookings b where b.id=e.source_id
        and b.credit_projection_id is null and (b.run_id,b.coach_profile_id,b.client_profile_id)=(e.run_id,e.coach_profile_id,e.athlete_profile_id)))))
$$;
alter function app.booking_notification_allowed(uuid,uuid) owner to app_owner;
revoke all on function app.booking_notification_allowed(uuid,uuid) from public;

create function app.booking_notification_data(event uuid,recipient uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('kind','booking','event',e.kind,'sourceKind',e.source_kind,'sourceId',e.source_id,
    'slotId',e.slot_id,'recipientRole',case when recipient=e.coach_profile_id then 'coach' else 'athlete' end,
    'startsAt',e.starts_at,'endsAt',e.ends_at,'venueName',e.venue_name)
  from app.booking_notification_events e where e.id=event and recipient in(e.coach_profile_id,e.athlete_profile_id)
$$;
alter function app.booking_notification_data(uuid,uuid) owner to app_owner;
revoke all on function app.booking_notification_data(uuid,uuid) from public;

-- Keep the original message-only command intact for old deployments.
create function app.notification_command_v2(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;old_page jsonb;booking_items jsonb;items jsonb;more boolean;answer jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object'
    or octet_length(args::text)>2048 then raise exception 'notification unavailable' using errcode='P0001';end if;
  actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
  if action='read' then
    perform app.mail_flags(true);
    update app.booking_notification_receipts r set read_at=coalesce(r.read_at,statement_timestamp())
      from app.booking_notification_events e where r.id=(args->>'id')::uuid and e.id=r.event_id
        and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app
        and app.booking_notification_allowed(e.id,actor);
    if found then perform app.mail_flags(false);return '{}'::jsonb;end if;
    perform app.mail_flags(false);return app.notification_command(action,args);
  end if;
  old_page:=app.notification_command(action,args);
  perform app.mail_flags(true);
  if action='read-all' then
    update app.booking_notification_receipts r set read_at=statement_timestamp() from app.booking_notification_events e
      where e.id=r.event_id and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app
        and r.read_at is null and e.created_at<=(args->>'throughAt')::timestamptz
        and app.booking_notification_allowed(e.id,actor);
    answer:='{}'::jsonb;
  elsif action='list' then
    select coalesce(jsonb_agg(data order by created_at desc,id desc),'[]') into booking_items from (
      select r.id,e.created_at,app.booking_notification_data(e.id,actor)||jsonb_build_object('id',r.id,
        'createdAt',e.created_at,'readAt',r.read_at) data
      from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id
      where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app
        and app.booking_notification_allowed(e.id,actor)
        and (coalesce(args->>'filter','all')='all' or r.read_at is null)
        and (args->>'beforeAt' is null or (e.created_at,r.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
      order by e.created_at desc,r.id desc limit 21
    ) page;
    select coalesce(jsonb_agg(v order by (v->>'createdAt')::timestamptz desc,(v->>'id')::uuid desc),'[]') into items
      from jsonb_array_elements((old_page->'items')||booking_items) v;
    more:=(old_page->>'hasMore')::boolean or jsonb_array_length(items)>20;
    answer:=jsonb_build_object('items',(select coalesce(jsonb_agg(v order by pos),'[]')
      from jsonb_array_elements(items) with ordinality a(v,pos) where pos<=20),'hasMore',more,
      'snapshotAt',old_page->'snapshotAt','unreadCount',(old_page->>'unreadCount')::bigint+
        (select count(*) from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id
          where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and r.read_at is null
            and app.booking_notification_allowed(e.id,actor)));
  end if;
  perform app.mail_flags(false);return answer;
exception when others then perform app.mail_flags(false);raise;
end $$;
alter function app.notification_command_v2(text,jsonb) owner to app_owner;
revoke all on function app.notification_command_v2(text,jsonb) from public;
grant execute on function app.notification_command_v2(text,jsonb) to app_runtime;

-- Bound to one real queue job, not an arbitrary profile/email lookup.
create function app.booking_notification_recipient_email(job uuid) returns text
language sql stable security definer set search_path='' as $$
  select u.email from app.booking_notification_receipts j
    join app.booking_notification_events e on e.id=j.event_id
    join app.profiles p on p.id=j.recipient_profile_id
    join app.demo_run_participants m on m.profile_id=p.id and m.run_id=e.run_id
    join app.demo_runs d on d.id=m.run_id join auth.users u on u.id=p.auth_user_id
  where j.id=job and p.record_source='user' and p.claimed_at is not null and m.status='active'
    and d.status='active' and d.catalogue_visibility='public' and u.email_confirmed_at is not null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and u.email is not null and u.email<>''
$$;
alter function app.booking_notification_recipient_email(uuid) owner to postgres;
revoke all on function app.booking_notification_recipient_email(uuid) from public,app_runtime,app_notification_worker;
grant execute on function app.booking_notification_recipient_email(uuid) to app_owner;

create function app.prepare_booking_notification_email(job uuid,lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j app.booking_notification_receipts;email text;result jsonb;
begin
  select * into j from app.booking_notification_receipts where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return null;end if;
  perform app.mail_flags(true);email:=app.booking_notification_recipient_email(j.id);
  if j.due_at>statement_timestamp() or email is null or not app.booking_notification_allowed(j.event_id,j.recipient_profile_id) then
    update app.booking_notification_receipts set state='suppressed',lease_id=null,lease_until=null,finished_at=statement_timestamp() where id=j.id;
    perform app.mail_flags(false);return null;
  end if;
  result:=app.booking_notification_data(j.event_id,j.recipient_profile_id)||jsonb_build_object('id',j.id,'email',email);
  update app.booking_notification_receipts set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  perform app.mail_flags(false);return result;
exception when others then perform app.mail_flags(false);raise;
end $$;
alter function app.prepare_booking_notification_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_booking_notification_email(uuid,uuid) from public;
grant execute on function app.prepare_booking_notification_email(uuid,uuid) to app_notification_worker;

create function app.claim_booking_notification_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';
  end if;
  -- Expiry after possible handoff is ambiguous: quarantine, never auto resend.
  with expired as (
    select id from app.booking_notification_receipts where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.booking_notification_receipts j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select j.id from app.booking_notification_receipts j where j.attempts<5 and j.due_at<=statement_timestamp()
      and (j.state='queued' or (j.state='claimed' and j.lease_until<=statement_timestamp()))
    order by j.due_at,j.id for update skip locked limit batch_size
  ), claimed as (
    update app.booking_notification_receipts j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  -- A worker dying on its fifth pre-send claim must not leave a stuck claim.
  with exhausted as (
    select id from app.booking_notification_receipts where attempts=5 and state='claimed'
      and lease_until<=statement_timestamp() order by lease_until,id
    for update skip locked limit batch_size
  ) update app.booking_notification_receipts j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_booking_notification_emails(integer) owner to app_owner;
revoke all on function app.claim_booking_notification_emails(integer) from public;
grant execute on function app.claim_booking_notification_emails(integer) to app_notification_worker;

create function app.finish_booking_notification_email(job uuid, lease uuid, outcome text, provider text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare j app.booking_notification_receipts;
begin
  if outcome not in ('accepted','retry','failed','unknown') or outcome is null
    or length(provider)>200 then raise exception 'invalid notification result' using errcode='P0001'; end if;
  select * into j from app.booking_notification_receipts where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return false; end if;
  update app.booking_notification_receipts set state=case
      when outcome='retry' and j.attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+
      make_interval(secs=>least(3600,30*power(2,j.attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider,finished_at=statement_timestamp()
    where id=j.id;
  return true;
end $$;
alter function app.finish_booking_notification_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_booking_notification_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_booking_notification_email(uuid,uuid,text,text) to app_notification_worker;

-- Reserve queue capacity for both kinds even during a busy message backlog.
create function app.claim_all_notification_emails(batch_size integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare messages jsonb;bookings jsonb;result jsonb;remaining integer;
begin
 if batch_size is null or batch_size<2 or batch_size>20 then raise exception 'invalid notification batch' using errcode='P0001';end if;
 messages:=app.claim_notification_emails(greatest(1,batch_size/2));
 bookings:=app.claim_booking_notification_emails(batch_size-jsonb_array_length(messages));
 remaining:=batch_size-jsonb_array_length(messages)-jsonb_array_length(bookings);
 if remaining>0 then messages:=messages||app.claim_notification_emails(remaining);end if;
 select coalesce(jsonb_agg(v),'[]') into result from (
   select value||jsonb_build_object('kind','message') v from jsonb_array_elements(messages)
   union all select value||jsonb_build_object('kind','booking') v from jsonb_array_elements(bookings)
 ) claims;
 return result;
end $$;
alter function app.claim_all_notification_emails(integer) owner to app_owner;
revoke all on function app.claim_all_notification_emails(integer) from public;
grant execute on function app.claim_all_notification_emails(integer) to app_notification_worker;
