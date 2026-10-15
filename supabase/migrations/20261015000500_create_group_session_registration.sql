-- DEV0237: nonfinancial group sessions. No runtime publication entry point.
create table app.coach_group_sessions (
  id uuid primary key,
  run_id uuid not null,
  coach_profile_id uuid not null,
  slug text not null unique,
  title text not null check (char_length(title) between 3 and 120 and title = btrim(title)),
  description text not null check (char_length(description) <= 2000),
  discipline text not null check (discipline in ('Boxing','Muay Thai','Kickboxing','Brazilian Jiu-Jitsu','MMA','Wrestling')),
  intended_level text not null check (char_length(intended_level) between 1 and 80),
  training_location_id uuid not null,
  venue_snapshot jsonb not null check (
    jsonb_typeof(venue_snapshot) = 'object'
    and venue_snapshot ?& array['id','name','label','kind','latitude','longitude']
    and jsonb_typeof(venue_snapshot->'id') = 'string'
    and jsonb_typeof(venue_snapshot->'name') = 'string'
    and jsonb_typeof(venue_snapshot->'label') = 'string'
    and jsonb_typeof(venue_snapshot->'kind') = 'string'
    and venue_snapshot->>'id' = training_location_id::text
    and char_length(venue_snapshot->>'name') between 2 and 240
    and char_length(venue_snapshot->>'label') between 2 and 240
    and venue_snapshot->>'kind' in ('gym','independent')
    and jsonb_typeof(venue_snapshot->'latitude') = 'number'
    and jsonb_typeof(venue_snapshot->'longitude') = 'number'
    and (venue_snapshot->>'latitude')::numeric between -90 and 90
    and (venue_snapshot->>'longitude')::numeric between -180 and 180
  ),
  starts_at timestamptz not null check (isfinite(starts_at)),
  ends_at timestamptz not null check (isfinite(ends_at)),
  decision_deadline_at timestamptz not null check (isfinite(decision_deadline_at)),
  minimum_participants smallint not null,
  maximum_participants smallint not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  status text not null default 'draft' check (status in ('draft','open','confirmed','cancelled','not-confirmed')),
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by_profile_id uuid,
  closed_at timestamptz,
  closed_by_profile_id uuid,
  unique (run_id,id),
  foreign key (run_id,coach_profile_id) references app.coach_profiles(run_id,profile_id),
  foreign key (run_id,coach_profile_id,training_location_id) references app.coach_training_locations(run_id,profile_id,id),
  check (slug = 'group-' || replace(id::text,'-','')),
  check (ends_at > starts_at and (starts_at at time zone 'Europe/Berlin')::date = (ends_at at time zone 'Europe/Berlin')::date),
  check (decision_deadline_at < starts_at),
  check (1 <= minimum_participants and minimum_participants <= maximum_participants and maximum_participants <= 100),
  check ((status = 'draft') = (published_at is null)),
  check (published_at is null or published_at < decision_deadline_at),
  check ((confirmed_at is null) = (confirmed_by_profile_id is null)),
  check (confirmed_at is null or (confirmed_by_profile_id = coach_profile_id and confirmed_at < decision_deadline_at)),
  check (status <> 'confirmed' or confirmed_at is not null),
  check (status not in ('draft','open','not-confirmed') or confirmed_at is null),
  check ((status in ('cancelled','not-confirmed')) = (closed_at is not null)),
  check ((status = 'cancelled' and closed_by_profile_id = coach_profile_id)
    or (status <> 'cancelled' and closed_by_profile_id is null))
);

create table app.coach_group_registrations (
  id uuid primary key,
  run_id uuid not null,
  session_id uuid not null,
  athlete_profile_id uuid not null,
  status text not null default 'active' check (status in ('active','withdrawn','session-cancelled','session-not-confirmed')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  foreign key (run_id,session_id) references app.coach_group_sessions(run_id,id) on delete cascade,
  foreign key (run_id,athlete_profile_id) references app.demo_run_participants(run_id,profile_id),
  check ((status = 'active') = (resolved_at is null)),
  check (resolved_at is null or resolved_at >= created_at)
);
create unique index coach_group_one_active_registration on app.coach_group_registrations(session_id,athlete_profile_id) where status = 'active';
create index coach_group_public_upcoming on app.coach_group_sessions(run_id,starts_at,id) where status in ('open','confirmed');
create index coach_group_owner_page on app.coach_group_sessions(run_id,coach_profile_id,created_at desc,id desc);
create index coach_group_roster on app.coach_group_registrations(session_id,created_at,id);
create index coach_group_athlete_page on app.coach_group_registrations(run_id,athlete_profile_id,created_at desc,id desc);

alter table app.coach_group_sessions owner to app_owner;
alter table app.coach_group_registrations owner to app_owner;
alter table app.coach_group_sessions enable row level security;
alter table app.coach_group_sessions force row level security;
alter table app.coach_group_registrations enable row level security;
alter table app.coach_group_registrations force row level security;
revoke all on app.coach_group_sessions, app.coach_group_registrations from public,anon,authenticated,service_role,app_runtime;
create policy group_session_management on app.coach_group_sessions for all to app_owner
  using (current_setting('app.group_session_management',true) = 'on')
  with check (current_setting('app.group_session_management',true) = 'on');
create policy group_registration_management on app.coach_group_registrations for all to app_owner
  using (current_setting('app.group_session_management',true) = 'on')
  with check (current_setting('app.group_session_management',true) = 'on');
-- These policies grant only the internal function owner the required lookup reads.
do $$ declare relation text; begin
  foreach relation in array array['profiles','demo_runs','demo_run_participants','coach_profiles','coach_applications','coach_profile_disciplines','coach_training_locations'] loop
    execute format('create policy group_session_lookup on app.%I for select to app_owner using (current_setting(''app.group_session_management'',true) = ''on'')',relation);
  end loop;
end $$;

-- SELECT ... FOR SHARE also needs an UPDATE policy. Permit lock visibility
-- without allowing group commands to mutate coach/application/location rows.
do $$
declare relation text;
begin
  foreach relation in array array['coach_profiles','coach_applications','coach_training_locations'] loop
    execute format('create policy group_session_lock on app.%I for update to app_owner using (current_setting(''app.group_session_management'',true) = ''on'') with check (false)',relation);
  end loop;
end;
$$;

create function app.group_session_flags(enabled boolean) returns void
language plpgsql set search_path = '' as $$
begin
  perform set_config('app.group_session_management',case when enabled then 'on' else 'off' end,true);
end;
$$;

create function app.guard_group_session() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and current_user = 'app_owner' then
      raise exception 'group history must be retained' using errcode = 'P0001';
    end if;
    return old;
  end if;
  -- Only a privileged database fixture may represent published inventory before
  -- DEV0238 replaces this deny guard with its coach-wide publication boundary.
  if ((tg_op = 'INSERT' and new.status <> 'draft') or (tg_op = 'UPDATE' and old.status = 'draft' and new.status <> 'draft'))
    and not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or (rolcreatedb and rolcreaterole and rolbypassrls))) then
    raise exception 'group publication is unavailable until scheduling integration' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.run_id,new.coach_profile_id,new.slug,new.created_at) is distinct from (old.id,old.run_id,old.coach_profile_id,old.slug,old.created_at) then
      raise exception 'group identity must be retained' using errcode = 'P0001';
    end if;
    if old.status <> 'draft' and (new.title,new.description,new.discipline,new.intended_level,new.training_location_id,new.venue_snapshot,new.starts_at,new.ends_at,new.decision_deadline_at,new.minimum_participants,new.maximum_participants,new.price_cents,new.currency,new.published_at)
      is distinct from (old.title,old.description,old.discipline,old.intended_level,old.training_location_id,old.venue_snapshot,old.starts_at,old.ends_at,old.decision_deadline_at,old.minimum_participants,old.maximum_participants,old.price_cents,old.currency,old.published_at) then
      raise exception 'published group terms are immutable' using errcode = 'P0001';
    end if;
    if new.status <> old.status and not ((old.status = 'open' and new.status in ('confirmed','cancelled','not-confirmed')) or (old.status = 'confirmed' and new.status = 'cancelled')
      or (old.status = 'draft' and new.status = 'open')) then
      raise exception 'group transition is terminal' using errcode = 'P0001';
    end if;
    if old.confirmed_at is not null and (new.confirmed_at,new.confirmed_by_profile_id) is distinct from (old.confirmed_at,old.confirmed_by_profile_id) then
      raise exception 'group confirmation must be retained' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_group_session before insert or update or delete on app.coach_group_sessions for each row execute function app.guard_group_session();

create function app.guard_group_registration() returns trigger language plpgsql set search_path = '' as $$
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
  if new.status = 'active' and (activity.status not in ('open','confirmed') or (select count(*) from app.coach_group_registrations where session_id = new.session_id and status = 'active') >= activity.maximum_participants) then
    raise exception 'group session is full or unavailable' using errcode = 'P0001';
  end if;
  if (new.status = 'session-cancelled' and activity.status <> 'cancelled') or (new.status = 'session-not-confirmed' and activity.status <> 'not-confirmed') then
    raise exception 'group registration resolution conflicts' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger guard_group_registration before insert or update or delete on app.coach_group_registrations for each row execute function app.guard_group_registration();

create function app.group_coach_enabled(dataset uuid, coach uuid, require_visible boolean default true) returns boolean
language sql stable set search_path = '' as $$
  select exists(select 1 from app.coach_profiles p left join app.coach_applications a on a.profile_id = p.profile_id
    where p.run_id = dataset and p.profile_id = coach and (p.is_demo or a.status = 'approved') and (not require_visible or p.visibility = 'visible'));
$$;
create function app.group_lock_coach(dataset uuid, coach uuid, require_visible boolean) returns void
language plpgsql set search_path = '' as $$
declare demo boolean;
begin
  select is_demo into demo from app.coach_profiles where run_id = dataset and profile_id = coach;
  if demo is not true then
    perform 1 from app.coach_applications where profile_id = coach and status = 'approved' for share;
    if not found then raise exception 'group coach is unavailable' using errcode = 'P0001'; end if;
  end if;
  perform 1 from app.coach_profiles where run_id = dataset and profile_id = coach and (not require_visible or visibility = 'visible') for share;
  if not found then raise exception 'group coach is unavailable' using errcode = 'P0001'; end if;
end;
$$;
create function app.group_reconcile_session(requested_id uuid) returns app.coach_group_sessions
language plpgsql set search_path = '' as $$
declare activity app.coach_group_sessions; checked_at timestamptz;
begin
  select * into activity from app.coach_group_sessions where id = requested_id for update;
  if not found then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
  checked_at := clock_timestamp();
  if activity.status = 'open' and activity.decision_deadline_at <= checked_at then
    update app.coach_group_sessions set status = 'not-confirmed',closed_at = checked_at,updated_at = checked_at,revision = revision + 1 where id = requested_id returning * into activity;
    update app.coach_group_registrations set status = 'session-not-confirmed',resolved_at = checked_at where session_id = requested_id and status = 'active';
  end if;
  return activity;
end;
$$;

create function app.group_session_projection(requested_id uuid, actor uuid default null) returns jsonb
language sql set search_path = '' as $$
  select jsonb_build_object(
    'id',s.id,'slug',s.slug,'title',s.title,'description',s.description,'discipline',s.discipline,'intendedLevel',s.intended_level,
    'venue',s.venue_snapshot,'startsAt',s.starts_at,'endsAt',s.ends_at,'decisionDeadlineAt',s.decision_deadline_at,
    'minimumParticipants',s.minimum_participants,'maximumParticipants',s.maximum_participants,'priceCents',s.price_cents,'currency',s.currency,
    'status',s.status,'displayStatus',case when s.status = 'confirmed' and s.ends_at <= clock_timestamp() then 'ended' else s.status end,
    'revision',s.revision,'createdAt',s.created_at,'updatedAt',s.updated_at,'publishedAt',s.published_at,'confirmedAt',s.confirmed_at,'closedAt',s.closed_at,
    'coach',jsonb_build_object('slug',p.public_slug,'name',p.display_name,'trustKind',app.coach_trust_kind(p.profile_id,p.is_demo)),
    'participantCount',(select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active'),
    'canJoin',s.status in ('open','confirmed') and s.starts_at > clock_timestamp() and s.decision_deadline_at > clock_timestamp()
      and app.group_coach_enabled(s.run_id,s.coach_profile_id,true) and (actor is null or actor <> s.coach_profile_id)
      and not exists(select 1 from app.coach_group_registrations where session_id = s.id and athlete_profile_id = actor and status = 'active')
      and (select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active') < s.maximum_participants,
    'canConfirm',coalesce(actor = s.coach_profile_id,false) and s.status = 'open' and s.decision_deadline_at > clock_timestamp()
      and app.group_coach_enabled(s.run_id,s.coach_profile_id,true)
      and (select count(*) from app.coach_group_registrations where session_id = s.id and status = 'active') >= s.minimum_participants,
    'canCancel',coalesce(actor = s.coach_profile_id,false) and s.status in ('open','confirmed') and s.starts_at > clock_timestamp(),
    'canEdit',coalesce(actor = s.coach_profile_id,false) and s.status = 'draft' and app.group_coach_enabled(s.run_id,s.coach_profile_id,false)
  ) from app.coach_group_sessions s join app.coach_profiles p on p.run_id = s.run_id and p.profile_id = s.coach_profile_id where s.id = requested_id;
$$;
create function app.group_registration_projection(requested_id uuid) returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object('id',r.id,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at,
    'canWithdraw',r.status = 'active' and s.starts_at > clock_timestamp())
  from app.coach_group_registrations r join app.coach_group_sessions s on s.id = r.session_id where r.id = requested_id;
$$;
create function app.group_page(entries jsonb, page_size integer) returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object('items',coalesce((select jsonb_agg(value->'item' order by ordinality) from jsonb_array_elements(coalesce(entries,'[]')) with ordinality where ordinality <= page_size),'[]'),
    'nextCursor',case when jsonb_array_length(coalesce(entries,'[]')) > page_size then entries->(page_size - 1)->'cursor' else null end);
$$;

create function app.group_session_command(action text, args jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; dataset uuid; activity app.coach_group_sessions; registration app.coach_group_registrations;
  location app.coach_training_locations; requested_id uuid; expected_revision integer; checked_at timestamptz; entries jsonb; result jsonb;
  after_at timestamptz; after_id uuid; candidate uuid; proposed app.coach_group_sessions;
begin
  if not app.authorized_actor_context_valid(null,null,null) or jsonb_typeof(args) is distinct from 'object' or pg_column_size(args) > 16384 then
    raise exception 'group operation is unavailable' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id',true)::uuid;
  dataset := current_setting('app.current_run_id',true)::uuid;
  perform app.group_session_flags(true);
  requested_id := (args->>'id')::uuid;
  after_at := (args->'after'->>'at')::timestamptz; after_id := (args->'after'->>'id')::uuid;
  if (after_at is null) <> (after_id is null) or (after_at is not null and not isfinite(after_at)) then raise exception 'group cursor is invalid' using errcode = 'P0001'; end if;

  if action = 'save-draft' then
    if requested_id is null then raise exception 'group draft identity is required' using errcode = 'P0001'; end if;
    perform app.group_lock_coach(dataset,actor,false);
    select * into location from app.coach_training_locations where id = (args->>'locationId')::uuid and run_id = dataset and profile_id = actor and status = 'active' for share;
    if not found then raise exception 'group location is unavailable' using errcode = 'P0001'; end if;
    if not exists(select 1 from app.coach_profile_disciplines where run_id = dataset and profile_id = actor and discipline = args->>'discipline') then raise exception 'group discipline is unavailable' using errcode = 'P0001'; end if;
    proposed.id := requested_id; proposed.run_id := dataset; proposed.coach_profile_id := actor;
    proposed.slug := 'group-' || replace(requested_id::text,'-','');
    proposed.title := btrim(args->>'title'); proposed.description := btrim(args->>'description'); proposed.discipline := args->>'discipline'; proposed.intended_level := btrim(args->>'intendedLevel');
    proposed.training_location_id := location.id;
    proposed.venue_snapshot := jsonb_build_object('id',location.id,'name',location.public_name,'label',location.public_location_label,'kind',location.location_kind,'latitude',location.latitude,'longitude',location.longitude);
    proposed.starts_at := (args->>'startsAt')::timestamptz; proposed.ends_at := (args->>'endsAt')::timestamptz; proposed.decision_deadline_at := (args->>'decisionDeadlineAt')::timestamptz;
    proposed.minimum_participants := (args->>'minimumParticipants')::smallint; proposed.maximum_participants := (args->>'maximumParticipants')::smallint; proposed.price_cents := (args->>'priceCents')::integer;
    if proposed.decision_deadline_at <= clock_timestamp() or not app.coach_local_time_is_unambiguous(proposed.starts_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(proposed.ends_at at time zone 'Europe/Berlin','Europe/Berlin')
      or not app.coach_local_time_is_unambiguous(proposed.decision_deadline_at at time zone 'Europe/Berlin','Europe/Berlin') then
      raise exception 'group time is unavailable or ambiguous' using errcode = 'P0001';
    end if;
    select * into activity from app.coach_group_sessions where id = requested_id for update;
    expected_revision := (args->>'expectedRevision')::integer;
    if found then
      if activity.run_id <> dataset or activity.coach_profile_id <> actor or activity.status <> 'draft' then raise exception 'group draft is unavailable' using errcode = 'P0001'; end if;
      if expected_revision is null and (activity.title,activity.description,activity.discipline,activity.intended_level,activity.training_location_id,activity.starts_at,activity.ends_at,activity.decision_deadline_at,activity.minimum_participants,activity.maximum_participants,activity.price_cents)
        is not distinct from (proposed.title,proposed.description,proposed.discipline,proposed.intended_level,proposed.training_location_id,proposed.starts_at,proposed.ends_at,proposed.decision_deadline_at,proposed.minimum_participants,proposed.maximum_participants,proposed.price_cents) then
        result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
      else
        if expected_revision is distinct from activity.revision then raise exception 'group draft changed' using errcode = 'P0001'; end if;
        update app.coach_group_sessions set title = proposed.title,description = proposed.description,discipline = proposed.discipline,intended_level = proposed.intended_level,
          training_location_id = proposed.training_location_id,venue_snapshot = proposed.venue_snapshot,starts_at = proposed.starts_at,ends_at = proposed.ends_at,decision_deadline_at = proposed.decision_deadline_at,
          minimum_participants = proposed.minimum_participants,maximum_participants = proposed.maximum_participants,price_cents = proposed.price_cents,revision = revision + 1,updated_at = clock_timestamp() where id = requested_id;
        result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
      end if;
    else
      if expected_revision is not null then raise exception 'group draft changed' using errcode = 'P0001'; end if;
      insert into app.coach_group_sessions(id,run_id,coach_profile_id,slug,title,description,discipline,intended_level,training_location_id,venue_snapshot,starts_at,ends_at,decision_deadline_at,minimum_participants,maximum_participants,price_cents)
        values(proposed.id,proposed.run_id,proposed.coach_profile_id,proposed.slug,proposed.title,proposed.description,proposed.discipline,proposed.intended_level,proposed.training_location_id,proposed.venue_snapshot,proposed.starts_at,proposed.ends_at,proposed.decision_deadline_at,proposed.minimum_participants,proposed.maximum_participants,proposed.price_cents);
      result := jsonb_build_object('outcome','saved','session',app.group_session_projection(requested_id,actor));
    end if;
  elsif action in ('detail','delete-draft','join','withdraw','confirm','cancel','roster') then
    select * into activity from app.coach_group_sessions where id = requested_id and run_id = dataset;
    if not found then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
    if (action = 'confirm' and activity.status = 'open') or (action = 'join' and not exists(
      select 1 from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor
        and (id = (args->>'registrationId')::uuid or status = 'active')
    )) then perform app.group_lock_coach(dataset,activity.coach_profile_id,true); end if;
    activity := app.group_reconcile_session(requested_id);
    checked_at := clock_timestamp();
    if action = 'detail' then
      if activity.coach_profile_id <> actor and not exists(select 1 from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor)
        and (activity.status = 'draft' or not app.group_coach_enabled(dataset,activity.coach_profile_id,true)) then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
      select * into registration from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor order by created_at desc,id desc limit 1;
      result := jsonb_build_object('session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    elsif action = 'delete-draft' then
      if activity.coach_profile_id <> actor or activity.status <> 'draft' or activity.revision is distinct from (args->>'expectedRevision')::integer then raise exception 'group draft changed' using errcode = 'P0001'; end if;
      delete from app.coach_group_sessions where id = requested_id;
      result := jsonb_build_object('outcome','deleted');
    elsif action = 'roster' then
      if activity.coach_profile_id <> actor then raise exception 'group roster is unavailable' using errcode = 'P0001'; end if;
      select jsonb_agg(jsonb_build_object('item',jsonb_build_object('id',r.id,'name',p.display_name,'initials',p.initials,'status',r.status,'createdAt',r.created_at,'resolvedAt',r.resolved_at),
        'cursor',jsonb_build_object('at',r.created_at,'id',r.id)) order by r.created_at,r.id) into entries
        from (select * from app.coach_group_registrations where session_id = requested_id and (after_at is null or (created_at,id) > (after_at,after_id)) order by created_at,id limit 51) r join app.profiles p on p.id = r.athlete_profile_id;
      result := app.group_page(entries,50);
    elsif action = 'join' then
      if activity.coach_profile_id = actor then raise exception 'group session is unavailable' using errcode = 'P0001'; end if;
      select * into registration from app.coach_group_registrations where id = (args->>'registrationId')::uuid;
      if found then
        if registration.session_id <> requested_id or registration.athlete_profile_id <> actor or registration.run_id <> dataset then raise exception 'group registration changed' using errcode = 'P0001'; end if;
      else
        select * into registration from app.coach_group_registrations where session_id = requested_id and athlete_profile_id = actor and status = 'active';
        if not found and activity.status in ('open','confirmed') and checked_at < activity.decision_deadline_at and checked_at < activity.starts_at then
          insert into app.coach_group_registrations(id,run_id,session_id,athlete_profile_id) values((args->>'registrationId')::uuid,dataset,requested_id,actor) returning * into registration;
        end if;
      end if;
      result := jsonb_build_object('outcome',case when registration.status = 'active' then 'joined' else 'unavailable' end,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    elsif action = 'withdraw' then
      select * into registration from app.coach_group_registrations where id = (args->>'registrationId')::uuid and session_id = requested_id and athlete_profile_id = actor;
      if not found then raise exception 'group registration is unavailable' using errcode = 'P0001'; end if;
      if registration.status = 'active' then
        if checked_at >= activity.starts_at then raise exception 'group registration is elapsed' using errcode = 'P0001'; end if;
        update app.coach_group_registrations set status = 'withdrawn',resolved_at = checked_at where id = registration.id returning * into registration;
      end if;
      result := jsonb_build_object('outcome',case when registration.status = 'withdrawn' then 'withdrawn' else 'unavailable' end,'session',app.group_session_projection(requested_id,actor),'registration',app.group_registration_projection(registration.id));
    else
      if activity.coach_profile_id <> actor then raise exception 'group decision is unavailable' using errcode = 'P0001'; end if;
      if action = 'confirm' then
        if activity.status = 'confirmed' then null;
        elsif activity.status <> 'open' or checked_at >= activity.decision_deadline_at then
          result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor));
        else
          if (select count(*) from app.coach_group_registrations where session_id = requested_id and status = 'active') < activity.minimum_participants then raise exception 'group minimum is not met' using errcode = 'P0001'; end if;
          update app.coach_group_sessions set status = 'confirmed',confirmed_at = checked_at,confirmed_by_profile_id = actor,updated_at = checked_at,revision = revision + 1 where id = requested_id;
        end if;
      elsif activity.status = 'cancelled' then null;
      elsif activity.status not in ('open','confirmed') or checked_at >= activity.starts_at then
        result := jsonb_build_object('outcome','unavailable','session',app.group_session_projection(requested_id,actor));
      else
        update app.coach_group_sessions set status = 'cancelled',closed_at = checked_at,closed_by_profile_id = actor,updated_at = checked_at,revision = revision + 1 where id = requested_id;
        update app.coach_group_registrations set status = 'session-cancelled',resolved_at = checked_at where session_id = requested_id and status = 'active';
      end if;
      result := coalesce(result,jsonb_build_object('outcome',case when action = 'confirm' then 'confirmed' else 'cancelled' end,'session',app.group_session_projection(requested_id,actor)));
    end if;
  elsif action in ('owner-list','registrations') then
    -- Reconcile the bounded requested page, not an unrelated first batch of
    -- expired records. Every returned item must reflect its effective deadline.
    for candidate in select s.id from app.coach_group_sessions s where s.status = 'open' and s.decision_deadline_at <= clock_timestamp() and (
      (action = 'owner-list' and s.id in (select id from app.coach_group_sessions where run_id = dataset and coach_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21))
      or (action = 'registrations' and s.id in (select session_id from app.coach_group_registrations where run_id = dataset and athlete_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21))
    ) order by s.id loop
      perform app.group_reconcile_session(candidate);
    end loop;
    if action = 'owner-list' then
      select jsonb_agg(jsonb_build_object('item',app.group_session_projection(s.id,actor),'cursor',jsonb_build_object('at',s.created_at,'id',s.id)) order by s.created_at desc,s.id desc) into entries
        from (select * from app.coach_group_sessions where run_id = dataset and coach_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21) s;
    else
      select jsonb_agg(jsonb_build_object('item',jsonb_build_object('session',app.group_session_projection(r.session_id,actor),'registration',app.group_registration_projection(r.id)),
        'cursor',jsonb_build_object('at',r.created_at,'id',r.id)) order by r.created_at desc,r.id desc) into entries
        from (select * from app.coach_group_registrations where run_id = dataset and athlete_profile_id = actor and (after_at is null or (created_at,id) < (after_at,after_id)) order by created_at desc,id desc limit 21) r;
    end if;
    result := app.group_page(entries,20);
  else
    raise exception 'group action is unavailable' using errcode = 'P0001';
  end if;
  perform app.group_session_flags(false);
  return result;
end;
$$;

create function app.public_group_sessions(action text, args jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
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

-- Private helpers have no public/runtime execution grants. Definer entry points
-- validate actor/dataset or restrict reads to the one active public catalogue.
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('group_session_flags','guard_group_session','guard_group_registration','group_coach_enabled','group_lock_coach','group_reconcile_session','group_session_projection','group_registration_projection','group_page','group_session_command','public_group_sessions') loop
    execute format('alter function %s owner to app_owner',fn.signature);
    execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime',fn.signature);
  end loop;
end $$;
grant execute on function app.group_session_command(text,jsonb), app.public_group_sessions(text,jsonb) to app_runtime;
