use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{
        CONTRIBUTION_SEED, DEVNET_EURC_DECIMALS, DEVNET_EURC_MINT, EVENT_POOL_SEED,
        EVENT_VAULT_SEED,
    },
    errors::CoachPassError,
    events::EventSeatFunded,
    state::{Contribution, EventPool},
};

use super::event_token_common::transfer_event_tokens;

pub fn handler(ctx: Context<FundEvent>) -> Result<()> {
    let funded_at = Clock::get()?.unix_timestamp;
    let totals = ctx.accounts.event_pool.prepare_funding(funded_at)?;
    let contribution = Contribution::initialize(
        ctx.accounts.event_pool.key(),
        ctx.accounts.participant_wallet.key(),
        ctx.accounts.event_pool.price_eurc_base_units,
        funded_at,
        ctx.bumps.contribution,
    )?;

    transfer_event_tokens(
        &ctx.accounts.participant_token_account,
        &ctx.accounts.payment_mint,
        &ctx.accounts.vault,
        ctx.accounts.participant_wallet.to_account_info(),
        &ctx.accounts.token_program,
        ctx.accounts.event_pool.price_eurc_base_units,
        None,
    )?;

    ctx.accounts.contribution.set_inner(contribution);
    ctx.accounts.event_pool.apply_funding(totals);

    emit_cpi!(EventSeatFunded {
        event_pool: ctx.accounts.event_pool.key(),
        contribution: ctx.accounts.contribution.key(),
        participant_wallet: ctx.accounts.participant_wallet.key(),
        amount_eurc_base_units: ctx.accounts.event_pool.price_eurc_base_units,
        participant_count: ctx.accounts.event_pool.participant_count,
        total_funded_base_units: ctx.accounts.event_pool.total_funded_base_units,
        funded_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct FundEvent<'info> {
    pub participant_wallet: Signer<'info>,
    #[account(mut)]
    pub platform_payer: Signer<'info>,
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
        init,
        payer = platform_payer,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [
            CONTRIBUTION_SEED,
            event_pool.key().as_ref(),
            participant_wallet.key().as_ref(),
        ],
        bump,
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
        token::mint = payment_mint,
        token::authority = participant_wallet,
    )]
    pub participant_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [EVENT_VAULT_SEED, event_pool.key().as_ref()],
        bump = event_pool.vault_bump,
        token::mint = payment_mint,
        token::authority = event_pool,
        constraint = event_pool.vault == vault.key() @ CoachPassError::InvalidEventVault,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
