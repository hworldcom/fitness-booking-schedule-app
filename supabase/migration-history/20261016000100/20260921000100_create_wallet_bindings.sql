create table app.wallet_bindings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  cluster text not null,
  wallet_address text not null,
  owner_type text not null,
  profile_id uuid null,
  organization_id uuid null,
  bound_by_auth_user_id uuid not null,
  provenance text not null,
  status text not null default 'active',
  verified_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_bindings_run_id_id_key unique (run_id, id),
  constraint wallet_bindings_run_id_fkey
    foreign key (run_id) references app.demo_runs (id) on delete restrict,
  constraint wallet_bindings_personal_target_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_memberships (run_id, profile_id)
    on delete restrict,
  constraint wallet_bindings_organization_target_fkey
    foreign key (run_id, organization_id)
    references app.organizations (run_id, id)
    on delete restrict,
  constraint wallet_bindings_bound_by_auth_user_id_fkey
    foreign key (bound_by_auth_user_id)
    references auth.users (id)
    on delete restrict,
  constraint wallet_bindings_cluster_check
    check (cluster = 'solana:devnet'),
  constraint wallet_bindings_wallet_address_check
    check (
      char_length(wallet_address) between 32 and 44
      and wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
    ),
  constraint wallet_bindings_owner_type_check
    check (owner_type in ('personal', 'organization')),
  constraint wallet_bindings_owner_target_check
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
  constraint wallet_bindings_provenance_check
    check (provenance = 'prepared'),
  constraint wallet_bindings_status_check
    check (status in ('active', 'revoked')),
  constraint wallet_bindings_revoked_state_check
    check ((status = 'revoked') = (revoked_at is not null))
);

create unique index wallet_bindings_active_wallet_owner_idx
  on app.wallet_bindings (run_id, cluster, wallet_address)
  where status = 'active';

create unique index wallet_bindings_active_personal_profile_idx
  on app.wallet_bindings (run_id, profile_id)
  where status = 'active' and owner_type = 'personal';

create unique index wallet_bindings_active_organization_idx
  on app.wallet_bindings (run_id, organization_id)
  where status = 'active' and owner_type = 'organization';

create unique index wallet_bindings_active_personal_auth_user_idx
  on app.wallet_bindings (run_id, bound_by_auth_user_id)
  where status = 'active' and owner_type = 'personal';

create index wallet_bindings_auth_user_status_run_idx
  on app.wallet_bindings (bound_by_auth_user_id, status, run_id);

create trigger wallet_bindings_set_updated_at
before update on app.wallet_bindings
for each row execute function app.set_updated_at();

alter table app.wallet_bindings enable row level security;
alter table app.wallet_bindings force row level security;
alter table app.wallet_bindings owner to app_owner;

grant select, insert, update, delete on app.wallet_bindings to app_runtime;

create policy profiles_identity_enrollment_select
  on app.profiles
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy profiles_identity_enrollment_update
  on app.profiles
  for update
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on')
  with check (current_setting('app.identity_enrollment', true) = 'on');

create policy demo_runs_identity_enrollment_select
  on app.demo_runs
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy demo_run_memberships_identity_enrollment_select
  on app.demo_run_memberships
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy wallet_bindings_identity_enrollment_select
  on app.wallet_bindings
  for select
  to app_owner
  using (current_setting('app.identity_enrollment', true) = 'on');

create policy wallet_bindings_identity_enrollment_insert
  on app.wallet_bindings
  for insert
  to app_owner
  with check (current_setting('app.identity_enrollment', true) = 'on');

create function app.enroll_prepared_personal_identity(
  requested_auth_user_id uuid,
  requested_run_slug text,
  requested_profile_slug text,
  requested_cluster text,
  requested_wallet_address text
)
returns table (
  identity_profile_id uuid,
  identity_profile_slug text,
  identity_display_name text,
  identity_run_id uuid,
  identity_run_slug text,
  identity_run_name text,
  identity_role text,
  identity_wallet_binding_id uuid,
  identity_wallet_address text,
  identity_cluster text
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  selected_run_id uuid;
  selected_profile_id uuid;
  selected_profile_auth_user_id uuid;
  returned_rows integer;
begin
  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);

  select demo_run.id
  into selected_run_id
  from app.demo_runs as demo_run
  where demo_run.slug = requested_run_slug
    and demo_run.status = 'active';

  if selected_run_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'prepared identity enrollment is unavailable';
  end if;

  select profile.id, profile.auth_user_id
  into selected_profile_id, selected_profile_auth_user_id
  from app.profiles as profile
  join app.demo_run_memberships as membership
    on membership.run_id = selected_run_id
    and membership.profile_id = profile.id
  where profile.slug = requested_profile_slug
    and profile.record_source = 'fixture'
    and membership.status = 'active'
  for update of profile;

  if selected_profile_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'prepared identity enrollment is unavailable';
  end if;

  if selected_profile_auth_user_id is null then
    update app.profiles
    set
      auth_user_id = requested_auth_user_id,
      claimed_at = statement_timestamp()
    where id = selected_profile_id;
  elsif selected_profile_auth_user_id <> requested_auth_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'prepared identity enrollment conflicts with existing state';
  end if;

  insert into app.wallet_bindings (
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
    revoked_at
  )
  values (
    selected_run_id,
    requested_cluster,
    requested_wallet_address,
    'personal',
    selected_profile_id,
    null,
    requested_auth_user_id,
    'prepared',
    'active',
    statement_timestamp(),
    null
  )
  on conflict do nothing;

  return query
  select
    profile.id,
    profile.slug,
    profile.display_name,
    demo_run.id,
    demo_run.slug,
    demo_run.name,
    membership.role,
    binding.id,
    binding.wallet_address,
    binding.cluster
  from app.profiles as profile
  join app.demo_run_memberships as membership
    on membership.profile_id = profile.id
  join app.demo_runs as demo_run
    on demo_run.id = membership.run_id
  join app.wallet_bindings as binding
    on binding.run_id = membership.run_id
    and binding.profile_id = profile.id
  where profile.id = selected_profile_id
    and profile.auth_user_id = requested_auth_user_id
    and membership.run_id = selected_run_id
    and membership.status = 'active'
    and demo_run.status = 'active'
    and binding.owner_type = 'personal'
    and binding.bound_by_auth_user_id = requested_auth_user_id
    and binding.cluster = requested_cluster
    and binding.wallet_address = requested_wallet_address
    and binding.status = 'active';

  get diagnostics returned_rows = row_count;
  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);

  if returned_rows <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'prepared identity enrollment conflicts with existing state';
  end if;
end;
$$;

create function app.current_prepared_personal_identity(
  requested_auth_user_id uuid,
  requested_run_slug text,
  requested_profile_slug text,
  requested_cluster text,
  requested_wallet_address text
)
returns table (
  identity_profile_id uuid,
  identity_profile_slug text,
  identity_display_name text,
  identity_run_id uuid,
  identity_run_slug text,
  identity_run_name text,
  identity_role text,
  identity_wallet_binding_id uuid,
  identity_wallet_address text,
  identity_cluster text
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  perform pg_catalog.set_config('app.identity_enrollment', 'on', true);

  return query
  select
    profile.id,
    profile.slug,
    profile.display_name,
    demo_run.id,
    demo_run.slug,
    demo_run.name,
    membership.role,
    binding.id,
    binding.wallet_address,
    binding.cluster
  from app.profiles as profile
  join app.demo_run_memberships as membership
    on membership.profile_id = profile.id
  join app.demo_runs as demo_run
    on demo_run.id = membership.run_id
  join app.wallet_bindings as binding
    on binding.run_id = membership.run_id
    and binding.profile_id = profile.id
  where profile.auth_user_id = requested_auth_user_id
    and profile.slug = requested_profile_slug
    and membership.status = 'active'
    and demo_run.slug = requested_run_slug
    and demo_run.status = 'active'
    and binding.owner_type = 'personal'
    and binding.bound_by_auth_user_id = requested_auth_user_id
    and binding.cluster = requested_cluster
    and binding.wallet_address = requested_wallet_address
    and binding.status = 'active';

  perform pg_catalog.set_config('app.identity_enrollment', 'off', true);
end;
$$;

alter function app.enroll_prepared_personal_identity(uuid, text, text, text, text)
  owner to app_owner;
alter function app.current_prepared_personal_identity(uuid, text, text, text, text)
  owner to app_owner;

revoke all on function app.enroll_prepared_personal_identity(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function app.current_prepared_personal_identity(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function app.enroll_prepared_personal_identity(uuid, text, text, text, text)
  to app_runtime;
grant execute on function app.current_prepared_personal_identity(uuid, text, text, text, text)
  to app_runtime;
