-- MOV-146: committed approval receipts, never a historical backfill.
create table app.coach_approval_notifications (
  id uuid primary key default gen_random_uuid(),
  review_event_id uuid not null unique references app.coach_application_review_events(id),
  profile_id uuid not null references app.coach_applications(profile_id),
  run_id uuid not null,
  application_revision integer not null check(application_revision between 1 and 1000000),
  display_name text not null check(length(display_name) between 2 and 80),
  approved_at timestamptz not null,
  read_at timestamptz,
  due_at timestamptz not null default statement_timestamp(),
  state text not null default 'queued' check(state in ('queued','claimed','sending','accepted','suppressed','failed','unknown')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text check(length(provider_id) between 1 and 200),
  finished_at timestamptz,
  foreign key(run_id,profile_id) references app.demo_run_participants(run_id,profile_id),
  check((lease_id is null)=(lease_until is null))
);
alter table app.coach_approval_notifications owner to app_owner;
alter table app.coach_approval_notifications enable row level security;
alter table app.coach_approval_notifications force row level security;
revoke all on app.coach_approval_notifications from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create policy internal on app.coach_approval_notifications to app_owner using(true) with check(true);
create index coach_approval_recipient on app.coach_approval_notifications(run_id,profile_id,approved_at desc,id desc);
create index coach_approval_due on app.coach_approval_notifications(due_at,id) where state in ('queued','claimed','sending');

do $$ declare relation text;begin
  foreach relation in array array['coach_applications','coach_profiles','coach_application_review_events','profiles','demo_run_participants','demo_runs'] loop
    execute format('create policy coach_approval_read on app.%I for select to app_owner using(current_setting(''app.coach_approval_read'',true)=''on'')',relation);
  end loop;
end $$;
create function app.capture_coach_approval_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_flag text:=coalesce(current_setting('app.coach_approval_read',true),'');
begin
  if new.decision<>'approved' then return new;end if;
  perform set_config('app.coach_approval_read','on',true);
  insert into app.coach_approval_notifications(review_event_id,profile_id,run_id,application_revision,display_name,approved_at)
  select new.id,new.profile_id,c.run_id,new.application_revision,c.display_name,new.created_at
    from app.coach_applications a join app.coach_profiles c on c.profile_id=a.profile_id
    where a.profile_id=new.profile_id and a.status='approved' and a.revision=new.application_revision
      and c.record_source='user' and not c.is_demo and app.staff_account_active(c.profile_id,c.run_id)
  on conflict(review_event_id) do nothing;
  perform set_config('app.coach_approval_read',previous_flag,true);return new;
exception when others then perform set_config('app.coach_approval_read',previous_flag,true);raise;
end $$;
alter function app.capture_coach_approval_notification() owner to app_owner;
revoke all on function app.capture_coach_approval_notification() from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create trigger capture_coach_approval after insert on app.coach_application_review_events
  for each row execute function app.capture_coach_approval_notification();

-- The exact job resolves only its currently eligible, verified owner. In-app history
-- remains a past-tense receipt if approval is subsequently suspended.
create function app.coach_approval_recipient_email(job uuid) returns text
language sql stable security definer set search_path='' as $$
  select u.email from app.coach_approval_notifications j
  join app.coach_applications a on a.profile_id=j.profile_id and a.revision=j.application_revision and a.status='approved'
  join app.profiles p on p.id=j.profile_id
  join app.demo_run_participants m on m.profile_id=p.id and m.run_id=j.run_id
  join app.demo_runs d on d.id=m.run_id join auth.users u on u.id=p.auth_user_id
  where j.id=job and p.record_source='user' and p.claimed_at is not null
    and m.status='active' and d.status='active' and d.catalogue_visibility='public'
    and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp()) and u.email is not null and u.email<>'';
$$;
alter function app.coach_approval_recipient_email(uuid) owner to postgres;
revoke all on function app.coach_approval_recipient_email(uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
grant execute on function app.coach_approval_recipient_email(uuid) to app_owner;

create function app.prepare_coach_approval_email(job uuid,lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j app.coach_approval_notifications;contact text;
begin
  select * into j from app.coach_approval_notifications where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return null;end if;
  contact:=app.coach_approval_recipient_email(j.id);
  if j.due_at>statement_timestamp() or contact is null then
    update app.coach_approval_notifications set state='suppressed',lease_id=null,lease_until=null,finished_at=statement_timestamp() where id=j.id;return null;
  end if;
  update app.coach_approval_notifications set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  return jsonb_build_object('id',j.id,'kind','coach-approval','event','approved','email',contact,'displayName',j.display_name,'approvedAt',j.approved_at);
end $$;
alter function app.prepare_coach_approval_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_coach_approval_email(uuid,uuid) from public;
grant execute on function app.prepare_coach_approval_email(uuid,uuid) to app_notification_worker;

create function app.claim_coach_approval_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';
  end if;
  -- Expiry after possible handoff is ambiguous: quarantine, never auto resend.
  with expired as (
    select id from app.coach_approval_notifications where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.coach_approval_notifications j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select j.id from app.coach_approval_notifications j where j.attempts<5 and j.due_at<=statement_timestamp()
      and (j.state='queued' or (j.state='claimed' and j.lease_until<=statement_timestamp()))
    order by j.due_at,j.id for update skip locked limit batch_size
  ), claimed as (
    update app.coach_approval_notifications j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  -- A worker dying on its fifth pre-send claim must not leave a stuck claim.
  with exhausted as (
    select id from app.coach_approval_notifications where attempts=5 and state='claimed'
      and lease_until<=statement_timestamp() order by lease_until,id
    for update skip locked limit batch_size
  ) update app.coach_approval_notifications j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_coach_approval_emails(integer) owner to app_owner;
revoke all on function app.claim_coach_approval_emails(integer) from public;
grant execute on function app.claim_coach_approval_emails(integer) to app_notification_worker;

create function app.finish_coach_approval_email(job uuid, lease uuid, outcome text, provider text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare j app.coach_approval_notifications;
begin
  if outcome not in ('accepted','retry','failed','unknown') or outcome is null
    or length(provider)>200 then raise exception 'invalid notification result' using errcode='P0001'; end if;
  select * into j from app.coach_approval_notifications where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return false; end if;
  update app.coach_approval_notifications set state=case
      when outcome='retry' and j.attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+
      make_interval(secs=>least(3600,30*power(2,j.attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider,finished_at=statement_timestamp()
    where id=j.id;
  return true;
end $$;
alter function app.finish_coach_approval_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_coach_approval_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_coach_approval_email(uuid,uuid,text,text) to app_notification_worker;


-- Contract v5 reserves capacity for approval and each of the four older kinds.
-- Old workers never claim an approval; the training lane stays independent.
create function app.claim_notification_emails_v5(batch_size integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare approvals jsonb;existing jsonb;remaining integer;
begin
  if batch_size is null or batch_size<5 or batch_size>20 then raise exception 'invalid notification batch' using errcode='P0001';end if;
  approvals:=app.claim_coach_approval_emails(greatest(1,batch_size/5));
  existing:=app.claim_notification_emails_v4(batch_size-jsonb_array_length(approvals));
  remaining:=batch_size-jsonb_array_length(approvals)-jsonb_array_length(existing);
  if remaining>0 then approvals:=approvals||app.claim_coach_approval_emails(remaining);end if;
  return existing||(select coalesce(jsonb_agg(value||jsonb_build_object('kind','coach-approval')),'[]') from jsonb_array_elements(approvals));
end $$;
alter function app.claim_notification_emails_v5(integer) owner to app_owner;
revoke all on function app.claim_notification_emails_v5(integer) from public;
grant execute on function app.claim_notification_emails_v5(integer) to app_notification_worker;

-- Version 1/2/3 list/read/read-all continue to affect only their original kinds.
create function app.notification_command_v4(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;old_page jsonb;approval_items jsonb;items jsonb;answer jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object'
    or octet_length(args::text)>2048 then raise exception 'notification unavailable' using errcode='P0001';end if;
  actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
  if not app.staff_account_active(actor,dataset) then raise exception 'notification unavailable' using errcode='42501';end if;
  if action='read' then
    if args - 'id'<>'{}'::jsonb or jsonb_typeof(args->'id')<>'string' or not(args?'id') then raise exception 'notification invalid args' using errcode='P0001';end if;
    update app.coach_approval_notifications set read_at=coalesce(read_at,statement_timestamp())
      where id=(args->>'id')::uuid and profile_id=actor and run_id=dataset;
    if found then return '{}'::jsonb;end if;
    return app.notification_command_v3(action,args);
  end if;
  old_page:=app.notification_command_v3(action,args);
  if action='read-all' then
    update app.coach_approval_notifications set read_at=statement_timestamp()
      where profile_id=actor and run_id=dataset and read_at is null and approved_at<=(args->>'throughAt')::timestamptz;
    return '{}'::jsonb;
  elsif action='list' then
    select coalesce(jsonb_agg(data order by approved_at desc,id desc),'[]') into approval_items from (
      select j.id,j.approved_at,jsonb_build_object('kind','coach-approval','event','approved','id',j.id,
        'displayName',j.display_name,'approvedAt',j.approved_at,'createdAt',j.approved_at,'readAt',j.read_at) data
      from app.coach_approval_notifications j where j.run_id=dataset and j.profile_id=actor
        and (coalesce(args->>'filter','all')='all' or j.read_at is null)
        and (args->>'beforeAt' is null or (j.approved_at,j.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
      order by j.approved_at desc,j.id desc limit 21
    ) page;
    select coalesce(jsonb_agg(v order by (v->>'createdAt')::timestamptz desc,(v->>'id')::uuid desc),'[]') into items
      from jsonb_array_elements((old_page->'items')||approval_items) v;
    answer:=jsonb_build_object('items',(select coalesce(jsonb_agg(v order by pos),'[]')
      from jsonb_array_elements(items) with ordinality a(v,pos) where pos<=20),
      'hasMore',(old_page->>'hasMore')::boolean or jsonb_array_length(items)>20,
      'snapshotAt',old_page->'snapshotAt','unreadCount',(old_page->>'unreadCount')::bigint+
        (select count(*) from app.coach_approval_notifications where run_id=dataset and profile_id=actor and read_at is null));
    return answer;
  end if;
  raise exception 'notification command is invalid' using errcode='P0001';
end $$;
alter function app.notification_command_v4(text,jsonb) owner to app_owner;
revoke all on function app.notification_command_v4(text,jsonb) from public;
grant execute on function app.notification_command_v4(text,jsonb) to app_runtime;
