-- MOV-79: new activity only; existing message/history/read rows are untouched.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_notification_worker') then
    create role app_notification_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end $$;
grant usage on schema app to app_notification_worker;
-- Migration/operator authority only; ordinary app logins never inherit this role.
grant app_notification_worker to postgres;

create table app.notifications (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  recipient_profile_id uuid not null,
  entry_id uuid not null references app.message_entries(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz,
  unique (entry_id, recipient_profile_id),
  foreign key (run_id, recipient_profile_id)
    references app.demo_run_participants(run_id, profile_id)
);
create index notification_recipient_history on app.notifications
  (run_id, recipient_profile_id, created_at desc, id desc);
create table app.notification_emails (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app.message_conversations(id) on delete cascade,
  recipient_profile_id uuid not null references app.profiles(id),
  first_entry_id uuid not null references app.message_entries(id) on delete cascade,
  due_at timestamptz not null default (statement_timestamp() + interval '5 minutes'),
  closed_at timestamptz,
  state text not null default 'queued'
    check (state in ('queued','claimed','sending','accepted','suppressed','failed','unknown')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  lease_id uuid,
  lease_until timestamptz,
  provider_id text check (length(provider_id) <= 200),
  finished_at timestamptz,
  check ((lease_id is null) = (lease_until is null))
);
create unique index notification_one_unread_period on app.notification_emails
  (conversation_id, recipient_profile_id) where closed_at is null;
create index notification_email_due on app.notification_emails (due_at, id)
  where state in ('queued','claimed','sending');
alter table app.notifications owner to app_owner;
alter table app.notification_emails owner to app_owner;
alter table app.notifications enable row level security;
alter table app.notifications force row level security;
alter table app.notification_emails enable row level security;
alter table app.notification_emails force row level security;
create policy notification_owner on app.notifications to app_owner using (true) with check (true);
create policy notification_owner on app.notification_emails to app_owner using (true) with check (true);
revoke all on app.notifications, app.notification_emails from public, app_runtime, app_notification_worker, anon, authenticated, service_role;

create function app.capture_message_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c app.message_conversations; recipient uuid;
begin
  if new.kind <> 'text' or new.sender_profile_id is null then return new; end if;
  select * into strict c from app.message_conversations where id = new.conversation_id;
  recipient := case when new.sender_profile_id = c.coach_profile_id
    then c.athlete_profile_id else c.coach_profile_id end;
  insert into app.notifications(run_id, recipient_profile_id, entry_id)
    values(c.run_id, recipient, new.id) on conflict do nothing;
  insert into app.notification_emails(conversation_id, recipient_profile_id, first_entry_id)
    values(c.id, recipient, new.id) on conflict (conversation_id, recipient_profile_id)
    where closed_at is null do nothing;
  return new;
end $$;
alter function app.capture_message_notification() owner to app_owner;
revoke all on function app.capture_message_notification() from public;
create trigger capture_message_notification after insert on app.message_entries
  for each row execute function app.capture_message_notification();

create function app.close_message_notification_period() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Use the same definition of unread as Messages, including incoming cards.
  if not exists (select 1 from app.message_entries e
    where e.conversation_id = new.conversation_id
      and e.sender_profile_id is distinct from new.profile_id and e.seq > new.last_seq) then
    update app.notification_emails set closed_at = statement_timestamp(),
      state = case when state in ('queued','claimed') then 'suppressed' else state end,
      lease_id = case when state in ('queued','claimed') then null else lease_id end,
      lease_until = case when state in ('queued','claimed') then null else lease_until end
    where conversation_id = new.conversation_id and recipient_profile_id = new.profile_id
      and closed_at is null;
  end if;
  return new;
end $$;
alter function app.close_message_notification_period() owner to app_owner;
revoke all on function app.close_message_notification_period() from public;
create trigger close_message_notification_period after insert or update on app.message_reads
  for each row execute function app.close_message_notification_period();

-- Caller must already have enabled mail flags. Never expose entry bodies.
create function app.notification_entry_allowed(entry uuid, recipient uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from app.message_entries e
    join app.message_conversations c on c.id = e.conversation_id
    left join app.message_contexts x on x.id = e.context_id
    where e.id = entry and recipient in (c.coach_profile_id,c.athlete_profile_id)
      and (app.mail_general_allowed(c)
        or (x.id is not null and app.mail_context_allowed(c,x))))
$$;
alter function app.notification_entry_allowed(uuid,uuid) owner to app_owner;
revoke all on function app.notification_entry_allowed(uuid,uuid) from public;

create function app.notification_command(action text, args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid; run uuid; result jsonb; items jsonb; cutoff timestamptz;
begin
  if not app.authorized_actor_context_valid(null,null,null) or args is null
    or jsonb_typeof(args) <> 'object' or octet_length(args::text) > 2048 then
    raise exception 'notification unavailable' using errcode='P0001';
  end if;
  actor := current_setting('app.current_profile_id')::uuid;
  run := current_setting('app.current_run_id')::uuid;
  perform app.mail_flags(true);
  if action = 'list' then
    if coalesce(args->>'filter','all') not in ('all','unread')
      or ((args->>'beforeAt' is null) <> (args->>'beforeId' is null)) then
      raise exception 'notification invalid cursor' using errcode='P0001';
    end if;
    select coalesce(jsonb_agg(v.data order by v.created_at desc,v.id desc),'[]') into items from (
      select n.id,n.created_at,jsonb_build_object('id',n.id,'createdAt',n.created_at,
        'readAt',n.read_at,'conversationId',e.conversation_id,
        'senderName',case when e.sender_profile_id=c.coach_profile_id then cp.display_name else p.display_name end) data
      from app.notifications n join app.message_entries e on e.id=n.entry_id
      join app.message_conversations c on c.id=e.conversation_id
      join app.profiles p on p.id=e.sender_profile_id
      join app.coach_profiles cp on cp.profile_id=c.coach_profile_id and cp.run_id=c.run_id
      where n.run_id=run and n.recipient_profile_id=actor
        and app.notification_entry_allowed(n.entry_id,actor)
        and (coalesce(args->>'filter','all')='all' or n.read_at is null)
        and (args->>'beforeAt' is null or (n.created_at,n.id)<((args->>'beforeAt')::timestamptz,(args->>'beforeId')::uuid))
      order by n.created_at desc,n.id desc limit 21
    ) v;
    result := jsonb_build_object('items',(select coalesce(jsonb_agg(v),'[]') from
      (select value v from jsonb_array_elements(items) with ordinality a(value,pos) where pos<=20 order by pos) page),
      'hasMore',jsonb_array_length(items)>20,'snapshotAt',statement_timestamp(),
      'unreadCount',(select count(*) from app.notifications n where n.run_id=run
        and n.recipient_profile_id=actor and n.read_at is null
        and app.notification_entry_allowed(n.entry_id,actor)));
  elsif action = 'read' then
    update app.notifications n set read_at=coalesce(n.read_at,statement_timestamp())
      where n.id=(args->>'id')::uuid and n.run_id=run and n.recipient_profile_id=actor
        and app.notification_entry_allowed(n.entry_id,actor);
    if not found then raise exception 'notification unavailable' using errcode='P0001'; end if;
    result := '{}'::jsonb;
  elsif action = 'read-all' then
    cutoff := (args->>'throughAt')::timestamptz;
    if cutoff is null or cutoff>statement_timestamp() then
      raise exception 'notification invalid cutoff' using errcode='P0001';
    end if;
    update app.notifications n set read_at=statement_timestamp() where n.run_id=run
      and n.recipient_profile_id=actor and n.read_at is null and n.created_at<=cutoff
      and app.notification_entry_allowed(n.entry_id,actor);
    result := '{}'::jsonb;
  else raise exception 'notification invalid action' using errcode='P0001';
  end if;
  perform app.mail_flags(false);
  return result;
exception when others then perform app.mail_flags(false); raise;
end $$;
alter function app.notification_command(text,jsonb) owner to app_owner;
revoke all on function app.notification_command(text,jsonb) from public;
grant execute on function app.notification_command(text,jsonb) to app_runtime;

-- The only Auth-reading helper. A runtime/worker cannot call it directly or
-- choose an arbitrary profile. No Auth schema/table grants are added.
create function app.notification_recipient_email(job uuid) returns text
language sql stable security definer set search_path = '' as $$
  select u.email from app.notification_emails j
    join app.message_conversations c on c.id=j.conversation_id
    join app.profiles p on p.id=j.recipient_profile_id
    join app.demo_run_participants m on m.profile_id=p.id and m.run_id=c.run_id
    join app.demo_runs r on r.id=m.run_id
    join auth.users u on u.id=p.auth_user_id
  where j.id=job and p.record_source='user' and p.claimed_at is not null
    and m.status='active' and r.status='active' and r.catalogue_visibility='public'
    and u.email_confirmed_at is not null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until<=statement_timestamp())
    and u.email is not null and u.email<>''
$$;
alter function app.notification_recipient_email(uuid) owner to postgres;
revoke all on function app.notification_recipient_email(uuid) from public, app_runtime, app_notification_worker;
grant execute on function app.notification_recipient_email(uuid) to app_owner;

create function app.claim_notification_emails(batch_size integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if batch_size is null or batch_size<1 or batch_size>20 then
    raise exception 'invalid notification batch' using errcode='P0001';
  end if;
  -- Expiry after possible handoff is ambiguous: quarantine, never auto resend.
  with expired as (
    select id from app.notification_emails where state='sending' and lease_until<=statement_timestamp()
    order by lease_until,id for update skip locked limit batch_size
  ) update app.notification_emails j set state='unknown',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from expired where j.id=expired.id;
  with due as (
    select j.id from app.notification_emails j where j.closed_at is null
      and j.attempts<5 and j.due_at<=statement_timestamp()
      and (j.state='queued' or (j.state='claimed' and j.lease_until<=statement_timestamp()))
    order by j.due_at,j.id for update skip locked limit batch_size
  ), claimed as (
    update app.notification_emails j set state='claimed',attempts=j.attempts+1,
      lease_id=gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes'
    from due where j.id=due.id returning j.id,j.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id)),'[]') into result from claimed;
  -- A worker dying on its fifth pre-send claim must not leave a stuck claim.
  with exhausted as (
    select id from app.notification_emails where attempts=5 and state='claimed'
      and lease_until<=statement_timestamp() order by lease_until,id
    for update skip locked limit batch_size
  ) update app.notification_emails j set state='failed',lease_id=null,lease_until=null,
    finished_at=statement_timestamp() from exhausted where j.id=exhausted.id;
  return result;
end $$;
alter function app.claim_notification_emails(integer) owner to app_owner;
revoke all on function app.claim_notification_emails(integer) from public;
grant execute on function app.claim_notification_emails(integer) to app_notification_worker;

create function app.prepare_notification_email(job uuid, lease uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j app.notification_emails; c app.message_conversations; email text; result jsonb;
begin
  select * into j from app.notification_emails where id=job for update;
  if not found or j.state<>'claimed' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return null; end if;
  perform app.mail_flags(true);
  select * into c from app.message_conversations where id=j.conversation_id;
  email := app.notification_recipient_email(j.id);
  if j.closed_at is not null or j.due_at>statement_timestamp() or email is null
    or not app.notification_entry_allowed(j.first_entry_id,j.recipient_profile_id)
    or not exists (select 1 from app.message_entries e where e.conversation_id=c.id
      and e.kind='text' and e.sender_profile_id is distinct from j.recipient_profile_id
      and e.seq>coalesce((select r.last_seq from app.message_reads r
        where r.conversation_id=c.id and r.profile_id=j.recipient_profile_id),0)) then
    update app.notification_emails set state='suppressed',lease_id=null,lease_until=null,
      finished_at=statement_timestamp() where id=j.id;
    perform app.mail_flags(false); return null;
  end if;
  update app.notification_emails set state='sending',lease_until=statement_timestamp()+interval '2 minutes' where id=j.id;
  -- Deliberately omit message bodies, Auth IDs and other recipients.
  result := jsonb_build_object('id',j.id,'conversationId',c.id,'email',email);
  perform app.mail_flags(false);
  return result;
exception when others then perform app.mail_flags(false); raise;
end $$;
alter function app.prepare_notification_email(uuid,uuid) owner to app_owner;
revoke all on function app.prepare_notification_email(uuid,uuid) from public;
grant execute on function app.prepare_notification_email(uuid,uuid) to app_notification_worker;

create function app.finish_notification_email(job uuid, lease uuid, outcome text, provider text default null) returns boolean
language plpgsql security definer set search_path = '' as $$
declare j app.notification_emails;
begin
  if outcome not in ('accepted','retry','failed','unknown') or outcome is null
    or length(provider)>200 then raise exception 'invalid notification result' using errcode='P0001'; end if;
  select * into j from app.notification_emails where id=job for update;
  if not found or j.state<>'sending' or j.lease_id is distinct from lease
    or j.lease_until<=statement_timestamp() then return false; end if;
  update app.notification_emails set state=case
      when outcome='retry' and j.closed_at is not null then 'suppressed'
      when outcome='retry' and j.attempts<5 then 'queued'
      when outcome='retry' then 'failed' else outcome end,
    due_at=case when outcome='retry' then statement_timestamp()+
      make_interval(secs=>least(3600,30*power(2,j.attempts-1))::integer) else due_at end,
    lease_id=null,lease_until=null,provider_id=provider,finished_at=statement_timestamp()
    where id=j.id;
  return true;
end $$;
alter function app.finish_notification_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.finish_notification_email(uuid,uuid,text,text) from public;
grant execute on function app.finish_notification_email(uuid,uuid,text,text) to app_notification_worker;
