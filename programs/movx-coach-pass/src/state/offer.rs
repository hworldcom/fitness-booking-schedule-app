use anchor_lang::prelude::*;

use crate::{
    constants::{DEVNET_USDC_MINT, MAX_VALIDITY_SECONDS, MIN_VALIDITY_SECONDS, NO_EXPIRY},
    errors::CoachPassError,
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum OfferStatus {
    Active,
    Deactivated,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct CreateOfferArgs {
    pub nonce: u64,
    pub price_usdc_base_units: u64,
    pub session_count: u8,
    pub validity_seconds: u32,
    pub restricted_client: Option<Pubkey>,
}

impl CreateOfferArgs {
    pub fn validate(&self) -> Result<()> {
        require!(
            matches!(self.session_count, 1 | 10),
            CoachPassError::UnsupportedSessionCount
        );
        require!(self.price_usdc_base_units > 0, CoachPassError::InvalidPrice);
        require!(
            self.validity_seconds == NO_EXPIRY
                || (MIN_VALIDITY_SECONDS..=MAX_VALIDITY_SECONDS).contains(&self.validity_seconds),
            CoachPassError::InvalidValidity
        );
        require!(
            self.restricted_client != Some(Pubkey::default()),
            CoachPassError::InvalidRestrictedClient
        );
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub coach_authority: Pubkey,
    pub payment_recipient: Pubkey,
    pub payment_mint: Pubkey,
    pub nonce: u64,
    pub price_usdc_base_units: u64,
    pub authority_epoch: u64,
    pub created_at: i64,
    pub validity_seconds: u32,
    pub session_count: u8,
    pub status: OfferStatus,
    pub bump: u8,
    pub reserved: [u8; 47],
    pub restricted_client: Option<Pubkey>,
    pub deactivated_at: Option<i64>,
}

impl Offer {
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        coach_authority: Pubkey,
        coach_wallet: Pubkey,
        authority_epoch: u64,
        args: CreateOfferArgs,
        created_at: i64,
        bump: u8,
    ) -> Result<Self> {
        args.validate()?;

        Ok(Self {
            coach_authority,
            payment_recipient: coach_wallet,
            payment_mint: DEVNET_USDC_MINT,
            nonce: args.nonce,
            price_usdc_base_units: args.price_usdc_base_units,
            authority_epoch,
            created_at,
            validity_seconds: args.validity_seconds,
            session_count: args.session_count,
            status: OfferStatus::Active,
            bump,
            reserved: [0; 47],
            restricted_client: args.restricted_client,
            deactivated_at: None,
        })
    }

    pub fn deactivate(&mut self, deactivated_at: i64) -> Result<()> {
        require!(
            self.status == OfferStatus::Active,
            CoachPassError::OfferAlreadyDeactivated
        );
        self.status = OfferStatus::Deactivated;
        self.deactivated_at = Some(deactivated_at);
        Ok(())
    }

    pub fn is_purchase_eligible(&self, authority: &super::CoachAuthority) -> bool {
        self.status == OfferStatus::Active
            && self.coach_authority
                == Pubkey::find_program_address(
                    &[
                        crate::constants::COACH_AUTHORITY_SEED,
                        &authority.run_id,
                        &authority.profile_id,
                        authority.original_wallet.as_ref(),
                    ],
                    &crate::ID,
                )
                .0
            && self.authority_epoch == authority.authority_epoch
            && self.payment_recipient == authority.current_wallet
            && self.payment_mint == DEVNET_USDC_MINT
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::CoachAuthority;

    fn args(session_count: u8, validity_seconds: u32) -> CreateOfferArgs {
        CreateOfferArgs {
            nonce: 7,
            price_usdc_base_units: 2_000_000,
            session_count,
            validity_seconds,
            restricted_client: None,
        }
    }

    fn authority() -> (Pubkey, CoachAuthority) {
        let coach = Pubkey::new_unique();
        let recovery = Pubkey::new_unique();
        let run_id = [1; 16];
        let profile_id = [2; 16];
        let (address, bump) = Pubkey::find_program_address(
            &[
                crate::constants::COACH_AUTHORITY_SEED,
                &run_id,
                &profile_id,
                coach.as_ref(),
            ],
            &crate::ID,
        );
        (
            address,
            CoachAuthority::initialize(run_id, profile_id, coach, recovery, bump).unwrap(),
        )
    }

    #[test]
    fn accepts_one_or_ten_sessions_and_bounded_or_no_expiry_validity() {
        assert!(args(1, NO_EXPIRY).validate().is_ok());
        assert!(args(10, MIN_VALIDITY_SECONDS).validate().is_ok());
        assert!(args(10, MAX_VALIDITY_SECONDS).validate().is_ok());
    }

    #[test]
    fn rejects_unsupported_sessions_price_validity_and_default_restriction() {
        assert!(args(2, MIN_VALIDITY_SECONDS).validate().is_err());

        let mut invalid = args(1, MIN_VALIDITY_SECONDS);
        invalid.price_usdc_base_units = 0;
        assert!(invalid.validate().is_err());

        assert!(args(1, MIN_VALIDITY_SECONDS - 1).validate().is_err());
        assert!(args(1, MAX_VALIDITY_SECONDS + 1).validate().is_err());

        let mut invalid = args(1, NO_EXPIRY);
        invalid.restricted_client = Some(Pubkey::default());
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn offer_terms_are_immutable_and_deactivation_is_one_way() {
        let (authority_address, authority) = authority();
        let mut offer = Offer::initialize(
            authority_address,
            authority.current_wallet,
            authority.authority_epoch,
            args(10, 90 * 24 * 60 * 60),
            1_800_000_000,
            253,
        )
        .unwrap();

        assert_eq!(offer.payment_recipient, authority.current_wallet);
        assert_eq!(offer.payment_mint, DEVNET_USDC_MINT);
        assert_eq!(offer.status, OfferStatus::Active);
        assert!(offer.is_purchase_eligible(&authority));

        offer.deactivate(1_800_000_100).unwrap();
        assert_eq!(offer.status, OfferStatus::Deactivated);
        assert_eq!(offer.deactivated_at, Some(1_800_000_100));
        assert!(!offer.is_purchase_eligible(&authority));
        assert!(offer.deactivate(1_800_000_200).is_err());
    }

    #[test]
    fn wallet_rotation_invalidates_old_recipient_offer_without_mutating_it() {
        let (authority_address, mut authority) = authority();
        let original_wallet = authority.current_wallet;
        let offer = Offer::initialize(
            authority_address,
            original_wallet,
            authority.authority_epoch,
            args(1, NO_EXPIRY),
            1_800_000_000,
            253,
        )
        .unwrap();

        authority.rotate(Pubkey::new_unique()).unwrap();

        assert_eq!(offer.payment_recipient, original_wallet);
        assert_eq!(offer.authority_epoch, 0);
        assert!(!offer.is_purchase_eligible(&authority));
    }

    #[test]
    fn allocated_account_space_includes_discriminator_and_reserved_capacity() {
        assert_eq!(CoachAuthority::INIT_SPACE, 192);
        assert_eq!(Offer::INIT_SPACE, 224);
        assert_eq!(8 + CoachAuthority::INIT_SPACE, 200);
        assert_eq!(8 + Offer::INIT_SPACE, 232);
    }
}
