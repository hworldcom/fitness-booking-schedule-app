-- MOV-108: staff mail for committed, completed applications only; no backfill.
create table app.coach_application_emails (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references app.coach_applications(profile_id) on delete cascade,
  run_id uuid not null references app.demo_runs(id),
  application_revision integer not null check(application_revision between 1 and 1000000),
  display_name text not null check(length(display_name) between 2 and 80),
  submitted_at timestamptz not null default statement_timestamp(),
  due_at timestamptz not null default statement_timestamp(),
  state text not null default 'queued' check(state in ('queued','claimed','sending','accepted','suppressed','failed','unknown')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text check(length(provider_id) between 1 and 200),
  finished_at timestamptz,
  unique(profile_id,application_revision),
  check((lease_id is null)=(lease_until is null))
);
alter table app.coach_application_emails owner to app_owner;
alter table app.coach_application_emails enable row level security;
alter table app.coach_application_emails force row level security;
revoke all on app.coach_application_emails from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create policy internal on app.coach_application_emails to app_owner using(true) with check(true);
create index coach_application_emails_due on app.coach_application_emails(due_at,id) where state in ('queued','claimed','sending');

-- Owner-only SELECT context, restored before returning to the surrounding mutation.
-- This adds no table privilege or policy for application/browser/worker roles.
do $$ declare relation text;begin
  foreach relation in array array['coach_applications','coach_profiles','profiles','demo_run_participants','demo_runs'] loop
    execute format('create policy coach_application_email_capture on app.%I for select to app_owner using(current_setting(''app.coach_application_email_capture'',true)=''on'')',relation);
  end loop;
end $$;

-- Called only from canonical row triggers. A preliminary pending intent has no profile.
create function app.capture_coach_application_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous_flag text:=coalesce(current_setting('app.coach_application_email_capture',true),'');
begin
  if tg_table_name='coach_applications' then
    if new.status<>'pending' then return new;end if;
    if tg_op='UPDATE' then
      if old.status<>'rejected' then return new;end if;
    end if;
  end if;
  perform set_config('app.coach_application_email_capture','on',true);
  insert into app.coach_application_emails(profile_id,run_id,application_revision,display_name)
  select a.profile_id,c.run_id,a.revision,c.display_name
  from app.coach_applications a
  join app.coach_profiles c on c.profile_id=a.profile_id
  join app.profiles p on p.id=a.profile_id
  join app.demo_run_participants m on m.profile_id=p.id and m.run_id=c.run_id
  join app.demo_runs d on d.id=m.run_id
  where a.profile_id=new.profile_id and a.status='pending' and p.record_source='user'
    and p.auth_user_id is not null and p.claimed_at is not null and m.status='active'
    and d.status='active' and d.catalogue_visibility='public'
  on conflict(profile_id,application_revision) do nothing;
  perform set_config('app.coach_application_email_capture',previous_flag,true);
  return new;
exception when others then
  perform set_config('app.coach_application_email_capture',previous_flag,true);
  raise;
end $$;
alter function app.capture_coach_application_email() owner to app_owner;
revoke all on function app.capture_coach_application_email() from public,app_runtime,app_notification_worker;
create trigger coach_application_submission_email after insert or update on app.coach_applications
for each row execute function app.capture_coach_application_email();
create trigger coach_profile_submission_email after insert on app.coach_profiles
for each row execute function app.capture_coach_application_email();

-- Only one existing queue job can resolve its applicant's verified contact address.
create function app.coach_application_applicant_email(job uuid) returns text
language sql stable security definer set search_path='' as $$
  select u.email from app.coach_application_emails j
  join app.profiles p on p.id=j.profile_id
  join app.coach_profiles c on c.profile_id=p.id and c.run_id=j.run_id
  join app.demo_run_participants m on m.profile_id=p.id and m.run_id=j.run_id
  join app.demo_runs d on d.id=m.run_id
  join auth.users u on u.id=p.auth_user_id
  where j.id=job and p.record_source='user' and p.claimed_at is not null
    and m.status='active' and d.status='active' and d.catalogue_visibility='public'
    and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and u.email is not null and u.email<>''
$$;
alter function app.coach_application_applicant_email(uuid) owner to postgres;
revoke all on function app.coach_application_applicant_email(uuid) from public,app_runtime,app_notification_worker;
grant execute on function app.coach_application_applicant_email(uuid) to app_owner;

create function app.prepare_coach_application_email(job uuid,lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j app.coach_application_emails;contact text;
begin
  select * into j from app.coach_application_emails where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return null;end if;
  contact:=app.coach_application_applicant_email(j.id);
  if j.due_at>statement_timestamp() or contact is null then
    update app.coach_application_emails set state='suppressed',lease_id=null,lease_until=null,finished_at=statement_timestamp() where id=j.id;
    return null;
  end if;
  update app.coach_application_emails set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  return jsonb_build_object('id',j.id,'kind','coach-application','email','hello@movx.club',
    'profileId',j.profile_id,'applicationRevision',j.application_revision,'displayName',j.display_name,
    'submittedAt',j.submitted_at,'applicantEmail',contact);
end $$;
alter function app.prepare_coach_application_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_coach_application_email(uuid,uuid) from public;
grant execute on function app.prepare_coach_application_email(uuid,uuid) to app_notification_worker;

create function app.claim_coach_application_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';
  end if;
  -- Expiry after possible handoff is ambiguous: quarantine, never auto resend.
  with expired as (
    select id from app.coach_application_emails where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.coach_application_emails j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select j.id from app.coach_application_emails j where j.attempts<5 and j.due_at<=statement_timestamp()
      and (j.state='queued' or (j.state='claimed' and j.lease_until<=statement_timestamp()))
    order by j.due_at,j.id for update skip locked limit batch_size
  ), claimed as (
    update app.coach_application_emails j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  -- A worker dying on its fifth pre-send claim must not leave a stuck claim.
  with exhausted as (
    select id from app.coach_application_emails where attempts=5 and state='claimed'
      and lease_until<=statement_timestamp() order by lease_until,id
    for update skip locked limit batch_size
  ) update app.coach_application_emails j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_coach_application_emails(integer) owner to app_owner;
revoke all on function app.claim_coach_application_emails(integer) from public;
grant execute on function app.claim_coach_application_emails(integer) to app_notification_worker;

create function app.finish_coach_application_email(job uuid, lease uuid, outcome text, provider text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare j app.coach_application_emails;
begin
  if outcome not in ('accepted','retry','failed','unknown') or outcome is null
    or length(provider)>200 then raise exception 'invalid notification result' using errcode='P0001'; end if;
  select * into j from app.coach_application_emails where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return false; end if;
  update app.coach_application_emails set state=case
      when outcome='retry' and j.attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+
      make_interval(secs=>least(3600,30*power(2,j.attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider,finished_at=statement_timestamp()
    where id=j.id;
  return true;
end $$;
alter function app.finish_coach_application_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_coach_application_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_coach_application_email(uuid,uuid,text,text) to app_notification_worker;


-- An explicit new worker contract; legacy v1/v2/v3 claims leave staff mail queued.
create function app.claim_notification_emails_v4(batch_size integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare applications jsonb;existing jsonb;remaining integer;
begin
  if batch_size is null or batch_size<4 or batch_size>20 then raise exception 'invalid notification batch' using errcode='P0001';end if;
  applications:=app.claim_coach_application_emails(greatest(1,batch_size/4));
  existing:=app.claim_notification_emails_v3(batch_size-jsonb_array_length(applications));
  remaining:=batch_size-jsonb_array_length(applications)-jsonb_array_length(existing);
  if remaining>0 then applications:=applications||app.claim_coach_application_emails(remaining);end if;
  return existing||(select coalesce(jsonb_agg(value||jsonb_build_object('kind','coach-application')),'[]') from jsonb_array_elements(applications));
end $$;
alter function app.claim_notification_emails_v4(integer) owner to app_owner;
revoke all on function app.claim_notification_emails_v4(integer) from public;
grant execute on function app.claim_notification_emails_v4(integer) to app_notification_worker;
