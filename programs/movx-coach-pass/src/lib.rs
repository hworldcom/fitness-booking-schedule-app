use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::CreateOfferArgs;

declare_id!("GvZdpXGX6N25xfHipgzh3Td3NZBkt7e36AougHi4v1MU");

#[program]
pub mod movx_coach_pass {
    use super::*;

    pub fn initialize_coach_authority(
        ctx: Context<InitializeCoachAuthority>,
        run_id: [u8; 16],
        profile_id: [u8; 16],
    ) -> Result<()> {
        instructions::initialize_coach_authority::handler(ctx, run_id, profile_id)
    }

    pub fn rotate_coach_authority(ctx: Context<RotateCoachAuthority>) -> Result<()> {
        instructions::rotate_coach_authority::handler(ctx)
    }

    pub fn create_offer(ctx: Context<CreateOffer>, args: CreateOfferArgs) -> Result<()> {
        instructions::create_offer::handler(ctx, args)
    }

    pub fn deactivate_offer(ctx: Context<DeactivateOffer>) -> Result<()> {
        instructions::deactivate_offer::handler(ctx)
    }

    pub fn purchase_first_offer(ctx: Context<PurchaseFirstOffer>) -> Result<()> {
        instructions::purchase_first_offer::handler(ctx)
    }

    pub fn purchase_offer(ctx: Context<PurchaseOffer>, expected_purchase_nonce: u64) -> Result<()> {
        instructions::purchase_offer::handler(ctx, expected_purchase_nonce)
    }

    pub fn reserve_booking_credit(
        ctx: Context<ReserveBookingCredit>,
        booking_id: [u8; 16],
        scheduled_start_at: i64,
        early_return_until: i64,
    ) -> Result<()> {
        instructions::reserve_booking_credit::handler(
            ctx,
            booking_id,
            scheduled_start_at,
            early_return_until,
        )
    }

    pub fn return_booking_credit(ctx: Context<ReturnBookingCredit>) -> Result<()> {
        instructions::return_booking_credit::handler(ctx)
    }

    pub fn consume_booking_credit(ctx: Context<ConsumeBookingCredit>) -> Result<()> {
        instructions::consume_booking_credit::handler(ctx)
    }
}
