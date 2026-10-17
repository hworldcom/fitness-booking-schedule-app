-- DEV0286: application authority is distinct from a managed Auth token.
create table app.email_auth_flows (
  id_hash text primary key check (id_hash ~ '^[0-9a-f]{64}$'),
  binding_hash text not null check (binding_hash ~ '^[0-9a-f]{64}$'),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  purpose text not null check (purpose in ('confirmation', 'login', 'recovery')),
  intent text check (intent in ('client', 'coach')),
  return_to text not null check (length(return_to) between 1 and 2048),
  requested_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default statement_timestamp() + interval '1 hour',
  consumed_at timestamptz,
  unique (email_hash, purpose)
);
create index email_auth_flow_expiry on app.email_auth_flows(expires_at);

create table app.application_auth_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('ordinary', 'recovery')),
  return_to text not null default '/sessions' check (length(return_to) between 1 and 2048),
  intent text check (intent in ('client','coach')),
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp()
);
create index application_auth_session_subject on app.application_auth_sessions(auth_user_id);

alter table app.email_auth_flows owner to app_owner;
alter table app.application_auth_sessions owner to app_owner;
alter table app.email_auth_flows enable row level security;
alter table app.email_auth_flows force row level security;
alter table app.application_auth_sessions enable row level security;
alter table app.application_auth_sessions force row level security;
revoke all on app.email_auth_flows, app.application_auth_sessions from public, anon, authenticated, app_runtime;
create policy email_auth_flow_management on app.email_auth_flows to app_owner using (true) with check (true);
create policy application_auth_session_management on app.application_auth_sessions to app_owner using (true) with check (true);

create function app.begin_email_auth_flow(
  requested_id_hash text, requested_binding_hash text, requested_email_hash text,
  requested_purpose text, requested_intent text, requested_return_to text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous app.email_auth_flows%rowtype; remaining integer;
begin
  if requested_id_hash !~ '^[0-9a-f]{64}$' or requested_binding_hash !~ '^[0-9a-f]{64}$'
    or requested_email_hash !~ '^[0-9a-f]{64}$' or requested_purpose not in ('confirmation','login','recovery')
    or requested_return_to is null or length(requested_return_to) not between 1 and 2048
    or (requested_intent is not null and requested_intent not in ('client','coach')) then
    return jsonb_build_object('status','invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requested_email_hash, 0));
  select * into previous from app.email_auth_flows
    where email_hash = requested_email_hash and purpose = requested_purpose for update;
  if found and previous.requested_at > statement_timestamp() - interval '60 seconds' then
    remaining := greatest(1, ceil(extract(epoch from previous.requested_at + interval '60 seconds' - statement_timestamp()))::integer);
    return jsonb_build_object('status','rate-limited','retryAfterSeconds',remaining);
  end if;
  -- A new purpose supersedes older pending actions for the same address.
  update app.email_auth_flows set consumed_at = statement_timestamp()
    where email_hash = requested_email_hash and consumed_at is null;
  insert into app.email_auth_flows(id_hash,binding_hash,email_hash,purpose,intent,return_to)
    values(requested_id_hash,requested_binding_hash,requested_email_hash,requested_purpose,requested_intent,requested_return_to)
    on conflict(email_hash,purpose) do update set id_hash=excluded.id_hash,
      binding_hash=excluded.binding_hash, intent=excluded.intent, return_to=excluded.return_to,
      requested_at=excluded.requested_at, expires_at=excluded.expires_at, consumed_at=null;
  -- Bounded opportunistic removal; no identity/token/email contents are stored.
  delete from app.email_auth_flows where id_hash in (
    select id_hash from app.email_auth_flows where expires_at < statement_timestamp() - interval '1 day'
    order by expires_at limit 100
  );
  return jsonb_build_object('status','ready');
end;
$$;

create function app.read_email_auth_flow(requested_id_hash text, requested_binding_hash text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('emailHash',email_hash,'purpose',purpose,'intent',intent,'returnTo',return_to)
  from app.email_auth_flows where id_hash=requested_id_hash and binding_hash=requested_binding_hash
    and consumed_at is null and expires_at > statement_timestamp();
$$;

create function app.consume_email_auth_flow(requested_id_hash text, requested_binding_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update app.email_auth_flows set consumed_at=statement_timestamp()
    where id_hash=requested_id_hash and binding_hash=requested_binding_hash
      and consumed_at is null and expires_at > statement_timestamp();
  return found;
end;
$$;

-- Managed-schema reads stay behind this small vendor-specific helper. Runtime
-- never receives auth.users/auth.sessions table privileges or password hashes.
create function app.managed_auth_session_exists(requested_user uuid, requested_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=requested_session and s.user_id=requested_user and u.email_confirmed_at is not null
      and (s.not_after is null or s.not_after > statement_timestamp()));
$$;
revoke all on function app.managed_auth_session_exists(uuid,uuid) from public, anon, authenticated, app_runtime;
grant execute on function app.managed_auth_session_exists(uuid,uuid) to app_owner;

create function app.grant_application_auth_session(requested_user uuid, requested_session uuid, requested_purpose text,
  requested_return_to text default '/sessions', requested_intent text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare existing app.application_auth_sessions%rowtype;
begin
  if requested_purpose not in ('ordinary','recovery') or requested_purpose is null
    or not app.managed_auth_session_exists(requested_user,requested_session) then return false; end if;
  if requested_return_to is null or length(requested_return_to) not between 1 and 2048
    or (requested_intent is not null and requested_intent not in ('client','coach')) then return false; end if;
  insert into app.application_auth_sessions(session_id,auth_user_id,purpose,return_to,intent,expires_at)
    values(requested_session,requested_user,requested_purpose,requested_return_to,requested_intent,
      statement_timestamp() + case when requested_purpose='recovery' then interval '1 hour' else interval '30 days' end)
    on conflict(session_id) do nothing;
  select * into existing from app.application_auth_sessions where session_id=requested_session;
  return existing.auth_user_id=requested_user and existing.purpose=requested_purpose
    and existing.expires_at > statement_timestamp();
end;
$$;

create function app.current_application_auth_purpose(requested_user uuid, requested_session uuid)
returns text language sql stable security definer set search_path = '' as $$
  select purpose from app.application_auth_sessions where session_id=requested_session and auth_user_id=requested_user
    and expires_at > statement_timestamp() and app.managed_auth_session_exists(requested_user,requested_session);
$$;

create function app.revoke_application_auth_sessions(requested_user uuid, requested_session uuid default null)
returns void language sql security definer set search_path = '' as $$
  delete from app.application_auth_sessions where auth_user_id=requested_user
    and (requested_session is null or session_id=requested_session);
$$;

create function app.current_application_auth_continuation(requested_user uuid, requested_session uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('returnTo',return_to,'intent',intent) from app.application_auth_sessions
    where session_id=requested_session and auth_user_id=requested_user and expires_at > statement_timestamp()
      and app.managed_auth_session_exists(requested_user,requested_session);
$$;

create function app.account_has_password(requested_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(encrypted_password,'') <> '' from auth.users where id=requested_user;
$$;
revoke all on function app.account_has_password(uuid) from public, anon, authenticated;
grant execute on function app.account_has_password(uuid) to app_runtime;

alter function app.begin_email_auth_flow(text,text,text,text,text,text) owner to app_owner;
alter function app.read_email_auth_flow(text,text) owner to app_owner;
alter function app.consume_email_auth_flow(text,text) owner to app_owner;
alter function app.grant_application_auth_session(uuid,uuid,text,text,text) owner to app_owner;
alter function app.current_application_auth_purpose(uuid,uuid) owner to app_owner;
alter function app.revoke_application_auth_sessions(uuid,uuid) owner to app_owner;
alter function app.current_application_auth_continuation(uuid,uuid) owner to app_owner;
revoke all on function app.begin_email_auth_flow(text,text,text,text,text,text),
  app.read_email_auth_flow(text,text), app.consume_email_auth_flow(text,text),
  app.grant_application_auth_session(uuid,uuid,text,text,text), app.current_application_auth_purpose(uuid,uuid),
  app.revoke_application_auth_sessions(uuid,uuid), app.current_application_auth_continuation(uuid,uuid) from public, anon, authenticated;
grant execute on function app.begin_email_auth_flow(text,text,text,text,text,text),
  app.read_email_auth_flow(text,text), app.consume_email_auth_flow(text,text),
  app.grant_application_auth_session(uuid,uuid,text,text,text), app.current_application_auth_purpose(uuid,uuid),
  app.revoke_application_auth_sessions(uuid,uuid), app.current_application_auth_continuation(uuid,uuid) to app_runtime;
