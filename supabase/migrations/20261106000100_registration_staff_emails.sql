-- MOV-175: staff alerts for future committed Auth registrations, before verification/onboarding.
create table app.registration_emails (
  id uuid primary key default gen_random_uuid(),
  -- Historical event reference, not login authority. A deleted account suppresses unsent mail.
  auth_user_id uuid not null unique,
  signup_email text not null check(length(signup_email) between 3 and 320 and signup_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'),
  registered_at timestamptz not null,
  provider text not null check(provider in ('email','google','other')),
  verified_at_signup boolean not null,
  due_at timestamptz not null default statement_timestamp(),
  state text not null default 'queued' check(state in ('queued','claimed','sending','accepted','suppressed','failed','unknown')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text check(length(provider_id) between 1 and 200),
  finished_at timestamptz,
  check((lease_id is null)=(lease_until is null))
);
alter table app.registration_emails owner to app_owner;
alter table app.registration_emails enable row level security;
alter table app.registration_emails force row level security;
revoke all on app.registration_emails from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create policy internal on app.registration_emails to app_owner using(true) with check(true);
create index registration_emails_due on app.registration_emails(due_at,id) where state in ('queued','claimed','sending');

create function app.capture_registration_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.is_anonymous is true or new.email is null or length(new.email)>320
    or new.email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then return new;end if;
  insert into app.registration_emails(auth_user_id,signup_email,registered_at,provider,verified_at_signup)
  values(new.id,new.email,coalesce(new.created_at,statement_timestamp()),
    case when new.raw_app_meta_data->>'provider' in ('email','google') then new.raw_app_meta_data->>'provider' else 'other' end,
    new.email_confirmed_at is not null)
  on conflict(auth_user_id) do nothing;
  return new;
end $$;
alter function app.capture_registration_email() owner to app_owner;
revoke all on function app.capture_registration_email() from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create trigger registration_staff_email after insert on auth.users
for each row execute function app.capture_registration_email();

-- Only an existing private job may check its source account; no Auth-wide worker grant.
-- Lock through this short preparation transaction, never across provider I/O.
create function app.registration_email_account_eligible(job uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare subject uuid;
begin
  select u.id into subject from app.registration_emails j join auth.users u on u.id=j.auth_user_id
  where j.id=job and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and u.is_anonymous is not true
  for share of u;
  return found;
end $$;
alter function app.registration_email_account_eligible(uuid) owner to postgres;
revoke all on function app.registration_email_account_eligible(uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
grant execute on function app.registration_email_account_eligible(uuid) to app_owner;

create function app.prepare_registration_email(job uuid,lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j app.registration_emails;
begin
  select * into j from app.registration_emails where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return null;end if;
  if j.due_at>statement_timestamp() or not app.registration_email_account_eligible(j.id) then
    update app.registration_emails set state='suppressed',lease_id=null,lease_until=null,finished_at=statement_timestamp() where id=j.id;
    return null;
  end if;
  update app.registration_emails set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  return jsonb_build_object('id',j.id,'kind','registration','email','hello@movx.club',
    'authUserId',j.auth_user_id,'signupEmail',j.signup_email,'registeredAt',j.registered_at,
    'provider',j.provider,'verifiedAtSignup',j.verified_at_signup);
end $$;
alter function app.prepare_registration_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_registration_email(uuid,uuid) from public;
grant execute on function app.prepare_registration_email(uuid,uuid) to app_notification_worker;

create function app.claim_registration_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';end if;
  with expired as (
    select id from app.registration_emails where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.registration_emails j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select id from app.registration_emails where attempts<5 and due_at<=statement_timestamp()
      and (state='queued' or (state='claimed' and lease_until<=statement_timestamp()))
    order by due_at,id for update skip locked limit batch_size
  ), claimed as (
    update app.registration_emails j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  with exhausted as (
    select id from app.registration_emails where attempts=5 and state='claimed' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.registration_emails j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_registration_emails(integer) owner to app_owner;
revoke all on function app.claim_registration_emails(integer) from public;
grant execute on function app.claim_registration_emails(integer) to app_notification_worker;

create function app.finish_registration_email(job uuid,lease uuid,outcome text,provider_result text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare j app.registration_emails;
begin
  if outcome is null or outcome not in ('accepted','retry','failed','unknown') or length(provider_result)>200 then
    raise exception 'invalid notification result' using errcode='P0001';end if;
  select * into j from app.registration_emails where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return false;end if;
  update app.registration_emails set state=case when outcome='retry' and attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+make_interval(secs=>least(3600,30*power(2,attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider_result,finished_at=statement_timestamp() where id=j.id;
  return true;
end $$;
alter function app.finish_registration_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_registration_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_registration_email(uuid,uuid,text,text) to app_notification_worker;

-- Opt-in only: existing worker contracts and recipient/bell APIs stay unchanged.
create function app.claim_notification_emails_v6(batch_size integer default 6) returns jsonb
language plpgsql security definer set search_path='' as $$
declare registrations jsonb;existing jsonb;remaining integer;
begin
  if batch_size is null or batch_size<6 or batch_size>20 then raise exception 'invalid notification batch' using errcode='P0001';end if;
  registrations:=app.claim_registration_emails(greatest(1,batch_size/6));
  existing:=app.claim_notification_emails_v5(batch_size-jsonb_array_length(registrations));
  remaining:=batch_size-jsonb_array_length(registrations)-jsonb_array_length(existing);
  if remaining>0 then registrations:=registrations||app.claim_registration_emails(remaining);end if;
  -- Prepare staff signup notices before a busy legacy batch can exhaust its time budget.
  return (select coalesce(jsonb_agg(value||jsonb_build_object('kind','registration')),'[]'::jsonb) from jsonb_array_elements(registrations))||existing;
end $$;
alter function app.claim_notification_emails_v6(integer) owner to app_owner;
revoke all on function app.claim_notification_emails_v6(integer) from public;
grant execute on function app.claim_notification_emails_v6(integer) to app_notification_worker;
