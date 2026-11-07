-- MOV-177: one person conversation without rewriting original directed histories.
-- One atomic statement supports both CLI autocommit and operator ledger transactions.
do $migration$ begin
lock table app.message_conversations, app.message_entries in share row exclusive mode;

create table app.message_people (
  id uuid primary key references app.message_conversations(id) on delete cascade,
  run_id uuid not null,
  low_profile_id uuid not null,
  high_profile_id uuid not null,
  last_seq integer not null default 0 check(last_seq>=0),
  unique(run_id,low_profile_id,high_profile_id),
  check(low_profile_id<high_profile_id),
  foreign key(run_id,low_profile_id) references app.demo_run_participants(run_id,profile_id),
  foreign key(run_id,high_profile_id) references app.demo_run_participants(run_id,profile_id)
);
create table app.message_person_entries (
  entry_id uuid primary key references app.message_entries(id) on delete cascade,
  person_id uuid not null references app.message_people(id) on delete cascade,
  seq integer not null check(seq>0),
  unique(person_id,seq)
);
alter table app.message_people owner to app_owner;
alter table app.message_person_entries owner to app_owner;
alter table app.message_people enable row level security;
alter table app.message_people force row level security;
alter table app.message_person_entries enable row level security;
alter table app.message_person_entries force row level security;
create policy internal on app.message_people to app_owner using(true) with check(true);
create policy internal on app.message_person_entries to app_owner using(true) with check(true);
revoke all on app.message_people,app.message_person_entries from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

-- The first original conversation is the permanent public identity. Reverse IDs
-- remain resolvable through their unchanged participants; no alias can cross a pair.
do $bootstrap$ begin
perform app.mail_flags(true);
insert into app.message_people(id,run_id,low_profile_id,high_profile_id)
select distinct on(run_id,least(coach_profile_id,athlete_profile_id),greatest(coach_profile_id,athlete_profile_id))
  id,run_id,least(coach_profile_id,athlete_profile_id),greatest(coach_profile_id,athlete_profile_id)
from app.message_conversations
order by run_id,least(coach_profile_id,athlete_profile_id),greatest(coach_profile_id,athlete_profile_id),created_at,id;
-- Running timestamps preserve each original sequence even for backdated booking
-- activity. This indexes history only: no entry/read/notification is inserted anew.
with original as (
  select e.id,e.seq,c.id source,p.id person_id,c.created_at source_created,
    max(e.created_at) over(partition by c.id order by e.seq rows unbounded preceding) sort_at
  from app.message_entries e join app.message_conversations c on c.id=e.conversation_id
  join app.message_people p on p.run_id=c.run_id
    and p.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id)
    and p.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id)
)
insert into app.message_person_entries(entry_id,person_id,seq)
select id,person_id,row_number() over(partition by person_id order by sort_at,source_created,source,seq)::integer from original;
update app.message_people p set last_seq=(select count(*) from app.message_person_entries e where e.person_id=p.id);
perform app.mail_flags(false);
exception when others then perform app.mail_flags(false);raise;
end $bootstrap$;

create function app.mail_index_person() returns trigger
language plpgsql security definer set search_path='' as $$
declare c app.message_conversations; person uuid; position integer; flags jsonb;
begin
  flags:=app.mail_trigger_enter();
  if tg_table_name='message_conversations' then c:=new;
  else select * into strict c from app.message_conversations where id=new.conversation_id;end if;
  perform app.mail_lock_pair(c.run_id,c.coach_profile_id,c.athlete_profile_id);
  insert into app.message_people(id,run_id,low_profile_id,high_profile_id)
  values(c.id,c.run_id,least(c.coach_profile_id,c.athlete_profile_id),greatest(c.coach_profile_id,c.athlete_profile_id))
  on conflict(run_id,low_profile_id,high_profile_id) do nothing;
  if tg_table_name='message_entries' then
    update app.message_people set last_seq=last_seq+1
    where run_id=c.run_id and low_profile_id=least(c.coach_profile_id,c.athlete_profile_id)
      and high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id)
    returning id,last_seq into person,position;
    insert into app.message_person_entries(entry_id,person_id,seq) values(new.id,person,position);
  end if;
  perform app.mail_trigger_leave(flags);return new;
exception when others then perform app.mail_trigger_leave(flags);raise;
end $$;
alter function app.mail_index_person() owner to app_owner;
revoke all on function app.mail_index_person() from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create trigger mail_index_person after insert on app.message_conversations for each row execute function app.mail_index_person();
create trigger mail_index_person after insert on app.message_entries for each row execute function app.mail_index_person();

create function app.mail_person_allowed(dataset uuid,a uuid,b uuid) returns boolean
language sql stable set search_path='' as $$
  select a<>b and not app.mail_blocked(dataset,a,b)
    and exists(select 1 from app.demo_run_participants where run_id=dataset and profile_id=a and status='active')
    and exists(select 1 from app.demo_run_participants where run_id=dataset and profile_id=b and status='active')
    and exists(
      select 1 from app.message_conversations c where c.run_id=dataset
        and least(c.coach_profile_id,c.athlete_profile_id)=least(a,b)
        and greatest(c.coach_profile_id,c.athlete_profile_id)=greatest(a,b)
        and app.mail_coach_enabled(c)
        and (
          exists(select 1 from app.message_contexts x where x.conversation_id=c.id and app.mail_context_allowed(c,x))
          or exists(select 1 from app.coach_athlete_connection_pairs p
            join app.coach_athlete_connection_attempts v on v.pair_id=p.id
            where p.run_id=c.run_id and p.coach_profile_id=c.coach_profile_id
              and p.athlete_profile_id=c.athlete_profile_id and v.status='accepted')
          or exists(select 1 from app.message_consents v where v.conversation_id=c.id)
          or exists(select 1 from app.message_entries e join app.message_conversations v on v.id=e.conversation_id
            where v.run_id=dataset and least(v.coach_profile_id,v.athlete_profile_id)=least(a,b)
              and greatest(v.coach_profile_id,v.athlete_profile_id)=greatest(a,b) and e.kind='text')
        )
    )
$$;
alter function app.mail_person_allowed(uuid,uuid,uuid) owner to app_owner;
revoke all on function app.mail_person_allowed(uuid,uuid,uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create or replace function app.mail_general_allowed(c app.message_conversations) returns boolean
language sql stable set search_path='' as $$
  select app.mail_person_allowed(c.run_id,c.coach_profile_id,c.athlete_profile_id)
$$;

-- Public profile projection can clear its own application lookup flag. Eligibility
-- must not depend on expression evaluation order or a privileged test session.
create or replace function app.mail_coach_enabled(c app.message_conversations) returns boolean
language plpgsql stable set search_path='' as $$
declare allowed boolean;
  profile_flag text:=current_setting('app.coach_profile_management',true);
  application_flag text:=current_setting('app.coach_application_management',true);
begin
  perform set_config('app.coach_profile_management','on',true);
  perform set_config('app.coach_application_management','on',true);
  select exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id
    where p.run_id=c.run_id and p.profile_id=c.coach_profile_id and(p.is_demo or a.status='approved')) into allowed;
  perform set_config('app.coach_profile_management',coalesce(profile_flag,'off'),true);
  perform set_config('app.coach_application_management',coalesce(application_flag,'off'),true);
  return allowed;
exception when others then
  perform set_config('app.coach_profile_management',coalesce(profile_flag,'off'),true);
  perform set_config('app.coach_application_management',coalesce(application_flag,'off'),true);
  raise;
end $$;

-- Fence old clients too. A saved exact retry returns before insertion; a block
-- stops every NEW text, including legacy booking attachments. Notes are separate.
create function app.mail_guard_person_text() returns trigger
language plpgsql security definer set search_path='' as $$
declare c app.message_conversations; flags jsonb;
begin
  if new.kind<>'text' then return new;end if;
  flags:=app.mail_trigger_enter();
  select * into strict c from app.message_conversations where id=new.conversation_id;
  perform app.mail_lock_pair(c.run_id,c.coach_profile_id,c.athlete_profile_id);
  if not app.mail_person_allowed(c.run_id,c.coach_profile_id,c.athlete_profile_id) then
    raise exception 'message unavailable' using errcode='P0001';end if;
  perform app.mail_trigger_leave(flags);return new;
exception when others then perform app.mail_trigger_leave(flags);raise;
end $$;
alter function app.mail_guard_person_text() owner to app_owner;
revoke all on function app.mail_guard_person_text() from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create trigger mail_guard_person_text before insert on app.message_entries for each row execute function app.mail_guard_person_text();

create or replace function app.notification_entry_allowed(entry uuid,recipient uuid) returns boolean
language sql stable set search_path='' as $$
  select exists(select 1 from app.message_entries e join app.message_conversations c on c.id=e.conversation_id
    where e.id=entry and recipient in(c.coach_profile_id,c.athlete_profile_id)
      and app.mail_person_allowed(c.run_id,c.coach_profile_id,c.athlete_profile_id))
$$;

create function app.mail_person_projection(p app.message_people,actor uuid) returns jsonb
language sql stable set search_path='' as $$
  select app.mail_conversation_projection(c,actor)||jsonb_build_object('id',p.id,
    'activityAt',(select max(v.activity_at) from app.message_conversations v where v.run_id=p.run_id
      and least(v.coach_profile_id,v.athlete_profile_id)=p.low_profile_id
      and greatest(v.coach_profile_id,v.athlete_profile_id)=p.high_profile_id),
    'canSendGeneral',app.mail_person_allowed(p.run_id,p.low_profile_id,p.high_profile_id),
    'unread',exists(select 1 from app.message_person_entries m join app.message_entries e on e.id=m.entry_id
      left join app.message_reads r on r.conversation_id=e.conversation_id and r.profile_id=actor
      where m.person_id=p.id and e.sender_profile_id is distinct from actor and e.seq>coalesce(r.last_seq,0)))
  from app.message_conversations c where c.id=p.id
$$;
alter function app.mail_person_projection(app.message_people,uuid) owner to app_owner;
revoke all on function app.mail_person_projection(app.message_people,uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

create function app.message_command_v3(action text,args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; dataset uuid; p app.message_people; w app.member_welcomes; result jsonb;
  items jsonb; contexts jsonb; contacts jsonb; prior app.message_entries;
  before_seq integer; after_seq integer; through_seq integer; last_read integer; lo integer; hi integer;
  receipt record;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object'
    or octet_length(args::text)>32768 then raise exception 'message unavailable' using errcode='P0001';end if;
  actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
  perform app.mail_flags(true);
  if action in('contact','session-title') then
    result:=app.message_command_v2(action,args);
    if action='contact' then
      perform app.mail_flags(true);
      select q.* into p from app.message_people q where q.run_id=dataset
        and q.low_profile_id=least(actor,(result->>'coachId')::uuid)
        and q.high_profile_id=greatest(actor,(result->>'coachId')::uuid)
        and(q.last_seq>0 or app.mail_person_allowed(q.run_id,q.low_profile_id,q.high_profile_id));
      if p.id is not null then result:=result||jsonb_build_object('conversationId',p.id);end if;
    end if;
  elsif action in('open','inquire') then
    result:=app.message_command_v2(action,args);
    perform app.mail_flags(true);
    select q.* into strict p from app.message_people q join app.message_conversations c
      on c.id=(result->>'conversationId')::uuid where q.run_id=c.run_id
      and q.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id)
      and q.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id);
    result:=jsonb_set(result,'{conversationId}',to_jsonb(p.id));
  elsif action='inbox' then
    if coalesce(args->>'filter','all') not in('all','unread') or (args->>'beforeAt' is null)<>(args->>'beforeId' is null) then
      raise exception 'message invalid filter' using errcode='P0001';end if;
    select * into w from app.member_welcomes where run_id=dataset and profile_id=actor;
    with people as (
      select app.mail_person_projection(q,actor) item from app.message_people q
      where q.run_id=dataset and actor in(q.low_profile_id,q.high_profile_id)
        and (q.last_seq>0 or exists(select 1 from app.message_consents a join app.message_conversations c on c.id=a.conversation_id
          where c.run_id=q.run_id and least(c.coach_profile_id,c.athlete_profile_id)=q.low_profile_id
          and greatest(c.coach_profile_id,c.athlete_profile_id)=q.high_profile_id))
    ), all_items as (
      select item from people union all select app.welcome_conversation(w) where w.id is not null
    ), page as (
      select item from all_items where (coalesce(args->>'filter','all')='all' or(item->>'unread')::boolean)
        and(args->>'beforeAt' is null or((item->>'activityAt')::timestamptz,(item->>'id')::uuid)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
      order by (item->>'activityAt')::timestamptz desc,(item->>'id')::uuid desc limit 20
    ) select jsonb_build_object('items',coalesce((select jsonb_agg(item order by(item->>'activityAt')::timestamptz desc,(item->>'id')::uuid desc)from page),'[]'::jsonb),
      'unreadCount',(select count(*) from all_items where(item->>'unread')::boolean)) into result;
  else
    select * into w from app.member_welcomes where run_id=dataset and profile_id=actor and id=(args->>'conversationId')::uuid;
    if w.id is not null then
      result:=app.message_command_v2(action,args);
    else
      select q.* into p from app.message_people q join app.message_conversations c on c.id=(args->>'conversationId')::uuid
      where q.run_id=dataset and c.run_id=dataset and actor in(q.low_profile_id,q.high_profile_id)
        and q.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id)
        and q.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id);
      if p.id is null then raise exception 'message unavailable' using errcode='P0001';end if;
      if action in('send','read','block','unblock','thread') then
        perform app.mail_lock_pair(dataset,p.low_profile_id,p.high_profile_id);
        select * into strict p from app.message_people where id=p.id;
      end if;
      if action='send' then
        if args->>'contextId' is not null or jsonb_typeof(args->'body') is distinct from 'string' or args->>'submissionId' is null then
          raise exception 'message invalid body' using errcode='P0001';end if;
        select e.* into prior from app.message_entries e join app.message_person_entries m on m.entry_id=e.id
          where m.person_id=p.id and e.sender_profile_id=actor and e.submission_id=(args->>'submissionId')::uuid
          order by m.seq limit 1;
        if found then
          if prior.body is distinct from args->>'body' or prior.context_id is not null then
            raise exception 'message submission conflicts' using errcode='P0001';end if;
          result:=jsonb_build_object('conversationId',p.id,'entryId',prior.id);
        else
          result:=app.message_command_v2('send',args||jsonb_build_object('conversationId',p.id,'contextId',null));
        end if;
      elsif action in('block','unblock') then
        result:=app.message_command_v2(action,args||jsonb_build_object('conversationId',p.id));
      elsif action='read' then
        through_seq:=(args->>'through')::integer;
        if through_seq is null or through_seq<0 or through_seq>p.last_seq then raise exception 'message invalid read position' using errcode='P0001';end if;
        for receipt in select e.conversation_id,max(e.seq) seq from app.message_person_entries m join app.message_entries e on e.id=m.entry_id
          where m.person_id=p.id and m.seq<=through_seq group by e.conversation_id loop
          insert into app.message_reads(conversation_id,profile_id,last_seq) values(receipt.conversation_id,actor,receipt.seq)
            on conflict(conversation_id,profile_id) do update set last_seq=greatest(app.message_reads.last_seq,excluded.last_seq);
        end loop;
        result:='{}'::jsonb;
      elsif action='thread' then
        if args->>'contextId' is not null then raise exception 'message invalid filter' using errcode='P0001';end if;
        before_seq:=nullif(args->>'before','')::integer;after_seq:=nullif(args->>'after','')::integer;
        if(before_seq is not null and before_seq<1)or(after_seq is not null and after_seq<0)or(before_seq is not null and after_seq is not null)then
          raise exception 'message invalid cursor' using errcode='P0001';end if;
        select coalesce(min(m.seq)-1,p.last_seq) into last_read from app.message_person_entries m join app.message_entries e on e.id=m.entry_id
          left join app.message_reads r on r.conversation_id=e.conversation_id and r.profile_id=actor
          where m.person_id=p.id and e.sender_profile_id is distinct from actor and e.seq>coalesce(r.last_seq,0);
        if before_seq is null and after_seq is null then after_seq:=greatest(0,least(last_read,p.last_seq-50));end if;
        select coalesce(jsonb_agg(v.item order by v.seq),'[]'::jsonb) into items from(
          select m.seq,jsonb_build_object('id',e.id,'seq',m.seq,'senderProfileId',e.sender_profile_id,'kind',e.kind,
            'body',e.body,'createdAt',e.created_at,'contextId',e.context_id,'status',e.status_label)item
          from app.message_person_entries m join app.message_entries e on e.id=m.entry_id
          where m.person_id=p.id and(before_seq is null or m.seq<before_seq)and(after_seq is null or m.seq>after_seq)
          order by case when before_seq is null then m.seq else -m.seq end limit 50)v;
        select min((e->>'seq')::integer),max((e->>'seq')::integer)into lo,hi from jsonb_array_elements(items)e;
        select coalesce(jsonb_agg(v.item),'[]'::jsonb)into contexts from(
          select app.mail_context_projection(c,x)||jsonb_build_object('actorRole',case when actor=c.coach_profile_id then 'coach' else 'athlete' end)item
          from app.message_contexts x join app.message_conversations c on c.id=x.conversation_id
          where c.run_id=dataset and least(c.coach_profile_id,c.athlete_profile_id)=p.low_profile_id
            and greatest(c.coach_profile_id,c.athlete_profile_id)=p.high_profile_id
          order by exists(select 1 from jsonb_array_elements(items)e where e->>'contextId'=x.id::text)desc,x.created_at desc,x.id desc limit 50)v;
        select coalesce(jsonb_agg(v.item order by v.created_at,v.id),'[]'::jsonb)into contacts from(
          select distinct on(c.id) a.id,a.created_at,jsonb_build_object('id',a.id,'senderProfileId',a.sender_profile_id,
            'recipientProfileId',a.recipient_profile_id,'body',a.first_body,'status',a.status)item
          from app.message_consents a join app.message_conversations c on c.id=a.conversation_id
          where c.run_id=dataset and least(c.coach_profile_id,c.athlete_profile_id)=p.low_profile_id
            and greatest(c.coach_profile_id,c.athlete_profile_id)=p.high_profile_id
          order by c.id,a.created_at desc,a.id desc)v;
        result:=jsonb_build_object('conversation',app.mail_person_projection(p,actor),'entries',items,'contexts',contexts,
          'earlierContacts',contacts,'lastSeq',p.last_seq,'readThrough',last_read,
          'hasOlder',exists(select 1 from app.message_person_entries where person_id=p.id and seq<coalesce(lo,before_seq,0)),
          'hasNewer',exists(select 1 from app.message_person_entries where person_id=p.id and seq>coalesce(hi,after_seq,p.last_seq)));
      else raise exception 'message invalid operation' using errcode='P0001';end if;
    end if;
  end if;
  perform app.mail_flags(false);return result;
exception when others then perform app.mail_flags(false);raise;
end $$;
alter function app.message_command_v3(text,jsonb) owner to app_owner;
revoke all on function app.message_command_v3(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker,app_media_worker;
grant execute on function app.message_command_v3(text,jsonb) to app_runtime;

end $migration$;
