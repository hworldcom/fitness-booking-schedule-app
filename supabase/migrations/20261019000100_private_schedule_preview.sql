-- DEV0366: date/count preview only; individual times remain behind server Auth.
create function app.public_private_schedule_preview(slug text)
returns table(local_date date, open_slots integer)
language plpgsql security definer set search_path='' set jit=off as $$
declare coach record; flags jsonb; target_date date; day_offset integer;
begin
  select c.run_id,c.profile_id into coach from app.coach_profiles c
  where c.public_slug=slug and app.coach_website_is_public(c.run_id,c.profile_id);
  if not found then return; end if;
  flags:=app.availability_enter();
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(coach.run_id::text||':'||coach.profile_id::text,0));
  for day_offset in 0..6 loop
    target_date:=(pg_catalog.statement_timestamp() at time zone 'Europe/Berlin')::date+day_offset;
    return query
    with offers as materialized (
      -- All private types share effective venue hours. A longer interval can
      -- never add a start that the shortest eligible interval cannot fit.
      select distinct on (l.id) t.id as type_id,t.revision,t.duration_minutes,l.id as venue_id
      from app.coach_session_types t
      join app.coach_training_locations l on l.run_id=t.run_id and l.profile_id=t.coach_profile_id
        and (t.default_location_id is null or t.default_location_id=l.id)
      where t.run_id=coach.run_id and t.coach_profile_id=coach.profile_id
        and t.format='private' and t.bookable and not t.archived
        and l.status='active' and l.timezone='Europe/Berlin'
      order by l.id,t.duration_minutes,t.id
    ), hours as materialized (
      select * from app.effective_coach_hours(coach.run_id,coach.profile_id,target_date)
    ), candidates as materialized (
      select distinct o.type_id,o.revision,o.duration_minutes,o.venue_id,
        (target_date+h.local_start+pg_catalog.make_interval(mins=>step.offset_minutes)) at time zone h.hour_timezone as starts_at
      from offers o join hours h on h.location_id=o.venue_id
      cross join (values(0),(15),(30),(45)) as step(offset_minutes)
    )
    select target_date,pg_catalog.count(distinct candidate.starts_at)::integer
    from candidates candidate
    where app.typed_session_fits(coach.run_id,coach.profile_id,candidate.type_id,candidate.revision,
      candidate.venue_id,candidate.starts_at,candidate.starts_at+pg_catalog.make_interval(mins=>candidate.duration_minutes));
  end loop;
  perform app.availability_leave(flags);
exception when others then
  if flags is not null then perform app.availability_leave(flags); end if;
  raise;
end $$;
alter function app.public_private_schedule_preview(text) owner to postgres;
revoke all on function app.public_private_schedule_preview(text) from public,anon,authenticated;
grant execute on function app.public_private_schedule_preview(text) to app_runtime;
