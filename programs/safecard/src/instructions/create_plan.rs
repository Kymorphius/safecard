use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Merchant, Plan},
};

#[derive(Accounts)]
pub struct CreatePlan<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [MERCHANT_SEED, authority.key().as_ref()],
        bump = merchant.bump,
        has_one = authority,
        constraint = !merchant.closed @ ErrorCode::MerchantClosed,
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(
        init,
        payer = authority,
        space = 8 + Plan::INIT_SPACE,
        seeds = [PLAN_SEED, merchant.key().as_ref(), &merchant.plan_count.to_le_bytes()],
        bump
    )]
    pub plan: Account<'info, Plan>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_plan(
    ctx: Context<CreatePlan>,
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
    let plan = &mut ctx.accounts.plan;
    plan.merchant = merchant.key();
    plan.plan_id = merchant.plan_count;
    plan.name = name;
    plan.price = price;
    plan.sessions = sessions;
    plan.active = true;
    plan.bump = ctx.bumps.plan;

    merchant.plan_count = merchant
        .plan_count
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    Ok(())
}
