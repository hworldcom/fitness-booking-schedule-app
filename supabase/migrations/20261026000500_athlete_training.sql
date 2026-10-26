-- MOV-120: owner-only personal training; canonical bookings remain independent.
create table app.athlete_training_rules (
 id uuid primary key default gen_random_uuid(), series_id uuid not null, run_id uuid not null references app.demo_runs(id),
 profile_id uuid not null references app.profiles(id), revision integer not null default 1 check(revision>0),
 title text not null check(length(trim(title)) between 1 and 80), timezone text not null,
 from_date date not null, through_date date not null default '2099-12-31', weekday integer not null check(weekday between 0 and 6),
 local_time time not null, minutes integer not null default 60 check(minutes between 1 and 1440),
 unique(series_id,revision), check(from_date between '2000-01-01' and '2099-12-31')
);
create index athlete_training_rules_owner on app.athlete_training_rules(run_id,profile_id,from_date);
create table app.athlete_training_entries (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references app.demo_runs(id),profile_id uuid not null references app.profiles(id),
 occurrence_key text not null check(length(occurrence_key) between 1 and 100), source text not null check(source in('personal','booking','group')),
 rule_id uuid references app.athlete_training_rules(id),title text not null check(length(trim(title)) between 1 and 80),
 starts_at timestamptz not null, ends_at timestamptz not null,timezone text not null,
 attendance text not null default 'planned' check(attendance in('planned','attended','skipped','cancelled')),
 notes text not null default '' check(length(notes)<=2000),intensity text check(intensity in('Easy','Moderate','Hard')),
 actual_minutes integer check(actual_minutes between 1 and 1440), revision integer not null default 1 check(revision>0),
 unique(run_id,profile_id,occurrence_key),check(isfinite(starts_at) and ends_at>starts_at and ends_at-starts_at<=interval '24 hours')
);
create index athlete_training_entries_owner on app.athlete_training_entries(run_id,profile_id,starts_at);
create table app.athlete_training_preferences (
 run_id uuid not null references app.demo_runs(id),profile_id uuid not null references app.profiles(id),
 reminders_enabled boolean not null default false,primary key(run_id,profile_id)
);
create table app.athlete_training_commands (
 run_id uuid not null references app.demo_runs(id),profile_id uuid not null references app.profiles(id),command_id uuid not null,
 payload jsonb not null,primary key(run_id,profile_id,command_id)
);
do $$ declare t text;begin
 foreach t in array array['athlete_training_rules','athlete_training_entries','athlete_training_preferences','athlete_training_commands'] loop
 execute format('alter table app.%I owner to app_owner',t);
 execute format('alter table app.%I enable row level security',t);
 execute format('alter table app.%I force row level security',t);
 execute format('revoke all on app.%I from public,anon,authenticated,service_role,app_runtime,app_notification_worker',t);
 execute format('create policy internal on app.%I to app_owner using(true) with check(true)',t);
 end loop;
end $$;

-- Private bounded projection for the guarded command and restricted worker only.
-- postgres owns this helper to read canonical snapshots without broad new RLS policies.
create function app.athlete_training_items(owner_id uuid,dataset uuid,first_at timestamptz,last_at timestamptz)
returns table(item jsonb) language sql stable security definer set search_path='' as $$
 with generated as (
 select 'p:'||r.series_id::text||':'||d.day::date::text key,r.title,
 (d.day::date+r.local_time) at time zone r.timezone starts_at,
 ((d.day::date+r.local_time) at time zone r.timezone)+make_interval(mins=>r.minutes) ends_at,
 r.timezone,r.id rule_id,r.series_id,
 (select max(v.revision) from app.athlete_training_rules v where v.series_id=r.series_id) plan_revision,
 app.coach_local_time_is_unambiguous(d.day::date+r.local_time,r.timezone) valid_time
 from app.athlete_training_rules r
 cross join lateral generate_series((first_at at time zone r.timezone)::date-1,(last_at at time zone r.timezone)::date,interval '1 day') d(day)
 where r.run_id=dataset and r.profile_id=owner_id
 and last_at>first_at and last_at-first_at<=interval '45 days'
 and d.day::date between r.from_date and r.through_date and extract(dow from d.day)::integer=r.weekday
 ), personal as (
 select g.key,g.title,g.starts_at,g.ends_at,g.timezone,g.rule_id,g.series_id,g.plan_revision,
 case when valid_time then 'planned' else 'time-unavailable' end state
 from generated g where not exists(select 1 from app.athlete_training_entries e where e.run_id=dataset and e.profile_id=owner_id and e.occurrence_key=g.key)
 union all
 select e.occurrence_key,e.title,e.starts_at,e.ends_at,e.timezone,e.rule_id,r.series_id,
 (select max(v.revision) from app.athlete_training_rules v where v.series_id=r.series_id),'planned'
 from app.athlete_training_entries e left join app.athlete_training_rules r on r.id=e.rule_id
 where e.run_id=dataset and e.profile_id=owner_id and e.source='personal'
 ), sources as (
 select p.key,'personal' source,p.title,p.starts_at,p.ends_at,p.timezone,p.state,p.series_id,p.plan_revision,null::text href,null::text location from personal p
 union all
 select 'booking:'||b.id,'booking',left('Private training · '||c.display_name,80),b.scheduled_start_at,b.scheduled_end_at,s.coach_timezone,b.status,null,null,'/sessions/'||b.id,coalesce(s.training_location_name,s.public_location_label)
 from app.coach_private_bookings b join app.coach_availability_slots s on s.id=b.slot_id and s.run_id=b.run_id
 join app.coach_profiles c on c.profile_id=b.coach_profile_id and c.run_id=b.run_id
 where b.run_id=dataset and b.client_profile_id=owner_id and b.credit_projection_id is null
 union all
 select 'group:'||r.id,'group',left(s.title,80),s.starts_at,s.ends_at,'Europe/Berlin',
 case when r.status='active' then case when s.status='open' and s.decision_deadline_at<=statement_timestamp() then 'not-confirmed' else s.status end
 when r.status='pending' and s.decision_deadline_at<=statement_timestamp() then 'expired' else r.status end,
 null,null,'/events/'||s.slug,s.venue_snapshot->>'label'
 from app.coach_group_registrations r join app.coach_group_sessions s on s.id=r.session_id and s.run_id=r.run_id
 where r.run_id=dataset and r.athlete_profile_id=owner_id
 union all
 select 'request:'||r.id,'request',left('Private request · '||c.display_name,80),r.scheduled_start_at,r.scheduled_end_at,r.coach_timezone,
 case when r.status='pending' and r.decision_deadline_at<=statement_timestamp() then 'expired' else r.status end,
 null,null,'/sessions#booking-requests',r.public_location_label
 from app.coach_booking_requests r join app.coach_profiles c on c.profile_id=r.coach_profile_id and c.run_id=r.run_id
 where r.run_id=dataset and r.client_profile_id=owner_id and r.status<>'accepted'
 )
 select jsonb_build_object('key',s.key,'source',s.source,'title',s.title,'startsAt',s.starts_at,'endsAt',s.ends_at,'timezone',s.timezone,
 'state',s.state,'attendance',coalesce(e.attendance,'planned'),'notes',coalesce(e.notes,''),'intensity',e.intensity,'actualMinutes',e.actual_minutes,
 'revision',coalesce(e.revision,0),'seriesId',s.series_id,'planRevision',s.plan_revision,'href',s.href,'location',s.location)
 from sources s left join app.athlete_training_entries e on e.run_id=dataset and e.profile_id=owner_id and e.occurrence_key=s.key
 where last_at>first_at and last_at-first_at<=interval '45 days' and s.starts_at<last_at and s.ends_at>first_at
$$;
alter function app.athlete_training_items(uuid,uuid,timestamptz,timestamptz) owner to postgres;
revoke all on function app.athlete_training_items(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
grant execute on function app.athlete_training_items(uuid,uuid,timestamptz,timestamptz) to app_owner;

create function app.athlete_training_command(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;dataset uuid;zone text;first_day date;last_day date;start_at timestamptz;end_at timestamptz;
 offset_value integer;key_value text;entry app.athlete_training_entries;rule app.athlete_training_rules;
 chosen jsonb;existing jsonb;payload jsonb;operation_id uuid;title_value text;minutes_value integer;local_value timestamp;cutoff date;
 result jsonb;attendance_value text;new_series uuid;week_start date;month_start date;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'training forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
 if jsonb_typeof(args)<>'object' or octet_length(args::text)>12000 then raise exception 'invalid training input' using errcode='22023';end if;
 if action='list' then
  if args-array['from','through','timezone','offset']<>'{}'::jsonb then raise exception 'invalid training query' using errcode='22023';end if;
  zone:=args->>'timezone';first_day:=(args->>'from')::date;last_day:=(args->>'through')::date;offset_value:=coalesce((args->>'offset')::integer,0);
  if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) or first_day is null or last_day is null
   or first_day<'2000-01-01' or last_day>'2099-12-31' or last_day-first_day not between 0 and 41 or offset_value not between 0 and 10000 then raise exception 'invalid training range' using errcode='22023';end if;
  start_at:=first_day::timestamp at time zone zone;end_at:=(last_day+1)::timestamp at time zone zone;
  week_start:=date_trunc('week',statement_timestamp() at time zone zone)::date;month_start:=date_trunc('month',statement_timestamp() at time zone zone)::date;
  with page as(select item from app.athlete_training_items(actor,dataset,start_at,end_at) order by (item->>'startsAt')::timestamptz,item->>'key' offset offset_value limit 101)
  select jsonb_build_object('items',coalesce((select jsonb_agg(item order by (item->>'startsAt')::timestamptz,item->>'key') from(select item from page limit 100) p),'[]'),
   'next',case when count(*)>100 then offset_value+100 end,'now',statement_timestamp(),
   'weekCount',(select count(*) from app.athlete_training_items(actor,dataset,week_start::timestamp at time zone zone,(week_start+7)::timestamp at time zone zone) where item->>'attendance'='attended' and (item->>'startsAt')::timestamptz>=week_start::timestamp at time zone zone),
   'monthCount',(select count(*) from app.athlete_training_items(actor,dataset,month_start::timestamp at time zone zone,(month_start+interval '1 month') at time zone zone) where item->>'attendance'='attended' and (item->>'startsAt')::timestamptz>=month_start::timestamp at time zone zone),
   'remindersEnabled',coalesce((select reminders_enabled from app.athlete_training_preferences where run_id=dataset and profile_id=actor),false)) into result from page;
  return result;
 end if;
 if action is null or action not in('save','series','attendance','preference') or args->>'commandId' is null then raise exception 'invalid training action' using errcode='22023';end if;
 -- Serialize exact retries, revisions, limits and all changes to an owner's calendar.
 perform pg_advisory_xact_lock(hashtextextended(dataset::text||actor::text,120));
 operation_id:=(args->>'commandId')::uuid;payload:=jsonb_build_object('action',action,'args',args);
 select c.payload into existing from app.athlete_training_commands c where c.run_id=dataset and c.profile_id=actor and c.command_id=operation_id;
 if found then if existing<>payload then raise exception 'training retry changed' using errcode='40001';end if;return '{"saved":true}';end if;
 if (select count(*) from app.athlete_training_commands where run_id=dataset and profile_id=actor)>50000 then raise exception 'training command limit' using errcode='22023';end if;
 if action='preference' then
  if args-array['commandId','enabled']<>'{}'::jsonb or jsonb_typeof(args->'enabled')<>'boolean' then raise exception 'invalid preference' using errcode='22023';end if;
  insert into app.athlete_training_preferences values(dataset,actor,(args->>'enabled')::boolean) on conflict(run_id,profile_id) do update set reminders_enabled=excluded.reminders_enabled;
 else
  key_value:=args->>'key';
  if key_value is not null then
   if key_value!~'^(p:[0-9a-f-]{36}:20[0-9]{2}-[0-9]{2}-[0-9]{2}|manual:[0-9a-f-]{36}|booking:[0-9a-f-]{36}|group:[0-9a-f-]{36})$' then raise exception 'invalid training key' using errcode='22023';end if;
   select * into entry from app.athlete_training_entries where run_id=dataset and profile_id=actor and occurrence_key=key_value;
   if coalesce(entry.revision,0) is distinct from (args->>'revision')::integer then raise exception 'training changed' using errcode='40001';end if;
   if entry.id is not null then start_at:=entry.starts_at;
   elsif key_value like 'p:%' then start_at:=split_part(key_value,':',3)::date::timestamp;
   else
    -- Only the exact actor's linked source can establish an overlay.
    if key_value like 'booking:%' then select scheduled_start_at into start_at from app.training_source_start(actor,dataset,key_value);
    else select scheduled_start_at into start_at from app.training_source_start(actor,dataset,key_value);end if;
   end if;
   if start_at is null then raise exception 'training unavailable' using errcode='40001';end if;
   select item into chosen from app.athlete_training_items(actor,dataset,start_at-interval '2 days',start_at+interval '2 days') where item->>'key'=key_value;
   if chosen is null then raise exception 'training unavailable' using errcode='40001';end if;
  end if;
  if action='attendance' then
   if args-array['commandId','key','revision','attendance','notes','intensity','actualMinutes']<>'{}'::jsonb or chosen is null then raise exception 'invalid attendance' using errcode='22023';end if;
   attendance_value:=args->>'attendance';
   if attendance_value not in('planned','attended','skipped','cancelled') or attendance_value is null then raise exception 'invalid attendance' using errcode='22023';end if;
   if attendance_value='attended' and ((chosen->>'endsAt')::timestamptz>statement_timestamp() or chosen->>'state'='time-unavailable') then raise exception 'training has not ended' using errcode='22023';end if;
   if chosen->>'source'<>'personal' and attendance_value='cancelled' then raise exception 'use canonical cancellation' using errcode='22023';end if;
   insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,rule_id,title,starts_at,ends_at,timezone,attendance,notes,intensity,actual_minutes)
   values(dataset,actor,key_value,chosen->>'source',case when key_value like 'p:%' then split_part(key_value,':',2)::uuid end,chosen->>'title',(chosen->>'startsAt')::timestamptz,(chosen->>'endsAt')::timestamptz,chosen->>'timezone',attendance_value,coalesce(args->>'notes',''),args->>'intensity',(args->>'actualMinutes')::integer)
   on conflict(run_id,profile_id,occurrence_key) do update set attendance=excluded.attendance,notes=excluded.notes,intensity=excluded.intensity,actual_minutes=excluded.actual_minutes,revision=app.athlete_training_entries.revision+1;
  else
   if args-array['commandId','key','revision','seriesId','planRevision','title','date','time','timezone','minutes','weekly','completed','notes','intensity','actualMinutes']<>'{}'::jsonb then raise exception 'invalid workout' using errcode='22023';end if;
   zone:=args->>'timezone';title_value:=trim(args->>'title');minutes_value:=coalesce((args->>'minutes')::integer,60);
   if title_value is null or length(title_value) not between 1 and 80 or zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone)
    or minutes_value not between 1 and 1440 then raise exception 'invalid workout terms' using errcode='22023';end if;
   first_day:=(args->>'date')::date;local_value:=first_day+(args->>'time')::time;
   if first_day is null or local_value is null or first_day<(statement_timestamp() at time zone zone)::date-1826 or first_day>(statement_timestamp() at time zone zone)::date+366
    or not app.coach_local_time_is_unambiguous(local_value,zone) then raise exception 'invalid or ambiguous local time' using errcode='22023';end if;
   start_at:=local_value at time zone zone;end_at:=start_at+make_interval(mins=>minutes_value);
   if action='series' or coalesce((args->>'weekly')::boolean,false) then
    if start_at<=statement_timestamp() or coalesce((args->>'completed')::boolean,false) or key_value is not null then raise exception 'recurring plans must be future' using errcode='22023';end if;
    new_series:=gen_random_uuid();
    if action='series' then
     select * into rule from app.athlete_training_rules where series_id=(args->>'seriesId')::uuid and run_id=dataset and profile_id=actor order by revision desc limit 1;
     if rule.id is null or rule.revision is distinct from (args->>'planRevision')::integer then raise exception 'series changed' using errcode='40001';end if;
     cutoff:=greatest(first_day,(statement_timestamp() at time zone rule.timezone)::date+
      case when ((statement_timestamp() at time zone rule.timezone)::date+rule.local_time) at time zone rule.timezone<=statement_timestamp() then 1 else 0 end);
     if first_day<cutoff then raise exception 'choose a future series date' using errcode='22023';end if;
     update app.athlete_training_rules set through_date=least(through_date,cutoff-1) where series_id=rule.series_id and run_id=dataset and profile_id=actor;
     new_series:=rule.series_id;
    end if;
    if (select count(*) from app.athlete_training_rules where run_id=dataset and profile_id=actor)>=1000 then raise exception 'training series limit' using errcode='22023';end if;
    insert into app.athlete_training_rules(id,series_id,run_id,profile_id,revision,title,timezone,from_date,weekday,local_time,minutes)
    values(case when rule.id is null then new_series else gen_random_uuid() end,new_series,dataset,actor,coalesce(rule.revision,0)+1,title_value,zone,first_day,extract(dow from first_day)::integer,(args->>'time')::time,minutes_value);
   else
    if chosen is not null and chosen->>'source'<>'personal' then raise exception 'linked terms are read only' using errcode='22023';end if;
    if coalesce((args->>'completed')::boolean,false) and end_at>statement_timestamp() then raise exception 'workout has not ended' using errcode='22023';end if;
    if (select count(*) from app.athlete_training_entries where run_id=dataset and profile_id=actor)>=10000 then raise exception 'workout limit' using errcode='22023';end if;
    insert into app.athlete_training_entries(run_id,profile_id,occurrence_key,source,rule_id,title,starts_at,ends_at,timezone,attendance,notes,intensity,actual_minutes)
    values(dataset,actor,coalesce(key_value,'manual:'||operation_id),'personal',case when key_value like 'p:%' then split_part(key_value,':',2)::uuid end,title_value,start_at,end_at,zone,
     case when coalesce((args->>'completed')::boolean,false) then 'attended' else coalesce(chosen->>'attendance','planned') end,coalesce(args->>'notes',''),args->>'intensity',(args->>'actualMinutes')::integer)
    on conflict(run_id,profile_id,occurrence_key) do update set title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,attendance=excluded.attendance,notes=excluded.notes,intensity=excluded.intensity,actual_minutes=excluded.actual_minutes,revision=app.athlete_training_entries.revision+1;
   end if;
  end if;
 end if;
 insert into app.athlete_training_commands values(dataset,actor,operation_id,payload);
 return '{"saved":true}';
end $$;
alter function app.athlete_training_command(text,jsonb) owner to app_owner;
revoke all on function app.athlete_training_command(text,jsonb) from public,anon,authenticated,service_role,app_notification_worker;
grant execute on function app.athlete_training_command(text,jsonb) to app_runtime;

create function app.training_source_start(owner_id uuid,dataset uuid,occurrence_key text)
returns table(scheduled_start_at timestamptz) language sql stable security definer set search_path='' as $$
 select scheduled_start_at from app.coach_private_bookings where occurrence_key='booking:'||id and client_profile_id=owner_id and run_id=dataset
 union all select s.starts_at from app.coach_group_sessions s join app.coach_group_registrations r on r.session_id=s.id and r.run_id=s.run_id where occurrence_key='group:'||r.id and r.athlete_profile_id=owner_id and r.run_id=dataset
$$;
alter function app.training_source_start(uuid,uuid,text) owner to postgres;
revoke all on function app.training_source_start(uuid,uuid,text) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
grant execute on function app.training_source_start(uuid,uuid,text) to app_owner;
