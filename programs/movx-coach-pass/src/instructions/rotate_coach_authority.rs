use anchor_lang::prelude::*;

use crate::{
    constants::COACH_AUTHORITY_SEED, errors::CoachPassError, events::CoachAuthorityRotated,
    state::CoachAuthority,
};

pub fn handler(ctx: Context<RotateCoachAuthority>) -> Result<()> {
    let replacement_wallet = ctx.accounts.replacement_wallet.key();
    let (previous_wallet, authority_epoch, event_sequence) =
        ctx.accounts.coach_authority.rotate(replacement_wallet)?;

    emit_cpi!(CoachAuthorityRotated {
        coach_authority: ctx.accounts.coach_authority.key(),
        previous_wallet,
        replacement_wallet,
        authority_epoch,
        event_sequence,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct RotateCoachAuthority<'info> {
    #[account(
        mut,
        seeds = [
            COACH_AUTHORITY_SEED,
            coach_authority.run_id.as_ref(),
            coach_authority.profile_id.as_ref(),
            coach_authority.original_wallet.as_ref(),
        ],
        bump = coach_authority.bump,
        has_one = recovery_authority @ CoachPassError::UnauthorizedRecoveryAuthority,
    )]
    pub coach_authority: Account<'info, CoachAuthority>,
    pub recovery_authority: Signer<'info>,
    pub replacement_wallet: Signer<'info>,
}
