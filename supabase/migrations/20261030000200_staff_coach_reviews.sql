-- MOV-144: owner-assigned staff, bounded review projections and canonical decisions.
-- No staff grants, account changes or historical application/review backfill.
create table app.platform_staff (
  run_id uuid not null,
  profile_id uuid not null,
  status text not null check (status in ('active','revoked')),
  revision integer not null default 1 check (revision between 1 and 1000000),
  reason text not null check (length(reason) between 10 and 500 and reason !~ '[[:cntrl:]]'),
  operator_reference text not null check (length(operator_reference) between 3 and 120 and operator_reference !~ '[[:cntrl:]]'),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (run_id,profile_id),
  foreign key (run_id,profile_id) references app.demo_run_participants(run_id,profile_id)
);
create table app.platform_staff_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  revision integer not null,
  previous_status text check (previous_status in ('active','revoked')),
  status text not null check (status in ('active','revoked')),
  reason text not null,
  operator_reference text not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(run_id,profile_id,revision),
  foreign key(run_id,profile_id) references app.platform_staff(run_id,profile_id)
);
create table app.staff_coach_review_commands (
  run_id uuid not null,
  staff_profile_id uuid not null,
  command_id uuid not null,
  payload_hash text not null,
  application_profile_id uuid not null references app.coach_applications(profile_id),
  review_event_id uuid not null references app.coach_application_review_events(id),
  decision text not null check(decision in ('approved','rejected','suspended')),
  created_at timestamptz not null default statement_timestamp(),
  primary key(run_id,staff_profile_id,command_id),
  foreign key(run_id,staff_profile_id) references app.platform_staff(run_id,profile_id)
);
alter table app.platform_staff owner to app_owner;
alter table app.platform_staff_events owner to app_owner;
alter table app.staff_coach_review_commands owner to app_owner;
alter table app.platform_staff enable row level security;
alter table app.platform_staff force row level security;
alter table app.platform_staff_events enable row level security;
alter table app.platform_staff_events force row level security;
alter table app.staff_coach_review_commands enable row level security;
alter table app.staff_coach_review_commands force row level security;
revoke all on app.platform_staff,app.platform_staff_events,app.staff_coach_review_commands
  from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create policy internal on app.platform_staff to app_owner using(true) with check(true);
create policy internal on app.platform_staff_events to app_owner using(true) with check(true);
create policy internal on app.staff_coach_review_commands to app_owner using(true) with check(true);

create function app.reject_staff_audit_change() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'staff audit is immutable' using errcode='P0001'; end $$;
alter function app.reject_staff_audit_change() owner to app_owner;
revoke all on function app.reject_staff_audit_change() from public;
create trigger immutable_staff_event before update or delete on app.platform_staff_events
  for each row execute function app.reject_staff_audit_change();
create trigger immutable_staff_review_command before update or delete on app.staff_coach_review_commands
  for each row execute function app.reject_staff_audit_change();

-- These policies apply only to the NOLOGIN function owner, never ordinary runtime.
do $$ declare relation text; begin
  foreach relation in array array['profiles','coach_applications','coach_profiles',
    'coach_profile_disciplines','coach_application_contacts','coach_application_review_events',
    'demo_run_participants','demo_runs'] loop
    execute format('create policy platform_staff_review_read on app.%I for select to app_owner using(current_setting(''app.platform_staff_read'',true)=''on'')',relation);
  end loop;
end $$;

-- Locking reads need an UPDATE policy; WITH CHECK false authorizes no mutation.
create policy platform_staff_review_lock on app.coach_applications for update to app_owner
  using(current_setting('app.platform_staff_read',true)='on') with check(false);
create policy platform_staff_review_lock on app.coach_profiles for update to app_owner
  using(current_setting('app.platform_staff_read',true)='on') with check(false);
create policy platform_staff_review_lock on app.coach_application_contacts for update to app_owner
  using(current_setting('app.platform_staff_read',true)='on') with check(false);

create function app.staff_account_active(profile uuid, dataset uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from app.profiles p
    join app.demo_run_participants m on m.profile_id=p.id and m.run_id=dataset
    join app.demo_runs d on d.id=m.run_id join auth.users u on u.id=p.auth_user_id
    where p.id=profile and p.record_source='user' and p.claimed_at is not null
      and m.status='active' and d.status='active' and d.catalogue_visibility='public'
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=statement_timestamp()));
$$;
alter function app.staff_account_active(uuid,uuid) owner to postgres;
revoke all on function app.staff_account_active(uuid,uuid)
  from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
grant execute on function app.staff_account_active(uuid,uuid) to app_owner;

create function app.set_platform_staff(requested_profile uuid, requested_run uuid,
  expected_revision integer, requested_status text, requested_reason text, requested_operator text)
returns integer language plpgsql security definer set search_path='' as $$
declare selected app.platform_staff; normalized_reason text:=btrim(requested_reason);
  normalized_operator text:=btrim(requested_operator);
begin
  if requested_profile is null or requested_run is null or expected_revision is null
    or expected_revision not between 0 and 999999
    or requested_status is null or requested_status not in ('active','revoked')
    or normalized_reason is null or length(normalized_reason) not between 10 and 500
    or normalized_reason ~ '[[:cntrl:]]' or normalized_operator is null
    or length(normalized_operator) not between 3 and 120 or normalized_operator ~ '[[:cntrl:]]'
    or (requested_status='active' and not app.staff_account_active(requested_profile,requested_run)) then
    raise exception 'staff assignment is invalid' using errcode='P0001';
  end if;
  -- Serialize creation as well as updates, including concurrent owner operators.
  perform pg_advisory_xact_lock(hashtextextended(requested_run::text||':'||requested_profile::text,144));
  select * into selected from app.platform_staff
    where run_id=requested_run and profile_id=requested_profile for update;
  if found and selected.status=requested_status and selected.revision=expected_revision+1
    and selected.reason=normalized_reason and selected.operator_reference=normalized_operator then
    return selected.revision;
  end if;
  if coalesce(selected.revision,0)<>expected_revision then
    raise exception 'staff assignment changed' using errcode='40001';
  end if;
  insert into app.platform_staff(run_id,profile_id,status,revision,reason,operator_reference)
  values(requested_run,requested_profile,requested_status,expected_revision+1,normalized_reason,normalized_operator)
  on conflict(run_id,profile_id) do update set status=excluded.status,revision=excluded.revision,
    reason=excluded.reason,operator_reference=excluded.operator_reference,updated_at=statement_timestamp();
  insert into app.platform_staff_events(run_id,profile_id,revision,previous_status,status,reason,operator_reference)
  values(requested_run,requested_profile,expected_revision+1,selected.status,requested_status,normalized_reason,normalized_operator);
  return expected_revision+1;
end $$;
alter function app.set_platform_staff(uuid,uuid,integer,text,text,text) owner to app_owner;
revoke all on function app.set_platform_staff(uuid,uuid,integer,text,text,text)
  from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

create function app.require_platform_staff() returns uuid
language plpgsql security definer set search_path='' as $$
declare selected app.platform_staff;
begin
  if not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'staff access unavailable' using errcode='42501';
  end if;
  select * into selected from app.platform_staff
    where profile_id=current_setting('app.current_profile_id')::uuid
      and run_id=current_setting('app.current_run_id')::uuid and status='active'
      and app.staff_account_active(profile_id,run_id) for share;
  if not found then raise exception 'staff access unavailable' using errcode='42501'; end if;
  return selected.profile_id;
end $$;
alter function app.require_platform_staff() owner to app_owner;
revoke all on function app.require_platform_staff()
  from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

create function app.current_platform_staff() returns jsonb
language plpgsql security definer set search_path='' as $$
declare selected uuid;
begin
  selected:=app.require_platform_staff();
  return jsonb_build_object('profileId',selected,'runId',current_setting('app.current_run_id')::uuid);
end $$;
alter function app.current_platform_staff() owner to app_owner;
revoke all on function app.current_platform_staff() from public;
grant execute on function app.current_platform_staff() to app_runtime;

create function app.staff_applicant_email(profile uuid) returns text
language plpgsql security definer set search_path='' as $$
declare result text;
begin
  perform app.require_platform_staff();
  select u.email into result from app.profiles p
    join app.coach_applications a on a.profile_id=p.id
    join app.demo_run_participants m on m.profile_id=p.id
    join app.demo_runs d on d.id=m.run_id join auth.users u on u.id=p.auth_user_id
    where p.id=profile and m.run_id=current_setting('app.current_run_id')::uuid
      and p.record_source='user' and p.claimed_at is not null and m.status='active'
      and d.status='active' and d.catalogue_visibility='public'
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=statement_timestamp());
  return result;
end $$;
alter function app.staff_applicant_email(uuid) owner to postgres;
revoke all on function app.staff_applicant_email(uuid)
  from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
grant execute on function app.staff_applicant_email(uuid) to app_owner;

-- Both operations retain immutable review evidence; the source identifies the real caller.
alter table app.coach_application_review_events drop constraint coach_application_review_events_source_check;
alter table app.coach_application_review_events add constraint coach_application_review_events_source_check
  check(review_source in ('owner-command','staff-panel'));
alter table app.coach_applications drop constraint coach_applications_decision_state_check;
alter table app.coach_applications add constraint coach_applications_decision_state_check check(
  (status='pending' and decided_at is null and decision_reason is null
    and reviewer_reference is null and review_source is null and verification_policy_version is null)
  or (status in ('approved','rejected','suspended') and decided_at is not null
    and length(decision_reason) between 10 and 500 and decision_reason !~ '[[:cntrl:]]'
    and length(reviewer_reference) between 3 and 120 and reviewer_reference !~ '[[:cntrl:]]'
    and review_source in ('owner-command','staff-panel')
    and verification_policy_version ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9][0-9]*$')
);

-- The canonical lifecycle implementation and staff projections follow below.

CREATE FUNCTION app.apply_coach_application_review(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text, requested_source text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
    or requested_source is null
    or requested_source not in ('owner-command','staff-panel')
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
      and event.review_source = requested_source
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
    review_source = requested_source,
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
    requested_source,
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
$_$;

alter function app.apply_coach_application_review(uuid,text,text,text,text,text,text) owner to app_owner;
revoke all on function app.apply_coach_application_review(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

create or replace function app.review_coach_application(requested_profile_id uuid, expected_status text, requested_decision text, requested_reason text, requested_reviewer_reference text, requested_policy_version text) returns text
language plpgsql security definer set search_path='' as $$
begin return app.apply_coach_application_review(requested_profile_id,expected_status,requested_decision,requested_reason,requested_reviewer_reference,requested_policy_version,'owner-command');end $$;

create function app.staff_coach_review_queue(requested_status text default 'pending',
  before_at timestamptz default null, before_profile uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; previous_flag text:=coalesce(current_setting('app.platform_staff_read',true),'');
begin
  perform app.require_platform_staff();
  if requested_status is null or requested_status not in ('pending','approved','rejected','suspended')
    or (before_at is null)<>(before_profile is null)
    or (before_at is not null and not isfinite(before_at)) then
    raise exception 'review queue filter is invalid' using errcode='P0001';
  end if;
  perform set_config('app.platform_staff_read','on',true);
  with eligible as (
    select a.profile_id,a.status,a.revision,greatest(a.submitted_at,c.created_at) submitted_at,
      c.display_name,c.location_confirmed_at is not null and exists(
        select 1 from app.coach_profile_disciplines cd where cd.profile_id=c.profile_id and cd.run_id=c.run_id
      ) review_ready
    from app.coach_applications a join app.coach_profiles c on c.profile_id=a.profile_id
    where c.run_id=current_setting('app.current_run_id')::uuid
      and not c.is_demo and c.record_source='user' and a.status=requested_status
      and app.staff_account_active(c.profile_id,c.run_id)
      and (before_at is null or(greatest(a.submitted_at,c.created_at),a.profile_id)<(before_at,before_profile))
    order by greatest(a.submitted_at,c.created_at) desc,a.profile_id desc limit 21
  ), page as(select * from eligible order by submitted_at desc,profile_id desc limit 20)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
    'profileId',profile_id,'status',status,'revision',revision,'submittedAt',submitted_at,
    'displayName',display_name,'reviewReady',review_ready)order by submitted_at desc,profile_id desc)from page),'[]'::jsonb),
    'hasMore',(select count(*)>20 from eligible),'filter',requested_status)into result;
  perform set_config('app.platform_staff_read',previous_flag,true);
  return result;
exception when others then
  perform set_config('app.platform_staff_read',previous_flag,true);raise;
end $$;
alter function app.staff_coach_review_queue(text,timestamptz,uuid) owner to app_owner;
revoke all on function app.staff_coach_review_queue(text,timestamptz,uuid) from public;
grant execute on function app.staff_coach_review_queue(text,timestamptz,uuid) to app_runtime;

create function app.staff_coach_review_detail(requested_profile uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; previous_flag text:=coalesce(current_setting('app.platform_staff_read',true),'');
begin
  perform app.require_platform_staff();
  perform set_config('app.platform_staff_read','on',true);
  select jsonb_build_object('profileId',a.profile_id,'status',a.status,'revision',a.revision,
    'submittedAt',greatest(a.submitted_at,c.created_at),'decidedAt',a.decided_at,
    'displayName',c.display_name,'bio',c.bio,'timezone',c.timezone,'visibility',c.visibility,
    'locationLabel',c.public_location_label,'locationConfirmed',c.location_confirmed_at is not null,
    'profileUpdatedAt',c.updated_at,'email',app.staff_applicant_email(a.profile_id),
    'disciplines',(select coalesce(jsonb_agg(cd.discipline order by cd.discipline),'[]'::jsonb)
      from app.coach_profile_disciplines cd where cd.profile_id=c.profile_id and cd.run_id=c.run_id),
    'contact',case when k.profile_id is null then null else k.details||jsonb_build_object('revision',k.revision)end,
    'isSelf',a.profile_id=current_setting('app.current_profile_id')::uuid,
    'history',(select coalesce(jsonb_agg(to_jsonb(h)order by h."createdAt" desc,h.id desc),'[]'::jsonb)
      from(select e.id,e.application_revision "applicationRevision",e.previous_status "previousStatus",
        e.decision,e.reason,e.reviewer_reference "reviewerReference",e.review_source "reviewSource",
        e.verification_policy_version "policyVersion",e.created_at "createdAt"
        from app.coach_application_review_events e where e.profile_id=a.profile_id
        order by e.created_at desc,e.id desc limit 20)h)) into result
  from app.coach_applications a join app.coach_profiles c on c.profile_id=a.profile_id
    left join app.coach_application_contacts k on k.profile_id=a.profile_id and k.run_id=c.run_id
  where a.profile_id=requested_profile and c.run_id=current_setting('app.current_run_id')::uuid
    and c.record_source='user' and not c.is_demo and app.staff_account_active(c.profile_id,c.run_id);
  if result is null or result->>'email' is null then
    raise exception 'staff review unavailable' using errcode='42501';
  end if;
  result:=result||jsonb_build_object('reviewToken',md5(result::text));
  perform set_config('app.platform_staff_read',previous_flag,true);
  return result;
exception when others then
  perform set_config('app.platform_staff_read',previous_flag,true);raise;
end $$;
alter function app.staff_coach_review_detail(uuid) owner to app_owner;
revoke all on function app.staff_coach_review_detail(uuid) from public;
grant execute on function app.staff_coach_review_detail(uuid) to app_runtime;

create function app.staff_review_coach_application(requested_profile uuid, expected_revision integer,
  expected_token text, requested_decision text, requested_reason text, command_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare staff uuid; dataset uuid; detail jsonb; expected_status text; result_status text; event_id uuid;
  command app.staff_coach_review_commands; requested_payload_hash text;
  normalized_reason text:=btrim(regexp_replace(requested_reason,'[[:space:]]+',' ','g'));
  previous_flag text:=coalesce(current_setting('app.platform_staff_read',true),'');
begin
  staff:=app.require_platform_staff();dataset:=current_setting('app.current_run_id')::uuid;
  if requested_profile is null or requested_profile=staff or command_id is null
    or expected_revision is null or expected_revision not between 1 and 1000000
    or expected_token is null or expected_token !~ '^[a-f0-9]{32}$'
    or requested_decision is null or requested_decision not in ('approved','rejected','suspended')
    or normalized_reason is null or length(normalized_reason) not between 10 and 500
    or normalized_reason ~ '[[:cntrl:]]' then
    raise exception 'staff review is invalid' using errcode='P0001';
  end if;
  requested_payload_hash:=md5(jsonb_build_array(requested_profile,expected_revision,expected_token,requested_decision,normalized_reason)::text);
  perform pg_advisory_xact_lock(hashtextextended(dataset::text||':'||staff::text||':'||command_id::text,144));
  select * into command from app.staff_coach_review_commands c
    where c.run_id=dataset and c.staff_profile_id=staff and c.command_id=staff_review_coach_application.command_id;
  if found then
    if command.payload_hash<>requested_payload_hash then
      raise exception 'review command conflicts with its earlier request' using errcode='40001';
    end if;
    detail:=app.staff_coach_review_detail(requested_profile);
    return jsonb_build_object('decision',command.decision,'reviewEventId',command.review_event_id,
      'currentStatus',detail->>'status','replayed',true);
  end if;
  perform set_config('app.platform_staff_read','on',true);
  -- Matches contact save's application-first lock; owner edits cannot race review.
  perform 1 from app.coach_applications a join app.coach_profiles c on c.profile_id=a.profile_id
    where a.profile_id=requested_profile and c.run_id=dataset for update of a;
  if not found then raise exception 'staff review unavailable' using errcode='42501';end if;
  perform 1 from app.coach_profiles c where c.profile_id=requested_profile and c.run_id=dataset for share;
  perform 1 from app.coach_application_contacts c where c.profile_id=requested_profile and c.run_id=dataset for share;
  detail:=app.staff_coach_review_detail(requested_profile);
  expected_status:=case when requested_decision='suspended' then 'approved' else 'pending' end;
  if (detail->>'revision')::integer<>expected_revision or detail->>'reviewToken'<>expected_token
    or detail->>'status'<>expected_status then
    raise exception 'application changed; reload before reviewing' using errcode='40001';
  end if;
  result_status:=app.apply_coach_application_review(requested_profile,expected_status,requested_decision,
    normalized_reason,'staff:'||staff::text,'movx-identity-application-v1','staff-panel');
  select e.id into event_id from app.coach_application_review_events e
    where e.profile_id=requested_profile and e.application_revision=expected_revision
      and e.decision=requested_decision and e.review_source='staff-panel'
      and e.reviewer_reference='staff:'||staff::text
    order by e.created_at desc,e.id desc limit 1;
  if event_id is null then raise exception 'review evidence is unavailable' using errcode='P0001';end if;
  insert into app.staff_coach_review_commands(run_id,staff_profile_id,command_id,payload_hash,
    application_profile_id,review_event_id,decision)
  values(dataset,staff,command_id,requested_payload_hash,requested_profile,event_id,result_status);
  perform set_config('app.platform_staff_read',previous_flag,true);
  return jsonb_build_object('decision',result_status,'reviewEventId',event_id,
    'currentStatus',result_status,'replayed',false);
exception when others then
  perform set_config('app.platform_staff_read',previous_flag,true);raise;
end $$;
alter function app.staff_review_coach_application(uuid,integer,text,text,text,uuid) owner to app_owner;
revoke all on function app.staff_review_coach_application(uuid,integer,text,text,text,uuid) from public;
grant execute on function app.staff_review_coach_application(uuid,integer,text,text,text,uuid) to app_runtime;
