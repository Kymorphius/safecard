use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, Space, ToAccountMetas,
    },
    litesvm::LiteSVM,
    safecard::{constants::*, state::*},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
const TIMEOUT: i64 = 60;
const PRICE: u64 = 1_200_000_001; // 故意除不尽，验证最后一次签到放出零头
const SESSIONS: u32 = 12;

struct Env {
    svm: LiteSVM,
    merchant_auth: Keypair,
    merchant: Pubkey,
    plan: Pubkey,
    user: Keypair,
    card: Pubkey,
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
    let acc = svm.get_account(key).unwrap();
    T::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

fn advance_time(svm: &mut LiteSVM, secs: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp += secs;
    svm.set_sysvar(&clock);
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &safecard::id()).0
}

fn card_pda(plan: &Pubkey, owner: &Pubkey) -> Pubkey {
    pda(&[CARD_SEED, plan.as_ref(), owner.as_ref()])
}

fn buy_ix(env: &Env, buyer: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::BuyCard {}.data(),
        safecard::accounts::BuyCard {
            buyer: *buyer,
            merchant: env.merchant,
            plan: env.plan,
            card: card_pda(&env.plan, buyer),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn check_in_ix(env: &Env, owner: &Pubkey, card: &Pubkey, authority: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::CheckIn {}.data(),
        safecard::accounts::CheckIn {
            owner: *owner,
            card: *card,
            merchant: env.merchant,
            authority: *authority,
        }
        .to_account_metas(None),
    )
}

fn refund_ix(env: &Env, owner: &Pubkey, card: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::Refund {}.data(),
        safecard::accounts::Refund {
            owner: *owner,
            card: *card,
            merchant: env.merchant,
        }
        .to_account_metas(None),
    )
}

fn close_merchant_ix(env: &Env, authority: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::CloseMerchant {}.data(),
        safecard::accounts::CloseMerchant {
            authority: *authority,
            merchant: env.merchant,
        }
        .to_account_metas(None),
    )
}

/// 商家注册、上架套餐，用户买卡
fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/safecard.so"
    ));
    svm.add_program(safecard::id(), bytes).unwrap();

    let merchant_auth = Keypair::new();
    let user = Keypair::new();
    svm.airdrop(&merchant_auth.pubkey(), 10 * SOL).unwrap();
    svm.airdrop(&user.pubkey(), 10 * SOL).unwrap();

    let merchant = pda(&[MERCHANT_SEED, merchant_auth.pubkey().as_ref()]);
    let plan = pda(&[PLAN_SEED, merchant.as_ref(), &0u64.to_le_bytes()]);

    send(
        &mut svm,
        Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::RegisterMerchant {
                name: "Iron Gym".into(),
                inactivity_timeout: TIMEOUT,
            }
            .data(),
            safecard::accounts::RegisterMerchant {
                authority: merchant_auth.pubkey(),
                merchant,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        &[&merchant_auth],
    )
    .unwrap();

    send(
        &mut svm,
        Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::CreatePlan {
                name: "12 sessions".into(),
                price: PRICE,
                sessions: SESSIONS,
            }
            .data(),
            safecard::accounts::CreatePlan {
                authority: merchant_auth.pubkey(),
                merchant,
                plan,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        ),
        &[&merchant_auth],
    )
    .unwrap();

    let card = card_pda(&plan, &user.pubkey());
    let mut env = Env {
        svm,
        merchant_auth,
        merchant,
        plan,
        user,
        card,
    };
    let ix = buy_ix(&env, &env.user.pubkey());
    send(&mut env.svm, ix, &[&env.user]).unwrap();
    env
}

#[test]
fn buy_card_escrows_funds() {
    let env = setup();
    let card: Card = read(&env.svm, &env.card);
    assert_eq!(card.escrow, PRICE);
    assert_eq!(card.remaining_sessions, SESSIONS);
    assert_eq!(card.per_session, PRICE / SESSIONS as u64);

    let rent = env.svm.minimum_balance_for_rent_exemption(8 + Card::INIT_SPACE);
    assert_eq!(env.svm.get_balance(&env.card).unwrap(), PRICE + rent);

    let merchant: Merchant = read(&env.svm, &env.merchant);
    assert_eq!(merchant.cards_sold, 1);
    assert_eq!(merchant.total_escrowed, PRICE);
}

#[test]
fn full_usage_releases_everything_to_merchant() {
    let mut env = setup();
    let before = env.svm.get_balance(&env.merchant_auth.pubkey()).unwrap();

    for _ in 0..SESSIONS {
        let ix = check_in_ix(&env, &env.user.pubkey(), &env.card, &env.merchant_auth.pubkey());
        send(&mut env.svm, ix, &[&env.user]).unwrap();
    }

    let after = env.svm.get_balance(&env.merchant_auth.pubkey()).unwrap();
    assert_eq!(after - before, PRICE, "merchant receives the full price incl. remainder");

    let card: Card = read(&env.svm, &env.card);
    assert_eq!(card.remaining_sessions, 0);
    assert_eq!(card.escrow, 0);

    // 用完后不能再签到
    let ix = check_in_ix(&env, &env.user.pubkey(), &env.card, &env.merchant_auth.pubkey());
    let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
    assert!(err.contains("NoSessionsLeft"), "{err}");

    // 用完的卡可以关闭取回租金
    let ix = refund_ix(&env, &env.user.pubkey(), &env.card);
    send(&mut env.svm, ix, &[&env.user]).unwrap();
    assert!(env.svm.get_account(&env.card).map_or(true, |a| a.lamports == 0));

    let merchant: Merchant = read(&env.svm, &env.merchant);
    assert_eq!(merchant.total_escrowed, 0);
    assert_eq!(merchant.total_released, PRICE);
    assert_eq!(merchant.refund_count, 0);
}

#[test]
fn merchant_runs_away_user_gets_refund() {
    let mut env = setup();
    for _ in 0..3 {
        let ix = check_in_ix(&env, &env.user.pubkey(), &env.card, &env.merchant_auth.pubkey());
        send(&mut env.svm, ix, &[&env.user]).unwrap();
    }
    let escrow_left = read::<Card>(&env.svm, &env.card).escrow;
    assert_eq!(escrow_left, PRICE - 3 * (PRICE / SESSIONS as u64));

    // 商家还在营业，不能退款
    let ix = refund_ix(&env, &env.user.pubkey(), &env.card);
    let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
    assert!(err.contains("RefundNotAllowed"), "{err}");

    // 商家跑路：超过 TIMEOUT 没有任何签到
    advance_time(&mut env.svm, TIMEOUT + 1);

    let rent = env.svm.minimum_balance_for_rent_exemption(8 + Card::INIT_SPACE);
    let before = env.svm.get_balance(&env.user.pubkey()).unwrap();
    let ix = refund_ix(&env, &env.user.pubkey(), &env.card);
    send(&mut env.svm, ix, &[&env.user]).unwrap();
    let after = env.svm.get_balance(&env.user.pubkey()).unwrap();
    // 用户拿回剩余托管金额 + 租金，减去交易费
    assert_eq!(after + 5000, before + escrow_left + rent);

    let merchant: Merchant = read(&env.svm, &env.merchant);
    assert_eq!(merchant.total_escrowed, 0);
    assert_eq!(merchant.total_refunded, escrow_left);
    assert_eq!(merchant.refund_count, 1);
}

#[test]
fn check_in_keeps_merchant_alive() {
    let mut env = setup();
    advance_time(&mut env.svm, TIMEOUT - 10);
    let ix = check_in_ix(&env, &env.user.pubkey(), &env.card, &env.merchant_auth.pubkey());
    send(&mut env.svm, ix, &[&env.user]).unwrap();
    advance_time(&mut env.svm, TIMEOUT - 10);

    // 距离上次签到还没超时，不能退款
    let ix = refund_ix(&env, &env.user.pubkey(), &env.card);
    let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
    assert!(err.contains("RefundNotAllowed"), "{err}");
}

#[test]
fn merchant_close_allows_immediate_refund_and_blocks_sales() {
    let mut env = setup();
    let ix = close_merchant_ix(&env, &env.merchant_auth.pubkey());
    send(&mut env.svm, ix, &[&env.merchant_auth]).unwrap();

    // 关店后不能签到
    let ix = check_in_ix(&env, &env.user.pubkey(), &env.card, &env.merchant_auth.pubkey());
    let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
    assert!(err.contains("MerchantClosed"), "{err}");

    // 关店后不能再卖卡
    let other = Keypair::new();
    env.svm.airdrop(&other.pubkey(), 10 * SOL).unwrap();
    let ix = buy_ix(&env, &other.pubkey());
    let err = send(&mut env.svm, ix, &[&other]).unwrap_err();
    assert!(err.contains("MerchantClosed"), "{err}");

    // 立即全额退款
    let ix = refund_ix(&env, &env.user.pubkey(), &env.card);
    send(&mut env.svm, ix, &[&env.user]).unwrap();
    let merchant: Merchant = read(&env.svm, &env.merchant);
    assert_eq!(merchant.total_refunded, PRICE);
}

#[test]
fn attacker_cannot_check_in_or_refund_someone_elses_card() {
    let mut env = setup();
    let attacker = Keypair::new();
    env.svm.airdrop(&attacker.pubkey(), 10 * SOL).unwrap();

    // 别人不能替用户签到（把钱放给商家）
    let ix = check_in_ix(&env, &attacker.pubkey(), &env.card, &env.merchant_auth.pubkey());
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());

    // 不能把签到款转到非商家的地址
    let ix = check_in_ix(&env, &env.user.pubkey(), &env.card, &attacker.pubkey());
    let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
    assert!(err.contains("ConstraintHasOne"), "{err}");

    // 商家跑路后，别人也不能领走用户的退款
    advance_time(&mut env.svm, TIMEOUT + 1);
    let ix = refund_ix(&env, &attacker.pubkey(), &env.card);
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());

    // 非商家本人不能关店
    let ix = close_merchant_ix(&env, &attacker.pubkey());
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());

    // 用户的钱还在
    assert_eq!(read::<Card>(&env.svm, &env.card).escrow, PRICE);
}

fn update_merchant_ix(env: &Env, authority: &Pubkey, name: &str) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::UpdateMerchant { name: name.into() }.data(),
        safecard::accounts::UpdateMerchant {
            authority: *authority,
            merchant: env.merchant,
        }
        .to_account_metas(None),
    )
}

#[test]
fn merchant_can_rename_but_others_cannot() {
    let mut env = setup();
    let ix = update_merchant_ix(&env, &env.merchant_auth.pubkey(), "Lotus Yoga Studio");
    send(&mut env.svm, ix, &[&env.merchant_auth]).unwrap();
    assert_eq!(read::<Merchant>(&env.svm, &env.merchant).name, "Lotus Yoga Studio");

    // 超长名字被拒
    let ix = update_merchant_ix(&env, &env.merchant_auth.pubkey(), &"x".repeat(33));
    let err = send(&mut env.svm, ix, &[&env.merchant_auth]).unwrap_err();
    assert!(err.contains("NameTooLong"), "{err}");

    // 别人不能改
    let attacker = Keypair::new();
    env.svm.airdrop(&attacker.pubkey(), 10 * SOL).unwrap();
    let ix = update_merchant_ix(&env, &attacker.pubkey(), "Scam Gym");
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());
    assert_eq!(read::<Merchant>(&env.svm, &env.merchant).name, "Lotus Yoga Studio");
}
