use anchor_lang::prelude::*;

use crate::{
    constants::{COACH_AUTHORITY_SEED, COACH_CLIENT_CREDITS_SEED, CREDIT_RESERVATION_SEED},
    errors::CoachPassError,
    events::BookingCreditReserved,
    state::{CoachAuthority, CoachClientCredits, CreditReservation},
};

pub fn handler(
    ctx: Context<ReserveBookingCredit>,
    booking_id: [u8; 16],
    scheduled_start_at: i64,
    early_return_until: i64,
) -> Result<()> {
    let reserved_at = Clock::get()?.unix_timestamp;
    let client_wallet = ctx.accounts.client_wallet.key();
    let reservation = CreditReservation::initialize(
        ctx.accounts.coach_client_credits.key(),
        ctx.accounts.coach_authority.key(),
        client_wallet,
        booking_id,
        scheduled_start_at,
        early_return_until,
        reserved_at,
        ctx.bumps.credit_reservation,
    )?;
    let balances = ctx.accounts.coach_client_credits.reserve_credit()?;
    ctx.accounts.credit_reservation.set_inner(reservation);

    emit_cpi!(BookingCreditReserved {
        credit_reservation: ctx.accounts.credit_reservation.key(),
        coach_client_credits: ctx.accounts.coach_client_credits.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        client_wallet,
        booking_id,
        scheduled_start_at,
        early_return_until,
        available_credits: balances.available_credits,
        reserved_credits: balances.reserved_credits,
        reserved_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(
    booking_id: [u8; 16],
    scheduled_start_at: i64,
    early_return_until: i64,
)]
pub struct ReserveBookingCredit<'info> {
    pub client_wallet: Signer<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
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
            COACH_CLIENT_CREDITS_SEED,
            coach_authority.key().as_ref(),
            client_wallet.key().as_ref(),
        ],
        bump = coach_client_credits.bump,
        has_one = coach_authority,
        constraint = coach_client_credits.client_wallet == client_wallet.key()
            @ CoachPassError::InvalidCreditLedgerAuthority,
    )]
    pub coach_client_credits: Box<Account<'info, CoachClientCredits>>,
    #[account(
        init,
        payer = fee_payer,
        space = 8 + CreditReservation::INIT_SPACE,
        seeds = [
            CREDIT_RESERVATION_SEED,
            coach_client_credits.key().as_ref(),
            booking_id.as_ref(),
        ],
        bump,
    )]
    pub credit_reservation: Box<Account<'info, CreditReservation>>,
    pub system_program: Program<'info, System>,
}
