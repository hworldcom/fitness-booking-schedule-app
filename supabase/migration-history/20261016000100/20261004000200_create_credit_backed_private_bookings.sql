-- Persist the application-owned half of one-credit private bookings. Solana
-- remains authoritative for credit balances and reservation terminal state;
-- these tables retain only finalized projections plus the human workflow.

alter table app.coach_profiles
  add column early_cancellation_minutes integer not null default 1440,
  add constraint coach_profiles_early_cancellation_check
    check (early_cancellation_minutes between 0 and 10080);

alter table app.coach_availability_slots
  add constraint coach_availability_slots_run_id_id_key unique (run_id, id);

create table app.coach_client_credit_projections (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  coach_profile_id uuid not null,
  client_profile_id uuid not null,
  program_address text not null,
  coach_authority_address text not null,
  client_wallet_address text not null,
  coach_client_credits_address text not null,
  available_credits bigint not null,
  reserved_credits bigint not null,
  total_purchased bigint not null,
  purchase_count bigint not null,
  next_purchase_nonce bigint not null,
  last_offer_address text not null,
  last_purchase_at timestamptz not null,
  transaction_signature text not null,
  observed_slot bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_client_credit_projections_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_client_credit_projections_client_fkey
    foreign key (run_id, client_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_client_credit_projections_run_id_id_key
    unique (run_id, id),
  constraint coach_client_credit_projections_pair_wallet_key
    unique (run_id, coach_profile_id, client_wallet_address),
  constraint coach_client_credit_projections_ledger_key
    unique (program_address, coach_client_credits_address),
  constraint coach_client_credit_projections_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and client_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_client_credits_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and last_offer_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint coach_client_credit_projections_signature_check
    check (transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'),
  constraint coach_client_credit_projections_balance_check check (
    available_credits between 0 and 9000000000000000
    and reserved_credits between 0 and 9000000000000000
    and total_purchased between 0 and 9000000000000000
    and available_credits + reserved_credits <= total_purchased
  ),
  constraint coach_client_credit_projections_purchase_check check (
    purchase_count between 1 and 9000000000000000
    and next_purchase_nonce between 1 and 9000000000000000
    and observed_slot >= 0
  )
);

create table app.coach_private_bookings (
  id uuid primary key,
  run_id uuid not null,
  slot_id uuid not null,
  coach_profile_id uuid not null,
  client_profile_id uuid not null,
  credit_projection_id uuid not null,
  status text not null,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  early_return_until timestamptz not null,
  hold_expires_at timestamptz not null,
  cancellation_requested_at timestamptz null,
  cancellation_decision text null,
  cancellation_decided_at timestamptz null,
  cancellation_decided_by_profile_id uuid null,
  cancelled_at timestamptz null,
  completed_at timestamptz null,
  expired_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_private_bookings_slot_fkey
    foreign key (run_id, slot_id)
    references app.coach_availability_slots (run_id, id)
    on delete restrict,
  constraint coach_private_bookings_coach_fkey
    foreign key (run_id, coach_profile_id)
    references app.coach_profiles (run_id, profile_id)
    on delete restrict,
  constraint coach_private_bookings_client_fkey
    foreign key (run_id, client_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_private_bookings_credit_projection_fkey
    foreign key (run_id, credit_projection_id)
    references app.coach_client_credit_projections (run_id, id)
    on delete restrict,
  constraint coach_private_bookings_decider_fkey
    foreign key (run_id, cancellation_decided_by_profile_id)
    references app.demo_run_participants (run_id, profile_id)
    on delete restrict,
  constraint coach_private_bookings_status_check check (
    status in (
      'pending',
      'confirmed',
      'cancellation-requested',
      'cancelled',
      'completed',
      'denied',
      'expired'
    )
  ),
  constraint coach_private_bookings_time_check check (
    scheduled_end_at - scheduled_start_at = interval '1 hour'
    and early_return_until <= scheduled_start_at
    and hold_expires_at > created_at
  ),
  constraint coach_private_bookings_decision_check check (
    cancellation_decision is null
    or cancellation_decision in ('approved', 'denied')
  ),
  constraint coach_private_bookings_decision_state_check check (
    (
      cancellation_decision is null
      and cancellation_decided_at is null
      and cancellation_decided_by_profile_id is null
    )
    or (
      cancellation_decision is not null
      and cancellation_requested_at is not null
      and cancellation_decided_at is not null
      and cancellation_decided_by_profile_id = coach_profile_id
    )
  ),
  constraint coach_private_bookings_terminal_state_check check (
    (status = 'cancelled') = (cancelled_at is not null)
    and (status = 'completed') = (completed_at is not null)
    and (status = 'expired') = (expired_at is not null)
  )
);

create table app.coach_booking_credit_operations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  booking_id uuid not null,
  credit_projection_id uuid not null,
  kind text not null,
  status text not null,
  program_address text not null,
  coach_authority_address text not null,
  client_wallet_address text not null,
  coach_client_credits_address text not null,
  credit_reservation_address text not null,
  scheduled_start_at timestamptz not null,
  early_return_until timestamptz not null,
  transaction_signature text null,
  submitted_at timestamptz null,
  observed_reservation_status text null,
  observed_available_credits bigint null,
  observed_reserved_credits bigint null,
  observed_total_purchased bigint null,
  observed_slot bigint null,
  finalized_at timestamptz null,
  failure_code text null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_booking_credit_operations_booking_fkey
    foreign key (booking_id)
    references app.coach_private_bookings (id)
    on delete restrict,
  constraint coach_booking_credit_operations_projection_fkey
    foreign key (run_id, credit_projection_id)
    references app.coach_client_credit_projections (run_id, id)
    on delete restrict,
  constraint coach_booking_credit_operations_booking_kind_key
    unique (booking_id, kind),
  constraint coach_booking_credit_operations_kind_check
    check (kind in ('reserve', 'return', 'consume')),
  constraint coach_booking_credit_operations_status_check
    check (status in ('prepared', 'submitted', 'finalized', 'failed', 'expired')),
  constraint coach_booking_credit_operations_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and client_wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_client_credits_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and credit_reservation_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  constraint coach_booking_credit_operations_signature_check check (
    transaction_signature is null
    or transaction_signature ~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
  ),
  constraint coach_booking_credit_operations_reservation_status_check check (
    observed_reservation_status is null
    or observed_reservation_status in ('reserved', 'returned', 'consumed')
  ),
  constraint coach_booking_credit_operations_observed_balance_check check (
    observed_available_credits is null
    or (
      observed_available_credits between 0 and 9000000000000000
      and observed_reserved_credits between 0 and 9000000000000000
      and observed_total_purchased between 0 and 9000000000000000
      and observed_available_credits + observed_reserved_credits
        <= observed_total_purchased
      and observed_slot >= 0
    )
  ),
  constraint coach_booking_credit_operations_evidence_group_check check (
    (observed_reservation_status is null) = (observed_available_credits is null)
    and (observed_reservation_status is null) = (observed_reserved_credits is null)
    and (observed_reservation_status is null) = (observed_total_purchased is null)
    and (observed_reservation_status is null) = (observed_slot is null)
  ),
  constraint coach_booking_credit_operations_finalized_state_check check (
    (status = 'finalized') = (finalized_at is not null)
    and (status = 'finalized') = (observed_reservation_status is not null)
  ),
  constraint coach_booking_credit_operations_failure_state_check check (
    (status in ('failed', 'expired')) = (failure_code is not null)
    and (status in ('failed', 'expired')) = (failed_at is not null)
  )
);

create unique index coach_private_bookings_active_slot_key
  on app.coach_private_bookings (slot_id)
  where status in ('pending', 'confirmed', 'cancellation-requested', 'denied');
create index coach_private_bookings_client_idx
  on app.coach_private_bookings (
    run_id,
    client_profile_id,
    scheduled_start_at,
    id
  );
create index coach_private_bookings_coach_idx
  on app.coach_private_bookings (
    run_id,
    coach_profile_id,
    scheduled_start_at,
    id
  );
create index coach_private_bookings_projection_idx
  on app.coach_private_bookings (
    credit_projection_id,
    status,
    hold_expires_at
  );
create unique index coach_booking_credit_operations_terminal_key
  on app.coach_booking_credit_operations (booking_id)
  where kind in ('return', 'consume');
create unique index coach_booking_credit_operations_signature_key
  on app.coach_booking_credit_operations (transaction_signature)
  where transaction_signature is not null;
create index coach_booking_credit_operations_status_idx
  on app.coach_booking_credit_operations (status, created_at, id);
create index coach_client_credit_projections_coach_idx
  on app.coach_client_credit_projections (
    run_id,
    coach_profile_id,
    client_profile_id
  );
create index coach_client_credit_projections_client_idx
  on app.coach_client_credit_projections (
    run_id,
    client_profile_id,
    coach_profile_id
  );

create trigger coach_client_credit_projections_set_updated_at
before update on app.coach_client_credit_projections
for each row execute function app.set_updated_at();
create trigger coach_private_bookings_set_updated_at
before update on app.coach_private_bookings
for each row execute function app.set_updated_at();
create trigger coach_booking_credit_operations_set_updated_at
before update on app.coach_booking_credit_operations
for each row execute function app.set_updated_at();

alter table app.coach_client_credit_projections enable row level security;
alter table app.coach_client_credit_projections force row level security;
alter table app.coach_private_bookings enable row level security;
alter table app.coach_private_bookings force row level security;
alter table app.coach_booking_credit_operations enable row level security;
alter table app.coach_booking_credit_operations force row level security;

alter table app.coach_client_credit_projections owner to app_owner;
alter table app.coach_private_bookings owner to app_owner;
alter table app.coach_booking_credit_operations owner to app_owner;

revoke all on app.coach_client_credit_projections,
  app.coach_private_bookings,
  app.coach_booking_credit_operations
  from public, anon, authenticated, service_role;
revoke insert, update, delete on app.coach_client_credit_projections,
  app.coach_private_bookings,
  app.coach_booking_credit_operations
  from app_runtime;
grant select on app.coach_client_credit_projections,
  app.coach_private_bookings,
  app.coach_booking_credit_operations
  to app_runtime;

create policy coach_client_credit_projections_management_all
  on app.coach_client_credit_projections
  for all
  to app_owner
  using (current_setting('app.coach_booking_management', true) = 'on')
  with check (current_setting('app.coach_booking_management', true) = 'on');
create policy coach_private_bookings_management_all
  on app.coach_private_bookings
  for all
  to app_owner
  using (current_setting('app.coach_booking_management', true) = 'on')
  with check (current_setting('app.coach_booking_management', true) = 'on');
create policy coach_booking_credit_operations_management_all
  on app.coach_booking_credit_operations
  for all
  to app_owner
  using (current_setting('app.coach_booking_management', true) = 'on')
  with check (current_setting('app.coach_booking_management', true) = 'on');

create policy coach_client_credit_projections_actor_select
  on app.coach_client_credit_projections
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(null, run_id, null)
    and nullif(current_setting('app.current_profile_id', true), '')::uuid
      in (coach_profile_id, client_profile_id)
  );
create policy coach_private_bookings_actor_select
  on app.coach_private_bookings
  for select
  to app_runtime
  using (
    app.authorized_actor_context_valid(null, run_id, null)
    and nullif(current_setting('app.current_profile_id', true), '')::uuid
      in (coach_profile_id, client_profile_id)
  );
create policy coach_booking_credit_operations_actor_select
  on app.coach_booking_credit_operations
  for select
  to app_runtime
  using (
    exists (
      select 1
      from app.coach_private_bookings as booking
      where booking.id = coach_booking_credit_operations.booking_id
        and booking.run_id = coach_booking_credit_operations.run_id
        and app.authorized_actor_context_valid(null, booking.run_id, null)
        and nullif(
          current_setting('app.current_profile_id', true),
          ''
        )::uuid in (booking.coach_profile_id, booking.client_profile_id)
    )
  );

create function app.update_owned_coach_cancellation_policy(
  requested_minutes integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  updated_minutes integer;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_minutes is null
    or requested_minutes not between 0 and 10080
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation policy is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_profile_management', 'on', true);

  update app.coach_profiles
  set early_cancellation_minutes = requested_minutes
  where run_id = run_id_text::uuid
    and profile_id = profile_id_text::uuid
  returning early_cancellation_minutes into updated_minutes;

  if updated_minutes is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking profile is unavailable';
  end if;

  perform set_config('app.coach_profile_management', 'off', true);
  return updated_minutes;
exception
  when others then
    perform set_config('app.coach_profile_management', 'off', true);
    raise;
end;
$$;

create function app.record_verified_coach_credit_projection(
  requested_coach_profile_id uuid,
  verified_program_address text,
  verified_coach_authority_address text,
  verified_client_wallet_address text,
  verified_credits_address text,
  verified_available_credits bigint,
  verified_reserved_credits bigint,
  verified_total_purchased bigint,
  verified_purchase_count bigint,
  verified_next_purchase_nonce bigint,
  verified_last_offer_address text,
  verified_last_purchase_at timestamptz,
  verified_transaction_signature text,
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
  selected_wallet_address text;
  selected_projection app.coach_client_credit_projections%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_coach_profile_id is null
    or verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_client_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_credits_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_last_offer_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_available_credits not between 0 and 9000000000000000
    or verified_reserved_credits not between 0 and 9000000000000000
    or verified_total_purchased not between 0 and 9000000000000000
    or verified_available_credits + verified_reserved_credits
      > verified_total_purchased
    or verified_purchase_count not between 1 and 9000000000000000
    or verified_next_purchase_nonce not between 1 and 9000000000000000
    or verified_last_purchase_at is null
    or verified_observed_slot < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking credit projection evidence is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.wallet_management', 'on', true);
  perform set_config('app.coach_profile_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select binding.wallet_address
  into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active'
  for share;

  if selected_wallet_address is null
    or selected_wallet_address <> verified_client_wallet_address
    or requested_coach_profile_id = profile_id_text::uuid
    or not exists (
      select 1
      from app.coach_profiles as coach
      where coach.run_id = run_id_text::uuid
        and coach.profile_id = requested_coach_profile_id
        and coach.visibility = 'visible'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking credit relationship is unauthorized';
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.run_id = run_id_text::uuid
    and projection.coach_profile_id = requested_coach_profile_id
    and projection.client_wallet_address = verified_client_wallet_address
  for update;

  if found then
    if selected_projection.client_profile_id <> profile_id_text::uuid
      or selected_projection.program_address <> verified_program_address
      or selected_projection.coach_authority_address
        <> verified_coach_authority_address
      or selected_projection.coach_client_credits_address
        <> verified_credits_address
      or verified_total_purchased < selected_projection.total_purchased
      or verified_purchase_count < selected_projection.purchase_count
      or verified_next_purchase_nonce < selected_projection.next_purchase_nonce
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking credit projection conflicts with authority';
    end if;

    if verified_observed_slot < selected_projection.observed_slot then
      perform set_config('app.wallet_management', 'off', true);
      perform set_config('app.coach_profile_management', 'off', true);
      perform set_config('app.coach_booking_management', 'off', true);
      return selected_projection.id;
    end if;

    if verified_observed_slot = selected_projection.observed_slot
      and (
        verified_available_credits <> selected_projection.available_credits
        or verified_reserved_credits <> selected_projection.reserved_credits
        or verified_total_purchased <> selected_projection.total_purchased
        or verified_purchase_count <> selected_projection.purchase_count
        or verified_next_purchase_nonce <> selected_projection.next_purchase_nonce
      )
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking equal-slot projection conflicts with state';
    end if;

    update app.coach_client_credit_projections
    set
      available_credits = verified_available_credits,
      reserved_credits = verified_reserved_credits,
      total_purchased = verified_total_purchased,
      purchase_count = verified_purchase_count,
      next_purchase_nonce = verified_next_purchase_nonce,
      last_offer_address = verified_last_offer_address,
      last_purchase_at = verified_last_purchase_at,
      transaction_signature = verified_transaction_signature,
      observed_slot = verified_observed_slot
    where id = selected_projection.id;
  else
    insert into app.coach_client_credit_projections (
      run_id,
      coach_profile_id,
      client_profile_id,
      program_address,
      coach_authority_address,
      client_wallet_address,
      coach_client_credits_address,
      available_credits,
      reserved_credits,
      total_purchased,
      purchase_count,
      next_purchase_nonce,
      last_offer_address,
      last_purchase_at,
      transaction_signature,
      observed_slot
    ) values (
      run_id_text::uuid,
      requested_coach_profile_id,
      profile_id_text::uuid,
      verified_program_address,
      verified_coach_authority_address,
      verified_client_wallet_address,
      verified_credits_address,
      verified_available_credits,
      verified_reserved_credits,
      verified_total_purchased,
      verified_purchase_count,
      verified_next_purchase_nonce,
      verified_last_offer_address,
      verified_last_purchase_at,
      verified_transaction_signature,
      verified_observed_slot
    )
    returning * into selected_projection;
  end if;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_projection.id;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.prepare_credit_backed_private_booking(
  requested_booking_id uuid,
  requested_slot_id uuid,
  requested_credit_projection_id uuid,
  requested_reservation_address text
)
returns table (booking_id uuid, operation_id uuid, booking_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_wallet_address text;
  selected_projection app.coach_client_credit_projections%rowtype;
  selected_slot app.coach_availability_slots%rowtype;
  selected_coach app.coach_profiles%rowtype;
  existing_booking app.coach_private_bookings%rowtype;
  created_operation_id uuid;
  pending_hold_count bigint;
  resolved_hold_expiry timestamptz;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
    or requested_slot_id is null
    or requested_credit_projection_id is null
    or requested_reservation_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking preparation is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.wallet_management', 'on', true);
  perform set_config('app.coach_profile_management', 'on', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select binding.wallet_address
  into selected_wallet_address
  from app.wallet_bindings as binding
  where binding.run_id = run_id_text::uuid
    and binding.profile_id = profile_id_text::uuid
    and binding.cluster = 'solana:devnet'
    and binding.status = 'active'
  for share;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = requested_credit_projection_id
    and projection.run_id = run_id_text::uuid
    and projection.client_profile_id = profile_id_text::uuid
    and projection.client_wallet_address = selected_wallet_address
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking credit projection is unavailable';
  end if;

  select slot.*
  into selected_slot
  from app.coach_availability_slots as slot
  where slot.id = requested_slot_id
    and slot.run_id = run_id_text::uuid
    and slot.profile_id = selected_projection.coach_profile_id
  for update;

  select booking.*
  into existing_booking
  from app.coach_private_bookings as booking
  where booking.slot_id = requested_slot_id
    and booking.status in (
      'pending',
      'confirmed',
      'cancellation-requested',
      'denied'
    )
  for update;

  if found then
    if existing_booking.client_profile_id = profile_id_text::uuid
      and existing_booking.credit_projection_id = selected_projection.id
      and existing_booking.status in ('pending', 'confirmed')
    then
      select operation.id
      into created_operation_id
      from app.coach_booking_credit_operations as operation
      where operation.booking_id = existing_booking.id
        and operation.kind = 'reserve';
      return query select
        existing_booking.id,
        created_operation_id,
        existing_booking.status;
      return;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'coach booking slot is already reserved';
  end if;

  select coach.*
  into selected_coach
  from app.coach_profiles as coach
  where coach.run_id = run_id_text::uuid
    and coach.profile_id = selected_projection.coach_profile_id
    and coach.visibility = 'visible'
  for share;

  if selected_wallet_address is null
    or selected_slot.id is null
    or selected_slot.status <> 'open'
    or selected_slot.starts_at <= statement_timestamp()
    or selected_slot.ends_at - selected_slot.starts_at <> interval '1 hour'
    or selected_coach.profile_id is null
    or selected_coach.profile_id = profile_id_text::uuid
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking slot is unavailable';
  end if;

  select count(*)
  into pending_hold_count
  from app.coach_private_bookings as booking
  where booking.credit_projection_id = selected_projection.id
    and booking.status = 'pending'
    and booking.hold_expires_at > statement_timestamp();

  if selected_projection.available_credits <= pending_hold_count then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking has no unpromised credit';
  end if;

  resolved_hold_expiry := least(
    statement_timestamp() + interval '10 minutes',
    selected_slot.starts_at
  );
  if resolved_hold_expiry <= statement_timestamp() then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold cannot be created';
  end if;

  insert into app.coach_private_bookings (
    id,
    run_id,
    slot_id,
    coach_profile_id,
    client_profile_id,
    credit_projection_id,
    status,
    scheduled_start_at,
    scheduled_end_at,
    early_return_until,
    hold_expires_at
  ) values (
    requested_booking_id,
    run_id_text::uuid,
    selected_slot.id,
    selected_slot.profile_id,
    profile_id_text::uuid,
    selected_projection.id,
    'pending',
    selected_slot.starts_at,
    selected_slot.ends_at,
    selected_slot.starts_at
      - make_interval(mins => selected_coach.early_cancellation_minutes),
    resolved_hold_expiry
  );

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    run_id_text::uuid,
    requested_booking_id,
    selected_projection.id,
    'reserve',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    requested_reservation_address,
    selected_slot.starts_at,
    selected_slot.starts_at
      - make_interval(mins => selected_coach.early_cancellation_minutes)
  )
  returning id into created_operation_id;

  update app.coach_availability_slots
  set status = 'held'
  where id = selected_slot.id;

  perform set_config('app.wallet_management', 'off', true);
  perform set_config('app.coach_profile_management', 'off', true);
  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return query select requested_booking_id, created_operation_id, 'pending'::text;
exception
  when others then
    perform set_config('app.wallet_management', 'off', true);
    perform set_config('app.coach_profile_management', 'off', true);
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.request_owned_private_booking_cancellation(
  requested_booking_id uuid
)
returns table (outcome text, operation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  selected_operation app.coach_booking_credit_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation request is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.client_profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation is unauthorized';
  end if;

  if selected_booking.status = 'cancelled' then
    select operation.*
    into selected_operation
    from app.coach_booking_credit_operations as operation
    where operation.booking_id = selected_booking.id
      and operation.kind = 'return';
    return query select 'cancelled'::text, selected_operation.id;
    return;
  end if;

  if selected_booking.status = 'cancellation-requested' then
    return query select 'coach-decision-required'::text, null::uuid;
    return;
  end if;

  if selected_booking.status <> 'confirmed'
    or selected_booking.scheduled_start_at <= statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cannot be cancelled';
  end if;

  if statement_timestamp() > selected_booking.early_return_until then
    update app.coach_private_bookings
    set
      status = 'cancellation-requested',
      cancellation_requested_at = statement_timestamp()
    where id = selected_booking.id;
    perform set_config('app.coach_booking_management', 'off', true);
    return query select 'coach-decision-required'::text, null::uuid;
    return;
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = selected_booking.credit_projection_id
  for update;
  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
    and operation.status = 'finalized';

  if selected_projection.id is null or reserve_operation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized reservation is unavailable';
  end if;

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    selected_booking.run_id,
    selected_booking.id,
    selected_projection.id,
    'return',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    selected_booking.scheduled_start_at,
    selected_booking.early_return_until
  )
  on conflict (booking_id, kind) do update
  set booking_id = excluded.booking_id
  returning * into selected_operation;

  perform set_config('app.coach_booking_management', 'off', true);
  return query select 'return-prepared'::text, selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.decide_owned_late_booking_cancellation(
  requested_booking_id uuid,
  requested_decision text
)
returns table (outcome text, operation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  selected_operation app.coach_booking_credit_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
    or requested_decision not in ('approved', 'denied')
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation decision is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.coach_profile_id = profile_id_text::uuid
  for update;

  if not found
    or selected_booking.scheduled_start_at <= statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cancellation decision is unavailable';
  end if;

  if selected_booking.cancellation_decision is not null then
    if selected_booking.cancellation_decision <> requested_decision then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking cancellation was already decided';
    end if;
    select operation.*
    into selected_operation
    from app.coach_booking_credit_operations as operation
    where operation.booking_id = selected_booking.id
      and operation.kind = 'return';
    return query select
      case requested_decision
        when 'approved' then 'return-prepared'
        else 'denied'
      end,
      selected_operation.id;
    return;
  end if;

  if selected_booking.status <> 'cancellation-requested' then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking has no late cancellation request';
  end if;

  update app.coach_private_bookings
  set
    status = case
      when requested_decision = 'denied' then 'denied'
      else status
    end,
    cancellation_decision = requested_decision,
    cancellation_decided_at = statement_timestamp(),
    cancellation_decided_by_profile_id = profile_id_text::uuid
  where id = selected_booking.id;

  if requested_decision = 'denied' then
    perform set_config('app.coach_booking_management', 'off', true);
    return query select 'denied'::text, null::uuid;
    return;
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = selected_booking.credit_projection_id
  for update;
  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
    and operation.status = 'finalized';

  if selected_projection.id is null or reserve_operation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized reservation is unavailable';
  end if;

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    selected_booking.run_id,
    selected_booking.id,
    selected_projection.id,
    'return',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    selected_booking.scheduled_start_at,
    selected_booking.early_return_until
  )
  returning * into selected_operation;

  perform set_config('app.coach_booking_management', 'off', true);
  return query select 'return-prepared'::text, selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.prepare_owned_private_booking_consumption(
  requested_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id_text text;
  run_id_text text;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  selected_operation app.coach_booking_credit_operations%rowtype;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking consumption request is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.coach_profile_id = profile_id_text::uuid
  for update;

  if not found
    or selected_booking.status not in ('confirmed', 'denied')
    or selected_booking.scheduled_start_at > statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking cannot be consumed';
  end if;

  select operation.*
  into selected_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'consume';
  if found then
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_operation.id;
  end if;

  select projection.*
  into selected_projection
  from app.coach_client_credit_projections as projection
  where projection.id = selected_booking.credit_projection_id
  for update;
  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
    and operation.status = 'finalized';

  if selected_projection.id is null or reserve_operation.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized reservation is unavailable';
  end if;

  insert into app.coach_booking_credit_operations (
    run_id,
    booking_id,
    credit_projection_id,
    kind,
    status,
    program_address,
    coach_authority_address,
    client_wallet_address,
    coach_client_credits_address,
    credit_reservation_address,
    scheduled_start_at,
    early_return_until
  ) values (
    selected_booking.run_id,
    selected_booking.id,
    selected_projection.id,
    'consume',
    'prepared',
    selected_projection.program_address,
    selected_projection.coach_authority_address,
    selected_projection.client_wallet_address,
    selected_projection.coach_client_credits_address,
    reserve_operation.credit_reservation_address,
    selected_booking.scheduled_start_at,
    selected_booking.early_return_until
  )
  returning * into selected_operation;

  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.mark_booking_credit_operation_submitted(
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

  if not found
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

  perform set_config('app.coach_booking_management', 'off', true);
  return selected_operation.id;
exception
  when others then
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.release_owned_private_booking_hold(
  requested_booking_id uuid,
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
  selected_booking app.coach_private_bookings%rowtype;
  reserve_operation app.coach_booking_credit_operations%rowtype;
  resolved_operation_status text;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_booking_id is null
    or requested_reason not in (
      'wallet-rejected',
      'simulation-failed',
      'reservation-absent'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold release is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

  select booking.*
  into selected_booking
  from app.coach_private_bookings as booking
  where booking.id = requested_booking_id
    and booking.run_id = run_id_text::uuid
    and booking.client_profile_id = profile_id_text::uuid
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold release is unauthorized';
  end if;
  if selected_booking.status = 'expired' then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;
  if selected_booking.status <> 'pending'
    or (
      requested_reason = 'reservation-absent'
      and selected_booking.hold_expires_at > statement_timestamp()
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking hold cannot be released';
  end if;

  select operation.*
  into reserve_operation
  from app.coach_booking_credit_operations as operation
  where operation.booking_id = selected_booking.id
    and operation.kind = 'reserve'
  for update;

  if reserve_operation.id is null
    or reserve_operation.status not in ('prepared', 'submitted')
    or (
      reserve_operation.status = 'submitted'
      and requested_reason <> 'reservation-absent'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking reserve operation cannot be released';
  end if;

  resolved_operation_status := case requested_reason
    when 'reservation-absent' then 'expired'
    else 'failed'
  end;
  update app.coach_booking_credit_operations
  set
    status = resolved_operation_status,
    failure_code = requested_reason,
    failed_at = statement_timestamp()
  where id = reserve_operation.id;
  update app.coach_private_bookings
  set
    status = 'expired',
    expired_at = statement_timestamp()
  where id = selected_booking.id;
  update app.coach_availability_slots
  set status = 'open'
  where id = selected_booking.slot_id
    and status = 'held';

  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_booking.id;
exception
  when others then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create function app.finalize_verified_booking_credit_operation(
  requested_operation_id uuid,
  verified_program_address text,
  verified_coach_authority_address text,
  verified_client_wallet_address text,
  verified_credits_address text,
  verified_reservation_address text,
  verified_booking_id uuid,
  verified_scheduled_start_unix_seconds bigint,
  verified_early_return_until_unix_seconds bigint,
  verified_reservation_status text,
  verified_available_credits bigint,
  verified_reserved_credits bigint,
  verified_total_purchased bigint,
  verified_transaction_signature text,
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
  selected_operation app.coach_booking_credit_operations%rowtype;
  selected_booking app.coach_private_bookings%rowtype;
  selected_projection app.coach_client_credit_projections%rowtype;
  selected_slot app.coach_availability_slots%rowtype;
  expected_reservation_status text;
  expected_start_seconds bigint;
  expected_cutoff_seconds bigint;
begin
  if not app.authorized_actor_context_valid(null, null, null)
    or requested_operation_id is null
    or verified_booking_id is null
    or verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_client_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_credits_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_reservation_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_reservation_status not in ('reserved', 'returned', 'consumed')
    or verified_scheduled_start_unix_seconds <= 0
    or verified_early_return_until_unix_seconds
      > verified_scheduled_start_unix_seconds
    or verified_available_credits not between 0 and 9000000000000000
    or verified_reserved_credits not between 0 and 9000000000000000
    or verified_total_purchased not between 0 and 9000000000000000
    or verified_available_credits + verified_reserved_credits
      > verified_total_purchased
    or verified_observed_slot < 0
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized evidence is invalid';
  end if;

  profile_id_text := current_setting('app.current_profile_id', true);
  run_id_text := current_setting('app.current_run_id', true);
  perform set_config('app.coach_availability_management', 'on', true);
  perform set_config('app.coach_booking_management', 'on', true);

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
    select projection.*
    into selected_projection
    from app.coach_client_credit_projections as projection
    where projection.id = selected_operation.credit_projection_id
      and projection.run_id = selected_operation.run_id
    for update;
    select slot.*
    into selected_slot
    from app.coach_availability_slots as slot
    where slot.id = selected_booking.slot_id
      and slot.run_id = selected_booking.run_id
    for update;
  end if;

  if not found
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
      message = 'coach booking finalized evidence is unauthorized';
  end if;

  expected_reservation_status := case selected_operation.kind
    when 'reserve' then 'reserved'
    when 'return' then 'returned'
    when 'consume' then 'consumed'
  end;
  expected_start_seconds := extract(
    epoch from selected_operation.scheduled_start_at
  )::bigint;
  expected_cutoff_seconds := extract(
    epoch from selected_operation.early_return_until
  )::bigint;

  if selected_operation.program_address <> verified_program_address
    or selected_operation.coach_authority_address
      <> verified_coach_authority_address
    or selected_operation.client_wallet_address
      <> verified_client_wallet_address
    or selected_operation.coach_client_credits_address
      <> verified_credits_address
    or selected_operation.credit_reservation_address
      <> verified_reservation_address
    or selected_operation.booking_id <> verified_booking_id
    or expected_start_seconds <> verified_scheduled_start_unix_seconds
    or expected_cutoff_seconds <> verified_early_return_until_unix_seconds
    or expected_reservation_status <> verified_reservation_status
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking finalized evidence does not match preparation';
  end if;

  if selected_operation.status = 'finalized' then
    if selected_operation.transaction_signature <> verified_transaction_signature
      or selected_operation.observed_reservation_status
        <> verified_reservation_status
      or selected_operation.observed_available_credits
        <> verified_available_credits
      or selected_operation.observed_reserved_credits
        <> verified_reserved_credits
      or selected_operation.observed_total_purchased
        <> verified_total_purchased
      or selected_operation.observed_slot <> verified_observed_slot
    then
      raise exception using
        errcode = 'P0001',
        message = 'coach booking finalized retry conflicts with evidence';
    end if;
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    return selected_booking.id;
  end if;

  if selected_operation.status not in ('prepared', 'submitted')
    or (
      selected_operation.transaction_signature is not null
      and selected_operation.transaction_signature
        <> verified_transaction_signature
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking operation cannot be finalized';
  end if;

  if selected_operation.kind = 'reserve'
    and (
      selected_booking.status <> 'pending'
      or selected_slot.status <> 'held'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking reserve state conflicts with evidence';
  elsif selected_operation.kind = 'return'
    and (
      selected_booking.status not in ('confirmed', 'cancellation-requested')
      or (
        selected_booking.status = 'cancellation-requested'
        and selected_booking.cancellation_decision <> 'approved'
      )
      or selected_slot.status <> 'booked'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking return state conflicts with evidence';
  elsif selected_operation.kind = 'consume'
    and (
      selected_booking.status not in ('confirmed', 'denied')
      or selected_booking.scheduled_start_at > statement_timestamp()
      or selected_slot.status <> 'booked'
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking consume state conflicts with evidence';
  end if;

  if verified_observed_slot > selected_projection.observed_slot
    and verified_total_purchased < selected_projection.total_purchased
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking projection would move purchase totals backward';
  end if;
  if verified_observed_slot = selected_projection.observed_slot
    and (
      verified_available_credits <> selected_projection.available_credits
      or verified_reserved_credits <> selected_projection.reserved_credits
      or verified_total_purchased <> selected_projection.total_purchased
    )
  then
    raise exception using
      errcode = 'P0001',
      message = 'coach booking equal-slot evidence conflicts with projection';
  end if;

  update app.coach_booking_credit_operations
  set
    status = 'finalized',
    transaction_signature = verified_transaction_signature,
    submitted_at = coalesce(submitted_at, statement_timestamp()),
    observed_reservation_status = verified_reservation_status,
    observed_available_credits = verified_available_credits,
    observed_reserved_credits = verified_reserved_credits,
    observed_total_purchased = verified_total_purchased,
    observed_slot = verified_observed_slot,
    finalized_at = statement_timestamp()
  where id = selected_operation.id;

  if verified_observed_slot > selected_projection.observed_slot then
    update app.coach_client_credit_projections
    set
      available_credits = verified_available_credits,
      reserved_credits = verified_reserved_credits,
      total_purchased = verified_total_purchased,
      transaction_signature = verified_transaction_signature,
      observed_slot = verified_observed_slot
    where id = selected_projection.id;
  end if;

  if selected_operation.kind = 'reserve' then
    update app.coach_private_bookings
    set status = 'confirmed'
    where id = selected_booking.id;
    update app.coach_availability_slots
    set status = 'booked'
    where id = selected_booking.slot_id;
  elsif selected_operation.kind = 'return' then
    update app.coach_private_bookings
    set
      status = 'cancelled',
      cancelled_at = statement_timestamp()
    where id = selected_booking.id;
    update app.coach_availability_slots
    set status = 'open'
    where id = selected_booking.slot_id;
  elsif selected_booking.status = 'confirmed' then
    update app.coach_private_bookings
    set
      status = 'completed',
      completed_at = statement_timestamp()
    where id = selected_booking.id;
  end if;

  perform set_config('app.coach_availability_management', 'off', true);
  perform set_config('app.coach_booking_management', 'off', true);
  return selected_booking.id;
exception
  when others then
    perform set_config('app.coach_availability_management', 'off', true);
    perform set_config('app.coach_booking_management', 'off', true);
    raise;
end;
$$;

create policy profiles_coach_client_select
  on app.profiles
  for select
  to app_runtime
  using (
    exists (
      select 1
      from app.coach_client_credit_projections as projection
      where projection.run_id = nullif(
          current_setting('app.current_run_id', true),
          ''
        )::uuid
        and projection.client_profile_id = profiles.id
        and projection.coach_profile_id = nullif(
          current_setting('app.current_profile_id', true),
          ''
        )::uuid
        and app.authorized_actor_context_valid(
          projection.coach_profile_id,
          projection.run_id,
          null
        )
    )
  );

alter function app.update_owned_coach_cancellation_policy(integer)
  owner to app_owner;
alter function app.record_verified_coach_credit_projection(
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  timestamptz,
  text,
  bigint
) owner to app_owner;
alter function app.prepare_credit_backed_private_booking(
  uuid,
  uuid,
  uuid,
  text
) owner to app_owner;
alter function app.request_owned_private_booking_cancellation(uuid)
  owner to app_owner;
alter function app.decide_owned_late_booking_cancellation(uuid, text)
  owner to app_owner;
alter function app.prepare_owned_private_booking_consumption(uuid)
  owner to app_owner;
alter function app.mark_booking_credit_operation_submitted(uuid, text)
  owner to app_owner;
alter function app.release_owned_private_booking_hold(uuid, text)
  owner to app_owner;
alter function app.finalize_verified_booking_credit_operation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  text,
  bigint,
  bigint,
  bigint,
  text,
  bigint
) owner to app_owner;

revoke all on function app.update_owned_coach_cancellation_policy(integer)
  from public, anon, authenticated, service_role;
revoke all on function app.record_verified_coach_credit_projection(
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  timestamptz,
  text,
  bigint
) from public, anon, authenticated, service_role;
revoke all on function app.prepare_credit_backed_private_booking(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated, service_role;
revoke all on function app.request_owned_private_booking_cancellation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.decide_owned_late_booking_cancellation(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.prepare_owned_private_booking_consumption(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.mark_booking_credit_operation_submitted(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.release_owned_private_booking_hold(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function app.finalize_verified_booking_credit_operation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  text,
  bigint,
  bigint,
  bigint,
  text,
  bigint
) from public, anon, authenticated, service_role;

grant execute on function app.update_owned_coach_cancellation_policy(integer)
  to app_runtime;
grant execute on function app.record_verified_coach_credit_projection(
  uuid,
  text,
  text,
  text,
  text,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  text,
  timestamptz,
  text,
  bigint
) to app_runtime;
grant execute on function app.prepare_credit_backed_private_booking(
  uuid,
  uuid,
  uuid,
  text
) to app_runtime;
grant execute on function app.request_owned_private_booking_cancellation(uuid)
  to app_runtime;
grant execute on function app.decide_owned_late_booking_cancellation(uuid, text)
  to app_runtime;
grant execute on function app.prepare_owned_private_booking_consumption(uuid)
  to app_runtime;
grant execute on function app.mark_booking_credit_operation_submitted(uuid, text)
  to app_runtime;
grant execute on function app.release_owned_private_booking_hold(uuid, text)
  to app_runtime;
grant execute on function app.finalize_verified_booking_credit_operation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  text,
  bigint,
  bigint,
  bigint,
  text,
  bigint
) to app_runtime;

comment on column app.coach_profiles.early_cancellation_minutes is
  'Coach-owned policy; each prepared booking snapshots its resulting cutoff.';
comment on table app.coach_client_credit_projections is
  'Finalized Solana coach-client ledger projections; rows never create credits.';
comment on table app.coach_private_bookings is
  'Capacity-one application booking and human cancellation-decision workflow.';
comment on table app.coach_booking_credit_operations is
  'Idempotent prepared/submitted/finalized evidence records for one Solana reservation transition.';
comment on function app.finalize_verified_booking_credit_operation(
  uuid,
  text,
  text,
  text,
  text,
  text,
  uuid,
  bigint,
  bigint,
  text,
  bigint,
  bigint,
  bigint,
  text,
  bigint
) is
  'Persists evidence already verified by the trusted server adapter; this function does not query Solana.';
