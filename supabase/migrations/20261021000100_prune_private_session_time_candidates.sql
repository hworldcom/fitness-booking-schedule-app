-- DEV0402: enumerate starts only inside actual venue hours. Keep the existing
-- visibility, schedule lock and full-duration/conflict checks authoritative.
-- Replacing this signature preserves its owner, ACL, identity and callers.
create or replace function app.public_session_type_times(slug text,type_id uuid,venue_id uuid,local_date date) returns jsonb
language plpgsql security definer set search_path='' set jit=off as $$
declare flags jsonb;t app.coach_session_types;at_time timestamptz;candidate jsonb;answer jsonb:='[]';
begin
 if local_date is null or local_date not between (clock_timestamp() at time zone 'Europe/Berlin')::date and (clock_timestamp() at time zone 'Europe/Berlin')::date+29 then raise exception 'typed booking invalid date' using errcode='22023';end if;
 flags:=app.availability_enter();
 select s.* into t from app.coach_session_types s join app.coach_profiles c on c.run_id=s.run_id and c.profile_id=s.coach_profile_id where c.public_slug=slug and s.id=type_id and app.coach_website_is_public(c.run_id,c.profile_id);
 if t.id is null then perform app.availability_leave(flags);return answer;end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(t.run_id::text,':',t.coach_profile_id::text),0));
 for at_time in
   with hours as materialized (
     select * from app.effective_coach_hours(t.run_id,t.coach_profile_id,local_date)
   ), candidates as (
     select distinct
       (local_date+h.local_start+make_interval(mins=>step.offset_minutes))
         at time zone h.hour_timezone as starts_at
     from hours h cross join (values(0),(15),(30),(45)) step(offset_minutes)
     where h.location_id=venue_id and h.hour_timezone='Europe/Berlin'
   )
   select starts_at from candidates
   where starts_at between (local_date::timestamp at time zone 'Europe/Berlin')
     and ((local_date+time '23:00') at time zone 'Europe/Berlin')
   order by starts_at
 loop
   if app.typed_session_fits(t.run_id,t.coach_profile_id,t.id,t.revision,venue_id,at_time,at_time+make_interval(mins=>t.duration_minutes)) then
     candidate:=jsonb_build_object('startsAt',at_time,'endsAt',at_time+make_interval(mins=>t.duration_minutes));answer:=answer||jsonb_build_array(candidate);
   end if;
 end loop;
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
