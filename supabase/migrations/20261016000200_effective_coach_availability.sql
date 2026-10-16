-- DEV0252: versioned effective hours; dated occurrences remain immutable history.
create table app.coach_availability_policies (
  run_id uuid not null,
  profile_id uuid not null,
  revision integer not null default 0 check (revision >= 0),
  weekly_revision integer not null default 0 check (weekly_revision >= 0),
  batch_transaction xid8,
  primary key (run_id,profile_id),
  foreign key (run_id,profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade
);
create table app.coach_availability_date_overrides (
  run_id uuid not null,
  profile_id uuid not null,
  local_date date not null,
  mode text not null check (mode in ('custom','unavailable','weekly')),
  hours jsonb not null check (jsonb_typeof(hours) = 'array' and jsonb_array_length(hours) <= 23),
  revision integer not null check (revision > 0),
  primary key (run_id,profile_id,local_date),
  foreign key (run_id,profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade,
  check ((mode = 'custom' and jsonb_array_length(hours) > 0) or (mode <> 'custom' and hours = '[]'::jsonb))
);
-- A weekly tombstone retains the revision of an explicit override removal.
create table app.coach_availability_operations (
  run_id uuid not null,
  profile_id uuid not null,
  operation_id uuid not null,
  input jsonb not null,
  result jsonb not null,
  primary key (run_id,profile_id,operation_id),
  foreign key (run_id,profile_id) references app.coach_profiles(run_id,profile_id) on delete cascade
);
do $$ declare relation text; begin
  foreach relation in array array['coach_availability_policies','coach_availability_date_overrides','coach_availability_operations'] loop
    execute format('alter table app.%I owner to app_owner',relation);
    execute format('alter table app.%I enable row level security',relation);
    execute format('alter table app.%I force row level security',relation);
    execute format('revoke all on app.%I from public,anon,authenticated,service_role,app_runtime',relation);
    execute format('create policy effective_management on app.%I for all to app_owner using (current_setting(''app.effective_availability_management'',true) = ''on'') with check (current_setting(''app.effective_availability_management'',true) = ''on'')',relation);
    execute format('create trigger aaa_group_schedule_write before insert or update or delete on app.%I for each row execute function app.guard_coach_schedule_write()',relation);
  end loop;
end $$;

create function app.availability_policy_projection(dataset uuid, coach uuid, from_date date, through_date date)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('revision',coalesce((select revision from app.coach_availability_policies where run_id=dataset and profile_id=coach),0),
    'weeklyHours',coalesce((select jsonb_agg(jsonb_build_object('isoWeekday',r.iso_weekday,'localStartTime',to_char(r.local_start_time,'HH24:MI'),
      'locationId',r.coach_training_location_id,'locationUpdatedAt',to_jsonb(l.updated_at)#>>'{}') order by r.iso_weekday,r.local_start_time)
      from app.coach_availability_rules r join app.coach_training_locations l on l.run_id=r.run_id and l.profile_id=r.profile_id and l.id=r.coach_training_location_id
      where r.run_id=dataset and r.profile_id=coach and r.status='active'),'[]'::jsonb),
    'dates',coalesce((select jsonb_agg(jsonb_build_object('date',d.local_date,'mode',d.mode,'hours',d.hours) order by d.local_date)
      from app.coach_availability_date_overrides d where d.run_id=dataset and d.profile_id=coach and d.local_date between from_date and through_date and d.mode<>'weekly'),'[]'::jsonb))
$$;

create function app.owned_effective_coach_availability(from_date date,through_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare flags jsonb; dataset uuid; coach uuid; result jsonb; begin
  if not app.authorized_actor_context_valid(null,null,null) or from_date is null or through_date is null or through_date<from_date or through_date-from_date>30 then
    raise exception 'coach availability date range is invalid' using errcode='P0001'; end if;
  dataset:=current_setting('app.current_run_id',true)::uuid; coach:=current_setting('app.current_profile_id',true)::uuid;
  flags:=app.availability_enter();
  if not exists(select 1 from app.coach_profiles where run_id=dataset and profile_id=coach) then
    raise exception 'coach availability owner is unavailable' using errcode='P0001'; end if;
  result:=app.availability_policy_projection(dataset,coach,from_date,through_date);
  perform app.availability_leave(flags); return result;
exception when others then perform app.availability_leave(flags); raise;
end $$;

create function app.availability_validate_hours(dataset uuid, coach uuid, hours jsonb, weekly boolean, for_date date default null)
returns void language plpgsql set search_path='' as $$
declare h jsonb; l app.coach_training_locations; day_value date; local_value timestamp; begin
  if jsonb_typeof(hours) is distinct from 'array' or jsonb_array_length(hours)>(case when weekly then 161 else 23 end) then
    raise exception 'coach availability hours are invalid' using errcode='P0001'; end if;
  for h in select * from jsonb_array_elements(hours) loop
    if jsonb_typeof(h) is distinct from 'object' or (h-array['isoWeekday','localStartTime','locationId','locationUpdatedAt'])<>'{}'::jsonb
      or jsonb_typeof(h->'locationId') is distinct from 'string' or jsonb_typeof(h->'locationUpdatedAt') is distinct from 'string'
      or jsonb_typeof(h->'localStartTime') is distinct from 'string' or (h->>'localStartTime')!~'^([01][0-9]|2[0-2]):00$'
      or (weekly and (jsonb_typeof(h->'isoWeekday') is distinct from 'number' or (h->>'isoWeekday')!~'^[1-7]$'))
      or (not weekly and h ? 'isoWeekday') then raise exception 'coach availability hour is invalid' using errcode='P0001'; end if;
    select * into l from app.coach_training_locations where run_id=dataset and profile_id=coach and id=(h->>'locationId')::uuid
      and status='active' and timezone='Europe/Berlin' and location_confirmed_at is not null
      and to_jsonb(updated_at)#>>'{}'=h->>'locationUpdatedAt';
    if not found or (l.location_kind='gym' and not exists(select 1 from app.gyms g where g.run_id=dataset and g.id=l.selected_gym_id and g.status='active')) then
      raise exception 'coach availability venue changed' using errcode='P0001'; end if;
    for day_value in select coalesce(for_date,(clock_timestamp() at time zone 'Europe/Berlin')::date)+n
      from generate_series(0,case when weekly then 29 else 0 end) n loop
      if not weekly or extract(isodow from day_value)::integer=(h->>'isoWeekday')::integer then
        local_value:=day_value+(h->>'localStartTime')::time;
        if not app.coach_local_time_is_unambiguous(local_value,'Europe/Berlin') or not app.coach_local_time_is_unambiguous(local_value+interval '1 hour','Europe/Berlin') then
          raise exception 'coach availability daylight saving hour is invalid' using errcode='P0001'; end if;
      end if;
    end loop;
  end loop;
  if (select count(*) from jsonb_array_elements(hours))<>(select count(distinct concat(item.value->>'isoWeekday','|',item.value->>'localStartTime')) from jsonb_array_elements(hours) item(value)) then
    raise exception 'coach availability hours overlap' using errcode='P0001'; end if;
end $$;

create function app.save_owned_effective_coach_availability(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare flags jsonb;
  dataset uuid; coach uuid; op uuid; revision_value integer; receipt app.coach_availability_operations; d jsonb; dates_value date[];
  hours_value jsonb; warnings jsonb; result jsonb; before_count integer; after_count integer; first_date date; day_value date;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'coach availability actor is invalid' using errcode='P0001'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'kind' not in ('weekly','dates')
    or (command-array['kind','operationId','expectedRevision','hours','dates'])<>'{}'::jsonb
    or jsonb_typeof(command->'operationId') is distinct from 'string'
    or jsonb_typeof(command->'expectedRevision') is distinct from 'number' or (command->>'expectedRevision')!~'^[0-9]{1,9}$' then
    raise exception 'coach availability command is invalid' using errcode='P0001'; end if;
  dataset:=current_setting('app.current_run_id',true)::uuid; coach:=current_setting('app.current_profile_id',true)::uuid; op:=(command->>'operationId')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',coach::text),0)); flags:=app.availability_enter();
  if not app.authorized_actor_context_valid(coach,dataset,null) or not app.group_coach_enabled(dataset,coach,true) or not exists(select 1 from app.coach_profiles where run_id=dataset and profile_id=coach and timezone='Europe/Berlin') then raise exception 'coach availability owner is unavailable' using errcode='P0001'; end if;
  select * into receipt from app.coach_availability_operations where run_id=dataset and profile_id=coach and operation_id=op;
  select coalesce((select revision from app.coach_availability_policies where run_id=dataset and profile_id=coach),0) into revision_value;
  if receipt.operation_id is not null then
    result:=case when receipt.input=command then receipt.result else jsonb_build_object('outcome','conflict','reason','operation-changed','revision',revision_value) end;
    perform app.availability_leave(flags); return result;
  end if;
  if revision_value<>(command->>'expectedRevision')::integer then
    perform app.availability_leave(flags); return jsonb_build_object('outcome','conflict','reason','revision-changed','revision',revision_value);
  end if;
  first_date:=(clock_timestamp() at time zone 'Europe/Berlin')::date;
  if command->>'kind'='weekly' then
    if command ? 'dates' then raise exception 'coach availability command is invalid' using errcode='P0001'; end if;
    hours_value:=command->'hours'; perform app.availability_validate_hours(dataset,coach,hours_value,true);
    select array_agg(first_date+n) into dates_value from generate_series(0,29) n;
  else
    if command ? 'hours' or jsonb_typeof(command->'dates') is distinct from 'array' or jsonb_array_length(command->'dates') not between 1 and 31 then
      raise exception 'coach availability date batch is invalid' using errcode='P0001'; end if;
    for d in select * from jsonb_array_elements(command->'dates') loop
      if jsonb_typeof(d) is distinct from 'object' or (d-array['date','mode','hours'])<>'{}'::jsonb
        or jsonb_typeof(d->'date') is distinct from 'string' or (d->>'date')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or d->>'mode' not in ('custom','unavailable','weekly') or not d ? 'mode' then
        raise exception 'coach availability date is invalid' using errcode='P0001'; end if;
      day_value:=(d->>'date')::date;
      if day_value<first_date or day_value=any(coalesce(dates_value,array[]::date[])) then raise exception 'coach availability date is past or duplicated' using errcode='P0001'; end if;
      dates_value:=array_append(dates_value,day_value);
      perform app.availability_validate_hours(dataset,coach,d->'hours',false,day_value);
      if (d->>'mode'='custom' and jsonb_array_length(d->'hours')=0) or (d->>'mode'<>'custom' and d->'hours'<>'[]'::jsonb) then
        raise exception 'coach availability date hours are invalid' using errcode='P0001'; end if;
    end loop;
  end if;
  -- Validate the entire draft before its first write. All closure/card changes
  -- below share this transaction and the coach guard.
  revision_value:=revision_value+1;
  insert into app.coach_availability_policies(run_id,profile_id,revision,weekly_revision,batch_transaction)
    values(dataset,coach,revision_value,case when command->>'kind'='weekly' then revision_value else 0 end,pg_current_xact_id())
    on conflict(run_id,profile_id) do update set revision=revision_value,batch_transaction=pg_current_xact_id(),
      weekly_revision=case when command->>'kind'='weekly' then revision_value else app.coach_availability_policies.weekly_revision end;
  if command->>'kind'='weekly' then
    update app.coach_availability_rules r set status='removed',removed_at=clock_timestamp()
      where r.run_id=dataset and r.profile_id=coach and r.status='active' and not exists(
        select 1 from jsonb_array_elements(hours_value) h where (h->>'isoWeekday')::smallint=r.iso_weekday
          and (h->>'localStartTime')::time=r.local_start_time and (h->>'locationId')::uuid=r.coach_training_location_id);
    insert into app.coach_availability_rules(run_id,profile_id,coach_training_location_id,iso_weekday,local_start_time,coach_timezone)
      select dataset,coach,(h->>'locationId')::uuid,(h->>'isoWeekday')::smallint,(h->>'localStartTime')::time,'Europe/Berlin'
      from jsonb_array_elements(hours_value) h where not exists(select 1 from app.coach_availability_rules r
        where r.run_id=dataset and r.profile_id=coach and r.status='active' and r.iso_weekday=(h->>'isoWeekday')::smallint and r.local_start_time=(h->>'localStartTime')::time);
  else
    for d in select * from jsonb_array_elements(command->'dates') loop
      insert into app.coach_availability_date_overrides(run_id,profile_id,local_date,mode,hours,revision)
        values(dataset,coach,(d->>'date')::date,d->>'mode',d->'hours',revision_value)
        on conflict(run_id,profile_id,local_date) do update set mode=excluded.mode,hours=excluded.hours,revision=excluded.revision;
    end loop;
  end if;
  select count(*) into before_count from app.coach_booking_requests where run_id=dataset and coach_profile_id=coach and status='pending';
  perform app.synchronize_coach_availability_occurrences(dataset,coach);
  select count(*) into after_count from app.coach_booking_requests where run_id=dataset and coach_profile_id=coach and status='pending';
  select coalesce(jsonb_agg(item order by item->>'startsAt',item->>'id'),'[]'::jsonb) into warnings from (
    select jsonb_build_object('kind','private','id',b.id,'startsAt',b.scheduled_start_at,'endsAt',b.scheduled_end_at,'venue',coalesce(s.training_location_name,s.gym_name,s.public_location_label)) item
      from app.coach_private_bookings b join app.coach_availability_slots s on s.id=b.slot_id
      where b.run_id=dataset and b.coach_profile_id=coach and b.status='confirmed' and b.scheduled_start_at>clock_timestamp()
        and (b.scheduled_start_at at time zone 'Europe/Berlin')::date=any(dates_value)
    union all
    select jsonb_build_object('kind','group','id',g.id,'startsAt',g.starts_at,'endsAt',g.ends_at,'venue',g.venue_snapshot->>'name')
      from app.coach_group_sessions g where g.run_id=dataset and g.coach_profile_id=coach and g.starts_at>clock_timestamp()
        and (g.status='confirmed' or (g.status='open' and g.decision_deadline_at>clock_timestamp()))
        and (g.starts_at at time zone 'Europe/Berlin')::date=any(dates_value)
  ) retained;
  result:=jsonb_build_object('outcome','saved','revision',revision_value,'closedRequestCount',before_count-after_count,'retainedSessions',warnings);
  update app.coach_availability_policies set batch_transaction=null where run_id=dataset and profile_id=coach;
  insert into app.coach_availability_operations values(dataset,coach,op,command,result);
  perform app.availability_leave(flags); return result;
exception when others then
  perform app.availability_leave(flags); raise;
end $$;

alter table app.coach_availability_slots
  add column policy_revision integer check (policy_revision is null or policy_revision >= 0),
  add column closure_reason text check (closure_reason is null or closure_reason in ('manual','policy')),
  add column closed_policy_revision integer check (closed_policy_revision is null or closed_policy_revision >= 0);
-- Do not infer restoration consent from historical withdrawn rows.
-- Preserve their audit timestamps while adding provenance; all scheduling and
-- source/card guards remain enabled, and this migration holds the table lock.
alter table app.coach_availability_slots disable trigger coach_availability_slots_set_updated_at;
update app.coach_availability_slots set closure_reason = 'manual' where status = 'withdrawn';
alter table app.coach_availability_slots enable trigger coach_availability_slots_set_updated_at;
alter table app.coach_availability_slots
  add constraint coach_availability_slots_closure_state_check check ((status='withdrawn')=(closure_reason is not null)),
  add constraint coach_availability_slots_closure_revision_check check ((closure_reason is not distinct from 'policy')=(closed_policy_revision is not null));
drop index app.coach_availability_slots_rule_occurrence_key;
create unique index coach_availability_slots_rule_occurrence_key
  on app.coach_availability_slots(recurrence_rule_id,recurrence_local_date)
  where recurrence_rule_id is not null and status <> 'withdrawn';

create function app.availability_enter() returns jsonb language plpgsql set search_path='' as $$
declare key text; flags jsonb := '{}'::jsonb; begin
  foreach key in array array['effective_availability_management','coach_availability_rule_management','coach_availability_management','coach_training_location_management','coach_profile_management','coach_booking_management','coach_booking_request_management','group_session_management'] loop
    flags := flags || jsonb_build_object(key,coalesce(current_setting('app.'||key,true),''));
    perform set_config('app.'||key,'on',true);
  end loop;
  return flags;
end $$;
create function app.availability_leave(flags jsonb) returns void language plpgsql set search_path='' as $$
declare entry record; begin
  for entry in select * from jsonb_each_text(flags) loop perform set_config('app.'||entry.key,entry.value,true); end loop;
end $$;

-- clock_timestamp is evaluated after the coach lock by all mutation callers.
create function app.availability_in_horizon(starts timestamptz, ends timestamptz, at_time timestamptz)
returns boolean language sql stable set search_path='' as $$
  select coalesce(starts > at_time and ends - starts = interval '1 hour'
    and (starts at time zone 'Europe/Berlin')::date between (at_time at time zone 'Europe/Berlin')::date and (at_time at time zone 'Europe/Berlin')::date + 29
    ,false)
$$;
grant execute on function app.availability_in_horizon(timestamptz,timestamptz,timestamptz) to app_runtime;

-- Returns the whole date's effective one-hour assignments, including its version.
create function app.effective_coach_hours(dataset uuid, coach uuid, for_date date)
returns table(rule_id uuid,location_id uuid,local_start time,policy_version integer,hour_timezone text)
language sql stable set search_path='' as $$
  with policy as (
    select coalesce(p.weekly_revision,0) weekly_revision, d.mode,d.hours,d.revision date_revision
    from (select 1) seed
    left join app.coach_availability_policies p on p.run_id=dataset and p.profile_id=coach
    left join app.coach_availability_date_overrides d on d.run_id=dataset and d.profile_id=coach and d.local_date=for_date
  )
  select r.id,r.coach_training_location_id,r.local_start_time,greatest(p.weekly_revision,coalesce(p.date_revision,0)),r.coach_timezone
    from policy p join app.coach_availability_rules r on r.run_id=dataset and r.profile_id=coach
      and r.status='active' and r.iso_weekday=extract(isodow from for_date)::smallint
    where p.mode is null or p.mode='weekly'
  union all
  select null::uuid,(h->>'locationId')::uuid,(h->>'localStartTime')::time,p.date_revision,'Europe/Berlin'::text
    from policy p cross join lateral jsonb_array_elements(p.hours) h where p.mode='custom'
$$;

create function app.availability_slot_matches_policy(slot app.coach_availability_slots)
returns boolean language sql stable set search_path='' as $$
  select exists (
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
  )
$$;

create function app.availability_rule_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; dataset uuid; coach uuid; begin
  dataset:=coalesce(new.run_id,old.run_id); coach:=coalesce(new.profile_id,old.profile_id);
  flags:=app.availability_enter();
  -- Only a protected row written by the save function can suppress per-rule
  -- bumps. Custom GUCs are caller-settable and are not authority.
  if exists(select 1 from app.coach_availability_policies where run_id=dataset and profile_id=coach and batch_transaction=pg_current_xact_id()) then
    perform app.availability_leave(flags); return null;
  end if;
  insert into app.coach_availability_policies(run_id,profile_id,revision,weekly_revision) values(dataset,coach,1,1)
    on conflict(run_id,profile_id) do update set revision=app.coach_availability_policies.revision+1,weekly_revision=app.coach_availability_policies.revision+1;
  perform app.availability_leave(flags); return null;
exception when others then perform app.availability_leave(flags); raise;
end $$;
create trigger effective_rule_revision after insert or update or delete on app.coach_availability_rules
for each row execute function app.availability_rule_revision();

create function app.guard_effective_availability_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; administrator boolean; begin
  flags:=app.availability_enter();
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
create trigger aab_effective_availability before insert or update on app.coach_availability_slots
for each row execute function app.guard_effective_availability_slot();

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
    where s.run_id=requested_run_id and s.profile_id=requested_profile_id and s.status='open' and s.starts_at>current_time_value
      and (not app.availability_slot_matches_policy(s) or not app.group_coach_enabled(requested_run_id,requested_profile_id,true));
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
        and s.status in ('open','held','booked') and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(from_time,to_time,'[)')) then continue; end if;
      if exists(select 1 from app.coach_availability_slots s where s.run_id=requested_run_id and s.profile_id=requested_profile_id
        and s.status='withdrawn' and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(from_time,to_time,'[)')
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

create or replace function app.coach_booking_request_eligibility(requested_status text,requested_starts_at timestamptz,requested_ends_at timestamptz)
returns text language sql volatile set search_path='' as $$
  select case when not app.availability_in_horizon(requested_starts_at,requested_ends_at,clock_timestamp()) then 'unavailable'
    when requested_status='booked' then 'booked' when requested_status='withdrawn' then 'withdrawn'
    when requested_status='open' then 'requestable' else 'unavailable' end
$$;
drop policy coach_availability_slots_public_select on app.coach_availability_slots;
create policy coach_availability_slots_public_select on app.coach_availability_slots for select to app_runtime using (
  app.availability_in_horizon(starts_at,ends_at,statement_timestamp()) and exists(
    select 1 from app.coach_profiles c where c.run_id=coach_availability_slots.run_id and c.profile_id=coach_availability_slots.profile_id
      and c.visibility='visible' and c.location_confirmed_at is not null
  )
);

-- Reconcile before inspecting a stale occurrence. Legacy functions retain the
-- original request/card identities and participant-pair atomicity.
alter function app.create_coach_booking_request(uuid) rename to create_coach_booking_request_before_effective;
alter function app.accept_coach_booking_request(uuid) rename to accept_coach_booking_request_before_effective;
alter function app.current_coach_booking_request_eligibility(uuid) rename to current_coach_booking_request_eligibility_before_effective;
revoke execute on function app.create_coach_booking_request_before_effective(uuid),app.accept_coach_booking_request_before_effective(uuid),app.current_coach_booking_request_eligibility_before_effective(uuid) from app_runtime;

create function app.reconcile_actor_availability_target(target uuid, is_request boolean) returns void
language plpgsql set search_path='' as $$
declare flags jsonb; dataset uuid; coach uuid; actor uuid; begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'coach availability actor is invalid' using errcode='P0001'; end if;
  flags:=app.availability_enter(); dataset:=current_setting('app.current_run_id',true)::uuid; actor:=current_setting('app.current_profile_id',true)::uuid;
  if is_request then
    select r.coach_profile_id into coach from app.coach_booking_requests r where r.run_id=dataset and r.id=target and r.coach_profile_id=actor;
  else select s.profile_id into coach from app.coach_availability_slots s where s.run_id=dataset and s.id=target and s.profile_id<>actor;
  end if;
  if coach is not null then perform app.synchronize_coach_availability_occurrences(dataset,coach); end if;
  perform app.availability_leave(flags);
exception when others then perform app.availability_leave(flags); raise;
end $$;
create function app.create_coach_booking_request(requested_slot_id uuid)
returns table(request_id uuid,request_status text,booking_id uuid) language plpgsql security definer set search_path='' as $$ begin
  perform app.reconcile_actor_availability_target(requested_slot_id,false);
  return query select * from app.create_coach_booking_request_before_effective(requested_slot_id);
end $$;
create function app.accept_coach_booking_request(requested_request_id uuid)
returns table(request_id uuid,request_status text,booking_id uuid) language plpgsql security definer set search_path='' as $$ begin
  perform app.reconcile_actor_availability_target(requested_request_id,true);
  return query select * from app.accept_coach_booking_request_before_effective(requested_request_id);
end $$;
create function app.current_coach_booking_request_eligibility(requested_slot_id uuid)
returns table(slot_id uuid,eligibility text,database_time timestamptz) language plpgsql security definer set search_path='' as $$ begin
  perform app.reconcile_actor_availability_target(requested_slot_id,false);
  return query select r.slot_id,r.eligibility,clock_timestamp() from app.current_coach_booking_request_eligibility_before_effective(requested_slot_id) r;
end $$;

create or replace function app.cancel_direct_private_booking(requested_booking_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare flags jsonb; b app.coach_private_bookings; s app.coach_availability_slots; actor uuid; at_time timestamptz; reopen boolean;
begin
  if not app.authorized_actor_context_valid(null,null,null) then raise exception 'direct coach booking cancellation is invalid' using errcode='P0001'; end if;
  flags:=app.availability_enter(); actor:=current_setting('app.current_profile_id',true)::uuid;
  select * into b from app.coach_private_bookings where id=requested_booking_id and run_id=current_setting('app.current_run_id',true)::uuid
    and credit_projection_id is null and actor in (client_profile_id,coach_profile_id);
  if not found then raise exception 'direct coach booking cancellation is unauthorized' using errcode='P0001'; end if;
  perform app.group_schedule_lock(b.run_id,b.coach_profile_id);
  select * into b from app.coach_private_bookings where id=b.id for update;
  at_time:=clock_timestamp();
  if b.status='cancelled' then perform app.availability_leave(flags); return b.id; end if;
  if b.status<>'confirmed' or b.scheduled_start_at<=at_time then raise exception 'direct coach booking cannot be cancelled' using errcode='P0001'; end if;
  select * into s from app.coach_availability_slots where id=b.slot_id for update;
  update app.coach_private_bookings set status='cancelled',cancelled_at=at_time,cancelled_by_profile_id=actor where id=b.id;
  reopen:=app.availability_in_horizon(s.starts_at,s.ends_at,clock_timestamp()) and app.availability_slot_matches_policy(s)
    and app.group_coach_enabled(b.run_id,b.coach_profile_id,true) and not app.group_time_reserved(b.run_id,b.coach_profile_id,s.starts_at,s.ends_at);
  update app.coach_availability_slots set status=case when reopen then 'open' else 'withdrawn' end,
    closure_reason=case when reopen then null else 'policy' end,closed_policy_revision=case when reopen then null else coalesce(s.policy_revision,0) end
    where id=s.id and status='booked';
  perform app.synchronize_coach_availability_occurrences(b.run_id,b.coach_profile_id);
  perform app.availability_leave(flags); return b.id;
exception when others then perform app.availability_leave(flags); raise;
end $$;

create function app.guard_effective_availability_request() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; s app.coach_availability_slots; begin
  if new.status<>'pending' or (tg_op='UPDATE' and old.status='pending') then return new; end if;
  flags:=app.availability_enter();
  select * into s from app.coach_availability_slots where run_id=new.run_id and id=new.slot_id;
  if s.id is null or s.status<>'open' or not app.availability_in_horizon(s.starts_at,s.ends_at,clock_timestamp())
    or not app.availability_slot_matches_policy(s) or not app.group_coach_enabled(s.run_id,s.profile_id,true)
    or app.group_time_reserved(s.run_id,s.profile_id,s.starts_at,s.ends_at) then
    raise exception 'coach availability request conflicts with effective hours' using errcode='P0001'; end if;
  perform app.availability_leave(flags); return new;
exception when others then perform app.availability_leave(flags); raise;
end $$;
create trigger aab_effective_availability_request before insert or update on app.coach_booking_requests
for each row execute function app.guard_effective_availability_request();

create function app.close_effective_hours_for_inactive_venue() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; begin
  if new.status<>'inactive' or old.status='inactive' then return null; end if;
  flags:=app.availability_enter();
  update app.coach_availability_slots s set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(s.policy_revision,0)
    where s.run_id=new.run_id and s.profile_id=new.profile_id and s.coach_training_location_id=new.id and s.status='open' and s.starts_at>clock_timestamp();
  perform app.availability_leave(flags); return null;
exception when others then perform app.availability_leave(flags); raise;
end $$;
create trigger close_effective_hours_for_inactive_venue after update of status on app.coach_training_locations
for each row execute function app.close_effective_hours_for_inactive_venue();

-- Use the exact save path in a rollback-only subtransaction for coach review.
-- No receipt, occurrence, request, or message card from a preview persists.
create function app.preview_owned_effective_coach_availability(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
  begin
    result:=app.save_owned_effective_coach_availability(command);
    raise exception using errcode='ZX001',message='rollback availability preview';
  exception when sqlstate 'ZX001' then null;
  end;
  return result;
end $$;

-- Internal helpers are invoker-only and never executable by browser/runtime
-- roles. Only the actor-checked, narrow entry points below cross the boundary.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname=any(array[
      'availability_enter','availability_leave','availability_in_horizon','effective_coach_hours','availability_slot_matches_policy',
      'availability_rule_revision','guard_effective_availability_slot','reconcile_actor_availability_target','availability_policy_projection',
      'owned_effective_coach_availability','availability_validate_hours','save_owned_effective_coach_availability','preview_owned_effective_coach_availability',
      'guard_effective_availability_request','close_effective_hours_for_inactive_venue','create_coach_booking_request','accept_coach_booking_request','current_coach_booking_request_eligibility'
    ]) loop
    execute format('alter function %s owner to app_owner',f.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime',f.signature);
  end loop;
end $$;
grant execute on function app.availability_in_horizon(timestamptz,timestamptz,timestamptz),
  app.owned_effective_coach_availability(date,date),app.save_owned_effective_coach_availability(jsonb),app.preview_owned_effective_coach_availability(jsonb),
  app.create_coach_booking_request(uuid),app.accept_coach_booking_request(uuid),app.current_coach_booking_request_eligibility(uuid) to app_runtime;
comment on function app.synchronize_coach_availability_occurrences(uuid,uuid) is
  'Reconciles effective weekly/whole-date hours over today plus 29 Berlin dates; preserves booked/manual/terminal history and shared group authority.';
comment on function app.save_owned_effective_coach_availability(jsonb) is
  'Owner-only atomic weekly or up-to-31-date replacement with revision, durable exact retry receipt, retained-session warnings and request-card closure.';
