use anchor_lang::prelude::*;

use crate::{constants::*, error::ErrorCode, state::Merchant};

/// 商家修改店名。只有店主本人可以改。
#[derive(Accounts)]
pub struct UpdateMerchant<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
}

pub fn handle_update_merchant(ctx: Context<UpdateMerchant>, name: String) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
    ctx.accounts.merchant.name = name;
    Ok(())
}
