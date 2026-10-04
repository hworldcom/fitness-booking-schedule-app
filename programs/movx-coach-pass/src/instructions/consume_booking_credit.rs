use anchor_lang::prelude::*;

use crate::{
    constants::{COACH_AUTHORITY_SEED, COACH_CLIENT_CREDITS_SEED, CREDIT_RESERVATION_SEED},
    errors::CoachPassError,
    events::BookingCreditConsumed,
    state::{CoachAuthority, CoachClientCredits, CreditReservation},
};

pub fn handler(ctx: Context<ConsumeBookingCredit>) -> Result<()> {
    let consumed_at = Clock::get()?.unix_timestamp;
    let coach_wallet = ctx.accounts.coach_wallet.key();
    ctx.accounts.credit_reservation.validate_consume(
        coach_wallet,
        ctx.accounts.coach_authority.current_wallet,
        consumed_at,
    )?;
    let balances = ctx
        .accounts
        .coach_client_credits
        .consume_reserved_credit()?;
    ctx.accounts.credit_reservation.mark_consumed(consumed_at);

    emit_cpi!(BookingCreditConsumed {
        credit_reservation: ctx.accounts.credit_reservation.key(),
        coach_client_credits: ctx.accounts.coach_client_credits.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        client_wallet: ctx.accounts.coach_client_credits.client_wallet,
        booking_id: ctx.accounts.credit_reservation.booking_id,
        coach_wallet,
        available_credits: balances.available_credits,
        reserved_credits: balances.reserved_credits,
        consumed_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct ConsumeBookingCredit<'info> {
    pub coach_wallet: Signer<'info>,
    #[account(
        seeds = [
            COACH_AUTHORITY_SEED,
            coach_authority.run_id.as_ref(),
            coach_authority.profile_id.as_ref(),
            coach_authority.original_wallet.as_ref(),
        ],
        bump = coach_authority.bump,
        constraint = coach_authority.current_wallet == coach_wallet.key()
            @ CoachPassError::UnauthorizedReservationConsume,
    )]
    pub coach_authority: Box<Account<'info, CoachAuthority>>,
    #[account(
        mut,
        seeds = [
            COACH_CLIENT_CREDITS_SEED,
            coach_authority.key().as_ref(),
            coach_client_credits.client_wallet.as_ref(),
        ],
        bump = coach_client_credits.bump,
        has_one = coach_authority,
    )]
    pub coach_client_credits: Box<Account<'info, CoachClientCredits>>,
    #[account(
        mut,
        seeds = [
            CREDIT_RESERVATION_SEED,
            coach_client_credits.key().as_ref(),
            credit_reservation.booking_id.as_ref(),
        ],
        bump = credit_reservation.bump,
        has_one = coach_client_credits @ CoachPassError::ReservationLedgerMismatch,
        constraint = credit_reservation.coach_authority == coach_authority.key()
            @ CoachPassError::ReservationCoachMismatch,
        constraint = credit_reservation.client_wallet == coach_client_credits.client_wallet
            @ CoachPassError::ReservationClientMismatch,
    )]
    pub credit_reservation: Box<Account<'info, CreditReservation>>,
}
