use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    safecard::{constants::*, state::*},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
const PRICE: u64 = SOL; // 1 SOL / 10 次
const SESSIONS: u32 = 10;
const DAY: i64 = 86_400;

struct Env {
    svm: LiteSVM,
    shop: Keypair,
    merchant: Pubkey,
    plans: Vec<Pubkey>,
    user: Keypair,
}

fn send(svm: &mut LiteSVM, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
    svm.expire_blockhash();
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&signers[0].pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
}

fn read<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    T::try_deserialize(&mut svm.get_account(key).unwrap().data.as_slice()).unwrap()
}

fn advance_time(svm: &mut LiteSVM, secs: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp += secs;
    svm.set_sysvar(&clock);
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &safecard::id()).0
}

impl Env {
    fn card(&self, plan: usize, buyer: &Pubkey) -> Pubkey {
        pda(&[CARD_SEED, self.plans[plan].as_ref(), buyer.as_ref()])
    }
    fn member(&self, customer: &Pubkey) -> Pubkey {
        pda(&[MEMBER_SEED, self.merchant.as_ref(), customer.as_ref()])
    }
    fn loyalty(&self) -> Pubkey {
        pda(&[LOYALTY_SEED, self.merchant.as_ref()])
    }

    fn set_loyalty(&mut self, signer: &Keypair, min: u32, bps: u16, window: i64) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::SetLoyalty { min_check_ins: min, discount_bps: bps, active_window: window }.data(),
            safecard::accounts::SetLoyalty {
                authority: signer.pubkey(),
                merchant: pda(&[MERCHANT_SEED, signer.pubkey().as_ref()]),
                loyalty: pda(&[LOYALTY_SEED, pda(&[MERCHANT_SEED, signer.pubkey().as_ref()]).as_ref()]),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        send(&mut self.svm, ix, &[signer])
    }

    /// 买卡；loyalty / membership 传 None 表示不申请会员价
    fn buy(&mut self, plan: usize, buyer: &Keypair, loyalty: Option<Pubkey>, membership: Option<Pubkey>) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::BuyCard {}.data(),
            safecard::accounts::BuyCard {
                buyer: buyer.pubkey(),
                merchant: self.merchant,
                plan: self.plans[plan],
                card: self.card(plan, &buyer.pubkey()),
                loyalty,
                membership,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        send(&mut self.svm, ix, &[buyer])
    }

    fn check_in(&mut self, plan: usize, owner: &Keypair) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::CheckIn {}.data(),
            safecard::accounts::CheckIn {
                owner: owner.pubkey(),
                card: self.card(plan, &owner.pubkey()),
                merchant: self.merchant,
                authority: self.shop.pubkey(),
                membership: self.member(&owner.pubkey()),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        send(&mut self.svm, ix, &[owner])
    }

    fn escrow(&self, plan: usize, buyer: &Pubkey) -> u64 {
        read::<Card>(&self.svm, &self.card(plan, buyer)).escrow
    }
}

/// 一家店、三个同价套餐（同一顾客每个套餐只能持有一张卡）
fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/safecard.so"));
    svm.add_program(safecard::id(), bytes).unwrap();
    let shop = Keypair::new();
    let user = Keypair::new();
    svm.airdrop(&shop.pubkey(), 10 * SOL).unwrap();
    svm.airdrop(&user.pubkey(), 10 * SOL).unwrap();
    let merchant = pda(&[MERCHANT_SEED, shop.pubkey().as_ref()]);

    send(
        &mut svm,
        Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::RegisterMerchant { name: "Lotus Yoga".into(), inactivity_timeout: 30 * DAY }.data(),
            safecard::accounts::RegisterMerchant { authority: shop.pubkey(), merchant, system_program: system_program::ID }
                .to_account_metas(None),
        ),
        &[&shop],
    )
    .unwrap();

    let mut plans = vec![];
    for i in 0..3u64 {
        let plan = pda(&[PLAN_SEED, merchant.as_ref(), &i.to_le_bytes()]);
        send(
            &mut svm,
            Instruction::new_with_bytes(
                safecard::id(),
                &safecard::instruction::CreatePlan { name: format!("Plan {i}"), price: PRICE, sessions: SESSIONS }.data(),
                safecard::accounts::CreatePlan { authority: shop.pubkey(), merchant, plan, system_program: system_program::ID }
                    .to_account_metas(None),
            ),
            &[&shop],
        )
        .unwrap();
        plans.push(plan);
    }
    Env { svm, shop, merchant, plans, user }
}

/// 顾客在套餐 0 上签到 n 次
fn earn(env: &mut Env, n: usize) {
    let user = env.user.insecure_clone();
    env.buy(0, &user, None, None).unwrap();
    for _ in 0..n {
        env.check_in(0, &user).unwrap();
    }
}

#[test]
fn check_ins_build_membership() {
    let mut env = setup();
    let user = env.user.insecure_clone();
    env.buy(0, &user, None, None).unwrap();
    assert!(env.svm.get_account(&env.member(&user.pubkey())).is_none(), "no membership before first visit");

    env.check_in(0, &user).unwrap();
    let t1: Clock = env.svm.get_sysvar();
    advance_time(&mut env.svm, DAY);
    env.check_in(0, &user).unwrap();
    env.check_in(0, &user).unwrap();

    let m: Membership = read(&env.svm, &env.member(&user.pubkey()));
    assert_eq!((m.merchant, m.customer, m.check_ins), (env.merchant, user.pubkey(), 3));
    assert_eq!(m.first_check_in_ts, t1.unix_timestamp);
    assert_eq!(m.last_check_in_ts, t1.unix_timestamp + DAY);
}

#[test]
fn loyal_customer_gets_discount() {
    let mut env = setup();
    let shop = env.shop.insecure_clone();
    env.set_loyalty(&shop, 3, 1_000, 30 * DAY).unwrap(); // 满 3 次、30 天内来过：9 折
    earn(&mut env, 3);

    let user = env.user.insecure_clone();
    let (loyalty, member) = (env.loyalty(), env.member(&user.pubkey()));
    let before = env.svm.get_balance(&user.pubkey()).unwrap();
    env.buy(1, &user, Some(loyalty), Some(member)).unwrap();
    let paid = PRICE * 9 / 10;
    assert_eq!(env.escrow(1, &user.pubkey()), paid);
    let card: Card = read(&env.svm, &env.card(1, &user.pubkey()));
    assert_eq!(card.per_session, paid / SESSIONS as u64);
    let rent = before - env.svm.get_balance(&user.pubkey()).unwrap() - paid;
    assert!(rent < SOL / 100, "only the discounted price plus rent/fee left the wallet");

    // 不申请会员价就按原价
    env.buy(2, &user, None, None).unwrap();
    assert_eq!(env.escrow(2, &user.pubkey()), PRICE);

    let m: Merchant = read(&env.svm, &env.merchant);
    assert_eq!(m.total_escrowed, (PRICE - 3 * PRICE / 10) + paid + PRICE, "stats use the paid amount");
}

#[test]
fn not_enough_or_stale_visits_pay_full_price() {
    let mut env = setup();
    let shop = env.shop.insecure_clone();
    env.set_loyalty(&shop, 3, 1_000, 7 * DAY).unwrap();
    earn(&mut env, 2);
    let user = env.user.insecure_clone();
    let (loyalty, member) = (env.loyalty(), env.member(&user.pubkey()));

    env.buy(1, &user, Some(loyalty), Some(member)).unwrap();
    assert_eq!(env.escrow(1, &user.pubkey()), PRICE, "2 visits < 3 required");

    env.check_in(0, &user).unwrap(); // 第 3 次
    advance_time(&mut env.svm, 8 * DAY); // 但之后 8 天没来，超过 7 天窗口
    env.buy(2, &user, Some(loyalty), Some(member)).unwrap();
    assert_eq!(env.escrow(2, &user.pubkey()), PRICE, "membership lapsed");
}

#[test]
fn borrowed_or_foreign_accounts_are_rejected() {
    let mut env = setup();
    let shop = env.shop.insecure_clone();
    env.set_loyalty(&shop, 3, 2_000, 0).unwrap();
    earn(&mut env, 3);

    // 新顾客拿老顾客的会员记录来蹭折扣
    let newbie = Keypair::new();
    env.svm.airdrop(&newbie.pubkey(), 10 * SOL).unwrap();
    let (loyalty, regular) = (env.loyalty(), env.member(&env.user.pubkey()));
    let err = env.buy(1, &newbie, Some(loyalty), Some(regular)).unwrap_err();
    assert!(err.contains("WrongLoyaltyAccount"), "{err}");

    // 用另一家店的优惠配置（比如 50% 折扣）
    let other_shop = Keypair::new();
    env.svm.airdrop(&other_shop.pubkey(), 10 * SOL).unwrap();
    let other_merchant = pda(&[MERCHANT_SEED, other_shop.pubkey().as_ref()]);
    send(
        &mut env.svm,
        Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::RegisterMerchant { name: "Other".into(), inactivity_timeout: DAY }.data(),
            safecard::accounts::RegisterMerchant {
                authority: other_shop.pubkey(),
                merchant: other_merchant,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        &[&other_shop],
    )
    .unwrap();
    env.set_loyalty(&other_shop, 1, 5_000, 0).unwrap();
    let foreign = pda(&[LOYALTY_SEED, other_merchant.as_ref()]);
    let user = env.user.insecure_clone();
    let member = env.member(&user.pubkey());
    let err = env.buy(1, &user, Some(foreign), Some(member)).unwrap_err();
    assert!(err.contains("WrongLoyaltyAccount"), "{err}");
}

#[test]
fn only_owner_sets_sane_loyalty() {
    let mut env = setup();
    let shop = env.shop.insecure_clone();
    let err = env.set_loyalty(&shop, 3, 6_000, 0).unwrap_err();
    assert!(err.contains("InvalidLoyalty"), "{err}");
    let err = env.set_loyalty(&shop, 0, 1_000, 0).unwrap_err();
    assert!(err.contains("InvalidLoyalty"), "{err}");

    // 别人改不了这家店的优惠：签名者推导出的是自己的商家账户，而它并不存在
    let attacker = Keypair::new();
    env.svm.airdrop(&attacker.pubkey(), SOL).unwrap();
    let ix = Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::SetLoyalty { min_check_ins: 1, discount_bps: 5_000, active_window: 0 }.data(),
        safecard::accounts::SetLoyalty {
            authority: attacker.pubkey(),
            merchant: env.merchant,
            loyalty: env.loyalty(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());

    // 关闭后原价
    env.set_loyalty(&shop, 3, 1_000, 0).unwrap();
    env.set_loyalty(&shop, 3, 0, 0).unwrap();
    assert_eq!(read::<LoyaltyConfig>(&env.svm, &env.loyalty()).discount_bps, 0);
    earn(&mut env, 3);
    let user = env.user.insecure_clone();
    let (loyalty, member) = (env.loyalty(), env.member(&user.pubkey()));
    env.buy(1, &user, Some(loyalty), Some(member)).unwrap();
    assert_eq!(env.escrow(1, &user.pubkey()), PRICE);
}
