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
    or (
      old.operation_status = 'failed'
      and old.failure_reason = 'verification-failed'
      and old.submitted_at is not null
      and old.transaction_signature is not null
      and new.operation_status = 'confirmed'
      and new.failed_at is null
      and new.failure_reason is null
    )
  ) then
    raise exception using
      errcode = '23514',
      message = 'membership activation state transition is invalid';
  end if;

  return new;
end;
$$;

create or replace function app.complete_verified_membership_activation(
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

  if not (
    selected_operation.operation_status = 'submitted'
    or (
      selected_operation.operation_status = 'failed'
      and selected_operation.failure_reason = 'verification-failed'
      and selected_operation.submitted_at is not null
      and selected_operation.transaction_signature is not null
    )
  )
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
    confirmed_at = selected_starts_at,
    failed_at = null,
    failure_reason = null
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

comment on function app.complete_verified_membership_activation(
  uuid,
  text,
  text,
  text,
  numeric
) is
  'Internal persistence boundary only. Its caller must verify Devnet EURC source, destination, amount and transaction finality before invocation. A submitted payment previously marked verification-failed may recover only with the same immutable verified evidence.';
