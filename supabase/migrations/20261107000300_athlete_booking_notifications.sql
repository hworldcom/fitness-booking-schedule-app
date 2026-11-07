-- MOV-185: new athlete bell receipts only; preserve old client/read scopes and all historical data.
do $migration$ begin
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
    -- Both get one email; lifecycle bells additionally reach the non-acting athlete.
    insert into app.booking_notification_receipts(event_id,recipient_profile_id,notify_in_app)
      values(event_id,coach,actor is distinct from coach),(event_id,athlete,event_kind in ('confirmed','cancelled','changed') and actor is distinct from athlete);
  end if;
  perform app.mail_trigger_leave(flags);return new;
exception when others then perform app.mail_trigger_leave(flags);raise;
end $function$;


-- Versions2–4 retain coach-only booking reads and read-all scopes.
create or replace function app.notification_command_v2(action text,args jsonb default '{}') returns jsonb
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
        and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.coach_profile_id=actor
        and app.booking_notification_allowed(e.id,actor);
    if found then perform app.mail_flags(false);return '{}'::jsonb;end if;
    perform app.mail_flags(false);return app.notification_command(action,args);
  end if;
  old_page:=app.notification_command(action,args);
  perform app.mail_flags(true);
  if action='read-all' then
    update app.booking_notification_receipts r set read_at=statement_timestamp() from app.booking_notification_events e
      where e.id=r.event_id and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.coach_profile_id=actor
        and r.read_at is null and e.created_at<=(args->>'throughAt')::timestamptz
        and app.booking_notification_allowed(e.id,actor);
    answer:='{}'::jsonb;
  elsif action='list' then
    select coalesce(jsonb_agg(data order by created_at desc,id desc),'[]') into booking_items from (
      select r.id,e.created_at,app.booking_notification_data(e.id,actor)||jsonb_build_object('id',r.id,
        'createdAt',e.created_at,'readAt',r.read_at) data
      from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id
      where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.coach_profile_id=actor
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
          where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.coach_profile_id=actor and r.read_at is null
            and app.booking_notification_allowed(e.id,actor)));
  end if;
  perform app.mail_flags(false);return answer;
exception when others then perform app.mail_flags(false);raise;
end $$;

-- Version5 composes prior categories with supported affected-athlete receipts.
create function app.notification_command_v5(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;old_page jsonb;booking_items jsonb;items jsonb;more boolean;answer jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object'
    or octet_length(args::text)>2048 then raise exception 'notification unavailable' using errcode='P0001';end if;
  actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
  if not app.staff_account_active(actor,dataset) then raise exception 'notification unavailable' using errcode='42501';end if;
  if action='read' then
    if args - 'id'<>'{}'::jsonb or jsonb_typeof(args->'id')<>'string' or not(args?'id') then raise exception 'notification invalid args' using errcode='P0001';end if;
    perform app.mail_flags(true);
    update app.booking_notification_receipts r set read_at=coalesce(r.read_at,statement_timestamp())
      from app.booking_notification_events e where r.id=(args->>'id')::uuid and e.id=r.event_id
        and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.athlete_profile_id=actor and e.kind in ('confirmed','cancelled','changed') and e.actor_profile_id is distinct from actor
        and app.booking_notification_allowed(e.id,actor);
    if found then perform app.mail_flags(false);return '{}'::jsonb;end if;
    perform app.mail_flags(false);return app.notification_command_v4(action,args);
  end if;
  old_page:=app.notification_command_v4(action,args);
  perform app.mail_flags(true);
  if action='read-all' then
    update app.booking_notification_receipts r set read_at=statement_timestamp() from app.booking_notification_events e
      where e.id=r.event_id and e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.athlete_profile_id=actor and e.kind in ('confirmed','cancelled','changed') and e.actor_profile_id is distinct from actor
        and r.read_at is null and e.created_at<=(args->>'throughAt')::timestamptz
        and app.booking_notification_allowed(e.id,actor);
    answer:='{}'::jsonb;
  elsif action='list' then
    select coalesce(jsonb_agg(data order by created_at desc,id desc),'[]') into booking_items from (
      select r.id,e.created_at,app.booking_notification_data(e.id,actor)||jsonb_build_object('id',r.id,
        'createdAt',e.created_at,'readAt',r.read_at) data
      from app.booking_notification_receipts r join app.booking_notification_events e on e.id=r.event_id
      where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.athlete_profile_id=actor and e.kind in ('confirmed','cancelled','changed') and e.actor_profile_id is distinct from actor
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
          where e.run_id=dataset and r.recipient_profile_id=actor and r.notify_in_app and e.athlete_profile_id=actor and e.kind in ('confirmed','cancelled','changed') and e.actor_profile_id is distinct from actor and r.read_at is null
            and app.booking_notification_allowed(e.id,actor)));
  end if;
  perform app.mail_flags(false);return answer;
exception when others then perform app.mail_flags(false);raise;
end $$;
alter function app.notification_command_v5(text,jsonb) owner to app_owner;
revoke all on function app.notification_command_v5(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker,app_media_worker;
grant execute on function app.notification_command_v5(text,jsonb) to app_runtime;
end $migration$;
