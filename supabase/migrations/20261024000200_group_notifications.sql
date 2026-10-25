-- MOV-86: canonical new group activity only. Existing history is not backfilled.
create table app.group_notification_events (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null,
 session_id uuid not null references app.coach_group_sessions(id) on delete cascade,
 registration_id uuid references app.coach_group_registrations(id) on delete cascade,
 coach_profile_id uuid not null references app.profiles(id),
 actor_profile_id uuid references app.profiles(id),
 event_key text not null unique check(length(event_key)<=200),
 kind text not null check(kind in ('requested','approved','declined','withdrawn','confirmed','cancelled','not-confirmed','approval-expired')),
 title text not null check(length(title) between 1 and 120),
 starts_at timestamptz not null,
 ends_at timestamptz not null check(ends_at>starts_at),
 venue_name text not null check(length(venue_name) between 1 and 240),
 event_status text not null check(event_status in ('open','confirmed','cancelled','not-confirmed')),
 affected_count integer not null check(affected_count between 0 and 100),
 created_at timestamptz not null default statement_timestamp(),
 check((registration_id is not null)=(kind in ('requested','approved','declined','withdrawn')))
);
create table app.group_notification_receipts (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references app.group_notification_events(id) on delete cascade,
 recipient_profile_id uuid not null references app.profiles(id),
 registration_id uuid references app.coach_group_registrations(id) on delete cascade,
 participation_status text check(participation_status in ('pending','active','withdrawn','declined','approval-expired','session-cancelled','session-not-confirmed')),
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
 check((registration_id is null)=(participation_status is null)),
 check((lease_id is null)=(lease_until is null))
);
create index group_notification_recipient on app.group_notification_receipts(recipient_profile_id,event_id);
create index group_notification_due on app.group_notification_receipts(due_at,id) where state in ('queued','claimed','sending');
do $$ declare relation text;begin
 foreach relation in array array['group_notification_events','group_notification_receipts'] loop
  execute format('alter table app.%I owner to app_owner',relation);
  execute format('alter table app.%I enable row level security',relation);
  execute format('alter table app.%I force row level security',relation);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role,app_runtime,app_notification_worker',relation);
  execute format('create policy internal on app.%I to app_owner using(true) with check(true)',relation);
 end loop;
end $$;

-- Private helper called only by canonical transition triggers, within their transaction.
create function app.record_group_notification(session uuid,event_kind text,attempt uuid default null) returns void
language plpgsql set search_path='' as $$
declare s app.coach_group_sessions;r app.coach_group_registrations;actor uuid;key text;event_id uuid;affected integer;
begin
 select * into strict s from app.coach_group_sessions where id=session;
 if attempt is not null then
  select * into strict r from app.coach_group_registrations where id=attempt and session_id=s.id and run_id=s.run_id;
  actor:=case when event_kind in ('requested','withdrawn') then r.athlete_profile_id else r.decided_by_profile_id end;
  key:='registration:'||r.id::text||':'||event_kind;affected:=1;
 else
  actor:=case event_kind when 'confirmed' then s.confirmed_by_profile_id when 'cancelled' then s.closed_by_profile_id else null end;
  key:='group:'||s.id::text||':'||event_kind||':'||case when event_kind='approval-expired' then extract(epoch from s.decision_deadline_at)::text else s.revision::text end;
  select count(*) into affected from app.coach_group_registrations where session_id=s.id and
   case when event_kind='approval-expired' then status='approval-expired' else status in ('pending','active') end;
 end if;
 insert into app.group_notification_events(run_id,session_id,registration_id,coach_profile_id,actor_profile_id,event_key,kind,title,starts_at,ends_at,venue_name,event_status,affected_count)
 values(s.run_id,s.id,attempt,s.coach_profile_id,actor,key,event_kind,coalesce(nullif(btrim(regexp_replace(s.title,'[[:cntrl:]]',' ','g')),''),'Group event'),s.starts_at,s.ends_at,coalesce(nullif(btrim(regexp_replace(s.venue_snapshot->>'name','[[:cntrl:]]',' ','g')),''),'Training venue'),s.status,affected)
 on conflict(event_key) do nothing returning id into event_id;
 if event_id is null then return;end if;
 insert into app.group_notification_receipts(event_id,recipient_profile_id,notify_in_app)
 values(event_id,s.coach_profile_id,actor is distinct from s.coach_profile_id);
 insert into app.group_notification_receipts(event_id,recipient_profile_id,registration_id,participation_status,notify_in_app)
 select event_id,x.athlete_profile_id,x.id,case event_kind when 'cancelled' then 'session-cancelled' when 'not-confirmed' then 'session-not-confirmed' else x.status end,false
 from app.coach_group_registrations x where x.session_id=s.id and
  case when attempt is not null then x.id=attempt when event_kind='approval-expired' then x.status='approval-expired' else x.status in ('pending','active') end;
end $$;
alter function app.record_group_notification(uuid,text,uuid) owner to app_owner;
revoke all on function app.record_group_notification(uuid,text,uuid) from public;
create function app.capture_group_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text;flags jsonb;group_flag text:=coalesce(current_setting('app.group_session_management',true),'');
begin
 flags:=app.mail_trigger_enter();perform set_config('app.group_session_management','on',true);
 if tg_table_name='coach_group_sessions' then
  if old.status is distinct from new.status and new.status in ('confirmed','cancelled','not-confirmed') then
   perform app.record_group_notification(new.id,new.status);
  end if;
 else
  if tg_op='INSERT' and new.status='pending' then kind:='requested';
  elsif tg_op='UPDATE' and old.status is distinct from new.status then
   kind:=case new.status when 'active' then 'approved' when 'declined' then 'declined' when 'withdrawn' then 'withdrawn' else null end;
  end if;
  if kind is not null then perform app.record_group_notification(new.session_id,kind,new.id);end if;
 end if;
 perform app.mail_trigger_leave(flags);perform set_config('app.group_session_management',group_flag,true);return new;
exception when others then perform app.mail_trigger_leave(flags);perform set_config('app.group_session_management',group_flag,true);raise;
end $$;
alter function app.capture_group_notification() owner to app_owner;
revoke all on function app.capture_group_notification() from public;
create trigger capture_group_registration after insert or update on app.coach_group_registrations for each row execute function app.capture_group_notification();
create trigger capture_group_state after update on app.coach_group_sessions for each row execute function app.capture_group_notification();
-- Statement-level capture sees the entire expiry cohort, avoiding N coach copies.
create function app.capture_group_approval_expiry() returns trigger
language plpgsql security definer set search_path='' as $$
declare s uuid;flags jsonb;group_flag text:=coalesce(current_setting('app.group_session_management',true),'');
begin
 flags:=app.mail_trigger_enter();perform set_config('app.group_session_management','on',true);
 for s in select distinct n.session_id from new_registrations n join old_registrations o using(id)
  where n.status='approval-expired' and o.status='pending' loop
  perform app.record_group_notification(s,'approval-expired');
 end loop;
 perform app.mail_trigger_leave(flags);perform set_config('app.group_session_management',group_flag,true);return null;
exception when others then perform app.mail_trigger_leave(flags);perform set_config('app.group_session_management',group_flag,true);raise;
end $$;
alter function app.capture_group_approval_expiry() owner to app_owner;
revoke all on function app.capture_group_approval_expiry() from public;
create trigger capture_group_expiry after update on app.coach_group_registrations referencing old table as old_registrations new table as new_registrations for each statement execute function app.capture_group_approval_expiry();

-- Caller enables the existing private mail/group read scopes, restoring them on exit.
create function app.group_notification_allowed(event uuid,recipient uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from app.group_notification_events e
 join app.group_notification_receipts j on j.event_id=e.id and j.recipient_profile_id=recipient
 join app.demo_run_participants m on m.run_id=e.run_id and m.profile_id=recipient and m.status='active'
 join app.coach_group_sessions s on s.id=e.session_id and s.run_id=e.run_id and s.coach_profile_id=e.coach_profile_id
 where e.id=event and ((recipient=e.coach_profile_id and j.registration_id is null)
 or exists(select 1 from app.coach_group_registrations r where r.id=j.registration_id and r.session_id=s.id and r.run_id=s.run_id and r.athlete_profile_id=recipient)))
$$;
alter function app.group_notification_allowed(uuid,uuid) owner to app_owner;
revoke all on function app.group_notification_allowed(uuid,uuid) from public;
create function app.group_notification_data(event uuid,recipient uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('kind','group','event',e.kind,'sessionId',e.session_id,'recipientRole',case when recipient=e.coach_profile_id then 'coach' else 'athlete' end,
 'title',e.title,'startsAt',e.starts_at,'endsAt',e.ends_at,'venueName',e.venue_name,'eventStatus',e.event_status,
 'participationStatus',r.participation_status,'affectedCount',case when recipient=e.coach_profile_id then e.affected_count else null end)
 from app.group_notification_events e join app.group_notification_receipts r on r.event_id=e.id and r.recipient_profile_id=recipient where e.id=event
$$;
alter function app.group_notification_data(uuid,uuid) owner to app_owner;
revoke all on function app.group_notification_data(uuid,uuid) from public;

-- Version 1/2 remain unchanged, including their read-all/count scopes.
create function app.notification_command_v3(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;old_page jsonb;group_items jsonb;items jsonb;more boolean;answer jsonb;group_flag text:=coalesce(current_setting('app.group_session_management',true),'');
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object'
    or octet_length(args::text)>2048 then raise exception 'notification unavailable' using errcode='P0001';end if;
  perform set_config('app.group_session_management','on',true);
  actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
  if action='read' then
    perform app.mail_flags(true);
    update app.group_notification_receipts r set read_at=coalesce(r.read_at,statement_timestamp())
      from app.group_notification_events e where r.id=(args->>'id')::uuid and e.id=r.event_id
        and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app
        and app.group_notification_allowed(e.id,actor);
    if found then perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);return '{}'::jsonb;end if;
    perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);return app.notification_command_v2(action,args);
  end if;
  old_page:=app.notification_command_v2(action,args);
  perform app.mail_flags(true);
  if action='read-all' then
    update app.group_notification_receipts r set read_at=statement_timestamp() from app.group_notification_events e
      where e.id=r.event_id and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app
        and r.read_at is null and e.created_at<=(args->>'throughAt')::timestamptz
        and app.group_notification_allowed(e.id,actor);
    answer:='{}'::jsonb;
  elsif action='list' then
    select coalesce(jsonb_agg(data order by created_at desc,id desc),'[]') into group_items from (
      select r.id,e.created_at,app.group_notification_data(e.id,actor)||jsonb_build_object('id',r.id,
        'createdAt',e.created_at,'readAt',r.read_at) data
      from app.group_notification_receipts r join app.group_notification_events e on e.id=r.event_id
      where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app
        and app.group_notification_allowed(e.id,actor)
        and (coalesce(args->>'filter','all')='all' or r.read_at is null)
        and (args->>'beforeAt' is null or (e.created_at,r.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
      order by e.created_at desc,r.id desc limit 21
    ) page;
    select coalesce(jsonb_agg(v order by (v->>'createdAt')::timestamptz desc,(v->>'id')::uuid desc),'[]') into items
      from jsonb_array_elements((old_page->'items')||group_items) v;
    more:=(old_page->>'hasMore')::boolean or jsonb_array_length(items)>20;
    answer:=jsonb_build_object('items',(select coalesce(jsonb_agg(v order by pos),'[]')
      from jsonb_array_elements(items) with ordinality a(v,pos) where pos<=20),'hasMore',more,
      'snapshotAt',old_page->'snapshotAt','unreadCount',(old_page->>'unreadCount')::bigint+
        (select count(*) from app.group_notification_receipts r join app.group_notification_events e on e.id=r.event_id
          where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and r.read_at is null
            and app.group_notification_allowed(e.id,actor)));
  end if;
  perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);return answer;
exception when others then perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);raise;
end $$;
alter function app.notification_command_v3(text,jsonb) owner to app_owner;
revoke all on function app.notification_command_v3(text,jsonb) from public;
grant execute on function app.notification_command_v3(text,jsonb) to app_runtime;

-- Bound to one real queue job, not an arbitrary profile/email lookup.
create function app.group_notification_recipient_email(job uuid) returns text
language sql stable security definer set search_path='' as $$
  select u.email from app.group_notification_receipts j
    join app.group_notification_events e on e.id=j.event_id
    join app.profiles p on p.id=j.recipient_profile_id
    join app.demo_run_participants m on m.profile_id=p.id and m.run_id=e.run_id
    join app.demo_runs d on d.id=m.run_id join auth.users u on u.id=p.auth_user_id
  where j.id=job and p.record_source='user' and p.claimed_at is not null and m.status='active'
    and d.status='active' and d.catalogue_visibility='public' and u.email_confirmed_at is not null
    and u.deleted_at is null and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and u.email is not null and u.email<>''
$$;
alter function app.group_notification_recipient_email(uuid) owner to postgres;
revoke all on function app.group_notification_recipient_email(uuid) from public,app_runtime,app_notification_worker;
grant execute on function app.group_notification_recipient_email(uuid) to app_owner;

create function app.prepare_group_notification_email(job uuid,lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j app.group_notification_receipts;email text;result jsonb;group_flag text:=coalesce(current_setting('app.group_session_management',true),'');
begin
  select * into j from app.group_notification_receipts where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return null;end if;
  perform app.mail_flags(true);perform set_config('app.group_session_management','on',true);email:=app.group_notification_recipient_email(j.id);
  if j.due_at>statement_timestamp() or email is null or not app.group_notification_allowed(j.event_id,j.recipient_profile_id) then
    update app.group_notification_receipts set state='suppressed',lease_id=null,lease_until=null,finished_at=statement_timestamp() where id=j.id;
    perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);return null;
  end if;
  result:=app.group_notification_data(j.event_id,j.recipient_profile_id)||jsonb_build_object('id',j.id,'email',email);
  update app.group_notification_receipts set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);return result;
exception when others then perform app.mail_flags(false);perform set_config('app.group_session_management',group_flag,true);raise;
end $$;
alter function app.prepare_group_notification_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_group_notification_email(uuid,uuid) from public;
grant execute on function app.prepare_group_notification_email(uuid,uuid) to app_notification_worker;

create function app.claim_group_notification_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';
  end if;
  -- Expiry after possible handoff is ambiguous: quarantine, never auto resend.
  with expired as (
    select id from app.group_notification_receipts where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.group_notification_receipts j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select j.id from app.group_notification_receipts j where j.attempts<5 and j.due_at<=statement_timestamp()
      and (j.state='queued' or (j.state='claimed' and j.lease_until<=statement_timestamp()))
    order by j.due_at,j.id for update skip locked limit batch_size
  ), claimed as (
    update app.group_notification_receipts j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  -- A worker dying on its fifth pre-send claim must not leave a stuck claim.
  with exhausted as (
    select id from app.group_notification_receipts where attempts=5 and state='claimed'
      and lease_until<=statement_timestamp() order by lease_until,id
    for update skip locked limit batch_size
  ) update app.group_notification_receipts j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_group_notification_emails(integer) owner to app_owner;
revoke all on function app.claim_group_notification_emails(integer) from public;
grant execute on function app.claim_group_notification_emails(integer) to app_notification_worker;

create function app.finish_group_notification_email(job uuid, lease uuid, outcome text, provider text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare j app.group_notification_receipts;
begin
  if outcome not in ('accepted','retry','failed','unknown') or outcome is null
    or length(provider)>200 then raise exception 'invalid notification result' using errcode='P0001'; end if;
  select * into j from app.group_notification_receipts where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return false; end if;
  update app.group_notification_receipts set state=case
      when outcome='retry' and j.attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+
      make_interval(secs=>least(3600,30*power(2,j.attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider,finished_at=statement_timestamp()
    where id=j.id;
  return true;
end $$;
alter function app.finish_group_notification_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_group_notification_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_group_notification_email(uuid,uuid,text,text) to app_notification_worker;


-- Reserve at least one claim for each kind. Legacy workers never claim group jobs.
create function app.claim_notification_emails_v3(batch_size integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare messages jsonb;bookings jsonb;groups jsonb;remaining integer;
begin
 if batch_size is null or batch_size<3 or batch_size>20 then raise exception 'invalid notification batch' using errcode='P0001';end if;
 messages:=app.claim_notification_emails(greatest(1,batch_size/3));
 bookings:=app.claim_booking_notification_emails(greatest(1,batch_size/3));
 groups:=app.claim_group_notification_emails(batch_size-jsonb_array_length(messages)-jsonb_array_length(bookings));
 remaining:=batch_size-jsonb_array_length(messages)-jsonb_array_length(bookings)-jsonb_array_length(groups);
 if remaining>0 then messages:=messages||app.claim_notification_emails(remaining);end if;
 remaining:=batch_size-jsonb_array_length(messages)-jsonb_array_length(bookings)-jsonb_array_length(groups);
 if remaining>0 then bookings:=bookings||app.claim_booking_notification_emails(remaining);end if;
 return (select coalesce(jsonb_agg(v),'[]') from (
 select value||jsonb_build_object('kind','message') v from jsonb_array_elements(messages)
 union all select value||jsonb_build_object('kind','booking') from jsonb_array_elements(bookings)
 union all select value||jsonb_build_object('kind','group') from jsonb_array_elements(groups)) claims);
end $$;
alter function app.claim_notification_emails_v3(integer) owner to app_owner;
revoke all on function app.claim_notification_emails_v3(integer) from public;
grant execute on function app.claim_notification_emails_v3(integer) to app_notification_worker;
