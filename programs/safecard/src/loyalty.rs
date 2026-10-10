use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{LoyaltyConfig, Membership},
};

/// 签到时更新会员记录（账户由 init_if_needed 创建）。
pub fn record_check_in(
    member: &mut Membership,
    merchant: Pubkey,
    customer: Pubkey,
    bump: u8,
    now: i64,
) -> Result<()> {
    if member.check_ins == 0 {
        member.merchant = merchant;
        member.customer = customer;
        member.first_check_in_ts = now;
        member.bump = bump;
    }
    member.check_ins = member.check_ins.checked_add(1).ok_or(ErrorCode::MathOverflow)?;
    member.last_check_in_ts = now;
    Ok(())
}

/// 计算买卡实付金额。两个可选账户都传了且顾客满足条件时打折，否则原价。
/// 传入的账户必须是这位顾客在这家店的 PDA，防止拿别人的会员记录来蹭折扣。
pub fn price_for(
    program_id: &Pubkey,
    price: u64,
    sessions: u32,
    merchant: &Pubkey,
    buyer: &Pubkey,
    loyalty: Option<&Account<LoyaltyConfig>>,
    member: Option<&Account<Membership>>,
    now: i64,
) -> Result<u64> {
    let (Some(loyalty), Some(member)) = (loyalty, member) else {
        return Ok(price);
    };
    let (loyalty_pda, _) = Pubkey::find_program_address(&[LOYALTY_SEED, merchant.as_ref()], program_id);
    let (member_pda, _) =
        Pubkey::find_program_address(&[MEMBER_SEED, merchant.as_ref(), buyer.as_ref()], program_id);
    require_keys_eq!(loyalty.key(), loyalty_pda, ErrorCode::WrongLoyaltyAccount);
    require_keys_eq!(member.key(), member_pda, ErrorCode::WrongLoyaltyAccount);

    if !loyalty.qualifies(member, now) {
        return Ok(price);
    }
    let off = (price as u128 * loyalty.discount_bps as u128 / 10_000) as u64;
    let paid = price.checked_sub(off).ok_or(ErrorCode::MathOverflow)?;
    // 折后每次仍至少 1 个最小单位
    Ok(paid.max(sessions as u64))
}
