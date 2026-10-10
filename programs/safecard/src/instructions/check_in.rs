use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::CheckedIn,
    loyalty::record_check_in,
    state::{Card, Membership, Merchant},
};

/// 用户签名确认消费一次，合约从托管中放一次的钱给商家。
#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [CARD_SEED, card.plan.as_ref(), owner.key().as_ref()],
        bump = card.bump,
        has_one = owner,
        has_one = merchant,
    )]
    pub card: Account<'info, Card>,
    #[account(
        mut,
        has_one = authority,
        constraint = !merchant.closed @ ErrorCode::MerchantClosed,
    )]
    pub merchant: Account<'info, Merchant>,
    /// 商家收款地址
    #[account(mut)]
    pub authority: SystemAccount<'info>,
    /// 顾客在本店的会员记录，第一次签到时创建（顾客付租金）
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Membership::INIT_SPACE,
        seeds = [MEMBER_SEED, merchant.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub membership: Account<'info, Membership>,
    pub system_program: Program<'info, System>,
}

pub fn handle_check_in(ctx: Context<CheckIn>) -> Result<()> {
    let card = &mut ctx.accounts.card;
    require!(card.remaining_sessions > 0, ErrorCode::NoSessionsLeft);

    // 最后一次把除不尽的零头一起放出
    let amount = if card.remaining_sessions == 1 {
        card.escrow
    } else {
        card.per_session
    };

    card.sub_lamports(amount)?;
    ctx.accounts.authority.add_lamports(amount)?;

    card.remaining_sessions -= 1;
    card.escrow = card
        .escrow
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    let now = Clock::get()?.unix_timestamp;
    let merchant = &mut ctx.accounts.merchant;
    merchant.last_active_ts = now;
    record_check_in(
        &mut ctx.accounts.membership,
        merchant.key(),
        ctx.accounts.owner.key(),
        ctx.bumps.membership,
        now,
    )?;
    merchant.total_escrowed = merchant
        .total_escrowed
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    merchant.total_released = merchant
        .total_released
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(CheckedIn {
        card: card.key(),
        owner: card.owner,
        merchant: card.merchant,
        amount,
        remaining_sessions: card.remaining_sessions,
    });
    Ok(())
}
