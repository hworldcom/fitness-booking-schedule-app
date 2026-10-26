-- MOV-109: private review contacts; no public-profile columns or historical backfill.
create function app.valid_application_social_url(value text, host text) returns boolean
language sql immutable set search_path='' as $$
  select value is null or (
    length(value) between 1 and 500
    and value ~ ('^https://(www\.)?' || replace(host,'.','\.') || '/[A-Za-z0-9][A-Za-z0-9._~!$&''()*+,;=:@/%?-]*$')
    and value !~* '%(00|0a|0d)'
  )
$$;
alter function app.valid_application_social_url(text,text) owner to app_owner;
revoke all on function app.valid_application_social_url(text,text) from public;

create function app.valid_coach_application_contact(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value ?& array['phoneNumber','instagramUrl','facebookUrl','linkedinUrl']
    and value - array['phoneNumber','instagramUrl','facebookUrl','linkedinUrl']='{}'::jsonb
    and jsonb_typeof(value->'phoneNumber')='string'
    and value->>'phoneNumber' ~ '^\+[1-9][0-9]{6,14}$'
    and jsonb_typeof(value->'instagramUrl') in ('string','null')
    and jsonb_typeof(value->'facebookUrl') in ('string','null')
    and jsonb_typeof(value->'linkedinUrl') in ('string','null')
    and app.valid_application_social_url(value->>'instagramUrl','instagram.com')
    and app.valid_application_social_url(value->>'facebookUrl','facebook.com')
    and app.valid_application_social_url(value->>'linkedinUrl','linkedin.com'), false)
$$;
alter function app.valid_coach_application_contact(jsonb) owner to app_owner;
revoke all on function app.valid_coach_application_contact(jsonb) from public;

create table app.coach_application_contacts (
  profile_id uuid primary key references app.coach_applications(profile_id) on delete cascade,
  run_id uuid not null references app.demo_runs(id),
  details jsonb not null check(app.valid_coach_application_contact(details)),
  revision integer not null default 1 check(revision between 1 and 1000000),
  updated_at timestamptz not null default statement_timestamp()
);
alter table app.coach_application_contacts owner to app_owner;
alter table app.coach_application_contacts enable row level security;
alter table app.coach_application_contacts force row level security;
revoke all on app.coach_application_contacts from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create policy internal on app.coach_application_contacts to app_owner using(true) with check(true);

create function app.current_owned_coach_application_contact() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not app.authorized_actor_context_valid(null,null,null) then
    raise exception 'application contact actor is invalid' using errcode='P0001';
  end if;
  select details || jsonb_build_object('revision',revision) into result
  from app.coach_application_contacts
  where profile_id=current_setting('app.current_profile_id')::uuid
    and run_id=current_setting('app.current_run_id')::uuid;
  return result;
end $$;
alter function app.current_owned_coach_application_contact() owner to app_owner;
revoke all on function app.current_owned_coach_application_contact() from public;
grant execute on function app.current_owned_coach_application_contact() to app_runtime;

create function app.save_owned_coach_application_contact(expected_revision integer, requested_details jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare p uuid; r uuid; application_status text; c app.coach_application_contacts;
  previous_flag text:=coalesce(current_setting('app.coach_application_management',true),'');
begin
  if not app.authorized_actor_context_valid(null,null,null)
    or expected_revision is null or expected_revision not between 0 and 1000000
    or not app.valid_coach_application_contact(requested_details) then
    raise exception 'application contact details or actor are invalid' using errcode='P0001';
  end if;
  p:=current_setting('app.current_profile_id')::uuid;
  r:=current_setting('app.current_run_id')::uuid;
  -- Serialize with review/resubmission, then preserve the caller's policy context.
  perform set_config('app.coach_application_management','on',true);
  select status into application_status from app.coach_applications where profile_id=p for update;
  perform set_config('app.coach_application_management',previous_flag,true);
  if application_status is null or application_status not in ('pending','rejected') then
    raise exception 'application contact is unavailable' using errcode='P0001';
  end if;
  select * into c from app.coach_application_contacts where profile_id=p for update;
  if found then
    if c.run_id<>r then
      raise exception 'application contact workspace is invalid' using errcode='P0001';
    end if;
    -- Recover an exact retry after a lost response, without advancing revision.
    if c.details=requested_details then return c.revision;end if;
  end if;
  if expected_revision<>coalesce(c.revision,0) then
    raise exception 'application contact changed; reload before saving' using errcode='40001';
  end if;
  insert into app.coach_application_contacts(profile_id,run_id,details)
  values(p,r,requested_details)
  on conflict(profile_id) do update set details=excluded.details,
    revision=app.coach_application_contacts.revision+1,updated_at=statement_timestamp()
  returning revision into c.revision;
  return c.revision;
exception when others then
  perform set_config('app.coach_application_management',previous_flag,true);
  raise;
end $$;
alter function app.save_owned_coach_application_contact(integer,jsonb) owner to app_owner;
revoke all on function app.save_owned_coach_application_contact(integer,jsonb) from public;
grant execute on function app.save_owned_coach_application_contact(integer,jsonb) to app_runtime;

-- A preliminary pending intent is still permitted. Enforce contact at actual
-- completion and explicit rejected->pending resubmission, even for old clients.
create function app.require_coach_application_contact() returns trigger
language plpgsql security definer set search_path='' as $$
declare needs_contact boolean:=false; r uuid;
  previous_flag text:=coalesce(current_setting('app.coach_application_email_capture',true),'');
begin
  perform set_config('app.coach_application_email_capture','on',true);
  if tg_table_name='coach_profiles' then
    r:=new.run_id;
    needs_contact:=not new.is_demo and exists(
      select 1 from app.coach_applications where profile_id=new.profile_id and status in ('pending','rejected'));
  else
    needs_contact:=old.status='rejected' and new.status='pending';
    if needs_contact then
      select run_id into r from app.coach_profiles where profile_id=new.profile_id;
    end if;
  end if;
  if needs_contact and (r is null or not exists(
    select 1 from app.coach_application_contacts where profile_id=new.profile_id and run_id=r
  )) then
    raise exception 'coach application requires a saved contact phone number' using errcode='P0001';
  end if;
  perform set_config('app.coach_application_email_capture',previous_flag,true);
  return new;
exception when others then
  perform set_config('app.coach_application_email_capture',previous_flag,true);
  raise;
end $$;
alter function app.require_coach_application_contact() owner to app_owner;
revoke all on function app.require_coach_application_contact() from public,app_runtime,app_notification_worker;
create trigger coach_profile_requires_contact before insert on app.coach_profiles
for each row execute function app.require_coach_application_contact();
create trigger coach_resubmission_requires_contact before update on app.coach_applications
for each row execute function app.require_coach_application_contact();

alter table app.coach_application_emails add column contact_details jsonb
  check(contact_details is null or app.valid_coach_application_contact(contact_details));

-- Extend canonical capture with a submission-time contact snapshot. Historical
-- jobs remain NULL and deliver without invented contact information.
create or replace function app.capture_coach_application_email() returns trigger
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
  insert into app.coach_application_emails(profile_id,run_id,application_revision,display_name,contact_details)
  select a.profile_id,c.run_id,a.revision,c.display_name,contact.details
  from app.coach_applications a
  join app.coach_profiles c on c.profile_id=a.profile_id
  join app.profiles p on p.id=a.profile_id
  join app.demo_run_participants m on m.profile_id=p.id and m.run_id=c.run_id
  join app.demo_runs d on d.id=m.run_id
  left join app.coach_application_contacts contact on contact.profile_id=a.profile_id and contact.run_id=c.run_id
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

create or replace function app.prepare_coach_application_email(job uuid,lease uuid) returns jsonb
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
    'submittedAt',j.submitted_at,'applicantEmail',contact,'applicationContact',j.contact_details);
end $$;
