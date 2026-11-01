-- MOV-10: targeted invitation authority. MOV-11: isolated delivery outbox.
-- MOV-158: private atomic association hook; no duplicate session/history rows.
create table app.coach_client_invitations (
 id uuid primary key default gen_random_uuid(),run_id uuid not null,coach_profile_id uuid not null,external_client_id uuid not null,
 email text not null,token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),revision integer not null default 0 check(revision>=0),
 status text not null default 'pending' check(status in('pending','accepted','declined','revoked')),
 expires_at timestamptz not null default clock_timestamp()+interval '14 days',recipient_profile_id uuid,
 created_at timestamptz not null default clock_timestamp(),decided_at timestamptz,
 foreign key(run_id,coach_profile_id,external_client_id) references app.coach_external_clients(run_id,coach_profile_id,id),
 foreign key(run_id,recipient_profile_id) references app.demo_run_participants(run_id,profile_id),
 check((status='pending')=(decided_at is null)),check((status in('accepted','declined'))=(recipient_profile_id is not null))
);
create index client_invitation_history on app.coach_client_invitations(external_client_id,created_at desc,id);
create unique index client_invitation_one_pending on app.coach_client_invitations(external_client_id) where status='pending';
create table app.coach_invitation_operations (
 run_id uuid not null,actor_id uuid not null,operation_id uuid not null,payload jsonb not null,result jsonb not null,
 primary key(run_id,actor_id,operation_id),foreign key(run_id,actor_id) references app.demo_run_participants(run_id,profile_id)
);
create table app.coach_invitation_emails (
 id uuid primary key references app.coach_client_invitations(id),token text check(token ~ '^[A-Za-z0-9_-]{43}$'),
 status text not null default 'queued' check(status in('queued','leased','sending','retry','accepted','failed','unknown','suppressed')),
 attempts integer not null default 0 check(attempts between 0 and 5),due_at timestamptz not null default clock_timestamp(),
 lease_id uuid,lease_until timestamptz,provider_id text check(octet_length(provider_id)<=200),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(status not in('accepted','failed','unknown','suppressed') or token is null)
);
alter table app.coach_client_invitations owner to app_owner;
alter table app.coach_invitation_operations owner to app_owner;
alter table app.coach_invitation_emails owner to app_owner;
alter table app.coach_client_invitations enable row level security;
alter table app.coach_client_invitations force row level security;
alter table app.coach_invitation_operations enable row level security;
alter table app.coach_invitation_operations force row level security;
alter table app.coach_invitation_emails enable row level security;
alter table app.coach_invitation_emails force row level security;
create policy owner_internal on app.coach_client_invitations to app_owner using(true) with check(true);
create policy owner_internal on app.coach_invitation_operations to app_owner using(true) with check(true);
create policy owner_internal on app.coach_invitation_emails to app_owner using(true) with check(true);
revoke all on app.coach_client_invitations,app.coach_invitation_operations,app.coach_invitation_emails from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;

-- Only this narrow helper can read/lock Auth rows. It returns no account data.
create function app.invitation_recipient_matches(expected_email text) returns boolean language plpgsql security definer set search_path='' as $$
declare ok boolean;begin
 if not app.authorized_actor_context_valid(null,null,null) then return false;end if;
 select true into ok from auth.users u where u.id=current_setting('app.current_auth_user_id')::uuid
  and lower(btrim(u.email))=expected_email and u.email_confirmed_at is not null and u.deleted_at is null
  and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share;
 return coalesce(ok,false);
end $$;
alter function app.invitation_recipient_matches(text) owner to postgres;
revoke all on function app.invitation_recipient_matches(text) from public,anon,authenticated,service_role,app_runtime,app_notification_worker,app_media_worker;
grant execute on function app.invitation_recipient_matches(text) to app_owner;

create function app.revoke_retargeted_invitations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.email is distinct from new.email then
  update app.coach_client_invitations set status='revoked',revision=revision+1,decided_at=clock_timestamp() where external_client_id=new.id and status='pending';
  update app.coach_invitation_emails e set status='suppressed',token=null,updated_at=clock_timestamp() from app.coach_client_invitations i where e.id=i.id and i.external_client_id=new.id and e.status in('queued','leased','retry');
 end if;return new;
end $$;
alter function app.revoke_retargeted_invitations() owner to app_owner;
revoke all on function app.revoke_retargeted_invitations() from public,anon,authenticated,app_runtime;
create trigger revoke_retargeted_invitations after update of email on app.coach_external_clients for each row execute function app.revoke_retargeted_invitations();

create function app.owned_client_invitation(client_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i app.coach_client_invitations;answer jsonb;begin
 if not app.authorized_actor_context_valid(null,null,null) or not exists(select 1 from app.coach_external_clients where id=client_id and run_id=current_setting('app.current_run_id')::uuid and coach_profile_id=current_setting('app.current_profile_id')::uuid) then raise exception 'invitation forbidden' using errcode='42501';end if;
 select * into i from app.coach_client_invitations where external_client_id=client_id order by created_at desc,id desc limit 1;
 if i.id is null then return null;end if;
 select jsonb_build_object('id',i.id,'revision',i.revision,'status',case when i.status='pending' and i.expires_at<=clock_timestamp() then 'expired' else i.status end,'expiresAt',i.expires_at,'createdAt',i.created_at,'delivery',e.status) into answer from app.coach_invitation_emails e where e.id=i.id;
 return answer;
end $$;
alter function app.owned_client_invitation(uuid) owner to app_owner;
revoke all on function app.owned_client_invitation(uuid) from public,anon,authenticated;
grant execute on function app.owned_client_invitation(uuid) to app_runtime;

create function app.manage_client_invitation(action text,args jsonb,raw_token text default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid;dataset uuid;flags jsonb;e app.coach_external_clients;i app.coach_client_invitations;op app.coach_invitation_operations;answer jsonb;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'invitation forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
 if action not in('send','resend','revoke') or action is null or jsonb_typeof(args) is distinct from 'object' or args-array['operationId','externalClientId','clientRevision','expectedInvitationId','expectedRevision']<>'{}'::jsonb or args->>'operationId' is null then raise exception 'invitation invalid' using errcode='22023';end if;
 flags:=app.availability_enter();
 perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',actor::text),0));
 select * into op from app.coach_invitation_operations where run_id=dataset and actor_id=actor and operation_id=(args->>'operationId')::uuid;
 if found then
  if op.payload is distinct from jsonb_build_object('action',action,'args',args) then raise exception 'invitation altered retry' using errcode='P0001';end if;
  perform app.availability_leave(flags);return op.result;
 end if;
 select * into e from app.coach_external_clients where id=(args->>'externalClientId')::uuid and run_id=dataset and coach_profile_id=actor for update;
 if e.id is null then raise exception 'invitation forbidden' using errcode='42501';end if;
 if e.revision is distinct from (args->>'clientRevision')::integer or e.linked_profile_id is not null then raise exception 'invitation client changed' using errcode='P0001';end if;
 select * into i from app.coach_client_invitations where external_client_id=e.id order by created_at desc,id desc limit 1 for update;
 if i.id is distinct from (args->>'expectedInvitationId')::uuid or i.revision is distinct from (args->>'expectedRevision')::integer then raise exception 'invitation changed' using errcode='P0001';end if;
 if action='revoke' then
  if i.status is distinct from 'pending' then raise exception 'invitation changed' using errcode='P0001';end if;
 else
  perform 1 from app.coach_applications where profile_id=actor for share;
  if not app.group_coach_enabled(dataset,actor,false) or e.email is null then raise exception 'invitation forbidden' using errcode='42501';end if;
  if raw_token is null or raw_token !~ '^[A-Za-z0-9_-]{43}$' or (action='send' and i.id is not null) or (action='resend' and i.id is null) then raise exception 'invitation invalid' using errcode='22023';end if;
  if i.created_at>clock_timestamp()-interval '60 seconds' or (select count(*) from app.coach_client_invitations where external_client_id=e.id and created_at>clock_timestamp()-interval '24 hours')>=5 then raise exception 'invitation send limit' using errcode='P0001';end if;
 end if;
 update app.coach_client_invitations set status='revoked',revision=revision+1,decided_at=clock_timestamp() where external_client_id=e.id and status='pending';
 update app.coach_invitation_emails outbox set status='suppressed',token=null,updated_at=clock_timestamp() from app.coach_client_invitations inv where outbox.id=inv.id and inv.external_client_id=e.id and outbox.status in('queued','leased','retry');
 if action<>'revoke' then
  insert into app.coach_client_invitations(run_id,coach_profile_id,external_client_id,email,token_hash) values(dataset,actor,e.id,e.email,encode(sha256(convert_to(raw_token,'UTF8')),'hex')) returning * into i;
  insert into app.coach_invitation_emails(id,token) values(i.id,raw_token);
 end if;
 answer:=jsonb_build_object('invitation',app.owned_client_invitation(e.id));
 insert into app.coach_invitation_operations values(dataset,actor,(args->>'operationId')::uuid,jsonb_build_object('action',action,'args',args),answer);
 perform app.availability_leave(flags);return answer;
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.manage_client_invitation(text,jsonb,text) owner to app_owner;
revoke all on function app.manage_client_invitation(text,jsonb,text) from public,anon,authenticated;
grant execute on function app.manage_client_invitation(text,jsonb,text) to app_runtime;

-- MOV-158 hook: caller must have already stored accepted consent in this transaction.
-- No execute grant to runtime/worker, no caller-controlled bypass setting.
create function app.associate_invited_sessions(invitation_id uuid) returns void language plpgsql set search_path='' as $$
declare i app.coach_client_invitations;e app.coach_external_clients;begin
 select * into strict i from app.coach_client_invitations where id=invitation_id;
 if not app.authorized_actor_context_valid(i.recipient_profile_id,i.run_id,null) or i.status<>'accepted' or not app.invitation_recipient_matches(i.email) then raise exception 'invitation claim forbidden' using errcode='42501';end if;
 select * into strict e from app.coach_external_clients where id=i.external_client_id for update;
 if e.linked_profile_id is not null or e.email is distinct from i.email then raise exception 'invitation claim changed' using errcode='P0001';end if;
 update app.coach_external_clients set linked_profile_id=i.recipient_profile_id,linked_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=e.id;
 update app.coach_private_bookings set client_profile_id=i.recipient_profile_id where external_client_id=e.id and client_profile_id is null;
end $$;
alter function app.associate_invited_sessions(uuid) owner to app_owner;
revoke all on function app.associate_invited_sessions(uuid) from public,anon,authenticated,app_runtime,app_notification_worker;

-- Review is intentionally minimal, even for a signed-in matching recipient.
create function app.review_client_invitation(hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i app.coach_client_invitations;flags jsonb;coach_name text;begin
 if hash is null or hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','unavailable');end if;
 select * into i from app.coach_client_invitations where token_hash=hash;
 if i.id is null or i.status in('revoked','declined') or (i.status='pending' and i.expires_at<=clock_timestamp()) then return jsonb_build_object('state','unavailable');end if;
 flags:=app.availability_enter();select display_name into coach_name from app.coach_profiles where run_id=i.run_id and profile_id=i.coach_profile_id;
 perform app.availability_leave(flags);
 return jsonb_build_object('state',case when i.status='accepted' then 'accepted' else 'pending' end,'coachName',coach_name);
exception when others then perform app.availability_leave(flags);raise;end $$;
alter function app.review_client_invitation(text) owner to app_owner;
revoke all on function app.review_client_invitation(text) from public,anon,authenticated;
grant execute on function app.review_client_invitation(text) to app_runtime;

create function app.decide_client_invitation(hash text,action text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid;dataset uuid;flags jsonb;mail_flags jsonb;connection_flag text;i app.coach_client_invitations;e app.coach_external_clients;p app.coach_athlete_connection_pairs;a app.coach_athlete_connection_attempts;
begin
 if not app.authorized_actor_context_valid(null,null,null) then raise exception 'invitation forbidden' using errcode='42501';end if;
 actor:=current_setting('app.current_profile_id')::uuid;dataset:=current_setting('app.current_run_id')::uuid;
 if hash is null or hash !~ '^[0-9a-f]{64}$' or action not in('accept','decline') or action is null then raise exception 'invitation invalid' using errcode='22023';end if;
 select * into i from app.coach_client_invitations where token_hash=hash and run_id=dataset;
 if i.id is null or actor=i.coach_profile_id then raise exception 'invitation forbidden' using errcode='42501';end if;
 flags:=app.availability_enter();mail_flags:=app.mail_trigger_enter();connection_flag:=coalesce(current_setting('app.coach_connection_management',true),'');
 perform set_config('app.coach_connection_management','on',true);
 perform pg_advisory_xact_lock(hashtextextended(concat(dataset::text,':',i.coach_profile_id::text),0));
 perform app.mail_lock_pair(dataset,i.coach_profile_id,actor);
 perform pg_advisory_xact_lock(hashtextextended('coach-athlete-connection:'||dataset::text||':'||i.coach_profile_id::text||':'||actor::text,0));
 select * into e from app.coach_external_clients where id=i.external_client_id for update;
 select * into i from app.coach_client_invitations where id=i.id for update;
 if (i.status='accepted' and action='accept' or i.status='declined' and action='decline') and i.recipient_profile_id=actor then
  perform app.mail_trigger_leave(mail_flags);perform app.availability_leave(flags);perform set_config('app.coach_connection_management',connection_flag,true);return jsonb_build_object('state',i.status);
 end if;
 if not app.invitation_recipient_matches(i.email) then raise exception 'invitation recipient mismatch' using errcode='42501';end if;
 if i.status<>'pending' or i.expires_at<=clock_timestamp() or e.linked_profile_id is not null or e.email is distinct from i.email then raise exception 'invitation changed' using errcode='P0001';end if;
 perform 1 from app.coach_applications where profile_id=i.coach_profile_id for share;
 perform 1 from app.demo_run_participants where run_id=dataset and profile_id in(actor,i.coach_profile_id) order by profile_id for share;
 if not app.group_coach_enabled(dataset,i.coach_profile_id,false) or app.mail_blocked(dataset,i.coach_profile_id,actor)
  or (select count(*) from app.demo_run_participants where run_id=dataset and profile_id in(actor,i.coach_profile_id) and status='active')<>2 then raise exception 'invitation forbidden' using errcode='42501';end if;
 update app.coach_client_invitations set status=case action when 'accept' then 'accepted' else 'declined' end,revision=revision+1,recipient_profile_id=actor,decided_at=clock_timestamp() where id=i.id;
 if action='accept' then
  perform app.associate_invited_sessions(i.id);
  select * into p from app.coach_athlete_connection_pairs where run_id=dataset and coach_profile_id=i.coach_profile_id and athlete_profile_id=actor;
  if p.id is null then insert into app.coach_athlete_connection_pairs(run_id,coach_profile_id,athlete_profile_id) values(dataset,i.coach_profile_id,actor) returning * into p;end if;
  select * into a from app.coach_athlete_connection_attempts where pair_id=p.id order by attempt_number desc limit 1 for update;
  if a.status='pending' then
   update app.coach_athlete_connection_attempts set status='withdrawn',decided_at=clock_timestamp(),decided_by_profile_id=sender_profile_id where id=a.id;
  end if;
  if a.status is distinct from 'accepted' then
   insert into app.coach_athlete_connection_attempts(id,run_id,pair_id,attempt_number,sender_profile_id,recipient_profile_id,status,decided_by_profile_id,decided_at)
    values(gen_random_uuid(),dataset,p.id,coalesce(a.attempt_number,0)+1,i.coach_profile_id,actor,'accepted',actor,clock_timestamp());
  end if;
 end if;
 update app.coach_invitation_emails set status='suppressed',token=null,updated_at=clock_timestamp() where id=i.id and status in('queued','leased','retry');
 perform app.mail_trigger_leave(mail_flags);perform app.availability_leave(flags);perform set_config('app.coach_connection_management',connection_flag,true);
 return jsonb_build_object('state',case action when 'accept' then 'accepted' else 'declined' end);
exception when others then perform app.mail_trigger_leave(mail_flags);perform app.availability_leave(flags);perform set_config('app.coach_connection_management',connection_flag,true);raise;end $$;
alter function app.decide_client_invitation(text,text) owner to app_owner;
revoke all on function app.decide_client_invitation(text,text) from public,anon,authenticated;
grant execute on function app.decide_client_invitation(text,text) to app_runtime;

-- MOV-11 worker lane. Preparing is a one-way transition: a lost handoff is Unknown,
-- never automatically resent. Only an explicit new invitation rotates the token.
create function app.claim_coach_invitation_emails(target_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;begin
 update app.coach_invitation_emails set status='failed',token=null,updated_at=clock_timestamp() where status='leased' and lease_until<=clock_timestamp() and attempts>=5 and (target_id is null or id=target_id);
 update app.coach_invitation_emails set status='unknown',token=null,updated_at=clock_timestamp() where status='sending' and lease_until<=clock_timestamp() and (target_id is null or id=target_id);
 with candidates as(select id from app.coach_invitation_emails where (target_id is null or id=target_id) and attempts<5 and due_at<=clock_timestamp() and (status in('queued','retry') or status='leased' and lease_until<=clock_timestamp()) order by created_at,id limit 5 for update skip locked),
 claimed as(update app.coach_invitation_emails e set status='leased',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1,updated_at=clock_timestamp() from candidates c where e.id=c.id returning e.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseId',lease_id,'kind','coach-invitation')),'[]'::jsonb) into answer from claimed;
 return answer;end $$;
create function app.prepare_coach_invitation_email(job_id uuid,lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e app.coach_invitation_emails;i app.coach_client_invitations;c app.coach_external_clients;flags jsonb;coach_name text;begin
 -- Same coach/contact order as rotation and acceptance; prevent stale prepares.
 select * into i from app.coach_client_invitations where id=job_id;
 if i.id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(concat(i.run_id::text,':',i.coach_profile_id::text),0));
 select * into c from app.coach_external_clients where id=i.external_client_id for share;
 select * into i from app.coach_client_invitations where id=job_id for share;
 select * into e from app.coach_invitation_emails where id=job_id for update;
 if e.status<>'leased' or e.lease_id is distinct from lease or e.lease_until<=clock_timestamp() then return null;end if;
 flags:=app.availability_enter();
 if i.status<>'pending' or i.expires_at<=clock_timestamp() or c.linked_profile_id is not null or c.email is distinct from i.email or not app.group_coach_enabled(i.run_id,i.coach_profile_id,false) then
  update app.coach_invitation_emails set status='suppressed',token=null,updated_at=clock_timestamp() where id=job_id;
  perform app.availability_leave(flags);return null;
 end if;
 select display_name into coach_name from app.coach_profiles where run_id=i.run_id and profile_id=i.coach_profile_id;
 update app.coach_invitation_emails set status='sending',updated_at=clock_timestamp() where id=job_id;
 perform app.availability_leave(flags);
 return jsonb_build_object('kind','coach-invitation','id',e.id,'email',i.email,'coachName',coach_name,'token',e.token);
exception when others then perform app.availability_leave(flags);raise;end $$;
create function app.finish_coach_invitation_email(job_id uuid,lease uuid,outcome text,provider text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare e app.coach_invitation_emails;begin
 if outcome is null or outcome not in('accepted','retry','failed','unknown') or octet_length(provider)>200 then raise exception 'invitation delivery invalid' using errcode='22023';end if;
 select * into e from app.coach_invitation_emails where id=job_id for update;
 if e.status<>'sending' or e.lease_id is distinct from lease then return false;end if;
 update app.coach_invitation_emails set status=case when outcome='retry' and attempts>=5 then 'failed' else outcome end,
 token=case when outcome='retry' and attempts<5 then token else null end,provider_id=provider,
 due_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() where id=job_id;
 return true;end $$;
alter function app.claim_coach_invitation_emails(uuid) owner to app_owner;
alter function app.prepare_coach_invitation_email(uuid,uuid) owner to app_owner;
alter function app.finish_coach_invitation_email(uuid,uuid,text,text) owner to app_owner;
revoke all on function app.claim_coach_invitation_emails(uuid),app.prepare_coach_invitation_email(uuid,uuid),app.finish_coach_invitation_email(uuid,uuid,text,text) from public,anon,authenticated,app_runtime,service_role;
grant execute on function app.claim_coach_invitation_emails(uuid),app.prepare_coach_invitation_email(uuid,uuid),app.finish_coach_invitation_email(uuid,uuid,text,text) to app_notification_worker;
