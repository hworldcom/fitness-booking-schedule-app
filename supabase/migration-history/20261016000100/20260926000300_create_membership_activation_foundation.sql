create extension if not exists btree_gist with schema extensions;

alter table app.membership_product_versions
  add constraint membership_product_versions_run_product_id_key
    unique (run_id, product_id, id);

create table app.membership_activation_operations (
  id uuid primary key,
  run_id uuid not null,
  profile_id uuid not null,
  product_id uuid not null,
  product_version_id uuid not null,
  operation_status text not null,
  plan_code text not null,
  plan_version_number integer not null,
  plan_name text not null,
  plan_description text not null,
  currency_code text not null,
  price_base_units numeric(20, 0) not null,
  period_policy text not null,
  access_model text not null,
  included_checkins integer null,
  max_included_checkins_per_day integer not null,
  required_core_gym_count integer not null,
  non_core_visit_price_base_units numeric(20, 0) not null,
  payment_cluster text not null default 'solana:devnet',
  payment_wallet_address text null,
  payment_destination_address text null,
  transaction_signature text null,
  submitted_at timestamptz null,
  confirmed_at timestamptz null,
  failed_at timestamptz null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_activation_operations_run_profile_fkey
    foreign key (run_id, profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint membership_activation_operations_product_version_fkey
    foreign key (run_id, product_id, product_version_id)
    references app.membership_product_versions (run_id, product_id, id)
    on delete restrict,
  constraint membership_activation_operations_run_id_id_key
    unique (run_id, id),
  constraint membership_activation_operations_run_profile_id_key
    unique (run_id, profile_id, id),
  constraint membership_activation_operations_run_product_id_key
    unique (run_id, id, product_id),
  constraint membership_activation_operations_status_check
    check (operation_status in ('pending', 'submitted', 'confirmed', 'failed')),
  constraint membership_activation_operations_plan_code_check
    check (plan_code in ('basic', 'classic')),
  constraint membership_activation_operations_plan_version_check
    check (plan_version_number > 0),
  constraint membership_activation_operations_plan_name_check
    check (char_length(plan_name) between 2 and 120),
  constraint membership_activation_operations_plan_description_check
    check (char_length(plan_description) between 1 and 2000),
  constraint membership_activation_operations_currency_check
    check (currency_code = 'EURC'),
  constraint membership_activation_operations_price_check
    check (
      price_base_units > 0
      and price_base_units <= 18446744073709551615
      and non_core_visit_price_base_units > 0
      and non_core_visit_price_base_units <= 18446744073709551615
    ),
  constraint membership_activation_operations_period_policy_check
    check (period_policy = 'calendar_month'),
  constraint membership_activation_operations_plan_terms_check
    check (
      max_included_checkins_per_day = 1
      and required_core_gym_count = 4
      and non_core_visit_price_base_units = 15000000
      and (
        (
          plan_code = 'basic'
          and price_base_units = 80000000
          and access_model = 'limited'
          and included_checkins = 10
        )
        or (
          plan_code = 'classic'
          and price_base_units = 150000000
          and access_model = 'daily_uncapped'
          and included_checkins is null
        )
      )
    ),
  constraint membership_activation_operations_cluster_check
    check (payment_cluster = 'solana:devnet'),
  constraint membership_activation_operations_wallet_check
    check (
      payment_wallet_address is null
      or (
        char_length(payment_wallet_address) between 32 and 44
        and payment_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      )
    ),
  constraint membership_activation_operations_destination_check
    check (
      payment_destination_address is null
      or (
        char_length(payment_destination_address) between 32 and 44
        and payment_destination_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      )
    ),
  constraint membership_activation_operations_signature_check
    check (
      transaction_signature is null
      or (
        char_length(transaction_signature) between 64 and 88
        and transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      )
    ),
  constraint membership_activation_operations_failure_reason_check
    check (
      failure_reason is null
      or failure_reason in (
        'wallet-cancelled',
        'transaction-rejected',
        'verification-failed',
        'superseded'
      )
    ),
  constraint membership_activation_operations_lifecycle_check
    check (
      (
        operation_status = 'pending'
        and payment_wallet_address is null
        and payment_destination_address is null
        and transaction_signature is null
        and submitted_at is null
        and confirmed_at is null
        and failed_at is null
        and failure_reason is null
      )
      or (
        operation_status = 'submitted'
        and payment_wallet_address is not null
        and payment_destination_address is not null
        and transaction_signature is not null
        and submitted_at is not null
        and confirmed_at is null
        and failed_at is null
        and failure_reason is null
      )
      or (
        operation_status = 'confirmed'
        and payment_wallet_address is not null
        and payment_destination_address is not null
        and transaction_signature is not null
        and submitted_at is not null
        and confirmed_at is not null
        and confirmed_at >= submitted_at
        and failed_at is null
        and failure_reason is null
      )
      or (
        operation_status = 'failed'
        and confirmed_at is null
        and failed_at is not null
        and failure_reason is not null
        and (
          (
            submitted_at is null
            and payment_wallet_address is null
            and payment_destination_address is null
            and transaction_signature is null
          )
          or (
            submitted_at is not null
            and payment_wallet_address is not null
            and payment_destination_address is not null
            and transaction_signature is not null
            and failed_at >= submitted_at
          )
        )
      )
    )
);

create unique index membership_activation_operations_one_open_idx
  on app.membership_activation_operations (run_id, profile_id)
  where operation_status in ('pending', 'submitted');

create unique index membership_activation_operations_transaction_idx
  on app.membership_activation_operations (
    payment_cluster,
    transaction_signature
  )
  where transaction_signature is not null;

create index membership_activation_operations_member_history_idx
  on app.membership_activation_operations (
    run_id,
    profile_id,
    created_at desc
  );

create table app.membership_activation_operation_gyms (
  run_id uuid not null,
  operation_id uuid not null,
  product_id uuid not null,
  venue_id uuid not null,
  selection_order integer not null,
  venue_slug text not null,
  venue_name text not null,
  created_at timestamptz not null default now(),
  constraint membership_activation_operation_gyms_pkey
    primary key (run_id, operation_id, venue_id),
  constraint membership_activation_operation_gyms_operation_fkey
    foreign key (run_id, operation_id, product_id)
    references app.membership_activation_operations (run_id, id, product_id)
    on delete restrict,
  constraint membership_activation_operation_gyms_eligibility_fkey
    foreign key (run_id, product_id, venue_id)
    references app.membership_product_gym_eligibility (
      run_id,
      product_id,
      venue_id
    )
    on delete restrict,
  constraint membership_activation_operation_gyms_order_key
    unique (run_id, operation_id, selection_order),
  constraint membership_activation_operation_gyms_order_check
    check (selection_order between 1 and 4),
  constraint membership_activation_operation_gyms_slug_check
    check (
      char_length(venue_slug) between 1 and 80
      and venue_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint membership_activation_operation_gyms_name_check
    check (char_length(venue_name) between 2 and 160)
);

create table app.membership_periods (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  profile_id uuid not null,
  activation_operation_id uuid not null,
  product_id uuid not null,
  product_version_id uuid not null,
  plan_code text not null,
  plan_version_number integer not null,
  plan_name text not null,
  plan_description text not null,
  currency_code text not null,
  price_base_units numeric(20, 0) not null,
  period_policy text not null,
  access_model text not null,
  included_checkins integer null,
  included_checkins_used integer not null default 0,
  last_included_service_date date null,
  max_included_checkins_per_day integer not null,
  required_core_gym_count integer not null,
  non_core_visit_price_base_units numeric(20, 0) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  payment_cluster text not null,
  payment_wallet_address text not null,
  payment_destination_address text not null,
  transaction_signature text not null,
  payment_status text not null,
  membership_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_periods_activation_operation_fkey
    foreign key (run_id, profile_id, activation_operation_id)
    references app.membership_activation_operations (run_id, profile_id, id)
    on delete restrict,
  constraint membership_periods_product_version_fkey
    foreign key (run_id, product_id, product_version_id)
    references app.membership_product_versions (run_id, product_id, id)
    on delete restrict,
  constraint membership_periods_run_id_id_key unique (run_id, id),
  constraint membership_periods_activation_operation_key
    unique (activation_operation_id),
  constraint membership_periods_status_check
    check (membership_status in ('active', 'expired')),
  constraint membership_periods_payment_status_check
    check (payment_status = 'confirmed'),
  constraint membership_periods_time_order_check
    check (ends_at > starts_at),
  constraint membership_periods_period_policy_check
    check (period_policy = 'calendar_month'),
  constraint membership_periods_plan_terms_check
    check (
      currency_code = 'EURC'
      and max_included_checkins_per_day = 1
      and required_core_gym_count = 4
      and non_core_visit_price_base_units = 15000000
      and (
        (
          plan_code = 'basic'
          and price_base_units = 80000000
          and access_model = 'limited'
          and included_checkins = 10
        )
        or (
          plan_code = 'classic'
          and price_base_units = 150000000
          and access_model = 'daily_uncapped'
          and included_checkins is null
        )
      )
    ),
  constraint membership_periods_usage_check
    check (
      included_checkins_used >= 0
      and (
        included_checkins is null
        or included_checkins_used <= included_checkins
      )
      and (included_checkins_used > 0 or last_included_service_date is null)
    ),
  constraint membership_periods_payment_check
    check (
      payment_cluster = 'solana:devnet'
      and char_length(payment_wallet_address) between 32 and 44
      and payment_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and char_length(payment_destination_address) between 32 and 44
      and payment_destination_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and char_length(transaction_signature) between 64 and 88
      and transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]+$'
    ),
  constraint membership_periods_member_time_exclusion
    exclude using gist (
      run_id with =,
      profile_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
);

create index membership_periods_member_history_idx
  on app.membership_periods (run_id, profile_id, starts_at desc);

create table app.membership_period_core_gyms (
  run_id uuid not null,
  membership_period_id uuid not null,
  venue_id uuid not null,
  selection_order integer not null,
  venue_slug text not null,
  venue_name text not null,
  created_at timestamptz not null default now(),
  constraint membership_period_core_gyms_pkey
    primary key (run_id, membership_period_id, venue_id),
  constraint membership_period_core_gyms_period_fkey
    foreign key (run_id, membership_period_id)
    references app.membership_periods (run_id, id)
    on delete restrict,
  constraint membership_period_core_gyms_venue_fkey
    foreign key (run_id, venue_id)
    references app.participating_gyms (run_id, venue_id)
    on delete restrict,
  constraint membership_period_core_gyms_order_key
    unique (run_id, membership_period_id, selection_order),
  constraint membership_period_core_gyms_order_check
    check (selection_order between 1 and 4),
  constraint membership_period_core_gyms_slug_check
    check (
      char_length(venue_slug) between 1 and 80
      and venue_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint membership_period_core_gyms_name_check
    check (char_length(venue_name) between 2 and 160)
);

create function app.enforce_membership_activation_operation_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if row(
    new.id,
    new.run_id,
    new.profile_id,
    new.product_id,
    new.product_version_id,
    new.plan_code,
    new.plan_version_number,
    new.plan_name,
    new.plan_description,
    new.currency_code,
    new.price_base_units,
    new.period_policy,
    new.access_model,
    new.included_checkins,
    new.max_included_checkins_per_day,
    new.required_core_gym_count,
    new.non_core_visit_price_base_units,
    new.payment_cluster,
    new.created_at
  ) is distinct from row(
    old.id,
    old.run_id,
    old.profile_id,
    old.product_id,
    old.product_version_id,
    old.plan_code,
    old.plan_version_number,
    old.plan_name,
    old.plan_description,
    old.currency_code,
    old.price_base_units,
    old.period_policy,
    old.access_model,
    old.included_checkins,
    old.max_included_checkins_per_day,
    old.required_core_gym_count,
    old.non_core_visit_price_base_units,
    old.payment_cluster,
    old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership activation snapshots are immutable';
  end if;

  if old.submitted_at is not null and row(
    new.payment_wallet_address,
    new.payment_destination_address,
    new.transaction_signature,
    new.submitted_at
  ) is distinct from row(
    old.payment_wallet_address,
    old.payment_destination_address,
    old.transaction_signature,
    old.submitted_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'submitted membership payment evidence is immutable';
  end if;

  if old.operation_status <> new.operation_status and not (
    (old.operation_status = 'pending' and new.operation_status in ('submitted', 'failed'))
    or (old.operation_status = 'submitted' and new.operation_status in ('confirmed', 'failed'))
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership activation state transition is invalid';
  end if;

  return new;
end;
$$;

create function app.enforce_membership_period_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if row(
    new.id,
    new.run_id,
    new.profile_id,
    new.activation_operation_id,
    new.product_id,
    new.product_version_id,
    new.plan_code,
    new.plan_version_number,
    new.plan_name,
    new.plan_description,
    new.currency_code,
    new.price_base_units,
    new.period_policy,
    new.access_model,
    new.included_checkins,
    new.max_included_checkins_per_day,
    new.required_core_gym_count,
    new.non_core_visit_price_base_units,
    new.starts_at,
    new.ends_at,
    new.payment_cluster,
    new.payment_wallet_address,
    new.payment_destination_address,
    new.transaction_signature,
    new.payment_status,
    new.created_at
  ) is distinct from row(
    old.id,
    old.run_id,
    old.profile_id,
    old.activation_operation_id,
    old.product_id,
    old.product_version_id,
    old.plan_code,
    old.plan_version_number,
    old.plan_name,
    old.plan_description,
    old.currency_code,
    old.price_base_units,
    old.period_policy,
    old.access_model,
    old.included_checkins,
    old.max_included_checkins_per_day,
    old.required_core_gym_count,
    old.non_core_visit_price_base_units,
    old.starts_at,
    old.ends_at,
    old.payment_cluster,
    old.payment_wallet_address,
    old.payment_destination_address,
    old.transaction_signature,
    old.payment_status,
    old.created_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership period terms and payment evidence are immutable';
  end if;

  if old.membership_status <> new.membership_status and not (
    old.membership_status = 'active' and new.membership_status = 'expired'
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership period state transition is invalid';
  end if;

  return new;
end;
$$;

create function app.enforce_membership_snapshot_gym_immutability()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if current_user = 'postgres' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception using
    errcode = '23514',
    message = 'membership gym snapshots are immutable';
end;
$$;

create function app.enforce_membership_operation_gym_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_operation_id uuid;
  selected_run_id uuid;
  expected_count integer;
  actual_count integer;
begin
  if tg_table_name = 'membership_activation_operations' then
    selected_operation_id := coalesce(new.id, old.id);
    selected_run_id := coalesce(new.run_id, old.run_id);
  else
    selected_operation_id := coalesce(new.operation_id, old.operation_id);
    selected_run_id := coalesce(new.run_id, old.run_id);
  end if;
  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );

  select operation.required_core_gym_count
  into expected_count
  from app.membership_activation_operations as operation
  where operation.run_id = selected_run_id
    and operation.id = selected_operation_id;

  if expected_count is null then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)::integer
  into actual_count
  from app.membership_activation_operation_gyms as gym
  where gym.run_id = selected_run_id
    and gym.operation_id = selected_operation_id;

  if actual_count <> expected_count then
    raise exception using
      errcode = '23514',
      message = 'membership activation requires exactly four core gyms';
  end if;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.enforce_membership_period_gym_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_period_id uuid;
  selected_run_id uuid;
  expected_count integer;
  actual_count integer;
begin
  if tg_table_name = 'membership_periods' then
    selected_period_id := coalesce(new.id, old.id);
    selected_run_id := coalesce(new.run_id, old.run_id);
  else
    selected_period_id := coalesce(
      new.membership_period_id,
      old.membership_period_id
    );
    selected_run_id := coalesce(new.run_id, old.run_id);
  end if;
  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );

  select period.required_core_gym_count
  into expected_count
  from app.membership_periods as period
  where period.run_id = selected_run_id
    and period.id = selected_period_id;

  if expected_count is null then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select count(*)::integer
  into actual_count
  from app.membership_period_core_gyms as gym
  where gym.run_id = selected_run_id
    and gym.membership_period_id = selected_period_id;

  if actual_count <> expected_count then
    raise exception using
      errcode = '23514',
      message = 'membership period requires exactly four core gyms';
  end if;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

create trigger membership_activation_operations_enforce_update
before update on app.membership_activation_operations
for each row execute function app.enforce_membership_activation_operation_update();

create trigger membership_activation_operations_set_updated_at
before update on app.membership_activation_operations
for each row execute function app.set_updated_at();

create trigger membership_periods_enforce_update
before update on app.membership_periods
for each row execute function app.enforce_membership_period_update();

create trigger membership_periods_set_updated_at
before update on app.membership_periods
for each row execute function app.set_updated_at();

create trigger membership_activation_operation_gyms_immutable
before update or delete on app.membership_activation_operation_gyms
for each row execute function app.enforce_membership_snapshot_gym_immutability();

create trigger membership_period_core_gyms_immutable
before update or delete on app.membership_period_core_gyms
for each row execute function app.enforce_membership_snapshot_gym_immutability();

create constraint trigger membership_activation_operations_gym_count
after insert or update on app.membership_activation_operations
deferrable initially deferred
for each row execute function app.enforce_membership_operation_gym_count();

create constraint trigger membership_activation_operation_gyms_count
after insert or update or delete on app.membership_activation_operation_gyms
deferrable initially deferred
for each row execute function app.enforce_membership_operation_gym_count();

create constraint trigger membership_periods_gym_count
after insert or update on app.membership_periods
deferrable initially deferred
for each row execute function app.enforce_membership_period_gym_count();

create constraint trigger membership_period_core_gyms_count
after insert or update or delete on app.membership_period_core_gyms
deferrable initially deferred
for each row execute function app.enforce_membership_period_gym_count();

alter table app.membership_activation_operations enable row level security;
alter table app.membership_activation_operations force row level security;
alter table app.membership_activation_operation_gyms enable row level security;
alter table app.membership_activation_operation_gyms force row level security;
alter table app.membership_periods enable row level security;
alter table app.membership_periods force row level security;
alter table app.membership_period_core_gyms enable row level security;
alter table app.membership_period_core_gyms force row level security;

alter table app.membership_activation_operations owner to app_owner;
alter table app.membership_activation_operation_gyms owner to app_owner;
alter table app.membership_periods owner to app_owner;
alter table app.membership_period_core_gyms owner to app_owner;
alter function app.enforce_membership_activation_operation_update()
  owner to app_owner;
alter function app.enforce_membership_period_update() owner to app_owner;
alter function app.enforce_membership_snapshot_gym_immutability()
  owner to app_owner;
alter function app.enforce_membership_operation_gym_count() owner to app_owner;
alter function app.enforce_membership_period_gym_count() owner to app_owner;

revoke all on app.membership_activation_operations
  from public, anon, authenticated, service_role, app_runtime;
revoke all on app.membership_activation_operation_gyms
  from public, anon, authenticated, service_role, app_runtime;
revoke all on app.membership_periods
  from public, anon, authenticated, service_role, app_runtime;
revoke all on app.membership_period_core_gyms
  from public, anon, authenticated, service_role, app_runtime;

create policy membership_activation_operations_management_all
  on app.membership_activation_operations
  for all
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  )
  with check (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy membership_activation_operation_gyms_management_all
  on app.membership_activation_operation_gyms
  for all
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  )
  with check (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy membership_periods_management_all
  on app.membership_periods
  for all
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  )
  with check (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy membership_period_core_gyms_management_all
  on app.membership_period_core_gyms
  for all
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  )
  with check (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy membership_products_activation_select
  on app.membership_products
  for select
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy membership_product_versions_activation_select
  on app.membership_product_versions
  for select
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy participating_gyms_activation_select
  on app.participating_gyms
  for select
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy membership_product_gym_eligibility_activation_select
  on app.membership_product_gym_eligibility
  for select
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy venues_activation_select
  on app.venues
  for select
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create policy wallet_bindings_membership_activation_select
  on app.wallet_bindings
  for select
  to app_owner
  using (
    current_setting('app.membership_activation_management', true) = 'on'
  );

create function app.prepare_membership_activation(
  requested_operation_id uuid,
  requested_plan_code text,
  requested_venue_slugs text[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  existing_operation record;
  selected_plan record;
  existing_venue_slugs text[];
  requested_sorted_slugs text[];
  eligible_gym_count integer;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;

  if requested_operation_id is null
    or requested_plan_code not in ('basic', 'classic')
    or pg_catalog.cardinality(requested_venue_slugs) <> 4
    or exists (
      select 1
      from pg_catalog.unnest(requested_venue_slugs) as requested_slug(value)
      where requested_slug.value is null
        or pg_catalog.char_length(requested_slug.value) not between 1 and 80
        or requested_slug.value !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
    or (
      select count(*) <> count(distinct requested_slug.value)
      from pg_catalog.unnest(requested_venue_slugs) as requested_slug(value)
    )
  then
    return 'invalid-request';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  select pg_catalog.array_agg(requested_slug.value order by requested_slug.value)
  into requested_sorted_slugs
  from pg_catalog.unnest(requested_venue_slugs) as requested_slug(value);

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_operation_id::text, 1)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      run_id_text || ':' || profile_id_text,
      2
    )
  );

  select operation.*
  into existing_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id;

  if found then
    select pg_catalog.array_agg(gym.venue_slug order by gym.venue_slug)
    into existing_venue_slugs
    from app.membership_activation_operation_gyms as gym
    where gym.run_id = existing_operation.run_id
      and gym.operation_id = existing_operation.id;

    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    if existing_operation.run_id = run_id_text::uuid
      and existing_operation.profile_id = profile_id_text::uuid
      and existing_operation.plan_code = requested_plan_code
      and existing_venue_slugs = requested_sorted_slugs
    then
      return 'existing';
    end if;
    return 'operation-conflict';
  end if;

  select
    product.id as product_id,
    version.id as product_version_id,
    version.version_number,
    version.plan_code,
    version.name,
    version.description,
    version.currency_code,
    version.price_base_units,
    version.period_policy,
    version.access_model,
    version.included_checkins,
    version.max_included_checkins_per_day,
    version.required_core_gym_count,
    version.non_core_visit_price_base_units
  into selected_plan
  from app.membership_products as product
  join app.membership_product_versions as version
    on version.run_id = product.run_id
    and version.product_id = product.id
  where product.run_id = run_id_text::uuid
    and product.scope = 'platform'
    and product.status = 'active'
    and version.status = 'published'
    and version.plan_code = requested_plan_code;

  if not found or selected_plan.required_core_gym_count <> 4 then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'invalid-selection';
  end if;

  select count(*)::integer
  into eligible_gym_count
  from pg_catalog.unnest(requested_venue_slugs) as requested_slug(value)
  join app.venues as venue
    on venue.run_id = run_id_text::uuid
    and venue.slug = requested_slug.value
    and venue.status = 'active'
  join app.participating_gyms as participating_gym
    on participating_gym.run_id = venue.run_id
    and participating_gym.venue_id = venue.id
    and participating_gym.status = 'active'
  join app.membership_product_gym_eligibility as eligibility
    on eligibility.run_id = participating_gym.run_id
    and eligibility.venue_id = participating_gym.venue_id
    and eligibility.product_id = selected_plan.product_id
    and eligibility.product_scope = 'platform'
    and eligibility.status = 'active';

  if eligible_gym_count <> 4 then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'invalid-selection';
  end if;

  if exists (
    select 1
    from app.membership_periods as period
    where period.run_id = run_id_text::uuid
      and period.profile_id = profile_id_text::uuid
      and period.membership_status = 'active'
      and period.ends_at > pg_catalog.statement_timestamp()
  ) or exists (
    select 1
    from app.membership_activation_operations as operation
    where operation.run_id = run_id_text::uuid
      and operation.profile_id = profile_id_text::uuid
      and operation.operation_status = 'submitted'
  ) then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'state-conflict';
  end if;

  update app.membership_activation_operations as operation
  set
    operation_status = 'failed',
    failed_at = pg_catalog.statement_timestamp(),
    failure_reason = 'superseded'
  where operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid
    and operation.operation_status = 'pending';

  insert into app.membership_activation_operations (
    id,
    run_id,
    profile_id,
    product_id,
    product_version_id,
    operation_status,
    plan_code,
    plan_version_number,
    plan_name,
    plan_description,
    currency_code,
    price_base_units,
    period_policy,
    access_model,
    included_checkins,
    max_included_checkins_per_day,
    required_core_gym_count,
    non_core_visit_price_base_units,
    payment_cluster
  )
  values (
    requested_operation_id,
    run_id_text::uuid,
    profile_id_text::uuid,
    selected_plan.product_id,
    selected_plan.product_version_id,
    'pending',
    selected_plan.plan_code,
    selected_plan.version_number,
    selected_plan.name,
    selected_plan.description,
    selected_plan.currency_code,
    selected_plan.price_base_units,
    selected_plan.period_policy,
    selected_plan.access_model,
    selected_plan.included_checkins,
    selected_plan.max_included_checkins_per_day,
    selected_plan.required_core_gym_count,
    selected_plan.non_core_visit_price_base_units,
    'solana:devnet'
  );

  insert into app.membership_activation_operation_gyms (
    run_id,
    operation_id,
    product_id,
    venue_id,
    selection_order,
    venue_slug,
    venue_name
  )
  select
    run_id_text::uuid,
    requested_operation_id,
    selected_plan.product_id,
    venue.id,
    requested_slug.ordinality::integer,
    venue.slug,
    venue.name
  from pg_catalog.unnest(requested_venue_slugs)
    with ordinality as requested_slug(value, ordinality)
  join app.venues as venue
    on venue.run_id = run_id_text::uuid
    and venue.slug = requested_slug.value;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
  return 'prepared';
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.record_membership_activation_submission(
  requested_operation_id uuid,
  requested_wallet_address text,
  requested_destination_address text,
  requested_transaction_signature text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation record;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;

  if requested_operation_id is null
    or requested_wallet_address is null
    or pg_catalog.char_length(requested_wallet_address) not between 32 and 44
    or requested_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or requested_destination_address is null
    or pg_catalog.char_length(requested_destination_address) not between 32 and 44
    or requested_destination_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or requested_transaction_signature is null
    or pg_catalog.char_length(requested_transaction_signature) not between 64 and 88
    or requested_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]+$'
  then
    return 'invalid-request';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_transaction_signature, 3)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      run_id_text || ':' || profile_id_text,
      2
    )
  );

  select operation.*
  into selected_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid
  for update;

  if not found then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'operation-conflict';
  end if;

  if selected_operation.operation_status in ('submitted', 'confirmed') then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    if selected_operation.payment_wallet_address = requested_wallet_address
      and selected_operation.payment_destination_address = requested_destination_address
      and selected_operation.transaction_signature = requested_transaction_signature
    then
      return 'existing';
    end if;
    return 'operation-conflict';
  end if;

  if selected_operation.operation_status <> 'pending' then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'state-conflict';
  end if;

  if not exists (
    select 1
    from app.wallet_bindings as binding
    where binding.run_id = run_id_text::uuid
      and binding.profile_id = profile_id_text::uuid
      and binding.owner_type = 'personal'
      and binding.status = 'active'
      and binding.provenance = 'user-proof'
      and binding.cluster = 'solana:devnet'
      and binding.wallet_address = requested_wallet_address
  ) then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'wallet-conflict';
  end if;

  if exists (
    select 1
    from app.membership_activation_operations as operation
    where operation.payment_cluster = 'solana:devnet'
      and operation.transaction_signature = requested_transaction_signature
      and operation.id <> requested_operation_id
  ) then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'payment-conflict';
  end if;

  update app.membership_activation_operations
  set
    operation_status = 'submitted',
    payment_wallet_address = requested_wallet_address,
    payment_destination_address = requested_destination_address,
    transaction_signature = requested_transaction_signature,
    submitted_at = pg_catalog.statement_timestamp()
  where id = requested_operation_id;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
  return 'submitted';
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.fail_membership_activation(
  requested_operation_id uuid,
  requested_failure_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation record;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;

  if requested_operation_id is null
    or requested_failure_reason not in (
      'wallet-cancelled',
      'transaction-rejected',
      'verification-failed',
      'superseded'
    )
  then
    return 'invalid-request';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      run_id_text || ':' || profile_id_text,
      2
    )
  );

  select operation.*
  into selected_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid
  for update;

  if not found then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'operation-conflict';
  end if;

  if selected_operation.operation_status = 'failed' then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    if selected_operation.failure_reason = requested_failure_reason then
      return 'existing';
    end if;
    return 'operation-conflict';
  end if;

  if selected_operation.operation_status = 'confirmed' then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return 'state-conflict';
  end if;

  update app.membership_activation_operations
  set
    operation_status = 'failed',
    failed_at = pg_catalog.statement_timestamp(),
    failure_reason = requested_failure_reason
  where id = requested_operation_id;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
  return 'failed';
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.complete_verified_membership_activation(
  requested_operation_id uuid,
  verified_wallet_address text,
  verified_destination_address text,
  verified_transaction_signature text,
  verified_amount_base_units numeric
)
returns table (
  completion_result text,
  membership_period_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation record;
  selected_period_id uuid;
  selected_starts_at timestamptz;
  selected_ends_at timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;

  if requested_operation_id is null
    or verified_wallet_address is null
    or verified_destination_address is null
    or verified_transaction_signature is null
    or verified_amount_base_units is null
    or verified_amount_base_units <= 0
  then
    return query select 'invalid-request'::text, null::uuid;
    return;
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      run_id_text || ':' || profile_id_text,
      2
    )
  );

  select operation.*
  into selected_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid
  for update;

  if not found then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return query select 'operation-conflict'::text, null::uuid;
    return;
  end if;

  if selected_operation.operation_status = 'confirmed' then
    select period.id
    into selected_period_id
    from app.membership_periods as period
    where period.activation_operation_id = requested_operation_id;

    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    if selected_operation.payment_wallet_address = verified_wallet_address
      and selected_operation.payment_destination_address = verified_destination_address
      and selected_operation.transaction_signature = verified_transaction_signature
      and selected_operation.price_base_units = verified_amount_base_units
      and selected_period_id is not null
    then
      return query select 'existing'::text, selected_period_id;
    else
      return query select 'operation-conflict'::text, null::uuid;
    end if;
    return;
  end if;

  if selected_operation.operation_status <> 'submitted'
    or selected_operation.payment_wallet_address <> verified_wallet_address
    or selected_operation.payment_destination_address <> verified_destination_address
    or selected_operation.transaction_signature <> verified_transaction_signature
    or selected_operation.price_base_units <> verified_amount_base_units
  then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return query select 'state-conflict'::text, null::uuid;
    return;
  end if;

  selected_starts_at := pg_catalog.statement_timestamp();
  selected_ends_at := selected_starts_at + interval '1 month';

  if exists (
    select 1
    from app.membership_periods as period
    where period.run_id = run_id_text::uuid
      and period.profile_id = profile_id_text::uuid
      and pg_catalog.tstzrange(
        period.starts_at,
        period.ends_at,
        '[)'
      ) && pg_catalog.tstzrange(
        selected_starts_at,
        selected_ends_at,
        '[)'
      )
  ) then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    return query select 'state-conflict'::text, null::uuid;
    return;
  end if;

  update app.membership_activation_operations
  set
    operation_status = 'confirmed',
    confirmed_at = selected_starts_at
  where id = requested_operation_id;

  insert into app.membership_periods (
    run_id,
    profile_id,
    activation_operation_id,
    product_id,
    product_version_id,
    plan_code,
    plan_version_number,
    plan_name,
    plan_description,
    currency_code,
    price_base_units,
    period_policy,
    access_model,
    included_checkins,
    included_checkins_used,
    last_included_service_date,
    max_included_checkins_per_day,
    required_core_gym_count,
    non_core_visit_price_base_units,
    starts_at,
    ends_at,
    payment_cluster,
    payment_wallet_address,
    payment_destination_address,
    transaction_signature,
    payment_status,
    membership_status
  )
  values (
    selected_operation.run_id,
    selected_operation.profile_id,
    selected_operation.id,
    selected_operation.product_id,
    selected_operation.product_version_id,
    selected_operation.plan_code,
    selected_operation.plan_version_number,
    selected_operation.plan_name,
    selected_operation.plan_description,
    selected_operation.currency_code,
    selected_operation.price_base_units,
    selected_operation.period_policy,
    selected_operation.access_model,
    selected_operation.included_checkins,
    0,
    null,
    selected_operation.max_included_checkins_per_day,
    selected_operation.required_core_gym_count,
    selected_operation.non_core_visit_price_base_units,
    selected_starts_at,
    selected_ends_at,
    selected_operation.payment_cluster,
    selected_operation.payment_wallet_address,
    selected_operation.payment_destination_address,
    selected_operation.transaction_signature,
    'confirmed',
    'active'
  )
  returning id into selected_period_id;

  insert into app.membership_period_core_gyms (
    run_id,
    membership_period_id,
    venue_id,
    selection_order,
    venue_slug,
    venue_name
  )
  select
    gym.run_id,
    selected_period_id,
    gym.venue_id,
    gym.selection_order,
    gym.venue_slug,
    gym.venue_name
  from app.membership_activation_operation_gyms as gym
  where gym.run_id = selected_operation.run_id
    and gym.operation_id = selected_operation.id;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
  return query select 'confirmed'::text, selected_period_id;
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

create function app.current_membership_state()
returns table (
  activation_operation_id uuid,
  operation_status text,
  failure_reason text,
  plan_code text,
  plan_version_number integer,
  plan_name text,
  currency_code text,
  price_base_units numeric,
  access_model text,
  included_checkins integer,
  max_included_checkins_per_day integer,
  non_core_visit_price_base_units numeric,
  payment_cluster text,
  payment_wallet_address text,
  payment_destination_address text,
  transaction_signature text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  operation_created_at timestamptz,
  membership_period_id uuid,
  period_status text,
  payment_status text,
  starts_at timestamptz,
  ends_at timestamptz,
  included_checkins_used integer,
  last_included_service_date date,
  selected_gym_slugs text[],
  selected_gym_names text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;

  profile_id_text := pg_catalog.current_setting(
    'app.current_profile_id',
    true
  );
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'on',
    true
  );

  return query
  with selected_operations as (
    select operation.*
    from app.membership_activation_operations as operation
    where operation.run_id = run_id_text::uuid
      and operation.profile_id = profile_id_text::uuid
    order by operation.created_at desc, operation.id desc
    limit 10
  )
  select
    operation.id,
    operation.operation_status,
    operation.failure_reason,
    operation.plan_code,
    operation.plan_version_number,
    operation.plan_name,
    operation.currency_code,
    operation.price_base_units,
    operation.access_model,
    operation.included_checkins,
    operation.max_included_checkins_per_day,
    operation.non_core_visit_price_base_units,
    operation.payment_cluster,
    operation.payment_wallet_address,
    operation.payment_destination_address,
    operation.transaction_signature,
    operation.submitted_at,
    operation.confirmed_at,
    operation.failed_at,
    operation.created_at,
    period.id,
    case
      when period.id is null then null
      when period.membership_status = 'active'
        and period.ends_at <= pg_catalog.statement_timestamp()
        then 'expired'
      else period.membership_status
    end,
    period.payment_status,
    period.starts_at,
    period.ends_at,
    period.included_checkins_used,
    period.last_included_service_date,
    pg_catalog.array_agg(gym.venue_slug order by gym.selection_order),
    pg_catalog.array_agg(gym.venue_name order by gym.selection_order)
  from selected_operations as operation
  join app.membership_activation_operation_gyms as gym
    on gym.run_id = operation.run_id
    and gym.operation_id = operation.id
  left join app.membership_periods as period
    on period.activation_operation_id = operation.id
  group by operation.id,
    operation.operation_status,
    operation.failure_reason,
    operation.plan_code,
    operation.plan_version_number,
    operation.plan_name,
    operation.currency_code,
    operation.price_base_units,
    operation.access_model,
    operation.included_checkins,
    operation.max_included_checkins_per_day,
    operation.non_core_visit_price_base_units,
    operation.payment_cluster,
    operation.payment_wallet_address,
    operation.payment_destination_address,
    operation.transaction_signature,
    operation.submitted_at,
    operation.confirmed_at,
    operation.failed_at,
    operation.created_at,
    period.id,
    period.membership_status,
    period.payment_status,
    period.starts_at,
    period.ends_at,
    period.included_checkins_used,
    period.last_included_service_date
  order by operation.created_at desc, operation.id desc;

  perform pg_catalog.set_config(
    'app.membership_activation_management',
    'off',
    true
  );
exception
  when others then
    perform pg_catalog.set_config(
      'app.membership_activation_management',
      'off',
      true
    );
    raise;
end;
$$;

alter function app.prepare_membership_activation(uuid, text, text[])
  owner to app_owner;
alter function app.record_membership_activation_submission(
  uuid,
  text,
  text,
  text
) owner to app_owner;
alter function app.fail_membership_activation(uuid, text) owner to app_owner;
alter function app.complete_verified_membership_activation(
  uuid,
  text,
  text,
  text,
  numeric
) owner to app_owner;
alter function app.current_membership_state() owner to app_owner;

revoke all on function app.prepare_membership_activation(uuid, text, text[])
  from public, anon, authenticated, service_role;
revoke all on function app.record_membership_activation_submission(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated, service_role;
revoke all on function app.fail_membership_activation(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.complete_verified_membership_activation(
  uuid,
  text,
  text,
  text,
  numeric
) from public, anon, authenticated, service_role;
revoke all on function app.current_membership_state()
  from public, anon, authenticated, service_role;

grant execute on function app.prepare_membership_activation(uuid, text, text[])
  to app_runtime;
grant execute on function app.record_membership_activation_submission(
  uuid,
  text,
  text,
  text
) to app_runtime;
grant execute on function app.fail_membership_activation(uuid, text)
  to app_runtime;
grant execute on function app.complete_verified_membership_activation(
  uuid,
  text,
  text,
  text,
  numeric
) to app_runtime;
grant execute on function app.current_membership_state()
  to app_runtime;

revoke all on function app.enforce_membership_activation_operation_update()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.enforce_membership_period_update()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.enforce_membership_snapshot_gym_immutability()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.enforce_membership_operation_gym_count()
  from public, anon, authenticated, service_role, app_runtime;
revoke all on function app.enforce_membership_period_gym_count()
  from public, anon, authenticated, service_role, app_runtime;

comment on table app.membership_activation_operations is
  'Actor-owned idempotent membership activation intents with immutable accepted plan terms and auditable payment state.';
comment on table app.membership_activation_operation_gyms is
  'The exactly four immutable participating-gym snapshots selected for one activation operation.';
comment on table app.membership_periods is
  'Fixed non-renewing member access periods created only after the internal verified-payment completion boundary.';
comment on table app.membership_period_core_gyms is
  'The exactly four immutable core gyms inherited by a confirmed membership period.';
comment on function app.complete_verified_membership_activation(
  uuid,
  text,
  text,
  text,
  numeric
) is
  'Internal persistence boundary only. Its caller must verify Devnet EURC source, destination, amount and transaction finality before invocation.';
