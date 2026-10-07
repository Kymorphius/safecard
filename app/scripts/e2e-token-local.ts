// 代币卡端到端：用前端同一套代码在本地验证器上跑完整流程
//   solana-test-validator --bpf-program <ID> ../target/deploy/safecard.so
//   npx tsx scripts/e2e-token-local.ts
import { createClient, generateKeyPairSigner, lamports } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { airdropSigner, generatedSigner } from '@solana/kit-plugin-signer';
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getCreateMintInstructionPlan,
  getMintToInstruction,
} from '@solana-program/token';
import { fetchMerchant, findMerchantPda, getRegisterMerchantInstructionAsync } from '../src/generated';
import { buyIx, checkInIx, createPlanIx, refundIx } from '../src/lib/actions';
import { fetchHistory, customerBadges } from '../src/lib/badges';
import type { Currency } from '../src/lib/currency';
import { friendlyError } from '../src/lib/errors';
import { fetchTokenTotals, fetchUiCardsByMerchant, fetchUiCardsByOwner, fetchUiPlans } from '../src/lib/model';

const t = ((key: string) => key) as Parameters<typeof friendlyError>[1];
const SOL = 1_000_000_000n;
const U = 1_000_000n; // 6 位小数
const PRICE = 25n * U + 3n;
const makeClient = async () =>
  createClient().use(generatedSigner()).use(solanaLocalRpc()).use(airdropSigner(lamports(5n * SOL)));

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}

async function main() {
  const shop = await makeClient();
  const user = await makeClient();

  // 建一个 6 位小数的测试代币，给用户 100 个
  const mint = await generateKeyPairSigner();
  await shop.sendTransaction(
    await getCreateMintInstructionPlan(shop, {
      payer: shop.payer,
      newMint: mint,
      decimals: 6,
      mintAuthority: shop.identity.address,
    }),
  );
  const [userAta] = await findAssociatedTokenPda({ owner: user.identity.address, mint: mint.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  await shop.sendTransaction([
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: shop.payer, owner: user.identity.address, mint: mint.address }),
    getMintToInstruction({ mint: mint.address, token: userAta, mintAuthority: shop.identity, amount: 100n * U }),
  ]);
  const balance = async (owner: string) => {
    const [ata] = await findAssociatedTokenPda({ owner: owner as never, mint: mint.address, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    return (await fetchToken(shop.rpc, ata)).data.amount;
  };
  const currency: Currency = { symbol: 'TUSD', decimals: 6, mint: mint.address, tokenProgram: TOKEN_PROGRAM_ADDRESS };

  // 商家注册（超时 3 秒），上架一个 SOL 套餐和一个代币套餐
  await shop.sendTransaction([
    await getRegisterMerchantInstructionAsync({ authority: shop.identity, name: 'Token Yoga', inactivityTimeout: 3 }),
  ]);
  const [merchantAddr] = await findMerchantPda({ authority: shop.identity.address });
  const merchant = async () => ({ ...(await fetchMerchant(shop.rpc, merchantAddr)).data, address: merchantAddr });
  await shop.sendTransaction([await createPlanIx(shop.identity, await merchant(), { symbol: 'SOL', decimals: 9, mint: null, tokenProgram: null }, 'SOL plan', 100_000_000n, 10)]);
  await shop.sendTransaction([await createPlanIx(shop.identity, await merchant(), currency, '10 Yoga Classes', PRICE, 10)]);
  const plans = await fetchUiPlans(shop.rpc, merchantAddr);
  assert(plans.length === 2 && plans[0].kind === 'sol' && plans[1].kind === 'token', 'fetchUiPlans 同时返回 SOL 和代币套餐，按编号排序');
  const plan = plans[1];
  assert(plan.price === PRICE && plan.currency.mint === mint.address, '代币套餐价格和币种正确');

  // 买卡
  await user.sendTransaction([await buyIx(user.identity, plan)]);
  assert((await balance(user.identity.address)) === 100n * U - PRICE, '买卡后用户代币余额减少售价');
  let cards = await fetchUiCardsByOwner(user.rpc, user.identity.address);
  assert(cards.length === 1 && cards[0].kind === 'token' && cards[0].escrow === PRICE, 'fetchUiCardsByOwner 查到代币卡，托管金额正确');
  assert((await fetchUiCardsByMerchant(shop.rpc, merchantAddr)).length === 1, 'fetchUiCardsByMerchant 查到顾客的代币卡');
  const card = cards[0];

  // 签到 2 次
  for (let i = 0; i < 2; i++) await user.sendTransaction([await checkInIx(user.identity, card, await merchant())]);
  const per = PRICE / 10n;
  assert((await balance(shop.identity.address)) === 2n * per, '签到 2 次，商家收到 2 次的代币');

  // 营业中退款被拒
  try {
    await user.sendTransaction([await refundIx(user.identity, card)]);
    throw new Error('refund should fail');
  } catch (e) {
    assert(friendlyError(e, t) === 'err.6006', '营业中退款被拒，错误提示正确');
  }

  // 跑路 → 退款
  await new Promise((r) => setTimeout(r, 5000));
  const before = await balance(user.identity.address);
  await user.sendTransaction([await refundIx(user.identity, card)]);
  assert((await balance(user.identity.address)) - before === PRICE - 2n * per, '跑路后退回剩余代币');
  cards = await fetchUiCardsByOwner(user.rpc, user.identity.address);
  assert(cards.length === 0, '代币卡和托管账户已关闭');

  const [stats] = await fetchTokenTotals(shop.rpc, merchantAddr);
  assert(
    stats.totalEscrowed === 0n && stats.totalReleased === 2n * per && stats.totalRefunded === PRICE - 2n * per,
    '商家代币统计正确（托管 0 / 已结算 / 已退款）',
  );
  const m = await merchant();
  assert(m.cardsSold === 1n && m.refundCount === 1n && m.totalEscrowed === 0n, '商家售卡数、退款次数跨币种统计，SOL 金额不受影响');

  // 徽章：代币流程同样被计入
  const h = await fetchHistory(user.rpc, user.identity.address);
  const badges = customerBadges([], h);
  assert(h.checkIns.length === 2 && h.refunds.length === 1, '历史解析到代币卡的 2 次签到和 1 次退款');
  assert(badges.find((b) => b.id === 'protected')!.unlocked, '代币卡跑路退款同样解锁「安心」徽章');
  console.log('\nToken E2E 全部通过 ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
