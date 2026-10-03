use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::CreateOfferArgs;

declare_id!("DfpqcSwSer4MrPehwFk2Jota3yJVhqobWWD2Aq1crARB");

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
}
