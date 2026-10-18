-- DEV0342: typed candidates are virtual until requested. Pending requests do not reserve time.
alter table app.coach_availability_slots add column session_type_id uuid references app.coach_session_types(id),add column session_type_snapshot jsonb,add column replacement_booking_id uuid references app.coach_private_bookings(id);
alter table app.coach_availability_slots add constraint typed_slot_terms check((session_type_id is null)=(session_type_snapshot is null));
alter table app.coach_private_bookings add column schedule_revision integer not null default 0 check(schedule_revision>=0);
alter table app.coach_private_bookings drop constraint coach_private_bookings_time_check;
alter table app.coach_private_bookings add constraint coach_private_bookings_time_check check(extract(epoch from scheduled_end_at-scheduled_start_at)/60 in (60,75,90) and early_return_until<=scheduled_start_at and hold_expires_at>created_at);
alter table app.coach_booking_requests drop constraint coach_booking_requests_time_check;
alter table app.coach_booking_requests add constraint coach_booking_requests_time_check check(extract(epoch from scheduled_end_at-scheduled_start_at)/60 in (60,75,90) and decision_deadline_at>created_at and decision_deadline_at<=scheduled_start_at);
-- Open typed candidates may overlap each other and legacy open inventory. Only
-- a decision reserves capacity; held/booked occurrences remain exclusive.
alter table app.coach_availability_slots drop constraint coach_availability_slots_active_time_excl;
alter table app.coach_availability_slots add constraint coach_availability_slots_active_time_excl exclude using gist(run_id with =,profile_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('held','booked') or (status='open' and session_type_id is null));
create table app.session_booking_commands (
 run_id uuid not null,actor_profile_id uuid not null,command_id uuid not null,payload jsonb not null,result jsonb not null,
 primary key(run_id,actor_profile_id,command_id),foreign key(run_id,actor_profile_id) references app.demo_run_participants(run_id,profile_id)
);
create table app.session_booking_changes (
 booking_id uuid not null references app.coach_private_bookings(id),revision integer not null,actor_profile_id uuid not null references app.profiles(id),previous_terms jsonb not null,new_terms jsonb not null,changed_at timestamptz not null default clock_timestamp(),primary key(booking_id,revision)
);
do $$ declare relation text;begin foreach relation in array array['session_booking_commands','session_booking_changes'] loop
 execute format('alter table app.%I owner to app_owner',relation);execute format('alter table app.%I enable row level security',relation);execute format('alter table app.%I force row level security',relation);
 execute format('revoke all on app.%I from public,anon,authenticated,app_runtime',relation);
 execute format('create policy internal on app.%I to app_owner using(true) with check(true)',relation);
end loop;end $$;

-- Called inside the existing coach schedule lock and availability flags. No new
-- authorizing GUC: only security-definer entry functions receive execute grants.
create function app.typed_session_fits(dataset uuid,coach uuid,type_id uuid,type_revision integer,venue_id uuid,from_time timestamptz,to_time timestamptz,ignore_booking uuid default null)
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
 for step_time in select generate_series(from_time,to_time-interval '15 minutes',interval '15 minutes') loop
   if not exists(select 1 from app.effective_coach_hours(dataset,coach,local_day) h where h.location_id=venue.id and h.hour_timezone=venue.timezone
     and step_time>=(local_day+h.local_start) at time zone venue.timezone and step_time+interval '15 minutes'<=(local_day+h.local_start+interval '1 hour') at time zone venue.timezone) then return false;end if;
 end loop;
 if exists(select 1 from app.coach_private_bookings b where b.run_id=dataset and b.coach_profile_id=coach and b.id is distinct from ignore_booking and b.status='confirmed' and tstzrange(b.scheduled_start_at,b.scheduled_end_at,'[)')&&tstzrange(from_time,to_time,'[)'))
   or exists(select 1 from app.coach_availability_slots s where s.run_id=dataset and s.profile_id=coach and (s.status='held' or (s.status='withdrawn' and s.closure_reason='manual')) and not exists(select 1 from app.coach_private_bookings b where b.id=ignore_booking and b.slot_id=s.id) and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(from_time,to_time,'[)'))
   or app.group_time_reserved(dataset,coach,from_time,to_time) then return false;end if;
 return true;
end $$;

create function app.typed_session_slot(type_id uuid,type_revision integer,venue_id uuid,from_time timestamptz,duration integer default null,ignore_booking uuid default null) returns uuid
language plpgsql set search_path='' as $$
declare t app.coach_session_types;v record;slot_id uuid;to_time timestamptz;
begin
 select * into strict t from app.coach_session_types where id=type_id;
 select l.*,g.name gym_name into strict v from app.coach_training_locations l left join app.gyms g on g.run_id=l.run_id and g.id=l.selected_gym_id where l.id=venue_id;
 to_time:=from_time+make_interval(mins=>coalesce(duration,t.duration_minutes));
 if not app.typed_session_fits(t.run_id,t.coach_profile_id,t.id,type_revision,v.id,from_time,to_time,ignore_booking) then raise exception 'typed booking time changed' using errcode='P0001';end if;
 select s.id into slot_id from app.coach_availability_slots s where s.run_id=t.run_id and s.profile_id=t.coach_profile_id and s.session_type_id=t.id and s.session_type_snapshot->>'revision'=type_revision::text and s.coach_training_location_id=v.id and s.starts_at=from_time and s.ends_at=to_time and s.status='open' order by s.id limit 1;
 if slot_id is not null then return slot_id;end if;
 insert into app.coach_availability_slots(run_id,profile_id,starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,location_source,location_provider,location_confirmed_at,coach_training_location_id,training_location_name,policy_revision,session_type_id,session_type_snapshot,replacement_booking_id)
 values(t.run_id,t.coach_profile_id,from_time,to_time,v.timezone,'open',v.location_kind,v.selected_gym_id,v.gym_name,v.public_location_label,v.latitude,v.longitude,v.location_source,v.location_provider,v.location_confirmed_at,v.id,v.public_name,0,t.id,app.session_type_json(t)||jsonb_build_object('durationMinutes',coalesce(duration,t.duration_minutes)),ignore_booking) returning id into slot_id;
 return slot_id;
end $$;

create function app.public_session_type_times(slug text,type_id uuid,venue_id uuid,local_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare flags jsonb;t app.coach_session_types;at_time timestamptz;candidate jsonb;answer jsonb:='[]';
begin
 if local_date is null or local_date not between (clock_timestamp() at time zone 'Europe/Berlin')::date and (clock_timestamp() at time zone 'Europe/Berlin')::date+29 then raise exception 'typed booking invalid date' using errcode='22023';end if;
 flags:=app.availability_enter();
 select s.* into t from app.coach_session_types s join app.coach_profiles c on c.run_id=s.run_id and c.profile_id=s.coach_profile_id where c.public_slug=slug and s.id=type_id and app.coach_website_is_public(c.run_id,c.profile_id);
 if t.id is null then perform app.availability_leave(flags);return answer;end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(t.run_id::text,':',t.coach_profile_id::text),0));
 for at_time in select generate_series(local_date::timestamp at time zone 'Europe/Berlin',(local_date+time '23:00') at time zone 'Europe/Berlin',interval '15 minutes') loop
   if app.typed_session_fits(t.run_id,t.coach_profile_id,t.id,t.revision,venue_id,at_time,at_time+make_interval(mins=>t.duration_minutes)) then
     candidate:=jsonb_build_object('startsAt',at_time,'endsAt',at_time+make_interval(mins=>t.duration_minutes));answer:=answer||jsonb_build_array(candidate);
   end if;
 end loop;
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;

create function app.request_session_type(command_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare flags jsonb;actor uuid;dataset uuid;t app.coach_session_types;prior app.session_booking_commands;slot_id uuid;r record;answer jsonb;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
 if command_id is null or jsonb_typeof(payload) is distinct from 'object' or (payload-array['typeId','typeRevision','locationId','startsAt'])<>'{}'::jsonb then raise exception 'typed booking invalid' using errcode='22023';end if;
 flags:=app.availability_enter();
 select * into t from app.coach_session_types where id=(payload->>'typeId')::uuid and run_id=dataset and coach_profile_id<>actor;
 if t.id is null then raise exception 'typed booking forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',t.coach_profile_id::text),0));
 select * into prior from app.session_booking_commands c where c.run_id=dataset and c.actor_profile_id=actor and c.command_id=request_session_type.command_id;
 if found then if prior.payload<>payload then raise exception 'typed booking altered retry' using errcode='P0001';end if;perform app.availability_leave(flags);return prior.result;end if;
 slot_id:=app.typed_session_slot(t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz);
 select * into strict r from app.create_coach_booking_request_before_effective(slot_id);
 answer:=jsonb_build_object('requestId',r.request_id,'requestStatus',r.request_status,'bookingId',r.booking_id);
 insert into app.session_booking_commands values(dataset,actor,command_id,payload,answer);
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;

create or replace function app.availability_in_horizon(starts timestamptz, ends timestamptz, at_time timestamptz)
returns boolean language sql stable set search_path='' as $$
  select coalesce(starts > at_time and extract(epoch from ends-starts)/60 in (60,75,90)
    and (starts at time zone 'Europe/Berlin')::date between (at_time at time zone 'Europe/Berlin')::date and (at_time at time zone 'Europe/Berlin')::date + 29
    ,false)
$$;
create or replace function app.availability_slot_matches_policy(slot app.coach_availability_slots)
returns boolean language sql volatile set search_path='' as $$
  select case when slot.session_type_id is not null then app.typed_session_fits(slot.run_id,slot.profile_id,slot.session_type_id,(slot.session_type_snapshot->>'revision')::integer,slot.coach_training_location_id,slot.starts_at,slot.ends_at) else (slot.ends_at-slot.starts_at=interval '1 hour') and exists (
    select 1 from app.coach_training_locations l
    where l.run_id=slot.run_id and l.profile_id=slot.profile_id and l.id=slot.coach_training_location_id
      and l.status='active' and l.location_confirmed_at is not null and l.timezone=slot.coach_timezone
      and (l.location_kind<>'gym' or exists(select 1 from app.gyms g where g.run_id=l.run_id and g.id=l.selected_gym_id and g.status='active'))
  ) and (
    exists(select 1 from app.effective_coach_hours(slot.run_id,slot.profile_id,(slot.starts_at at time zone slot.coach_timezone)::date) h
      where h.location_id=slot.coach_training_location_id and h.local_start=(slot.starts_at at time zone slot.coach_timezone)::time and h.hour_timezone=slot.coach_timezone)
    -- Legacy individually created hours remain compatible unless a whole-date
    -- override applies. They do not become reusable weekly templates.
    or (slot.policy_revision is null and slot.recurrence_rule_id is null and not exists (
      select 1 from app.coach_availability_date_overrides d where d.run_id=slot.run_id and d.profile_id=slot.profile_id
        and d.local_date=(slot.starts_at at time zone 'Europe/Berlin')::date and d.mode<>'weekly'
    ))
  ) end
$$;
create or replace function app.guard_effective_availability_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; administrator boolean; begin
  flags:=app.availability_enter();
  if new.session_type_id is not null then
    if tg_op='UPDATE' and (to_jsonb(new)-array['status','updated_at','closure_reason','closed_policy_revision']) is distinct from (to_jsonb(old)-array['status','updated_at','closure_reason','closed_policy_revision']) then raise exception 'typed booking occurrence immutable' using errcode='P0001';end if;
    if tg_op='UPDATE' and old.status='withdrawn' and new.status<>'withdrawn' then raise exception 'typed booking occurrence terminal' using errcode='P0001';end if;
    if tg_op='INSERT' and new.replacement_booking_id is not null and not exists(select 1 from app.coach_private_bookings b where b.id=new.replacement_booking_id and b.run_id=new.run_id and b.coach_profile_id=new.profile_id and b.coach_profile_id=current_setting('app.current_profile_id',true)::uuid and app.authorized_actor_context_valid(b.coach_profile_id,b.run_id,null) and b.status='confirmed' and b.scheduled_start_at>clock_timestamp()) then raise exception 'typed booking override forbidden' using errcode='42501';end if;
    if tg_op='INSERT' and (new.session_type_snapshot->>'format'<>'private' or not app.typed_session_fits(new.run_id,new.profile_id,new.session_type_id,(new.session_type_snapshot->>'revision')::integer,new.coach_training_location_id,new.starts_at,new.ends_at,new.replacement_booking_id)) then raise exception 'typed booking occurrence invalid' using errcode='P0001';end if;
    if new.status='withdrawn' then new.closure_reason:=coalesce(new.closure_reason,'manual');if new.closure_reason='policy' then new.closed_policy_revision:=coalesce(new.closed_policy_revision,0);end if;else new.closure_reason:=null;new.closed_policy_revision:=null;end if;
    perform app.availability_leave(flags);return new;
  end if;
  select (rolsuper or (rolcreatedb and rolcreaterole and rolbypassrls)) and current_setting('role',true)<>'app_runtime'
    into administrator from pg_roles where rolname=session_user;
  if new.policy_revision is null and new.recurrence_rule_id is null and (
    (tg_op='INSERT' and new.coach_training_location_id is null) or (tg_op='UPDATE' and
      (new.location_kind,new.selected_gym_id,new.public_location_label,new.latitude,new.longitude) is distinct from
      (old.location_kind,old.selected_gym_id,old.public_location_label,old.latitude,old.longitude))) then
    select l.id,l.public_name into new.coach_training_location_id,new.training_location_name
      from app.coach_training_locations l where l.run_id=new.run_id and l.profile_id=new.profile_id and l.status='active'
        and l.location_kind=new.location_kind and l.selected_gym_id is not distinct from new.selected_gym_id
        and l.latitude=new.latitude and l.longitude=new.longitude and l.public_location_label=new.public_location_label
      order by l.is_primary desc,l.id limit 1;
  end if;
  if tg_op='UPDATE' and old.status='withdrawn' and new.status<>'withdrawn' then
    raise exception 'coach availability withdrawn history is terminal' using errcode='P0001';
  end if;
  if tg_op='UPDATE' and (old.policy_revision is not null or old.recurrence_rule_id is not null) and
    (to_jsonb(new)-array['status','updated_at','closure_reason','closed_policy_revision']) is distinct from
    (to_jsonb(old)-array['status','updated_at','closure_reason','closed_policy_revision']) then
    raise exception 'coach availability effective occurrence is immutable' using errcode='P0001';
  end if;
  if new.status='withdrawn' then
    if tg_op='INSERT' or old.status<>'withdrawn' then
      new.closure_reason:=coalesce(new.closure_reason,case when (new.recurrence_rule_id is not null and exists(
        select 1 from app.coach_availability_rules r where r.id=new.recurrence_rule_id and r.status='removed'
      )) or exists(select 1 from app.coach_training_locations l where l.id=new.coach_training_location_id and l.status='inactive') then 'policy' else 'manual' end);
      if new.closure_reason='policy' then new.closed_policy_revision:=coalesce(new.closed_policy_revision,old.policy_revision,0); end if;
    end if;
  elsif not administrator and (tg_op='INSERT' or
    (old.status,old.starts_at,old.ends_at,old.coach_training_location_id) is distinct from
    (new.status,new.starts_at,new.ends_at,new.coach_training_location_id)) then
    if not app.availability_in_horizon(new.starts_at,new.ends_at,clock_timestamp())
      or not app.availability_slot_matches_policy(new)
      or not app.group_coach_enabled(new.run_id,new.profile_id,true) then
      raise exception 'coach availability is outside effective hours' using errcode='P0001';
    end if;
    if (tg_op='INSERT' or (old.starts_at,old.ends_at) is distinct from (new.starts_at,new.ends_at)) and exists(
      select 1 from app.coach_availability_slots closed where closed.run_id=new.run_id and closed.profile_id=new.profile_id
        and closed.status='withdrawn' and tstzrange(closed.starts_at,closed.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
        and (closed.closure_reason is distinct from 'policy' or coalesce(closed.closed_policy_revision,0)>=coalesce(new.policy_revision,0))
    ) then raise exception 'coach availability closed history requires an eligible policy successor' using errcode='P0001'; end if;
  end if;
  perform app.availability_leave(flags); return new;
exception when others then perform app.availability_leave(flags); raise;
end $$;
create or replace function app.synchronize_coach_availability_occurrences(requested_run_id uuid, requested_profile_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare flags jsonb; current_time_value timestamptz; first_date date; day_value date; hour_value record; venue record;
  local_value timestamp; from_time timestamptz; to_time timestamptz; inserted integer:=0; changed integer;
begin
  -- Entry callers have no row locks; trigger callers already hold the same
  -- guard. Preserve the existing blocking entry lock and nonblocking write
  -- guards, so parallel requests queue without inverting M8 pair locks.
  perform pg_advisory_xact_lock(hashtextextended(concat(requested_run_id::text,':',requested_profile_id::text),0));
  flags:=app.availability_enter();
  current_time_value:=clock_timestamp(); first_date:=(current_time_value at time zone 'Europe/Berlin')::date;
  -- Keep reservations and frozen snapshots; close only future open capacity.
  update app.coach_availability_slots s set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(s.policy_revision,0)
    where s.run_id=requested_run_id and s.profile_id=requested_profile_id and s.status='open' and s.session_type_id is null and s.starts_at>current_time_value
      and (not app.availability_slot_matches_policy(s) or not app.group_coach_enabled(requested_run_id,requested_profile_id,true));
  -- Typed candidates are not generated as one-hour inventory. Close only
  -- invalid open candidates so pending request history resolves atomically.
  update app.coach_availability_slots s set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(s.policy_revision,0)
    where s.run_id=requested_run_id and s.profile_id=requested_profile_id and s.session_type_id is not null and s.status='open' and s.starts_at>current_time_value
      and not app.availability_slot_matches_policy(s);
  if not app.group_coach_enabled(requested_run_id,requested_profile_id,true) then
    perform app.availability_leave(flags); return 0;
  end if;
  for day_value in select first_date+n from generate_series(-1,30) n loop
    for hour_value in select * from app.effective_coach_hours(requested_run_id,requested_profile_id,day_value) order by local_start loop
      local_value:=day_value+hour_value.local_start;
      if not app.coach_local_time_is_unambiguous(local_value,hour_value.hour_timezone)
        or not app.coach_local_time_is_unambiguous(local_value+interval '1 hour',hour_value.hour_timezone) then continue; end if;
      from_time:=local_value at time zone hour_value.hour_timezone; to_time:=(local_value+interval '1 hour') at time zone hour_value.hour_timezone;
      if not app.availability_in_horizon(from_time,to_time,clock_timestamp()) then continue; end if;
      select l.*,g.name gym_name into venue from app.coach_training_locations l left join app.gyms g
        on g.run_id=l.run_id and g.id=l.selected_gym_id and g.status='active'
        where l.run_id=requested_run_id and l.profile_id=requested_profile_id and l.id=hour_value.location_id
          and l.status='active' and l.location_confirmed_at is not null and l.timezone=hour_value.hour_timezone;
      if not found or (venue.location_kind='gym' and venue.gym_name is null) then continue; end if;
      if app.group_time_reserved(requested_run_id,requested_profile_id,from_time,to_time) then continue; end if;
      if exists(select 1 from app.coach_availability_slots s where s.run_id=requested_run_id and s.profile_id=requested_profile_id
        and (s.status in ('held','booked') or (s.status='open' and s.session_type_id is null)) and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(from_time,to_time,'[)')) then continue; end if;
      if exists(select 1 from app.coach_availability_slots s where s.run_id=requested_run_id and s.profile_id=requested_profile_id
        and s.status='withdrawn' and s.session_type_id is null and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(from_time,to_time,'[)')
        and (s.closure_reason is distinct from 'policy' or coalesce(s.closed_policy_revision,0)>=hour_value.policy_version)) then continue; end if;
      insert into app.coach_availability_slots(run_id,profile_id,coach_training_location_id,training_location_name,
        starts_at,ends_at,coach_timezone,status,location_kind,selected_gym_id,gym_name,public_location_label,latitude,longitude,
        location_source,location_provider,location_confirmed_at,recurrence_rule_id,recurrence_local_date,policy_revision)
      values(requested_run_id,requested_profile_id,venue.id,venue.public_name,from_time,to_time,hour_value.hour_timezone,'open',
        venue.location_kind,venue.selected_gym_id,venue.gym_name,venue.public_location_label,venue.latitude,venue.longitude,
        venue.location_source,venue.location_provider,venue.location_confirmed_at,hour_value.rule_id,
        case when hour_value.rule_id is not null then day_value end,hour_value.policy_version);
      get diagnostics changed=row_count; inserted:=inserted+changed;
    end loop;
  end loop;
  perform app.availability_leave(flags); return inserted;
exception when others then perform app.availability_leave(flags); raise;
end $$;

create or replace function app.accept_coach_booking_request(requested_request_id uuid)
returns table(request_id uuid,request_status text,booking_id uuid) language plpgsql security definer set search_path='' as $$
declare flags jsonb;r app.coach_booking_requests;s app.coach_availability_slots;begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 flags:=app.availability_enter();
 select * into r from app.coach_booking_requests where id=requested_request_id and run_id=current_setting('app.current_run_id')::uuid and coach_profile_id=current_setting('app.current_profile_id')::uuid;
 select * into s from app.coach_availability_slots where id=r.slot_id;
 if s.session_type_id is null then
   perform app.availability_leave(flags);perform app.reconcile_actor_availability_target(requested_request_id,true);return query select * from app.accept_coach_booking_request_before_effective(requested_request_id);return;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(r.run_id::text,':',r.coach_profile_id::text),0));
 select * into r from app.coach_booking_requests where id=requested_request_id for update;
 if r.status='pending' and r.decision_deadline_at>clock_timestamp() then
   if not app.typed_session_fits(s.run_id,s.profile_id,s.session_type_id,(s.session_type_snapshot->>'revision')::integer,s.coach_training_location_id,s.starts_at,s.ends_at) then raise exception 'typed booking time changed' using errcode='P0001';end if;
   update app.coach_availability_slots x set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(x.policy_revision,0) where x.run_id=s.run_id and x.profile_id=s.profile_id and x.id<>s.id and x.status='open' and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)');
 end if;
 return query select * from app.accept_coach_booking_request_before_effective(requested_request_id);
 perform app.availability_leave(flags);
exception when others then perform app.availability_leave(flags);raise;end $$;

do $$ declare p record;begin for p in select oid::regprocedure signature from pg_proc where pronamespace='app'::regnamespace and proname in ('typed_session_fits','typed_session_slot','public_session_type_times','request_session_type','accept_coach_booking_request') loop
 execute format('alter function %s owner to app_owner',p.signature);execute format('revoke all on function %s from public,anon,authenticated,app_runtime',p.signature);end loop;end $$;
grant execute on function app.public_session_type_times(text,uuid,uuid,date),app.request_session_type(uuid,jsonb),app.accept_coach_booking_request(uuid) to app_runtime;

-- Coach commands retain the booking identity and record previous reviewed terms.
create function app.coach_session_booking(command_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare flags jsonb;actor uuid;dataset uuid;t app.coach_session_types;b app.coach_private_bookings;prior app.session_booking_commands;
  target_slot uuid;old_slot app.coach_availability_slots;s app.coach_availability_slots;created_id uuid;answer jsonb;athlete uuid;action text;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;action:=payload->>'action';
 if command_id is null or jsonb_typeof(payload) is distinct from 'object' or action not in ('create','override') or jsonb_typeof(payload->'durationMinutes') is distinct from 'number' or (payload->>'durationMinutes')!~'^(60|75|90)$' then raise exception 'typed booking invalid' using errcode='22023';end if;
 flags:=app.availability_enter()||jsonb_build_object('coach_connection_management',coalesce(current_setting('app.coach_connection_management',true),''));
 perform set_config('app.coach_connection_management','on',true);
 perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',actor::text),0));
 select * into prior from app.session_booking_commands c where c.run_id=dataset and c.actor_profile_id=actor and c.command_id=coach_session_booking.command_id;
 if found then if prior.payload<>payload then raise exception 'typed booking altered retry' using errcode='P0001';end if;perform app.availability_leave(flags);return prior.result;end if;
 select * into t from app.coach_session_types where id=(payload->>'typeId')::uuid and run_id=dataset and coach_profile_id=actor;
 if t.id is null then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if action='create' then
   athlete:=(payload->>'athleteId')::uuid;
   if not exists(select 1 from app.coach_athlete_connection_pairs p join app.coach_athlete_connection_attempts a on a.pair_id=p.id where p.run_id=dataset and p.coach_profile_id=actor and p.athlete_profile_id=athlete and a.status='accepted') then raise exception 'typed booking requires connected athlete' using errcode='42501';end if;
 else
   select * into b from app.coach_private_bookings where id=(payload->>'bookingId')::uuid and run_id=dataset and coach_profile_id=actor and credit_projection_id is null for update;
   if not found then raise exception 'typed booking forbidden' using errcode='42501';end if;
   if b.status<>'confirmed' or b.scheduled_start_at<=clock_timestamp() or b.schedule_revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'typed booking stale or elapsed' using errcode='P0001';end if;
   athlete:=b.client_profile_id;select * into strict old_slot from app.coach_availability_slots where id=b.slot_id for update;
 end if;
 target_slot:=app.typed_session_slot(t.id,(payload->>'typeRevision')::integer,(payload->>'locationId')::uuid,(payload->>'startsAt')::timestamptz,(payload->>'durationMinutes')::integer,b.id);
 select * into strict s from app.coach_availability_slots where id=target_slot;
 update app.coach_availability_slots x set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(x.policy_revision,0) where x.run_id=dataset and x.profile_id=actor and x.id<>s.id and x.status='open' and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)');
 if action='create' then
   insert into app.coach_private_bookings(id,run_id,slot_id,coach_profile_id,client_profile_id,status,scheduled_start_at,scheduled_end_at,early_return_until,hold_expires_at)
   values(gen_random_uuid(),dataset,s.id,actor,athlete,'confirmed',s.starts_at,s.ends_at,s.starts_at,s.starts_at) returning id into created_id;
 else
   update app.coach_availability_slots set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(old_slot.policy_revision,0) where id=old_slot.id;
   update app.coach_private_bookings set slot_id=s.id,scheduled_start_at=s.starts_at,scheduled_end_at=s.ends_at,early_return_until=s.starts_at,hold_expires_at=s.starts_at,schedule_revision=schedule_revision+1 where id=b.id;
   insert into app.session_booking_changes values(b.id,b.schedule_revision+1,actor,jsonb_build_object('booking',to_jsonb(b),'occurrence',to_jsonb(old_slot)),jsonb_build_object('startsAt',s.starts_at,'endsAt',s.ends_at,'venue',s.training_location_name,'sessionType',s.session_type_snapshot),clock_timestamp());
   created_id:=b.id;
 end if;
 update app.coach_availability_slots set status='booked' where id=s.id;
 perform set_config('app.coach_booking_request_management','on',true);
 update app.coach_booking_requests set status='not-selected',decided_at=clock_timestamp(),decided_by_profile_id=actor where slot_id=s.id and status='pending';
 answer:=jsonb_build_object('bookingId',created_id,'revision',case when action='create' then 0 else b.schedule_revision+1 end);
 insert into app.session_booking_commands values(dataset,actor,command_id,payload,answer);
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.coach_session_booking(uuid,jsonb) owner to app_owner;
revoke all on function app.coach_session_booking(uuid,jsonb) from public,anon,authenticated;
grant execute on function app.coach_session_booking(uuid,jsonb) to app_runtime;

create function app.session_booking_detail(booking_id uuid,before_revision integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare flags jsonb;b app.coach_private_bookings;s app.coach_availability_slots;answer jsonb;begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'typed booking forbidden' using errcode='42501';end if;
 if before_revision is not null and before_revision<1 then raise exception 'typed booking invalid history cursor' using errcode='22023';end if;
 flags:=app.availability_enter();
 select * into b from app.coach_private_bookings x where x.id=booking_id and x.run_id=current_setting('app.current_run_id')::uuid and current_setting('app.current_profile_id')::uuid in (x.coach_profile_id,x.client_profile_id) and x.credit_projection_id is null;
 if b.id is null then raise exception 'typed booking forbidden' using errcode='42501';end if;
 select * into strict s from app.coach_availability_slots where id=b.slot_id;
 answer:=jsonb_build_object('bookingId',b.id,'revision',b.schedule_revision,'status',b.status,'startsAt',b.scheduled_start_at,'endsAt',b.scheduled_end_at,'locationId',s.coach_training_location_id,'venueName',s.training_location_name,'sessionType',s.session_type_snapshot,'athleteId',b.client_profile_id,'viewerIsCoach',b.coach_profile_id=current_setting('app.current_profile_id')::uuid,
 'changes',coalesce((select jsonb_agg(jsonb_build_object('revision',c.revision,'changedAt',c.changed_at,'previousStart',c.previous_terms->'booking'->'scheduled_start_at','previousEnd',c.previous_terms->'booking'->'scheduled_end_at','previousVenue',c.previous_terms->'occurrence'->'training_location_name','newTerms',c.new_terms) order by c.revision desc) from (select * from app.session_booking_changes x where x.booking_id=b.id and (before_revision is null or x.revision<before_revision) order by x.revision desc limit 20) c),'[]'::jsonb),
 'historyTotal',(select count(*) from app.session_booking_changes x where x.booking_id=b.id),
 'nextHistoryRevision',case when (select count(*) from (select 1 from app.session_booking_changes x where x.booking_id=b.id and (before_revision is null or x.revision<before_revision) order by x.revision desc limit 21) h)>20 then (select x.revision from app.session_booking_changes x where x.booking_id=b.id and (before_revision is null or x.revision<before_revision) order by x.revision desc offset 19 limit 1) else null end);
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.session_booking_detail(uuid,integer) owner to app_owner;
revoke all on function app.session_booking_detail(uuid,integer) from public,anon,authenticated;
grant execute on function app.session_booking_detail(uuid,integer) to app_runtime;

create function app.public_session_type_catalog(slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',exists(select 1 from app.coach_session_types t where t.run_id=c.run_id and t.coach_profile_id=c.profile_id),
 'types',app.public_coach_session_types(c.public_slug),
 'locations',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.public_name,'label',l.public_location_label) order by l.sort_order,l.id) from app.coach_training_locations l where l.run_id=c.run_id and l.profile_id=c.profile_id and l.status='active' and (l.location_kind<>'gym' or exists(select 1 from app.gyms g where g.run_id=l.run_id and g.id=l.selected_gym_id and g.status='active'))),'[]'::jsonb))
 from app.coach_profiles c where c.public_slug=slug and app.coach_website_is_public(c.run_id,c.profile_id)
$$;
alter function app.public_session_type_catalog(text) owner to postgres;
revoke all on function app.public_session_type_catalog(text) from public,anon,authenticated;
grant execute on function app.public_session_type_catalog(text) to app_runtime;

create function app.current_training_session_type(source text,source_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare flags jsonb;actor uuid;dataset uuid;answer jsonb;begin
 if not app.authorized_actor_context_valid(null,null,null) then return null;end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;flags:=app.availability_enter();
 if source='booking' then select s.session_type_snapshot into answer from app.coach_private_bookings b join app.coach_availability_slots s on s.id=b.slot_id where b.id=source_id and b.run_id=dataset and actor in (b.coach_profile_id,b.client_profile_id);
 elsif source='request' then select s.session_type_snapshot into answer from app.coach_booking_requests r join app.coach_availability_slots s on s.id=r.slot_id where r.id=source_id and r.run_id=dataset and actor in (r.coach_profile_id,r.client_profile_id);end if;
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.current_training_session_type(text,uuid) owner to app_owner;
revoke all on function app.current_training_session_type(text,uuid) from public,anon,authenticated;
grant execute on function app.current_training_session_type(text,uuid) to app_runtime;

-- Keep repeated bounded candidate checks from compiling a new JIT plan per start.
alter function app.public_session_type_times(text,uuid,uuid,date) set jit=off;
alter function app.request_session_type(uuid,jsonb) set jit=off;
alter function app.coach_session_booking(uuid,jsonb) set jit=off;

-- Editing/removing an offering closes only unreserved attempts at its prior
-- revision; accepted bookings and their reviewed terms are never rewritten.
create function app.close_session_type_candidates() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb;begin
 flags:=app.availability_enter();
 update app.coach_availability_slots set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(policy_revision,0) where session_type_id=new.id and run_id=new.run_id and profile_id=new.coach_profile_id and status='open';
 perform app.availability_leave(flags);return new;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.close_session_type_candidates() owner to app_owner;
revoke all on function app.close_session_type_candidates() from public,anon,authenticated,app_runtime;
create trigger session_type_closes_unreserved after update on app.coach_session_types for each row when(old.revision is distinct from new.revision) execute function app.close_session_type_candidates();
