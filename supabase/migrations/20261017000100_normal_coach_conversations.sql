-- DEV0276: An established service conversation supports ordinary unscoped chat.
-- Retain all original entries, context/consent identities and function privileges.
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
        select 1
        from app.coach_athlete_connection_pairs p
        join app.coach_athlete_connection_attempts a on a.pair_id = p.id
        where p.run_id = c.run_id
          and p.coach_profile_id = c.coach_profile_id
          and p.athlete_profile_id = c.athlete_profile_id
          and a.status = 'accepted'
      )
      or exists (
        select 1 from app.message_consents a
        where a.conversation_id = c.id and a.status = 'accepted'
      )
    )
$$;

alter function app.mail_general_allowed(app.message_conversations) owner to app_owner;
