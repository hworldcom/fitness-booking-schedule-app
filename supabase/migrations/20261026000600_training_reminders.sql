-- MOV-120: independent deadline-driven lane; no edits to existing outbox functions.
alter table app.athlete_training_preferences add column scanned_at timestamptz not null default '-infinity';
create table app.athlete_training_reminders (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references app.demo_runs(id),profile_id uuid not null references app.profiles(id),
 occurrence_key text not null, starts_at timestamptz not null, due_at timestamptz not null,
 state text not null default 'queued' check(state in('queued','claimed','sending','accepted','suppressed','failed','unknown')),
 attempts integer not null default 0 check(attempts between 0 and 5),lease_id uuid,lease_until timestamptz,provider_id text,
 unique(run_id,profile_id,occurrence_key,starts_at),check((lease_id is null)=(lease_until is null)),check(due_at>=starts_at-interval '1 hour')
);
alter table app.athlete_training_reminders owner to app_owner;
alter table app.athlete_training_reminders enable row level security;
alter table app.athlete_training_reminders force row level security;
revoke all on app.athlete_training_reminders from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
create policy internal on app.athlete_training_reminders to app_owner using(true) with check(true);
create index athlete_training_reminders_due on app.athlete_training_reminders(due_at,starts_at) where state in('queued','claimed','sending');

create function app.training_reminder_email(job uuid) returns text language sql stable security definer set search_path='' as $$
 select u.email from app.athlete_training_reminders j join app.profiles p on p.id=j.profile_id
 join app.demo_run_participants m on m.profile_id=p.id and m.run_id=j.run_id
 join app.demo_runs d on d.id=m.run_id join auth.users u on u.id=p.auth_user_id
 where j.id=job and p.record_source='user' and p.claimed_at is not null and m.status='active'
 and d.status='active' and d.catalogue_visibility='public' and u.email_confirmed_at is not null and u.deleted_at is null
 and (u.banned_until is null or u.banned_until<=statement_timestamp()) and u.email is not null and u.email<>''
$$;
alter function app.training_reminder_email(uuid) owner to postgres;
revoke all on function app.training_reminder_email(uuid) from public,anon,authenticated,service_role,app_runtime,app_notification_worker;
grant execute on function app.training_reminder_email(uuid) to app_owner;

create function app.claim_training_reminders() returns jsonb language plpgsql security definer set search_path='' as $$
declare p app.athlete_training_preferences;result jsonb;
begin
 -- Fair round-robin owner discovery; each opted-in owner is scanned in bounded work.
 for p in select * from app.athlete_training_preferences where reminders_enabled
  order by scanned_at,run_id,profile_id for update skip locked limit 100 loop
  insert into app.athlete_training_reminders(run_id,profile_id,occurrence_key,starts_at,due_at)
  select p.run_id,p.profile_id,item->>'key',(item->>'startsAt')::timestamptz,(item->>'startsAt')::timestamptz-interval '1 hour'
  from app.athlete_training_items(p.profile_id,p.run_id,statement_timestamp(),statement_timestamp()+interval '1 hour')
  where (item->>'startsAt')::timestamptz>statement_timestamp() and item->>'attendance'='planned'
   and ((item->>'source'='personal' and item->>'state'='planned') or (item->>'source' in('booking','group') and item->>'state'='confirmed'))
  on conflict(run_id,profile_id,occurrence_key,starts_at) do update set state='queued',due_at=excluded.due_at
   where app.athlete_training_reminders.state='suppressed' and app.athlete_training_reminders.attempts<5;
  update app.athlete_training_preferences set scanned_at=statement_timestamp() where run_id=p.run_id and profile_id=p.profile_id;
 end loop;
 -- Expired possible handoffs stay Unknown; they are never blindly resent.
 with expired as(select id from app.athlete_training_reminders where state='sending' and lease_until<=statement_timestamp() for update skip locked limit 100)
 update app.athlete_training_reminders j set state='unknown',lease_id=null,lease_until=null from expired where j.id=expired.id;
 with expired as(select id from app.athlete_training_reminders where (state in('queued','claimed') and starts_at<=statement_timestamp())
  or (state='claimed' and attempts=5 and lease_until<=statement_timestamp()) for update skip locked limit 100)
 update app.athlete_training_reminders j set state='suppressed',lease_id=null,lease_until=null from expired where j.id=expired.id;
 with candidates as(select id from app.athlete_training_reminders where due_at<=statement_timestamp() and starts_at>statement_timestamp()
  and attempts<5 and (state='queued' or(state='claimed' and lease_until<=statement_timestamp()))
  order by starts_at,id for update skip locked limit 5), claimed as(
  update app.athlete_training_reminders j set state='claimed',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
  from candidates where j.id=candidates.id returning j.id,j.lease_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id,'kind','training')),'[]') into result from claimed;
 return result;
end $$;

create function app.prepare_training_reminder(job uuid,lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j app.athlete_training_reminders;contact text;current_item jsonb;
begin
 select * into j from app.athlete_training_reminders where id=job for update;
 if not found or j.state<>'claimed' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return null;end if;
 contact:=app.training_reminder_email(job);
 select item into current_item from app.athlete_training_items(j.profile_id,j.run_id,j.starts_at-interval '1 minute',j.starts_at+interval '1 minute') where item->>'key'=j.occurrence_key;
 if contact is null or j.starts_at<=statement_timestamp() or j.starts_at>statement_timestamp()+interval '1 hour' or j.due_at>statement_timestamp()
  or not coalesce((select reminders_enabled from app.athlete_training_preferences where run_id=j.run_id and profile_id=j.profile_id),false)
  or current_item is null or (current_item->>'startsAt')::timestamptz<>j.starts_at or current_item->>'attendance'<>'planned'
  or not((current_item->>'source'='personal' and current_item->>'state'='planned') or(current_item->>'source' in('booking','group') and current_item->>'state'='confirmed')) then
  update app.athlete_training_reminders set state='suppressed',lease_id=null,lease_until=null where id=job;return null;
 end if;
 update app.athlete_training_reminders set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=job;
 return jsonb_build_object('id',job,'kind','training','email',contact,'title',current_item->>'title','startsAt',j.starts_at,'timezone',current_item->>'timezone',
  'href','/sessions/calendar?date='||(j.starts_at at time zone (current_item->>'timezone'))::date||'&timezone='||replace(replace(current_item->>'timezone','/','%2F'),'+','%2B')||'&selected='||j.occurrence_key);
end $$;

create function app.finish_training_reminder(job uuid,lease uuid,outcome text,provider text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare j app.athlete_training_reminders;
begin
 if outcome is null or outcome not in('accepted','retry','failed','unknown') or length(provider)>200 then raise exception 'invalid training delivery outcome' using errcode='22023';end if;
 select * into j from app.athlete_training_reminders where id=job for update;
 if not found or j.state<>'sending' or j.lease_id is distinct from lease or j.lease_until<=statement_timestamp() then return false;end if;
 update app.athlete_training_reminders set state=case when outcome='retry' and attempts<5 and starts_at>statement_timestamp() then 'queued' when outcome='retry' then 'failed' else outcome end,
 due_at=case when outcome='retry' then statement_timestamp()+make_interval(secs=>least(300,30*power(2,attempts-1))::integer) else due_at end,
 provider_id=provider,lease_id=null,lease_until=null where id=job;return true;
end $$;
alter function app.claim_training_reminders() owner to app_owner;
alter function app.prepare_training_reminder(uuid,uuid) owner to app_owner;
alter function app.finish_training_reminder(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.claim_training_reminders(),app.prepare_training_reminder(uuid,uuid),app.finish_training_reminder(uuid,uuid,text,text) from public,anon,authenticated,service_role,app_runtime;
grant execute on function app.claim_training_reminders(),app.prepare_training_reminder(uuid,uuid),app.finish_training_reminder(uuid,uuid,text,text) to app_notification_worker;
