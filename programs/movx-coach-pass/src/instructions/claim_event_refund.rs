use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{
        CONTRIBUTION_SEED, DEVNET_EURC_DECIMALS, DEVNET_EURC_MINT, EVENT_POOL_SEED,
        EVENT_VAULT_SEED,
    },
    errors::CoachPassError,
    events::EventRefundClaimed,
    state::{Contribution, EventPool},
};

use super::event_token_common::transfer_event_tokens;

pub fn handler(ctx: Context<ClaimEventRefund>) -> Result<()> {
    let refunded_at = Clock::get()?.unix_timestamp;
    let participant_wallet = ctx.accounts.participant_wallet.key();
    ctx.accounts
        .contribution
        .validate_refund(participant_wallet)?;
    let amount = ctx.accounts.contribution.amount_eurc_base_units;
    let total_refunded_base_units = ctx
        .accounts
        .event_pool
        .prepare_refund(amount, ctx.accounts.vault.amount)?;
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
        &ctx.accounts.participant_token_account,
        ctx.accounts.event_pool.to_account_info(),
        &ctx.accounts.token_program,
        amount,
        Some(signer_seeds),
    )?;
    ctx.accounts
        .event_pool
        .apply_refund(total_refunded_base_units);
    ctx.accounts.contribution.mark_refunded(refunded_at);

    emit_cpi!(EventRefundClaimed {
        event_pool: ctx.accounts.event_pool.key(),
        contribution: ctx.accounts.contribution.key(),
        participant_wallet,
        amount_eurc_base_units: amount,
        total_refunded_base_units,
        refunded_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimEventRefund<'info> {
    pub participant_wallet: Signer<'info>,
    #[account(
        mut,
        seeds = [
            EVENT_POOL_SEED,
            event_pool.coach_authority.as_ref(),
            &event_pool.nonce.to_le_bytes(),
        ],
        bump = event_pool.bump,
    )]
    pub event_pool: Box<Account<'info, EventPool>>,
    #[account(
        mut,
        seeds = [
            CONTRIBUTION_SEED,
            event_pool.key().as_ref(),
            participant_wallet.key().as_ref(),
        ],
        bump = contribution.bump,
        has_one = event_pool @ CoachPassError::ContributionPoolMismatch,
        constraint = contribution.participant_wallet == participant_wallet.key()
            @ CoachPassError::UnauthorizedContributionRefund,
    )]
    pub contribution: Box<Account<'info, Contribution>>,
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
        constraint = participant_token_account.owner == participant_wallet.key()
            @ CoachPassError::InvalidEventRefundDestination,
    )]
    pub participant_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
