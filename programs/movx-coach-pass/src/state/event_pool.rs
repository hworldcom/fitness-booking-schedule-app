use anchor_lang::prelude::*;

use crate::{
    constants::{
        EVENT_POOL_VERSION, MAX_EVENT_DURATION_SECONDS, MAX_EVENT_LEAD_SECONDS,
        MAX_EVENT_PARTICIPANTS, MAX_EVENT_PRICE_EURC_BASE_UNITS, MIN_EVENT_DURATION_SECONDS,
        MIN_EVENT_PARTICIPANTS,
    },
    errors::CoachPassError,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum EventPoolStatus {
    Funding,
    Succeeded,
    Paid,
    Failed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct CreateEventPoolArgs {
    pub nonce: u64,
    pub price_eurc_base_units: u64,
    pub minimum_participants: u16,
    pub maximum_participants: u16,
    pub funding_deadline: i64,
    pub event_start_at: i64,
    pub event_end_at: i64,
}

#[derive(Debug, PartialEq, Eq)]
pub struct FundingTotals {
    pub participant_count: u16,
    pub total_funded_base_units: u64,
}

#[account]
#[derive(InitSpace)]
pub struct EventPool {
    pub version: u8,
    pub coach_authority: Pubkey,
    pub payout_recipient: Pubkey,
    pub payment_mint: Pubkey,
    pub vault: Pubkey,
    pub nonce: u64,
    pub price_eurc_base_units: u64,
    pub minimum_participants: u16,
    pub maximum_participants: u16,
    pub participant_count: u16,
    pub total_funded_base_units: u64,
    pub total_refunded_base_units: u64,
    pub funding_deadline: i64,
    pub event_start_at: i64,
    pub event_end_at: i64,
    pub created_at: i64,
    pub status: EventPoolStatus,
    pub settled_at: Option<i64>,
    pub paid_at: Option<i64>,
    pub bump: u8,
    pub vault_bump: u8,
    pub reserved: [u8; 64],
}

impl EventPool {
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        coach_authority: Pubkey,
        payout_recipient: Pubkey,
        payment_mint: Pubkey,
        vault: Pubkey,
        args: CreateEventPoolArgs,
        created_at: i64,
        bump: u8,
        vault_bump: u8,
    ) -> Result<Self> {
        require!(
            coach_authority != Pubkey::default(),
            CoachPassError::InvalidEventCoachAuthority
        );
        require!(
            payout_recipient != Pubkey::default(),
            CoachPassError::InvalidEventPayoutRecipient
        );
        require!(
            payment_mint != Pubkey::default() && vault != Pubkey::default(),
            CoachPassError::InvalidEventVault
        );
        require!(
            (1..=MAX_EVENT_PRICE_EURC_BASE_UNITS).contains(&args.price_eurc_base_units),
            CoachPassError::InvalidEventPrice
        );
        require!(
            (MIN_EVENT_PARTICIPANTS..=MAX_EVENT_PARTICIPANTS).contains(&args.minimum_participants),
            CoachPassError::InvalidEventCapacity
        );
        require!(
            args.maximum_participants >= args.minimum_participants
                && args.maximum_participants <= MAX_EVENT_PARTICIPANTS,
            CoachPassError::InvalidEventCapacity
        );
        args.price_eurc_base_units
            .checked_mul(u64::from(args.maximum_participants))
            .ok_or(CoachPassError::EventFundingOverflow)?;
        require!(
            args.funding_deadline > created_at && args.funding_deadline < args.event_start_at,
            CoachPassError::InvalidEventFundingDeadline
        );

        let lead_seconds = args
            .event_start_at
            .checked_sub(created_at)
            .ok_or(CoachPassError::InvalidEventSchedule)?;
        require!(
            lead_seconds <= MAX_EVENT_LEAD_SECONDS,
            CoachPassError::InvalidEventSchedule
        );
        let duration_seconds = args
            .event_end_at
            .checked_sub(args.event_start_at)
            .ok_or(CoachPassError::InvalidEventSchedule)?;
        require!(
            (MIN_EVENT_DURATION_SECONDS..=MAX_EVENT_DURATION_SECONDS).contains(&duration_seconds),
            CoachPassError::InvalidEventSchedule
        );

        Ok(Self {
            version: EVENT_POOL_VERSION,
            coach_authority,
            payout_recipient,
            payment_mint,
            vault,
            nonce: args.nonce,
            price_eurc_base_units: args.price_eurc_base_units,
            minimum_participants: args.minimum_participants,
            maximum_participants: args.maximum_participants,
            participant_count: 0,
            total_funded_base_units: 0,
            total_refunded_base_units: 0,
            funding_deadline: args.funding_deadline,
            event_start_at: args.event_start_at,
            event_end_at: args.event_end_at,
            created_at,
            status: EventPoolStatus::Funding,
            settled_at: None,
            paid_at: None,
            bump,
            vault_bump,
            reserved: [0; 64],
        })
    }

    pub fn prepare_funding(&self, funded_at: i64) -> Result<FundingTotals> {
        require!(
            self.status == EventPoolStatus::Funding,
            CoachPassError::EventPoolNotFunding
        );
        require!(
            funded_at < self.funding_deadline,
            CoachPassError::EventFundingClosed
        );
        require!(
            self.participant_count < self.maximum_participants,
            CoachPassError::EventPoolFull
        );

        Ok(FundingTotals {
            participant_count: self
                .participant_count
                .checked_add(1)
                .ok_or(CoachPassError::EventParticipantCountOverflow)?,
            total_funded_base_units: self
                .total_funded_base_units
                .checked_add(self.price_eurc_base_units)
                .ok_or(CoachPassError::EventFundingOverflow)?,
        })
    }

    pub fn apply_funding(&mut self, totals: FundingTotals) {
        self.participant_count = totals.participant_count;
        self.total_funded_base_units = totals.total_funded_base_units;
    }

    pub fn settle(&mut self, settled_at: i64) -> Result<EventPoolStatus> {
        require!(
            self.status == EventPoolStatus::Funding,
            CoachPassError::EventPoolAlreadySettled
        );
        require!(
            settled_at >= self.funding_deadline,
            CoachPassError::EventSettlementTooEarly
        );

        self.status = if self.participant_count >= self.minimum_participants {
            EventPoolStatus::Succeeded
        } else {
            EventPoolStatus::Failed
        };
        self.settled_at = Some(settled_at);
        Ok(self.status)
    }

    pub fn validate_payout(&self, vault_balance: u64) -> Result<u64> {
        require!(
            self.status == EventPoolStatus::Succeeded,
            CoachPassError::EventPayoutUnavailable
        );
        require!(
            vault_balance >= self.total_funded_base_units,
            CoachPassError::EventVaultUnderfunded
        );
        Ok(self.total_funded_base_units)
    }

    pub fn mark_paid(&mut self, paid_at: i64) {
        self.status = EventPoolStatus::Paid;
        self.paid_at = Some(paid_at);
    }

    pub fn prepare_refund(&self, amount: u64, vault_balance: u64) -> Result<u64> {
        require!(
            self.status == EventPoolStatus::Failed,
            CoachPassError::EventRefundUnavailable
        );
        require!(
            vault_balance >= amount,
            CoachPassError::EventVaultUnderfunded
        );
        let total_refunded_base_units = self
            .total_refunded_base_units
            .checked_add(amount)
            .ok_or(CoachPassError::EventRefundOverflow)?;
        require!(
            total_refunded_base_units <= self.total_funded_base_units,
            CoachPassError::EventRefundOverflow
        );
        Ok(total_refunded_base_units)
    }

    pub fn apply_refund(&mut self, total_refunded_base_units: u64) {
        self.total_refunded_base_units = total_refunded_base_units;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_args() -> CreateEventPoolArgs {
        CreateEventPoolArgs {
            nonce: 4,
            price_eurc_base_units: 30_000_000,
            minimum_participants: 3,
            maximum_participants: 6,
            funding_deadline: 2_000,
            event_start_at: 3_000,
            event_end_at: 6_600,
        }
    }

    fn pool() -> EventPool {
        EventPool::initialize(
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            valid_args(),
            1_000,
            250,
            249,
        )
        .unwrap()
    }

    #[test]
    fn creation_freezes_bounded_terms() {
        let pool = pool();
        assert_eq!(pool.status, EventPoolStatus::Funding);
        assert_eq!(pool.price_eurc_base_units, 30_000_000);
        assert_eq!(pool.minimum_participants, 3);
        assert_eq!(pool.maximum_participants, 6);
        assert_eq!(pool.bump, 250);
        assert_eq!(pool.vault_bump, 249);
    }

    #[test]
    fn creation_rejects_invalid_price_capacity_and_time_bounds() {
        let keys = || {
            (
                Pubkey::new_unique(),
                Pubkey::new_unique(),
                Pubkey::new_unique(),
                Pubkey::new_unique(),
            )
        };
        let mut args = valid_args();
        args.price_eurc_base_units = 0;
        let (coach, recipient, mint, vault) = keys();
        assert!(EventPool::initialize(coach, recipient, mint, vault, args, 1_000, 1, 2).is_err());

        args = valid_args();
        args.minimum_participants = 1;
        let (coach, recipient, mint, vault) = keys();
        assert!(EventPool::initialize(coach, recipient, mint, vault, args, 1_000, 1, 2).is_err());

        args = valid_args();
        args.funding_deadline = args.event_start_at;
        let (coach, recipient, mint, vault) = keys();
        assert!(EventPool::initialize(coach, recipient, mint, vault, args, 1_000, 1, 2).is_err());

        args = valid_args();
        args.event_end_at = args.event_start_at + MIN_EVENT_DURATION_SECONDS - 1;
        let (coach, recipient, mint, vault) = keys();
        assert!(EventPool::initialize(coach, recipient, mint, vault, args, 1_000, 1, 2).is_err());
    }

    #[test]
    fn funding_and_settlement_are_checked_and_terminal() {
        let mut pool = pool();
        for _ in 0..3 {
            let totals = pool.prepare_funding(1_500).unwrap();
            pool.apply_funding(totals);
        }
        assert_eq!(pool.participant_count, 3);
        assert_eq!(pool.total_funded_base_units, 90_000_000);
        assert!(pool.settle(1_999).is_err());
        assert_eq!(pool.settle(2_000).unwrap(), EventPoolStatus::Succeeded);
        assert!(pool.settle(2_001).is_err());
        assert!(pool.prepare_funding(1_500).is_err());
    }

    #[test]
    fn failed_pool_refunds_recorded_liabilities_not_donations() {
        let mut pool = pool();
        let totals = pool.prepare_funding(1_500).unwrap();
        pool.apply_funding(totals);
        assert_eq!(pool.settle(2_000).unwrap(), EventPoolStatus::Failed);

        let refunded = pool.prepare_refund(30_000_000, 31_000_000).unwrap();
        pool.apply_refund(refunded);
        assert_eq!(pool.total_refunded_base_units, 30_000_000);
        assert!(pool.prepare_refund(30_000_000, 1_000_000).is_err());
    }

    #[test]
    fn successful_payout_ignores_unsolicited_surplus_and_is_once_only() {
        let mut pool = pool();
        for _ in 0..3 {
            let totals = pool.prepare_funding(1_500).unwrap();
            pool.apply_funding(totals);
        }
        pool.settle(2_000).unwrap();
        assert_eq!(pool.validate_payout(91_000_000).unwrap(), 90_000_000);
        pool.mark_paid(2_001);
        assert!(pool.validate_payout(1_000_000).is_err());
    }

    #[test]
    fn allocated_account_space_is_fixed_and_includes_reserved_capacity() {
        assert_eq!(EventPool::INIT_SPACE, 284);
        assert_eq!(8 + EventPool::INIT_SPACE, 292);
    }
}
