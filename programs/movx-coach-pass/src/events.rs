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
    pub price_eurc_base_units: u64,
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
    pub price_eurc_base_units: u64,
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

#[event]
pub struct EventPoolCreated {
    pub event_pool: Pubkey,
    pub coach_authority: Pubkey,
    pub payout_recipient: Pubkey,
    pub payment_mint: Pubkey,
    pub vault: Pubkey,
    pub nonce: u64,
    pub price_eurc_base_units: u64,
    pub minimum_participants: u16,
    pub maximum_participants: u16,
    pub funding_deadline: i64,
    pub event_start_at: i64,
    pub event_end_at: i64,
    pub created_at: i64,
}

#[event]
pub struct EventSeatFunded {
    pub event_pool: Pubkey,
    pub contribution: Pubkey,
    pub participant_wallet: Pubkey,
    pub amount_eurc_base_units: u64,
    pub participant_count: u16,
    pub total_funded_base_units: u64,
    pub funded_at: i64,
}

#[event]
pub struct EventPoolSettled {
    pub event_pool: Pubkey,
    pub status: crate::state::EventPoolStatus,
    pub participant_count: u16,
    pub minimum_participants: u16,
    pub total_funded_base_units: u64,
    pub settled_at: i64,
}

#[event]
pub struct EventPayoutClaimed {
    pub event_pool: Pubkey,
    pub coach_authority: Pubkey,
    pub payout_recipient: Pubkey,
    pub amount_eurc_base_units: u64,
    pub paid_at: i64,
}

#[event]
pub struct EventRefundClaimed {
    pub event_pool: Pubkey,
    pub contribution: Pubkey,
    pub participant_wallet: Pubkey,
    pub amount_eurc_base_units: u64,
    pub total_refunded_base_units: u64,
    pub refunded_at: i64,
}
