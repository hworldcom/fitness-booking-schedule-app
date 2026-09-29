use anchor_lang::prelude::*;

#[error_code]
pub enum MembershipCardError {
    #[msg("The opaque membership-card lineage identifier cannot be all zeros.")]
    InvalidLineageId,
    #[msg("The opaque membership-period projection identifier cannot be all zeros.")]
    InvalidPeriodProjectionId,
    #[msg("The fee payer and projection operator must be distinct accounts.")]
    RoleCollision,
    #[msg("The membership validity range must have an end after its start.")]
    InvalidValidityRange,
    #[msg("Basic membership counters must satisfy used + remaining = total.")]
    InvalidBasicAllowance,
    #[msg("Classic membership projections must not publish visit counters.")]
    InvalidClassicAllowance,
    #[msg("The metadata URI must be HTTPS and no longer than the supported limit.")]
    InvalidMetadataUri,
    #[msg("The supplied projection version is stale or from another transition.")]
    StaleProjectionVersion,
    #[msg("The supplied asset generation is stale or from another transition.")]
    StaleAssetGeneration,
    #[msg("A different membership period cannot overlap the current projected period.")]
    OverlappingPeriod,
    #[msg("A wallet replacement must change the member wallet.")]
    ReplacementWalletUnchanged,
    #[msg("The supplied asset is not the lineage's current asset.")]
    AssetNotCurrent,
    #[msg("The membership-card projection is not active.")]
    ProjectionNotActive,
    #[msg("The Metaplex Core asset could not be decoded.")]
    InvalidCoreAsset,
    #[msg("The Metaplex Core asset owner does not match the current member wallet.")]
    InvalidAssetOwner,
    #[msg("The Metaplex Core asset update authority is not the membership lineage PDA.")]
    InvalidAssetUpdateAuthority,
    #[msg("The membership card does not contain its permanent freeze plugin.")]
    MissingPermanentFreeze,
    #[msg("The membership card is not frozen and could be transferred.")]
    AssetNotFrozen,
    #[msg("The permanent freeze plugin is not controlled by the asset update authority.")]
    InvalidFreezeAuthority,
    #[msg("A membership-card counter overflowed.")]
    ArithmeticOverflow,
}
