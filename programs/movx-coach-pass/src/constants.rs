use anchor_lang::prelude::*;

pub const COACH_AUTHORITY_SEED: &[u8] = b"coach-authority";
pub const OFFER_SEED: &[u8] = b"offer";
pub const COACH_CLIENT_CREDITS_SEED: &[u8] = b"coach-client-credits";
pub const CREDIT_RESERVATION_SEED: &[u8] = b"credit-reservation";
pub const EVENT_POOL_SEED: &[u8] = b"event-pool";
pub const EVENT_VAULT_SEED: &[u8] = b"event-vault";
pub const CONTRIBUTION_SEED: &[u8] = b"contribution";

/// Circle's public Solana Devnet EURC mint. This program is Devnet-only.
pub const DEVNET_EURC_MINT: Pubkey =
    anchor_lang::pubkey!("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr");
pub const DEVNET_EURC_DECIMALS: u8 = 6;
pub const COACH_CLIENT_CREDITS_VERSION: u8 = 1;
pub const CREDIT_RESERVATION_VERSION: u8 = 1;
pub const EVENT_POOL_VERSION: u8 = 1;
pub const CONTRIBUTION_VERSION: u8 = 1;

pub const MAX_EVENT_PRICE_EURC_BASE_UNITS: u64 = 9_000_000_000_000_000;
pub const MIN_EVENT_PARTICIPANTS: u16 = 2;
pub const MAX_EVENT_PARTICIPANTS: u16 = 50;
pub const MIN_EVENT_DURATION_SECONDS: i64 = 30 * 60;
pub const MAX_EVENT_DURATION_SECONDS: i64 = 12 * 60 * 60;
pub const MAX_EVENT_LEAD_SECONDS: i64 = 365 * 24 * 60 * 60;

pub const NO_EXPIRY: u32 = 0;
pub const MIN_VALIDITY_SECONDS: u32 = 24 * 60 * 60;
pub const MAX_VALIDITY_SECONDS: u32 = 365 * 24 * 60 * 60;
