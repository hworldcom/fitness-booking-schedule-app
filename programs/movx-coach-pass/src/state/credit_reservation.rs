use anchor_lang::prelude::*;

use crate::{constants::CREDIT_RESERVATION_VERSION, errors::CoachPassError};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum CreditReservationStatus {
    Reserved,
    Returned,
    Consumed,
}

#[account]
#[derive(InitSpace)]
pub struct CreditReservation {
    pub version: u8,
    pub coach_client_credits: Pubkey,
    pub coach_authority: Pubkey,
    pub client_wallet: Pubkey,
    pub booking_id: [u8; 16],
    pub scheduled_start_at: i64,
    pub early_return_until: i64,
    pub status: CreditReservationStatus,
    pub reserved_at: i64,
    pub resolved_at: Option<i64>,
    pub bump: u8,
    pub reserved: [u8; 44],
}

impl CreditReservation {
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        coach_client_credits: Pubkey,
        coach_authority: Pubkey,
        client_wallet: Pubkey,
        booking_id: [u8; 16],
        scheduled_start_at: i64,
        early_return_until: i64,
        reserved_at: i64,
        bump: u8,
    ) -> Result<Self> {
        require!(booking_id != [0; 16], CoachPassError::NilBookingId);
        require!(
            scheduled_start_at > reserved_at,
            CoachPassError::InvalidBookingSchedule
        );
        require!(
            early_return_until <= scheduled_start_at,
            CoachPassError::InvalidEarlyReturnCutoff
        );

        Ok(Self {
            version: CREDIT_RESERVATION_VERSION,
            coach_client_credits,
            coach_authority,
            client_wallet,
            booking_id,
            scheduled_start_at,
            early_return_until,
            status: CreditReservationStatus::Reserved,
            reserved_at,
            resolved_at: None,
            bump,
            reserved: [0; 44],
        })
    }

    pub fn validate_return(
        &self,
        resolution_authority: Pubkey,
        current_coach_wallet: Pubkey,
        resolved_at: i64,
    ) -> Result<()> {
        self.require_active()?;

        if resolution_authority == self.client_wallet {
            require!(
                resolved_at <= self.early_return_until,
                CoachPassError::ClientReturnWindowClosed
            );
            return Ok(());
        }

        require_keys_eq!(
            resolution_authority,
            current_coach_wallet,
            CoachPassError::UnauthorizedReservationReturn
        );
        Ok(())
    }

    pub fn validate_consume(
        &self,
        coach_wallet: Pubkey,
        current_coach_wallet: Pubkey,
        resolved_at: i64,
    ) -> Result<()> {
        self.require_active()?;
        require_keys_eq!(
            coach_wallet,
            current_coach_wallet,
            CoachPassError::UnauthorizedReservationConsume
        );
        require!(
            resolved_at >= self.scheduled_start_at,
            CoachPassError::ReservationConsumeTooEarly
        );
        Ok(())
    }

    pub fn mark_returned(&mut self, resolved_at: i64) {
        self.status = CreditReservationStatus::Returned;
        self.resolved_at = Some(resolved_at);
    }

    pub fn mark_consumed(&mut self, resolved_at: i64) {
        self.status = CreditReservationStatus::Consumed;
        self.resolved_at = Some(resolved_at);
    }

    fn require_active(&self) -> Result<()> {
        require!(
            self.status == CreditReservationStatus::Reserved,
            CoachPassError::ReservationAlreadyResolved
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reservation() -> CreditReservation {
        CreditReservation::initialize(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            [7; 16],
            1_000,
            900,
            100,
            250,
        )
        .unwrap()
    }

    #[test]
    fn initialization_validates_booking_identity_and_times() {
        let ledger = Pubkey::new_unique();
        let coach = Pubkey::new_unique();
        let client = Pubkey::new_unique();

        assert!(CreditReservation::initialize(
            ledger, coach, client, [0; 16], 1_000, 900, 100, 250
        )
        .is_err());
        assert!(
            CreditReservation::initialize(ledger, coach, client, [1; 16], 100, 90, 100, 250)
                .is_err()
        );
        assert!(CreditReservation::initialize(
            ledger, coach, client, [1; 16], 1_000, 1_001, 100, 250
        )
        .is_err());
    }

    #[test]
    fn client_return_is_bounded_by_cutoff_and_coach_return_is_not() {
        let reservation = reservation();
        let coach_wallet = Pubkey::new_unique();

        assert!(reservation
            .validate_return(reservation.client_wallet, coach_wallet, 900)
            .is_ok());
        assert!(reservation
            .validate_return(reservation.client_wallet, coach_wallet, 901)
            .is_err());
        assert!(reservation
            .validate_return(coach_wallet, coach_wallet, 1_500)
            .is_ok());
        assert!(reservation
            .validate_return(Pubkey::new_unique(), coach_wallet, 100)
            .is_err());
    }

    #[test]
    fn coach_consume_requires_current_wallet_and_scheduled_start() {
        let reservation = reservation();
        let coach_wallet = Pubkey::new_unique();

        assert!(reservation
            .validate_consume(coach_wallet, coach_wallet, 999)
            .is_err());
        assert!(reservation
            .validate_consume(Pubkey::new_unique(), coach_wallet, 1_000)
            .is_err());
        assert!(reservation
            .validate_consume(coach_wallet, coach_wallet, 1_000)
            .is_ok());
    }

    #[test]
    fn terminal_status_prevents_a_second_resolution() {
        let mut returned = reservation();
        let coach_wallet = Pubkey::new_unique();
        returned.mark_returned(500);
        assert_eq!(returned.status, CreditReservationStatus::Returned);
        assert_eq!(returned.resolved_at, Some(500));
        assert!(returned
            .validate_return(coach_wallet, coach_wallet, 600)
            .is_err());
        assert!(returned
            .validate_consume(coach_wallet, coach_wallet, 1_000)
            .is_err());

        let mut consumed = reservation();
        consumed.mark_consumed(1_000);
        assert_eq!(consumed.status, CreditReservationStatus::Consumed);
        assert_eq!(consumed.resolved_at, Some(1_000));
    }

    #[test]
    fn allocated_account_space_is_fixed_and_includes_reserved_capacity() {
        assert_eq!(CreditReservation::INIT_SPACE, 192);
        assert_eq!(8 + CreditReservation::INIT_SPACE, 200);
    }
}
