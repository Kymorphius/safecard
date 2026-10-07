use anchor_lang::{prelude::*, system_program};

use crate::{
    constants::*,
    error::ErrorCode,
    events::CardPurchased,
    state::{Card, Merchant, Plan},
};

#[derive(Accounts)]
pub struct BuyCard<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        constraint = !merchant.closed @ ErrorCode::MerchantClosed,
    )]
    pub merchant: Account<'info, Merchant>,
    #[account(
        has_one = merchant,
        constraint = plan.active @ ErrorCode::PlanInactive,
    )]
    pub plan: Account<'info, Plan>,
    #[account(
        init,
        payer = buyer,
        space = 8 + Card::INIT_SPACE,
        seeds = [CARD_SEED, plan.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub card: Account<'info, Card>,
    pub system_program: Program<'info, System>,
}

pub fn handle_buy_card(ctx: Context<BuyCard>) -> Result<()> {
    let plan = &ctx.accounts.plan;
    let price = plan.price;

    // 钱进入卡片 PDA 托管，而不是直接给商家
    system_program::transfer(
        CpiContext::new(
            system_program::ID,
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.card.to_account_info(),
            },
        ),
        price,
    )?;

    let card = &mut ctx.accounts.card;
    card.owner = ctx.accounts.buyer.key();
    card.merchant = ctx.accounts.merchant.key();
    card.plan = plan.key();
    card.total_sessions = plan.sessions;
    card.remaining_sessions = plan.sessions;
    card.per_session = price / plan.sessions as u64;
    card.escrow = price;
    card.purchased_ts = Clock::get()?.unix_timestamp;
    card.bump = ctx.bumps.card;

    let merchant = &mut ctx.accounts.merchant;
    merchant.cards_sold = merchant
        .cards_sold
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;
    merchant.total_escrowed = merchant
        .total_escrowed
        .checked_add(price)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(CardPurchased {
        card: card.key(),
        owner: card.owner,
        merchant: card.merchant,
        amount: price,
        sessions: card.total_sessions,
    });
    Ok(())
}
