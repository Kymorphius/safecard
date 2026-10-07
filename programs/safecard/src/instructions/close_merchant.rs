use anchor_lang::prelude::*;

use crate::{constants::*, events::MerchantClosed, state::Merchant};

/// 商家主动关店：停止售卡和签到，所有持卡用户可立即退款。
#[derive(Accounts)]
pub struct CloseMerchant<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
}

pub fn handle_close_merchant(ctx: Context<CloseMerchant>) -> Result<()> {
    ctx.accounts.merchant.closed = true;
    emit!(MerchantClosed {
        merchant: ctx.accounts.merchant.key(),
    });
    Ok(())
}
