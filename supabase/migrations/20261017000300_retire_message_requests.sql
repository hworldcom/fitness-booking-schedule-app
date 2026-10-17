-- DEV0280: Retire app approvals while preserving original contact/audit data.
-- Existing historical contact supports normal chat under the same outer guards.
create or replace function app.mail_general_allowed(c app.message_conversations)
returns boolean language sql stable set search_path = '' as $$
  select not app.mail_blocked(c.run_id, c.coach_profile_id, c.athlete_profile_id)
    and app.mail_coach_enabled(c)
    and (
      exists (
        select 1 from app.message_contexts x
        where x.conversation_id = c.id and app.mail_context_allowed(c, x)
      )
      or exists (
        select 1 from app.coach_athlete_connection_pairs p
        join app.coach_athlete_connection_attempts a on a.pair_id = p.id
        where p.run_id = c.run_id
          and p.coach_profile_id = c.coach_profile_id
          and p.athlete_profile_id = c.athlete_profile_id
          and a.status = 'accepted'
      )
      or exists (
        select 1 from app.message_consents a where a.conversation_id = c.id
      )
    )
$$;

-- Keep the projection shape compatible. Historical approval state is read-only
-- and never an app action or a permanent source of unread conversations.
create or replace function app.mail_conversation_projection(
  c app.message_conversations, actor uuid
) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id,
    'coachProfileId', c.coach_profile_id,
    'athleteProfileId', c.athlete_profile_id,
    'actorProfileId', actor,
    'counterpartName', case when actor = c.coach_profile_id
      then athlete.display_name else coach.display_name end,
    'role', case when actor = c.coach_profile_id then 'coach' else 'athlete' end,
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
  where coach.profile_id = c.coach_profile_id and coach.run_id = c.run_id
$$;
