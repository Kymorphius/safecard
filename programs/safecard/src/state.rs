use anchor_lang::prelude::*;

use crate::constants::MAX_NAME_LEN;

/// 商家账户。所有统计数据都公开在链上，可以作为“信用分”展示。
#[account]
#[derive(InitSpace)]
pub struct Merchant {
    pub authority: Pubkey,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    /// 超过这么多秒没有任何签到，持卡用户即可退款
    pub inactivity_timeout: i64,
    /// 最近一次签到时间（注册时初始化为注册时间）
    pub last_active_ts: i64,
    pub closed: bool,
    pub plan_count: u64,
    pub cards_sold: u64,
    pub refund_count: u64,
    /// 当前仍托管在各张卡里的总金额
    pub total_escrowed: u64,
    pub total_released: u64,
    pub total_refunded: u64,
    pub bump: u8,
}

impl Merchant {
    /// 商家已关店，或超时未提供服务
    pub fn is_defaulted(&self, now: i64) -> bool {
        self.closed || now.saturating_sub(self.last_active_ts) > self.inactivity_timeout
    }
}

#[account]
#[derive(InitSpace)]
pub struct Plan {
    pub merchant: Pubkey,
    pub plan_id: u64,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    pub price: u64,
    pub sessions: u32,
    pub active: bool,
    pub bump: u8,
}

/// 一张预付卡，同时也是托管账户：未消费的钱就放在这个 PDA 里。
#[account]
#[derive(InitSpace)]
pub struct Card {
    pub owner: Pubkey,
    pub merchant: Pubkey,
    pub plan: Pubkey,
    pub total_sessions: u32,
    pub remaining_sessions: u32,
    pub per_session: u64,
    /// 卡内剩余托管金额（不含租金）
    pub escrow: u64,
    pub purchased_ts: i64,
    pub bump: u8,
}

/// 以 SPL 代币（如 USDC、USDT）计价的套餐。
#[account]
#[derive(InitSpace)]
pub struct TokenPlan {
    pub merchant: Pubkey,
    pub plan_id: u64,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    pub mint: Pubkey,
    /// 以代币最小单位计的总价
    pub price: u64,
    pub sessions: u32,
    pub active: bool,
    pub bump: u8,
}

/// 代币预付卡。钱放在以本账户为 authority 的关联代币账户（vault）里。
#[account]
#[derive(InitSpace)]
pub struct TokenCard {
    pub owner: Pubkey,
    pub merchant: Pubkey,
    pub plan: Pubkey,
    pub mint: Pubkey,
    pub total_sessions: u32,
    pub remaining_sessions: u32,
    pub per_session: u64,
    /// vault 中剩余的托管金额（代币最小单位）
    pub escrow: u64,
    pub purchased_ts: i64,
    pub bump: u8,
}

/// 商家在某个代币上的资金统计（金额不能和 SOL 混在一起算）。
/// 售卡数、退款次数和活跃时间仍记在 Merchant 上，跨币种通用。
#[account]
#[derive(InitSpace)]
pub struct MerchantTokenStats {
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub total_escrowed: u64,
    pub total_released: u64,
    pub total_refunded: u64,
    pub bump: u8,
}
