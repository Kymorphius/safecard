use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    events::Refunded,
    state::{Card, Merchant},
};

/// 退回卡内剩余托管金额并关闭卡片（租金也退给用户）。
/// 允许条件：卡已用完，或商家已关店 / 超时未提供服务。
#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [CARD_SEED, card.plan.as_ref(), owner.key().as_ref()],
        bump = card.bump,
        has_one = owner,
        has_one = merchant,
        close = owner,
    )]
    pub card: Account<'info, Card>,
    #[account(mut)]
    pub merchant: Account<'info, Merchant>,
}

pub fn handle_refund(ctx: Context<Refund>) -> Result<()> {
    let card = &ctx.accounts.card;
    let merchant = &mut ctx.accounts.merchant;
    let now = Clock::get()?.unix_timestamp;

    require!(
        card.remaining_sessions == 0 || merchant.is_defaulted(now),
        ErrorCode::RefundNotAllowed
    );

    // 剩余托管金额随 `close = owner` 一并转给用户
    let amount = card.escrow;
    if amount > 0 {
        merchant.total_escrowed = merchant
            .total_escrowed
            .checked_sub(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        merchant.total_refunded = merchant
            .total_refunded
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        merchant.refund_count = merchant
            .refund_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    emit!(Refunded {
        card: card.key(),
        owner: card.owner,
        merchant: card.merchant,
        amount,
    });
    Ok(())
}
