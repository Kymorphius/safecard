pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5NpKPE9MWxrgDB4NgvTEp2MgQ84uYhENy3M7Tc9UTSW9");

#[program]
pub mod safecard {
    use super::*;

    pub fn register_merchant(
        ctx: Context<RegisterMerchant>,
        name: String,
        inactivity_timeout: i64,
    ) -> Result<()> {
        crate::instructions::register_merchant::handle_register_merchant(
            ctx,
            name,
            inactivity_timeout,
        )
    }

    pub fn create_plan(
        ctx: Context<CreatePlan>,
        name: String,
        price: u64,
        sessions: u32,
    ) -> Result<()> {
        crate::instructions::create_plan::handle_create_plan(ctx, name, price, sessions)
    }

    pub fn buy_card(ctx: Context<BuyCard>) -> Result<()> {
        crate::instructions::buy_card::handle_buy_card(ctx)
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        crate::instructions::check_in::handle_check_in(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        crate::instructions::refund::handle_refund(ctx)
    }

    pub fn create_token_plan(
        ctx: Context<CreateTokenPlan>,
        name: String,
        price: u64,
        sessions: u32,
    ) -> Result<()> {
        crate::instructions::create_token_plan::handle_create_token_plan(ctx, name, price, sessions)
    }

    pub fn buy_token_card(ctx: Context<BuyTokenCard>) -> Result<()> {
        crate::instructions::buy_token_card::handle_buy_token_card(ctx)
    }

    pub fn check_in_token(ctx: Context<CheckInToken>) -> Result<()> {
        crate::instructions::check_in_token::handle_check_in_token(ctx)
    }

    pub fn refund_token(ctx: Context<RefundToken>) -> Result<()> {
        crate::instructions::refund_token::handle_refund_token(ctx)
    }

    pub fn update_merchant(ctx: Context<UpdateMerchant>, name: String) -> Result<()> {
        crate::instructions::update_merchant::handle_update_merchant(ctx, name)
    }

    pub fn close_merchant(ctx: Context<CloseMerchant>) -> Result<()> {
        crate::instructions::close_merchant::handle_close_merchant(ctx)
    }
}
