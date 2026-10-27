-- MOV-131: one private, read-only welcome for successful new registrations.
create table app.member_welcomes (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null,
 profile_id uuid not null unique,
 body text not null check(length(body) between 1 and 4000 and octet_length(body)<=16000),
 content_version integer not null default 1 check(content_version>0),
 created_at timestamptz not null default statement_timestamp(),
 read_at timestamptz check(read_at>=created_at),
 foreign key(run_id,profile_id) references app.demo_run_participants(run_id,profile_id) on delete cascade
);
alter table app.member_welcomes owner to app_owner;
alter table app.member_welcomes enable row level security;
alter table app.member_welcomes force row level security;
revoke all on app.member_welcomes from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create policy internal on app.member_welcomes to app_owner using(true) with check(true);

-- Private registration hook: no Auth account, coach profile, human conversation or email.
create function app.create_member_welcome(dataset uuid,recipient uuid) returns void
language plpgsql set search_path='' as $$
declare previous_flag text:=current_setting('app.identity_enrollment',true);
begin
 perform set_config('app.identity_enrollment','on',true);
 insert into app.member_welcomes(run_id,profile_id,body)
 select dataset,p.id,E'Welcome to MovX!\n\nFind coaches and group sessions, plan your routine, and track your activity in your personal calendar.\n\nMovX is in beta. We’re still optimizing the experience and making the app easier to use, so you may notice changes as we improve it.\n\nThanks for being part of MovX!'
 from app.profiles p join app.demo_run_participants m on m.profile_id=p.id and m.run_id=dataset
 join app.demo_runs r on r.id=m.run_id
 where p.id=recipient and p.record_source='user' and p.claimed_at is not null
 and m.status='active' and r.status='active' and r.catalogue_visibility='public'
 on conflict(profile_id) do nothing;
 if not exists(select 1 from app.member_welcomes where profile_id=recipient and run_id=dataset)then
  raise exception 'welcome enrollment unavailable' using errcode='P0001';
 end if;
 perform set_config('app.identity_enrollment',coalesce(previous_flag,'off'),true);
exception when others then
 perform set_config('app.identity_enrollment',coalesce(previous_flag,'off'),true);
 raise;
end $$;
alter function app.create_member_welcome(uuid,uuid) owner to app_owner;
revoke all on function app.create_member_welcome(uuid,uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;

create or replace function app.enroll_application_identity(
  requested_auth_user_id uuid,
  requested_display_name text,
  requested_full_name text,
  requested_username text
) returns table (
  identity_profile_id uuid, identity_profile_slug text, identity_display_name text,
  identity_run_id uuid, identity_run_slug text, identity_run_name text, identity_role text
)
language plpgsql security definer set search_path = '' as $$
declare
  display_value text := btrim(regexp_replace(requested_display_name, '[[:space:]]+', ' ', 'g'));
  full_value text := btrim(regexp_replace(requested_full_name, '[[:space:]]+', ' ', 'g'));
  handle text := regexp_replace(lower(btrim(requested_username)), '^@', '');
  enrolled record;
  existing_profile boolean;
  previous_profile text := current_setting('app.current_profile_id', true);
begin
  if requested_auth_user_id is null or handle is null or handle !~ '^[a-z][a-z0-9_]{2,29}$'
    or display_value is null or char_length(display_value) not between 2 and 80 or display_value !~ '[[:alnum:]]'
    or full_value is null or char_length(full_value) not between 2 and 80 or full_value !~ '[[:alnum:]]'
    or requested_display_name ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
    or requested_full_name ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
  then
    raise exception 'registration profile details are invalid' using errcode = '22023';
  end if;

  -- Serialize retries for one identity; the existing unique constraint arbitrates
  -- different identities and ordinary Account username edits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requested_auth_user_id::text, 325));
  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);
  select exists (select 1 from app.profiles p where p.auth_user_id = requested_auth_user_id) into existing_profile;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);
  if existing_profile then
    return query select * from app.enroll_application_identity(requested_auth_user_id, display_value);
    return;
  end if;

  select * into strict enrolled from app.enroll_application_identity(requested_auth_user_id, display_value);
  perform pg_catalog.set_config('app.current_profile_id', enrolled.identity_profile_id::text, true);
  perform pg_catalog.set_config('app.account_settings_management', 'on', true);
  insert into app.account_personal_details(profile_id, legal_name, preferred_first_name, username)
  values (enrolled.identity_profile_id, full_value, display_value, handle);
  update app.profiles set chat_first_name = display_value where id = enrolled.identity_profile_id;
  perform app.create_member_welcome(enrolled.identity_run_id, enrolled.identity_profile_id);
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  perform pg_catalog.set_config('app.current_profile_id', coalesce(previous_profile, ''), true);
  return query select enrolled.identity_profile_id, enrolled.identity_profile_slug, enrolled.identity_display_name,
    enrolled.identity_run_id, enrolled.identity_run_slug, enrolled.identity_run_name, enrolled.identity_role;
exception when others then
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  perform pg_catalog.set_config('app.current_profile_id', coalesce(previous_profile, ''), true);
  raise;
end;
$$;

-- Existing enrollment signature, owner, grants and existing-profile retry path stay intact.

create function app.welcome_conversation(w app.member_welcomes) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',w.id,'coachProfileId',null,'athleteProfileId',w.profile_id,
 'actorProfileId',w.profile_id,'role','movx','counterpartName','MovX','counterpartProfileHref',null,
 'counterpartMedia',null,'activityAt',w.created_at,'canSendGeneral',false,'canRequestGeneral',false,
 'blocked',false,'blockedByMe',false,'unread',w.read_at is null,'consent',null)
$$;
alter function app.welcome_conversation(app.member_welcomes) owner to app_owner;
revoke all on function app.welcome_conversation(app.member_welcomes) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;

-- Version opt-in keeps old clients and ordinary conversation authority unchanged.
create function app.message_command_v2(action text,args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid; dataset uuid; w app.member_welcomes; result jsonb; items jsonb;
 show_entry boolean;
begin
 if not app.authorized_actor_context_valid(null,null,null) or args is null
 or jsonb_typeof(args)<>'object' or octet_length(args::text)>32768 then
  raise exception 'message unavailable' using errcode='P0001';
 end if;
 actor:=current_setting('app.current_profile_id')::uuid;
 dataset:=current_setting('app.current_run_id')::uuid;
 select * into w from app.member_welcomes where run_id=dataset and profile_id=actor;
 if action='inbox' then
  result:=app.message_command(action,args);
  if w.id is not null then
   select coalesce(jsonb_agg(v.item order by v.at_time desc,v.id desc),'[]'::jsonb) into items from (
    select item,(item->>'activityAt')::timestamptz at_time,(item->>'id')::uuid id
    from jsonb_array_elements(result->'items') item
    union all
    select app.welcome_conversation(w),w.created_at,w.id
    where (coalesce(args->>'filter','all')='all' or w.read_at is null)
    and(args->>'beforeAt' is null or(w.created_at,w.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
    order by at_time desc,id desc limit 20
   )v;
   result:=jsonb_set(result,'{items}',items);
   result:=jsonb_set(result,'{unreadCount}',to_jsonb((result->>'unreadCount')::integer+case when w.read_at is null then 1 else 0 end));
  end if;
  return result;
 end if;
 if w.id is not null and args->>'conversationId'=w.id::text then
  if action='thread' then
   if args->>'contextId' is not null or(args->>'before' is not null and args->>'after' is not null)
    or coalesce((args->>'before')::bigint,0) not between 0 and 2147483647
    or coalesce((args->>'after')::bigint,0) not between 0 and 2147483647 then
    raise exception 'message unavailable' using errcode='P0001';
   end if;
   show_entry:=(args->>'before' is null or(args->>'before')::integer>1)
    and(args->>'after' is null or(args->>'after')::integer<1);
   return jsonb_build_object('conversation',app.welcome_conversation(w),'contexts','[]'::jsonb,
    'entries',case when show_entry then jsonb_build_array(jsonb_build_object('id',w.id,'seq',1,
    'senderProfileId',null,'kind','text','body',w.body,'createdAt',w.created_at,'contextId',null,'status',null))else '[]'::jsonb end,
    'lastSeq',1,'readThrough',case when w.read_at is null then 0 else 1 end,'hasOlder',false,'hasNewer',false);
  elsif action='read' then
   if args->>'through' is null or(args->>'through')::bigint not between 0 and 2147483647 then
    raise exception 'message unavailable' using errcode='P0001';
   end if;
   if(args->>'through')::integer>=1 then
    update app.member_welcomes set read_at=coalesce(read_at,greatest(created_at,statement_timestamp()))
    where id=w.id and profile_id=actor and run_id=dataset and read_at is null;
   end if;
   return '{}'::jsonb;
  else
   raise exception 'welcome is read only' using errcode='P0001';
  end if;
 end if;
 return app.message_command(action,args);
end $$;
alter function app.message_command_v2(text,jsonb) owner to app_owner;
revoke all on function app.message_command_v2(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker;
grant execute on function app.message_command_v2(text,jsonb) to app_runtime;
