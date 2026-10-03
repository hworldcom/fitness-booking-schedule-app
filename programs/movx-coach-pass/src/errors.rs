use anchor_lang::prelude::*;

#[error_code]
pub enum CoachPassError {
    #[msg("The application dataset identifier cannot be nil")]
    NilRunId,
    #[msg("The coach profile identifier cannot be nil")]
    NilProfileId,
    #[msg("The coach wallet address is invalid")]
    InvalidCoachWallet,
    #[msg("The recovery authority address is invalid")]
    InvalidRecoveryAuthority,
    #[msg("The recovery authority must be different from the coach wallet")]
    RecoveryAuthorityMatchesCoach,
    #[msg("Only the current coach wallet can perform this action")]
    UnauthorizedCoach,
    #[msg("Only the configured recovery authority can rotate the coach wallet")]
    UnauthorizedRecoveryAuthority,
    #[msg("The replacement wallet address is invalid")]
    InvalidReplacementWallet,
    #[msg("The replacement wallet is already the current coach wallet")]
    ReplacementWalletUnchanged,
    #[msg("The authority epoch cannot advance further")]
    AuthorityEpochOverflow,
    #[msg("The event sequence cannot advance further")]
    EventSequenceOverflow,
    #[msg("An offer must contain exactly one or ten sessions")]
    UnsupportedSessionCount,
    #[msg("The test-USDC price must be positive")]
    InvalidPrice,
    #[msg("Validity must be no-expiry or between one and 365 days")]
    InvalidValidity,
    #[msg("The restricted client wallet address is invalid")]
    InvalidRestrictedClient,
    #[msg("The offer is already deactivated")]
    OfferAlreadyDeactivated,
}
