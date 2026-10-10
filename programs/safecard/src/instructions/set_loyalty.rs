use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{LoyaltyConfig, Merchant},
};

/// 商家设置（或修改、关闭）会员优惠。discount_bps = 0 表示关闭。
#[derive(Accounts)]
pub struct SetLoyalty<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + LoyaltyConfig::INIT_SPACE,
        seeds = [LOYALTY_SEED, merchant.key().as_ref()],
        bump
    )]
    pub loyalty: Account<'info, LoyaltyConfig>,
    pub system_program: Program<'info, System>,
}

pub fn handle_set_loyalty(
    ctx: Context<SetLoyalty>,
    min_check_ins: u32,
    discount_bps: u16,
    active_window: i64,
) -> Result<()> {
    require!(
        discount_bps <= MAX_DISCOUNT_BPS && active_window >= 0 && (discount_bps == 0 || min_check_ins > 0),
        ErrorCode::InvalidLoyalty
    );
    let loyalty = &mut ctx.accounts.loyalty;
    loyalty.merchant = ctx.accounts.merchant.key();
    loyalty.min_check_ins = min_check_ins;
    loyalty.discount_bps = discount_bps;
    loyalty.active_window = active_window;
    loyalty.bump = ctx.bumps.loyalty;
    Ok(())
}
