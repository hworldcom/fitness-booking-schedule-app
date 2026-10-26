-- MOV-117: signed-in basic member profiles; no data backfill or public bucket.
create or replace function app.current_member_profile(requested_profile uuid)
returns table(profile_id uuid,display_name text,avatar_storage_path text,avatar_updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not app.authorized_actor_context_valid(null,null,null) then return; end if;
  return query select p.id,p.display_name,p.avatar_storage_path,p.avatar_updated_at
    from app.profiles p join app.demo_run_participants m on m.profile_id=p.id
    where p.id=requested_profile and m.run_id=current_setting('app.current_run_id')::uuid
      and m.status='active' and p.record_source='user' and p.claimed_at is not null;
end $$;
alter function app.current_member_profile(uuid) owner to postgres;
revoke all on function app.current_member_profile(uuid) from public,anon,authenticated;
grant execute on function app.current_member_profile(uuid) to app_owner,app_runtime;

-- Ordinary authenticated Storage credentials, current object only, shared active
-- dataset. No object listing/table grants or insert/update/delete authority added.
create or replace function app.current_storage_actor_can_read_member_avatar(requested_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.profiles viewer
    join app.demo_run_participants v on v.profile_id=viewer.id and v.status='active'
    join app.demo_runs r on r.id=v.run_id and r.status='active' and r.catalogue_visibility='public'
    join app.demo_run_participants m on m.run_id=v.run_id and m.status='active'
    join app.profiles target on target.id=m.profile_id
    where viewer.auth_user_id=(select auth.uid()) and viewer.record_source='user' and viewer.claimed_at is not null
      and target.record_source='user' and target.claimed_at is not null
      and target.avatar_storage_path=requested_path)
$$;
alter function app.current_storage_actor_can_read_member_avatar(text) owner to postgres;
revoke all on function app.current_storage_actor_can_read_member_avatar(text) from public,anon,app_runtime;
grant execute on function app.current_storage_actor_can_read_member_avatar(text) to authenticated;
drop policy if exists account_avatars_member_select on storage.objects;
create policy account_avatars_member_select on storage.objects for select to authenticated
  using(bucket_id='account-avatars' and app.current_storage_actor_can_read_member_avatar(name));

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
    -- Basic member identity no longer requires a booking or connection.
    'counterpartProfileHref', case
      when app.coach_website_is_public(c.run_id,other.profile_id)
        then '/coaches/' || other.public_slug
      when member.profile_id is not null then '/members/' || member.profile_id::text end,
    'counterpartMedia', case
      when actor=c.athlete_profile_id and coach.portrait_source is not null
        then jsonb_build_object('kind','coach-portrait','source',coach.portrait_source,
          'path',coach.portrait_path,'updatedAt',coach.portrait_updated_at)
      when member.avatar_storage_path is not null
        then jsonb_build_object('kind','member-avatar','id',member.profile_id,
          'updatedAt',member.avatar_updated_at) end,
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
    left join app.coach_profiles other on other.run_id=c.run_id
      and other.profile_id=case when actor=c.coach_profile_id then c.athlete_profile_id else c.coach_profile_id end
    left join lateral app.current_member_profile(case when actor=c.coach_profile_id then c.athlete_profile_id else c.coach_profile_id end) member on true
  where coach.profile_id = c.coach_profile_id and coach.run_id = c.run_id
$$;
