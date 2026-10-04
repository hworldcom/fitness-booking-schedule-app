use anchor_lang::prelude::*;

#[event]
pub struct CoachAuthorityInitialized {
    pub coach_authority: Pubkey,
    pub run_id: [u8; 16],
    pub profile_id: [u8; 16],
    pub original_wallet: Pubkey,
    pub recovery_authority: Pubkey,
    pub authority_epoch: u64,
    pub event_sequence: u64,
}

#[event]
pub struct CoachAuthorityRotated {
    pub coach_authority: Pubkey,
    pub previous_wallet: Pubkey,
    pub replacement_wallet: Pubkey,
    pub authority_epoch: u64,
    pub event_sequence: u64,
}

#[event]
pub struct OfferCreated {
    pub offer: Pubkey,
    pub coach_authority: Pubkey,
    pub coach_wallet: Pubkey,
    pub nonce: u64,
    pub price_usdc_base_units: u64,
    pub session_count: u8,
    pub validity_seconds: u32,
    pub restricted_client: Option<Pubkey>,
    pub payment_mint: Pubkey,
    pub authority_epoch: u64,
    pub event_sequence: u64,
}

#[event]
pub struct OfferDeactivated {
    pub offer: Pubkey,
    pub coach_authority: Pubkey,
    pub coach_wallet: Pubkey,
    pub nonce: u64,
    pub deactivated_at: i64,
    pub event_sequence: u64,
}

#[event]
pub struct CreditsPurchased {
    pub coach_client_credits: Pubkey,
    pub coach_authority: Pubkey,
    pub offer: Pubkey,
    pub client_wallet: Pubkey,
    pub payment_recipient: Pubkey,
    pub purchase_nonce: u64,
    pub price_usdc_base_units: u64,
    pub credits_purchased: u8,
    pub available_credits: u64,
    pub reserved_credits: u64,
    pub total_purchased: u64,
    pub purchase_count: u64,
    pub purchased_at: i64,
}

#[event]
pub struct BookingCreditReserved {
    pub credit_reservation: Pubkey,
    pub coach_client_credits: Pubkey,
    pub coach_authority: Pubkey,
    pub client_wallet: Pubkey,
    pub booking_id: [u8; 16],
    pub scheduled_start_at: i64,
    pub early_return_until: i64,
    pub available_credits: u64,
    pub reserved_credits: u64,
    pub reserved_at: i64,
}

#[event]
pub struct BookingCreditReturned {
    pub credit_reservation: Pubkey,
    pub coach_client_credits: Pubkey,
    pub coach_authority: Pubkey,
    pub client_wallet: Pubkey,
    pub booking_id: [u8; 16],
    pub resolution_authority: Pubkey,
    pub available_credits: u64,
    pub reserved_credits: u64,
    pub returned_at: i64,
}

#[event]
pub struct BookingCreditConsumed {
    pub credit_reservation: Pubkey,
    pub coach_client_credits: Pubkey,
    pub coach_authority: Pubkey,
    pub client_wallet: Pubkey,
    pub booking_id: [u8; 16],
    pub coach_wallet: Pubkey,
    pub available_credits: u64,
    pub reserved_credits: u64,
    pub consumed_at: i64,
}
