alter table app.coach_booking_credit_operations
  add column authority_address text null,
  add column prepared_summary jsonb null,
  add column prepared_transaction_base64 text null,
  add column prepared_message_base64 text null,
  add column recent_blockhash text null,
  add column last_valid_block_height bigint null,
  add column prepared_at timestamptz null,
  add column simulation_slot bigint null,
  add column simulation_units_consumed bigint null,
  add column prior_transaction_signatures text[] not null default '{}';

alter table app.coach_booking_credit_operations
  add constraint coach_booking_credit_operations_preparation_check check (
    (
      authority_address is null
      and prepared_summary is null
      and prepared_transaction_base64 is null
      and prepared_message_base64 is null
      and recent_blockhash is null
      and last_valid_block_height is null
      and prepared_at is null
      and simulation_slot is null
      and simulation_units_consumed is null
    )
    or (
      authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
      and jsonb_typeof(prepared_summary) = 'object'
      and char_length(prepared_transaction_base64) between 4 and 2000
      and char_length(prepared_message_base64) between 4 and 2000
      and recent_blockhash ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
      and last_valid_block_height >= 0
      and prepared_at is not null
      and simulation_slot >= 0
      and (
        simulation_units_consumed is null
        or simulation_units_consumed >= 0
      )
    )
  );

create table app.coach_pass_purchase_operations (
  id uuid primary key,
  run_id uuid not null,
  client_profile_id uuid not null,
  coach_profile_id uuid not null,
  status text not null,
  operation_kind text not null,
  program_address text not null,
  authority_address text not null,
  coach_authority_address text not null,
  offer_address text not null,
  client_wallet_address text not null,
  coach_client_credits_address text not null,
  price_eurc_base_units bigint not null,
  credits_purchased smallint not null,
  expected_purchase_nonce bigint not null,
  baseline_ledger_exists boolean not null,
  baseline_available_credits bigint not null,
  baseline_reserved_credits bigint not null,
  baseline_total_purchased bigint not null,
  baseline_purchase_count bigint not null,
  prepared_summary jsonb not null,
  prepared_transaction_base64 text not null,
  prepared_message_base64 text not null,
  recent_blockhash text not null,
  last_valid_block_height bigint not null,
  prepared_at timestamptz not null default statement_timestamp(),
  simulation_slot bigint not null,
  simulation_units_consumed bigint null,
  transaction_signature text null,
  submitted_at timestamptz null,
  observed_available_credits bigint null,
  observed_reserved_credits bigint null,
  observed_total_purchased bigint null,
  observed_purchase_count bigint null,
  observed_next_purchase_nonce bigint null,
  observed_slot bigint null,
  finalized_at timestamptz null,
  failure_code text null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_pass_purchase_operations_client_fkey
    foreign key (run_id, client_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_pass_purchase_operations_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_pass_purchase_operations_actor_check
    check (client_profile_id <> coach_profile_id),
  constraint coach_pass_purchase_operations_status_check check (
    status in ('prepared', 'submitted', 'finalized', 'failed', 'expired')
  ),
  constraint coach_pass_purchase_operations_kind_check check (
    operation_kind in ('purchase-first-offer', 'purchase-offer')
  ),
  constraint coach_pass_purchase_operations_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and offer_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and client_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_client_credits_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and recent_blockhash ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint coach_pass_purchase_operations_terms_check check (
    price_eurc_base_units > 0
    and credits_purchased in (1, 10)
    and expected_purchase_nonce >= 0
    and baseline_available_credits between 0 and 9000000000000000
    and baseline_reserved_credits between 0 and 9000000000000000
    and baseline_total_purchased between 0 and 9000000000000000
    and baseline_purchase_count >= 0
    and baseline_available_credits + baseline_reserved_credits
      <= baseline_total_purchased
    and (
      (baseline_ledger_exists and operation_kind = 'purchase-offer')
      or (
        not baseline_ledger_exists
        and operation_kind = 'purchase-first-offer'
        and expected_purchase_nonce = 0
        and baseline_available_credits = 0
        and baseline_reserved_credits = 0
        and baseline_total_purchased = 0
        and baseline_purchase_count = 0
      )
    )
  ),
  constraint coach_pass_purchase_operations_preparation_check check (
    jsonb_typeof(prepared_summary) = 'object'
    and char_length(prepared_transaction_base64) between 4 and 2000
    and char_length(prepared_message_base64) between 4 and 2000
    and last_valid_block_height >= 0
    and simulation_slot >= 0
    and (
      simulation_units_consumed is null
      or simulation_units_consumed >= 0
    )
  ),
  constraint coach_pass_purchase_operations_signature_check check (
    transaction_signature is null
    or transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  ),
  constraint coach_pass_purchase_operations_observed_check check (
    (observed_available_credits is null)
      = (observed_reserved_credits is null)
    and (observed_available_credits is null)
      = (observed_total_purchased is null)
    and (observed_available_credits is null)
      = (observed_purchase_count is null)
    and (observed_available_credits is null)
      = (observed_next_purchase_nonce is null)
    and (observed_available_credits is null) = (observed_slot is null)
    and (
      observed_available_credits is null
      or (
        observed_available_credits between 0 and 9000000000000000
        and observed_reserved_credits between 0 and 9000000000000000
        and observed_total_purchased between 0 and 9000000000000000
        and observed_available_credits + observed_reserved_credits
          <= observed_total_purchased
        and observed_purchase_count >= 1
        and observed_next_purchase_nonce >= 1
        and observed_slot >= 0
      )
    )
  ),
  constraint coach_pass_purchase_operations_submission_state_check check (
    (
      status not in ('submitted', 'finalized')
      or transaction_signature is not null
    )
    and (transaction_signature is null) = (submitted_at is null)
  ),
  constraint coach_pass_purchase_operations_finalized_state_check check (
    (status = 'finalized') = (finalized_at is not null)
    and (status = 'finalized') = (observed_available_credits is not null)
  ),
  constraint coach_pass_purchase_operations_failure_state_check check (
    (status in ('failed', 'expired')) = (failure_code is not null)
    and (status in ('failed', 'expired')) = (failed_at is not null)
  )
);

create unique index coach_pass_purchase_operations_attempt_key
  on app.coach_pass_purchase_operations (
    run_id,
    client_profile_id,
    coach_profile_id,
    offer_address,
    expected_purchase_nonce,
    recent_blockhash
  );
create unique index coach_pass_purchase_operations_signature_key
  on app.coach_pass_purchase_operations (transaction_signature)
  where transaction_signature is not null;
create index coach_pass_purchase_operations_actor_status_idx
  on app.coach_pass_purchase_operations (
    run_id,
    client_profile_id,
    status,
    created_at
  );

create trigger coach_pass_purchase_operations_set_updated_at
before update on app.coach_pass_purchase_operations
for each row execute function app.set_updated_at();

alter table app.coach_pass_purchase_operations enable row level security;
alter table app.coach_pass_purchase_operations force row level security;
alter table app.coach_pass_purchase_operations owner to app_owner;
revoke all on app.coach_pass_purchase_operations
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_pass_purchase_operations
  from app_runtime;
grant select on app.coach_pass_purchase_operations to app_runtime;

create policy coach_pass_purchase_operations_management_all
  on app.coach_pass_purchase_operations
  for all
  to app_owner
  using (current_setting('app.coach_pass_management', true) = 'on')
  with check (current_setting('app.coach_pass_management', true) = 'on');

create policy coach_pass_purchase_operations_actor_select
  on app.coach_pass_purchase_operations
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(null, run_id, null)
    and client_profile_id = nullif(
      current_setting('app.current_profile_id', true),
      ''
    )::uuid
  );

create function app.record_booking_credit_operation_preparation(
  requested_operation_id uuid,
  requested_authority_address text,
  requested_summary jsonb,
  requested_transaction_base64 text,
  requested_message_base64 text,
  requested_recent_blockhash text,
  requested_last_valid_block_height bigint,
  requested_simulation_slot bigint,
  requested_simulation_units bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or jsonb_typeof(requested_summary) <> 'object'
    or char_length(requested_transaction_base64) not between 4 and 2000
    or char_length(requested_message_base64) not between 4 and 2000
    or requested_recent_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_last_valid_block_height < 0
    or requested_simulation_slot < 0
    or requested_simulation_units < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;
  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
  end if;

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if selected_operation.id is null
    or active_wallet_address is null
    or active_wallet_address <> requested_authority_address
    or (
      selected_operation.kind = 'reserve'
      and (
        selected_booking.client_profile_id <> profile_id_text::uuid
        or selected_operation.client_wallet_address
          <> requested_authority_address
      )
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
    or selected_operation.status in ('submitted', 'finalized')
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation preparation is unauthorized';
  end if;

  update app.coach_booking_credit_operations
  set
    status = 'prepared',
    authority_address = requested_authority_address,
    prepared_summary = requested_summary,
    prepared_transaction_base64 = requested_transaction_base64,
    prepared_message_base64 = requested_message_base64,
    recent_blockhash = requested_recent_blockhash,
    last_valid_block_height = requested_last_valid_block_height,
    prepared_at = statement_timestamp(),
    simulation_slot = requested_simulation_slot,
    simulation_units_consumed = requested_simulation_units,
    prior_transaction_signatures = case
      when transaction_signature is null then prior_transaction_signatures
      else array_append(prior_transaction_signatures, transaction_signature)
    end,
    transaction_signature = null,
    submitted_at = null,
    failure_code = null,
    failed_at = null
  where id = selected_operation.id;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create or replace function app.mark_booking_credit_operation_submitted(
  requested_operation_id uuid,
  submitted_transaction_signature text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or submitted_transaction_signature
      !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking submitted operation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;
  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
  end if;

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if selected_operation.id is null
    or (
      selected_operation.authority_address is not null
      and (
        active_wallet_address is null
        or active_wallet_address <> selected_operation.authority_address
      )
    )
    or (
      selected_operation.kind = 'reserve'
      and selected_booking.client_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking submitted operation is unauthorized';
  end if;

  if selected_operation.status = 'finalized'
    and selected_operation.transaction_signature
      = submitted_transaction_signature
  then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_operation.id;
  end if;

  if selected_operation.status = 'submitted' then
    if selected_operation.transaction_signature
      <> submitted_transaction_signature
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking operation has another transaction';
    end if;
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_operation.id;
  end if;

  if selected_operation.status <> 'prepared' then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation cannot be submitted';
  end if;

  update app.coach_booking_credit_operations
  set
    status = 'submitted',
    transaction_signature = submitted_transaction_signature,
    submitted_at = statement_timestamp()
  where id = selected_operation.id;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.record_coach_pass_purchase_preparation(
  requested_operation_id uuid,
  requested_coach_profile_id uuid,
  requested_operation_kind text,
  requested_program_address text,
  requested_authority_address text,
  requested_coach_authority_address text,
  requested_offer_address text,
  requested_credits_address text,
  requested_price bigint,
  requested_credits smallint,
  requested_expected_nonce bigint,
  requested_baseline_ledger_exists boolean,
  requested_baseline_available bigint,
  requested_baseline_reserved bigint,
  requested_baseline_total bigint,
  requested_baseline_purchase_count bigint,
  requested_summary jsonb,
  requested_transaction_base64 text,
  requested_message_base64 text,
  requested_recent_blockhash text,
  requested_last_valid_block_height bigint,
  requested_simulation_slot bigint,
  requested_simulation_units bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  active_wallet_address text;
  saved_operation_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_coach_profile_id is null
    or requested_operation_kind not in (
      'purchase-first-offer',
      'purchase-offer'
    )
    or requested_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_coach_authority_address
      !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_offer_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_credits_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_price <= 0
    or requested_credits not in (1, 10)
    or requested_expected_nonce < 0
    or requested_baseline_available not between 0 and 9000000000000000
    or requested_baseline_reserved not between 0 and 9000000000000000
    or requested_baseline_total not between 0 and 9000000000000000
    or requested_baseline_purchase_count < 0
    or requested_baseline_available + requested_baseline_reserved
      > requested_baseline_total
    or jsonb_typeof(requested_summary) <> 'object'
    or char_length(requested_transaction_base64) not between 4 and 2000
    or char_length(requested_message_base64) not between 4 and 2000
    or requested_recent_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_last_valid_block_height < 0
    or requested_simulation_slot < 0
    or requested_simulation_units < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);
  perform set_config('app.coach_profile_management', 'on', true);

  select binding.wallet_address
  into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if active_wallet_address is null
    or active_wallet_address <> requested_authority_address
    or requested_coach_profile_id = profile_id_text::uuid
    or not exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = run_id_text::uuid
        and coach.profile_id = requested_coach_profile_id
        and coach.visibility = 'visible'
    )
    or requested_baseline_ledger_exists
      <> (requested_operation_kind = 'purchase-offer')
    or (
      not requested_baseline_ledger_exists
      and (
        requested_expected_nonce <> 0
        or requested_baseline_available <> 0
        or requested_baseline_reserved <> 0
        or requested_baseline_total <> 0
        or requested_baseline_purchase_count <> 0
      )
    )
    or (
      select count(*)
      from app.coach_pass_purchase_operations as recent
      where recent.run_id = run_id_text::uuid
        and recent.client_profile_id = profile_id_text::uuid
        and recent.created_at > statement_timestamp() - interval '1 minute'
    ) >= 6
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase preparation is unauthorized';
  end if;

  insert into app.coach_pass_purchase_operations (
    id,
    run_id,
    client_profile_id,
    coach_profile_id,
    status,
    operation_kind,
    program_address,
    authority_address,
    coach_authority_address,
    offer_address,
    client_wallet_address,
    coach_client_credits_address,
    price_eurc_base_units,
    credits_purchased,
    expected_purchase_nonce,
    baseline_ledger_exists,
    baseline_available_credits,
    baseline_reserved_credits,
    baseline_total_purchased,
    baseline_purchase_count,
    prepared_summary,
    prepared_transaction_base64,
    prepared_message_base64,
    recent_blockhash,
    last_valid_block_height,
    simulation_slot,
    simulation_units_consumed
  ) values (
    requested_operation_id,
    run_id_text::uuid,
    profile_id_text::uuid,
    requested_coach_profile_id,
    'prepared',
    requested_operation_kind,
    requested_program_address,
    requested_authority_address,
    requested_coach_authority_address,
    requested_offer_address,
    requested_authority_address,
    requested_credits_address,
    requested_price,
    requested_credits,
    requested_expected_nonce,
    requested_baseline_ledger_exists,
    requested_baseline_available,
    requested_baseline_reserved,
    requested_baseline_total,
    requested_baseline_purchase_count,
    requested_summary,
    requested_transaction_base64,
    requested_message_base64,
    requested_recent_blockhash,
    requested_last_valid_block_height,
    requested_simulation_slot,
    requested_simulation_units
  )
  on conflict (
    run_id,
    client_profile_id,
    coach_profile_id,
    offer_address,
    expected_purchase_nonce,
    recent_blockhash
  ) do update
  set prepared_summary = excluded.prepared_summary
  where coach_pass_purchase_operations.status = 'prepared'
    and coach_pass_purchase_operations.transaction_signature is null
  returning id into saved_operation_id;

  if saved_operation_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase attempt is already submitted';
  end if;

  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_pass_management', 'off', true);
  return saved_operation_id;
exception
  when others then
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$$;

create function app.mark_coach_pass_purchase_submitted(
  requested_operation_id uuid,
  submitted_transaction_signature text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_pass_purchase_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or submitted_transaction_signature
      !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase submission is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);
  select operation.*
  into selected_operation
  from app.coach_pass_purchase_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.client_profile_id = profile_id_text::uuid
  for update;

  if selected_operation.id is null
    or (
      selected_operation.status = 'submitted'
      and selected_operation.transaction_signature
        <> submitted_transaction_signature
    )
    or selected_operation.status not in ('prepared', 'submitted')
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase cannot be submitted';
  end if;

  update app.coach_pass_purchase_operations
  set
    status = 'submitted',
    transaction_signature = submitted_transaction_signature,
    submitted_at = coalesce(submitted_at, statement_timestamp())
  where id = selected_operation.id;

  perform set_config('app.coach_pass_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$$;

create function app.fail_coach_pass_purchase_operation(
  requested_operation_id uuid,
  requested_status text,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  saved_id uuid;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_status not in ('failed', 'expired')
    or requested_reason not in (
      'wallet-rejected',
      'simulation-failed',
      'blockhash-expired',
      'transaction-failed',
      'state-not-observed'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase failure is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);

  update app.coach_pass_purchase_operations
  set
    status = requested_status,
    failure_code = requested_reason,
    failed_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and client_profile_id = profile_id_text::uuid
    and status in ('prepared', 'submitted', requested_status)
  returning id into saved_id;
  if saved_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase failure is unauthorized';
  end if;

  perform set_config('app.coach_pass_management', 'off', true);
  return saved_id;
exception
  when others then
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$$;

create function app.fail_booking_credit_operation(
  requested_operation_id uuid,
  requested_status text,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_status not in ('failed', 'expired')
    or requested_reason not in (
      'wallet-rejected',
      'simulation-failed',
      'blockhash-expired',
      'transaction-failed',
      'state-not-observed'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation failure is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);
  perform set_config('app.coach_availability_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
  for update;
  if found then
    select booking.*
    into selected_booking
    from app.coach_private_bookings as booking
    where booking.id = selected_operation.booking_id
      and booking.run_id = selected_operation.run_id
    for update;
  end if;

  if selected_operation.id is null
    or (
      selected_operation.kind = 'reserve'
      and selected_booking.client_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'consume'
      and selected_booking.coach_profile_id <> profile_id_text::uuid
    )
    or (
      selected_operation.kind = 'return'
      and profile_id_text::uuid not in (
        selected_booking.client_profile_id,
        selected_booking.coach_profile_id
      )
    )
    or selected_operation.status not in (
      'prepared',
      'submitted',
      requested_status
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation failure is unauthorized';
  end if;

  update app.coach_booking_credit_operations
  set
    status = requested_status,
    failure_code = requested_reason,
    failed_at = statement_timestamp()
  where id = selected_operation.id;

  if selected_operation.kind = 'reserve' then
    update app.coach_private_bookings
    set
      status = 'expired',
      expired_at = statement_timestamp()
    where id = selected_booking.id
      and status = 'pending';
    update app.coach_availability_slots
    set status = 'open'
    where id = selected_booking.slot_id
      and status = 'held';
  end if;

  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.finalize_coach_pass_purchase_operation(
  requested_operation_id uuid,
  verified_transaction_signature text,
  verified_available bigint,
  verified_reserved bigint,
  verified_total bigint,
  verified_purchase_count bigint,
  verified_next_nonce bigint,
  verified_observed_slot bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_operation app.coach_pass_purchase_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or verified_transaction_signature
      !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_available not between 0 and 9000000000000000
    or verified_reserved not between 0 and 9000000000000000
    or verified_total not between 0 and 9000000000000000
    or verified_available + verified_reserved > verified_total
    or verified_purchase_count < 1
    or verified_next_nonce < 1
    or verified_observed_slot < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase evidence is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_pass_management', 'on', true);

  select operation.*
  into selected_operation
  from app.coach_pass_purchase_operations as operation
  where operation.id = requested_operation_id
    and operation.run_id = run_id_text::uuid
    and operation.client_profile_id = profile_id_text::uuid
  for update;

  if selected_operation.id is null
    or selected_operation.status not in ('prepared', 'submitted', 'finalized')
    or (
      selected_operation.transaction_signature is not null
      and selected_operation.transaction_signature
        <> verified_transaction_signature
    )
    or verified_available
      <> selected_operation.baseline_available_credits
        + selected_operation.credits_purchased
    or verified_reserved <> selected_operation.baseline_reserved_credits
    or verified_total
      <> selected_operation.baseline_total_purchased
        + selected_operation.credits_purchased
    or verified_purchase_count
      <> selected_operation.baseline_purchase_count + 1
    or verified_next_nonce <> selected_operation.expected_purchase_nonce + 1
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach pass purchase evidence conflicts with preparation';
  end if;

  if selected_operation.status = 'finalized' then
    if selected_operation.observed_available_credits <> verified_available
      or selected_operation.observed_reserved_credits <> verified_reserved
      or selected_operation.observed_total_purchased <> verified_total
      or selected_operation.observed_purchase_count <> verified_purchase_count
      or selected_operation.observed_next_purchase_nonce <> verified_next_nonce
      or selected_operation.observed_slot <> verified_observed_slot
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach pass purchase retry conflicts with evidence';
    end if;
    perform set_config('app.coach_pass_management', 'off', true);
    return selected_operation.id;
  end if;

  update app.coach_pass_purchase_operations
  set
    status = 'finalized',
    transaction_signature = verified_transaction_signature,
    submitted_at = coalesce(submitted_at, statement_timestamp()),
    observed_available_credits = verified_available,
    observed_reserved_credits = verified_reserved,
    observed_total_purchased = verified_total,
    observed_purchase_count = verified_purchase_count,
    observed_next_purchase_nonce = verified_next_nonce,
    observed_slot = verified_observed_slot,
    finalized_at = statement_timestamp(),
    failure_code = null,
    failed_at = null
  where id = selected_operation.id;

  perform set_config('app.coach_pass_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_pass_management', 'off', true);
    raise;
end;
$$;

alter function app.record_booking_credit_operation_preparation(
  uuid, text, jsonb, text, text, text, bigint, bigint, bigint
) owner to app_owner;
alter function app.record_coach_pass_purchase_preparation(
  uuid, uuid, text, text, text, text, text, text, bigint, smallint,
  bigint, boolean, bigint, bigint, bigint, bigint, jsonb, text, text, text,
  bigint, bigint, bigint
) owner to app_owner;
alter function app.mark_coach_pass_purchase_submitted(uuid, text)
  owner to app_owner;
alter function app.fail_coach_pass_purchase_operation(uuid, text, text)
  owner to app_owner;
alter function app.fail_booking_credit_operation(uuid, text, text)
  owner to app_owner;
alter function app.finalize_coach_pass_purchase_operation(
  uuid, text, bigint, bigint, bigint, bigint, bigint, bigint
) owner to app_owner;

revoke all on function app.record_booking_credit_operation_preparation(
  uuid, text, jsonb, text, text, text, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
revoke all on function app.record_coach_pass_purchase_preparation(
  uuid, uuid, text, text, text, text, text, text, bigint, smallint,
  bigint, boolean, bigint, bigint, bigint, bigint, jsonb, text, text, text,
  bigint, bigint, bigint
) from public, anon, authenticated, service_role;
revoke all on function app.mark_coach_pass_purchase_submitted(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.fail_coach_pass_purchase_operation(
  uuid, text, text
) from public, anon, authenticated, service_role;
revoke all on function app.fail_booking_credit_operation(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function app.finalize_coach_pass_purchase_operation(
  uuid, text, bigint, bigint, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;

grant execute on function app.record_booking_credit_operation_preparation(
  uuid, text, jsonb, text, text, text, bigint, bigint, bigint
) to app_runtime;
grant execute on function app.record_coach_pass_purchase_preparation(
  uuid, uuid, text, text, text, text, text, text, bigint, smallint,
  bigint, boolean, bigint, bigint, bigint, bigint, jsonb, text, text, text,
  bigint, bigint, bigint
) to app_runtime;
grant execute on function app.mark_coach_pass_purchase_submitted(uuid, text)
  to app_runtime;
grant execute on function app.fail_coach_pass_purchase_operation(
  uuid, text, text
) to app_runtime;
grant execute on function app.fail_booking_credit_operation(uuid, text, text)
  to app_runtime;
grant execute on function app.finalize_coach_pass_purchase_operation(
  uuid, text, bigint, bigint, bigint, bigint, bigint, bigint
) to app_runtime;

comment on table app.coach_pass_purchase_operations is
  'Actor-scoped Devnet coach-pass purchase attempts with exact prepared messages, submission identity and finalized ledger evidence.';
comment on function app.record_booking_credit_operation_preparation(
  uuid, text, jsonb, text, text, text, bigint, bigint, bigint
) is
  'Persists the simulated exact transaction for an authorized booking-credit operation and supports safe re-preparation after a terminal failed attempt.';
