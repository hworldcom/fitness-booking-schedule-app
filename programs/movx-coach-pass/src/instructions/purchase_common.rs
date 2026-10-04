use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::DEVNET_USDC_DECIMALS, errors::CoachPassError};

pub fn transfer_offer_payment<'info>(
    client_wallet: &Signer<'info>,
    client_token_account: &Account<'info, TokenAccount>,
    coach_token_account: &Account<'info, TokenAccount>,
    payment_mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    require!(
        payment_mint.decimals == DEVNET_USDC_DECIMALS,
        CoachPassError::InvalidPaymentMintDecimals
    );

    token::transfer_checked(
        CpiContext::new(
            token_program.key(),
            TransferChecked {
                from: client_token_account.to_account_info(),
                mint: payment_mint.to_account_info(),
                to: coach_token_account.to_account_info(),
                authority: client_wallet.to_account_info(),
            },
        ),
        amount,
        DEVNET_USDC_DECIMALS,
    )
}
