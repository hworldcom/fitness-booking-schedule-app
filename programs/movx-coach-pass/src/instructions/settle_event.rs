use anchor_lang::prelude::*;

use crate::{constants::EVENT_POOL_SEED, events::EventPoolSettled, state::EventPool};

pub fn handler(ctx: Context<SettleEvent>) -> Result<()> {
    let settled_at = Clock::get()?.unix_timestamp;
    let status = ctx.accounts.event_pool.settle(settled_at)?;

    emit_cpi!(EventPoolSettled {
        event_pool: ctx.accounts.event_pool.key(),
        status,
        participant_count: ctx.accounts.event_pool.participant_count,
        minimum_participants: ctx.accounts.event_pool.minimum_participants,
        total_funded_base_units: ctx.accounts.event_pool.total_funded_base_units,
        settled_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct SettleEvent<'info> {
    pub settler: Signer<'info>,
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
}
