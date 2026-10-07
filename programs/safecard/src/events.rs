use anchor_lang::prelude::*;

#[event]
pub struct CardPurchased {
    pub card: Pubkey,
    pub owner: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub sessions: u32,
}

#[event]
pub struct CheckedIn {
    pub card: Pubkey,
    pub owner: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub remaining_sessions: u32,
}

#[event]
pub struct Refunded {
    pub card: Pubkey,
    pub owner: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MerchantClosed {
    pub merchant: Pubkey,
}
