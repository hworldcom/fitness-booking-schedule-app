-- DEV0254: bounded owner calendar projection. Migration application is deferred.
-- Existing inventory authority may reconcile dated capacity; this API exposes no
-- policy write, booking decision, group operation, participant identity or notes.
create function app.owned_coach_calendar(args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  flags jsonb; dataset uuid; coach uuid; from_date date; through_date date;
  kind_filter text; venue_filter uuid; with_history boolean; can_schedule boolean;
  after_at timestamptz; after_source text; after_id uuid; query_key text;
  from_time timestamptz; until_time timestamptz; checked_at timestamptz; result jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null)
    or jsonb_typeof(args) is distinct from 'object' or pg_column_size(args)>2048
    or exists(select 1 from jsonb_object_keys(args) k where k not in ('from','through','type','venueId','history','after'))
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
  kind_filter:=args->>'type'; venue_filter:=(args->>'venueId')::uuid; with_history:=(args->>'history')::boolean;
  query_key:=concat(args->>'from','|',args->>'through','|',kind_filter,'|',coalesce(venue_filter::text,'all'),'|',case when with_history then '1' else '0' end);
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
      'Private training'::text title,s.coach_training_location_id location_id,
      coalesce(s.training_location_name,s.gym_name,s.public_location_label) venue_name,s.public_location_label venue_label,
      coalesce(l.status='active',false) venue_active,
      case when s.status='open' then (select count(*) from app.coach_booking_requests r
        where r.run_id=dataset and r.coach_profile_id=coach and r.slot_id=s.id and r.status='pending' and r.decision_deadline_at>checked_at) else 0::bigint end pending_count
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
    select 'booking',b.id,b.scheduled_start_at,b.scheduled_end_at,b.status,'Private session',s.coach_training_location_id,
      coalesce(s.training_location_name,s.gym_name,s.public_location_label),s.public_location_label,coalesce(l.status='active',false),0::bigint
    from app.coach_private_bookings b join app.coach_availability_slots s on s.run_id=b.run_id and s.id=b.slot_id and s.profile_id=b.coach_profile_id
    left join app.coach_training_locations l on l.run_id=dataset and l.profile_id=coach and l.id=s.coach_training_location_id
    where b.run_id=dataset and b.coach_profile_id=coach and b.credit_projection_id is null
      and b.scheduled_start_at<until_time and b.scheduled_end_at>from_time and (b.status in ('confirmed','completed') or (with_history and b.status='cancelled'))
    union all
    select 'group',g.id,g.starts_at,g.ends_at,
      case when g.status='open' and g.decision_deadline_at<=checked_at then 'not-confirmed' else g.status end,
      g.title,g.training_location_id,g.venue_snapshot->>'name',g.venue_snapshot->>'label',coalesce(l.status='active',false),0::bigint
    from app.coach_group_sessions g left join app.coach_training_locations l on l.run_id=dataset and l.profile_id=coach and l.id=g.training_location_id
    where g.run_id=dataset and g.coach_profile_id=coach and g.published_at is not null and g.status<>'draft'
      and g.starts_at<until_time and g.ends_at>from_time and (g.status<>'cancelled' or with_history)
  ), filtered as materialized (
    select *,jsonb_build_object('source',source,'id',id,'startsAt',starts_at,'endsAt',ends_at,'status',status,'title',title,
      'locationId',location_id,'venueName',venue_name,'venueLabel',venue_label,'venueActive',venue_active,'pendingCount',pending_count) item
    from raw where (kind_filter='all' or (kind_filter='group')=(source='group')) and (venue_filter is null or location_id=venue_filter)
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
alter function app.owned_coach_calendar(jsonb) owner to app_owner;
revoke all on function app.owned_coach_calendar(jsonb) from public,anon,authenticated,service_role,app_runtime;
grant execute on function app.owned_coach_calendar(jsonb) to app_runtime;
comment on function app.owned_coach_calendar(jsonb) is 'DEV0254: exact authorized owner period, <=42 Berlin dates, 50-item keyset page, per-day counts/3 previews; no participant identity or notes.';
