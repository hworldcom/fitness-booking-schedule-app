-- MOV-115: Link conversation identities only to existing eligible profile routes.
-- Additive projection only; no data, table, owner or privilege changes.
create or replace function app.mail_conversation_projection(
  c app.message_conversations, actor uuid
) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'coachProfileId', c.coach_profile_id,
    'athleteProfileId', c.athlete_profile_id,
    'actorProfileId', actor,
    'counterpartName', case when actor = c.coach_profile_id
      then coalesce(athlete.chat_first_name, app.account_first_name(athlete.display_name))
      else coalesce(coach_account.chat_first_name, app.account_first_name(coach_account.display_name)) end,
    'role', case when actor = c.coach_profile_id then 'coach' else 'athlete' end,
    -- A conversation grants no public athlete identity or new relationship access.
    'counterpartProfileHref', case when actor = c.athlete_profile_id then
      case when app.coach_website_is_public(c.run_id,c.coach_profile_id)
        then '/coaches/' || coach.public_slug end
    when actor = c.coach_profile_id then (
      select '/coach/athletes/' || p.id::text
      from app.coach_athlete_connection_pairs p
      join app.coach_athlete_connection_attempts a on a.pair_id=p.id
      join app.demo_run_participants member
        on member.run_id=p.run_id and member.profile_id=p.athlete_profile_id
        and member.status='active'
      where p.run_id=c.run_id and p.coach_profile_id=c.coach_profile_id
        and p.athlete_profile_id=c.athlete_profile_id and a.status='accepted'
        and exists(select 1 from app.coach_private_bookings b
          where b.run_id=p.run_id and b.coach_profile_id=p.coach_profile_id
            and b.client_profile_id=p.athlete_profile_id)
      order by a.created_at desc,a.id desc limit 1
    ) end,
    -- References only: private avatar paths never enter message JSON.
    'counterpartMedia', case when actor = c.athlete_profile_id then
      case when coach.portrait_source is not null then jsonb_build_object(
        'kind', 'coach-portrait', 'source', coach.portrait_source,
        'path', coach.portrait_path, 'updatedAt', coach.portrait_updated_at
      ) end
    when actor = c.coach_profile_id and athlete.avatar_storage_path is not null then
      coalesce((
        select jsonb_build_object('kind', 'connection-avatar',
          'id', a.id, 'updatedAt', athlete.avatar_updated_at)
        from app.coach_athlete_connection_pairs p
        join app.coach_athlete_connection_attempts a on a.pair_id = p.id
        join app.demo_run_participants member
          on member.run_id = p.run_id and member.profile_id = p.athlete_profile_id
          and member.status = 'active'
        where p.run_id = c.run_id and p.coach_profile_id = c.coach_profile_id
          and p.athlete_profile_id = c.athlete_profile_id and a.status = 'accepted'
        order by a.created_at desc, a.id desc limit 1
      ), (
        select jsonb_build_object('kind', 'request-avatar',
          'id', r.id, 'updatedAt', athlete.avatar_updated_at)
        from app.coach_booking_requests r
        where r.run_id = c.run_id and r.coach_profile_id = c.coach_profile_id
          and r.client_profile_id = c.athlete_profile_id
        order by r.created_at desc, r.id desc limit 1
      )) end,
    'activityAt', c.activity_at,
    'canSendGeneral', app.mail_general_allowed(c),
    'canRequestGeneral', false,
    'blocked', app.mail_blocked(c.run_id, c.coach_profile_id, c.athlete_profile_id),
    'blockedByMe', exists (
      select 1 from app.message_blocks b
      where b.run_id = c.run_id
        and b.low_profile_id = least(c.coach_profile_id, c.athlete_profile_id)
        and b.high_profile_id = greatest(c.coach_profile_id, c.athlete_profile_id)
        and b.ended_at is null and b.blocked_by_profile_id = actor
    ),
    'unread', exists (
      select 1 from app.message_entries e
      where e.conversation_id = c.id and e.sender_profile_id is distinct from actor
        and e.seq > coalesce((
          select last_seq from app.message_reads r
          where r.conversation_id = c.id and r.profile_id = actor
        ), 0)
    ),
    'consent', (
      select jsonb_build_object(
        'id', a.id, 'senderProfileId', a.sender_profile_id,
        'recipientProfileId', a.recipient_profile_id,
        'body', a.first_body, 'status', a.status
      ) from app.message_consents a where a.conversation_id = c.id
      order by a.created_at desc, a.id desc limit 1
    )
  ) from app.coach_profiles coach
    join app.profiles athlete on athlete.id = c.athlete_profile_id
    join app.profiles coach_account on coach_account.id = c.coach_profile_id
  where coach.profile_id = c.coach_profile_id and coach.run_id = c.run_id
$$;
