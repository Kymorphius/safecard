use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::Merchant};

#[derive(Accounts)]
pub struct RegisterMerchant<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Merchant::INIT_SPACE,
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump
    )]
    pub merchant: Account<'info, Merchant>,
    pub system_program: Program<'info, System>,
}

pub fn handle_register_merchant(
    ctx: Context<RegisterMerchant>,
    name: String,
    inactivity_timeout: i64,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
    require!(inactivity_timeout > 0, ErrorCode::InvalidTimeout);

    let merchant = &mut ctx.accounts.merchant;
    merchant.authority = ctx.accounts.authority.key();
    merchant.name = name;
    merchant.inactivity_timeout = inactivity_timeout;
    merchant.last_active_ts = Clock::get()?.unix_timestamp;
    merchant.closed = false;
    merchant.plan_count = 0;
    merchant.cards_sold = 0;
    merchant.refund_count = 0;
    merchant.total_escrowed = 0;
    merchant.total_released = 0;
    merchant.total_refunded = 0;
    merchant.bump = ctx.bumps.merchant;
    Ok(())
}
