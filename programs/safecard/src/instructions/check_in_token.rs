use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::ErrorCode,
    events::CheckedIn,
    state::{Merchant, MerchantTokenStats, TokenCard},
};

/// 用户签名确认消费一次，从托管账户放一次的代币给商家。
#[derive(Accounts)]
pub struct CheckInToken<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [TOKEN_CARD_SEED, card.plan.as_ref(), owner.key().as_ref()],
        bump = card.bump,
        has_one = owner,
        has_one = merchant,
        has_one = mint,
    )]
    pub card: Box<Account<'info, TokenCard>>,
    #[account(
        mut,
        has_one = authority,
        constraint = !merchant.closed @ ErrorCode::MerchantClosed,
    )]
    pub merchant: Box<Account<'info, Merchant>>,
    /// 商家钱包，只用来确认收款账户归属
    pub authority: SystemAccount<'info>,
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
        associated_token::mint = mint,
        associated_token::authority = card,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub merchant_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_check_in_token(ctx: Context<CheckInToken>) -> Result<()> {
    let card = &ctx.accounts.card;
    require!(card.remaining_sessions > 0, ErrorCode::NoSessionsLeft);

    // 最后一次把除不尽的零头一起放出
    let amount = if card.remaining_sessions == 1 {
        card.escrow
    } else {
        card.per_session
    };

    let plan = card.plan;
    let owner = card.owner;
    let bump = [card.bump];
    let signer: &[&[&[u8]]] = &[&[TOKEN_CARD_SEED, plan.as_ref(), owner.as_ref(), &bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.merchant_token_account.to_account_info(),
                authority: ctx.accounts.card.to_account_info(),
            },
            signer,
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let card = &mut ctx.accounts.card;
    card.remaining_sessions -= 1;
    card.escrow = card
        .escrow
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;

    let merchant = &mut ctx.accounts.merchant;
    merchant.last_active_ts = Clock::get()?.unix_timestamp;

    let stats = &mut ctx.accounts.stats;
    stats.total_escrowed = stats
        .total_escrowed
        .checked_sub(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    stats.total_released = stats
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
