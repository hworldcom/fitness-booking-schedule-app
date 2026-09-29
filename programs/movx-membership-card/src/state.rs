use anchor_lang::prelude::*;

use crate::errors::MembershipCardError;

pub const MEMBERSHIP_LINEAGE_SEED: &[u8] = b"membership_card";
pub const MEMBERSHIP_ASSET_SEED: &[u8] = b"membership_asset";
pub const INITIAL_ASSET_GENERATION: u32 = 0;
pub const INITIAL_ASSET_GENERATION_BYTES: [u8; 4] = INITIAL_ASSET_GENERATION.to_le_bytes();
pub const MEMBERSHIP_CARD_SCHEMA_VERSION: u8 = 1;
pub const MAX_METADATA_URI_LENGTH: usize = 200;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum ProjectionStatus {
    Active,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace, PartialEq, Eq)]
pub enum MembershipPlan {
    Basic,
    Classic,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProjectionInput {
    pub period_projection_id: [u8; 32],
    pub status: ProjectionStatus,
    pub plan: MembershipPlan,
    pub valid_from: i64,
    pub valid_until: i64,
    pub included_total: u16,
    pub used: u16,
    pub remaining: u16,
}

impl ProjectionInput {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.period_projection_id != [0; 32],
            MembershipCardError::InvalidPeriodProjectionId
        );
        require!(
            self.valid_until > self.valid_from,
            MembershipCardError::InvalidValidityRange
        );

        match self.plan {
            MembershipPlan::Basic => {
                let expected_remaining = self
                    .included_total
                    .checked_sub(self.used)
                    .ok_or(MembershipCardError::InvalidBasicAllowance)?;
                require!(
                    self.included_total > 0 && self.remaining == expected_remaining,
                    MembershipCardError::InvalidBasicAllowance
                );
            }
            MembershipPlan::Classic => {
                require!(
                    self.included_total == 0 && self.used == 0 && self.remaining == 0,
                    MembershipCardError::InvalidClassicAllowance
                );
            }
        }

        Ok(())
    }

    pub fn active_asset_name(&self) -> String {
        match self.plan {
            MembershipPlan::Basic => "MovX Basic Membership".to_owned(),
            MembershipPlan::Classic => "MovX Classic Membership".to_owned(),
        }
    }
}

pub fn validate_metadata_uri(uri: &str) -> Result<()> {
    require!(
        uri.starts_with("https://") && uri.len() <= MAX_METADATA_URI_LENGTH,
        MembershipCardError::InvalidMetadataUri
    );
    Ok(())
}

#[account]
#[derive(InitSpace)]
pub struct MembershipCard {
    pub schema_version: u8,
    pub bump: u8,
    pub lineage_id: [u8; 32],
    pub operator_authority: Pubkey,
    pub current_member_wallet: Pubkey,
    pub current_asset: Pubkey,
    pub current_period_projection_id: [u8; 32],
    pub generation: u32,
    pub projection_version: u64,
    pub status: ProjectionStatus,
    pub plan: MembershipPlan,
    pub valid_from: i64,
    pub valid_until: i64,
    pub included_total: u16,
    pub used: u16,
    pub remaining: u16,
    pub reserved: [u8; 32],
}

impl MembershipCard {
    pub fn initialize(
        &mut self,
        bump: u8,
        lineage_id: [u8; 32],
        operator_authority: Pubkey,
        member_wallet: Pubkey,
        asset: Pubkey,
        projection: &ProjectionInput,
    ) -> Result<()> {
        require!(lineage_id != [0; 32], MembershipCardError::InvalidLineageId);
        projection.validate()?;

        self.schema_version = MEMBERSHIP_CARD_SCHEMA_VERSION;
        self.bump = bump;
        self.lineage_id = lineage_id;
        self.operator_authority = operator_authority;
        self.current_member_wallet = member_wallet;
        self.current_asset = asset;
        self.generation = INITIAL_ASSET_GENERATION;
        self.projection_version = 1;
        self.reserved = [0; 32];
        self.apply_projection(projection);
        Ok(())
    }

    pub fn update_same_wallet_period(
        &mut self,
        expected_projection_version: u64,
        expected_generation: u32,
        projection: &ProjectionInput,
    ) -> Result<()> {
        self.validate_same_wallet_update(
            expected_projection_version,
            expected_generation,
            projection,
        )?;

        self.projection_version = self
            .projection_version
            .checked_add(1)
            .ok_or(MembershipCardError::ArithmeticOverflow)?;
        self.apply_projection(projection);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn replace_wallet(
        &mut self,
        expected_projection_version: u64,
        expected_generation: u32,
        new_generation: u32,
        new_member_wallet: Pubkey,
        new_asset: Pubkey,
        projection: &ProjectionInput,
    ) -> Result<()> {
        self.validate_replacement(
            expected_projection_version,
            expected_generation,
            new_generation,
            new_member_wallet,
            projection,
        )?;

        let next_generation = self
            .generation
            .checked_add(1)
            .ok_or(MembershipCardError::ArithmeticOverflow)?;

        self.current_member_wallet = new_member_wallet;
        self.current_asset = new_asset;
        self.generation = next_generation;
        self.projection_version = self
            .projection_version
            .checked_add(1)
            .ok_or(MembershipCardError::ArithmeticOverflow)?;
        self.apply_projection(projection);
        Ok(())
    }

    pub fn assert_current(&self, asset: Pubkey, expected_generation: u32) -> Result<()> {
        self.assert_current_asset(asset, expected_generation)?;
        require!(
            self.status == ProjectionStatus::Active,
            MembershipCardError::ProjectionNotActive
        );
        Ok(())
    }

    pub fn assert_current_asset(&self, asset: Pubkey, expected_generation: u32) -> Result<()> {
        require_keys_eq!(
            asset,
            self.current_asset,
            MembershipCardError::AssetNotCurrent
        );
        require_eq!(
            expected_generation,
            self.generation,
            MembershipCardError::StaleAssetGeneration
        );
        Ok(())
    }

    pub fn validate_same_wallet_update(
        &self,
        expected_projection_version: u64,
        expected_generation: u32,
        projection: &ProjectionInput,
    ) -> Result<()> {
        self.assert_transition_version(expected_projection_version, expected_generation)?;
        projection.validate()?;

        if projection.period_projection_id != self.current_period_projection_id {
            require!(
                projection.valid_from >= self.valid_until,
                MembershipCardError::OverlappingPeriod
            );
        }
        Ok(())
    }

    pub fn validate_replacement(
        &self,
        expected_projection_version: u64,
        expected_generation: u32,
        new_generation: u32,
        new_member_wallet: Pubkey,
        projection: &ProjectionInput,
    ) -> Result<()> {
        self.assert_transition_version(expected_projection_version, expected_generation)?;
        projection.validate()?;
        require!(
            new_member_wallet != self.current_member_wallet,
            MembershipCardError::ReplacementWalletUnchanged
        );

        let next_generation = self
            .generation
            .checked_add(1)
            .ok_or(MembershipCardError::ArithmeticOverflow)?;
        require_eq!(
            new_generation,
            next_generation,
            MembershipCardError::StaleAssetGeneration
        );
        Ok(())
    }

    fn assert_transition_version(
        &self,
        expected_projection_version: u64,
        expected_generation: u32,
    ) -> Result<()> {
        require_eq!(
            expected_projection_version,
            self.projection_version,
            MembershipCardError::StaleProjectionVersion
        );
        require_eq!(
            expected_generation,
            self.generation,
            MembershipCardError::StaleAssetGeneration
        );
        Ok(())
    }

    fn apply_projection(&mut self, projection: &ProjectionInput) {
        self.current_period_projection_id = projection.period_projection_id;
        self.status = projection.status;
        self.plan = projection.plan;
        self.valid_from = projection.valid_from;
        self.valid_until = projection.valid_until;
        self.included_total = projection.included_total;
        self.used = projection.used;
        self.remaining = projection.remaining;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pubkey(value: u8) -> Pubkey {
        Pubkey::new_from_array([value; 32])
    }

    fn basic_projection(period: u8, valid_from: i64, valid_until: i64) -> ProjectionInput {
        ProjectionInput {
            period_projection_id: [period; 32],
            status: ProjectionStatus::Active,
            plan: MembershipPlan::Basic,
            valid_from,
            valid_until,
            included_total: 10,
            used: 3,
            remaining: 7,
        }
    }

    fn initialized_card() -> MembershipCard {
        let mut card = MembershipCard {
            schema_version: 0,
            bump: 0,
            lineage_id: [0; 32],
            operator_authority: Pubkey::default(),
            current_member_wallet: Pubkey::default(),
            current_asset: Pubkey::default(),
            current_period_projection_id: [0; 32],
            generation: 0,
            projection_version: 0,
            status: ProjectionStatus::Expired,
            plan: MembershipPlan::Basic,
            valid_from: 0,
            valid_until: 0,
            included_total: 0,
            used: 0,
            remaining: 0,
            reserved: [0; 32],
        };
        card.initialize(
            254,
            [9; 32],
            pubkey(1),
            pubkey(2),
            pubkey(3),
            &basic_projection(4, 100, 200),
        )
        .unwrap();
        card
    }

    #[test]
    fn same_wallet_period_reuses_asset_and_generation() {
        let mut card = initialized_card();
        let original_wallet = card.current_member_wallet;
        let original_asset = card.current_asset;

        card.update_same_wallet_period(1, 0, &basic_projection(5, 200, 300))
            .unwrap();

        assert_eq!(card.current_member_wallet, original_wallet);
        assert_eq!(card.current_asset, original_asset);
        assert_eq!(card.generation, 0);
        assert_eq!(card.projection_version, 2);
        assert_eq!(card.current_period_projection_id, [5; 32]);
    }

    #[test]
    fn overlapping_new_period_is_rejected() {
        let mut card = initialized_card();
        let result = card.update_same_wallet_period(1, 0, &basic_projection(5, 199, 300));
        assert!(result.is_err());
        assert_eq!(card.projection_version, 1);
    }

    #[test]
    fn replacement_advances_once_and_replay_is_rejected() {
        let mut card = initialized_card();
        let replacement_projection = basic_projection(4, 100, 200);

        card.replace_wallet(1, 0, 1, pubkey(6), pubkey(7), &replacement_projection)
            .unwrap();

        assert_eq!(card.current_member_wallet, pubkey(6));
        assert_eq!(card.current_asset, pubkey(7));
        assert_eq!(card.generation, 1);
        assert_eq!(card.projection_version, 2);

        let replay = card.replace_wallet(1, 0, 1, pubkey(8), pubkey(9), &replacement_projection);
        assert!(replay.is_err());
        assert_eq!(card.current_asset, pubkey(7));
    }

    #[test]
    fn expired_projection_is_not_current() {
        let mut card = initialized_card();
        card.status = ProjectionStatus::Expired;
        assert!(card.assert_current(pubkey(3), 0).is_err());
    }

    #[test]
    fn expired_lineage_can_reactivate_on_a_later_same_wallet_period() {
        let mut card = initialized_card();
        card.status = ProjectionStatus::Expired;

        card.update_same_wallet_period(1, 0, &basic_projection(5, 200, 300))
            .unwrap();

        assert_eq!(card.status, ProjectionStatus::Active);
        assert_eq!(card.current_asset, pubkey(3));
        assert_eq!(card.generation, 0);
    }

    #[test]
    fn invalid_allowance_shapes_are_rejected() {
        let invalid_basic = ProjectionInput {
            remaining: 8,
            ..basic_projection(4, 100, 200)
        };
        assert!(invalid_basic.validate().is_err());

        let invalid_classic = ProjectionInput {
            plan: MembershipPlan::Classic,
            included_total: 10,
            used: 0,
            remaining: 10,
            ..basic_projection(4, 100, 200)
        };
        assert!(invalid_classic.validate().is_err());
    }
}
