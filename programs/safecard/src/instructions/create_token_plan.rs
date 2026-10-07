use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Merchant, MerchantTokenStats, TokenPlan},
};

#[derive(Accounts)]
pub struct CreateTokenPlan<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
        constraint = !merchant.closed @ ErrorCode::MerchantClosed,
    )]
    pub merchant: Box<Account<'info, Merchant>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    // 与 SOL 套餐共用 plan_count，套餐编号在两种套餐之间不重复
    #[account(
        init,
        payer = authority,
        space = 8 + TokenPlan::INIT_SPACE,
        seeds = [TOKEN_PLAN_SEED, merchant.key().as_ref(), &merchant.plan_count.to_le_bytes()],
        bump
    )]
    pub plan: Box<Account<'info, TokenPlan>>,
    // 同一商家同一代币只有一份统计；第二个同币种套餐复用它
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + MerchantTokenStats::INIT_SPACE,
        seeds = [TOKEN_STATS_SEED, merchant.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub stats: Box<Account<'info, MerchantTokenStats>>,
    /// 商家收款账户，上架时由商家建好，签到时直接转入
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub merchant_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_token_plan(
    ctx: Context<CreateTokenPlan>,
    name: String,
    price: u64,
    sessions: u32,
) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, ErrorCode::NameTooLong);
    require!(
        sessions > 0 && price >= sessions as u64,
        ErrorCode::InvalidPlan
    );

    let merchant = &mut ctx.accounts.merchant;
    let mint = ctx.accounts.mint.key();

    let plan = &mut ctx.accounts.plan;
    plan.merchant = merchant.key();
    plan.plan_id = merchant.plan_count;
    plan.name = name;
    plan.mint = mint;
    plan.price = price;
    plan.sessions = sessions;
    plan.active = true;
    plan.bump = ctx.bumps.plan;

    // 只写身份字段，已有的金额统计保持不变
    let stats = &mut ctx.accounts.stats;
    stats.merchant = merchant.key();
    stats.mint = mint;
    stats.bump = ctx.bumps.stats;

    merchant.plan_count = merchant
        .plan_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}
