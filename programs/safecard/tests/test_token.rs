use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{
            instruction::Instruction, program_option::COption, program_pack::Pack, system_program,
        },
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::{
        associated_token::{self, get_associated_token_address_with_program_id},
        token::spl_token::state::{Account as SplAccount, AccountState, Mint as SplMint},
    },
    litesvm::LiteSVM,
    safecard::{constants::*, state::*},
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
const TIMEOUT: i64 = 60;
const USDC: u64 = 1_000_000; // 6 位小数
const PRICE: u64 = 25 * USDC + 3; // 故意除不尽
const SESSIONS: u32 = 10;

struct Env {
    svm: LiteSVM,
    token_program: Pubkey,
    mint: Pubkey,
    merchant_auth: Keypair,
    merchant: Pubkey,
    plan: Pubkey,
    stats: Pubkey,
    user: Keypair,
    card: Pubkey,
}

impl Env {
    fn ata(&self, owner: &Pubkey) -> Pubkey {
        get_associated_token_address_with_program_id(owner, &self.mint, &self.token_program)
    }
    fn balance(&self, token_account: &Pubkey) -> u64 {
        self.svm
            .get_account(token_account)
            .map(|a| SplAccount::unpack(&a.data[..SplAccount::LEN]).unwrap().amount)
            .unwrap_or(0)
    }
    fn exists(&self, key: &Pubkey) -> bool {
        self.svm.get_account(key).is_some_and(|a| a.lamports > 0)
    }
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

/// 直接写入一个 mint 账户（不需要 mint 私钥）
fn put_mint(svm: &mut LiteSVM, token_program: &Pubkey) -> Pubkey {
    let mint = Pubkey::new_unique();
    let mut data = vec![0u8; SplMint::LEN];
    SplMint::pack(
        SplMint {
            mint_authority: COption::None,
            supply: 1_000_000 * USDC,
            decimals: 6,
            is_initialized: true,
            freeze_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    svm.set_account(
        mint,
        Account { lamports: SOL, data, owner: *token_program, executable: false, rent_epoch: 0 },
    )
    .unwrap();
    mint
}

/// 直接给某人的 ATA 写入代币余额
fn put_tokens(svm: &mut LiteSVM, token_program: &Pubkey, mint: &Pubkey, owner: &Pubkey, amount: u64) -> Pubkey {
    let ata = get_associated_token_address_with_program_id(owner, mint, token_program);
    let mut data = vec![0u8; SplAccount::LEN];
    SplAccount::pack(
        SplAccount {
            mint: *mint,
            owner: *owner,
            amount,
            delegate: COption::None,
            state: AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    svm.set_account(
        ata,
        Account { lamports: SOL / 100, data, owner: *token_program, executable: false, rent_epoch: 0 },
    )
    .unwrap();
    ata
}

fn create_token_plan_ix(env: &Env, plan: Pubkey, mint: Pubkey, name: &str, price: u64) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::CreateTokenPlan { name: name.into(), price, sessions: SESSIONS }.data(),
        safecard::accounts::CreateTokenPlan {
            authority: env.merchant_auth.pubkey(),
            merchant: env.merchant,
            mint,
            plan,
            stats: pda(&[TOKEN_STATS_SEED, env.merchant.as_ref(), mint.as_ref()]),
            merchant_token_account: get_associated_token_address_with_program_id(
                &env.merchant_auth.pubkey(),
                &mint,
                &env.token_program,
            ),
            token_program: env.token_program,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn buy_ix(env: &Env, buyer: &Pubkey) -> Instruction {
    let card = pda(&[TOKEN_CARD_SEED, env.plan.as_ref(), buyer.as_ref()]);
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::BuyTokenCard {}.data(),
        safecard::accounts::BuyTokenCard {
            buyer: *buyer,
            merchant: env.merchant,
            plan: env.plan,
            mint: env.mint,
            stats: env.stats,
            buyer_token_account: env.ata(buyer),
            card,
            vault: env.ata(&card),
            token_program: env.token_program,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn check_in_ix(env: &Env, owner: &Pubkey, payout_owner: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::CheckInToken {}.data(),
        safecard::accounts::CheckInToken {
            owner: *owner,
            card: env.card,
            merchant: env.merchant,
            authority: env.merchant_auth.pubkey(),
            mint: env.mint,
            stats: env.stats,
            vault: env.ata(&env.card),
            merchant_token_account: env.ata(payout_owner),
            token_program: env.token_program,
        }
        .to_account_metas(None),
    )
}

fn refund_ix(env: &Env, owner: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        safecard::id(),
        &safecard::instruction::RefundToken {}.data(),
        safecard::accounts::RefundToken {
            owner: *owner,
            card: env.card,
            merchant: env.merchant,
            mint: env.mint,
            stats: env.stats,
            vault: env.ata(&env.card),
            owner_token_account: env.ata(owner),
            token_program: env.token_program,
        }
        .to_account_metas(None),
    )
}

/// 商家注册、上架 USDC 套餐，用户买卡
fn setup(token_program: Pubkey) -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/safecard.so"));
    svm.add_program(safecard::id(), bytes).unwrap();

    let merchant_auth = Keypair::new();
    let user = Keypair::new();
    svm.airdrop(&merchant_auth.pubkey(), 10 * SOL).unwrap();
    svm.airdrop(&user.pubkey(), 10 * SOL).unwrap();

    let mint = put_mint(&mut svm, &token_program);
    put_tokens(&mut svm, &token_program, &mint, &user.pubkey(), 100 * USDC);

    let merchant = pda(&[MERCHANT_SEED, merchant_auth.pubkey().as_ref()]);
    send(
        &mut svm,
        Instruction::new_with_bytes(
            safecard::id(),
            &safecard::instruction::RegisterMerchant { name: "Lotus Yoga".into(), inactivity_timeout: TIMEOUT }.data(),
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

    let plan = pda(&[TOKEN_PLAN_SEED, merchant.as_ref(), &0u64.to_le_bytes()]);
    let stats = pda(&[TOKEN_STATS_SEED, merchant.as_ref(), mint.as_ref()]);
    let card = pda(&[TOKEN_CARD_SEED, plan.as_ref(), user.pubkey().as_ref()]);
    let mut env = Env { svm, token_program, mint, merchant_auth, merchant, plan, stats, user, card };

    let ix = create_token_plan_ix(&env, plan, mint, "10 Yoga Classes", PRICE);
    send(&mut env.svm, ix, &[&env.merchant_auth]).unwrap();
    let ix = buy_ix(&env, &env.user.pubkey());
    send(&mut env.svm, ix, &[&env.user]).unwrap();
    env
}

fn both_token_programs() -> [Pubkey; 2] {
    [anchor_spl::token::ID, anchor_spl::token_2022::ID]
}

#[test]
fn token_buy_escrows_into_vault() {
    for tp in both_token_programs() {
        let env = setup(tp);
        let user_ata = env.ata(&env.user.pubkey());
        assert_eq!(env.balance(&user_ata), 100 * USDC - PRICE);
        assert_eq!(env.balance(&env.ata(&env.card)), PRICE, "vault holds the full price");

        let card: TokenCard = read(&env.svm, &env.card);
        assert_eq!(card.escrow, PRICE);
        assert_eq!(card.mint, env.mint);
        let stats: MerchantTokenStats = read(&env.svm, &env.stats);
        assert_eq!(stats.total_escrowed, PRICE);
        let merchant: Merchant = read(&env.svm, &env.merchant);
        assert_eq!(merchant.cards_sold, 1);
        assert_eq!(merchant.total_escrowed, 0, "SOL stats untouched by token sales");
    }
}

#[test]
fn token_full_usage_pays_merchant_and_closes_cleanly() {
    for tp in both_token_programs() {
        let mut env = setup(tp);
        let merchant_ata = env.ata(&env.merchant_auth.pubkey());
        for _ in 0..SESSIONS {
            let ix = check_in_ix(&env, &env.user.pubkey(), &env.merchant_auth.pubkey());
            send(&mut env.svm, ix, &[&env.user]).unwrap();
        }
        assert_eq!(env.balance(&merchant_ata), PRICE, "merchant gets the full price incl. remainder");
        assert_eq!(env.balance(&env.ata(&env.card)), 0);

        let ix = check_in_ix(&env, &env.user.pubkey(), &env.merchant_auth.pubkey());
        let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
        assert!(err.contains("NoSessionsLeft"), "{err}");

        // 用完后关闭卡片和 vault，租金退回
        let lamports_before = env.svm.get_balance(&env.user.pubkey()).unwrap();
        let ix = refund_ix(&env, &env.user.pubkey());
        send(&mut env.svm, ix, &[&env.user]).unwrap();
        assert!(!env.exists(&env.card));
        assert!(!env.exists(&env.ata(&env.card)));
        assert!(env.svm.get_balance(&env.user.pubkey()).unwrap() > lamports_before);

        let stats: MerchantTokenStats = read(&env.svm, &env.stats);
        assert_eq!((stats.total_escrowed, stats.total_released, stats.total_refunded), (0, PRICE, 0));
        assert_eq!(read::<Merchant>(&env.svm, &env.merchant).refund_count, 0);
    }
}

#[test]
fn token_runaway_refund_returns_balance() {
    for tp in both_token_programs() {
        let mut env = setup(tp);
        for _ in 0..3 {
            let ix = check_in_ix(&env, &env.user.pubkey(), &env.merchant_auth.pubkey());
            send(&mut env.svm, ix, &[&env.user]).unwrap();
        }
        let left = PRICE - 3 * (PRICE / SESSIONS as u64);
        assert_eq!(read::<TokenCard>(&env.svm, &env.card).escrow, left);

        let ix = refund_ix(&env, &env.user.pubkey());
        let err = send(&mut env.svm, ix, &[&env.user]).unwrap_err();
        assert!(err.contains("RefundNotAllowed"), "{err}");

        advance_time(&mut env.svm, TIMEOUT + 1);
        let user_ata = env.ata(&env.user.pubkey());
        let before = env.balance(&user_ata);
        let ix = refund_ix(&env, &env.user.pubkey());
        send(&mut env.svm, ix, &[&env.user]).unwrap();
        assert_eq!(env.balance(&user_ata) - before, left);
        assert!(!env.exists(&env.card));
        assert!(!env.exists(&env.ata(&env.card)));

        let stats: MerchantTokenStats = read(&env.svm, &env.stats);
        assert_eq!((stats.total_escrowed, stats.total_refunded), (0, left));
        assert_eq!(read::<Merchant>(&env.svm, &env.merchant).refund_count, 1);
    }
}

#[test]
fn token_attacks_are_rejected() {
    let mut env = setup(anchor_spl::token::ID);
    let attacker = Keypair::new();
    env.svm.airdrop(&attacker.pubkey(), 10 * SOL).unwrap();
    put_tokens(&mut env.svm, &env.token_program, &env.mint, &attacker.pubkey(), 0);

    // 别人不能替用户签到
    let ix = check_in_ix(&env, &attacker.pubkey(), &env.merchant_auth.pubkey());
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());

    // 签到款不能转到非商家的代币账户
    let ix = check_in_ix(&env, &env.user.pubkey(), &attacker.pubkey());
    assert!(send(&mut env.svm, ix, &[&env.user]).is_err());
    assert_eq!(env.balance(&env.ata(&attacker.pubkey())), 0);

    // 商家违约后，别人也领不走用户的退款
    advance_time(&mut env.svm, TIMEOUT + 1);
    let ix = refund_ix(&env, &attacker.pubkey());
    assert!(send(&mut env.svm, ix, &[&attacker]).is_err());

    // 用另一种代币冒充套餐的币种买卡
    let fake_mint = put_mint(&mut env.svm, &env.token_program);
    put_tokens(&mut env.svm, &env.token_program, &fake_mint, &attacker.pubkey(), 100 * USDC);
    let mut ix = buy_ix(&env, &attacker.pubkey());
    let card = pda(&[TOKEN_CARD_SEED, env.plan.as_ref(), attacker.pubkey().as_ref()]);
    ix.accounts[3].pubkey = fake_mint; // mint
    ix.accounts[5].pubkey =
        get_associated_token_address_with_program_id(&attacker.pubkey(), &fake_mint, &env.token_program);
    ix.accounts[7].pubkey = get_associated_token_address_with_program_id(&card, &fake_mint, &env.token_program);
    let err = send(&mut env.svm, ix, &[&attacker]).unwrap_err();
    assert!(err.contains("ConstraintHasOne") || err.contains("ConstraintSeeds"), "{err}");

    assert_eq!(env.balance(&env.ata(&env.card)), PRICE, "escrow untouched");
}

#[test]
fn second_plan_in_same_token_keeps_stats() {
    let mut env = setup(anchor_spl::token::ID);
    let plan_count = read::<Merchant>(&env.svm, &env.merchant).plan_count;
    let plan2 = pda(&[TOKEN_PLAN_SEED, env.merchant.as_ref(), &plan_count.to_le_bytes()]);
    let ix = create_token_plan_ix(&env, plan2, env.mint, "20 Yoga Classes", 40 * USDC);
    send(&mut env.svm, ix, &[&env.merchant_auth]).unwrap();
    let stats: MerchantTokenStats = read(&env.svm, &env.stats);
    assert_eq!(stats.total_escrowed, PRICE, "init_if_needed must not reset existing stats");
    assert_eq!(read::<TokenPlan>(&env.svm, &plan2).plan_id, 1);
}
