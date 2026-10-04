use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{
        COACH_AUTHORITY_SEED, DEVNET_EURC_DECIMALS, DEVNET_EURC_MINT, EVENT_POOL_SEED,
        EVENT_VAULT_SEED,
    },
    errors::CoachPassError,
    events::EventPoolCreated,
    state::{CoachAuthority, CreateEventPoolArgs, EventPool},
};

pub fn handler(ctx: Context<CreateEventPool>, args: CreateEventPoolArgs) -> Result<()> {
    let created_at = Clock::get()?.unix_timestamp;
    let event_pool = EventPool::initialize(
        ctx.accounts.coach_authority.key(),
        ctx.accounts.coach_wallet.key(),
        ctx.accounts.payment_mint.key(),
        ctx.accounts.vault.key(),
        args,
        created_at,
        ctx.bumps.event_pool,
        ctx.bumps.vault,
    )?;
    ctx.accounts.event_pool.set_inner(event_pool);

    emit_cpi!(EventPoolCreated {
        event_pool: ctx.accounts.event_pool.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        payout_recipient: ctx.accounts.coach_wallet.key(),
        payment_mint: ctx.accounts.payment_mint.key(),
        vault: ctx.accounts.vault.key(),
        nonce: args.nonce,
        price_eurc_base_units: args.price_eurc_base_units,
        minimum_participants: args.minimum_participants,
        maximum_participants: args.maximum_participants,
        funding_deadline: args.funding_deadline,
        event_start_at: args.event_start_at,
        event_end_at: args.event_end_at,
        created_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: CreateEventPoolArgs)]
pub struct CreateEventPool<'info> {
    #[account(
        constraint = coach_authority.current_wallet == coach_wallet.key()
            @ CoachPassError::UnauthorizedCoach,
    )]
    pub coach_wallet: Signer<'info>,
    #[account(mut)]
    pub platform_payer: Signer<'info>,
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
        init,
        payer = platform_payer,
        space = 8 + EventPool::INIT_SPACE,
        seeds = [
            EVENT_POOL_SEED,
            coach_authority.key().as_ref(),
            &args.nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub event_pool: Box<Account<'info, EventPool>>,
    #[account(
        address = DEVNET_EURC_MINT @ CoachPassError::InvalidPaymentMint,
        constraint = payment_mint.decimals == DEVNET_EURC_DECIMALS
            @ CoachPassError::InvalidPaymentMintDecimals,
    )]
    pub payment_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = platform_payer,
        seeds = [EVENT_VAULT_SEED, event_pool.key().as_ref()],
        bump,
        token::mint = payment_mint,
        token::authority = event_pool,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
