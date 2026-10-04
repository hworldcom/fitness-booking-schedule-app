use anchor_lang::prelude::*;

pub const COACH_AUTHORITY_SEED: &[u8] = b"coach-authority";
pub const OFFER_SEED: &[u8] = b"offer";
pub const COACH_CLIENT_CREDITS_SEED: &[u8] = b"coach-client-credits";

/// Circle's public Solana Devnet test-USDC mint. This program is Devnet-only.
pub const DEVNET_USDC_MINT: Pubkey =
    anchor_lang::pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
pub const DEVNET_USDC_DECIMALS: u8 = 6;
pub const COACH_CLIENT_CREDITS_VERSION: u8 = 1;

pub const NO_EXPIRY: u32 = 0;
pub const MIN_VALIDITY_SECONDS: u32 = 24 * 60 * 60;
pub const MAX_VALIDITY_SECONDS: u32 = 365 * 24 * 60 * 60;
