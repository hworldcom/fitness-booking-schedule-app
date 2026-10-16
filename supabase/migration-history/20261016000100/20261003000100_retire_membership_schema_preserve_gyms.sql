-- Replace the retired multi-gym membership model with simple fictional gym
-- locations. This migration intentionally has no broad cascade: an unknown
-- dependency must stop the migration for review instead of being discarded.

do $preflight$
begin
  if exists (
    select 1
    from app.organizations
    where record_source <> 'fixture'
  ) or exists (
    select 1
    from app.venues
    where record_source <> 'fixture'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach schema cleanup requires review of non-fixture organization or venue rows';
  end if;

  if exists (
    select 1
    from app.organization_memberships as membership
    join app.profiles as profile on profile.id = membership.profile_id
    where profile.record_source <> 'fixture'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach schema cleanup requires review of non-fixture organization memberships';
  end if;

  if exists (select 1 from app.organization_wallet_authorities)
    or exists (
      select 1
      from app.wallet_bindings
      where owner_type = 'organization'
    )
    or exists (
      select 1
      from app.auth_challenges
      where owner_type = 'organization'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach schema cleanup requires export or explicit retirement of organization wallet state';
  end if;

  if exists (select 1 from app.membership_activation_operations)
    or exists (select 1 from app.membership_periods)
    or exists (select 1 from app.membership_daily_access_claims)
    or exists (select 1 from app.class_reservations)
    or exists (select 1 from app.membership_arrival_requests)
    or exists (select 1 from app.membership_checkins)
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach schema cleanup requires export or explicit retirement of member operation history';
  end if;

  if exists (
    select 1
    from app.participating_gyms as participating_gym
    left join app.venues as venue
      on venue.run_id = participating_gym.run_id
      and venue.id = participating_gym.venue_id
    left join app.organizations as organization
      on organization.run_id = venue.run_id
      and organization.id = venue.organization_id
    left join pg_catalog.pg_timezone_names as timezone_record
      on timezone_record.name = venue.timezone
    where venue.id is null
      or organization.id is null
      or venue.record_source <> 'fixture'
      or organization.record_source <> 'fixture'
      or pg_catalog.char_length(venue.slug) not between 1 and 80
      or pg_catalog.char_length(venue.name) not between 2 and 160
      or pg_catalog.char_length(venue.description) not between 1 and 2000
      or pg_catalog.char_length(
        pg_catalog.concat_ws(
          ' — ',
          participating_gym.map_label,
          participating_gym.map_address
        )
      ) not between 2 and 240
      or pg_catalog.char_length(venue.area) not between 1 and 120
      or pg_catalog.char_length(venue.city) not between 1 and 120
      or venue.country_code !~ '^[A-Z]{2}$'
      or timezone_record.name is null
      or participating_gym.map_latitude not between -90 and 90
      or participating_gym.map_longitude not between -180 and 180
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'coach schema cleanup found a malformed fictional gym location';
  end if;
end
$preflight$;

create temporary table dev0109_retained_state_snapshot on commit drop as
select
  (
    select pg_catalog.md5(
      coalesce(
        pg_catalog.string_agg(
          (
            pg_catalog.to_jsonb(binding)
            - 'owner_type'
            - 'organization_id'
          )::text,
          '' order by binding.id
        ),
        ''
      )
    )
    from app.wallet_bindings as binding
    where binding.owner_type = 'personal'
  ) as personal_wallet_hash,
  (
    select pg_catalog.md5(
      coalesce(
        pg_catalog.string_agg(
          (
            pg_catalog.to_jsonb(challenge)
            - 'auth_session_id'
            - 'owner_type'
            - 'organization_id'
          )::text,
          '' order by challenge.id
        ),
        ''
      )
    )
    from app.auth_challenges as challenge
    where challenge.owner_type = 'personal'
  ) as personal_challenge_hash,
  (
    select pg_catalog.md5(
      coalesce(
        pg_catalog.string_agg(
          pg_catalog.concat_ws(
            ':',
            profile.id::text,
            profile.auth_user_id::text,
            profile.slug,
            profile.record_source
          ),
          '' order by profile.id
        ),
        ''
      )
    )
    from app.profiles as profile
  ) as profile_hash,
  (
    select pg_catalog.md5(
      coalesce(
        pg_catalog.string_agg(
          pg_catalog.concat_ws(
            ':',
            participant.run_id::text,
            participant.profile_id::text,
            participant.role,
            participant.status
          ),
          '' order by participant.run_id, participant.profile_id
        ),
        ''
      )
    )
    from app.demo_run_participants as participant
  ) as participant_hash;

create table app.gyms (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  slug text not null,
  name text not null,
  description text not null,
  public_location_label text not null,
  area text not null,
  city text not null,
  country_code text not null,
  timezone text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  location_source text not null,
  location_provider text null,
  location_confirmed_at timestamptz not null,
  status text not null,
  record_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gyms_run_id_fkey
    foreign key (run_id) references app.demo_runs (id) on delete restrict,
  constraint gyms_run_id_id_key unique (run_id, id),
  constraint gyms_run_id_slug_key unique (run_id, slug),
  constraint gyms_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint gyms_name_length_check
    check (char_length(name) between 2 and 160),
  constraint gyms_description_length_check
    check (char_length(description) between 1 and 2000),
  constraint gyms_public_location_label_length_check
    check (char_length(public_location_label) between 2 and 240),
  constraint gyms_area_length_check
    check (char_length(area) between 1 and 120),
  constraint gyms_city_length_check
    check (char_length(city) between 1 and 120),
  constraint gyms_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint gyms_timezone_format_check
    check (
      timezone = 'UTC'
      or timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+.-]+)+$'
    ),
  constraint gyms_latitude_check check (latitude between -90 and 90),
  constraint gyms_longitude_check check (longitude between -180 and 180),
  constraint gyms_location_source_check
    check (location_source in ('fixture', 'manual', 'permanent-geocoding')),
  constraint gyms_location_provider_check
    check (
      location_provider is null
      or (
        char_length(location_provider) between 2 and 40
        and location_provider ~ '^[a-z0-9-]+$'
      )
    ),
  constraint gyms_location_provenance_check
    check (
      (location_source in ('fixture', 'manual') and location_provider is null)
      or (
        location_source = 'permanent-geocoding'
        and location_provider is not null
      )
    ),
  constraint gyms_status_check check (status in ('active', 'inactive')),
  constraint gyms_record_source_check
    check (record_source in ('fixture', 'user'))
);

insert into app.gyms (
  id,
  run_id,
  slug,
  name,
  description,
  public_location_label,
  area,
  city,
  country_code,
  timezone,
  latitude,
  longitude,
  location_source,
  location_provider,
  location_confirmed_at,
  status,
  record_source,
  created_at,
  updated_at
)
select
  venue.id,
  venue.run_id,
  venue.slug,
  venue.name,
  venue.description,
  pg_catalog.concat_ws(
    ' — ',
    participating_gym.map_label,
    participating_gym.map_address
  ),
  venue.area,
  venue.city,
  venue.country_code,
  venue.timezone,
  participating_gym.map_latitude::numeric(9, 6),
  participating_gym.map_longitude::numeric(9, 6),
  'fixture',
  null,
  participating_gym.created_at,
  case
    when participating_gym.status = 'active'
      and venue.status = 'active'
      and organization.status = 'active'
      then 'active'
    else 'inactive'
  end,
  'fixture',
  least(
    organization.created_at,
    venue.created_at,
    participating_gym.created_at
  ),
  greatest(
    organization.updated_at,
    venue.updated_at,
    participating_gym.updated_at
  )
from app.participating_gyms as participating_gym
join app.venues as venue
  on venue.run_id = participating_gym.run_id
  and venue.id = participating_gym.venue_id
join app.organizations as organization
  on organization.run_id = venue.run_id
  and organization.id = venue.organization_id;

create index gyms_run_status_name_idx on app.gyms (run_id, status, name);
create index gyms_run_city_area_idx on app.gyms (run_id, city, area);

create trigger gyms_set_updated_at
before update on app.gyms
for each row execute function app.set_updated_at();

alter table app.gyms enable row level security;
alter table app.gyms force row level security;
alter table app.gyms owner to app_owner;

revoke all on app.gyms from public, anon, authenticated, service_role;
revoke insert, update, delete on app.gyms from app_runtime;
grant select on app.gyms to app_runtime;

drop policy if exists demo_runs_public_catalogue_select on app.demo_runs;
create policy demo_runs_public_discovery_select
  on app.demo_runs
  for select
  to app_runtime
  using (status = 'active' and catalogue_visibility = 'public');

create policy gyms_public_discovery_select
  on app.gyms
  for select
  to app_runtime
  using (
    status = 'active'
    and exists (
      select 1
      from app.demo_runs as run
      where run.id = gyms.run_id
        and run.status = 'active'
        and run.catalogue_visibility = 'public'
    )
  );

comment on table app.gyms is
  'Fictional public training locations that coaches may optionally select; gyms have no account, wallet, membership, class, booking or check-in authority.';
comment on column app.gyms.public_location_label is
  'Reviewed public label for discovery; it is not live location or proof that a coach is present.';
comment on column app.gyms.location_source is
  'Provider-neutral provenance for the confirmed coordinate pair.';

drop policy if exists profiles_checkin_select on app.profiles;
drop policy if exists profiles_reservation_select on app.profiles;
drop policy if exists wallet_bindings_membership_activation_select
  on app.wallet_bindings;
drop policy if exists venues_public_catalogue_select on app.venues;
drop policy if exists organizations_wallet_management_select
  on app.organizations;
drop policy if exists organization_memberships_wallet_management_select
  on app.organization_memberships;

drop trigger if exists organization_wallet_authorities_set_updated_at
  on app.organization_wallet_authorities;
drop trigger if exists membership_checkins_guard
  on app.membership_checkins;
drop trigger if exists membership_arrival_requests_guard
  on app.membership_arrival_requests;
drop trigger if exists membership_arrival_requests_set_updated_at
  on app.membership_arrival_requests;
drop trigger if exists class_reservations_guard on app.class_reservations;
drop trigger if exists class_reservations_set_updated_at
  on app.class_reservations;
drop trigger if exists membership_daily_access_claims_guard
  on app.membership_daily_access_claims;
drop trigger if exists membership_daily_access_claims_set_updated_at
  on app.membership_daily_access_claims;
drop trigger if exists membership_period_core_gyms_immutable
  on app.membership_period_core_gyms;
drop trigger if exists membership_period_core_gyms_count
  on app.membership_period_core_gyms;
drop trigger if exists membership_periods_enforce_update
  on app.membership_periods;
drop trigger if exists membership_periods_gym_count on app.membership_periods;
drop trigger if exists membership_periods_set_updated_at
  on app.membership_periods;
drop trigger if exists membership_activation_operation_gyms_immutable
  on app.membership_activation_operation_gyms;
drop trigger if exists membership_activation_operation_gyms_count
  on app.membership_activation_operation_gyms;
drop trigger if exists membership_activation_operations_enforce_update
  on app.membership_activation_operations;
drop trigger if exists membership_activation_operations_gym_count
  on app.membership_activation_operations;
drop trigger if exists membership_activation_operations_set_updated_at
  on app.membership_activation_operations;
drop trigger if exists membership_product_gym_eligibility_set_updated_at
  on app.membership_product_gym_eligibility;
drop trigger if exists membership_product_versions_enforce_lifecycle
  on app.membership_product_versions;
drop trigger if exists membership_product_versions_set_updated_at
  on app.membership_product_versions;
drop trigger if exists membership_products_set_updated_at
  on app.membership_products;
drop trigger if exists participating_gyms_set_updated_at
  on app.participating_gyms;
drop trigger if exists class_sessions_set_updated_at on app.class_sessions;
drop trigger if exists trainer_affiliations_set_updated_at
  on app.trainer_affiliations;
drop trigger if exists venue_staff_set_updated_at on app.venue_staff;
drop trigger if exists venues_set_updated_at on app.venues;
drop trigger if exists organization_memberships_set_updated_at
  on app.organization_memberships;
drop trigger if exists organizations_set_updated_at on app.organizations;

do $drop_legacy_functions$
declare
  routine_record record;
begin
  for routine_record in
    select routine.oid::regprocedure as signature
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'app'
      and routine.proname = any (array[
        'cancel_member_arrival_request',
        'cancel_member_class_reservation',
        'complete_club_wallet_challenge',
        'complete_verified_membership_activation',
        'complete_verified_membership_payment',
        'confirm_member_arrival',
        'create_member_arrival_request',
        'current_club_wallet_context',
        'current_member_checkin_snapshot',
        'current_member_class_schedule',
        'current_membership_payment_state',
        'current_membership_state',
        'enforce_class_reservation_update',
        'enforce_daily_access_claim_update',
        'enforce_membership_activation_operation_update',
        'enforce_membership_arrival_request_update',
        'enforce_membership_operation_gym_count',
        'enforce_membership_period_gym_count',
        'enforce_membership_period_update',
        'enforce_membership_product_version_lifecycle',
        'enforce_membership_snapshot_gym_immutability',
        'fail_membership_activation',
        'issue_club_wallet_challenge',
        'prepare_membership_activation',
        'prepare_membership_payment_activation',
        'reconcile_member_arrival_requests',
        'reconcile_member_class_reservations',
        'record_membership_activation_submission',
        'record_membership_payment_submission',
        'reject_membership_checkin_update',
        'reserve_member_class',
        'revoke_club_wallet_authority'
      ])
  loop
    execute pg_catalog.format(
      'drop function %s',
      routine_record.signature
    );
  end loop;
end
$drop_legacy_functions$;

drop table app.organization_wallet_authorities;

create or replace function app.current_personal_wallet_binding()
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
    and binding.status = 'active';

  perform pg_catalog.set_config('app.wallet_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.wallet_management', 'off', true);
    raise;
end;
$$;

create or replace function app.issue_personal_wallet_challenge(
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
    profile_id,
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
    profile_id_text::uuid,
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

create or replace function app.complete_personal_wallet_challenge(
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
    profile_id,
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
    profile_id_text::uuid,
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

create or replace function app.unlink_personal_wallet(
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

drop index app.wallet_bindings_active_organization_idx;
drop index app.wallet_bindings_active_personal_profile_idx;
drop index app.wallet_bindings_active_personal_auth_user_idx;

alter table app.auth_challenges
  drop constraint auth_challenges_organization_target_fkey,
  drop constraint auth_challenges_owner_type_check,
  drop constraint auth_challenges_owner_target_check,
  drop constraint auth_challenges_purpose_check,
  drop constraint auth_challenges_owner_purpose_check,
  drop constraint auth_challenges_consumed_result_check,
  alter column profile_id set not null,
  drop column auth_session_id,
  drop column owner_type,
  drop column organization_id,
  add constraint auth_challenges_purpose_check
    check (purpose in ('link-personal-wallet', 'replace-personal-wallet')),
  add constraint auth_challenges_consumed_result_check
    check (
      consumed_result is null
      or consumed_result in (
        'linked',
        'replaced',
        'wallet-conflict',
        'state-conflict'
      )
    );

alter table app.wallet_bindings
  drop constraint wallet_bindings_organization_target_fkey,
  drop constraint wallet_bindings_owner_type_check,
  drop constraint wallet_bindings_owner_target_check,
  alter column profile_id set not null,
  drop column owner_type,
  drop column organization_id;

create unique index wallet_bindings_active_profile_idx
  on app.wallet_bindings (run_id, profile_id)
  where status = 'active';
create unique index wallet_bindings_active_auth_user_idx
  on app.wallet_bindings (run_id, bound_by_auth_user_id)
  where status = 'active';

drop table app.membership_checkins;
drop table app.membership_arrival_requests;
drop table app.class_reservations;
drop table app.membership_daily_access_claims;
drop table app.membership_period_core_gyms;
drop table app.membership_periods;
drop table app.membership_activation_operation_gyms;
drop table app.membership_activation_operations;
drop table app.membership_product_gym_eligibility;
drop table app.membership_product_versions;
drop table app.membership_products;
drop table app.participating_gyms;
drop table app.class_sessions;
drop table app.trainer_affiliations;
drop table app.venue_staff;
drop table app.venues;
drop table app.organization_memberships;
drop table app.organizations;

do $retained_state_check$
declare
  snapshot_record record;
  current_personal_wallet_hash text;
  current_personal_challenge_hash text;
  current_profile_hash text;
  current_participant_hash text;
begin
  select * into strict snapshot_record
  from dev0109_retained_state_snapshot;

  select pg_catalog.md5(
    coalesce(
      pg_catalog.string_agg(
        pg_catalog.to_jsonb(binding)::text,
        '' order by binding.id
      ),
      ''
    )
  ) into current_personal_wallet_hash
  from app.wallet_bindings as binding;

  select pg_catalog.md5(
    coalesce(
      pg_catalog.string_agg(
        pg_catalog.to_jsonb(challenge)::text,
        '' order by challenge.id
      ),
      ''
    )
  ) into current_personal_challenge_hash
  from app.auth_challenges as challenge;

  select pg_catalog.md5(
    coalesce(
      pg_catalog.string_agg(
        pg_catalog.concat_ws(
          ':',
          profile.id::text,
          profile.auth_user_id::text,
          profile.slug,
          profile.record_source
        ),
        '' order by profile.id
      ),
      ''
    )
  ) into current_profile_hash
  from app.profiles as profile;

  select pg_catalog.md5(
    coalesce(
      pg_catalog.string_agg(
        pg_catalog.concat_ws(
          ':',
          participant.run_id::text,
          participant.profile_id::text,
          participant.role,
          participant.status
        ),
        '' order by participant.run_id, participant.profile_id
      ),
      ''
    )
  ) into current_participant_hash
  from app.demo_run_participants as participant;

  if snapshot_record.personal_wallet_hash <> current_personal_wallet_hash
    or snapshot_record.personal_challenge_hash <>
      current_personal_challenge_hash
    or snapshot_record.profile_hash <> current_profile_hash
    or snapshot_record.participant_hash <> current_participant_hash
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach schema cleanup changed retained identity or personal wallet state';
  end if;
end
$retained_state_check$;

comment on table app.wallet_bindings is
  'Personal Devnet wallet ownership only; gyms have no wallet or authorization branch.';
comment on table app.auth_challenges is
  'Personal wallet link or replacement challenges only.';
