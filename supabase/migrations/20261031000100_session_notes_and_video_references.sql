-- MOV-5 / MOV-152: original-booking notes and private dated-workout video references.
-- Additive only: no retained notes, accounts, bookings or messages are rewritten.
create function app.valid_training_videos(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare v jsonb;begin
 if value is null or jsonb_typeof(value)<>'array' then return false;end if;
 if jsonb_array_length(value)>5 then return false;end if;
 for v in select * from jsonb_array_elements(value) loop
  if jsonb_typeof(v)<>'object' or v-array['label','url']<>'{}'::jsonb or jsonb_typeof(v->'label')<>'string' or jsonb_typeof(v->'url')<>'string'
   or length(v->>'label') not between 1 and 80 or btrim(v->>'label')<>v->>'label' or v->>'label' ~ '[[:cntrl:]]'
   or length(v->>'url')>2048 or not (v->>'url' ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}(&t=[0-9]{1,6})?$'
    or v->>'url' ~ '^https://www\.instagram\.com/(p|reel)/[A-Za-z0-9_-]+/$') then return false;end if;
 end loop;return true;
end $$;
alter function app.valid_training_videos(jsonb) owner to app_owner;
revoke all on function app.valid_training_videos(jsonb) from public,anon,authenticated,service_role;

create table app.session_note_plans (
 booking_id uuid primary key references app.coach_private_bookings(id),
 author_id uuid not null references app.profiles(id),body text not null,
 videos jsonb not null default '[]' check(app.valid_training_videos(videos)),
 revision integer not null check(revision>0),created_at timestamptz not null default statement_timestamp(),updated_at timestamptz not null default statement_timestamp(),
 check(length(body)<=8000 and octet_length(body)<=32000 and translate(body,E'\n\t','')!~'[[:cntrl:]]')
);
create table app.session_note_entries (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references app.coach_private_bookings(id),
 kind text not null check(kind in('shared','private')),author_id uuid not null references app.profiles(id),
 body text not null check(length(btrim(body)) between 1 and 2000 and octet_length(body)<=8000 and translate(body,E'\n\t','')!~'[[:cntrl:]]'),
 videos jsonb not null default '[]' check(app.valid_training_videos(videos)),
 revision integer not null default 1 check(revision>0),created_at timestamptz not null default statement_timestamp(),updated_at timestamptz not null default statement_timestamp()
);
create index session_note_entries_page on app.session_note_entries(booking_id,kind,created_at desc,id desc);
create table app.session_note_operations (
 booking_id uuid not null references app.coach_private_bookings(id),actor_id uuid not null references app.profiles(id),
 kind text not null check(kind in('plan','shared','private')),operation_id uuid not null,payload jsonb not null,result jsonb not null,
 primary key(booking_id,actor_id,kind,operation_id)
);
do $$declare t text;begin foreach t in array array['session_note_plans','session_note_entries','session_note_operations'] loop
 execute format('alter table app.%I owner to app_owner',t);
 execute format('alter table app.%I enable row level security',t);
 execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role,app_runtime,app_notification_worker',t);
 execute format('create policy internal on app.%I to app_owner using(true) with check(true)',t);
end loop;end $$;

create function app.session_note_projection(id uuid,author uuid,body text,videos jsonb,revision integer,created_at timestamptz,updated_at timestamptz) returns jsonb
 language sql stable set search_path='' as $$
 select jsonb_build_object('id',id,'authorId',author,'authorName',coalesce((select display_name from app.profiles where profiles.id=author),'Session participant'),
 'body',body,'videos',videos,'revision',revision,'createdAt',created_at,'updatedAt',updated_at)
$$;
alter function app.session_note_projection(uuid,uuid,text,jsonb,integer,timestamptz,timestamptz) owner to app_owner;
revoke all on function app.session_note_projection(uuid,uuid,text,jsonb,integer,timestamptz,timestamptz) from public,anon,authenticated,service_role,app_runtime;

create function app.session_notes_impl(action text,args jsonb) returns jsonb language plpgsql set search_path='' as $$
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
 perform app.mail_lock_pair(dataset,b.coach_profile_id,b.client_profile_id);
 select * into b from app.coach_private_bookings where coach_private_bookings.id=b.id for update;
 -- Serialize shared permission checks against application suspension/review.
 perform 1 from app.coach_applications where profile_id=b.coach_profile_id for share;
 is_coach:=actor=b.coach_profile_id;
 if (kind='private' or kind='plan' and action='save') and not is_coach then raise exception 'notes forbidden' using errcode='42501';end if;
 can_write:=b.status in('confirmed','completed') and (kind='private' or coalesce((app.mail_session_details(b)->>'canEditTitle')::boolean,false));
 -- Waiting for a lock must not extend an existing M8 contact window. Reuse
 -- its branch order and captured deadlines, checked against time after locks.
 if can_write and kind<>'private' then
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
end $$;
-- Disambiguate PL/pgSQL locals from columns in bounded projection subqueries.
alter function app.session_notes_impl(text,jsonb) owner to app_owner;
revoke all on function app.session_notes_impl(text,jsonb) from public,anon,authenticated,service_role,app_runtime;
create function app.session_notes_command(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare flags jsonb;answer jsonb;begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'notes forbidden' using errcode='42501';end if;
 flags:=app.mail_trigger_enter();answer:=app.session_notes_impl(action,args);perform app.mail_trigger_leave(flags);return answer;
exception when others then if flags is not null then perform app.mail_trigger_leave(flags);end if;raise;end $$;
alter function app.session_notes_command(text,jsonb) owner to app_owner;
revoke all on function app.session_notes_command(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker;
grant execute on function app.session_notes_command(text,jsonb) to app_runtime;

-- Preserve every existing private note. Older consumers omit videos and leave
-- the new column untouched. New reference-bearing retries record their full input.
alter table app.athlete_training_entries add column videos jsonb not null default '[]' check(app.valid_training_videos(videos));
create table app.training_video_operations (
 run_id uuid not null references app.demo_runs(id),profile_id uuid not null references app.profiles(id),command_id uuid not null,payload jsonb not null,
 primary key(run_id,profile_id,command_id)
);
alter table app.training_video_operations owner to app_owner;
alter table app.training_video_operations enable row level security;
alter table app.training_video_operations force row level security;
revoke all on app.training_video_operations from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create policy internal on app.training_video_operations to app_owner using(true) with check(true);
alter function app.athlete_training_command(text,jsonb) rename to athlete_training_command_without_videos;
revoke all on function app.athlete_training_command_without_videos(text,jsonb) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create function app.athlete_training_command(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;answer jsonb;existing jsonb;begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'training forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
 if action='list' then
  answer:=app.athlete_training_command_without_videos(action,args);
  return jsonb_set(answer,'{items}',coalesce((select jsonb_agg(i||jsonb_build_object('videos',coalesce((select e.videos from app.athlete_training_entries e where e.run_id=dataset and e.profile_id=actor and e.occurrence_key=i->>'key'),'[]'::jsonb)) order by n) from jsonb_array_elements(answer->'items') with ordinality rows(i,n)),'[]'::jsonb));
 end if;
 perform pg_advisory_xact_lock(hashtextextended(dataset::text||actor::text,120));
 select o.payload into existing from app.training_video_operations o where o.run_id=dataset and o.profile_id=actor and o.command_id=(args->>'commandId')::uuid;
 if found then if existing<>jsonb_build_object('action',action,'args',args) then raise exception 'training retry changed' using errcode='40001';end if;return '{"saved":true}';end if;
 if args?'videos' then
  if action not in('save','attendance') or coalesce((args->>'weekly')::boolean,false) or not app.valid_training_videos(args->'videos') then raise exception 'invalid training videos' using errcode='22023';end if;
  if exists(select 1 from app.athlete_training_commands c where c.run_id=dataset and c.profile_id=actor and c.command_id=(args->>'commandId')::uuid) then raise exception 'training retry changed' using errcode='40001';end if;
 end if;
 answer:=app.athlete_training_command_without_videos(action,args-'videos');
 if args?'videos' then
  update app.athlete_training_entries e set videos=args->'videos' where e.run_id=dataset and e.profile_id=actor and e.occurrence_key=coalesce(args->>'key','manual:'||(args->>'commandId'));
  insert into app.training_video_operations values(dataset,actor,(args->>'commandId')::uuid,jsonb_build_object('action',action,'args',args));
 end if;
 return answer;
end $$;
alter function app.athlete_training_command(text,jsonb) owner to app_owner;
revoke all on function app.athlete_training_command(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker;
grant execute on function app.athlete_training_command(text,jsonb) to app_runtime;
