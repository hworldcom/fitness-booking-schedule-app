use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{COACH_AUTHORITY_SEED, COACH_CLIENT_CREDITS_SEED, DEVNET_EURC_MINT, OFFER_SEED},
    errors::CoachPassError,
    events::CreditsPurchased,
    state::{CoachAuthority, CoachClientCredits, Offer},
};

use super::purchase_common::transfer_offer_payment;

pub fn handler(ctx: Context<PurchaseOffer>, expected_purchase_nonce: u64) -> Result<()> {
    let purchased_at = Clock::get()?.unix_timestamp;
    let client_wallet = ctx.accounts.client_wallet.key();
    ctx.accounts.offer.validate_purchase(
        ctx.accounts.coach_authority.key(),
        &ctx.accounts.coach_authority,
        client_wallet,
        purchased_at,
    )?;

    let applied = ctx.accounts.coach_client_credits.apply_purchase(
        ctx.accounts.offer.key(),
        ctx.accounts.offer.session_count,
        expected_purchase_nonce,
        purchased_at,
    )?;

    transfer_offer_payment(
        &ctx.accounts.client_wallet,
        &ctx.accounts.client_token_account,
        &ctx.accounts.coach_token_account,
        &ctx.accounts.payment_mint,
        &ctx.accounts.token_program,
        ctx.accounts.offer.price_eurc_base_units,
    )?;

    emit_cpi!(CreditsPurchased {
        coach_client_credits: ctx.accounts.coach_client_credits.key(),
        coach_authority: ctx.accounts.coach_authority.key(),
        offer: ctx.accounts.offer.key(),
        client_wallet,
        payment_recipient: ctx.accounts.offer.payment_recipient,
        purchase_nonce: applied.purchase_nonce,
        price_eurc_base_units: ctx.accounts.offer.price_eurc_base_units,
        credits_purchased: applied.credits_purchased,
        available_credits: applied.available_credits,
        reserved_credits: ctx.accounts.coach_client_credits.reserved_credits,
        total_purchased: applied.total_purchased,
        purchase_count: applied.purchase_count,
        purchased_at,
    });

    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PurchaseOffer<'info> {
    pub client_wallet: Signer<'info>,
    #[account(
        seeds = [
            COACH_AUTHORITY_SEED,
            coach_authority.run_id.as_ref(),
            coach_authority.profile_id.as_ref(),
            coach_authority.original_wallet.as_ref(),
        ],
        bump = coach_authority.bump,
    )]
    pub coach_authority: Box<Account<'info, CoachAuthority>>,
    #[account(
        seeds = [
            OFFER_SEED,
            coach_authority.key().as_ref(),
            &offer.nonce.to_le_bytes(),
        ],
        bump = offer.bump,
        has_one = coach_authority,
    )]
    pub offer: Box<Account<'info, Offer>>,
    #[account(
        mut,
        seeds = [
            COACH_CLIENT_CREDITS_SEED,
            coach_authority.key().as_ref(),
            client_wallet.key().as_ref(),
        ],
        bump = coach_client_credits.bump,
        has_one = coach_authority,
        constraint = coach_client_credits.client_wallet == client_wallet.key()
            @ CoachPassError::InvalidCreditLedgerAuthority,
    )]
    pub coach_client_credits: Box<Account<'info, CoachClientCredits>>,
    #[account(address = DEVNET_EURC_MINT @ CoachPassError::InvalidPaymentMint)]
    pub payment_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = client_wallet,
    )]
    pub client_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = payment_mint,
        constraint = coach_token_account.owner == offer.payment_recipient
            @ CoachPassError::StaleOfferRecipient,
    )]
    pub coach_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}
