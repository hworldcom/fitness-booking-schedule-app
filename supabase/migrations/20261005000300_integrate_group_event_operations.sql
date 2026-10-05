-- Persist recoverable, actor-scoped Devnet group-event operations. The
-- platform payer may add only the fee/rent signature; business authority
-- remains the active linked wallet recorded on each operation.

create table app.group_event_chain_operations (
  id uuid primary key,
  run_id uuid not null,
  event_id uuid not null,
  actor_profile_id uuid not null,
  operation_kind text not null,
  status text not null,
  program_address text not null,
  authority_address text not null,
  coach_authority_address text not null,
  event_pool_address text not null,
  vault_address text not null,
  contribution_address text null,
  prepared_summary jsonb not null,
  prepared_transaction_base64 text not null,
  prepared_message_base64 text not null,
  recent_blockhash text not null,
  last_valid_block_height bigint not null,
  prepared_at timestamptz not null default statement_timestamp(),
  simulation_slot bigint not null,
  simulation_units_consumed bigint null,
  transaction_signature text null,
  prior_transaction_signatures text[] not null default '{}',
  submitted_at timestamptz null,
  observed_slot bigint null,
  finalized_at timestamptz null,
  failure_code text null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_event_chain_operations_event_fkey
    foreign key (run_id, event_id)
    references app.group_events (run_id, id)
    on delete restrict,
  constraint group_event_chain_operations_actor_fkey
    foreign key (run_id, actor_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint group_event_chain_operations_status_check check (
    status in ('prepared', 'submitted', 'finalized', 'failed', 'expired')
  ),
  constraint group_event_chain_operations_kind_check check (
    operation_kind in (
      'create-event-pool',
      'fund-event-seat',
      'settle-event-pool',
      'claim-event-payout',
      'claim-event-refund'
    )
  ),
  constraint group_event_chain_operations_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and vault_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and (
      contribution_address is null
      or contribution_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    )
  ),
  constraint group_event_chain_operations_contribution_check check (
    (
      operation_kind in ('fund-event-seat', 'claim-event-refund')
      and contribution_address is not null
    )
    or (
      operation_kind not in ('fund-event-seat', 'claim-event-refund')
      and contribution_address is null
    )
  ),
  constraint group_event_chain_operations_preparation_check check (
    jsonb_typeof(prepared_summary) = 'object'
    and char_length(prepared_transaction_base64) between 4 and 2000
    and char_length(prepared_message_base64) between 4 and 2000
    and recent_blockhash ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and last_valid_block_height >= 0
    and simulation_slot >= 0
    and (
      simulation_units_consumed is null
      or simulation_units_consumed >= 0
    )
  ),
  constraint group_event_chain_operations_signature_check check (
    transaction_signature is null
    or transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  ),
  constraint group_event_chain_operations_submission_check check (
    (transaction_signature is null) = (submitted_at is null)
    and (
      status not in ('submitted', 'finalized')
      or transaction_signature is not null
    )
  ),
  constraint group_event_chain_operations_finalization_check check (
    (status = 'finalized') = (observed_slot is not null)
    and (status = 'finalized') = (finalized_at is not null)
    and (observed_slot is null or observed_slot >= 0)
  ),
  constraint group_event_chain_operations_failure_check check (
    (status in ('failed', 'expired')) = (failure_code is not null)
    and (status in ('failed', 'expired')) = (failed_at is not null)
    and (
      failure_code is null
      or failure_code in (
        'wallet-rejected',
        'simulation-failed',
        'blockhash-expired',
        'transaction-failed',
        'state-not-observed'
      )
    )
  )
);

create unique index group_event_chain_operations_signature_key
  on app.group_event_chain_operations (transaction_signature)
  where transaction_signature is not null;
create unique index group_event_chain_operations_active_actor_key
  on app.group_event_chain_operations (
    run_id,
    event_id,
    actor_profile_id,
    operation_kind
  )
  where status in ('prepared', 'submitted');
create index group_event_chain_operations_actor_status_idx
  on app.group_event_chain_operations (
    run_id,
    actor_profile_id,
    status,
    created_at desc
  );

create trigger group_event_chain_operations_set_updated_at
before update on app.group_event_chain_operations
for each row execute function app.set_updated_at();

alter table app.group_event_chain_operations enable row level security;
alter table app.group_event_chain_operations force row level security;
alter table app.group_event_chain_operations owner to app_owner;
revoke all on app.group_event_chain_operations
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.group_event_chain_operations
  from app_runtime;
grant select on app.group_event_chain_operations to app_runtime;

create policy group_event_chain_operations_management_all
  on app.group_event_chain_operations
  for all
  to app_owner
  using (current_setting('app.group_event_operation_management', true) = 'on')
  with check (current_setting('app.group_event_operation_management', true) = 'on');

create policy group_event_chain_operations_actor_select
  on app.group_event_chain_operations
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(actor_profile_id, run_id, null)
  );

create function app.record_group_event_operation_preparation(
  requested_operation_id uuid,
  requested_event_id uuid,
  requested_operation_kind text,
  requested_program_address text,
  requested_authority_address text,
  requested_coach_authority_address text,
  requested_event_pool_address text,
  requested_vault_address text,
  requested_contribution_address text,
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
  selected_event app.group_events%rowtype;
  active_wallet_address text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or requested_operation_kind not in (
      'create-event-pool',
      'fund-event-seat',
      'settle-event-pool',
      'claim-event-payout',
      'claim-event-refund'
    )
    or requested_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_vault_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or (
      requested_operation_kind in ('fund-event-seat', 'claim-event-refund')
      and requested_contribution_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    )
    or (
      requested_operation_kind not in ('fund-event-seat', 'claim-event-refund')
      and requested_contribution_address is not null
    )
    or jsonb_typeof(requested_summary) <> 'object'
    or char_length(requested_transaction_base64) not between 4 and 2000
    or char_length(requested_message_base64) not between 4 and 2000
    or requested_recent_blockhash !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or requested_last_valid_block_height < 0
    or requested_simulation_slot < 0
    or requested_simulation_units < 0
  then
    raise exception using errcode = 'P0001', message = 'group event preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_management', 'on', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  perform set_config('app.wallet_management', 'on', true);

  select event.* into selected_event
  from app.group_events as event
  where event.id = requested_event_id
    and event.run_id = run_id_text::uuid
  for update;

  select binding.wallet_address into active_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active';

  if selected_event.id is null
    or active_wallet_address is null
    or active_wallet_address <> requested_authority_address
    or (
      requested_operation_kind in ('create-event-pool', 'fund-event-seat')
      and selected_event.starts_at <= statement_timestamp()
    )
    or (
      requested_operation_kind in ('create-event-pool', 'claim-event-payout')
      and selected_event.coach_profile_id <> profile_id_text::uuid
    )
    or (
      requested_operation_kind = 'create-event-pool'
      and (
        selected_event.publication_status <> 'draft'
        or (
          selected_event.projection_availability <> 'unbound'
          and not (
            selected_event.projection_availability = 'pending'
            and selected_event.program_address = requested_program_address
            and selected_event.event_pool_address = requested_event_pool_address
            and selected_event.coach_wallet_address_snapshot = requested_authority_address
          )
        )
      )
    )
    or (
      requested_operation_kind <> 'create-event-pool'
      and (
        selected_event.program_address <> requested_program_address
        or selected_event.event_pool_address <> requested_event_pool_address
        or selected_event.projection_availability = 'unbound'
      )
    )
    or (
      requested_operation_kind in ('fund-event-seat', 'settle-event-pool')
      and selected_event.publication_status <> 'published'
    )
  then
    raise exception using errcode = 'P0001', message = 'group event preparation is unauthorized';
  end if;

  if requested_operation_kind = 'create-event-pool'
    and selected_event.projection_availability = 'unbound'
  then
    update app.group_events
    set
      program_address = requested_program_address,
      event_pool_address = requested_event_pool_address,
      coach_wallet_address_snapshot = requested_authority_address,
      projection_availability = 'pending',
      projection_status_updated_at = statement_timestamp()
    where id = selected_event.id;
  end if;

  insert into app.group_event_chain_operations (
    id,
    run_id,
    event_id,
    actor_profile_id,
    operation_kind,
    status,
    program_address,
    authority_address,
    coach_authority_address,
    event_pool_address,
    vault_address,
    contribution_address,
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
    requested_event_id,
    profile_id_text::uuid,
    requested_operation_kind,
    'prepared',
    requested_program_address,
    requested_authority_address,
    requested_coach_authority_address,
    requested_event_pool_address,
    requested_vault_address,
    requested_contribution_address,
    requested_summary,
    requested_transaction_base64,
    requested_message_base64,
    requested_recent_blockhash,
    requested_last_valid_block_height,
    requested_simulation_slot,
    requested_simulation_units
  );

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.group_event_operation_management', 'off', true);
  perform set_config('app.group_event_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.group_event_operation_management', 'off', true);
    perform set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

create function app.mark_group_event_operation_submitted(
  requested_operation_id uuid,
  requested_transaction_signature text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  then
    raise exception using errcode = 'P0001', message = 'group event submission is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  update app.group_event_chain_operations
  set
    status = 'submitted',
    transaction_signature = requested_transaction_signature,
    submitted_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and actor_profile_id = profile_id_text::uuid
    and status = 'prepared';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event submission conflicts';
  end if;
  perform set_config('app.group_event_operation_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.group_event_operation_management', 'off', true);
    raise;
end;
$$;

create function app.fail_group_event_operation(
  requested_operation_id uuid,
  requested_status text,
  requested_failure_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_status not in ('failed', 'expired')
    or requested_failure_code not in (
      'wallet-rejected',
      'simulation-failed',
      'blockhash-expired',
      'transaction-failed',
      'state-not-observed'
    )
  then
    raise exception using errcode = 'P0001', message = 'group event failure is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  update app.group_event_chain_operations
  set
    status = requested_status,
    failure_code = requested_failure_code,
    failed_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and actor_profile_id = profile_id_text::uuid
    and status in ('prepared', 'submitted');
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event failure conflicts';
  end if;
  perform set_config('app.group_event_operation_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.group_event_operation_management', 'off', true);
    raise;
end;
$$;

create function app.finalize_group_event_operation(
  requested_operation_id uuid,
  requested_observed_slot bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  affected_rows integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_observed_slot < 0
  then
    raise exception using errcode = 'P0001', message = 'group event finalization is invalid';
  end if;
  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.group_event_operation_management', 'on', true);
  update app.group_event_chain_operations
  set
    status = 'finalized',
    observed_slot = requested_observed_slot,
    finalized_at = statement_timestamp()
  where id = requested_operation_id
    and run_id = run_id_text::uuid
    and actor_profile_id = profile_id_text::uuid
    and status = 'submitted'
    and transaction_signature is not null;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'group event finalization conflicts';
  end if;
  perform set_config('app.group_event_operation_management', 'off', true);
  return requested_operation_id;
exception
  when others then
    perform set_config('app.group_event_operation_management', 'off', true);
    raise;
end;
$$;

revoke all on function app.record_group_event_operation_preparation(
  uuid, uuid, text, text, text, text, text, text, text, jsonb,
  text, text, text, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
grant execute on function app.record_group_event_operation_preparation(
  uuid, uuid, text, text, text, text, text, text, text, jsonb,
  text, text, text, bigint, bigint, bigint
) to app_runtime;
revoke all on function app.mark_group_event_operation_submitted(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function app.mark_group_event_operation_submitted(uuid, text)
  to app_runtime;
revoke all on function app.fail_group_event_operation(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function app.fail_group_event_operation(uuid, text, text)
  to app_runtime;
revoke all on function app.finalize_group_event_operation(uuid, bigint)
  from public, anon, authenticated, service_role;
grant execute on function app.finalize_group_event_operation(uuid, bigint)
  to app_runtime;

comment on table app.group_event_chain_operations is
  'Recoverable platform-funded Devnet EventPool operations; actor wallet keeps business authority.';
