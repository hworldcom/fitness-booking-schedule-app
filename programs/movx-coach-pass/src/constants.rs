use anchor_lang::prelude::*;

pub const COACH_AUTHORITY_SEED: &[u8] = b"coach-authority";
pub const OFFER_SEED: &[u8] = b"offer";
pub const COACH_CLIENT_CREDITS_SEED: &[u8] = b"coach-client-credits";
pub const CREDIT_RESERVATION_SEED: &[u8] = b"credit-reservation";

/// Circle's public Solana Devnet EURC mint. This program is Devnet-only.
pub const DEVNET_EURC_MINT: Pubkey =
    anchor_lang::pubkey!("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr");
pub const DEVNET_EURC_DECIMALS: u8 = 6;
pub const COACH_CLIENT_CREDITS_VERSION: u8 = 1;
pub const CREDIT_RESERVATION_VERSION: u8 = 1;

pub const NO_EXPIRY: u32 = 0;
pub const MIN_VALIDITY_SECONDS: u32 = 24 * 60 * 60;
pub const MAX_VALIDITY_SECONDS: u32 = 365 * 24 * 60 * 60;
