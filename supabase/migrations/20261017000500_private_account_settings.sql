-- DEV0294: optional personal details never join public/coach projections.
create table app.account_personal_details (
  profile_id uuid primary key references app.profiles(id) on delete cascade,
  birthdate date,
  gender text,
  revision integer not null default 1 check (revision > 0),
  constraint account_birthdate_minimum check (birthdate >= date '1900-01-01'),
  constraint account_gender_bounds check (gender is null or (
    gender = btrim(gender) and char_length(gender) between 1 and 80
    and gender !~ '[[:cntrl:]]'
  ))
);
alter table app.account_personal_details owner to app_owner;
alter table app.account_personal_details enable row level security;
alter table app.account_personal_details force row level security;
revoke all on app.account_personal_details from public, anon, authenticated;
grant select on app.account_personal_details to app_runtime;
create policy account_details_owner_read on app.account_personal_details
  for select to app_runtime using (app.authorized_actor_context_valid(profile_id, null, null));
create policy account_details_management on app.account_personal_details
  to app_owner using (
    current_setting('app.account_settings_management', true) = 'on'
    and profile_id::text = current_setting('app.current_profile_id', true)
  ) with check (
    current_setting('app.account_settings_management', true) = 'on'
    and profile_id::text = current_setting('app.current_profile_id', true)
  );
create policy profiles_account_settings_select on app.profiles
  for select to app_owner using (
    current_setting('app.account_settings_management', true) = 'on'
    and id::text = current_setting('app.current_profile_id', true)
  );
create policy profiles_account_settings_update on app.profiles
  for update to app_owner using (
    current_setting('app.account_settings_management', true) = 'on'
    and id::text = current_setting('app.current_profile_id', true)
  ) with check (
    current_setting('app.account_settings_management', true) = 'on'
    and id::text = current_setting('app.current_profile_id', true)
  );

create function app.current_account_settings() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception 'account settings actor unavailable' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('app.account_settings_management', 'on', true);
  select jsonb_build_object('displayName', p.display_name, 'birthdate', d.birthdate::text,
    'gender', d.gender, 'revision', coalesce(d.revision, 0)) into result
  from app.profiles p left join app.account_personal_details d on d.profile_id = p.id
  where p.id::text = current_setting('app.current_profile_id', true);
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  return result;
exception when others then
  perform pg_catalog.set_config('app.account_settings_management', 'off', true); raise;
end;
$$;
alter function app.current_account_settings() owner to app_owner;
revoke all on function app.current_account_settings() from public, anon, authenticated;
grant execute on function app.current_account_settings() to app_runtime;

create function app.save_current_account_settings(
  requested_name text, requested_birthdate date, requested_gender text, expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid; current_name text; previous app.account_personal_details%rowtype;
  normalized_name text; normalized_gender text; current_revision integer; result jsonb;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception 'account settings actor unavailable' using errcode = '42501';
  end if;
  normalized_name := btrim(regexp_replace(requested_name, '[[:space:]]+', ' ', 'g'));
  normalized_gender := nullif(btrim(regexp_replace(requested_gender, '[[:space:]]+', ' ', 'g')), '');
  if requested_name is null or requested_name ~ '[[:cntrl:]]'
    or char_length(normalized_name) not between 2 and 80 or normalized_name !~ '[[:alnum:]]'
    or requested_gender ~ '[[:cntrl:]]' or char_length(normalized_gender) > 80
    or requested_name ~ '[\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
    or requested_gender ~ '[\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]'
    or requested_birthdate < date '1900-01-01'
    or requested_birthdate > (statement_timestamp() at time zone 'UTC')::date
    or expected_revision is null or expected_revision < 0 or expected_revision >= 2147483647 then
    return jsonb_build_object('status', 'invalid');
  end if;
  actor := current_setting('app.current_profile_id', true)::uuid;
  perform pg_catalog.set_config('app.account_settings_management', 'on', true);
  -- Serialize the initial insert and all later updates, including exact retries.
  select p.display_name into current_name from app.profiles p where p.id = actor for update;
  select d.* into previous from app.account_personal_details d where d.profile_id = actor;
  current_revision := coalesce(previous.revision, 0);
  if current_revision <> expected_revision then
    if current_revision <> expected_revision + 1 or current_name is distinct from normalized_name
      or previous.birthdate is distinct from requested_birthdate or previous.gender is distinct from normalized_gender then
      perform pg_catalog.set_config('app.account_settings_management', 'off', true);
      return jsonb_build_object('status', 'conflict');
    end if;
  else
    update app.profiles set display_name = normalized_name,
      initials = upper(left(normalized_name, 1)) || upper(left(split_part(normalized_name, ' ', -1), 1))
    where id = actor;
    insert into app.account_personal_details (profile_id, birthdate, gender, revision)
      values (actor, requested_birthdate, normalized_gender, current_revision + 1)
    on conflict (profile_id) do update set birthdate = excluded.birthdate,
      gender = excluded.gender, revision = excluded.revision;
  end if;
  result := jsonb_build_object('status', 'ready', 'details', app.current_account_settings());
  perform pg_catalog.set_config('app.account_settings_management', 'off', true);
  return result;
exception when others then
  perform pg_catalog.set_config('app.account_settings_management', 'off', true); raise;
end;
$$;
alter function app.save_current_account_settings(text,date,text,integer) owner to app_owner;
revoke all on function app.save_current_account_settings(text,date,text,integer) from public, anon, authenticated;
grant execute on function app.save_current_account_settings(text,date,text,integer) to app_runtime;
