-- MOV-253: recipient-only in-app alerts for new pending connection attempts.
-- No backfill, email outbox, connection authority change or old-version rewrite.
do $migration$ begin
create table app.connection_request_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references app.coach_athlete_connection_attempts(id) on delete cascade,
  run_id uuid not null,
  recipient_profile_id uuid not null,
  created_at timestamptz not null,
  read_at timestamptz check(read_at is null or read_at>=created_at),
  foreign key(run_id,recipient_profile_id) references app.demo_run_participants(run_id,profile_id) on delete cascade
);
alter table app.connection_request_notifications owner to app_owner;
alter table app.connection_request_notifications enable row level security;
alter table app.connection_request_notifications force row level security;
create policy internal on app.connection_request_notifications to app_owner using(true) with check(true);
revoke all on app.connection_request_notifications from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker,app_calendar_worker;
create index connection_request_notice_history on app.connection_request_notifications(run_id,recipient_profile_id,created_at desc,id desc);

create function app.capture_connection_request_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into app.connection_request_notifications(request_id,run_id,recipient_profile_id,created_at)
    values(new.id,new.run_id,new.recipient_profile_id,new.created_at)
    on conflict(request_id) do nothing;
  return new;
end $$;
alter function app.capture_connection_request_notification() owner to app_owner;
revoke all on function app.capture_connection_request_notification() from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker,app_calendar_worker;
create trigger capture_connection_request_notification after insert on app.coach_athlete_connection_attempts
  for each row when(new.status='pending') execute function app.capture_connection_request_notification();

-- Called only within the actor-checked command's private read context. Recheck
-- the original recipient/source pair and current membership/block boundaries.
create function app.connection_request_notification_data(notice uuid,recipient uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('kind','connection-request','id',n.id,'requestId',a.id,
    'createdAt',n.created_at,'readAt',n.read_at,
    'senderName',case when a.sender_profile_id=p.coach_profile_id then c.display_name else s.display_name end,
    'recipientRole',case when recipient=p.coach_profile_id then 'coach' else 'athlete' end)
  from app.connection_request_notifications n
  join app.coach_athlete_connection_attempts a on a.id=n.request_id and a.run_id=n.run_id and a.recipient_profile_id=n.recipient_profile_id
  join app.coach_athlete_connection_pairs p on p.id=a.pair_id and p.run_id=n.run_id
  join app.coach_profiles c on c.profile_id=p.coach_profile_id and c.run_id=p.run_id
  join app.profiles s on s.id=a.sender_profile_id
  where n.id=notice and n.recipient_profile_id=recipient
    and n.run_id::text=current_setting('app.current_run_id',true)
    and recipient::text=current_setting('app.current_profile_id',true)
    and recipient in(p.coach_profile_id,p.athlete_profile_id)
    and a.sender_profile_id in(p.coach_profile_id,p.athlete_profile_id)
    and app.staff_account_active(recipient,n.run_id) and app.staff_account_active(a.sender_profile_id,n.run_id)
    and not app.mail_blocked(n.run_id,a.sender_profile_id,recipient)
$$;
alter function app.connection_request_notification_data(uuid,uuid) owner to app_owner;
revoke all on function app.connection_request_notification_data(uuid,uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker,app_calendar_worker;

create function app.notification_command_v6(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;old_page jsonb;connection_items jsonb;items jsonb;answer jsonb;flags jsonb;updated boolean;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object'
    or octet_length(args::text)>2048 then raise exception 'notification unavailable' using errcode='P0001';end if;
  actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
  if not app.staff_account_active(actor,dataset) then raise exception 'notification unavailable' using errcode='42501';end if;
  if action='read' then
    if args-'id'<>'{}'::jsonb or jsonb_typeof(args->'id') is distinct from 'string' then raise exception 'notification invalid args' using errcode='P0001';end if;
    flags:=app.mail_trigger_enter();
    update app.connection_request_notifications n set read_at=coalesce(n.read_at,statement_timestamp())
      where n.id=(args->>'id')::uuid and n.run_id=dataset and n.recipient_profile_id=actor
        and app.connection_request_notification_data(n.id,actor) is not null;
    updated:=found;perform app.mail_trigger_leave(flags);
    if updated then return '{}'::jsonb;end if;
    return app.notification_command_v5(action,args);
  end if;
  old_page:=app.notification_command_v5(action,args);
  flags:=app.mail_trigger_enter();
  if action='read-all' then
    update app.connection_request_notifications n set read_at=statement_timestamp()
      where n.run_id=dataset and n.recipient_profile_id=actor and n.read_at is null
        and n.created_at<=(args->>'throughAt')::timestamptz
        and app.connection_request_notification_data(n.id,actor) is not null;
    answer:='{}'::jsonb;
  elsif action='list' then
    select coalesce(jsonb_agg(data order by created_at desc,id desc),'[]') into connection_items from (
      select n.id,n.created_at,app.connection_request_notification_data(n.id,actor) data
      from app.connection_request_notifications n
      where n.run_id=dataset and n.recipient_profile_id=actor
        and app.connection_request_notification_data(n.id,actor) is not null
        and (coalesce(args->>'filter','all')='all' or n.read_at is null)
        and (args->>'beforeAt' is null or (n.created_at,n.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
      order by n.created_at desc,n.id desc limit 21
    ) page;
    select coalesce(jsonb_agg(v order by (v->>'createdAt')::timestamptz desc,(v->>'id')::uuid desc),'[]') into items
      from jsonb_array_elements((old_page->'items')||connection_items) v;
    answer:=jsonb_build_object('items',(select coalesce(jsonb_agg(v order by pos),'[]')
      from jsonb_array_elements(items) with ordinality a(v,pos) where pos<=20),
      'hasMore',(old_page->>'hasMore')::boolean or jsonb_array_length(items)>20,
      'snapshotAt',old_page->'snapshotAt','unreadCount',(old_page->>'unreadCount')::bigint+
        (select count(*) from app.connection_request_notifications n where n.run_id=dataset and n.recipient_profile_id=actor and n.read_at is null
          and app.connection_request_notification_data(n.id,actor) is not null));
  end if;
  perform app.mail_trigger_leave(flags);return answer;
exception when others then perform app.mail_trigger_leave(flags);raise;
end $$;
alter function app.notification_command_v6(text,jsonb) owner to app_owner;
revoke all on function app.notification_command_v6(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker,app_media_worker,app_calendar_worker;
grant execute on function app.notification_command_v6(text,jsonb) to app_runtime;
end $migration$;
