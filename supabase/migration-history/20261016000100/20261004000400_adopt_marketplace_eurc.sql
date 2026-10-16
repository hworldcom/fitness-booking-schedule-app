-- Change the current marketplace projection contract from official Solana
-- Devnet USDC to official Solana Devnet EURC without relabelling chain evidence.

do $$
begin
  if exists (select 1 from app.group_event_pool_projections) then
    raise exception using
      errcode = 'P0001',
      message = 'DEV0134 cannot adopt EURC while group-event pool projections exist; preserve or deliberately clear the obsolete non-production projections before retrying';
  end if;
end;
$$;

alter table app.group_event_pool_projections
  drop constraint group_event_pool_projections_address_check;

alter table app.group_event_pool_projections
  add constraint group_event_pool_projections_address_check check (
    program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and event_pool_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and vault_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and coach_authority_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and payout_recipient_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and mint_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
    and token_program_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  ),
  add constraint group_event_pool_projections_token_check check (
    mint_address = 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr'
    and token_program_address = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
  );

comment on constraint group_event_pool_projections_token_check
  on app.group_event_pool_projections is
  'Finalized group-event projections must use Circle official Solana Devnet EURC through the legacy SPL Token program.';
