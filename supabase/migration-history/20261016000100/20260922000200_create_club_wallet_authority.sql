alter table app.auth_challenges
  drop constraint auth_challenges_purpose_check,
  drop constraint auth_challenges_personal_purpose_check,
  drop constraint auth_challenges_consumed_result_check;

alter table app.auth_challenges
  add column auth_session_id uuid null,
  add constraint auth_challenges_purpose_check
    check (
      purpose in (
        'link-personal-wallet',
        'replace-personal-wallet',
        'authorize-club-wallet'
      )
    ),
  add constraint auth_challenges_owner_purpose_check
    check (
      (
        owner_type = 'personal'
        and auth_session_id is null
        and purpose in (
          'link-personal-wallet',
          'replace-personal-wallet'
        )
      )
      or (
        owner_type = 'organization'
        and auth_session_id is not null
        and purpose = 'authorize-club-wallet'
      )
    ),
  add constraint auth_challenges_consumed_result_check
    check (
      consumed_result is null
      or consumed_result in (
        'linked',
        'replaced',
        'authorized',
        'wallet-conflict',
        'state-conflict'
      )
    );

create unique index organization_memberships_one_active_primary_admin_idx
  on app.organization_memberships (run_id, organization_id)
  where status = 'active' and role = 'primary_admin';

create policy organizations_wallet_management_select
  on app.organizations
  for select
  to app_owner
  using (current_setting('app.wallet_management', true) = 'on');

create policy organization_memberships_wallet_management_select
  on app.organization_memberships
  for select
  to app_owner
  using (current_setting('app.wallet_management', true) = 'on');

create table app.organization_wallet_authorities (
  id uuid primary key,
  run_id uuid not null,
  auth_user_id uuid not null,
  auth_session_id uuid not null,
  profile_id uuid not null,
  organization_id uuid not null,
  wallet_binding_id uuid not null,
  wallet_address text not null,
  cluster text not null,
  challenge_id uuid not null,
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  revocation_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_wallet_authorities_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users (id) on delete restrict,
  constraint organization_wallet_authorities_membership_fkey
    foreign key (run_id, organization_id, profile_id)
    references app.organization_memberships (
      run_id,
      organization_id,
      profile_id
    )
    on delete restrict,
  constraint organization_wallet_authorities_binding_fkey
    foreign key (run_id, wallet_binding_id)
    references app.wallet_bindings (run_id, id)
    on delete restrict,
  constraint organization_wallet_authorities_challenge_fkey
    foreign key (run_id, challenge_id)
    references app.auth_challenges (run_id, id)
    on delete restrict,
  constraint organization_wallet_authorities_challenge_key
    unique (challenge_id),
  constraint organization_wallet_authorities_cluster_check
    check (cluster = 'solana:devnet'),
  constraint organization_wallet_authorities_wallet_address_check
    check (
      char_length(wallet_address) between 32 and 44
      and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
    ),
  constraint organization_wallet_authorities_lifetime_check
    check (expires_at = granted_at + interval '10 minutes'),
  constraint organization_wallet_authorities_revoked_state_check
    check ((revoked_at is null) = (revocation_reason is null)),
  constraint organization_wallet_authorities_revocation_reason_check
    check (
      revocation_reason is null
      or revocation_reason in (
        'client-disconnect',
        'expired',
        'context-changed',
        'superseded'
      )
    )
);

create unique index organization_wallet_authorities_active_actor_idx
  on app.organization_wallet_authorities (run_id, auth_user_id)
  where revoked_at is null;
create unique index organization_wallet_authorities_active_organization_idx
  on app.organization_wallet_authorities (run_id, organization_id)
  where revoked_at is null;
create index organization_wallet_authorities_expiry_idx
  on app.organization_wallet_authorities (expires_at)
  where revoked_at is null;

create trigger organization_wallet_authorities_set_updated_at
before update on app.organization_wallet_authorities
for each row execute function app.set_updated_at();

alter table app.organization_wallet_authorities enable row level security;
alter table app.organization_wallet_authorities force row level security;
alter table app.organization_wallet_authorities owner to app_owner;

revoke all on app.organization_wallet_authorities
  from public, anon, authenticated, service_role, app_runtime;

create policy organization_wallet_authorities_wallet_management_all
  on app.organization_wallet_authorities
  for all
  to app_owner
  using (current_setting('app.wallet_management', true) = 'on')
  with check (current_setting('app.wallet_management', true) = 'on');

create function app.current_club_wallet_context()
returns table (
  organization_id uuid,
  organization_slug text,
  organization_name text,
  binding_id uuid,
  binding_wallet_address text,
  binding_cluster text,
  binding_verified_at timestamptz,
  authority_id uuid,
  authority_granted_at timestamptz,
  authority_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  auth_session_id_text text;
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet actor context is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  auth_session_id_text := pg_catalog.current_setting(
    'app.current_auth_session_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  if auth_session_id_text is null then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet session context is invalid';
  end if;
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  update app.organization_wallet_authorities as authority
  set
    revoked_at = pg_catalog.statement_timestamp(),
    revocation_reason = case
      when authority.expires_at <= pg_catalog.statement_timestamp()
        then 'expired'
      else 'context-changed'
    end
  where authority.run_id = run_id_text::uuid
    and authority.auth_user_id = auth_user_id_text::uuid
    and authority.revoked_at is null
    and (
      authority.expires_at <= pg_catalog.statement_timestamp()
      or authority.auth_session_id <> auth_session_id_text::uuid
      or not exists (
        select 1
        from app.organization_memberships as membership
        join app.organizations as organization
          on organization.run_id = membership.run_id
          and organization.id = membership.organization_id
        join app.wallet_bindings as binding
          on binding.run_id = membership.run_id
          and binding.organization_id = membership.organization_id
          and binding.owner_type = 'organization'
          and binding.status = 'active'
        where membership.run_id = authority.run_id
          and membership.organization_id = authority.organization_id
          and membership.profile_id = authority.profile_id
          and membership.role = 'primary_admin'
          and membership.status = 'active'
          and organization.status = 'active'
          and binding.id = authority.wallet_binding_id
          and binding.wallet_address = authority.wallet_address
          and binding.cluster = authority.cluster
      )
    );

  return query
  select
    organization.id,
    organization.slug,
    organization.name,
    binding.id,
    binding.wallet_address,
    binding.cluster,
    binding.verified_at,
    authority.id,
    authority.granted_at,
    authority.expires_at
  from app.organization_memberships as membership
  join app.organizations as organization
    on organization.run_id = membership.run_id
    and organization.id = membership.organization_id
  left join app.wallet_bindings as binding
    on binding.run_id = membership.run_id
    and binding.organization_id = membership.organization_id
    and binding.owner_type = 'organization'
    and binding.provenance = 'prepared'
    and binding.status = 'active'
  left join app.organization_wallet_authorities as authority
    on authority.run_id = membership.run_id
    and authority.organization_id = membership.organization_id
    and authority.profile_id = membership.profile_id
    and authority.auth_user_id = auth_user_id_text::uuid
    and authority.auth_session_id = auth_session_id_text::uuid
    and authority.wallet_binding_id = binding.id
    and authority.wallet_address = binding.wallet_address
    and authority.cluster = binding.cluster
    and authority.revoked_at is null
    and authority.expires_at > pg_catalog.statement_timestamp()
  where membership.run_id = run_id_text::uuid
    and membership.profile_id = profile_id_text::uuid
    and membership.role = 'primary_admin'
    and membership.status = 'active'
    and organization.status = 'active'
  order by organization.id;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

create function app.issue_club_wallet_challenge(
  requested_challenge_id uuid,
  requested_wallet_address text,
  requested_origin text,
  requested_nonce_hash bytea,
  requested_message_hash bytea,
  requested_issued_at timestamptz,
  requested_expires_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  auth_session_id_text text;
  profile_id_text text;
  run_id_text text;
  eligible_count integer;
  club record;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet actor context is invalid';
  end if;

  if requested_wallet_address is null
    or pg_catalog.char_length(requested_wallet_address) not between 32 and 44
    or requested_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or requested_origin is null
    or pg_catalog.octet_length(requested_nonce_hash) <> 32
    or pg_catalog.octet_length(requested_message_hash) <> 32
    or requested_issued_at < pg_catalog.statement_timestamp() - interval '30 seconds'
    or requested_issued_at > pg_catalog.statement_timestamp() + interval '30 seconds'
    or requested_expires_at <> requested_issued_at + interval '5 minutes'
  then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet challenge request is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  auth_session_id_text := pg_catalog.current_setting(
    'app.current_auth_session_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  if auth_session_id_text is null then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet session context is invalid';
  end if;
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  select count(*)::integer
  into eligible_count
  from app.organization_memberships as membership
  join app.organizations as organization
    on organization.run_id = membership.run_id
    and organization.id = membership.organization_id
  join app.wallet_bindings as binding
    on binding.run_id = membership.run_id
    and binding.organization_id = membership.organization_id
    and binding.owner_type = 'organization'
    and binding.provenance = 'prepared'
    and binding.status = 'active'
  where membership.run_id = run_id_text::uuid
    and membership.profile_id = profile_id_text::uuid
    and membership.role = 'primary_admin'
    and membership.status = 'active'
    and organization.status = 'active';

  if eligible_count = 0 then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'no-club-access';
  end if;

  if eligible_count <> 1 then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'state-conflict';
  end if;

  select
    organization.id as organization_id,
    binding.wallet_address
  into club
  from app.organization_memberships as membership
  join app.organizations as organization
    on organization.run_id = membership.run_id
    and organization.id = membership.organization_id
  join app.wallet_bindings as binding
    on binding.run_id = membership.run_id
    and binding.organization_id = membership.organization_id
    and binding.owner_type = 'organization'
    and binding.provenance = 'prepared'
    and binding.status = 'active'
  where membership.run_id = run_id_text::uuid
    and membership.profile_id = profile_id_text::uuid
    and membership.role = 'primary_admin'
    and membership.status = 'active'
    and organization.status = 'active';

  if club.wallet_address <> requested_wallet_address then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'state-conflict';
  end if;

  insert into app.auth_challenges (
    id,
    run_id,
    auth_user_id,
    auth_session_id,
    owner_type,
    profile_id,
    organization_id,
    purpose,
    cluster,
    wallet_address,
    origin,
    message_version,
    nonce_hash,
    message_hash,
    issued_at,
    expires_at,
    consumed_at,
    consumed_result
  )
  values (
    requested_challenge_id,
    run_id_text::uuid,
    auth_user_id_text::uuid,
    auth_session_id_text::uuid,
    'organization',
    null,
    club.organization_id,
    'authorize-club-wallet',
    'solana:devnet',
    requested_wallet_address,
    requested_origin,
    1,
    requested_nonce_hash,
    requested_message_hash,
    requested_issued_at,
    requested_expires_at,
    null,
    null
  );

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return 'issued';
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

create function app.complete_club_wallet_challenge(
  requested_challenge_id uuid,
  requested_wallet_address text,
  requested_message_hash bytea
)
returns table (
  completion_result text,
  organization_slug text,
  organization_name text,
  binding_wallet_address text,
  binding_cluster text,
  binding_verified_at timestamptz,
  authority_granted_at timestamptz,
  authority_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  auth_session_id_text text;
  profile_id_text text;
  run_id_text text;
  challenge_record record;
  club record;
  authority_record record;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet actor context is invalid';
  end if;

  if requested_wallet_address is null
    or pg_catalog.octet_length(requested_message_hash) <> 32
  then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet proof request is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  auth_session_id_text := pg_catalog.current_setting(
    'app.current_auth_session_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  if auth_session_id_text is null then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet session context is invalid';
  end if;
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  select challenge.*
  into challenge_record
  from app.auth_challenges as challenge
  where challenge.id = requested_challenge_id
    and challenge.run_id = run_id_text::uuid
    and challenge.auth_user_id = auth_user_id_text::uuid
    and challenge.auth_session_id = auth_session_id_text::uuid
    and challenge.owner_type = 'organization'
    and challenge.profile_id is null
    and challenge.organization_id is not null
    and challenge.purpose = 'authorize-club-wallet'
    and challenge.cluster = 'solana:devnet'
    and challenge.wallet_address = requested_wallet_address
    and challenge.message_hash = requested_message_hash
    and challenge.consumed_at is null
    and challenge.expires_at >= pg_catalog.statement_timestamp()
  for update;

  if not found then
    completion_result := 'invalid-proof';
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth_user_id_text, 41001)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(challenge_record.organization_id::text, 41002)
  );

  select
    organization.slug,
    organization.name,
    binding.id as binding_id,
    binding.wallet_address,
    binding.cluster,
    binding.verified_at
  into club
  from app.organization_memberships as membership
  join app.organizations as organization
    on organization.run_id = membership.run_id
    and organization.id = membership.organization_id
  join app.wallet_bindings as binding
    on binding.run_id = membership.run_id
    and binding.organization_id = membership.organization_id
    and binding.owner_type = 'organization'
    and binding.provenance = 'prepared'
    and binding.status = 'active'
  where membership.run_id = run_id_text::uuid
    and membership.organization_id = challenge_record.organization_id
    and membership.profile_id = profile_id_text::uuid
    and membership.role = 'primary_admin'
    and membership.status = 'active'
    and organization.status = 'active'
    and binding.wallet_address = requested_wallet_address
    and binding.cluster = 'solana:devnet';

  if not found then
    update app.auth_challenges
    set
      consumed_at = pg_catalog.statement_timestamp(),
      consumed_result = 'state-conflict'
    where id = requested_challenge_id;

    completion_result := 'state-conflict';
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return next;
    return;
  end if;

  update app.organization_wallet_authorities
  set
    revoked_at = pg_catalog.statement_timestamp(),
    revocation_reason = case
      when expires_at <= pg_catalog.statement_timestamp() then 'expired'
      else 'superseded'
    end
  where run_id = run_id_text::uuid
    and revoked_at is null
    and (
      auth_user_id = auth_user_id_text::uuid
      or organization_id = challenge_record.organization_id
    );

  insert into app.organization_wallet_authorities (
    id,
    run_id,
    auth_user_id,
    auth_session_id,
    profile_id,
    organization_id,
    wallet_binding_id,
    wallet_address,
    cluster,
    challenge_id,
    granted_at,
    expires_at,
    revoked_at,
    revocation_reason
  )
  values (
    requested_challenge_id,
    run_id_text::uuid,
    auth_user_id_text::uuid,
    auth_session_id_text::uuid,
    profile_id_text::uuid,
    challenge_record.organization_id,
    club.binding_id,
    club.wallet_address,
    club.cluster,
    requested_challenge_id,
    pg_catalog.statement_timestamp(),
    pg_catalog.statement_timestamp() + interval '10 minutes',
    null,
    null
  )
  returning * into authority_record;

  update app.auth_challenges
  set
    consumed_at = pg_catalog.statement_timestamp(),
    consumed_result = 'authorized'
  where id = requested_challenge_id;

  completion_result := 'authorized';
  organization_slug := club.slug;
  organization_name := club.name;
  binding_wallet_address := club.wallet_address;
  binding_cluster := club.cluster;
  binding_verified_at := club.verified_at;
  authority_granted_at := authority_record.granted_at;
  authority_expires_at := authority_record.expires_at;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return next;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

create function app.revoke_club_wallet_authority()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  run_id_text text;
  revoked_count integer;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'club wallet actor context is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  update app.organization_wallet_authorities
  set
    revoked_at = pg_catalog.statement_timestamp(),
    revocation_reason = case
      when expires_at <= pg_catalog.statement_timestamp() then 'expired'
      else 'client-disconnect'
    end
  where run_id = run_id_text::uuid
    and auth_user_id = auth_user_id_text::uuid
    and revoked_at is null;

  get diagnostics revoked_count = row_count;
  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return case when revoked_count > 0 then 'revoked' else 'no-authority' end;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

alter function app.current_club_wallet_context() owner to app_owner;
alter function app.issue_club_wallet_challenge(
  uuid,
  text,
  text,
  bytea,
  bytea,
  timestamptz,
  timestamptz
) owner to app_owner;
alter function app.complete_club_wallet_challenge(uuid, text, bytea)
  owner to app_owner;
alter function app.revoke_club_wallet_authority() owner to app_owner;

revoke all on function app.current_club_wallet_context()
  from public, anon, authenticated, service_role;
revoke all on function app.issue_club_wallet_challenge(
  uuid,
  text,
  text,
  bytea,
  bytea,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app.complete_club_wallet_challenge(uuid, text, bytea)
  from public, anon, authenticated, service_role;
revoke all on function app.revoke_club_wallet_authority()
  from public, anon, authenticated, service_role;

grant execute on function app.current_club_wallet_context()
  to app_runtime;
grant execute on function app.issue_club_wallet_challenge(
  uuid,
  text,
  text,
  bytea,
  bytea,
  timestamptz,
  timestamptz
) to app_runtime;
grant execute on function app.complete_club_wallet_challenge(uuid, text, bytea)
  to app_runtime;
grant execute on function app.revoke_club_wallet_authority()
  to app_runtime;
