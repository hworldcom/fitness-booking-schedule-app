-- Align the trusted finalized-pool verifier with the EURC constraint adopted by
-- the preceding migration. The signature and authorization grants are stable.

create or replace function app.record_verified_group_event_pool_projection(
  requested_event_id uuid,
  verified_program_address text,
  verified_event_pool_address text,
  verified_vault_address text,
  verified_coach_authority_address text,
  verified_payout_recipient_address text,
  verified_mint_address text,
  verified_token_program_address text,
  verified_seat_price_base_units bigint,
  verified_minimum_participants smallint,
  verified_maximum_participants smallint,
  verified_participant_count smallint,
  verified_funding_deadline timestamptz,
  verified_event_starts_at timestamptz,
  verified_event_ends_at timestamptz,
  verified_lifecycle_status text,
  verified_transaction_signature text,
  verified_observed_slot bigint,
  verified_finalized_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_event record;
  existing_projection record;
begin
  if verified_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_event_pool_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_vault_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_coach_authority_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_payout_recipient_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_mint_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_token_program_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    or verified_mint_address <> 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'
    or verified_token_program_address <> 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    or verified_transaction_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,100}$'
    or verified_seat_price_base_units not between 1 and 9000000000000000
    or verified_minimum_participants not between 2 and 50
    or verified_maximum_participants not between verified_minimum_participants and 50
    or verified_participant_count not between 0 and verified_maximum_participants
    or verified_funding_deadline >= verified_event_starts_at
    or verified_event_ends_at - verified_event_starts_at
      not between interval '30 minutes' and interval '12 hours'
    or verified_lifecycle_status not in ('funding', 'succeeded', 'paid', 'failed')
    or (
      verified_lifecycle_status in ('succeeded', 'paid')
      and verified_participant_count < verified_minimum_participants
    )
    or (
      verified_lifecycle_status = 'failed'
      and verified_participant_count >= verified_minimum_participants
    )
    or verified_observed_slot < 0
    or verified_finalized_at is null
  then
    raise exception using errcode = 'P0001', message = 'group event pool evidence is invalid';
  end if;

  perform pg_catalog.set_config('app.group_event_management', 'on', true);
  select * into selected_event
  from app.group_events as event
  where event.id = requested_event_id
  for update;
  if not found
    or selected_event.program_address <> verified_program_address
    or selected_event.event_pool_address <> verified_event_pool_address
    or selected_event.coach_wallet_address_snapshot <> verified_coach_authority_address
    or selected_event.starts_at <> verified_event_starts_at
    or selected_event.ends_at <> verified_event_ends_at
  then
    raise exception using errcode = 'P0001', message = 'group event pool evidence does not match metadata';
  end if;

  select * into existing_projection
  from app.group_event_pool_projections as projection
  where projection.event_id = requested_event_id
  for update;

  if found then
    if verified_observed_slot < existing_projection.observed_slot
      or existing_projection.program_address <> verified_program_address
      or existing_projection.event_pool_address <> verified_event_pool_address
      or existing_projection.vault_address <> verified_vault_address
      or existing_projection.coach_authority_address <> verified_coach_authority_address
      or existing_projection.payout_recipient_address <> verified_payout_recipient_address
      or existing_projection.mint_address <> verified_mint_address
      or existing_projection.token_program_address <> verified_token_program_address
      or existing_projection.seat_price_base_units <> verified_seat_price_base_units
      or existing_projection.minimum_participants <> verified_minimum_participants
      or existing_projection.maximum_participants <> verified_maximum_participants
      or existing_projection.funding_deadline <> verified_funding_deadline
      or existing_projection.event_starts_at <> verified_event_starts_at
      or existing_projection.event_ends_at <> verified_event_ends_at
      or verified_participant_count < existing_projection.participant_count
      or not (
        (existing_projection.lifecycle_status = 'funding' and verified_lifecycle_status in ('funding', 'succeeded', 'failed'))
        or (existing_projection.lifecycle_status = 'succeeded' and verified_lifecycle_status in ('succeeded', 'paid'))
        or (existing_projection.lifecycle_status = 'paid' and verified_lifecycle_status = 'paid')
        or (existing_projection.lifecycle_status = 'failed' and verified_lifecycle_status = 'failed')
      )
    then
      raise exception using errcode = 'P0001', message = 'group event pool evidence is stale or conflicting';
    end if;

    if verified_observed_slot = existing_projection.observed_slot then
      if existing_projection.participant_count <> verified_participant_count
        or existing_projection.lifecycle_status <> verified_lifecycle_status
        or existing_projection.transaction_signature <> verified_transaction_signature
        or existing_projection.finalized_at <> verified_finalized_at
      then
        raise exception using errcode = 'P0001', message = 'group event pool evidence conflicts at the same slot';
      end if;
    else
      update app.group_event_pool_projections
      set
        participant_count = verified_participant_count,
        lifecycle_status = verified_lifecycle_status,
        transaction_signature = verified_transaction_signature,
        observed_slot = verified_observed_slot,
        finalized_at = verified_finalized_at
      where event_id = requested_event_id;
    end if;
  else
    insert into app.group_event_pool_projections (
      event_id,
      run_id,
      program_address,
      event_pool_address,
      vault_address,
      coach_authority_address,
      payout_recipient_address,
      mint_address,
      token_program_address,
      seat_price_base_units,
      minimum_participants,
      maximum_participants,
      participant_count,
      funding_deadline,
      event_starts_at,
      event_ends_at,
      lifecycle_status,
      transaction_signature,
      observed_slot,
      finalized_at
    ) values (
      requested_event_id,
      selected_event.run_id,
      verified_program_address,
      verified_event_pool_address,
      verified_vault_address,
      verified_coach_authority_address,
      verified_payout_recipient_address,
      verified_mint_address,
      verified_token_program_address,
      verified_seat_price_base_units,
      verified_minimum_participants,
      verified_maximum_participants,
      verified_participant_count,
      verified_funding_deadline,
      verified_event_starts_at,
      verified_event_ends_at,
      verified_lifecycle_status,
      verified_transaction_signature,
      verified_observed_slot,
      verified_finalized_at
    );
  end if;

  update app.group_events
  set
    projection_availability = 'current',
    projection_status_updated_at = verified_finalized_at
  where id = requested_event_id;
  perform pg_catalog.set_config('app.group_event_management', 'off', true);
  return requested_event_id;
exception
  when others then
    perform pg_catalog.set_config('app.group_event_management', 'off', true);
    raise;
end;
$$;

comment on function app.record_verified_group_event_pool_projection(
  uuid, text, text, text, text, text, text, text, bigint, smallint, smallint,
  smallint, timestamptz, timestamptz, timestamptz, text, text, bigint,
  timestamptz
) is
  'Persists only finalized, monotonic EventPool evidence for the official Solana Devnet EURC mint after binding it to application metadata.';
