use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    constants::*,
    error::ErrorCode,
    events::CardPurchased,
    state::{Merchant, MerchantTokenStats, TokenCard, TokenPlan},
};

#[derive(Accounts)]
pub struct BuyTokenCard<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        constraint = !merchant.closed @ ErrorCode::MerchantClosed,
    )]
    pub merchant: Box<Account<'info, Merchant>>,
    #[account(
        has_one = merchant,
        has_one = mint,
        constraint = plan.active @ ErrorCode::PlanInactive,
    )]
    pub plan: Box<Account<'info, TokenPlan>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        seeds = [TOKEN_STATS_SEED, merchant.key().as_ref(), mint.key().as_ref()],
        bump = stats.bump,
    )]
    pub stats: Box<Account<'info, MerchantTokenStats>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = buyer,
        token::token_program = token_program,
    )]
    pub buyer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = buyer,
        space = 8 + TokenCard::INIT_SPACE,
        seeds = [TOKEN_CARD_SEED, plan.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub card: Box<Account<'info, TokenCard>>,
    /// 托管账户：authority 是卡片 PDA，只有程序能动
    #[account(
        init,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = card,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_buy_token_card(ctx: Context<BuyTokenCard>) -> Result<()> {
    let price = ctx.accounts.plan.price;
    let sessions = ctx.accounts.plan.sessions;

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.buyer_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        price,
        ctx.accounts.mint.decimals,
    )?;

    // 带转账手续费等扩展的代币会让托管少收钱，直接拒绝，避免账目对不上
    ctx.accounts.vault.reload()?;
    require!(ctx.accounts.vault.amount == price, ErrorCode::UnsupportedMint);

    let card = &mut ctx.accounts.card;
    card.owner = ctx.accounts.buyer.key();
    card.merchant = ctx.accounts.merchant.key();
    card.plan = ctx.accounts.plan.key();
    card.mint = ctx.accounts.mint.key();
    card.total_sessions = sessions;
    card.remaining_sessions = sessions;
    card.per_session = price / sessions as u64;
    card.escrow = price;
    card.purchased_ts = Clock::get()?.unix_timestamp;
    card.bump = ctx.bumps.card;

    let merchant = &mut ctx.accounts.merchant;
    merchant.cards_sold = merchant
        .cards_sold
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    let stats = &mut ctx.accounts.stats;
    stats.total_escrowed = stats
        .total_escrowed
        .checked_add(price)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(CardPurchased {
        card: card.key(),
        owner: card.owner,
        merchant: card.merchant,
        amount: price,
        sessions,
    });
    Ok(())
}
