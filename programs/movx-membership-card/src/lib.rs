use anchor_lang::prelude::*;

mod core_asset;
mod errors;
mod state;

use core_asset::{
    assert_frozen_membership_asset, create_frozen_asset, update_asset_metadata,
    INACTIVE_ASSET_NAME, MPL_CORE_ID,
};
use errors::MembershipCardError;
pub use state::*;

declare_id!("GEUMk7SoYEsAvTgbFxohHTPbDfdX1citFT6Xxr6E4ULr");

#[program]
pub mod movx_membership_card {
    use super::*;

    pub fn initialize_membership_card(
        ctx: Context<InitializeMembershipCard>,
        args: InitializeMembershipCardArgs,
    ) -> Result<()> {
        args.projection.validate()?;
        validate_metadata_uri(&args.metadata_uri)?;

        let lineage_info = ctx.accounts.lineage.to_account_info();
        let asset_info = ctx.accounts.asset.to_account_info();
        let operator_info = ctx.accounts.operator_authority.to_account_info();
        let fee_payer_info = ctx.accounts.fee_payer.to_account_info();
        let member_wallet_info = ctx.accounts.member_wallet.to_account_info();
        let mpl_core_program_info = ctx.accounts.mpl_core_program.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();
        let asset_bump = [ctx.bumps.asset];
        let asset_signer_seeds: &[&[u8]] = &[
            MEMBERSHIP_ASSET_SEED,
            args.lineage_id.as_ref(),
            INITIAL_ASSET_GENERATION_BYTES.as_ref(),
            asset_bump.as_ref(),
        ];

        create_frozen_asset(
            &mpl_core_program_info,
            &asset_info,
            &operator_info,
            &fee_payer_info,
            &member_wallet_info,
            &lineage_info,
            &system_program_info,
            args.projection.active_asset_name(),
            args.metadata_uri,
            asset_signer_seeds,
        )?;

        ctx.accounts.lineage.initialize(
            ctx.bumps.lineage,
            args.lineage_id,
            ctx.accounts.operator_authority.key(),
            ctx.accounts.member_wallet.key(),
            ctx.accounts.asset.key(),
            &args.projection,
        )?;

        assert_frozen_membership_asset(
            &asset_info,
            ctx.accounts.member_wallet.key(),
            ctx.accounts.lineage.key(),
        )?;

        emit!(MembershipCardInitialized {
            lineage: ctx.accounts.lineage.key(),
            asset: ctx.accounts.asset.key(),
            member_wallet: ctx.accounts.member_wallet.key(),
            generation: INITIAL_ASSET_GENERATION,
            projection_version: ctx.accounts.lineage.projection_version,
        });

        Ok(())
    }

    pub fn update_membership_card(
        ctx: Context<UpdateMembershipCard>,
        args: UpdateMembershipCardArgs,
    ) -> Result<()> {
        args.projection.validate()?;
        validate_metadata_uri(&args.metadata_uri)?;
        ctx.accounts
            .lineage
            .assert_current_asset(ctx.accounts.current_asset.key(), args.expected_generation)?;
        ctx.accounts.lineage.validate_same_wallet_update(
            args.expected_projection_version,
            args.expected_generation,
            &args.projection,
        )?;

        let lineage_info = ctx.accounts.lineage.to_account_info();
        let asset_info = ctx.accounts.current_asset.to_account_info();
        assert_frozen_membership_asset(
            &asset_info,
            ctx.accounts.lineage.current_member_wallet,
            ctx.accounts.lineage.key(),
        )?;

        let lineage_id = ctx.accounts.lineage.lineage_id;
        let lineage_bump = [ctx.accounts.lineage.bump];
        let lineage_signer_seeds: &[&[u8]] = &[
            MEMBERSHIP_LINEAGE_SEED,
            lineage_id.as_ref(),
            lineage_bump.as_ref(),
        ];
        update_asset_metadata(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &asset_info,
            &ctx.accounts.fee_payer.to_account_info(),
            &lineage_info,
            &ctx.accounts.system_program.to_account_info(),
            args.projection.active_asset_name(),
            args.metadata_uri,
            lineage_signer_seeds,
        )?;

        ctx.accounts.lineage.update_same_wallet_period(
            args.expected_projection_version,
            args.expected_generation,
            &args.projection,
        )?;

        emit!(MembershipCardUpdated {
            lineage: ctx.accounts.lineage.key(),
            asset: ctx.accounts.current_asset.key(),
            generation: ctx.accounts.lineage.generation,
            projection_version: ctx.accounts.lineage.projection_version,
        });

        Ok(())
    }

    pub fn replace_membership_card_wallet(
        ctx: Context<ReplaceMembershipCardWallet>,
        args: ReplaceMembershipCardWalletArgs,
    ) -> Result<()> {
        args.projection.validate()?;
        validate_metadata_uri(&args.inactive_metadata_uri)?;
        validate_metadata_uri(&args.active_metadata_uri)?;
        ctx.accounts
            .lineage
            .assert_current_asset(ctx.accounts.old_asset.key(), args.expected_generation)?;
        ctx.accounts.lineage.validate_replacement(
            args.expected_projection_version,
            args.expected_generation,
            args.new_generation,
            ctx.accounts.new_member_wallet.key(),
            &args.projection,
        )?;

        let lineage_info = ctx.accounts.lineage.to_account_info();
        let old_asset_info = ctx.accounts.old_asset.to_account_info();
        assert_frozen_membership_asset(
            &old_asset_info,
            ctx.accounts.lineage.current_member_wallet,
            ctx.accounts.lineage.key(),
        )?;

        let lineage_id = ctx.accounts.lineage.lineage_id;
        let lineage_bump = [ctx.accounts.lineage.bump];
        let lineage_signer_seeds: &[&[u8]] = &[
            MEMBERSHIP_LINEAGE_SEED,
            lineage_id.as_ref(),
            lineage_bump.as_ref(),
        ];
        update_asset_metadata(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &old_asset_info,
            &ctx.accounts.fee_payer.to_account_info(),
            &lineage_info,
            &ctx.accounts.system_program.to_account_info(),
            INACTIVE_ASSET_NAME.to_owned(),
            args.inactive_metadata_uri,
            lineage_signer_seeds,
        )?;

        let new_asset_info = ctx.accounts.new_asset.to_account_info();
        let generation_bytes = args.new_generation.to_le_bytes();
        let new_asset_bump = [ctx.bumps.new_asset];
        let new_asset_signer_seeds: &[&[u8]] = &[
            MEMBERSHIP_ASSET_SEED,
            lineage_id.as_ref(),
            generation_bytes.as_ref(),
            new_asset_bump.as_ref(),
        ];
        create_frozen_asset(
            &ctx.accounts.mpl_core_program.to_account_info(),
            &new_asset_info,
            &ctx.accounts.operator_authority.to_account_info(),
            &ctx.accounts.fee_payer.to_account_info(),
            &ctx.accounts.new_member_wallet.to_account_info(),
            &lineage_info,
            &ctx.accounts.system_program.to_account_info(),
            args.projection.active_asset_name(),
            args.active_metadata_uri,
            new_asset_signer_seeds,
        )?;

        ctx.accounts.lineage.replace_wallet(
            args.expected_projection_version,
            args.expected_generation,
            args.new_generation,
            ctx.accounts.new_member_wallet.key(),
            ctx.accounts.new_asset.key(),
            &args.projection,
        )?;

        assert_frozen_membership_asset(
            &new_asset_info,
            ctx.accounts.new_member_wallet.key(),
            ctx.accounts.lineage.key(),
        )?;

        emit!(MembershipCardWalletReplaced {
            lineage: ctx.accounts.lineage.key(),
            inactive_asset: ctx.accounts.old_asset.key(),
            current_asset: ctx.accounts.new_asset.key(),
            current_member_wallet: ctx.accounts.new_member_wallet.key(),
            generation: ctx.accounts.lineage.generation,
            projection_version: ctx.accounts.lineage.projection_version,
        });

        Ok(())
    }

    pub fn assert_current_membership_card(
        ctx: Context<AssertCurrentMembershipCard>,
        expected_generation: u32,
    ) -> Result<()> {
        ctx.accounts
            .lineage
            .assert_current(ctx.accounts.current_asset.key(), expected_generation)?;
        assert_frozen_membership_asset(
            &ctx.accounts.current_asset.to_account_info(),
            ctx.accounts.lineage.current_member_wallet,
            ctx.accounts.lineage.key(),
        )?;

        emit!(CurrentMembershipCardValidated {
            lineage: ctx.accounts.lineage.key(),
            asset: ctx.accounts.current_asset.key(),
            generation: expected_generation,
            projection_version: ctx.accounts.lineage.projection_version,
        });
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeMembershipCardArgs {
    pub lineage_id: [u8; 32],
    pub projection: ProjectionInput,
    pub metadata_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UpdateMembershipCardArgs {
    pub expected_projection_version: u64,
    pub expected_generation: u32,
    pub projection: ProjectionInput,
    pub metadata_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ReplaceMembershipCardWalletArgs {
    pub expected_projection_version: u64,
    pub expected_generation: u32,
    pub new_generation: u32,
    pub projection: ProjectionInput,
    pub inactive_metadata_uri: String,
    pub active_metadata_uri: String,
}

#[derive(Accounts)]
#[instruction(args: InitializeMembershipCardArgs)]
pub struct InitializeMembershipCard<'info> {
    #[account(
        init,
        payer = fee_payer,
        space = 8 + MembershipCard::INIT_SPACE,
        seeds = [MEMBERSHIP_LINEAGE_SEED, args.lineage_id.as_ref()],
        bump
    )]
    pub lineage: Account<'info, MembershipCard>,
    /// CHECK: The address is constrained to this program's deterministic Core asset PDA and Core initializes it.
    #[account(
        mut,
        seeds = [
            MEMBERSHIP_ASSET_SEED,
            args.lineage_id.as_ref(),
            INITIAL_ASSET_GENERATION_BYTES.as_ref()
        ],
        bump
    )]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: Core stores this public key as the asset owner; the wallet does not need to sign projection creation.
    pub member_wallet: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = fee_payer.key() != operator_authority.key() @ MembershipCardError::RoleCollision
    )]
    pub fee_payer: Signer<'info>,
    pub operator_authority: Signer<'info>,
    /// CHECK: The address and executable constraints prevent substitution of an arbitrary CPI program.
    #[account(address = MPL_CORE_ID, executable)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMembershipCard<'info> {
    #[account(
        mut,
        seeds = [MEMBERSHIP_LINEAGE_SEED, lineage.lineage_id.as_ref()],
        bump = lineage.bump,
        has_one = operator_authority
    )]
    pub lineage: Account<'info, MembershipCard>,
    /// CHECK: Address and owner are constrained here; Core data, member owner, authority and freeze plugin are decoded in the handler.
    #[account(
        mut,
        address = lineage.current_asset @ MembershipCardError::AssetNotCurrent,
        owner = MPL_CORE_ID @ MembershipCardError::InvalidCoreAsset
    )]
    pub current_asset: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = fee_payer.key() != operator_authority.key() @ MembershipCardError::RoleCollision
    )]
    pub fee_payer: Signer<'info>,
    pub operator_authority: Signer<'info>,
    /// CHECK: The address and executable constraints prevent substitution of an arbitrary CPI program.
    #[account(address = MPL_CORE_ID, executable)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: ReplaceMembershipCardWalletArgs)]
pub struct ReplaceMembershipCardWallet<'info> {
    #[account(
        mut,
        seeds = [MEMBERSHIP_LINEAGE_SEED, lineage.lineage_id.as_ref()],
        bump = lineage.bump,
        has_one = operator_authority
    )]
    pub lineage: Account<'info, MembershipCard>,
    /// CHECK: Address and owner are constrained here; Core data is decoded in the handler.
    #[account(
        mut,
        address = lineage.current_asset @ MembershipCardError::AssetNotCurrent,
        owner = MPL_CORE_ID @ MembershipCardError::InvalidCoreAsset
    )]
    pub old_asset: UncheckedAccount<'info>,
    /// CHECK: The address is constrained to the next deterministic asset generation and Core initializes it.
    #[account(
        mut,
        seeds = [
            MEMBERSHIP_ASSET_SEED,
            lineage.lineage_id.as_ref(),
            args.new_generation.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub new_asset: UncheckedAccount<'info>,
    /// CHECK: Core stores this public key as the replacement asset owner; the old or new wallet does not authorize the reviewed transition.
    pub new_member_wallet: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = fee_payer.key() != operator_authority.key() @ MembershipCardError::RoleCollision
    )]
    pub fee_payer: Signer<'info>,
    pub operator_authority: Signer<'info>,
    /// CHECK: The address and executable constraints prevent substitution of an arbitrary CPI program.
    #[account(address = MPL_CORE_ID, executable)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AssertCurrentMembershipCard<'info> {
    #[account(
        seeds = [MEMBERSHIP_LINEAGE_SEED, lineage.lineage_id.as_ref()],
        bump = lineage.bump
    )]
    pub lineage: Account<'info, MembershipCard>,
    /// CHECK: Address and owner are constrained here; Core data, member owner, authority and freeze plugin are decoded in the handler.
    #[account(
        address = lineage.current_asset @ MembershipCardError::AssetNotCurrent,
        owner = MPL_CORE_ID @ MembershipCardError::InvalidCoreAsset
    )]
    pub current_asset: UncheckedAccount<'info>,
}

#[event]
pub struct MembershipCardInitialized {
    pub lineage: Pubkey,
    pub asset: Pubkey,
    pub member_wallet: Pubkey,
    pub generation: u32,
    pub projection_version: u64,
}

#[event]
pub struct MembershipCardUpdated {
    pub lineage: Pubkey,
    pub asset: Pubkey,
    pub generation: u32,
    pub projection_version: u64,
}

#[event]
pub struct MembershipCardWalletReplaced {
    pub lineage: Pubkey,
    pub inactive_asset: Pubkey,
    pub current_asset: Pubkey,
    pub current_member_wallet: Pubkey,
    pub generation: u32,
    pub projection_version: u64,
}

#[event]
pub struct CurrentMembershipCardValidated {
    pub lineage: Pubkey,
    pub asset: Pubkey,
    pub generation: u32,
    pub projection_version: u64,
}
