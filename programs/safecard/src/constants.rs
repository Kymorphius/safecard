use anchor_lang::prelude::*;

#[constant]
pub const MERCHANT_SEED: &[u8] = b"merchant";

#[constant]
pub const PLAN_SEED: &[u8] = b"plan";

#[constant]
pub const CARD_SEED: &[u8] = b"card";

pub const MAX_NAME_LEN: usize = 32;
