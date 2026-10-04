use anchor_lang::prelude::*;

use crate::{constants::CONTRIBUTION_VERSION, errors::CoachPassError};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum ContributionStatus {
    Funded,
    Refunded,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub version: u8,
    pub event_pool: Pubkey,
    pub participant_wallet: Pubkey,
    pub amount_eurc_base_units: u64,
    pub status: ContributionStatus,
    pub funded_at: i64,
    pub refunded_at: Option<i64>,
    pub bump: u8,
    pub reserved: [u8; 36],
}

impl Contribution {
    pub fn initialize(
        event_pool: Pubkey,
        participant_wallet: Pubkey,
        amount_eurc_base_units: u64,
        funded_at: i64,
        bump: u8,
    ) -> Result<Self> {
        require!(
            event_pool != Pubkey::default() && participant_wallet != Pubkey::default(),
            CoachPassError::InvalidContributionAuthority
        );
        require!(
            amount_eurc_base_units > 0,
            CoachPassError::InvalidEventPrice
        );

        Ok(Self {
            version: CONTRIBUTION_VERSION,
            event_pool,
            participant_wallet,
            amount_eurc_base_units,
            status: ContributionStatus::Funded,
            funded_at,
            refunded_at: None,
            bump,
            reserved: [0; 36],
        })
    }

    pub fn validate_refund(&self, participant_wallet: Pubkey) -> Result<()> {
        require!(
            self.status == ContributionStatus::Funded,
            CoachPassError::ContributionAlreadyRefunded
        );
        require_keys_eq!(
            participant_wallet,
            self.participant_wallet,
            CoachPassError::UnauthorizedContributionRefund
        );
        Ok(())
    }

    pub fn mark_refunded(&mut self, refunded_at: i64) {
        self.status = ContributionStatus::Refunded;
        self.refunded_at = Some(refunded_at);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contribution_binds_one_participant_and_refunds_once() {
        let pool = Pubkey::new_unique();
        let participant = Pubkey::new_unique();
        let mut contribution =
            Contribution::initialize(pool, participant, 30_000_000, 1_000, 250).unwrap();

        assert!(contribution.validate_refund(participant).is_ok());
        assert!(contribution.validate_refund(Pubkey::new_unique()).is_err());
        contribution.mark_refunded(2_000);
        assert_eq!(contribution.status, ContributionStatus::Refunded);
        assert_eq!(contribution.refunded_at, Some(2_000));
        assert!(contribution.validate_refund(participant).is_err());
    }

    #[test]
    fn initialization_rejects_invalid_relationships_and_amounts() {
        let pool = Pubkey::new_unique();
        let participant = Pubkey::new_unique();
        assert!(Contribution::initialize(Pubkey::default(), participant, 1, 1_000, 250).is_err());
        assert!(Contribution::initialize(pool, Pubkey::default(), 1, 1_000, 250).is_err());
        assert!(Contribution::initialize(pool, participant, 0, 1_000, 250).is_err());
    }

    #[test]
    fn allocated_account_space_is_fixed_and_includes_reserved_capacity() {
        assert_eq!(Contribution::INIT_SPACE, 128);
        assert_eq!(8 + Contribution::INIT_SPACE, 136);
    }
}
