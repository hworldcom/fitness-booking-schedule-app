-- Separate ordinary client capability from platform-approved coaching.
-- Existing self-service activation remains historical intent only. Real user
-- coach profiles require an approved application; seeded fictional profiles
-- remain explicitly identified as demo content and never inherit verification.

alter table app.coach_profiles
  add column is_demo boolean not null default false;

update app.coach_profiles
set is_demo = true
where record_source = 'fixture'
  or profile_id in (
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    '10000000-0000-4000-8000-000000000007'::uuid,
    '10000000-0000-4000-8000-000000000008'::uuid,
    '10000000-0000-4000-8000-000000000009'::uuid
  );

create table app.coach_applications (
  profile_id uuid primary key,
  status text not null default 'pending',
  revision integer not null default 1,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz null,
  decision_reason text null,
  reviewer_reference text null,
  review_source text null,
  verification_policy_version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_applications_profile_fkey
    foreign key (profile_id)
    references app.profiles (id)
    on delete restrict,
  constraint coach_applications_status_check
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  constraint coach_applications_revision_check
    check (revision between 1 and 1000000),
  constraint coach_applications_decision_state_check
    check (
      (
        status = 'pending'
        and decided_at is null
        and decision_reason is null
        and reviewer_reference is null
        and review_source is null
        and verification_policy_version is null
      )
      or (
        status in ('approved', 'rejected', 'suspended')
        and decided_at is not null
        and char_length(decision_reason) between 10 and 500
        and decision_reason !~ '[[:cntrl:]]'
        and char_length(reviewer_reference) between 3 and 120
        and reviewer_reference !~ '[[:cntrl:]]'
        and review_source = 'owner-command'
        and verification_policy_version
          ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$'
      )
    )
);

create table app.coach_application_review_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  application_revision integer not null,
  previous_status text not null,
  decision text not null,
  reason text not null,
  reviewer_reference text not null,
  review_source text not null,
  verification_policy_version text not null,
  created_at timestamptz not null default now(),
  constraint coach_application_review_events_application_fkey
    foreign key (profile_id)
    references app.coach_applications (profile_id)
    on delete restrict,
  constraint coach_application_review_events_revision_check
    check (application_revision between 1 and 1000000),
  constraint coach_application_review_events_previous_status_check
    check (previous_status in ('pending', 'approved')),
  constraint coach_application_review_events_decision_check
    check (decision in ('approved', 'rejected', 'suspended')),
  constraint coach_application_review_events_transition_check
    check (
      (previous_status = 'pending' and decision in ('approved', 'rejected'))
      or (previous_status = 'approved' and decision = 'suspended')
    ),
  constraint coach_application_review_events_reason_check
    check (
      char_length(reason) between 10 and 500
      and reason !~ '[[:cntrl:]]'
    ),
  constraint coach_application_review_events_reviewer_check
    check (
      char_length(reviewer_reference) between 3 and 120
      and reviewer_reference !~ '[[:cntrl:]]'
    ),
  constraint coach_application_review_events_source_check
    check (review_source = 'owner-command'),
  constraint coach_application_review_events_policy_check
    check (
      verification_policy_version
        ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$'
    )
);

create unique index coach_application_review_events_decision_key
  on app.coach_application_review_events (
    profile_id,
    application_revision,
    previous_status,
    decision
  );
create index coach_applications_status_submitted_idx
  on app.coach_applications (status, submitted_at, profile_id);
create index coach_application_review_events_profile_created_idx
  on app.coach_application_review_events (profile_id, created_at, id);

create trigger coach_applications_set_updated_at
before update on app.coach_applications
for each row execute function app.set_updated_at();

alter table app.coach_applications enable row level security;
alter table app.coach_applications force row level security;
alter table app.coach_application_review_events enable row level security;
alter table app.coach_application_review_events force row level security;
alter table app.coach_applications owner to app_owner;
alter table app.coach_application_review_events owner to app_owner;

revoke all on app.coach_applications, app.coach_application_review_events
  from public, anon, authenticated, service_role;
revoke insert, update, delete
  on app.coach_applications, app.coach_application_review_events
  from app_runtime;
grant select on app.coach_applications, app.coach_application_review_events
  to app_runtime;

create policy coach_applications_management_all
  on app.coach_applications
  for all
  to app_owner
  using (current_setting('app.coach_application_management', true) = 'on')
  with check (
    current_setting('app.coach_application_management', true) = 'on'
  );

create policy coach_application_review_events_management_all
  on app.coach_application_review_events
  for all
  to app_owner
  using (current_setting('app.coach_application_management', true) = 'on')
  with check (
    current_setting('app.coach_application_management', true) = 'on'
  );

create policy coach_applications_owner_select
  on app.coach_applications
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, null, null));

create policy coach_application_review_events_owner_select
  on app.coach_application_review_events
  for select
  to app_runtime
  using (app.authorized_actor_context_valid(profile_id, null, null));

-- Preserve existing user-created coach data as a pending application, but do
-- not grandfather it into verified status. Fictional demo profiles stay public.
insert into app.coach_applications (
  profile_id,
  status,
  revision,
  submitted_at
)
select
  coach.profile_id,
  'pending',
  1,
  least(coach.created_at, statement_timestamp())
from app.coach_profiles as coach
join app.profiles as profile on profile.id = coach.profile_id
where not coach.is_demo
  and coach.record_source = 'user'
  and profile.record_source = 'user'
on conflict (profile_id) do nothing;

update app.coach_profiles
set visibility = 'hidden'
where not is_demo
  and visibility <> 'hidden';

create function app.coach_trust_kind(
  requested_profile_id uuid,
  requested_is_demo boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_status text;
begin
  if requested_profile_id is null or requested_is_demo is null then
    return null;
  end if;
  if requested_is_demo then
    return 'demo';
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  select application.status
  into application_status
  from app.coach_applications as application
  where application.profile_id = requested_profile_id;
  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );

  if application_status = 'approved' then
    return 'verified';
  end if;
  return null;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.coach_trust_kind(uuid, boolean) owner to app_owner;
revoke all on function app.coach_trust_kind(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function app.coach_trust_kind(uuid, boolean)
  to app_runtime;

drop policy coach_profiles_public_discovery_select on app.coach_profiles;
create policy coach_profiles_public_discovery_select
  on app.coach_profiles
  for select
  to app_runtime
  using (
    visibility = 'visible'
    and location_confirmed_at is not null
    and app.coach_trust_kind(profile_id, is_demo) is not null
    and exists (
      select 1
      from app.demo_runs as run
      where run.id = coach_profiles.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
    and (
      selected_gym_id is null
      or exists (
        select 1
        from app.gyms as gym
        where gym.run_id = coach_profiles.run_id
          and gym.id = coach_profiles.selected_gym_id
          and gym.status = 'active'
      )
    )
  );

create function app.require_coach_application_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_status text;
begin
  if tg_op = 'UPDATE' and new.is_demo <> old.is_demo then
    raise exception using
      errcode = 'P0001',
      message = 'coach profile demo identity is immutable';
  end if;

  if new.is_demo
    or pg_catalog.current_setting(
      'app.coach_review_management',
      true
    ) = 'on'
  then
    return new;
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  select application.status
  into application_status
  from app.coach_applications as application
  where application.profile_id = new.profile_id
  for share;
  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );

  if application_status = 'approved'
    or (
      application_status in ('pending', 'rejected')
      and new.visibility = 'hidden'
    )
  then
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'coach profile requires an eligible coach application';
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    raise;
end;
$$;

drop trigger coach_profiles_require_activation on app.coach_profiles;
drop function app.require_activated_coach_profile();
create trigger coach_profiles_require_application
after insert or update on app.coach_profiles
for each row execute function app.require_coach_application_access();

alter function app.require_coach_application_access() owner to app_owner;
revoke all on function app.require_coach_application_access()
  from public, anon, authenticated, service_role, app_runtime;

create function app.submit_owned_coach_application()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  selected_profile app.profiles%rowtype;
  selected_application app.coach_applications%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'coach application actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'on',
    true
  );

  select profile.*
  into selected_profile
  from app.profiles as profile
  where profile.id = profile_id_text::uuid
    and profile.record_source = 'user'
    and profile.auth_user_id is not null
    and profile.claimed_at is not null
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach application profile is unavailable';
  end if;

  select application.*
  into selected_application
  from app.coach_applications as application
  where application.profile_id = selected_profile.id
  for update;

  if not found then
    insert into app.coach_applications (
      profile_id,
      status,
      revision,
      submitted_at
    ) values (
      selected_profile.id,
      'pending',
      1,
      pg_catalog.statement_timestamp()
    );
    selected_application.status := 'pending';
  elsif selected_application.status = 'rejected' then
    update app.coach_applications
    set
      status = 'pending',
      revision = revision + 1,
      submitted_at = pg_catalog.statement_timestamp(),
      decided_at = null,
      decision_reason = null,
      reviewer_reference = null,
      review_source = null,
      verification_policy_version = null
    where profile_id = selected_profile.id;
    selected_application.status := 'pending';
  end if;

  update app.profiles
  set
    coaching_activated_at = coalesce(
      coaching_activated_at,
      pg_catalog.statement_timestamp()
    ),
    updated_at = case
      when coaching_activated_at is null
        then pg_catalog.statement_timestamp()
      else updated_at
    end
  where id = selected_profile.id;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );
  perform pg_catalog.set_config(
    'app.coach_activation_management',
    'off',
    true
  );
  return selected_application.status;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    perform pg_catalog.set_config(
      'app.coach_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.submit_owned_coach_application() owner to app_owner;
revoke all on function app.submit_owned_coach_application()
  from public, anon, authenticated, service_role;
grant execute on function app.submit_owned_coach_application()
  to app_runtime;

revoke execute on function app.activate_owned_coaching() from app_runtime;

create function app.review_coach_application(
  requested_profile_id uuid,
  expected_status text,
  requested_decision text,
  requested_reason text,
  requested_reviewer_reference text,
  requested_policy_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_application app.coach_applications%rowtype;
  normalized_reason text;
  normalized_reviewer_reference text;
  repeated_event_id uuid;
begin
  normalized_reason := pg_catalog.btrim(
    pg_catalog.regexp_replace(requested_reason, '[[:space:]]+', ' ', 'g')
  );
  normalized_reviewer_reference := pg_catalog.btrim(
    pg_catalog.regexp_replace(
      requested_reviewer_reference,
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  if requested_profile_id is null
    or expected_status not in ('pending', 'approved')
    or requested_decision not in ('approved', 'rejected', 'suspended')
    or not (
      (expected_status = 'pending'
        and requested_decision in ('approved', 'rejected'))
      or (expected_status = 'approved' and requested_decision = 'suspended')
    )
    or normalized_reason is null
    or pg_catalog.char_length(normalized_reason) not between 10 and 500
    or normalized_reason ~ '[[:cntrl:]]'
    or normalized_reviewer_reference is null
    or pg_catalog.char_length(normalized_reviewer_reference)
      not between 3 and 120
    or normalized_reviewer_reference ~ '[[:cntrl:]]'
    or requested_policy_version is null
    or requested_policy_version
      !~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach application review is invalid';
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'on',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'on', true);
  perform pg_catalog.set_config('app.coach_review_management', 'on', true);

  select application.*
  into selected_application
  from app.coach_applications as application
  where application.profile_id = requested_profile_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach application review target is unavailable';
  end if;

  if selected_application.status = requested_decision then
    select event.id
    into repeated_event_id
    from app.coach_application_review_events as event
    where event.profile_id = selected_application.profile_id
      and event.application_revision = selected_application.revision
      and event.previous_status = expected_status
      and event.decision = requested_decision
      and event.reason = normalized_reason
      and event.reviewer_reference = normalized_reviewer_reference
      and event.review_source = 'owner-command'
      and event.verification_policy_version = requested_policy_version;

    if repeated_event_id is not null then
      perform pg_catalog.set_config(
        'app.coach_application_management',
        'off',
        true
      );
      perform pg_catalog.set_config(
        'app.coach_profile_management',
        'off',
        true
      );
      perform pg_catalog.set_config(
        'app.coach_review_management',
        'off',
        true
      );
      return selected_application.status;
    end if;
  end if;

  if selected_application.status <> expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'coach application review conflicts with current state';
  end if;

  if requested_decision = 'approved' and not exists (
    select 1
    from app.coach_profiles as coach
    where coach.profile_id = selected_application.profile_id
      and not coach.is_demo
      and coach.record_source = 'user'
      and coach.visibility = 'hidden'
      and coach.location_confirmed_at is not null
      and exists (
        select 1
        from app.coach_profile_disciplines as discipline
        where discipline.run_id = coach.run_id
          and discipline.profile_id = coach.profile_id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach application requires a completed hidden profile';
  end if;

  update app.coach_applications
  set
    status = requested_decision,
    decided_at = pg_catalog.statement_timestamp(),
    decision_reason = normalized_reason,
    reviewer_reference = normalized_reviewer_reference,
    review_source = 'owner-command',
    verification_policy_version = requested_policy_version
  where profile_id = selected_application.profile_id;

  insert into app.coach_application_review_events (
    profile_id,
    application_revision,
    previous_status,
    decision,
    reason,
    reviewer_reference,
    review_source,
    verification_policy_version
  ) values (
    selected_application.profile_id,
    selected_application.revision,
    selected_application.status,
    requested_decision,
    normalized_reason,
    normalized_reviewer_reference,
    'owner-command',
    requested_policy_version
  );

  if requested_decision in ('rejected', 'suspended') then
    update app.coach_profiles
    set visibility = 'hidden'
    where profile_id = selected_application.profile_id
      and not is_demo;
  end if;

  perform pg_catalog.set_config(
    'app.coach_application_management',
    'off',
    true
  );
  perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
  perform pg_catalog.set_config('app.coach_review_management', 'off', true);
  return requested_decision;
exception
  when others then
    perform pg_catalog.set_config(
      'app.coach_application_management',
      'off',
      true
    );
    perform pg_catalog.set_config('app.coach_profile_management', 'off', true);
    perform pg_catalog.set_config('app.coach_review_management', 'off', true);
    raise;
end;
$$;

alter function app.review_coach_application(
  uuid,
  text,
  text,
  text,
  text,
  text
) owner to app_owner;
revoke all on function app.review_coach_application(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated, service_role, app_runtime;

comment on column app.profiles.coaching_activated_at is
  'Historical owner-declared coaching intent; current coach authority comes only from an approved coach application or explicit demo fixture status.';
comment on column app.coach_profiles.is_demo is
  'Immutable marker for fictional demonstration coaches; demo profiles never receive the real verified-coach badge.';
comment on table app.coach_applications is
  'Current server-authoritative coach application state for one email-backed application profile.';
comment on table app.coach_application_review_events is
  'Append-only platform decision evidence for coach applications.';
comment on function app.coach_trust_kind(uuid, boolean) is
  'Returns demo or verified presentation only for an actual fixture marker or current approved application.';
comment on function app.submit_owned_coach_application() is
  'Creates or resubmits the verified current account coach application without granting coach authority.';
comment on function app.review_coach_application(
  uuid,
  text,
  text,
  text,
  text,
  text
) is
  'Owner-only expected-state coach review operation; appends immutable evidence and is never granted to the application runtime.';
