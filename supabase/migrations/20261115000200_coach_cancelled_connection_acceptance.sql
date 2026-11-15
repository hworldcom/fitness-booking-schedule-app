-- MOV-239: a recipient coach may accept a retained pending connection after
-- its qualifying private session is cancelled. Sending and athlete acceptance
-- retain the existing confirmed/completed requirement. No data is rewritten.

CREATE OR REPLACE FUNCTION app.coach_connection_acceptance_eligible(requested_pair app.coach_athlete_connection_pairs) RETURNS boolean
    LANGUAGE sql
    SET search_path TO ''
    AS $$
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
          and booking.credit_projection_id is null and booking.status in ('confirmed', 'completed', 'cancelled')
      )
  )
$$;
ALTER FUNCTION app.coach_connection_acceptance_eligible(app.coach_athlete_connection_pairs) OWNER TO app_owner;
REVOKE ALL ON FUNCTION app.coach_connection_acceptance_eligible(app.coach_athlete_connection_pairs) FROM PUBLIC, anon, authenticated, app_runtime;

CREATE OR REPLACE FUNCTION app.lock_coach_connection_acceptance_eligibility(requested_pair app.coach_athlete_connection_pairs) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
      and booking.credit_projection_id is null and booking.status in ('confirmed', 'completed', 'cancelled')
    order by booking.id limit 1 for share;
  if not found or not app.coach_connection_acceptance_eligible(requested_pair) then
    raise exception 'connection is not eligible' using errcode = 'P0001';
  end if;
end;
$$;
ALTER FUNCTION app.lock_coach_connection_acceptance_eligibility(app.coach_athlete_connection_pairs) OWNER TO app_owner;
REVOKE ALL ON FUNCTION app.lock_coach_connection_acceptance_eligibility(app.coach_athlete_connection_pairs) FROM PUBLIC, anon, authenticated, app_runtime;

CREATE OR REPLACE FUNCTION app.connection_attempt_projection(requested_id uuid) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
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
      and case when attempt.recipient_profile_id = pair.coach_profile_id
        then app.coach_connection_acceptance_eligible(pair)
        else app.connection_pair_eligible(pair) end,
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
CREATE OR REPLACE FUNCTION app.decide_coach_athlete_connection(requested_id uuid, requested_action text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  if requested_action = 'accept' then
    if actor = pair.coach_profile_id then
      perform app.lock_coach_connection_acceptance_eligibility(pair);
    else
      perform app.lock_connection_eligibility(pair);
    end if;
  end if;
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
