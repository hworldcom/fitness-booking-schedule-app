use anchor_lang::prelude::*;

use crate::{
    constants::{COACH_AUTHORITY_SEED, OFFER_SEED},
    errors::CoachPassError,
    events::OfferDeactivated,
    state::{CoachAuthority, Offer},
};

pub fn handler(ctx: Context<DeactivateOffer>) -> Result<()> {
    let deactivated_at = Clock::get()?.unix_timestamp;
    ctx.accounts.offer.deactivate(deactivated_at)?;
    let event_sequence = ctx.accounts.coach_authority.next_event_sequence()?;

    emit_cpi!(OfferDeactivated {
        offer: ctx.accounts.offer.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        coach_wallet: ctx.accounts.coach_wallet.key(),
        nonce: ctx.accounts.offer.nonce,
        deactivated_at,
        event_sequence,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct DeactivateOffer<'info> {
    pub coach_wallet: Signer<'info>,
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
        mut,
        seeds = [
            OFFER_SEED,
            coach_authority.key().as_ref(),
            &offer.nonce.to_le_bytes(),
        ],
        bump = offer.bump,
        has_one = coach_authority,
    )]
    pub offer: Account<'info, Offer>,
}
