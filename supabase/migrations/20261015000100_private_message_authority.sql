-- DEV0244: private, server-managed messages. No time-based purge or thread closure.
create table app.message_conversations (
 id uuid primary key default gen_random_uuid(), run_id uuid not null,
 coach_profile_id uuid not null, athlete_profile_id uuid not null,
 last_seq integer not null default 0 check(last_seq>=0),
 created_at timestamptz not null default statement_timestamp(),
 activity_at timestamptz not null default statement_timestamp(),
 unique(run_id,id), unique(run_id,coach_profile_id,athlete_profile_id),
 foreign key(run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id),
 foreign key(run_id,athlete_profile_id) references app.demo_run_participants(run_id,profile_id),
 check(coach_profile_id<>athlete_profile_id)
);
create table app.message_contexts (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references app.message_conversations(id) on delete cascade,
 kind text not null check(kind in ('inquiry','request','booking')), source_id uuid,
 created_at timestamptz not null default statement_timestamp(),
 unique nulls not distinct(conversation_id,kind,source_id),
 check((kind='inquiry')=(source_id is null))
);
-- Original source references are checked by the privileged source/context helpers.
-- They deliberately avoid locking scheduling rows while holding a message-pair lock.
create table app.message_entries (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references app.message_conversations(id) on delete cascade,
 seq integer not null check(seq>0), context_id uuid references app.message_contexts(id),
 sender_profile_id uuid references app.profiles(id),
 kind text not null check(kind in ('text','request','status')), body text,
 submission_id uuid, event_key text unique, status_label text,
 created_at timestamptz not null default statement_timestamp(),
 unique(conversation_id,seq), unique(conversation_id,sender_profile_id,submission_id),
 check((kind='text' and body is not null and submission_id is not null and sender_profile_id is not null) or (kind<>'text' and body is null and submission_id is null and event_key is not null)),
 check(body is null or (char_length(body) between 1 and 4000 and octet_length(body)<=16000 and body ~ '[^[:space:]]'))
);
create table app.message_reads (
 conversation_id uuid not null references app.message_conversations(id) on delete cascade,
 profile_id uuid not null references app.profiles(id), last_seq integer not null default 0 check(last_seq>=0),
 primary key(conversation_id,profile_id)
);
create table app.message_consents (
 id uuid primary key, conversation_id uuid not null references app.message_conversations(id) on delete cascade,
 sender_profile_id uuid not null references app.profiles(id), recipient_profile_id uuid not null references app.profiles(id),
 first_body text not null check(char_length(first_body) between 1 and 4000 and octet_length(first_body)<=16000 and first_body ~ '[^[:space:]]'),
 status text not null default 'pending' check(status in ('pending','accepted','declined','withdrawn','revoked')),
 created_at timestamptz not null default statement_timestamp(), decided_at timestamptz,
 check(sender_profile_id<>recipient_profile_id), check((status='pending')=(decided_at is null))
);
create unique index message_one_pending_consent on app.message_consents(conversation_id) where status='pending';
create table app.message_blocks (
 id uuid primary key default gen_random_uuid(), run_id uuid not null,
 low_profile_id uuid not null references app.profiles(id), high_profile_id uuid not null references app.profiles(id),
 blocked_by_profile_id uuid not null references app.profiles(id),
 created_at timestamptz not null default statement_timestamp(), ended_at timestamptz,
 check(low_profile_id<high_profile_id), check(blocked_by_profile_id in (low_profile_id,high_profile_id))
);
create unique index message_one_active_block on app.message_blocks(run_id,low_profile_id,high_profile_id,blocked_by_profile_id) where ended_at is null;
create table app.message_block_bookings (
 block_id uuid not null references app.message_blocks(id) on delete cascade,
 booking_id uuid not null, until_at timestamptz not null,
 primary key(block_id,booking_id)
);
create index message_inbox on app.message_conversations(run_id,activity_at desc,id desc);
create index message_text_rate on app.message_entries(sender_profile_id,created_at) where kind='text';
create index message_context_source on app.message_contexts(kind,source_id);
create index message_consent_sender on app.message_consents(sender_profile_id,created_at);

-- No browser, public API, or runtime role can touch raw tables or internal helpers.
do $$ declare t text; begin
 foreach t in array array['message_conversations','message_contexts','message_entries','message_reads','message_consents','message_blocks','message_block_bookings'] loop
  execute format('alter table app.%I owner to app_owner',t);
  execute format('alter table app.%I enable row level security',t);
  execute format('alter table app.%I force row level security',t);
  execute format('revoke all on app.%I from public, anon, authenticated, service_role, app_runtime',t);
  execute format('create policy message_management on app.%I for all to app_owner using (current_setting(''app.message_management'',true)=''on'') with check (current_setting(''app.message_management'',true)=''on'')',t);
 end loop;
end $$;
create function app.mail_flags(enabled boolean) returns void language plpgsql set search_path='' as $$ begin
 perform app.connection_access_flags(enabled);
 perform set_config('app.message_management',case when enabled then 'on' else 'off' end,true);
end $$;
create function app.mail_lock_pair(run uuid,a uuid,b uuid) returns void language sql set search_path='' as $$
 select pg_advisory_xact_lock(hashtextextended('mail:'||run::text||':'||least(a,b)::text||':'||greatest(a,b)::text,0))
$$;
create function app.mail_blocked(run uuid,a uuid,b uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from app.message_blocks where run_id=run and low_profile_id=least(a,b) and high_profile_id=greatest(a,b) and ended_at is null)
$$;
create function app.mail_coach_enabled(c app.message_conversations) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id
 where p.run_id=c.run_id and p.profile_id=c.coach_profile_id and (p.is_demo or a.status='approved'))
$$;
create function app.mail_general_allowed(c app.message_conversations) returns boolean language sql stable set search_path='' as $$
 select not app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id) and app.mail_coach_enabled(c) and (
 exists(select 1 from app.coach_athlete_connection_pairs p join app.coach_athlete_connection_attempts a on a.pair_id=p.id
 where p.run_id=c.run_id and p.coach_profile_id=c.coach_profile_id and p.athlete_profile_id=c.athlete_profile_id and a.status='accepted')
 or exists(select 1 from app.message_consents a where a.conversation_id=c.id and a.status='accepted'))
$$;
create function app.mail_general_eligible(c app.message_conversations) returns boolean language sql stable set search_path='' as $$
 select app.mail_coach_enabled(c) and not app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id) and exists(
 select 1 from app.coach_private_bookings b where b.run_id=c.run_id and b.coach_profile_id=c.coach_profile_id and b.client_profile_id=c.athlete_profile_id and b.credit_projection_id is null and b.status in ('confirmed','completed'))
$$;
create function app.mail_context_booking(ctx app.message_contexts) returns uuid language sql stable set search_path='' as $$
 select case when ctx.kind='booking' then ctx.source_id when ctx.kind='request' then (select accepted_booking_id from app.coach_booking_requests where id=ctx.source_id) end
$$;
create function app.mail_context_allowed(c app.message_conversations,ctx app.message_contexts) returns boolean language plpgsql stable set search_path='' as $$
declare booking uuid; begin
 if ctx.conversation_id is distinct from c.id then return false; end if;
 if ctx.kind='request' and not exists(select 1 from app.coach_booking_requests r where r.id=ctx.source_id and r.run_id=c.run_id and r.coach_profile_id=c.coach_profile_id and r.client_profile_id=c.athlete_profile_id) then return false; end if;
 if ctx.kind='booking' and not exists(select 1 from app.coach_private_bookings b where b.id=ctx.source_id and b.run_id=c.run_id and b.coach_profile_id=c.coach_profile_id and b.client_profile_id=c.athlete_profile_id) then return false; end if;
 booking:=app.mail_context_booking(ctx);
 if app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id) then
  return booking is not null and exists(select 1 from app.coach_private_bookings b where b.id=booking and b.status in ('confirmed','completed'))
  and not exists(select 1 from app.message_blocks block where block.run_id=c.run_id and block.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and block.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and block.ended_at is null
   and not exists(select 1 from app.message_block_bookings snapshot where snapshot.block_id=block.id and snapshot.booking_id=booking and snapshot.until_at>statement_timestamp()));
 end if;
 if app.mail_coach_enabled(c) then return true; end if;
 return booking is not null and exists(select 1 from app.coach_private_bookings b where b.id=booking and b.status in ('confirmed','completed') and b.scheduled_end_at+interval '336 hours'>statement_timestamp());
end $$;
create function app.mail_ensure_conversation(run uuid,coach uuid,athlete uuid) returns app.message_conversations language plpgsql set search_path='' as $$
declare c app.message_conversations; begin
 perform app.mail_lock_pair(run,coach,athlete);
 if coach=athlete or not exists(select 1 from app.coach_profiles p where p.run_id=run and p.profile_id=coach)
 or not exists(select 1 from app.demo_run_participants p where p.run_id=run and p.profile_id=athlete) then raise exception 'message unavailable' using errcode='P0001'; end if;
 insert into app.message_conversations(run_id,coach_profile_id,athlete_profile_id) values(run,coach,athlete) on conflict(run_id,coach_profile_id,athlete_profile_id) do nothing;
 select * into strict c from app.message_conversations where run_id=run and coach_profile_id=coach and athlete_profile_id=athlete;
 return c;
end $$;
create function app.mail_ensure_context(c app.message_conversations,kind text,source uuid) returns uuid language plpgsql set search_path='' as $$
declare ctx app.message_contexts; begin
 if kind not in ('inquiry','request','booking') or (kind='inquiry')<>(source is null) then raise exception 'message unavailable' using errcode='P0001'; end if;
 -- Validate original entity ownership; no scheduling-row locks are acquired here.
 if kind='request' and not exists(select 1 from app.coach_booking_requests r where r.id=source and r.run_id=c.run_id and r.coach_profile_id=c.coach_profile_id and r.client_profile_id=c.athlete_profile_id) then raise exception 'message unavailable' using errcode='P0001'; end if;
 if kind='booking' and not exists(select 1 from app.coach_private_bookings b where b.id=source and b.run_id=c.run_id and b.coach_profile_id=c.coach_profile_id and b.client_profile_id=c.athlete_profile_id) then raise exception 'message unavailable' using errcode='P0001'; end if;
 insert into app.message_contexts(conversation_id,kind,source_id) values(c.id,kind,source) on conflict do nothing;
 select * into strict ctx from app.message_contexts x where x.conversation_id=c.id and x.kind=mail_ensure_context.kind and x.source_id is not distinct from source;
 return ctx.id;
end $$;
create function app.mail_append(c app.message_conversations,ctx uuid,sender uuid,kind text,body text,submission uuid,event text,label text,at_time timestamptz default statement_timestamp()) returns uuid language plpgsql set search_path='' as $$
declare n integer; id uuid; prior app.message_entries; begin
 if event is not null then select e.id into id from app.message_entries e where e.event_key=event; if found then return id; end if; end if;
 if submission is not null then
  select * into prior from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id=sender and e.submission_id=submission;
  if found then if (prior.body,prior.context_id,prior.kind) is distinct from (body,ctx,kind) then raise exception 'message submission conflicts' using errcode='P0001'; end if; return prior.id; end if;
 end if;
 if ctx is not null and not exists(select 1 from app.message_contexts x where x.id=ctx and x.conversation_id=c.id) then raise exception 'message context conflicts' using errcode='P0001'; end if;
 if sender is not null and sender not in(c.coach_profile_id,c.athlete_profile_id) then raise exception 'message sender conflicts' using errcode='P0001'; end if;
 update app.message_conversations set last_seq=last_seq+1,activity_at=greatest(activity_at,at_time) where message_conversations.id=c.id returning last_seq into n;
 insert into app.message_entries(conversation_id,seq,context_id,sender_profile_id,kind,body,submission_id,event_key,status_label,created_at)
 values(c.id,n,ctx,sender,kind,body,submission,event,label,at_time) returning message_entries.id into id;
 -- Own actions never make an unread item; never advance past earlier unread content.
 foreach sender in array array[c.coach_profile_id,c.athlete_profile_id] loop
  insert into app.message_reads(conversation_id,profile_id,last_seq) values(c.id,sender,0) on conflict do nothing;
 end loop;
 return id;
end $$;
create function app.mail_rate(c app.message_conversations,actor uuid,first_contact boolean) returns void language plpgsql set search_path='' as $$
declare per_pair integer; per_actor integer; new_pairs integer; begin
 -- Consent opening text counts immediately, before its eventual acceptance. Union
 -- deduplicates the same submission after it becomes an accepted text entry.
 with sends as (
  select e.conversation_id,e.submission_id,e.created_at from app.message_entries e join app.message_conversations v on v.id=e.conversation_id where e.sender_profile_id=actor and e.kind='text' and v.run_id=c.run_id
  union select a.conversation_id,a.id,a.created_at from app.message_consents a join app.message_conversations v on v.id=a.conversation_id where a.sender_profile_id=actor and v.run_id=c.run_id
 ) select count(*) filter(where conversation_id=c.id),count(*) into per_pair,per_actor from sends where created_at>statement_timestamp()-interval '1 minute';
 if per_pair>=20 or per_actor>=100 then raise exception 'message rate limited' using errcode='P0001'; end if;
 if first_contact then
  with sends as (
   select e.conversation_id,e.created_at from app.message_entries e join app.message_conversations v on v.id=e.conversation_id where e.sender_profile_id=actor and e.kind='text' and v.run_id=c.run_id
   union all select a.conversation_id,a.created_at from app.message_consents a join app.message_conversations v on v.id=a.conversation_id where a.sender_profile_id=actor and v.run_id=c.run_id
  ), firsts as (select conversation_id,min(created_at) at_time from sends group by conversation_id)
  select count(*) into new_pairs from firsts where at_time>statement_timestamp()-interval '24 hours' and conversation_id<>c.id;
  if new_pairs>=10 and not exists(select 1 from app.message_entries where conversation_id=c.id and sender_profile_id=actor and kind='text') and not exists(select 1 from app.message_consents where conversation_id=c.id and sender_profile_id=actor) then raise exception 'message rate limited' using errcode='P0001'; end if;
 end if;
end $$;
create function app.mail_context_projection(c app.message_conversations,ctx app.message_contexts) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',ctx.id,'kind',ctx.kind,'requestId',r.id,'bookingId',b.id,'status',coalesce(b.status,r.status),'startsAt',coalesce(b.scheduled_start_at,r.scheduled_start_at),'endsAt',coalesce(b.scheduled_end_at,r.scheduled_end_at),'venue',coalesce(s.training_location_name,r.training_location_name),'deadline',r.decision_deadline_at,'canSend',app.mail_context_allowed(c,ctx))
 from (select 1) dummy left join app.coach_booking_requests r on ctx.kind='request' and r.id=ctx.source_id
 left join app.coach_private_bookings b on b.id=case when ctx.kind='booking' then ctx.source_id else r.accepted_booking_id end
 left join app.coach_availability_slots s on s.id=b.slot_id
$$;
create function app.mail_conversation_projection(c app.message_conversations,actor uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',c.id,'coachProfileId',c.coach_profile_id,'athleteProfileId',c.athlete_profile_id,'actorProfileId',actor,
 'counterpartName',case when actor=c.coach_profile_id then athlete.display_name else coach.display_name end,'role',case when actor=c.coach_profile_id then 'coach' else 'athlete' end,
 'activityAt',c.activity_at,'canSendGeneral',app.mail_general_allowed(c),'canRequestGeneral',app.mail_general_eligible(c),'blocked',app.mail_blocked(c.run_id,c.coach_profile_id,c.athlete_profile_id),
 'blockedByMe',exists(select 1 from app.message_blocks b where b.run_id=c.run_id and b.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and b.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and b.ended_at is null and b.blocked_by_profile_id=actor),
 'unread',exists(select 1 from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id is distinct from actor and e.seq>coalesce((select last_seq from app.message_reads where conversation_id=c.id and profile_id=actor),0))
 or exists(select 1 from app.message_consents a where a.conversation_id=c.id and a.recipient_profile_id=actor and a.status='pending'),
 'consent',(select jsonb_build_object('id',a.id,'senderProfileId',a.sender_profile_id,'recipientProfileId',a.recipient_profile_id,'body',a.first_body,'status',a.status) from app.message_consents a where a.conversation_id=c.id order by a.created_at desc,a.id desc limit 1))
 from app.coach_profiles coach join app.profiles athlete on athlete.id=c.athlete_profile_id where coach.profile_id=c.coach_profile_id and coach.run_id=c.run_id
$$;
create function app.mail_dispatch(action text,args jsonb) returns jsonb language plpgsql set search_path='' as $$
declare actor uuid:=current_setting('app.current_profile_id',true)::uuid; run uuid:=current_setting('app.current_run_id',true)::uuid;
 c app.message_conversations; ctx app.message_contexts; attempt app.message_consents;
 coach uuid; athlete uuid; context_id uuid; id uuid; prior app.message_entries; items jsonb; n integer; before_seq integer; after_seq integer; last_read integer;
begin
 if action in ('inquire','send','request-consent') then perform pg_advisory_xact_lock(hashtextextended('mail-rate:'||run::text||':'||actor::text,0)); end if;
 if action='inbox' then
  if args->>'filter' is not null and args->>'filter' not in ('all','unread','requests') then raise exception 'message invalid filter' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(v.data order by v.activity_at desc,v.id desc),'[]'::jsonb) into items from (
   select p.id,p.activity_at,app.mail_conversation_projection(p,actor) data from app.message_conversations p where p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id)
   and (args->>'beforeAt' is null or (p.activity_at,p.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
   and (coalesce(args->>'filter','all')='all' or (args->>'filter'='unread' and (app.mail_conversation_projection(p,actor)->>'unread')::boolean)
   or (args->>'filter'='requests' and exists(select 1 from app.message_consents a where a.conversation_id=p.id and a.recipient_profile_id=actor and a.status='pending')))
   and (p.last_seq>0 or exists(select 1 from app.message_consents a where a.conversation_id=p.id))
   order by p.activity_at desc,p.id desc limit 20) v;
  return jsonb_build_object('items',items,'unreadCount',(select count(*) from app.message_conversations p where p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id) and (app.mail_conversation_projection(p,actor)->>'unread')::boolean));
 end if;
 if action='contact' then
  coach:=(args->>'coachId')::uuid;
  if coach=actor or not exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id where p.run_id=run and p.profile_id=coach and p.visibility='visible' and exists(select 1 from app.demo_run_participants member where member.run_id=run and member.profile_id=coach and member.status='active') and (p.is_demo or a.status='approved') and app.coach_has_publishable_primary_location(p.run_id,p.profile_id)) or app.mail_blocked(run,coach,actor) then raise exception 'message unavailable' using errcode='P0001'; end if;
  return (select jsonb_build_object('coachId',p.profile_id,'name',p.display_name) from app.coach_profiles p where p.run_id=run and p.profile_id=coach);
 end if;
 if action in ('inquire','open') then
  coach:=(args->>'coachId')::uuid; athlete:=actor;
  if action='open' and args->>'pairId' is not null then
   select p.coach_profile_id,p.athlete_profile_id into coach,athlete from app.coach_athlete_connection_pairs p where p.id=(args->>'pairId')::uuid and p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id);
   if not found then raise exception 'message unavailable' using errcode='P0001'; end if;
  end if;
  if coach is null or coach=athlete then raise exception 'message unavailable' using errcode='P0001'; end if;
  if action='inquire' then
   select e.* into prior from app.message_entries e join app.message_conversations v on v.id=e.conversation_id join app.message_contexts x on x.id=e.context_id where v.run_id=run and v.coach_profile_id=coach and v.athlete_profile_id=athlete and e.sender_profile_id=actor and e.submission_id=(args->>'submissionId')::uuid and x.kind='inquiry';
   if found then
    if prior.body is distinct from args->>'body' then raise exception 'message submission conflicts' using errcode='P0001'; end if;
    return jsonb_build_object('conversationId',prior.conversation_id,'entryId',prior.id);
   end if;
  end if;
  if action='inquire' and (not exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id where p.run_id=run and p.profile_id=coach and p.visibility='visible' and exists(select 1 from app.demo_run_participants member where member.run_id=run and member.profile_id=coach and member.status='active') and (p.is_demo or a.status='approved') and app.coach_has_publishable_primary_location(p.run_id,p.profile_id)) or app.mail_blocked(run,coach,athlete)) then raise exception 'message unavailable' using errcode='P0001'; end if;
  c:=app.mail_ensure_conversation(run,coach,athlete);
  if action='open' and not app.mail_general_allowed(c) and not app.mail_general_eligible(c) and not exists(select 1 from app.message_contexts where conversation_id=c.id) then raise exception 'message unavailable' using errcode='P0001'; end if;
  if action='inquire' then context_id:=app.mail_ensure_context(c,'inquiry',null); end if;
 else
  select * into c from app.message_conversations p where p.id=(args->>'conversationId')::uuid and p.run_id=run and actor in(p.coach_profile_id,p.athlete_profile_id);
  if not found then raise exception 'message unavailable' using errcode='P0001'; end if;
 end if;
 if action<>'thread' then
  perform app.mail_lock_pair(run,c.coach_profile_id,c.athlete_profile_id);
  select * into strict c from app.message_conversations where message_conversations.id=c.id;
 end if;
 if action in ('block','unblock') then return app.mail_change_block(c,actor,action='block'); end if;
 if action in ('inquire','send') then
  if action='send' then context_id:=nullif(args->>'contextId','')::uuid; end if;
  select * into prior from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id=actor and e.submission_id=(args->>'submissionId')::uuid;
  if found then
   if (prior.body,prior.context_id) is distinct from (args->>'body',context_id) then raise exception 'message submission conflicts' using errcode='P0001'; end if;
   return jsonb_build_object('conversationId',c.id,'entryId',prior.id);
  end if;
  if context_id is null then
   if not app.mail_general_allowed(c) then raise exception 'message consent required' using errcode='P0001'; end if;
  else
   select * into ctx from app.message_contexts x where x.id=context_id and x.conversation_id=c.id;
   if not found or not app.mail_context_allowed(c,ctx) then raise exception 'message unavailable' using errcode='P0001'; end if;
  end if;
  if args->>'body' is null or args->>'submissionId' is null then raise exception 'message invalid body' using errcode='P0001'; end if;
  perform app.mail_rate(c,actor,not exists(select 1 from app.message_entries e where e.conversation_id=c.id and e.sender_profile_id=actor));
  id:=app.mail_append(c,context_id,actor,'text',args->>'body',(args->>'submissionId')::uuid,null,null);
  return jsonb_build_object('conversationId',c.id,'entryId',id);
 end if;
 if action='open' then return jsonb_build_object('conversationId',c.id); end if;
 if action='request-consent' then
  if not app.mail_general_eligible(c) then raise exception 'message unavailable' using errcode='P0001'; end if;
  select * into attempt from app.message_consents a where a.id=(args->>'submissionId')::uuid;
  if found then if attempt.conversation_id<>c.id or attempt.sender_profile_id<>actor or attempt.first_body is distinct from args->>'body' then raise exception 'message submission conflicts' using errcode='P0001'; end if;
  else
   select * into attempt from app.message_consents a where a.conversation_id=c.id and a.status='pending';
   if not found then
    if exists(select 1 from app.message_consents a where a.conversation_id=c.id and a.status='declined' and a.decided_at>statement_timestamp()-interval '24 hours') then raise exception 'message rate limited' using errcode='P0001'; end if;
    perform app.mail_rate(c,actor,true);
    update app.message_conversations set activity_at=statement_timestamp() where message_conversations.id=c.id;
    insert into app.message_consents(id,conversation_id,sender_profile_id,recipient_profile_id,first_body)
    values((args->>'submissionId')::uuid,c.id,actor,case when actor=c.coach_profile_id then c.athlete_profile_id else c.coach_profile_id end,args->>'body') returning * into attempt;
   end if;
  end if;
  return jsonb_build_object('conversationId',c.id,'consentId',attempt.id);
 end if;
 if action='consent' then
  select * into attempt from app.message_consents a where a.id=(args->>'consentId')::uuid and a.conversation_id=c.id for update;
  if not found or args->>'decision' not in ('accept','decline','withdraw') then raise exception 'message unavailable' using errcode='P0001'; end if;
  if (args->>'decision'='withdraw' and attempt.sender_profile_id<>actor) or (args->>'decision'<>'withdraw' and attempt.recipient_profile_id<>actor) then raise exception 'message unavailable' using errcode='P0001'; end if;
  if attempt.status<>'pending' then
   if attempt.status=(case args->>'decision' when 'accept' then 'accepted' when 'decline' then 'declined' else 'withdrawn' end) then return '{}'::jsonb; end if;
   raise exception 'message consent conflicts' using errcode='P0001';
  end if;
  if args->>'decision'='accept' and not app.mail_general_eligible(c) then raise exception 'message unavailable' using errcode='P0001'; end if;
  update app.message_consents set status=case args->>'decision' when 'accept' then 'accepted' when 'decline' then 'declined' else 'withdrawn' end,decided_at=statement_timestamp() where message_consents.id=attempt.id;
  if args->>'decision'='accept' then
   perform app.mail_append(c,null,attempt.sender_profile_id,'text',attempt.first_body,attempt.id,null,null,attempt.created_at);
  end if;
  return '{}'::jsonb;
 end if;
 if action='read' then
  n:=(args->>'through')::integer;
  if n is null or n<0 or n>c.last_seq then raise exception 'message invalid read position' using errcode='P0001'; end if;
  insert into app.message_reads(conversation_id,profile_id,last_seq) values(c.id,actor,n) on conflict(conversation_id,profile_id) do update set last_seq=greatest(message_reads.last_seq,excluded.last_seq);
  return '{}'::jsonb;
 end if;
 if action='thread' then
  select coalesce(r.last_seq,0) into last_read from (select 1) dummy left join app.message_reads r on r.conversation_id=c.id and r.profile_id=actor;
  before_seq:=nullif(args->>'before','')::integer; after_seq:=nullif(args->>'after','')::integer;
  if (before_seq is not null and before_seq<1) or (after_seq is not null and after_seq<0) or (before_seq is not null and after_seq is not null) then raise exception 'message invalid cursor' using errcode='P0001'; end if;
  if after_seq is null and before_seq is null then after_seq:=greatest(0,least(last_read,c.last_seq-50)); end if;
  select coalesce(jsonb_agg(v.data order by v.seq),'[]'::jsonb) into items from (
   select e.seq,jsonb_build_object('id',e.id,'seq',e.seq,'senderProfileId',e.sender_profile_id,'kind',e.kind,'body',e.body,'createdAt',e.created_at,'contextId',e.context_id,'status',e.status_label) data
   from app.message_entries e where e.conversation_id=c.id and (after_seq is null or e.seq>after_seq) and (before_seq is null or e.seq<before_seq)
   order by case when before_seq is null then e.seq else -e.seq end limit 50) v;
  return jsonb_build_object('conversation',app.mail_conversation_projection(c,actor),'entries',items,'lastSeq',c.last_seq,'readThrough',last_read,
   'contexts',(select coalesce(jsonb_agg(app.mail_context_projection(c,x) order by x.created_at,x.id),'[]'::jsonb) from (select x.* from app.message_contexts x where conversation_id=c.id order by exists(select 1 from jsonb_array_elements(items) e where e->>'contextId'=x.id::text) desc,created_at desc,id desc limit 50) x));
 end if;
 raise exception 'message invalid operation' using errcode='P0001';
end $$;
create function app.message_command(action text,args jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>32768 then raise exception 'message unavailable' using errcode='P0001'; end if;
 perform app.mail_flags(true);
 result:=app.mail_dispatch(action,args);
 perform app.mail_flags(false);
 return result;
exception when others then perform app.mail_flags(false); raise;
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and (p.proname like 'mail_%' or p.proname='message_command') loop
  execute format('alter function %s owner to app_owner',f.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime',f.signature);
 end loop;
end $$;
grant execute on function app.message_command(text,jsonb) to app_runtime;
