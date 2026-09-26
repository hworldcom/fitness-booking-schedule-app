alter table app.membership_activation_operations
  add column payment_mint_address text null,
  add column payment_token_program_address text null,
  add column payment_token_decimals integer null,
  add column payment_reference_address text null,
  add column confirmed_slot bigint null;

alter table app.membership_periods
  add column payment_mint_address text null,
  add column payment_token_program_address text null,
  add column payment_token_decimals integer null,
  add column payment_reference_address text null,
  add column confirmed_slot bigint null;

create unique index membership_activation_operations_reference_idx
  on app.membership_activation_operations (
    payment_cluster,
    payment_reference_address
  )
  where payment_reference_address is not null;

alter table app.membership_activation_operations
  add constraint membership_activation_operations_payment_asset_check
  check (
    (
      payment_mint_address is null
      and payment_token_program_address is null
      and payment_token_decimals is null
      and payment_reference_address is null
    )
    or (
      char_length(payment_mint_address) between 32 and 44
      and payment_mint_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and char_length(payment_token_program_address) between 32 and 44
      and payment_token_program_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and payment_token_decimals = 6
      and char_length(payment_reference_address) between 32 and 44
      and payment_reference_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
    )
  ),
  add constraint membership_activation_operations_confirmed_slot_check
  check (confirmed_slot is null or confirmed_slot > 0);

alter table app.membership_periods
  add constraint membership_periods_payment_asset_check
  check (
    (
      payment_mint_address is null
      and payment_token_program_address is null
      and payment_token_decimals is null
      and payment_reference_address is null
      and confirmed_slot is null
    )
    or (
      char_length(payment_mint_address) between 32 and 44
      and payment_mint_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and char_length(payment_token_program_address) between 32 and 44
      and payment_token_program_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and payment_token_decimals = 6
      and char_length(payment_reference_address) between 32 and 44
      and payment_reference_address ~ '^[1-9A-HJ-NP-Za-km-z]+$'
      and confirmed_slot > 0
    )
  );

alter table app.membership_activation_operations
  drop constraint membership_activation_operations_lifecycle_check;

alter table app.membership_activation_operations
  add constraint membership_activation_operations_lifecycle_check
  check (
    (
      operation_status = 'pending'
      and transaction_signature is null
      and submitted_at is null
      and confirmed_at is null
      and confirmed_slot is null
      and failed_at is null
      and failure_reason is null
    )
    or (
      operation_status = 'submitted'
      and payment_wallet_address is not null
      and payment_destination_address is not null
      and payment_mint_address is not null
      and payment_token_program_address is not null
      and payment_token_decimals is not null
      and payment_reference_address is not null
      and transaction_signature is not null
      and submitted_at is not null
      and confirmed_at is null
      and confirmed_slot is null
      and failed_at is null
      and failure_reason is null
    )
    or (
      operation_status = 'confirmed'
      and payment_wallet_address is not null
      and payment_destination_address is not null
      and payment_mint_address is not null
      and payment_token_program_address is not null
      and payment_token_decimals is not null
      and payment_reference_address is not null
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
      and confirmed_slot is null
      and failed_at is not null
      and failure_reason is not null
      and (
        (
          submitted_at is null
          and transaction_signature is null
        )
        or (
          submitted_at is not null
          and payment_wallet_address is not null
          and payment_destination_address is not null
          and payment_mint_address is not null
          and payment_token_program_address is not null
          and payment_token_decimals is not null
          and payment_reference_address is not null
          and transaction_signature is not null
          and failed_at >= submitted_at
        )
      )
    )
  );

create or replace function app.enforce_membership_activation_operation_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  config_initialized boolean;
begin
  config_initialized :=
    old.operation_status = 'pending'
    and old.payment_wallet_address is null
    and old.payment_destination_address is null
    and old.payment_mint_address is null
    and old.payment_token_program_address is null
    and old.payment_token_decimals is null
    and old.payment_reference_address is null
    and new.payment_wallet_address is not null
    and new.payment_destination_address is not null
    and new.payment_mint_address is not null
    and new.payment_token_program_address is not null
    and new.payment_token_decimals is not null
    and new.payment_reference_address is not null;

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

  if not config_initialized and row(
    new.payment_wallet_address,
    new.payment_destination_address,
    new.payment_mint_address,
    new.payment_token_program_address,
    new.payment_token_decimals,
    new.payment_reference_address
  ) is distinct from row(
    old.payment_wallet_address,
    old.payment_destination_address,
    old.payment_mint_address,
    old.payment_token_program_address,
    old.payment_token_decimals,
    old.payment_reference_address
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership payment quote is immutable';
  end if;

  if old.submitted_at is not null and row(
    new.transaction_signature,
    new.submitted_at
  ) is distinct from row(
    old.transaction_signature,
    old.submitted_at
  ) then
    raise exception using
      errcode = '23514',
      message = 'submitted membership payment evidence is immutable';
  end if;

  if old.confirmed_slot is not null
    and new.confirmed_slot is distinct from old.confirmed_slot
  then
    raise exception using
      errcode = '23514',
      message = 'confirmed membership slot is immutable';
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

create or replace function app.enforce_membership_period_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  evidence_initialized boolean;
begin
  evidence_initialized :=
    old.payment_mint_address is null
    and old.payment_token_program_address is null
    and old.payment_token_decimals is null
    and old.payment_reference_address is null
    and old.confirmed_slot is null
    and new.payment_mint_address is not null
    and new.payment_token_program_address is not null
    and new.payment_token_decimals is not null
    and new.payment_reference_address is not null
    and new.confirmed_slot is not null;

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

  if not evidence_initialized and row(
    new.payment_mint_address,
    new.payment_token_program_address,
    new.payment_token_decimals,
    new.payment_reference_address,
    new.confirmed_slot
  ) is distinct from row(
    old.payment_mint_address,
    old.payment_token_program_address,
    old.payment_token_decimals,
    old.payment_reference_address,
    old.confirmed_slot
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership period settlement evidence is immutable';
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

create function app.prepare_membership_payment_activation(
  requested_operation_id uuid,
  requested_plan_code text,
  requested_venue_slugs text[],
  requested_reference_address text,
  configured_destination_address text,
  configured_mint_address text,
  configured_token_program_address text,
  configured_token_decimals integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_result text;
  profile_id_text text;
  run_id_text text;
  selected_wallet_address text;
  selected_operation record;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;

  if requested_reference_address is null
    or pg_catalog.char_length(requested_reference_address) not between 32 and 44
    or requested_reference_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or configured_destination_address is null
    or pg_catalog.char_length(configured_destination_address) not between 32 and 44
    or configured_destination_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or configured_mint_address is null
    or pg_catalog.char_length(configured_mint_address) not between 32 and 44
    or configured_mint_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or configured_token_program_address is null
    or pg_catalog.char_length(configured_token_program_address) not between 32 and 44
    or configured_token_program_address !~ '^[1-9A-HJ-NP-Za-km-z]+$'
    or configured_token_decimals <> 6
  then
    return 'invalid-request';
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.membership_activation_management', 'on', true);

  select binding.wallet_address
  into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.owner_type = 'personal'
    and binding.status = 'active'
    and binding.provenance = 'user-proof'
    and binding.cluster = 'solana:devnet';

  perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
  if selected_wallet_address is null then
    return 'wallet-conflict';
  end if;

  base_result := app.prepare_membership_activation(
    requested_operation_id,
    requested_plan_code,
    requested_venue_slugs
  );
  if base_result not in ('prepared', 'existing') then
    return base_result;
  end if;

  perform pg_catalog.set_config('app.membership_activation_management', 'on', true);
  select operation.*
  into selected_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid
  for update;

  if not found or selected_operation.operation_status <> 'pending' then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    return 'state-conflict';
  end if;

  if selected_operation.payment_reference_address is null then
    update app.membership_activation_operations
    set
      payment_wallet_address = selected_wallet_address,
      payment_destination_address = configured_destination_address,
      payment_mint_address = configured_mint_address,
      payment_token_program_address = configured_token_program_address,
      payment_token_decimals = configured_token_decimals,
      payment_reference_address = requested_reference_address
    where id = requested_operation_id;
  elsif selected_operation.payment_wallet_address <> selected_wallet_address
    or selected_operation.payment_destination_address <> configured_destination_address
    or selected_operation.payment_mint_address <> configured_mint_address
    or selected_operation.payment_token_program_address <> configured_token_program_address
    or selected_operation.payment_token_decimals <> configured_token_decimals
  then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    return 'operation-conflict';
  end if;

  perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
  return base_result;
exception
  when unique_violation then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    return 'payment-conflict';
  when others then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    raise;
end;
$$;

create function app.record_membership_payment_submission(
  requested_operation_id uuid,
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

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.membership_activation_management', 'on', true);
  select operation.*
  into selected_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid;
  perform pg_catalog.set_config('app.membership_activation_management', 'off', true);

  if not found
    or selected_operation.payment_wallet_address is null
    or selected_operation.payment_destination_address is null
    or selected_operation.payment_reference_address is null
  then
    return 'operation-conflict';
  end if;

  return app.record_membership_activation_submission(
    requested_operation_id,
    selected_operation.payment_wallet_address,
    selected_operation.payment_destination_address,
    requested_transaction_signature
  );
exception
  when others then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    raise;
end;
$$;

create function app.complete_verified_membership_payment(
  requested_operation_id uuid,
  verified_wallet_address text,
  verified_destination_address text,
  verified_mint_address text,
  verified_token_program_address text,
  verified_reference_address text,
  verified_token_decimals integer,
  verified_transaction_signature text,
  verified_slot bigint,
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
  base_result text;
  selected_period_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, 'member') then
    raise exception using
      errcode = 'P0001',
      message = 'membership activation actor context is invalid';
  end if;
  if verified_slot is null or verified_slot <= 0 then
    return query select 'invalid-request'::text, null::uuid;
    return;
  end if;

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.membership_activation_management', 'on', true);
  select operation.*
  into selected_operation
  from app.membership_activation_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.profile_id = profile_id_text::uuid;
  perform pg_catalog.set_config('app.membership_activation_management', 'off', true);

  if not found then
    return query select 'operation-conflict'::text, null::uuid;
    return;
  end if;
  if selected_operation.payment_wallet_address <> verified_wallet_address
    or selected_operation.payment_destination_address <> verified_destination_address
    or selected_operation.payment_mint_address <> verified_mint_address
    or selected_operation.payment_token_program_address <> verified_token_program_address
    or selected_operation.payment_reference_address <> verified_reference_address
    or selected_operation.payment_token_decimals <> verified_token_decimals
  then
    return query select 'state-conflict'::text, null::uuid;
    return;
  end if;

  select completion.completion_result, completion.membership_period_id
  into base_result, selected_period_id
  from app.complete_verified_membership_activation(
    requested_operation_id,
    verified_wallet_address,
    verified_destination_address,
    verified_transaction_signature,
    verified_amount_base_units
  ) as completion;

  if base_result in ('confirmed', 'existing') then
    perform pg_catalog.set_config('app.membership_activation_management', 'on', true);
    update app.membership_activation_operations
    set confirmed_slot = verified_slot
    where id = requested_operation_id
      and (confirmed_slot is null or confirmed_slot = verified_slot);
    if not found then
      perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
      return query select 'operation-conflict'::text, null::uuid;
      return;
    end if;

    update app.membership_periods
    set
      payment_mint_address = verified_mint_address,
      payment_token_program_address = verified_token_program_address,
      payment_token_decimals = verified_token_decimals,
      payment_reference_address = verified_reference_address,
      confirmed_slot = verified_slot
    where id = selected_period_id
      and (
        payment_reference_address is null
        or (
          payment_mint_address = verified_mint_address
          and payment_token_program_address = verified_token_program_address
          and payment_token_decimals = verified_token_decimals
          and payment_reference_address = verified_reference_address
          and confirmed_slot = verified_slot
        )
      );
    if not found then
      perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
      return query select 'operation-conflict'::text, null::uuid;
      return;
    end if;
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
  end if;

  return query select base_result, selected_period_id;
exception
  when others then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    raise;
end;
$$;

create function app.current_membership_payment_state()
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
  payment_mint_address text,
  payment_token_program_address text,
  payment_token_decimals integer,
  payment_reference_address text,
  transaction_signature text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_slot bigint,
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

  profile_id_text := pg_catalog.current_setting('app.current_profile_id', true);
  run_id_text := pg_catalog.current_setting('app.current_run_id', true);
  perform pg_catalog.set_config('app.membership_activation_management', 'on', true);

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
    operation.payment_mint_address,
    operation.payment_token_program_address,
    operation.payment_token_decimals,
    operation.payment_reference_address,
    operation.transaction_signature,
    operation.submitted_at,
    operation.confirmed_at,
    operation.confirmed_slot,
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
    operation.payment_mint_address,
    operation.payment_token_program_address,
    operation.payment_token_decimals,
    operation.payment_reference_address,
    operation.transaction_signature,
    operation.submitted_at,
    operation.confirmed_at,
    operation.confirmed_slot,
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

  perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
exception
  when others then
    perform pg_catalog.set_config('app.membership_activation_management', 'off', true);
    raise;
end;
$$;

alter function app.prepare_membership_payment_activation(
  uuid, text, text[], text, text, text, text, integer
) owner to app_owner;
alter function app.record_membership_payment_submission(uuid, text)
  owner to app_owner;
alter function app.complete_verified_membership_payment(
  uuid, text, text, text, text, text, integer, text, bigint, numeric
) owner to app_owner;
alter function app.current_membership_payment_state() owner to app_owner;

revoke execute on function app.prepare_membership_activation(uuid, text, text[])
  from app_runtime;
revoke execute on function app.record_membership_activation_submission(
  uuid, text, text, text
) from app_runtime;
revoke execute on function app.complete_verified_membership_activation(
  uuid, text, text, text, numeric
) from app_runtime;

revoke all on function app.prepare_membership_payment_activation(
  uuid, text, text[], text, text, text, text, integer
) from public, anon, authenticated, service_role;
revoke all on function app.record_membership_payment_submission(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.complete_verified_membership_payment(
  uuid, text, text, text, text, text, integer, text, bigint, numeric
) from public, anon, authenticated, service_role;
revoke all on function app.current_membership_payment_state()
  from public, anon, authenticated, service_role;

grant execute on function app.prepare_membership_payment_activation(
  uuid, text, text[], text, text, text, text, integer
) to app_runtime;
grant execute on function app.record_membership_payment_submission(uuid, text)
  to app_runtime;
grant execute on function app.complete_verified_membership_payment(
  uuid, text, text, text, text, text, integer, text, bigint, numeric
) to app_runtime;
grant execute on function app.current_membership_payment_state()
  to app_runtime;
