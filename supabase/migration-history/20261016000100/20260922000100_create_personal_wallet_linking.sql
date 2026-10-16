create table app.auth_challenges (
  id uuid primary key,
  run_id uuid not null,
  auth_user_id uuid not null,
  owner_type text not null,
  profile_id uuid null,
  organization_id uuid null,
  purpose text not null,
  cluster text not null,
  wallet_address text not null,
  origin text not null,
  message_version integer not null,
  nonce_hash bytea not null,
  message_hash bytea not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  consumed_result text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_challenges_run_id_id_key unique (run_id, id),
  constraint auth_challenges_run_id_fkey
    foreign key (run_id) references app.demo_runs (id) on delete restrict,
  constraint auth_challenges_auth_user_id_fkey
    foreign key (auth_user_id) references auth.users (id) on delete restrict,
  constraint auth_challenges_personal_target_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_memberships (run_id, profile_id)
    on delete restrict,
  constraint auth_challenges_organization_target_fkey
    foreign key (run_id, organization_id)
    references app.organizations (run_id, id)
    on delete restrict,
  constraint auth_challenges_owner_type_check
    check (owner_type in ('personal', 'organization')),
  constraint auth_challenges_owner_target_check
    check (
      (
        owner_type = 'personal'
        and profile_id is not null
        and organization_id is null
      )
      or (
        owner_type = 'organization'
        and profile_id is null
        and organization_id is not null
      )
    ),
  constraint auth_challenges_purpose_check
    check (purpose in ('link-personal-wallet', 'replace-personal-wallet')),
  constraint auth_challenges_personal_purpose_check
    check (owner_type = 'personal'),
  constraint auth_challenges_cluster_check
    check (cluster = 'solana:devnet'),
  constraint auth_challenges_wallet_address_check
    check (
      char_length(wallet_address) between 32 and 44
      and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
    ),
  constraint auth_challenges_origin_check
    check (
      char_length(origin) between 8 and 255
      and origin !~ '[[:space:]]'
      and (
        origin ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
        or origin ~ '^http://localhost:[0-9]{2,5}$'
      )
    ),
  constraint auth_challenges_message_version_check
    check (message_version = 1),
  constraint auth_challenges_nonce_hash_check
    check (octet_length(nonce_hash) = 32),
  constraint auth_challenges_message_hash_check
    check (octet_length(message_hash) = 32),
  constraint auth_challenges_lifetime_check
    check (expires_at = issued_at + interval '5 minutes'),
  constraint auth_challenges_consumed_state_check
    check ((consumed_at is null) = (consumed_result is null)),
  constraint auth_challenges_consumed_result_check
    check (
      consumed_result is null
      or consumed_result in (
        'linked',
        'replaced',
        'wallet-conflict',
        'state-conflict'
      )
    )
);

create index auth_challenges_actor_expiry_idx
  on app.auth_challenges (
    auth_user_id,
    run_id,
    purpose,
    expires_at desc
  );
create index auth_challenges_unconsumed_expiry_idx
  on app.auth_challenges (expires_at)
  where consumed_at is null;

create trigger auth_challenges_set_updated_at
before update on app.auth_challenges
for each row execute function app.set_updated_at();

alter table app.auth_challenges enable row level security;
alter table app.auth_challenges force row level security;
alter table app.auth_challenges owner to app_owner;

revoke all on app.auth_challenges from public, anon, authenticated, service_role;

create policy auth_challenges_wallet_management_all
  on app.auth_challenges
  for all
  to app_owner
  using (current_setting('app.wallet_management', true) = 'on')
  with check (current_setting('app.wallet_management', true) = 'on');

create policy wallet_bindings_wallet_management_all
  on app.wallet_bindings
  for all
  to app_owner
  using (current_setting('app.wallet_management', true) = 'on')
  with check (current_setting('app.wallet_management', true) = 'on');

alter table app.wallet_bindings
  add column verified_by_challenge_id uuid null,
  add column reauthenticated_at timestamptz null,
  add column revocation_reason text null,
  add column replacement_binding_id uuid null;

alter table app.wallet_bindings
  add constraint wallet_bindings_verified_by_challenge_id_fkey
    foreign key (verified_by_challenge_id)
    references app.auth_challenges (id)
    on delete restrict,
  add constraint wallet_bindings_replacement_binding_id_fkey
    foreign key (replacement_binding_id)
    references app.wallet_bindings (id)
    on delete restrict
    deferrable initially deferred;

alter table app.wallet_bindings
  drop constraint wallet_bindings_provenance_check,
  drop constraint wallet_bindings_revoked_state_check;

update app.wallet_bindings
set revocation_reason = 'legacy'
where status = 'revoked'
  and revocation_reason is null;

alter table app.wallet_bindings
  add constraint wallet_bindings_provenance_check
    check (provenance in ('prepared', 'user-proof')),
  add constraint wallet_bindings_proof_state_check
    check (
      (provenance = 'prepared' and verified_by_challenge_id is null)
      or (provenance = 'user-proof' and verified_by_challenge_id is not null)
    ),
  add constraint wallet_bindings_revocation_reason_check
    check (
      revocation_reason is null
      or revocation_reason in ('legacy', 'unlinked', 'replaced')
    ),
  add constraint wallet_bindings_revoked_state_check
    check (
      (
        status = 'active'
        and revoked_at is null
        and revocation_reason is null
        and replacement_binding_id is null
      )
      or (
        status = 'revoked'
        and revoked_at is not null
        and revocation_reason is not null
        and (
          (revocation_reason = 'replaced' and replacement_binding_id is not null)
          or (revocation_reason <> 'replaced' and replacement_binding_id is null)
        )
        and (
          revocation_reason = 'legacy'
          or reauthenticated_at is not null
        )
      )
    );

create function app.current_personal_wallet_binding()
returns table (
  binding_id uuid,
  binding_wallet_address text,
  binding_cluster text,
  binding_verified_at timestamptz,
  binding_provenance text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  return query
  select
    binding.id,
    binding.wallet_address,
    binding.cluster,
    binding.verified_at,
    binding.provenance
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.owner_type = 'personal'
    and binding.status = 'active';

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

create function app.issue_personal_wallet_challenge(
  requested_challenge_id uuid,
  requested_purpose text,
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
  profile_id_text text;
  run_id_text text;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  if requested_purpose not in (
    'link-personal-wallet',
    'replace-personal-wallet'
  )
    or requested_wallet_address is null
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
      message = 'wallet challenge request is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.owner_type = 'personal'
    and binding.status = 'active';

  if (
    requested_purpose = 'link-personal-wallet'
    and active_wallet_address is not null
  ) or (
    requested_purpose = 'replace-personal-wallet'
    and (
      active_wallet_address is null
      or active_wallet_address = requested_wallet_address
    )
  ) then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'state-conflict';
  end if;

  insert into app.auth_challenges (
    id,
    run_id,
    auth_user_id,
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
    'personal',
    profile_id_text::uuid,
    null,
    requested_purpose,
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

create function app.complete_personal_wallet_challenge(
  requested_challenge_id uuid,
  requested_purpose text,
  requested_wallet_address text,
  requested_message_hash bytea,
  requested_reauthenticated_at timestamptz
)
returns table (
  completion_result text,
  binding_id uuid,
  binding_wallet_address text,
  binding_cluster text,
  binding_verified_at timestamptz,
  binding_provenance text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  active_binding record;
  conflicting_binding_id uuid;
  new_binding_id uuid;
  new_binding record;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  if requested_purpose not in (
    'link-personal-wallet',
    'replace-personal-wallet'
  )
    or requested_wallet_address is null
    or pg_catalog.octet_length(requested_message_hash) <> 32
    or (
      requested_purpose = 'link-personal-wallet'
      and requested_reauthenticated_at is not null
    )
    or (
      requested_purpose = 'replace-personal-wallet'
      and (
        requested_reauthenticated_at is null
        or requested_reauthenticated_at <
          pg_catalog.statement_timestamp() - interval '10 minutes'
        or requested_reauthenticated_at >
          pg_catalog.statement_timestamp() + interval '30 seconds'
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'wallet proof request is invalid';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  new_binding_id := requested_challenge_id;
  perform pg_catalog.set_config('app.wallet_management', 'on', true);

  perform 1
  from app.auth_challenges as challenge
  where challenge.id = requested_challenge_id
    and challenge.run_id = run_id_text::uuid
    and challenge.auth_user_id = auth_user_id_text::uuid
    and challenge.profile_id = profile_id_text::uuid
    and challenge.owner_type = 'personal'
    and challenge.purpose = requested_purpose
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
    pg_catalog.hashtextextended(auth_user_id_text, 47001)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.concat('solana:devnet:', requested_wallet_address),
      47002
    )
  );

  select binding.*
  into active_binding
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.owner_type = 'personal'
    and binding.status = 'active'
  for update;

  select binding.id
  into conflicting_binding_id
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.wallet_address = requested_wallet_address
    and binding.status = 'active'
    and (
      active_binding.id is null
      or binding.id <> active_binding.id
    )
  limit 1;

  if conflicting_binding_id is not null then
    update app.auth_challenges
    set
      consumed_at = pg_catalog.statement_timestamp(),
      consumed_result = 'wallet-conflict'
    where id = requested_challenge_id;

    completion_result := 'wallet-conflict';
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return next;
    return;
  end if;

  if (
    requested_purpose = 'link-personal-wallet'
    and active_binding.id is not null
  ) or (
    requested_purpose = 'replace-personal-wallet'
    and (
      active_binding.id is null
      or active_binding.wallet_address = requested_wallet_address
    )
  ) then
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

  if requested_purpose = 'replace-personal-wallet' then
    update app.wallet_bindings
    set
      status = 'revoked',
      revoked_at = pg_catalog.statement_timestamp(),
      reauthenticated_at = requested_reauthenticated_at,
      revocation_reason = 'replaced',
      replacement_binding_id = new_binding_id
    where id = active_binding.id;
  end if;

  insert into app.wallet_bindings (
    id,
    run_id,
    cluster,
    wallet_address,
    owner_type,
    profile_id,
    organization_id,
    bound_by_auth_user_id,
    provenance,
    status,
    verified_at,
    revoked_at,
    verified_by_challenge_id,
    reauthenticated_at,
    revocation_reason,
    replacement_binding_id
  )
  values (
    new_binding_id,
    run_id_text::uuid,
    'solana:devnet',
    requested_wallet_address,
    'personal',
    profile_id_text::uuid,
    null,
    auth_user_id_text::uuid,
    'user-proof',
    'active',
    pg_catalog.statement_timestamp(),
    null,
    requested_challenge_id,
    requested_reauthenticated_at,
    null,
    null
  )
  returning * into new_binding;

  update app.auth_challenges
  set
    consumed_at = pg_catalog.statement_timestamp(),
    consumed_result = case
      when requested_purpose = 'replace-personal-wallet' then 'replaced'
      else 'linked'
    end
  where id = requested_challenge_id;

  completion_result := case
    when requested_purpose = 'replace-personal-wallet' then 'replaced'
    else 'linked'
  end;
  binding_id := new_binding.id;
  binding_wallet_address := new_binding.wallet_address;
  binding_cluster := new_binding.cluster;
  binding_verified_at := new_binding.verified_at;
  binding_provenance := new_binding.provenance;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return next;
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

create function app.unlink_personal_wallet(
  requested_reauthenticated_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id_text text;
  profile_id_text text;
  run_id_text text;
  active_binding_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null) then
    raise exception using
      errcode = 'P0001',
      message = 'wallet actor context is invalid';
  end if;

  if requested_reauthenticated_at is null
    or requested_reauthenticated_at <
      pg_catalog.statement_timestamp() - interval '10 minutes'
    or requested_reauthenticated_at >
      pg_catalog.statement_timestamp() + interval '30 seconds'
  then
    raise exception using
      errcode = 'P0001',
      message = 'recent email authentication is required';
  end if;

  auth_user_id_text := pg_catalog.current_setting(
    'app.current_auth_user_id',
    true
  );
  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.wallet_management', 'on', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth_user_id_text, 47001)
  );

  select binding.id
  into active_binding_id
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.owner_type = 'personal'
    and binding.status = 'active'
  for update;

  if active_binding_id is null then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    return 'state-conflict';
  end if;

  update app.wallet_bindings
  set
    status = 'revoked',
    revoked_at = pg_catalog.statement_timestamp(),
    reauthenticated_at = requested_reauthenticated_at,
    revocation_reason = 'unlinked'
  where id = active_binding_id;

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
  return 'unlinked';
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

alter function app.current_personal_wallet_binding() owner to app_owner;
alter function app.issue_personal_wallet_challenge(
  uuid,
  text,
  text,
  text,
  bytea,
  bytea,
  timestamptz,
  timestamptz
) owner to app_owner;
alter function app.complete_personal_wallet_challenge(
  uuid,
  text,
  text,
  bytea,
  timestamptz
) owner to app_owner;
alter function app.unlink_personal_wallet(timestamptz) owner to app_owner;

revoke all on function app.current_personal_wallet_binding()
  from public, anon, authenticated, service_role;
revoke all on function app.issue_personal_wallet_challenge(
  uuid,
  text,
  text,
  text,
  bytea,
  bytea,
  timestamptz,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app.complete_personal_wallet_challenge(
  uuid,
  text,
  text,
  bytea,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app.unlink_personal_wallet(timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function app.current_personal_wallet_binding()
  to app_runtime;
grant execute on function app.issue_personal_wallet_challenge(
  uuid,
  text,
  text,
  text,
  bytea,
  bytea,
  timestamptz,
  timestamptz
) to app_runtime;
grant execute on function app.complete_personal_wallet_challenge(
  uuid,
  text,
  text,
  bytea,
  timestamptz
) to app_runtime;
grant execute on function app.unlink_personal_wallet(timestamptz)
  to app_runtime;
