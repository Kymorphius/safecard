use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

use crate::{
    constants::*,
    error::ErrorCode,
    events::Refunded,
    state::{Merchant, MerchantTokenStats, TokenCard},
};

/// 退回托管账户里的全部代币，关闭托管账户和卡片（租金都退给用户）。
/// 允许条件与 SOL 卡相同：卡已用完，或商家已关店 / 超时未提供服务。
#[derive(Accounts)]
pub struct RefundToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [TOKEN_CARD_SEED, card.plan.as_ref(), owner.key().as_ref()],
        bump = card.bump,
        has_one = owner,
        has_one = merchant,
        has_one = mint,
        close = owner,
    )]
    pub card: Box<Account<'info, TokenCard>>,
    #[account(mut)]
    pub merchant: Box<Account<'info, Merchant>>,
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
        token::mint = mint,
        token::authority = owner,
        token::token_program = token_program,
    )]
    pub owner_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_refund_token(ctx: Context<RefundToken>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let card = &ctx.accounts.card;
    require!(
        card.remaining_sessions == 0 || ctx.accounts.merchant.is_defaulted(now),
        ErrorCode::RefundNotAllowed
    );

    let escrow = card.escrow;
    let plan = card.plan;
    let owner = card.owner;
    let bump = [card.bump];
    let signer: &[&[&[u8]]] = &[&[TOKEN_CARD_SEED, plan.as_ref(), owner.as_ref(), &bump]];

    // 转出 vault 里的全部余额（包括别人误转进来的），然后关闭 vault
    let vault_balance = ctx.accounts.vault.amount;
    if vault_balance > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.owner_token_account.to_account_info(),
                    authority: ctx.accounts.card.to_account_info(),
                },
                signer,
            ),
            vault_balance,
            ctx.accounts.mint.decimals,
        )?;
    }
    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.owner.to_account_info(),
            authority: ctx.accounts.card.to_account_info(),
        },
        signer,
    ))?;

    if escrow > 0 {
        let stats = &mut ctx.accounts.stats;
        stats.total_escrowed = stats
            .total_escrowed
            .checked_sub(escrow)
            .ok_or(ErrorCode::MathOverflow)?;
        stats.total_refunded = stats
            .total_refunded
            .checked_add(escrow)
            .ok_or(ErrorCode::MathOverflow)?;
        let merchant = &mut ctx.accounts.merchant;
        merchant.refund_count = merchant
            .refund_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
    }

    emit!(Refunded {
        card: ctx.accounts.card.key(),
        owner,
        merchant: ctx.accounts.merchant.key(),
        amount: escrow,
    });
    Ok(())
}
