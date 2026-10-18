-- DEV0345: optional new group terms; no historical type assignment.
alter table app.coach_group_sessions add column session_type_id uuid references app.coach_session_types(id),add column session_type_snapshot jsonb;
alter table app.coach_group_sessions add constraint group_type_terms check((session_type_id is null)=(session_type_snapshot is null));
create function app.guard_group_session_type() returns trigger language plpgsql set search_path='' as $$
declare t app.coach_session_types;begin
 if tg_op='UPDATE' and old.status<>'draft' and (new.session_type_id,new.session_type_snapshot) is distinct from (old.session_type_id,old.session_type_snapshot) then raise exception 'group type published terms immutable' using errcode='P0001';end if;
 if new.session_type_id is not null and (tg_op='INSERT' or (old.status='draft')) then
  select * into t from app.coach_session_types where id=new.session_type_id and run_id=new.run_id and coach_profile_id=new.coach_profile_id for share;
  if t.id is null or t.format<>'group' or t.archived or (new.status<>'draft' and not t.bookable) then raise exception 'group type unavailable' using errcode='P0001';end if;
 end if;return new;end $$;
alter function app.guard_group_session_type() owner to app_owner;revoke all on function app.guard_group_session_type() from public,anon,authenticated,app_runtime;
create trigger group_session_type_terms before insert or update on app.coach_group_sessions for each row execute function app.guard_group_session_type();

alter function app.group_session_command(text,jsonb) rename to group_session_command_before_types;
revoke execute on function app.group_session_command_before_types(text,jsonb) from app_runtime;
create function app.group_session_command(action text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare flags jsonb;t app.coach_session_types;answer jsonb;activity app.coach_group_sessions;begin
 flags:=app.availability_enter();
 if action='save-draft' and args ? 'sessionTypeId' and args->>'sessionTypeId' is not null then
  select * into t from app.coach_session_types where id=(args->>'sessionTypeId')::uuid and run_id=current_setting('app.current_run_id',true)::uuid and coach_profile_id=current_setting('app.current_profile_id',true)::uuid;
  if t.id is null or t.format<>'group' or t.archived or t.revision is distinct from (args->>'sessionTypeRevision')::integer then raise exception 'group type changed' using errcode='P0001';end if;
  perform pg_advisory_xact_lock(hashtextextended(concat(t.run_id::text,':',t.coach_profile_id::text),0));
 end if;
 if action='save-draft' and args ? 'sessionTypeId' and args->>'expectedRevision' is null then
  select * into activity from app.coach_group_sessions where id=(args->>'id')::uuid;
  if found and activity.session_type_id is distinct from t.id then raise exception 'group type altered retry' using errcode='P0001';end if;
 end if;
 answer:=app.group_session_command_before_types(action,args-array['sessionTypeId','sessionTypeRevision']);
 if action='save-draft' and args ? 'sessionTypeId' then
  perform set_config('app.group_session_management','on',true);
  select * into activity from app.coach_group_sessions where id=(args->>'id')::uuid;
  if activity.run_id<>current_setting('app.current_run_id',true)::uuid or activity.coach_profile_id<>current_setting('app.current_profile_id',true)::uuid or activity.status<>'draft' then raise exception 'group type forbidden' using errcode='42501';end if;
  update app.coach_group_sessions set session_type_id=t.id,session_type_snapshot=case when t.id is null then null else app.session_type_json(t) end where id=activity.id;
  answer:=jsonb_build_object('outcome','saved','session',app.group_session_projection(activity.id,current_setting('app.current_profile_id',true)::uuid));
 end if;
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.group_session_command(text,jsonb) owner to app_owner;
revoke all on function app.group_session_command(text,jsonb) from public,anon,authenticated;
grant execute on function app.group_session_command(text,jsonb) to app_runtime;

alter function app.group_session_projection(uuid,uuid) rename to group_session_projection_before_types;
create function app.group_session_projection(requested_id uuid,actor uuid default null) returns jsonb language sql stable set search_path='' as $$
 select app.group_session_projection_before_types(requested_id,actor)||jsonb_build_object('sessionType',g.session_type_snapshot,'canJoin',coalesce((app.group_session_projection_before_types(requested_id,actor)->>'canJoin')::boolean,false) and (g.session_type_id is null or exists(select 1 from app.coach_session_types t where t.id=g.session_type_id and not t.archived and t.bookable))) from app.coach_group_sessions g where g.id=requested_id
$$;
alter function app.group_session_projection(uuid,uuid) owner to app_owner;revoke all on function app.group_session_projection(uuid,uuid) from public,anon,authenticated,app_runtime;
CREATE OR REPLACE FUNCTION app.guard_group_registration() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare activity app.coach_group_sessions;
begin
  if tg_op = 'DELETE' then
    if current_user = 'app_owner' then raise exception 'group registration history must be retained' using errcode = 'P0001'; end if;
    return old;
  end if;
  select * into activity from app.coach_group_sessions where id = new.session_id and run_id = new.run_id for update;
  if not found or new.athlete_profile_id = activity.coach_profile_id then
    raise exception 'group registration is unavailable' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and ((new.id,new.run_id,new.session_id,new.athlete_profile_id,new.created_at) is distinct from (old.id,old.run_id,old.session_id,old.athlete_profile_id,old.created_at)
    or old.status <> 'active' or new.status = 'active') then
    raise exception 'group registration attempt is terminal' using errcode = 'P0001';
  end if;
  if new.status='active' and activity.session_type_id is not null and not exists(select 1 from app.coach_session_types t where t.id=activity.session_type_id and not t.archived and t.bookable) then raise exception 'group type unavailable' using errcode='P0001';end if;
  if new.status = 'active' and (activity.status not in ('open','confirmed') or (select count(*) from app.coach_group_registrations where session_id = new.session_id and status = 'active') >= activity.maximum_participants) then
    raise exception 'group session is full or unavailable' using errcode = 'P0001';
  end if;
  if (new.status = 'session-cancelled' and activity.status <> 'cancelled') or (new.status = 'session-not-confirmed' and activity.status <> 'not-confirmed') then
    raise exception 'group registration resolution conflicts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
CREATE OR REPLACE FUNCTION app.public_group_sessions(action text, args jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare dataset uuid; candidate uuid; entries jsonb; result jsonb; after_at timestamptz; after_id uuid; activity app.coach_group_sessions;
begin
  if jsonb_typeof(args) is distinct from 'object' or pg_column_size(args) > 16384 or coalesce(char_length(args->>'location'),0) > 160 then raise exception 'group filters are invalid' using errcode = 'P0001'; end if;
  perform app.group_session_flags(true);
  select id into dataset from app.demo_runs where status = 'active' and catalogue_visibility = 'public';
  after_at := (args->'after'->>'at')::timestamptz; after_id := (args->'after'->>'id')::uuid;
  if (after_at is null) <> (after_id is null) or (after_at is not null and not isfinite(after_at)) then raise exception 'group cursor is invalid' using errcode = 'P0001'; end if;
  if action = 'list' then
    for candidate in select id from app.coach_group_sessions where run_id = dataset and status = 'open' and decision_deadline_at <= clock_timestamp() order by id limit 100 loop perform app.group_reconcile_session(candidate); end loop;
    select jsonb_agg(jsonb_build_object('item',app.group_session_projection(s.id,null),'cursor',jsonb_build_object('at',s.starts_at,'id',s.id)) order by s.starts_at,s.id) into entries
      from (select * from app.coach_group_sessions where run_id = dataset and status in ('open','confirmed') and starts_at > clock_timestamp()
        and (status = 'confirmed' or decision_deadline_at > clock_timestamp()) and app.group_coach_enabled(run_id,coach_profile_id,true)
        and (nullif(args->>'sessionTypeId','') is null or session_type_id=(args->>'sessionTypeId')::uuid)
        and (nullif(args->>'discipline','') is null or discipline = args->>'discipline')
        and strpos(lower(venue_snapshot->>'name' || ' ' || (venue_snapshot->>'label')),lower(coalesce(args->>'location',''))) > 0
        and (after_at is null or (starts_at,id) > (after_at,after_id)) order by starts_at,id limit 21) s;
    result := app.group_page(entries,20);
  elsif action = 'detail' then
    select * into activity from app.coach_group_sessions where run_id = dataset and slug = args->>'slug' and status <> 'draft';
    if found and app.group_coach_enabled(dataset,activity.coach_profile_id,true) then
      activity := app.group_reconcile_session(activity.id);
      result := jsonb_build_object('session',app.group_session_projection(activity.id,null));
    else result := jsonb_build_object('session',null); end if;
  else raise exception 'group action is unavailable' using errcode = 'P0001'; end if;
  perform app.group_session_flags(false);
  return result;
end;
$$;
create or replace function app.owned_coach_calendar(args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  flags jsonb; dataset uuid; coach uuid; from_date date; through_date date;
  type_filter uuid; kind_filter text; venue_filter uuid; with_history boolean; can_schedule boolean;
  after_at timestamptz; after_source text; after_id uuid; query_key text;
  from_time timestamptz; until_time timestamptz; checked_at timestamptz; result jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null)
    or jsonb_typeof(args) is distinct from 'object' or pg_column_size(args)>2048
    or exists(select 1 from jsonb_object_keys(args) k where k not in ('from','through','type','venueId','history','after','sessionTypeId'))
    or not (args ?& array['from','through','type','venueId','history','after'])
    or jsonb_typeof(args->'from') is distinct from 'string'
    or jsonb_typeof(args->'through') is distinct from 'string'
    or (args->>'from') !~ '^\d{4}-\d{2}-\d{2}$' or (args->>'through') !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(args->'history') is distinct from 'boolean'
    or jsonb_typeof(args->'type') is distinct from 'string'
    or (args->>'type') not in ('all','private','group') then
    raise exception 'coach calendar query is invalid' using errcode='P0001';
  end if;
  from_date:=(args->>'from')::date; through_date:=(args->>'through')::date;
  if through_date<from_date or through_date-from_date>41 or not isfinite(from_date) or not isfinite(through_date) then
    raise exception 'coach calendar period is invalid' using errcode='P0001'; end if;
  type_filter:=(args->>'sessionTypeId')::uuid;
  kind_filter:=args->>'type'; venue_filter:=(args->>'venueId')::uuid; with_history:=(args->>'history')::boolean;
  query_key:=concat(args->>'from','|',args->>'through','|',kind_filter,'|',coalesce(venue_filter::text,'all'),'|',case when with_history then '1' else '0' end,case when type_filter is not null then '|'||type_filter::text else '' end);
  if args->'after' <> 'null'::jsonb then
    if jsonb_typeof(args->'after') is distinct from 'object'
      or not ((args->'after') ?& array['at','source','id','queryKey'])
      or exists(select 1 from jsonb_object_keys(args->'after') k where k not in ('at','source','id','queryKey'))
      or args->'after'->>'queryKey' is distinct from query_key then
      raise exception 'coach calendar cursor is invalid' using errcode='P0001'; end if;
    after_at:=(args->'after'->>'at')::timestamptz; after_source:=args->'after'->>'source'; after_id:=(args->'after'->>'id')::uuid;
    if after_at is null or not isfinite(after_at) or after_source is null or after_source not in ('availability','booking','group') or after_id is null then
      raise exception 'coach calendar cursor is invalid' using errcode='P0001'; end if;
  end if;
  dataset:=current_setting('app.current_run_id',true)::uuid; coach:=current_setting('app.current_profile_id',true)::uuid;
  flags:=app.availability_enter();
  if not exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id=p.profile_id
    where p.run_id=dataset and p.profile_id=coach and (p.is_demo or a.status in ('approved','suspended'))) then
    raise exception 'coach calendar owner is unavailable' using errcode='P0001'; end if;
  can_schedule:=app.group_coach_enabled(dataset,coach,true);
  if can_schedule then perform app.synchronize_coach_availability_occurrences(dataset,coach); end if;
  checked_at:=clock_timestamp();
  from_time:=from_date::timestamp at time zone 'Europe/Berlin'; until_time:=(through_date+1)::timestamp at time zone 'Europe/Berlin';
  with raw as (
    select 'availability'::text source,s.id,s.starts_at,s.ends_at,
      case when s.status='open' then 'available' else 'withdrawn' end status,
      coalesce(s.session_type_snapshot->>'name','Private training')::text title,s.coach_training_location_id location_id,
      coalesce(s.training_location_name,s.gym_name,s.public_location_label) venue_name,s.public_location_label venue_label,
      coalesce(l.status='active',false) venue_active,
      case when s.status='open' then (select count(*) from app.coach_booking_requests r
        where r.run_id=dataset and r.coach_profile_id=coach and r.slot_id=s.id and r.status='pending' and r.decision_deadline_at>checked_at) else 0::bigint end pending_count,s.session_type_id,s.session_type_snapshot
    from app.coach_availability_slots s left join app.coach_training_locations l on l.run_id=dataset and l.profile_id=coach and l.id=s.coach_training_location_id
    where s.run_id=dataset and s.profile_id=coach and s.starts_at<until_time and s.ends_at>from_time and (
      (with_history and s.status='withdrawn') or (
        s.status='open' and can_schedule and app.availability_in_horizon(s.starts_at,s.ends_at,checked_at)
        and app.availability_slot_matches_policy(s)
        and not exists(select 1 from app.coach_private_bookings b where b.run_id=dataset and b.coach_profile_id=coach and b.status='confirmed'
          and tstzrange(b.scheduled_start_at,b.scheduled_end_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)'))
        and not exists(select 1 from app.coach_group_sessions g where g.run_id=dataset and g.coach_profile_id=coach
          and (g.status='confirmed' or (g.status='open' and g.decision_deadline_at>checked_at))
          and tstzrange(g.starts_at,g.ends_at,'[)') && tstzrange(s.starts_at,s.ends_at,'[)'))
      ))
    union all
    select 'booking',b.id,b.scheduled_start_at,b.scheduled_end_at,b.status,coalesce(s.session_type_snapshot->>'name','Private session'),s.coach_training_location_id,
      coalesce(s.training_location_name,s.gym_name,s.public_location_label),s.public_location_label,coalesce(l.status='active',false),0::bigint,s.session_type_id,s.session_type_snapshot
    from app.coach_private_bookings b join app.coach_availability_slots s on s.run_id=b.run_id and s.id=b.slot_id and s.profile_id=b.coach_profile_id
    left join app.coach_training_locations l on l.run_id=dataset and l.profile_id=coach and l.id=s.coach_training_location_id
    where b.run_id=dataset and b.coach_profile_id=coach and b.credit_projection_id is null
      and b.scheduled_start_at<until_time and b.scheduled_end_at>from_time and (b.status in ('confirmed','completed') or (with_history and b.status='cancelled'))
    union all
    select 'group',g.id,g.starts_at,g.ends_at,
      case when g.status='open' and g.decision_deadline_at<=checked_at then 'not-confirmed' else g.status end,
      g.title,g.training_location_id,g.venue_snapshot->>'name',g.venue_snapshot->>'label',coalesce(l.status='active',false),0::bigint,g.session_type_id,g.session_type_snapshot
    from app.coach_group_sessions g left join app.coach_training_locations l on l.run_id=dataset and l.profile_id=coach and l.id=g.training_location_id
    where g.run_id=dataset and g.coach_profile_id=coach and g.published_at is not null and g.status<>'draft'
      and g.starts_at<until_time and g.ends_at>from_time and (g.status<>'cancelled' or with_history)
  ), filtered as materialized (
    select *,jsonb_build_object('source',source,'id',id,'startsAt',starts_at,'endsAt',ends_at,'status',status,'title',title,
      'locationId',location_id,'venueName',venue_name,'venueLabel',venue_label,'venueActive',venue_active,'pendingCount',pending_count,'sessionTypeId',session_type_id,'sessionTypeName',session_type_snapshot->>'name','sessionTypeColor',session_type_snapshot->>'color') item
    from raw where (type_filter is null or session_type_id=type_filter) and (kind_filter='all' or (kind_filter='group')=(source='group')) and (venue_filter is null or location_id=venue_filter)
  ), raw_page as materialized (
    select * from filtered where after_at is null or (starts_at,source,id)>(after_at,after_source,after_id) order by starts_at,source,id limit 51
  ), page as materialized (select * from raw_page order by starts_at,source,id limit 50),
  dates as (select from_date+n local_date from generate_series(0,through_date-from_date) n),
  day_rows as (
    select d.local_date,f.item,row_number() over(partition by d.local_date order by f.starts_at,f.source,f.id) position,
      count(*) over(partition by d.local_date) day_total
    from dates d join filtered f on f.starts_at<((d.local_date+1)::timestamp at time zone 'Europe/Berlin')
      and f.ends_at>(d.local_date::timestamp at time zone 'Europe/Berlin')
  ), day_summaries as (
    select local_date,max(day_total) total,jsonb_agg(item order by position) previews from day_rows where position<=3 group by local_date
  ) select jsonb_build_object(
    'items',coalesce((select jsonb_agg(item order by starts_at,source,id) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),'now',checked_at,
    'version',(select md5(coalesce(string_agg(item::text,'|' order by starts_at,source,id),'')) from filtered),
    'days',coalesce((select jsonb_agg(jsonb_build_object('date',local_date,'total',total,'previews',previews) order by local_date) from day_summaries),'[]'::jsonb),
    'nextCursor',case when (select count(*) from raw_page)>50 then (select jsonb_build_object('at',starts_at,'source',source,'id',id,'queryKey',query_key) from page order by starts_at desc,source desc,id desc limit 1) else null end
  ) into result;
  perform app.availability_leave(flags); return result;
exception when others then perform app.availability_leave(flags); raise;
end $$;


-- Pending typed requests do not reserve group capacity. Legacy open hours still require explicit closure.
CREATE OR REPLACE FUNCTION app.publish_group_session(requested_id uuid, expected_revision integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions; venue app.coach_training_locations;
  snapshot jsonb; checked_at timestamptz; result jsonb; outcome text; reason text;
  previous_group text := coalesce(current_setting('app.group_session_management',true),'');
  previous_publication text := coalesce(current_setting('app.group_publication_management',true),'');
begin
  if requested_id is null or expected_revision is null or expected_revision < 1 or not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'group publication is unavailable' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id',true)::uuid; dataset := current_setting('app.current_run_id',true)::uuid;
  perform app.group_schedule_lock(dataset,actor);
  perform set_config('app.group_session_management','on',true);
  select * into activity from app.coach_group_sessions where id = requested_id and run_id = dataset and coach_profile_id = actor;
  if not found then raise exception 'group publication is unavailable' using errcode = 'P0001'; end if;
  -- Lock eligibility before the draft row, preserving the current application/coach order.
  if activity.status = 'draft' then perform app.group_lock_coach(dataset,actor,true); end if;
  activity := app.group_reconcile_session(requested_id);
  if activity.status in ('open','confirmed') and activity.published_from_revision = expected_revision then
    outcome := 'published';
  elsif activity.status <> 'draft' then outcome := 'unavailable'; reason := 'unavailable';
  elsif activity.revision <> expected_revision then outcome := 'changed'; reason := 'draft-changed';
  else
    select * into venue from app.coach_training_locations where id = activity.training_location_id and run_id = dataset and profile_id = actor and status = 'active' and location_confirmed_at is not null for share;
    checked_at := clock_timestamp();
    if not found or venue.timezone <> 'Europe/Berlin' or activity.decision_deadline_at <= checked_at
      or not exists(select 1 from app.coach_profile_disciplines where run_id = dataset and profile_id = actor and discipline = activity.discipline)
      or not app.coach_local_time_is_unambiguous(activity.starts_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(activity.ends_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(activity.decision_deadline_at at time zone 'Europe/Berlin','Europe/Berlin') then
      outcome := 'unavailable'; reason := 'unavailable';
    else
      snapshot := jsonb_build_object('id',venue.id,'name',venue.public_name,'label',venue.public_location_label,'kind',venue.location_kind,'latitude',venue.latitude,'longitude',venue.longitude);
      if snapshot is distinct from activity.venue_snapshot then outcome := 'changed'; reason := 'venue-changed';
      elsif app.group_time_reserved(dataset,actor,activity.starts_at,activity.ends_at,activity.id)
        or exists(select 1 from app.coach_availability_slots where run_id = dataset and profile_id = actor and (status in ('held','booked') or (status='open' and session_type_id is null)) and tstzrange(starts_at,ends_at,'[)') && tstzrange(activity.starts_at,activity.ends_at,'[)'))
        or exists(select 1 from app.coach_private_bookings where run_id = dataset and coach_profile_id = actor and status = 'confirmed' and tstzrange(scheduled_start_at,scheduled_end_at,'[)') && tstzrange(activity.starts_at,activity.ends_at,'[)')) then
        outcome := 'conflict'; reason := 'schedule-conflict';
      else
        -- Recheck after all potentially waiting locks, including expiry reconciliation.
        checked_at := clock_timestamp();
        if activity.decision_deadline_at <= checked_at then outcome := 'unavailable'; reason := 'unavailable';
        else
          perform set_config('app.group_publication_management','on',true);
          update app.coach_group_sessions set status = 'open',published_at = checked_at,published_from_revision = expected_revision,revision = revision + 1,updated_at = checked_at where id = requested_id;
          outcome := 'published';
        end if;
      end if;
    end if;
  end if;
  result := jsonb_build_object('outcome',outcome,'reason',reason,'session',app.group_session_projection(requested_id,actor));
  perform set_config('app.group_session_management',previous_group,true);
  perform set_config('app.group_publication_management',previous_publication,true);
  return result;
exception when others then
  perform set_config('app.group_session_management',previous_group,true);
  perform set_config('app.group_publication_management',previous_publication,true); raise;
end;
$$;
create function app.close_group_typed_candidates() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb;begin
 flags:=app.availability_enter();
 update app.coach_availability_slots s set status='withdrawn',closure_reason='policy',closed_policy_revision=coalesce(s.policy_revision,0) where s.run_id=new.run_id and s.profile_id=new.coach_profile_id and s.session_type_id is not null and s.status='open' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)');
 perform app.availability_leave(flags);return new;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.close_group_typed_candidates() owner to app_owner;
revoke all on function app.close_group_typed_candidates() from public,anon,authenticated,app_runtime;
create trigger group_closes_unreserved_types after update on app.coach_group_sessions for each row when(old.status='draft' and new.status in ('open','confirmed')) execute function app.close_group_typed_candidates();
