use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::DEVNET_EURC_DECIMALS, errors::CoachPassError};

pub fn transfer_event_tokens<'info>(
    source: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    destination: &Account<'info, TokenAccount>,
    authority: AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    amount: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    require!(
        mint.decimals == DEVNET_EURC_DECIMALS,
        CoachPassError::InvalidPaymentMintDecimals
    );

    let accounts = TransferChecked {
        from: source.to_account_info(),
        mint: mint.to_account_info(),
        to: destination.to_account_info(),
        authority,
    };
    let context = match signer_seeds {
        Some(seeds) => CpiContext::new_with_signer(token_program.key(), accounts, seeds),
        None => CpiContext::new(token_program.key(), accounts),
    };

    token::transfer_checked(context, amount, DEVNET_EURC_DECIMALS)
}
