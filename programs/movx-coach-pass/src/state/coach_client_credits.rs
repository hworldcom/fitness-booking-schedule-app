use anchor_lang::prelude::*;

use crate::{constants::COACH_CLIENT_CREDITS_VERSION, errors::CoachPassError};

#[derive(Debug, PartialEq, Eq)]
pub struct AppliedPurchase {
    pub purchase_nonce: u64,
    pub credits_purchased: u8,
    pub available_credits: u64,
    pub total_purchased: u64,
    pub purchase_count: u64,
}

#[account]
#[derive(InitSpace)]
pub struct CoachClientCredits {
    pub version: u8,
    pub coach_authority: Pubkey,
    pub client_wallet: Pubkey,
    pub available_credits: u64,
    pub reserved_credits: u64,
    pub total_purchased: u64,
    pub purchase_count: u64,
    pub next_purchase_nonce: u64,
    pub last_offer: Pubkey,
    pub last_purchase_at: i64,
    pub bump: u8,
    pub reserved: [u8; 46],
}

impl CoachClientCredits {
    pub fn initialize(coach_authority: Pubkey, client_wallet: Pubkey, bump: u8) -> Result<Self> {
        require!(
            coach_authority != Pubkey::default() && client_wallet != Pubkey::default(),
            CoachPassError::InvalidCreditLedgerAuthority
        );

        Ok(Self {
            version: COACH_CLIENT_CREDITS_VERSION,
            coach_authority,
            client_wallet,
            available_credits: 0,
            reserved_credits: 0,
            total_purchased: 0,
            purchase_count: 0,
            next_purchase_nonce: 0,
            last_offer: Pubkey::default(),
            last_purchase_at: 0,
            bump,
            reserved: [0; 46],
        })
    }

    pub fn apply_purchase(
        &mut self,
        offer: Pubkey,
        credits_purchased: u8,
        expected_nonce: u64,
        purchased_at: i64,
    ) -> Result<AppliedPurchase> {
        require!(
            expected_nonce == self.next_purchase_nonce,
            CoachPassError::UnexpectedPurchaseNonce
        );

        let purchased = u64::from(credits_purchased);
        let available_credits = self
            .available_credits
            .checked_add(purchased)
            .ok_or(CoachPassError::AvailableCreditsOverflow)?;
        let total_purchased = self
            .total_purchased
            .checked_add(purchased)
            .ok_or(CoachPassError::TotalPurchasedOverflow)?;
        let purchase_count = self
            .purchase_count
            .checked_add(1)
            .ok_or(CoachPassError::PurchaseCountOverflow)?;
        let next_purchase_nonce = self
            .next_purchase_nonce
            .checked_add(1)
            .ok_or(CoachPassError::PurchaseNonceOverflow)?;

        self.available_credits = available_credits;
        self.total_purchased = total_purchased;
        self.purchase_count = purchase_count;
        self.next_purchase_nonce = next_purchase_nonce;
        self.last_offer = offer;
        self.last_purchase_at = purchased_at;

        Ok(AppliedPurchase {
            purchase_nonce: expected_nonce,
            credits_purchased,
            available_credits,
            total_purchased,
            purchase_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_and_later_purchases_accumulate_in_one_ledger() {
        let coach = Pubkey::new_unique();
        let client = Pubkey::new_unique();
        let first_offer = Pubkey::new_unique();
        let second_offer = Pubkey::new_unique();
        let mut credits = CoachClientCredits::initialize(coach, client, 250).unwrap();

        let first = credits
            .apply_purchase(first_offer, 1, 0, 1_800_000_000)
            .unwrap();
        let second = credits
            .apply_purchase(second_offer, 10, 1, 1_800_000_100)
            .unwrap();

        assert_eq!(first.purchase_nonce, 0);
        assert_eq!(first.available_credits, 1);
        assert_eq!(second.purchase_nonce, 1);
        assert_eq!(credits.available_credits, 11);
        assert_eq!(credits.reserved_credits, 0);
        assert_eq!(credits.total_purchased, 11);
        assert_eq!(credits.purchase_count, 2);
        assert_eq!(credits.next_purchase_nonce, 2);
        assert_eq!(credits.last_offer, second_offer);
        assert_eq!(credits.last_purchase_at, 1_800_000_100);
    }

    #[test]
    fn replay_and_overflow_fail_without_partial_mutation() {
        let mut credits =
            CoachClientCredits::initialize(Pubkey::new_unique(), Pubkey::new_unique(), 250)
                .unwrap();
        credits
            .apply_purchase(Pubkey::new_unique(), 1, 0, 10)
            .unwrap();
        let snapshot = (
            credits.available_credits,
            credits.total_purchased,
            credits.purchase_count,
            credits.next_purchase_nonce,
        );

        assert!(credits
            .apply_purchase(Pubkey::new_unique(), 10, 0, 20)
            .is_err());
        assert_eq!(
            snapshot,
            (
                credits.available_credits,
                credits.total_purchased,
                credits.purchase_count,
                credits.next_purchase_nonce,
            )
        );

        credits.available_credits = u64::MAX;
        credits.total_purchased = u64::MAX;
        assert!(credits
            .apply_purchase(Pubkey::new_unique(), 1, 1, 30)
            .is_err());
        assert_eq!(credits.available_credits, u64::MAX);
        assert_eq!(credits.total_purchased, u64::MAX);
        assert_eq!(credits.next_purchase_nonce, 1);
    }

    #[test]
    fn allocated_account_space_is_fixed_and_includes_reserved_capacity() {
        assert_eq!(CoachClientCredits::INIT_SPACE, 192);
        assert_eq!(8 + CoachClientCredits::INIT_SPACE, 200);
    }
}
