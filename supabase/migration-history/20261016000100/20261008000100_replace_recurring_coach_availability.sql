-- Replace an authorized coach's complete recurring working week atomically.
-- The browser supplies both its desired rule keys and the authoritative keys it
-- started from so a stale editor cannot silently overwrite a newer save.

create function app.replace_owned_coach_availability_rules(
  requested_rule_keys jsonb,
  expected_rule_keys jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_coach record;
  requested_count integer;
  expected_count integer;
  current_rule_keys jsonb;
  normalized_requested_rule_keys jsonb;
  normalized_expected_rule_keys jsonb;
  removed_rule_ids uuid[];
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability actor context is invalid';
  end if;
  if requested_rule_keys is null
    or pg_catalog.jsonb_typeof(requested_rule_keys) <> 'array'
    or expected_rule_keys is null
    or pg_catalog.jsonb_typeof(expected_rule_keys) <> 'array'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule set is invalid';
  end if;

  requested_count := pg_catalog.jsonb_array_length(requested_rule_keys);
  expected_count := pg_catalog.jsonb_array_length(expected_rule_keys);
  if requested_count > 161 or expected_count > 161
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(requested_rule_keys) as item(value)
      where pg_catalog.jsonb_typeof(item.value) <> 'string'
        or (item.value #>> '{}')
          !~ '^[1-7][|]([01][0-9]|2[0-2]):00$'
    )
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(expected_rule_keys) as item(value)
      where pg_catalog.jsonb_typeof(item.value) <> 'string'
        or (item.value #>> '{}')
          !~ '^[1-7][|]([01][0-9]|2[0-2]):00$'
    )
    or requested_count <> (
      select pg_catalog.count(distinct item.value #>> '{}')
      from pg_catalog.jsonb_array_elements(requested_rule_keys) as item(value)
    )
    or expected_count <> (
      select pg_catalog.count(distinct item.value #>> '{}')
      from pg_catalog.jsonb_array_elements(expected_rule_keys) as item(value)
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability rule set is invalid';
  end if;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(rule_key order by rule_key),
    '[]'::jsonb
  )
  into normalized_requested_rule_keys
  from (
    select item.value #>> '{}' as rule_key
    from pg_catalog.jsonb_array_elements(requested_rule_keys) as item(value)
  ) as requested;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(rule_key order by rule_key),
    '[]'::jsonb
  )
  into normalized_expected_rule_keys
  from (
    select item.value #>> '{}' as rule_key
    from pg_catalog.jsonb_array_elements(expected_rule_keys) as item(value)
  ) as expected;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat(run_id_text, ':', profile_id_text),
      0
    )
  );
  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = profile_id_text::uuid
    and coach.visibility = 'visible'
    and coach.location_confirmed_at is not null
  for share;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach availability profile is unavailable';
  end if;

  perform 1
  from app.coach_availability_rules as rule
  where rule.run_id = selected_coach.run_id
    and rule.profile_id = selected_coach.profile_id
    and rule.status = 'active'
  for update;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(rule_key order by rule_key),
    '[]'::jsonb
  )
  into current_rule_keys
  from (
    select pg_catalog.concat(
      rule.iso_weekday::text,
      '|',
      pg_catalog.to_char(rule.local_start_time, 'HH24:MI')
    ) as rule_key
    from app.coach_availability_rules as rule
    where rule.run_id = selected_coach.run_id
      and rule.profile_id = selected_coach.profile_id
      and rule.status = 'active'
  ) as current_rules;

  if current_rule_keys <> normalized_expected_rule_keys then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return -1;
  end if;

  if current_rule_keys = normalized_requested_rule_keys then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return requested_count;
  end if;

  with removed_rules as (
    update app.coach_availability_rules as rule
    set
      status = 'removed',
      removed_at = pg_catalog.statement_timestamp()
    where rule.run_id = selected_coach.run_id
      and rule.profile_id = selected_coach.profile_id
      and rule.status = 'active'
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          normalized_requested_rule_keys
        ) as requested(rule_key)
        where requested.rule_key = pg_catalog.concat(
          rule.iso_weekday::text,
          '|',
          pg_catalog.to_char(rule.local_start_time, 'HH24:MI')
        )
      )
    returning rule.id
  )
  select pg_catalog.coalesce(
    pg_catalog.array_agg(removed_rules.id),
    array[]::uuid[]
  )
  into removed_rule_ids
  from removed_rules;

  update app.coach_availability_slots as slot
  set status = 'withdrawn'
  where slot.recurrence_rule_id = any(removed_rule_ids)
    and slot.status = 'open'
    and slot.starts_at > pg_catalog.statement_timestamp();

  insert into app.coach_availability_rules (
    run_id,
    profile_id,
    iso_weekday,
    local_start_time,
    coach_timezone,
    status,
    removed_at
  )
  select
    selected_coach.run_id,
    selected_coach.profile_id,
    pg_catalog.split_part(requested.rule_key, '|', 1)::smallint,
    pg_catalog.split_part(requested.rule_key, '|', 2)::time without time zone,
    selected_coach.timezone,
    'active',
    null
  from pg_catalog.jsonb_array_elements_text(
    normalized_requested_rule_keys
  ) as requested(rule_key)
  where not exists (
    select 1
    from app.coach_availability_rules as rule
    where rule.run_id = selected_coach.run_id
      and rule.profile_id = selected_coach.profile_id
      and rule.status = 'active'
      and rule.iso_weekday = pg_catalog.split_part(
        requested.rule_key,
        '|',
        1
      )::smallint
      and rule.local_start_time = pg_catalog.split_part(
        requested.rule_key,
        '|',
        2
      )::time without time zone
  );

  perform app.synchronize_coach_availability_occurrences(
    selected_coach.run_id,
    selected_coach.profile_id
  );

  perform pg_catalog.set_config(
    'app.coach_availability_rule_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_availability_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  return requested_count;
exception
  when sqlstate 'P0001'
    or unique_violation
    or exclusion_violation
    or check_violation
    or foreign_key_violation
  then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    return -1;
  when others then
    perform pg_catalog.set_config(
      'app.coach_availability_rule_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_availability_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

alter function app.replace_owned_coach_availability_rules(jsonb, jsonb)
  owner to app_owner;

revoke all on function app.replace_owned_coach_availability_rules(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function app.replace_owned_coach_availability_rules(jsonb, jsonb)
  to app_runtime;

comment on function app.replace_owned_coach_availability_rules(jsonb, jsonb) is
  'Atomically replaces an authorized coach working week when the submitted baseline still matches, then synchronizes dated occurrences once.';
