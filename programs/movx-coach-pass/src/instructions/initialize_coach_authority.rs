use anchor_lang::prelude::*;

use crate::{
    constants::COACH_AUTHORITY_SEED, events::CoachAuthorityInitialized, state::CoachAuthority,
};

pub fn handler(
    ctx: Context<InitializeCoachAuthority>,
    run_id: [u8; 16],
    profile_id: [u8; 16],
) -> Result<()> {
    let coach_wallet = ctx.accounts.coach_wallet.key();
    let recovery_authority = ctx.accounts.recovery_authority.key();
    let authority = CoachAuthority::initialize(
        run_id,
        profile_id,
        coach_wallet,
        recovery_authority,
        ctx.bumps.coach_authority,
    )?;
    ctx.accounts.coach_authority.set_inner(authority);

    emit_cpi!(CoachAuthorityInitialized {
        coach_authority: ctx.accounts.coach_authority.key(),
        run_id,
        profile_id,
        original_wallet: coach_wallet,
        recovery_authority,
        authority_epoch: 0,
        event_sequence: 0,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(run_id: [u8; 16], profile_id: [u8; 16])]
pub struct InitializeCoachAuthority<'info> {
    #[account(mut)]
    pub coach_wallet: Signer<'info>,
    pub recovery_authority: Signer<'info>,
    #[account(
        init,
        payer = coach_wallet,
        space = 8 + CoachAuthority::INIT_SPACE,
        seeds = [
            COACH_AUTHORITY_SEED,
            run_id.as_ref(),
            profile_id.as_ref(),
            coach_wallet.key().as_ref(),
        ],
        bump,
    )]
    pub coach_authority: Account<'info, CoachAuthority>,
    pub system_program: Program<'info, System>,
}
