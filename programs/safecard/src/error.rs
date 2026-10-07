use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Name is too long")]
    NameTooLong,
    #[msg("Inactivity timeout must be positive")]
    InvalidTimeout,
    #[msg("Plan needs at least one session and a price of at least one lamport per session")]
    InvalidPlan,
    #[msg("Merchant is closed")]
    MerchantClosed,
    #[msg("Plan is not on sale")]
    PlanInactive,
    #[msg("No sessions left on this card")]
    NoSessionsLeft,
    #[msg("Refund only allowed when the card is used up or the merchant has closed or gone inactive")]
    RefundNotAllowed,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("This token is not supported (the escrow did not receive the full price)")]
    UnsupportedMint,
}
