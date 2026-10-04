use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{
        COACH_AUTHORITY_SEED, DEVNET_EURC_DECIMALS, DEVNET_EURC_MINT, EVENT_POOL_SEED,
        EVENT_VAULT_SEED,
    },
    errors::CoachPassError,
    events::EventPayoutClaimed,
    state::{CoachAuthority, EventPool},
};

use super::event_token_common::transfer_event_tokens;

pub fn handler(ctx: Context<ClaimEventPayout>) -> Result<()> {
    let paid_at = Clock::get()?.unix_timestamp;
    let amount = ctx
        .accounts
        .event_pool
        .validate_payout(ctx.accounts.vault.amount)?;
    let nonce_bytes = ctx.accounts.event_pool.nonce.to_le_bytes();
    let bump = [ctx.accounts.event_pool.bump];
    let event_pool_seeds: &[&[u8]] = &[
        EVENT_POOL_SEED,
        ctx.accounts.event_pool.coach_authority.as_ref(),
        nonce_bytes.as_ref(),
        bump.as_ref(),
    ];
    let signer_seeds = &[event_pool_seeds];

    transfer_event_tokens(
        &ctx.accounts.vault,
        &ctx.accounts.payment_mint,
        &ctx.accounts.payout_token_account,
        ctx.accounts.event_pool.to_account_info(),
        &ctx.accounts.token_program,
        amount,
        Some(signer_seeds),
    )?;
    ctx.accounts.event_pool.mark_paid(paid_at);

    emit_cpi!(EventPayoutClaimed {
        event_pool: ctx.accounts.event_pool.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        payout_recipient: ctx.accounts.event_pool.payout_recipient,
        amount_eurc_base_units: amount,
        paid_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimEventPayout<'info> {
    #[account(
        constraint = coach_authority.current_wallet == coach_wallet.key()
            @ CoachPassError::UnauthorizedEventPayout,
    )]
    pub coach_wallet: Signer<'info>,
    #[account(
        seeds = [
            COACH_AUTHORITY_SEED,
            coach_authority.run_id.as_ref(),
            coach_authority.profile_id.as_ref(),
            coach_authority.original_wallet.as_ref(),
        ],
        bump = coach_authority.bump,
    )]
    pub coach_authority: Box<Account<'info, CoachAuthority>>,
    #[account(
        mut,
        seeds = [
            EVENT_POOL_SEED,
            coach_authority.key().as_ref(),
            &event_pool.nonce.to_le_bytes(),
        ],
        bump = event_pool.bump,
        has_one = coach_authority @ CoachPassError::EventPoolCoachMismatch,
    )]
    pub event_pool: Box<Account<'info, EventPool>>,
    #[account(
        address = DEVNET_EURC_MINT @ CoachPassError::InvalidPaymentMint,
        constraint = payment_mint.key() == event_pool.payment_mint
            @ CoachPassError::InvalidPaymentMint,
        constraint = payment_mint.decimals == DEVNET_EURC_DECIMALS
            @ CoachPassError::InvalidPaymentMintDecimals,
    )]
    pub payment_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds = [EVENT_VAULT_SEED, event_pool.key().as_ref()],
        bump = event_pool.vault_bump,
        token::mint = payment_mint,
        token::authority = event_pool,
        constraint = event_pool.vault == vault.key() @ CoachPassError::InvalidEventVault,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = payment_mint,
        constraint = payout_token_account.owner == event_pool.payout_recipient
            @ CoachPassError::InvalidEventPayoutDestination,
    )]
    pub payout_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
