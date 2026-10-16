-- DEV0248: private booking labels and complete, bounded context-filtered history.
create table app.private_session_titles (
 booking_id uuid primary key references app.coach_private_bookings(id) on delete cascade,
 title text not null,
 revision integer not null check(revision > 0),
 updated_by uuid not null references app.profiles(id),
 constraint private_session_title_bounds check(title=btrim(title) and char_length(title)<=100 and octet_length(title)<=400 and title !~ '[[:cntrl:]]' and position(chr(8232) in title)=0 and position(chr(8233) in title)=0)
);
alter table app.private_session_titles owner to app_owner;
alter table app.private_session_titles enable row level security;
alter table app.private_session_titles force row level security;
revoke all on app.private_session_titles from public,anon,authenticated,service_role,app_runtime;
create policy session_title_management on app.private_session_titles for all to app_owner
 using(current_setting('app.message_management',true)='on') with check(current_setting('app.message_management',true)='on');

create or replace function app.mail_session_details(b app.coach_private_bookings) returns jsonb language plpgsql stable set search_path='' as $$
declare c app.message_conversations; ctx app.message_contexts; editable boolean:=false; begin
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
end $$;

create function app.current_session_title_details(booking uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b app.coach_private_bookings; flags jsonb; result jsonb; begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'message unavailable' using errcode='P0001'; end if;
 flags:=app.mail_trigger_enter();
 select * into b from app.coach_private_bookings where id=booking and run_id=current_setting('app.current_run_id',true)::uuid and credit_projection_id is null
  and current_setting('app.current_profile_id',true)::uuid in(coach_profile_id,client_profile_id);
 if b.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
 result:=app.mail_session_details(b);perform app.mail_trigger_leave(flags);return result;
end $$;

create or replace function app.mail_context_projection(c app.message_conversations,ctx app.message_contexts) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',ctx.id,'kind',ctx.kind,'requestId',r.id,'bookingId',b.id,'status',coalesce(b.status,r.status),
 'startsAt',coalesce(b.scheduled_start_at,r.scheduled_start_at),'endsAt',coalesce(b.scheduled_end_at,r.scheduled_end_at),
 'venue',coalesce(s.training_location_name,r.training_location_name),'deadline',r.decision_deadline_at,'canSend',app.mail_context_allowed(c,ctx))
 || case when b.id is null then jsonb_build_object('title','','titleRevision',0,'canEditTitle',false) else app.mail_session_details(b) end
 from (select 1) dummy left join app.coach_booking_requests r on ctx.kind='request' and r.id=ctx.source_id
 left join app.coach_private_bookings b on b.id=case when ctx.kind='booking' then ctx.source_id else r.accepted_booking_id end
 left join app.coach_availability_slots s on s.id=b.slot_id
$$;

-- Preserve the original dispatcher for all unchanged contact/consent/block actions.
alter function app.mail_dispatch(text,jsonb) rename to mail_dispatch_before_session_labels;
create function app.mail_dispatch(action text,args jsonb) returns jsonb language plpgsql set search_path='' as $$
declare actor uuid:=current_setting('app.current_profile_id',true)::uuid; run uuid:=current_setting('app.current_run_id',true)::uuid;
 c app.message_conversations; ctx app.message_contexts; b app.coach_private_bookings; metadata app.private_session_titles;
 label text; expected integer; items jsonb; before_seq integer; after_seq integer; last_read integer; lo integer; hi integer;
begin
 if action='session-title' then
  select * into b from app.coach_private_bookings where id=(args->>'bookingId')::uuid and run_id=run and credit_projection_id is null and actor in(coach_profile_id,client_profile_id);
  if b.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
  perform app.mail_lock_pair(run,b.coach_profile_id,b.client_profile_id);
  select * into b from app.coach_private_bookings where id=b.id for update;
  -- Ensure existing capability and block-window checks apply even for legacy bookings.
  c:=app.mail_ensure_conversation(run,b.coach_profile_id,b.client_profile_id);
  if not (app.mail_session_details(b)->>'canEditTitle')::boolean then raise exception 'message title read only' using errcode='P0001'; end if;
  if jsonb_typeof(args->'title') is distinct from 'string' or jsonb_typeof(args->'expectedRevision') is distinct from 'number' then raise exception 'message invalid title' using errcode='P0001'; end if;
  label:=btrim(args->>'title');expected:=(args->>'expectedRevision')::integer;
  if expected is null or expected<0 or char_length(label)>100 or octet_length(label)>400 or label ~ '[[:cntrl:]]' or position(chr(8232) in label)>0 or position(chr(8233) in label)>0 then raise exception 'message invalid title' using errcode='P0001'; end if;
  select * into metadata from app.private_session_titles where booking_id=b.id;
  if coalesce(metadata.revision,0)<>expected then
   if metadata.revision=expected+1 and metadata.title=label then return app.mail_session_details(b); end if;
   raise exception 'message title changed' using errcode='P0001';
  end if;
  insert into app.private_session_titles(booking_id,title,revision,updated_by) values(b.id,label,expected+1,actor)
   on conflict(booking_id) do update set title=excluded.title,revision=excluded.revision,updated_by=excluded.updated_by;
  return app.mail_session_details(b);
 end if;
 if action<>'thread' then return app.mail_dispatch_before_session_labels(action,args); end if;
 select * into c from app.message_conversations where id=(args->>'conversationId')::uuid and run_id=run and actor in(coach_profile_id,athlete_profile_id);
 if c.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
 if args->>'contextId' is not null then
  select * into ctx from app.message_contexts where id=(args->>'contextId')::uuid and conversation_id=c.id;
  if ctx.id is null then raise exception 'message unavailable' using errcode='P0001'; end if;
 end if;
 select coalesce(r.last_seq,0) into last_read from (select 1) dummy left join app.message_reads r on r.conversation_id=c.id and r.profile_id=actor;
 before_seq:=nullif(args->>'before','')::integer;after_seq:=nullif(args->>'after','')::integer;
 if (before_seq is not null and before_seq<1) or (after_seq is not null and after_seq<0) or (before_seq is not null and after_seq is not null) then raise exception 'message invalid cursor' using errcode='P0001'; end if;
 if before_seq is null and after_seq is null then after_seq:=case when ctx.id is null then greatest(0,least(last_read,c.last_seq-50)) else 0 end;end if;
 select coalesce(jsonb_agg(v.data order by v.seq),'[]'::jsonb) into items from (
  select e.seq,jsonb_build_object('id',e.id,'seq',e.seq,'senderProfileId',e.sender_profile_id,'kind',e.kind,'body',e.body,'createdAt',e.created_at,'contextId',e.context_id,'status',e.status_label) data
  from app.message_entries e left join app.message_contexts x on x.id=e.context_id
  where e.conversation_id=c.id and (ctx.id is null or e.context_id=ctx.id or (app.mail_context_booking(ctx) is not null and app.mail_context_booking(x)=app.mail_context_booking(ctx)))
  and (after_seq is null or e.seq>after_seq) and (before_seq is null or e.seq<before_seq)
  order by case when before_seq is null then e.seq else -e.seq end limit 50) v;
 select min((e->>'seq')::integer),max((e->>'seq')::integer) into lo,hi from jsonb_array_elements(items) e;
 return jsonb_build_object('conversation',app.mail_conversation_projection(c,actor),'entries',items,'lastSeq',c.last_seq,'readThrough',last_read,
 'hasOlder',exists(select 1 from app.message_entries e left join app.message_contexts x on x.id=e.context_id where e.conversation_id=c.id and e.seq<coalesce(lo,before_seq,0) and (ctx.id is null or e.context_id=ctx.id or (app.mail_context_booking(ctx) is not null and app.mail_context_booking(x)=app.mail_context_booking(ctx)))),
 'hasNewer',exists(select 1 from app.message_entries e left join app.message_contexts x on x.id=e.context_id where e.conversation_id=c.id and e.seq>coalesce(hi,after_seq,c.last_seq) and (ctx.id is null or e.context_id=ctx.id or (app.mail_context_booking(ctx) is not null and app.mail_context_booking(x)=app.mail_context_booking(ctx)))),
 'contexts',(select coalesce(jsonb_agg(app.mail_context_projection(c,x) order by x.created_at,x.id),'[]'::jsonb) from (select x.* from app.message_contexts x where conversation_id=c.id order by (x.id=ctx.id) desc,exists(select 1 from jsonb_array_elements(items) e where e->>'contextId'=x.id::text) desc,created_at desc,id desc limit 50) x));
end $$;

do $$ declare f regprocedure; begin
 foreach f in array array['app.mail_session_details(app.coach_private_bookings)'::regprocedure,'app.current_session_title_details(uuid)'::regprocedure,'app.mail_dispatch(text,jsonb)'::regprocedure] loop
  execute format('alter function %s owner to app_owner',f);
  execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime',f);
 end loop;
end $$;
grant execute on function app.current_session_title_details(uuid) to app_runtime;
