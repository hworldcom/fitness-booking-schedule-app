-- DEV0295: private legal identity, preferred chat first name and reserved username.
alter table app.account_personal_details
  add column legal_name text,
  add column preferred_first_name text,
  add column username text,
  add constraint account_legal_name_bounds check (legal_name is null or (
    legal_name = btrim(legal_name) and char_length(legal_name) between 2 and 80 and legal_name !~ '[[:cntrl:]]' and legal_name ~ '[[:alnum:]]')),
  add constraint account_preferred_name_bounds check (preferred_first_name is null or (
    preferred_first_name = btrim(preferred_first_name) and char_length(preferred_first_name) between 1 and 80 and preferred_first_name !~ '[[:cntrl:]]' and preferred_first_name ~ '[[:alnum:]]')),
  add constraint account_username_format check (username is null or username ~ '^[a-z][a-z0-9_]{2,29}$'),
  add constraint account_username_unique unique (username);
alter table app.profiles add column chat_first_name text,
  add constraint profiles_chat_first_name_bounds check (chat_first_name is null or (
    chat_first_name = btrim(chat_first_name) and char_length(chat_first_name) between 1 and 80 and chat_first_name !~ '[[:cntrl:]]'));

create function app.account_first_name(value text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(split_part(btrim(regexp_replace(value, '[[:space:]]+', ' ', 'g')), ' ', 1), ''), 'Member')
$$;
alter function app.account_first_name(text) owner to app_owner;
revoke all on function app.account_first_name(text) from public, anon, authenticated, app_runtime;

create or replace function app.current_account_settings() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception 'account settings actor unavailable' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('app.account_settings_management', 'on', true);
  select jsonb_build_object('displayName', p.display_name, 'legalName', d.legal_name,
    'preferredFirstName', d.preferred_first_name, 'username', d.username,
    'birthdate', d.birthdate::text, 'gender', d.gender, 'revision', coalesce(d.revision, 0)) into result
  from app.profiles p left join app.account_personal_details d on d.profile_id = p.id
  where p.id::text = current_setting('app.current_profile_id', true);
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  return result;
exception when others then
  perform pg_catalog.set_config('app.account_settings_management', 'off', true); raise;
end;
$$;

create function app.update_current_account_settings(requested_section text, requested_values jsonb, expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; original_name text; previous app.account_personal_details%rowtype;
  legal text; preferred text; handle text; birth date; gender_value text;
  current_revision integer; same_values boolean; result jsonb; violated_constraint text; keys text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception 'account settings actor unavailable' using errcode = '42501';
  end if;
  if requested_section is null or requested_section not in ('personal-details', 'login-security')
    or requested_values is null or jsonb_typeof(requested_values) <> 'object'
    or octet_length(requested_values::text) > 2048
    or expected_revision is null or expected_revision < 0 or expected_revision >= 2147483647 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select string_agg(key, ',' order by key) into keys from jsonb_object_keys(requested_values) as fields(key);
  if requested_section = 'personal-details' then
    if keys is distinct from 'birthdate,gender,legalName,preferredFirstName'
      or jsonb_typeof(requested_values->'legalName') not in ('string', 'null')
      or jsonb_typeof(requested_values->'preferredFirstName') not in ('string', 'null')
      or jsonb_typeof(requested_values->'birthdate') not in ('string', 'null')
      or jsonb_typeof(requested_values->'gender') not in ('string', 'null') then
      return jsonb_build_object('status', 'invalid');
    end if;
    legal := nullif(btrim(regexp_replace(requested_values->>'legalName', '[[:space:]]+', ' ', 'g')), '');
    preferred := nullif(btrim(regexp_replace(requested_values->>'preferredFirstName', '[[:space:]]+', ' ', 'g')), '');
    gender_value := nullif(btrim(regexp_replace(requested_values->>'gender', '[[:space:]]+', ' ', 'g')), '');
    if (legal is not null and (char_length(legal) not between 2 and 80 or legal !~ '[[:alnum:]]'))
      or (preferred is not null and (char_length(preferred) not between 1 and 80 or preferred !~ '[[:alnum:]]'))
      or char_length(gender_value) > 80
      or (requested_values->>'legalName') ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
      or (requested_values->>'preferredFirstName') ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
      or (requested_values->>'gender') ~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
      or ((requested_values->>'birthdate') is not null and (requested_values->>'birthdate') !~ '^\d{4}-\d{2}-\d{2}$') then
      return jsonb_build_object('status', 'invalid');
    end if;
    birth := (requested_values->>'birthdate')::date;
    if birth < date '1900-01-01' or birth > (statement_timestamp() at time zone 'UTC')::date then
      return jsonb_build_object('status', 'invalid');
    end if;
  else
    if keys is distinct from 'username' or jsonb_typeof(requested_values->'username') not in ('string', 'null') then
      return jsonb_build_object('status', 'invalid');
    end if;
    handle := nullif(regexp_replace(lower(btrim(requested_values->>'username')), '^@', ''), '');
    if handle is not null and handle !~ '^[a-z][a-z0-9_]{2,29}$' then return jsonb_build_object('status', 'invalid'); end if;
    if requested_values->>'username' = '@' then return jsonb_build_object('status', 'invalid'); end if;
  end if;
  actor := current_setting('app.current_profile_id', true)::uuid;
  perform pg_catalog.set_config('app.account_settings_management', 'on', true);
  select p.display_name into original_name from app.profiles p where p.id = actor for update;
  select d.* into previous from app.account_personal_details d where d.profile_id = actor;
  current_revision := coalesce(previous.revision, 0);
  same_values := case when requested_section = 'personal-details' then
    previous.legal_name is not distinct from legal and previous.preferred_first_name is not distinct from preferred
      and previous.birthdate is not distinct from birth and previous.gender is not distinct from gender_value
    else previous.username is not distinct from handle end;
  if current_revision <> expected_revision then
    if current_revision <> expected_revision + 1 or not same_values then
      perform pg_catalog.set_config('app.account_settings_management', 'off', true);
      return jsonb_build_object('status', 'conflict');
    end if;
  else
    insert into app.account_personal_details(profile_id, legal_name, preferred_first_name, username, birthdate, gender, revision)
    values (actor, case when requested_section='personal-details' then legal else previous.legal_name end,
      case when requested_section='personal-details' then preferred else previous.preferred_first_name end,
      case when requested_section='login-security' then handle else previous.username end,
      case when requested_section='personal-details' then birth else previous.birthdate end,
      case when requested_section='personal-details' then gender_value else previous.gender end, current_revision + 1)
    on conflict(profile_id) do update set legal_name=excluded.legal_name, preferred_first_name=excluded.preferred_first_name,
      username=excluded.username, birthdate=excluded.birthdate, gender=excluded.gender, revision=excluded.revision;
    if requested_section = 'personal-details' then
      update app.profiles set chat_first_name=coalesce(preferred, app.account_first_name(coalesce(legal, original_name))) where id=actor;
    end if;
  end if;
  result := jsonb_build_object('status', 'ready', 'details', app.current_account_settings());
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  return result;
exception
  when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    perform pg_catalog.set_config('app.account_settings_management', 'off', true);
    if violated_constraint = 'account_username_unique' then return jsonb_build_object('status', 'username-taken'); end if;
    raise;
  when invalid_datetime_format or datetime_field_overflow then
    perform pg_catalog.set_config('app.account_settings_management', 'off', true);
    return jsonb_build_object('status', 'invalid');
  when others then perform pg_catalog.set_config('app.account_settings_management', 'off', true); raise;
end;
$$;
alter function app.update_current_account_settings(text,jsonb,integer) owner to app_owner;
revoke all on function app.update_current_account_settings(text,jsonb,integer) from public, anon, authenticated;
grant execute on function app.update_current_account_settings(text,jsonb,integer) to app_runtime;

-- Preserve every media/permission field; change only current chat name presentation.
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

-- Contact preview follows the same first-name rule after existing contact authorization.
create or replace function app.message_command(action text, args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; chat_name text;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>32768 then
    raise exception 'message unavailable' using errcode='P0001';
  end if;
  perform app.mail_flags(true);
  result := app.mail_dispatch(action,args);
  if action='contact' and result->>'coachId' is not null then
    select coalesce(p.chat_first_name, app.account_first_name(p.display_name)) into chat_name
      from app.profiles p where p.id=(result->>'coachId')::uuid;
    result := jsonb_set(result, '{name}', to_jsonb(chat_name));
  end if;
  perform app.mail_flags(false);
  return result;
exception when others then perform app.mail_flags(false); raise;
end;
$$;
