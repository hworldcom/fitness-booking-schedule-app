-- DEV0396: avoid enumerating every timezone for the two existing scheduling
-- zones. Actual conversions and the gap/overlap checks still use PostgreSQL's
-- timezone rules; all other names retain the catalog-backed validity check.
create or replace function app.coach_local_time_is_unambiguous(
  requested_local_time timestamp without time zone,
  requested_timezone text
) returns boolean
language sql stable
set search_path = ''
as $$
  select
    requested_local_time is not null
    and requested_timezone is not null
    and case
      when requested_timezone in ('Europe/Berlin', 'UTC') then true
      else exists (
        select 1
        from pg_catalog.pg_timezone_names as timezone_record
        where timezone_record.name = requested_timezone
      )
    end
    and (
      requested_local_time at time zone requested_timezone
    ) at time zone requested_timezone = requested_local_time
    and not exists (
      select 1
      from pg_catalog.generate_series(-180, 180, 15)
        as offset_minutes(value)
      where offset_minutes.value <> 0
        and (
          (requested_local_time at time zone requested_timezone)
          + pg_catalog.make_interval(mins => offset_minutes.value)
        ) at time zone requested_timezone = requested_local_time
    );
$$;
