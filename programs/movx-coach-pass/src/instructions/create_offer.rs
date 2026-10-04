use anchor_lang::prelude::*;

use crate::{
    constants::{COACH_AUTHORITY_SEED, OFFER_SEED},
    errors::CoachPassError,
    events::OfferCreated,
    state::{CoachAuthority, CreateOfferArgs, Offer},
};

pub fn handler(ctx: Context<CreateOffer>, args: CreateOfferArgs) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let coach_wallet = ctx.accounts.coach_wallet.key();
    let authority_epoch = ctx.accounts.coach_authority.authority_epoch;
    let event_sequence = ctx.accounts.coach_authority.next_event_sequence()?;
    let offer = Offer::initialize(
        ctx.accounts.coach_authority.key(),
        coach_wallet,
        authority_epoch,
        args,
        now,
        ctx.bumps.offer,
    )?;
    ctx.accounts.offer.set_inner(offer);

    emit_cpi!(OfferCreated {
        offer: ctx.accounts.offer.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        coach_wallet,
        nonce: args.nonce,
        price_usdc_base_units: args.price_usdc_base_units,
        session_count: args.session_count,
        validity_seconds: args.validity_seconds,
        restricted_client: args.restricted_client,
        payment_mint: crate::constants::DEVNET_USDC_MINT,
        authority_epoch,
        event_sequence,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(args: CreateOfferArgs)]
pub struct CreateOffer<'info> {
    pub coach_wallet: Signer<'info>,
    #[account(mut)]
    pub platform_payer: Signer<'info>,
    #[account(
        mut,
        seeds = [
            COACH_AUTHORITY_SEED,
            coach_authority.run_id.as_ref(),
            coach_authority.profile_id.as_ref(),
            coach_authority.original_wallet.as_ref(),
        ],
        bump = coach_authority.bump,
        constraint = coach_authority.current_wallet == coach_wallet.key()
            @ CoachPassError::UnauthorizedCoach,
    )]
    pub coach_authority: Account<'info, CoachAuthority>,
    #[account(
        init,
        payer = platform_payer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [
            OFFER_SEED,
            coach_authority.key().as_ref(),
            &args.nonce.to_le_bytes(),
        ],
        bump,
    )]
    pub offer: Account<'info, Offer>,
    pub system_program: Program<'info, System>,
}
