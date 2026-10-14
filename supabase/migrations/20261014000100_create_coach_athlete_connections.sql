-- Stable directed pair identity and explicit, retained consent attempts.
-- This migration never alters or deletes booking/request/conversation records.
create table app.coach_athlete_connection_pairs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  coach_profile_id uuid not null,
  athlete_profile_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (run_id, id),
  unique (run_id, coach_profile_id, athlete_profile_id),
  foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id) on delete restrict,
  foreign key (run_id, athlete_profile_id)
    references app.demo_run_participants (run_id, profile_id) on delete restrict,
  check (coach_profile_id <> athlete_profile_id)
);
create table app.coach_athlete_connection_attempts (
  id uuid primary key,
  run_id uuid not null,
  pair_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  sender_profile_id uuid not null,
  recipient_profile_id uuid not null,
  status text not null default 'pending',
  decided_by_profile_id uuid,
  decided_at timestamptz,
  removed_by_profile_id uuid,
  removed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (pair_id, attempt_number),
  foreign key (run_id, pair_id)
    references app.coach_athlete_connection_pairs (run_id, id) on delete restrict,
  foreign key (run_id, sender_profile_id)
    references app.demo_run_participants (run_id, profile_id) on delete restrict,
  foreign key (run_id, recipient_profile_id)
    references app.demo_run_participants (run_id, profile_id) on delete restrict,
  foreign key (run_id, decided_by_profile_id)
    references app.demo_run_participants (run_id, profile_id) on delete restrict,
  foreign key (run_id, removed_by_profile_id)
    references app.demo_run_participants (run_id, profile_id) on delete restrict,
  check (sender_profile_id <> recipient_profile_id),
  check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'removed')),
  check ((status = 'pending') = (decided_at is null and decided_by_profile_id is null)),
  check ((decided_at is null) = (decided_by_profile_id is null)),
  check (status not in ('accepted', 'declined', 'removed') or decided_by_profile_id = recipient_profile_id),
  check (status <> 'withdrawn' or decided_by_profile_id = sender_profile_id),
  check ((status = 'removed') = (removed_at is not null and removed_by_profile_id is not null)),
  check ((removed_at is null) = (removed_by_profile_id is null)),
  check (removed_by_profile_id is null or removed_by_profile_id in (sender_profile_id, recipient_profile_id))
);
create unique index coach_athlete_connections_one_active_pair
  on app.coach_athlete_connection_attempts (pair_id)
  where status in ('pending', 'accepted');
create index coach_athlete_connection_attempts_page
  on app.coach_athlete_connection_attempts (run_id, created_at desc, id desc);
create index coach_athlete_connection_pairs_coach
  on app.coach_athlete_connection_pairs (run_id, coach_profile_id);
create index coach_athlete_connection_pairs_athlete
  on app.coach_athlete_connection_pairs (run_id, athlete_profile_id);
create trigger coach_athlete_connection_attempts_updated_at
  before update on app.coach_athlete_connection_attempts
  for each row execute function app.set_updated_at();

alter table app.coach_athlete_connection_pairs owner to app_owner;
alter table app.coach_athlete_connection_attempts owner to app_owner;
alter table app.coach_athlete_connection_pairs enable row level security;
alter table app.coach_athlete_connection_pairs force row level security;
alter table app.coach_athlete_connection_attempts enable row level security;
alter table app.coach_athlete_connection_attempts force row level security;
revoke all on app.coach_athlete_connection_pairs, app.coach_athlete_connection_attempts
  from public, anon, authenticated, service_role, app_runtime;
create policy connection_pairs_management on app.coach_athlete_connection_pairs
  for all to app_owner
  using (current_setting('app.coach_connection_management', true) = 'on')
  with check (current_setting('app.coach_connection_management', true) = 'on');
create policy connection_attempts_management on app.coach_athlete_connection_attempts
  for all to app_owner
  using (current_setting('app.coach_connection_management', true) = 'on')
  with check (current_setting('app.coach_connection_management', true) = 'on');
create policy connection_participants_lookup on app.demo_run_participants
  for select to app_owner using (
    current_setting('app.coach_connection_management', true) = 'on'
    and run_id::text = current_setting('app.current_run_id', true)
  );

-- Preserve identity and terminal attempts even inside trusted application work.
create function app.guard_connection_pair() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' or (tg_op = 'DELETE' and current_user = 'app_owner') then
    raise exception 'connection pair identity must be retained' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_connection_pair before update or delete on app.coach_athlete_connection_pairs
  for each row execute function app.guard_connection_pair();
create function app.guard_connection_attempt() returns trigger
language plpgsql set search_path = '' as $$
declare pair app.coach_athlete_connection_pairs%rowtype;
begin
  if tg_op = 'DELETE' then
    if current_user = 'app_owner' then raise exception 'connection attempt must be retained' using errcode = 'P0001'; end if;
    return old;
  end if;
  select p.* into pair from app.coach_athlete_connection_pairs p where p.id = new.pair_id;
  if not found or new.run_id <> pair.run_id
    or new.sender_profile_id not in (pair.coach_profile_id, pair.athlete_profile_id)
    or new.recipient_profile_id not in (pair.coach_profile_id, pair.athlete_profile_id) then
    raise exception 'connection participants are invalid' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.run_id,new.pair_id,new.attempt_number,new.sender_profile_id,new.recipient_profile_id,new.created_at)
      is distinct from (old.id,old.run_id,old.pair_id,old.attempt_number,old.sender_profile_id,old.recipient_profile_id,old.created_at)
      or not ((old.status = 'pending' and new.status in ('accepted','declined','withdrawn')) or (old.status = 'accepted' and new.status = 'removed'))
      or (old.status = 'accepted' and (new.decided_at,new.decided_by_profile_id) is distinct from (old.decided_at,old.decided_by_profile_id)) then
      raise exception 'connection transition conflicts with retained state' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_connection_attempt before insert or update or delete on app.coach_athlete_connection_attempts
  for each row execute function app.guard_connection_attempt();

-- Private helper; flags are transaction-local and always cleared by entry points.
create function app.connection_access_flags(enabled boolean) returns void
language plpgsql set search_path = '' as $$
declare flag text;
begin
  foreach flag in array array[
    'app.coach_connection_management', 'app.coach_profile_management',
    'app.coach_application_management', 'app.coach_booking_management',
    'app.coach_availability_management',
    'app.coach_booking_request_management', 'app.profile_media_management'
  ] loop
    perform pg_catalog.set_config(flag, case when enabled then 'on' else 'off' end, true);
  end loop;
end;
$$;

create function app.connection_pair_eligible(requested_pair app.coach_athlete_connection_pairs)
returns boolean language sql set search_path = '' as $$
  select exists (
    select 1 from app.coach_profiles coach
    join app.profiles coach_account on coach_account.id = coach.profile_id
    join app.demo_run_participants coach_member on coach_member.run_id = coach.run_id
      and coach_member.profile_id = coach.profile_id and coach_member.status = 'active'
    join app.demo_run_participants athlete_member on athlete_member.run_id = coach.run_id
      and athlete_member.profile_id = requested_pair.athlete_profile_id and athlete_member.status = 'active'
    join app.profiles athlete on athlete.id = athlete_member.profile_id
    left join app.coach_applications application on application.profile_id = coach.profile_id
    where coach.run_id = requested_pair.run_id and coach.profile_id = requested_pair.coach_profile_id
      and (coach.is_demo or application.status = 'approved')
      and coach_account.auth_user_id is not null and athlete.auth_user_id is not null
      and exists (
        select 1 from app.coach_private_bookings booking
        where booking.run_id = requested_pair.run_id
          and booking.coach_profile_id = requested_pair.coach_profile_id
          and booking.client_profile_id = requested_pair.athlete_profile_id
          and booking.credit_projection_id is null and booking.status in ('confirmed', 'completed')
      )
  )
$$;

-- Match application-review lock order, then lock one qualifying booking against
-- the existing cancellation FOR UPDATE. Re-evaluation after a wait is essential.
create function app.lock_connection_eligibility(requested_pair app.coach_athlete_connection_pairs)
returns void language plpgsql set search_path = '' as $$
declare demo_coach boolean;
begin
  select coach.is_demo into demo_coach from app.coach_profiles coach
    where coach.run_id = requested_pair.run_id and coach.profile_id = requested_pair.coach_profile_id;
  if demo_coach is not true then
    perform 1 from app.coach_applications application
      where application.profile_id = requested_pair.coach_profile_id and application.status = 'approved'
      for share;
    if not found then raise exception 'connection is not eligible' using errcode = 'P0001'; end if;
  end if;
  perform 1 from app.coach_profiles coach
    where coach.run_id = requested_pair.run_id and coach.profile_id = requested_pair.coach_profile_id for share;
  perform 1 from app.coach_private_bookings booking
    where booking.run_id = requested_pair.run_id
      and booking.coach_profile_id = requested_pair.coach_profile_id
      and booking.client_profile_id = requested_pair.athlete_profile_id
      and booking.credit_projection_id is null and booking.status in ('confirmed', 'completed')
    order by booking.id limit 1 for share;
  if not found or not app.connection_pair_eligible(requested_pair) then
    raise exception 'connection is not eligible' using errcode = 'P0001';
  end if;
end;
$$;

create function app.connection_attempt_projection(requested_id uuid) returns jsonb
language sql set search_path = '' as $$
  select jsonb_build_object(
    'id', attempt.id, 'pairId', pair.id, 'attemptNumber', attempt.attempt_number,
    'coachProfileId', pair.coach_profile_id, 'athleteProfileId', pair.athlete_profile_id,
    'senderProfileId', attempt.sender_profile_id, 'recipientProfileId', attempt.recipient_profile_id,
    'status', attempt.status, 'createdAt', attempt.created_at, 'updatedAt', attempt.updated_at,
    'decidedAt', attempt.decided_at, 'removedAt', attempt.removed_at,
    'coachDisplayName', coach.display_name, 'athleteDisplayName', athlete.display_name,
    'coachSlug', coach.public_slug,
    'coachPublic', coalesce(coach.visibility = 'visible' and (coach.is_demo or application.status = 'approved') and app.coach_has_publishable_primary_location(coach.run_id, coach.profile_id), false),
    'coachPortrait', case when coach.visibility = 'visible' and (coach.is_demo or application.status = 'approved') and app.coach_has_publishable_primary_location(coach.run_id, coach.profile_id)
      then jsonb_build_object('source', coach.portrait_source, 'path', coach.portrait_path, 'updatedAt', coach.portrait_updated_at)
      else null end,
    'athleteAvatarUpdatedAt', case when attempt.status = 'accepted'
      and pair.coach_profile_id::text = current_setting('app.current_profile_id', true)
      then athlete.avatar_updated_at else null end,
    'canAccept', attempt.status = 'pending' and attempt.recipient_profile_id::text = current_setting('app.current_profile_id', true)
      and app.connection_pair_eligible(pair),
    'canDecline', attempt.status = 'pending' and attempt.recipient_profile_id::text = current_setting('app.current_profile_id', true),
    'canWithdraw', attempt.status = 'pending' and attempt.sender_profile_id::text = current_setting('app.current_profile_id', true),
    'canDisconnect', attempt.status = 'accepted'
  )
  from app.coach_athlete_connection_attempts attempt
  join app.coach_athlete_connection_pairs pair on pair.id = attempt.pair_id
  join app.coach_profiles coach on coach.run_id = pair.run_id and coach.profile_id = pair.coach_profile_id
  join app.profiles athlete on athlete.id = pair.athlete_profile_id
  left join app.coach_applications application on application.profile_id = coach.profile_id
  where attempt.id = requested_id and pair.run_id::text = current_setting('app.current_run_id', true)
    and current_setting('app.current_profile_id', true)::uuid in (pair.coach_profile_id, pair.athlete_profile_id)
$$;

create function app.send_coach_athlete_connection(requested_booking_id uuid, requested_attempt_id uuid, expected_previous_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid; dataset uuid; booking app.coach_private_bookings%rowtype;
  pair app.coach_athlete_connection_pairs%rowtype;
  prior app.coach_athlete_connection_attempts%rowtype; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null or requested_attempt_id is null then
    raise exception 'connection operation is invalid' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id', true)::uuid;
  dataset := current_setting('app.current_run_id', true)::uuid;
  perform app.connection_access_flags(true);
  select b.* into booking from app.coach_private_bookings b
    where b.id = requested_booking_id and b.run_id = dataset and b.credit_projection_id is null
      and actor in (b.coach_profile_id, b.client_profile_id) and b.coach_profile_id <> b.client_profile_id;
  if not found then raise exception 'connection operation is unavailable' using errcode = 'P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'coach-athlete-connection:' || dataset::text || ':' || booking.coach_profile_id::text || ':' || booking.client_profile_id::text, 0));
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.run_id = dataset and p.coach_profile_id = booking.coach_profile_id and p.athlete_profile_id = booking.client_profile_id;
  select a.* into prior from app.coach_athlete_connection_attempts a where a.id = requested_attempt_id;
  if found then
    if prior.pair_id is distinct from pair.id or prior.sender_profile_id <> actor then
      raise exception 'connection operation conflicts with current state' using errcode = 'P0001';
    end if;
    result := app.connection_attempt_projection(prior.id);
    perform app.connection_access_flags(false); return result;
  end if;
  select a.* into prior from app.coach_athlete_connection_attempts a
    where a.pair_id = pair.id order by a.attempt_number desc limit 1;
  if prior.status in ('pending', 'accepted') then
    result := app.connection_attempt_projection(prior.id);
    perform app.connection_access_flags(false); return result;
  end if;
  if prior.id is distinct from expected_previous_id then
    raise exception 'connection operation conflicts with current state' using errcode = 'P0001';
  end if;
  if pair.id is null then
    pair.run_id := dataset; pair.coach_profile_id := booking.coach_profile_id; pair.athlete_profile_id := booking.client_profile_id;
  end if;
  perform app.lock_connection_eligibility(pair);
  if pair.id is null then
    insert into app.coach_athlete_connection_pairs (run_id, coach_profile_id, athlete_profile_id)
      values (dataset, booking.coach_profile_id, booking.client_profile_id) returning * into pair;
  end if;
  insert into app.coach_athlete_connection_attempts
    (id, run_id, pair_id, attempt_number, sender_profile_id, recipient_profile_id)
    values (requested_attempt_id, dataset, pair.id, coalesce(prior.attempt_number, 0) + 1, actor,
      case when actor = pair.coach_profile_id then pair.athlete_profile_id else pair.coach_profile_id end);
  result := app.connection_attempt_projection(requested_attempt_id);
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;

create function app.decide_coach_athlete_connection(requested_id uuid, requested_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid; attempt app.coach_athlete_connection_attempts%rowtype;
  pair app.coach_athlete_connection_pairs%rowtype; wanted text; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_id is null
    or requested_action not in ('accept', 'decline', 'withdraw', 'disconnect') or requested_action is null then
    raise exception 'connection decision is invalid' using errcode = 'P0001';
  end if;
  actor := current_setting('app.current_profile_id', true)::uuid;
  perform app.connection_access_flags(true);
  select p.* into pair from app.coach_athlete_connection_pairs p
    join app.coach_athlete_connection_attempts a on a.pair_id = p.id
    where a.id = requested_id and p.run_id::text = current_setting('app.current_run_id', true)
      and actor in (p.coach_profile_id, p.athlete_profile_id);
  if not found then raise exception 'connection decision is unavailable' using errcode = 'P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'coach-athlete-connection:' || pair.run_id::text || ':' || pair.coach_profile_id::text || ':' || pair.athlete_profile_id::text, 0));
  select a.* into attempt from app.coach_athlete_connection_attempts a where a.id = requested_id for update;
  if (requested_action in ('accept', 'decline') and actor <> attempt.recipient_profile_id)
    or (requested_action = 'withdraw' and actor <> attempt.sender_profile_id) then
    raise exception 'connection decision is unavailable' using errcode = 'P0001';
  end if;
  wanted := case requested_action when 'accept' then 'accepted' when 'decline' then 'declined'
    when 'withdraw' then 'withdrawn' else 'removed' end;
  if attempt.status = wanted then
    result := app.connection_attempt_projection(attempt.id);
    perform app.connection_access_flags(false); return result;
  end if;
  if (requested_action = 'disconnect' and attempt.status <> 'accepted')
    or (requested_action <> 'disconnect' and attempt.status <> 'pending') then
    raise exception 'connection decision conflicts with current state' using errcode = 'P0001';
  end if;
  if requested_action = 'accept' then perform app.lock_connection_eligibility(pair); end if;
  if requested_action = 'disconnect' then
    update app.coach_athlete_connection_attempts set status = 'removed',
      removed_at = statement_timestamp(), removed_by_profile_id = actor where id = requested_id;
  else
    update app.coach_athlete_connection_attempts set status = wanted,
      decided_at = statement_timestamp(), decided_by_profile_id = actor where id = requested_id;
  end if;
  result := app.connection_attempt_projection(requested_id);
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;

create function app.current_booking_connection_context(requested_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare booking app.coach_private_bookings%rowtype; pair app.coach_athlete_connection_pairs%rowtype;
  latest app.coach_athlete_connection_attempts%rowtype; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_booking_id is null then
    raise exception 'connection context is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  select b.* into booking from app.coach_private_bookings b
    where b.id = requested_booking_id and b.run_id::text = current_setting('app.current_run_id', true)
      and b.credit_projection_id is null and b.coach_profile_id <> b.client_profile_id
      and current_setting('app.current_profile_id', true)::uuid in (b.coach_profile_id, b.client_profile_id);
  if not found then raise exception 'connection context is unavailable' using errcode = 'P0001'; end if;
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.run_id = booking.run_id and p.coach_profile_id = booking.coach_profile_id and p.athlete_profile_id = booking.client_profile_id;
  if pair.id is null then
    pair.run_id := booking.run_id; pair.coach_profile_id := booking.coach_profile_id; pair.athlete_profile_id := booking.client_profile_id;
  end if;
  select a.* into latest from app.coach_athlete_connection_attempts a where a.pair_id = pair.id order by a.attempt_number desc limit 1;
  result := jsonb_build_object('connection', app.connection_attempt_projection(latest.id),
    'canSend', coalesce(latest.status not in ('pending', 'accepted'), true) and app.connection_pair_eligible(pair));
  perform app.connection_access_flags(false); return result;
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;

create function app.current_coach_athlete_connections(
  requested_role text, requested_section text, requested_limit integer,
  before_created_at timestamptz, before_id uuid
) returns table (projection jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_role is null or requested_role not in ('coach', 'athlete')
    or requested_section is null or requested_section not in ('incoming', 'outgoing', 'accepted', 'history')
    or requested_limit is null or requested_limit not between 1 and 51
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'connection page is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  return query select app.connection_attempt_projection(a.id)
    from app.coach_athlete_connection_attempts a join app.coach_athlete_connection_pairs p on p.id = a.pair_id
    where p.run_id::text = current_setting('app.current_run_id', true)
      and (case requested_role when 'coach' then p.coach_profile_id else p.athlete_profile_id end)::text = current_setting('app.current_profile_id', true)
      and case requested_section
        when 'incoming' then a.status = 'pending' and a.recipient_profile_id::text = current_setting('app.current_profile_id', true)
        when 'outgoing' then a.status = 'pending' and a.sender_profile_id::text = current_setting('app.current_profile_id', true)
        when 'accepted' then a.status = 'accepted' else a.status in ('declined', 'withdrawn', 'removed') end
      and (before_created_at is null or (a.created_at, a.id) < (before_created_at, before_id))
    order by a.created_at desc, a.id desc limit requested_limit;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;

create function app.current_connection_shared_history(
  requested_pair_id uuid, requested_limit integer, before_created_at timestamptz, before_id uuid
) returns table (projection jsonb)
language plpgsql security definer set search_path = '' as $$
declare pair app.coach_athlete_connection_pairs%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_pair_id is null
    or requested_limit is null or requested_limit not between 1 and 51
    or (before_created_at is null) <> (before_id is null) then
    raise exception 'connection history is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  select p.* into pair from app.coach_athlete_connection_pairs p
    where p.id = requested_pair_id and p.run_id::text = current_setting('app.current_run_id', true)
      and current_setting('app.current_profile_id', true)::uuid in (p.coach_profile_id, p.athlete_profile_id)
      and exists (select 1 from app.coach_athlete_connection_attempts a where a.pair_id = p.id and a.status = 'accepted');
  if not found then raise exception 'connection history is unavailable' using errcode = 'P0001'; end if;
  return query with history as (
    select r.id, r.created_at, r.id as request_id, b.id as booking_id,
      case when r.status = 'pending' and r.decision_deadline_at <= statement_timestamp() then 'expired' else r.status end as request_status,
      b.status as booking_status, r.scheduled_start_at, r.scheduled_end_at, r.coach_timezone,
      r.training_location_name, r.public_location_label
    from app.coach_booking_requests r
    left join app.coach_private_bookings b on b.id = r.accepted_booking_id and b.credit_projection_id is null
    where r.run_id = pair.run_id and r.coach_profile_id = pair.coach_profile_id and r.client_profile_id = pair.athlete_profile_id
    union all
    select b.id, b.created_at, null::uuid, b.id, null::text, b.status,
      b.scheduled_start_at, b.scheduled_end_at, slot.coach_timezone, coalesce(slot.training_location_name, slot.public_location_label), slot.public_location_label
    from app.coach_private_bookings b
    join app.coach_availability_slots slot on slot.run_id = b.run_id and slot.id = b.slot_id
    where b.run_id = pair.run_id and b.coach_profile_id = pair.coach_profile_id and b.client_profile_id = pair.athlete_profile_id
      and b.credit_projection_id is null
      and not exists (select 1 from app.coach_booking_requests r where r.accepted_booking_id = b.id)
  ) select jsonb_build_object(
    'id', h.id, 'requestId', h.request_id, 'bookingId', h.booking_id,
    'requestStatus', h.request_status, 'bookingStatus', h.booking_status,
    'createdAt', h.created_at, 'scheduledStartAt', h.scheduled_start_at, 'scheduledEndAt', h.scheduled_end_at,
    'coachTimezone', h.coach_timezone, 'trainingLocationName', h.training_location_name, 'publicLocationLabel', h.public_location_label
  ) from history h
    where before_created_at is null or (h.created_at, h.id) < (before_created_at, before_id)
    order by h.created_at desc, h.id desc limit requested_limit;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;

create function app.current_connection_athlete_avatar_reference(requested_id uuid)
returns table (athlete_profile_id uuid, avatar_storage_path text, avatar_updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not app.authorized_actor_context_valid(null, null, null) or requested_id is null then
    raise exception 'connection avatar is invalid' using errcode = 'P0001';
  end if;
  perform app.connection_access_flags(true);
  return query select p.athlete_profile_id, athlete.avatar_storage_path, athlete.avatar_updated_at
    from app.coach_athlete_connection_attempts a
    join app.coach_athlete_connection_pairs p on p.id = a.pair_id
    join app.profiles athlete on athlete.id = p.athlete_profile_id
    join app.demo_run_participants member on member.run_id = p.run_id and member.profile_id = p.athlete_profile_id and member.status = 'active'
    where a.id = requested_id and a.status = 'accepted'
      and p.run_id::text = current_setting('app.current_run_id', true)
      and p.coach_profile_id::text = current_setting('app.current_profile_id', true)
      and athlete.avatar_storage_path is not null and athlete.avatar_updated_at is not null;
  perform app.connection_access_flags(false);
exception when others then perform app.connection_access_flags(false); raise;
end;
$$;

-- Narrow Storage predicate: no private path escapes through application JSON.
create function app.current_storage_actor_can_read_connection_athlete_avatar(requested_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select requested_path is not null
    and requested_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    and exists (
      select 1 from app.coach_athlete_connection_pairs p
      join app.coach_athlete_connection_attempts a on a.pair_id = p.id and a.status = 'accepted'
      join app.profiles coach on coach.id = p.coach_profile_id and coach.auth_user_id = auth.uid()
      join app.profiles athlete on athlete.id = p.athlete_profile_id and athlete.avatar_storage_path = requested_path
      join app.demo_run_participants cm on cm.run_id = p.run_id and cm.profile_id = p.coach_profile_id and cm.status = 'active'
      join app.demo_run_participants am on am.run_id = p.run_id and am.profile_id = p.athlete_profile_id and am.status = 'active'
      join app.demo_runs dataset on dataset.id = p.run_id and dataset.status = 'active'
    )
$$;
create policy account_avatars_connected_coach_select on storage.objects
  for select to authenticated using (
    bucket_id = 'account-avatars' and app.current_storage_actor_can_read_connection_athlete_avatar(name)
  );

-- All helpers stay private; only the actor-checked entry points reach runtime.
do $$
declare signature text;
begin
  foreach signature in array array[
    'app.guard_connection_pair()', 'app.guard_connection_attempt()',
    'app.connection_access_flags(boolean)',
    'app.connection_pair_eligible(app.coach_athlete_connection_pairs)',
    'app.lock_connection_eligibility(app.coach_athlete_connection_pairs)',
    'app.connection_attempt_projection(uuid)',
    'app.current_booking_connection_context(uuid)',
    'app.send_coach_athlete_connection(uuid,uuid,uuid)',
    'app.decide_coach_athlete_connection(uuid,text)',
    'app.current_coach_athlete_connections(text,text,integer,timestamp with time zone,uuid)',
    'app.current_connection_shared_history(uuid,integer,timestamp with time zone,uuid)',
    'app.current_connection_athlete_avatar_reference(uuid)'
  ] loop
    execute format('alter function %s owner to app_owner', signature);
    execute format('revoke all on function %s from public, anon, authenticated, service_role, app_runtime', signature);
  end loop;
end;
$$;
grant execute on function app.current_booking_connection_context(uuid),
  app.send_coach_athlete_connection(uuid,uuid,uuid),
  app.decide_coach_athlete_connection(uuid,text),
  app.current_coach_athlete_connections(text,text,integer,timestamptz,uuid),
  app.current_connection_shared_history(uuid,integer,timestamptz,uuid),
  app.current_connection_athlete_avatar_reference(uuid) to app_runtime;
alter function app.current_storage_actor_can_read_connection_athlete_avatar(text) owner to postgres;
revoke all on function app.current_storage_actor_can_read_connection_athlete_avatar(text) from public, anon, service_role, app_runtime;
grant execute on function app.current_storage_actor_can_read_connection_athlete_avatar(text) to authenticated;
