-- MOV-124: stop future routine repeats; retain personal history and exact retries.
-- Forward replacement preserves existing command behavior, owner and privileges.
create or replace function app.athlete_training_command(action text,args jsonb) returns jsonb
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
 if action is null or action not in('save','series','stop','attendance','preference') or args->>'commandId' is null then raise exception 'invalid training action' using errcode='22023';end if;
 -- Serialize exact retries, revisions, limits and all changes to an owner's calendar.
 perform pg_advisory_xact_lock(hashtextextended(dataset::text||actor::text,120));
 operation_id:=(args->>'commandId')::uuid;payload:=jsonb_build_object('action',action,'args',args);
 select c.payload into existing from app.athlete_training_commands c where c.run_id=dataset and c.profile_id=actor and c.command_id=operation_id;
 if found then if existing<>payload then raise exception 'training retry changed' using errcode='40001';end if;return '{"saved":true}';end if;
 if (select count(*) from app.athlete_training_commands where run_id=dataset and profile_id=actor)>50000 then raise exception 'training command limit' using errcode='22023';end if;
 if action='stop' then
  if args-array['commandId','seriesId','planRevision']<>'{}'::jsonb
   or args->>'seriesId' is null or args->>'planRevision' is null then raise exception 'invalid routine removal' using errcode='22023';end if;
  select * into rule from app.athlete_training_rules where series_id=(args->>'seriesId')::uuid and run_id=dataset and profile_id=actor order by revision desc limit 1;
  if rule.id is null or rule.revision is distinct from (args->>'planRevision')::integer then raise exception 'series changed' using errcode='40001';end if;
  -- Fence stale series edits without adding a rule version or erasing history.
  update app.athlete_training_rules set revision=revision+1 where id=rule.id;
  -- Each historical version may use a different timezone/time. Keep starts that
  -- already happened; disable every future generated occurrence in the series.
  update app.athlete_training_rules r set through_date=least(r.through_date,
   (statement_timestamp() at time zone r.timezone)::date -
   case when (((statement_timestamp() at time zone r.timezone)::date+r.local_time) at time zone r.timezone)>statement_timestamp() then 1 else 0 end)
   where r.series_id=rule.series_id and r.run_id=dataset and r.profile_id=actor;
  -- Exceptions are independent of rule ranges. Cancel future plans explicitly,
  -- retaining identifiers, annotations and all past/started/attended history.
  update app.athlete_training_entries e set attendance='cancelled',revision=e.revision+1
   where e.run_id=dataset and e.profile_id=actor and e.source='personal'
   and e.starts_at>statement_timestamp() and e.attendance='planned'
   and exists(select 1 from app.athlete_training_rules r where r.id=e.rule_id
    and r.series_id=rule.series_id and r.run_id=dataset and r.profile_id=actor);
 elsif action='preference' then
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

