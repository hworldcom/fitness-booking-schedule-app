-- MOV-176: a distinct first-email-verification event and bounded staff-only Users projection.
create table app.verification_emails (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  verified_email text not null check(length(verified_email) between 3 and 320 and verified_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'),
  registered_at timestamptz not null,
  verified_at timestamptz not null,
  provider text not null check(provider in ('email','google','other')),
  due_at timestamptz not null default statement_timestamp(),
  state text not null default 'queued' check(state in ('queued','claimed','sending','accepted','suppressed','failed','unknown')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text check(length(provider_id) between 1 and 200),
  finished_at timestamptz,
  check((lease_id is null)=(lease_until is null))
);
alter table app.verification_emails owner to app_owner;
alter table app.verification_emails enable row level security;
alter table app.verification_emails force row level security;
revoke all on app.verification_emails from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create policy internal on app.verification_emails to app_owner using(true) with check(true);
create index verification_emails_due on app.verification_emails(due_at,id) where state in ('queued','claimed','sending');

create function app.capture_verification_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is null or new.deleted_at is not null or new.is_anonymous is true
    or new.email is null or length(new.email)>320
    or new.email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$' then return new;end if;
  if tg_op='UPDATE' then
    if old.email_confirmed_at is not null then return new;end if;
  end if;
  insert into app.verification_emails(auth_user_id,verified_email,registered_at,verified_at,provider)
  values(new.id,new.email,coalesce(new.created_at,statement_timestamp()),new.email_confirmed_at,
    case when new.raw_app_meta_data->>'provider' in ('email','google') then new.raw_app_meta_data->>'provider' else 'other' end)
  on conflict(auth_user_id) do nothing;
  return new;
end $$;
alter function app.capture_verification_email() owner to app_owner;
revoke all on function app.capture_verification_email() from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
create trigger registration_verification_staff_email after insert or update of email_confirmed_at on auth.users
for each row execute function app.capture_verification_email();

create function app.verification_email_account_eligible(job uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare subject uuid;
begin
  select u.id into subject from app.verification_emails j join auth.users u on u.id=j.auth_user_id
  where j.id=job and u.deleted_at is null and u.is_anonymous is not true
    and u.email_confirmed_at is not null and u.email=j.verified_email
    and (u.banned_until is null or u.banned_until<=statement_timestamp())
  for share of u;
  return found;
end $$;
alter function app.verification_email_account_eligible(uuid) owner to postgres;
revoke all on function app.verification_email_account_eligible(uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
grant execute on function app.verification_email_account_eligible(uuid) to app_owner;

create function app.prepare_verification_email(job uuid,lease uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j app.verification_emails;
begin
  select * into j from app.verification_emails where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return null;end if;
  if j.due_at>statement_timestamp() or not app.verification_email_account_eligible(j.id) then
    update app.verification_emails set state='suppressed',lease_id=null,lease_until=null,finished_at=statement_timestamp() where id=j.id;
    return null;
  end if;
  update app.verification_emails set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  return jsonb_build_object('id',j.id,'kind','verification','email','hello@movx.club',
    'authUserId',j.auth_user_id,'verifiedEmail',j.verified_email,'registeredAt',j.registered_at,
    'verifiedAt',j.verified_at,'provider',j.provider);
end $$;
alter function app.prepare_verification_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_verification_email(uuid,uuid) from public;
grant execute on function app.prepare_verification_email(uuid,uuid) to app_notification_worker;

create function app.claim_verification_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';end if;
  with expired as (
    select id from app.verification_emails where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.verification_emails j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select id from app.verification_emails where attempts<5 and due_at<=statement_timestamp()
      and (state='queued' or (state='claimed' and lease_until<=statement_timestamp()))
    order by due_at,id for update skip locked limit batch_size
  ), claimed as (
    update app.verification_emails j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  with exhausted as (
    select id from app.verification_emails where attempts=5 and state='claimed' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.verification_emails j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_verification_emails(integer) owner to app_owner;
revoke all on function app.claim_verification_emails(integer) from public;
grant execute on function app.claim_verification_emails(integer) to app_notification_worker;

create function app.finish_verification_email(job uuid,lease uuid,outcome text,provider_result text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare j app.verification_emails;
begin
  if outcome is null or outcome not in ('accepted','retry','failed','unknown') or length(provider_result)>200 then
    raise exception 'invalid notification result' using errcode='P0001';end if;
  select * into j from app.verification_emails where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return false;end if;
  update app.verification_emails set state=case when outcome='retry' and attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+make_interval(secs=>least(3600,30*power(2,attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider_result,finished_at=statement_timestamp() where id=j.id;
  return true;
end $$;
alter function app.finish_verification_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_verification_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_verification_email(uuid,uuid,text,text) to app_notification_worker;

-- Earlier contracts leave the distinct verification queue untouched.
create function app.claim_notification_emails_v7(batch_size integer default 7) returns jsonb
language plpgsql security definer set search_path='' as $$
declare verifications jsonb;existing jsonb;remaining integer;
begin
  if batch_size is null or batch_size<7 or batch_size>20 then raise exception 'invalid notification batch' using errcode='P0001';end if;
  verifications:=app.claim_verification_emails(greatest(1,batch_size/7));
  existing:=app.claim_notification_emails_v6(batch_size-jsonb_array_length(verifications));
  remaining:=batch_size-jsonb_array_length(verifications)-jsonb_array_length(existing);
  if remaining>0 then verifications:=verifications||app.claim_verification_emails(remaining);end if;
  return (select coalesce(jsonb_agg(value||jsonb_build_object('kind','verification')),'[]'::jsonb) from jsonb_array_elements(verifications))||existing;
end $$;
alter function app.claim_notification_emails_v7(integer) owner to app_owner;
revoke all on function app.claim_notification_emails_v7(integer) from public;
grant execute on function app.claim_notification_emails_v7(integer) to app_notification_worker;

-- Minimal projection only. Staff authority is rechecked inside this Auth-reading boundary.
-- Enrolled accounts require current-dataset membership; unassigned signups remain visible.
create function app.staff_registration_accounts(requested_status text default 'all',requested_query text default '',
  before_at timestamptz default null,before_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; q text:=btrim(requested_query); dataset uuid;
begin
  perform app.require_platform_staff();
  dataset:=current_setting('app.current_run_id')::uuid;
  if requested_status is null or requested_status not in ('all','verified','unverified')
    or q is null or char_length(q)>254 or q ~ '[[:cntrl:]]'
    or (before_at is null)<>(before_user is null) or (before_at is not null and not isfinite(before_at)) then
    raise exception 'user filter is invalid' using errcode='P0001';end if;
  with eligible as (
    select u.id,u.email,u.created_at,u.email_confirmed_at,
      coalesce(u.created_at,'1970-01-01T00:00:00Z'::timestamptz) sort_at,
      case when u.raw_app_meta_data->>'provider' in ('email','google') then u.raw_app_meta_data->>'provider' else 'other' end provider,
      p.display_name,p.id is not null profile_complete,r.state signup_state,v.state verification_state
    from auth.users u left join app.profiles p on p.auth_user_id=u.id
      left join app.registration_emails r on r.auth_user_id=u.id
      left join app.verification_emails v on v.auth_user_id=u.id
    where u.deleted_at is null and u.is_anonymous is not true and u.email is not null
      and length(u.email) between 3 and 320 and u.email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+[.][^[:space:]<>@]+$'
      and (p.id is null or (p.record_source='user' and exists(select 1 from app.demo_run_participants m
        where m.profile_id=p.id and m.run_id=dataset and m.status='active')))
      and (requested_status='all' or (requested_status='verified' and u.email_confirmed_at is not null)
        or (requested_status='unverified' and u.email_confirmed_at is null))
      and (q='' or strpos(lower(u.email),lower(q))>0)
      and (before_at is null or (coalesce(u.created_at,'1970-01-01T00:00:00Z'::timestamptz),u.id)<(before_at,before_user))
    order by coalesce(u.created_at,'1970-01-01T00:00:00Z'::timestamptz) desc,u.id desc limit 21
  ), page as(select * from eligible order by sort_at desc,id desc limit 20)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object(
    'authUserId',id,'email',email,'registeredAt',created_at,'verifiedAt',email_confirmed_at,'sortAt',sort_at,
    'provider',provider,'displayName',display_name,'profileComplete',profile_complete,
    'signupStatus',signup_state,'verificationStatus',verification_state)order by sort_at desc,id desc)from page),'[]'::jsonb),
    'hasMore',(select count(*)>20 from eligible),'filter',requested_status,'query',q) into result;
  return result;
end $$;
alter function app.staff_registration_accounts(text,text,timestamptz,uuid) owner to postgres;
revoke all on function app.staff_registration_accounts(text,text,timestamptz,uuid) from public,anon,authenticated,service_role,app_notification_worker,app_media_worker;
grant execute on function app.staff_registration_accounts(text,text,timestamptz,uuid) to app_runtime;
