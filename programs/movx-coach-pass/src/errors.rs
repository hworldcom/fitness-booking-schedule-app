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
    #[msg("The EURC price must be positive")]
    InvalidPrice,
    #[msg("Validity must be no-expiry or between one and 365 days")]
    InvalidValidity,
    #[msg("The restricted client wallet address is invalid")]
    InvalidRestrictedClient,
    #[msg("The offer is already deactivated")]
    OfferAlreadyDeactivated,
    #[msg("The offer is not active")]
    OfferNotActive,
    #[msg("The offer belongs to a different coach authority")]
    OfferAuthorityMismatch,
    #[msg("The offer was created under a stale coach authority epoch")]
    StaleOfferAuthority,
    #[msg("The offer payment recipient is no longer the current coach wallet")]
    StaleOfferRecipient,
    #[msg("The offer payment mint is not the configured Devnet EURC mint")]
    InvalidPaymentMint,
    #[msg("The offer purchase window has expired")]
    OfferExpired,
    #[msg("This offer is restricted to a different client wallet")]
    RestrictedClientMismatch,
    #[msg("A coach cannot purchase credits from their own offer")]
    SelfPurchase,
    #[msg("The payment mint must use six decimals")]
    InvalidPaymentMintDecimals,
    #[msg("The purchase nonce does not match the credit ledger's next nonce")]
    UnexpectedPurchaseNonce,
    #[msg("The purchase nonce cannot advance further")]
    PurchaseNonceOverflow,
    #[msg("The available credit balance cannot increase further")]
    AvailableCreditsOverflow,
    #[msg("The total purchased credit count cannot increase further")]
    TotalPurchasedOverflow,
    #[msg("The purchase count cannot increase further")]
    PurchaseCountOverflow,
    #[msg("The coach-client credit ledger has an invalid authority")]
    InvalidCreditLedgerAuthority,
    #[msg("The booking identifier cannot be nil")]
    NilBookingId,
    #[msg("The scheduled start must be in the future when the credit is reserved")]
    InvalidBookingSchedule,
    #[msg("The early-return cutoff cannot be later than the scheduled start")]
    InvalidEarlyReturnCutoff,
    #[msg("No available coach credit can be reserved")]
    NoAvailableCredits,
    #[msg("No reserved coach credit can be resolved")]
    NoReservedCredits,
    #[msg("The reserved credit balance cannot increase further")]
    ReservedCreditsOverflow,
    #[msg("The booking credit reservation is already resolved")]
    ReservationAlreadyResolved,
    #[msg("The reservation does not belong to the supplied credit ledger")]
    ReservationLedgerMismatch,
    #[msg("The reservation does not belong to the supplied coach authority")]
    ReservationCoachMismatch,
    #[msg("The reservation does not belong to the supplied client wallet")]
    ReservationClientMismatch,
    #[msg("Only the client within the early-return window or the current coach wallet can return this credit")]
    UnauthorizedReservationReturn,
    #[msg("The client's automatic credit-return window has closed")]
    ClientReturnWindowClosed,
    #[msg("Only the current coach wallet can consume this reserved credit")]
    UnauthorizedReservationConsume,
    #[msg("A reserved credit cannot be consumed before the scheduled start")]
    ReservationConsumeTooEarly,
}
