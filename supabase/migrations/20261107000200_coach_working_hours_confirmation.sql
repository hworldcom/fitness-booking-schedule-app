-- MOV-181: explicit owner confirmation for one existing booking; no historical data update.
do $migration$ begin
create function app.typed_session_fit_checks(dataset uuid,coach uuid,type_id uuid,type_revision integer,venue_id uuid,from_time timestamptz,to_time timestamptz,ignore_booking uuid,require_working_hours boolean)
returns boolean language plpgsql set search_path='' as $$
declare t app.coach_session_types;venue app.coach_training_locations;step_time timestamptz;local_day date;
begin
 select * into t from app.coach_session_types where id=type_id and run_id=dataset and coach_profile_id=coach;
 select * into venue from app.coach_training_locations where id=venue_id and run_id=dataset and profile_id=coach and status='active' and timezone='Europe/Berlin';
 if t.id is null or venue.id is null or t.archived or (not t.bookable and not app.authorized_actor_context_valid(coach,dataset,null)) or t.format<>'private' or t.revision<>type_revision or (t.default_location_id is not null and t.default_location_id<>venue.id and not app.authorized_actor_context_valid(coach,dataset,null))
   or (extract(epoch from to_time-from_time)/60<>t.duration_minutes and not app.authorized_actor_context_valid(coach,dataset,null))
   or extract(epoch from to_time-from_time)/60 not in (60,75,90) or extract(epoch from from_time)::bigint%900<>0
   or from_time<=clock_timestamp() or (from_time at time zone venue.timezone)::date not between (clock_timestamp() at time zone venue.timezone)::date and (clock_timestamp() at time zone venue.timezone)::date+29
   or not app.group_coach_enabled(dataset,coach,true)
   or (venue.location_kind='gym' and not exists(select 1 from app.gyms g where g.run_id=dataset and g.id=venue.selected_gym_id and g.status='active'))
   then return false;end if;
 local_day:=(from_time at time zone venue.timezone)::date;
 if (to_time at time zone venue.timezone)::date<>local_day or not app.coach_local_time_is_unambiguous(from_time at time zone venue.timezone,venue.timezone) or not app.coach_local_time_is_unambiguous(to_time at time zone venue.timezone,venue.timezone) then return false;end if;
 if require_working_hours then
 for step_time in select generate_series(from_time,to_time-interval '15 minutes',interval '15 minutes') loop
   if not exists(select 1 from app.effective_coach_hours(dataset,coach,local_day) h where h.location_id=venue.id and h.hour_timezone=venue.timezone
     and step_time>=(local_day+h.local_start) at time zone venue.timezone and step_time+interval '15 minutes'<=(local_day+h.local_start+interval '1 hour') at time zone venue.timezone) then return false;end if;
 end loop;
 end if;
 if exists(select 1 from app.coach_private_bookings b where b.run_id=dataset and b.coach_profile_id=coach and b.id is distinct from ignore_booking and b.status='confirmed' and tstzrange(b.scheduled_start_at,b.scheduled_end_at,'[)')&&tstzrange(from_time,to_time,'[)'))
   or exists(select 1 from app.coach_availability_slots s where s.run_id=dataset and s.profile_id=coach and (s.status='held' or (s.status='withdrawn' and s.closure_reason='manual')) and not exists(select 1 from app.coach_private_bookings b where b.id=ignore_booking and b.slot_id=s.id) and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(from_time,to_time,'[)'))
   or app.group_time_reserved(dataset,coach,from_time,to_time) then return false;end if;
 return true;
end $$;

alter function app.typed_session_fit_checks(uuid,uuid,uuid,integer,uuid,timestamptz,timestamptz,uuid,boolean)owner to app_owner;
revoke all on function app.typed_session_fit_checks(uuid,uuid,uuid,integer,uuid,timestamptz,timestamptz,uuid,boolean)from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

create or replace function app.typed_session_fits(dataset uuid,coach uuid,type_id uuid,type_revision integer,venue_id uuid,from_time timestamptz,to_time timestamptz,ignore_booking uuid default null)
returns boolean language plpgsql set search_path='' as $$
declare acknowledged boolean:=false;
begin
 if ignore_booking is not null and app.authorized_actor_context_valid(coach,dataset,null) then
   select exists(select 1 from app.session_booking_commands c join app.coach_private_bookings b on b.id=ignore_booking
     where b.run_id=dataset and b.coach_profile_id=coach and b.status='confirmed' and b.scheduled_start_at>clock_timestamp()
       and c.run_id=dataset and c.actor_profile_id=coach
       and c.payload->>'action'='override' and c.payload->'outsideHoursConfirmed'='true'::jsonb
       and (c.payload->>'bookingId')::uuid=b.id and (c.payload->>'expectedRevision')::integer=b.schedule_revision
       and (c.payload->>'typeId')::uuid=type_id and (c.payload->>'typeRevision')::integer=type_revision
       and (c.payload->>'locationId')::uuid=venue_id and (c.payload->>'startsAt')::timestamptz=from_time
       and (c.payload->>'durationMinutes')::integer=extract(epoch from to_time-from_time)/60
       and c.result=jsonb_build_object('bookingId',b.id,'revision',b.schedule_revision+1)) into acknowledged;
 end if;
 return app.typed_session_fit_checks(dataset,coach,type_id,type_revision,venue_id,from_time,to_time,ignore_booking,not acknowledged);
end $$;

create function app.review_owned_booking_change(payload jsonb)returns jsonb
language plpgsql security definer set search_path='' set jit='off' as $$
declare flags jsonb;actor uuid;dataset uuid;b app.coach_private_bookings;t app.coach_session_types;finish timestamptz;outside boolean;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload->>'action' is distinct from 'override'
   or payload-array['action','bookingId','expectedRevision','typeId','typeRevision','locationId','startsAt','durationMinutes','outsideHoursConfirmed']<>'{}'::jsonb
   or jsonb_typeof(payload->'durationMinutes') is distinct from 'number' or (payload->>'durationMinutes')!~'^(60|75|90)$'
   then raise exception 'typed booking invalid review' using errcode='22023';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;flags:=app.availability_enter();
 select * into b from app.coach_private_bookings where id=(payload->>'bookingId')::uuid and run_id=dataset and coach_profile_id=actor and credit_projection_id is null;
 if not found then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if b.status<>'confirmed' or b.scheduled_start_at<=clock_timestamp() or b.schedule_revision is distinct from(payload->>'expectedRevision')::integer then raise exception 'typed booking stale or elapsed' using errcode='P0001';end if;
 select * into t from app.coach_session_types where id=(payload->>'typeId')::uuid and run_id=dataset and coach_profile_id=actor;
 if not found then raise exception 'typed booking forbidden' using errcode='42501';end if;
 finish:=(payload->>'startsAt')::timestamptz+make_interval(mins=>(payload->>'durationMinutes')::integer);
 if not app.typed_session_fit_checks(dataset,actor,t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,finish,b.id,false) then raise exception 'typed booking time changed' using errcode='P0001';end if;
 outside:=not app.typed_session_fit_checks(dataset,actor,t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,finish,b.id,true);
 perform app.availability_leave(flags);return jsonb_build_object('outsideWorkingHours',outside);
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.review_owned_booking_change(jsonb)owner to app_owner;
revoke all on function app.review_owned_booking_change(jsonb)from public,anon,authenticated,service_role,app_notification_worker,app_media_worker;
grant execute on function app.review_owned_booking_change(jsonb)to app_runtime;
CREATE OR REPLACE FUNCTION app.coach_session_booking(command_id uuid, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET jit TO 'off'
AS $function$
declare flags jsonb;actor uuid;dataset uuid;t app.coach_session_types;b app.coach_private_bookings;prior app.session_booking_commands;
  intent_saved boolean:=false; target_slot uuid;old_slot app.coach_availability_slots;s app.coach_availability_slots;created_id uuid;answer jsonb;athlete uuid;action text;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;action:=payload->>'action';
 if command_id is null or jsonb_typeof(payload) is distinct from 'object' or action not in ('create','override') or jsonb_typeof(payload->'durationMinutes') is distinct from 'number' or (payload->>'durationMinutes')!~'^(60|75|90)$' then raise exception 'typed booking invalid' using errcode='22023';end if;
 if payload ? 'outsideHoursConfirmed' and (action<>'override' or jsonb_typeof(payload->'outsideHoursConfirmed')<>'boolean') then raise exception 'typed booking invalid confirmation' using errcode='22023';end if;
 flags:=app.availability_enter()||jsonb_build_object('coach_connection_management',coalesce(current_setting('app.coach_connection_management',true),''));
 perform set_config('app.coach_connection_management','on',true);
 perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',actor::text),0));
 select * into prior from app.session_booking_commands c where c.run_id=dataset and c.actor_profile_id=actor and c.command_id=coach_session_booking.command_id;
 if found then if prior.payload<>payload then raise exception 'typed booking altered retry' using errcode='P0001';end if;perform app.availability_leave(flags);return prior.result;end if;
 select * into t from app.coach_session_types where id=(payload->>'typeId')::uuid and run_id=dataset and coach_profile_id=actor;
 if t.id is null then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if action='create' then
   athlete:=(payload->>'athleteId')::uuid;
   if payload ? 'externalClientId' then
     if athlete is not null or payload-array['action','externalClientId','typeId','typeRevision','locationId','startsAt','durationMinutes']<>'{}'::jsonb
       or not exists(select 1 from app.coach_external_clients e where e.id=(payload->>'externalClientId')::uuid and e.run_id=dataset and e.coach_profile_id=actor and e.linked_profile_id is null)
       then raise exception 'external client forbidden' using errcode='42501';end if;
     if (select count(*) from app.coach_private_bookings where external_client_id=(payload->>'externalClientId')::uuid)>=500 then raise exception 'external client session limit' using errcode='P0001';end if;
   elsif not exists(select 1 from app.coach_athlete_connection_pairs p join app.coach_athlete_connection_attempts a on a.pair_id=p.id where p.run_id=dataset and p.coach_profile_id=actor and p.athlete_profile_id=athlete and a.status='accepted') then raise exception 'typed booking requires connected athlete' using errcode='42501';end if;
 else
   select * into b from app.coach_private_bookings where id=(payload->>'bookingId')::uuid and run_id=dataset and coach_profile_id=actor and credit_projection_id is null for update;
   if not found then raise exception 'typed booking forbidden' using errcode='42501';end if;
   if b.status<>'confirmed' or b.scheduled_start_at<=clock_timestamp() or b.schedule_revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'typed booking stale or elapsed' using errcode='P0001';end if;
   athlete:=b.client_profile_id;select * into strict old_slot from app.coach_availability_slots where id=b.slot_id for update;
 end if;
 if action='override' then
   if payload->'outsideHoursConfirmed'='true'::jsonb then
     -- This private exact intent is visible to nested occurrence validation only
     -- within this transaction. Any later failure rolls it back with the save.
     answer:=jsonb_build_object('bookingId',b.id,'revision',b.schedule_revision+1);
     insert into app.session_booking_commands values(dataset,actor,command_id,payload,answer);
     intent_saved:=true;
   elsif app.typed_session_fit_checks(dataset,actor,t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,(payload->>'startsAt')::timestamptz+make_interval(mins=>(payload->>'durationMinutes')::integer),b.id,false)
     and not app.typed_session_fit_checks(dataset,actor,t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,(payload->>'startsAt')::timestamptz+make_interval(mins=>(payload->>'durationMinutes')::integer),b.id,true)
     then raise exception 'typed booking outside working hours' using errcode='P0001';
   end if;
 end if;
 target_slot:=app.typed_session_slot(t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,(payload->>'durationMinutes')::integer,b.id);
 select * into strict s from app.coach_availability_slots where id=target_slot;
 update app.coach_availability_slots x set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(x.policy_revision,0) where x.run_id=dataset and x.profile_id=actor and x.id<>s.id and x.status='open' and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)');
 if action='create' then
   insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,external_client_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at)
   values(gen_random_uuid(),dataset,s.id,actor,athlete,(payload->>'externalClientId')::uuid,'confirmed',s.starts_at,s.ends_at,s.starts_at,s.starts_at) returning id into created_id;
 else
   update app.coach_availability_slots set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(old_slot.policy_revision,0) where id=old_slot.id;
   update app.coach_private_bookings set slot_id=s.id,scheduled_start_at=s.starts_at,scheduled_end_at=s.ends_at,early_return_until=s.starts_at,hold_expires_at=s.starts_at,schedule_revision=schedule_revision+1 where id=b.id;
   insert into app.session_booking_changes values(b.id,b.schedule_revision+1,actor,jsonb_build_object('booking',to_jsonb(b),'occurrence',to_jsonb(old_slot)),jsonb_build_object('startsAt',s.starts_at,'endsAt',s.ends_at,'venue',s.training_location_name,'sessionType',s.session_type_snapshot,'outsideHoursConfirmed',coalesce(payload->'outsideHoursConfirmed','false'::jsonb)),clock_timestamp());
   created_id:=b.id;
 end if;
 update app.coach_availability_slots set status='booked' where id=s.id;
 perform set_config('app.coach_booking_request_management','on',true);
 update app.coach_booking_requests set status='not-selected',decided_at=clock_timestamp(),decided_by_profile_id=actor where slot_id=s.id and status='pending';
 answer:=jsonb_build_object('bookingId',created_id,'revision',case when action='create' then 0 else b.schedule_revision+1 end);
 if not intent_saved then insert into app.session_booking_commands values(dataset,actor,command_id,payload,answer);end if;
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $function$;

end $migration$;
