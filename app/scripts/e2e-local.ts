// 用前端同一套客户端代码，在本地验证器上跑完整流程：
//   solana-test-validator --bpf-program <ID> ../target/deploy/safecard.so
//   npx tsx scripts/e2e-local.ts
import { createClient, lamports } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { airdropSigner, generatedSigner } from '@solana/kit-plugin-signer';
import {
  fetchMerchant,
  findMerchantPda,
  getBuyCardInstructionAsync,
  getCheckInInstruction,
  getCreatePlanInstruction,
  getRefundInstruction,
  getRegisterMerchantInstructionAsync,
  getUpdateMerchantInstructionAsync,
} from '../src/generated';
import { fetchCardsByMerchant, fetchCardsByOwner, fetchMerchants, fetchPlans, findPlanPda, isDefaulted } from '../src/lib/solana';
import { friendlyError } from '../src/lib/errors';

// 直接返回翻译 key，便于断言
const t = ((key: string) => key) as Parameters<typeof friendlyError>[1];

const SOL = 1_000_000_000n;
const makeClient = async () =>
  createClient().use(generatedSigner()).use(solanaLocalRpc()).use(airdropSigner(lamports(5n * SOL)));

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}

async function main() {
  const shop = await makeClient();
  const user = await makeClient();
  const balance = async (c: typeof shop) => (await c.rpc.getBalance(c.identity.address).send()).value;

  // 商家注册（超时 3 秒）+ 上架
  await shop.sendTransaction([
    await getRegisterMerchantInstructionAsync({ authority: shop.identity, name: 'E2E 健身', inactivityTimeout: 3 }),
  ]);
  const [merchant] = await findMerchantPda({ authority: shop.identity.address });
  let m = (await fetchMerchant(shop.rpc, merchant)).data;
  const plan = await findPlanPda(merchant, m.planCount);
  await shop.sendTransaction([
    getCreatePlanInstruction({ authority: shop.identity, merchant, plan, name: '4 次课', price: 400_000_001n, sessions: 4 }),
  ]);
  assert((await fetchMerchants(shop.rpc)).some((x) => x.address === merchant), 'fetchMerchants 能查到商家');
  await shop.sendTransaction([await getUpdateMerchantInstructionAsync({ authority: shop.identity, name: 'E2E Yoga' })]);
  assert((await fetchMerchant(shop.rpc, merchant)).data.name === 'E2E Yoga', '商家改名成功');
  const plans = await fetchPlans(shop.rpc, merchant);
  assert(plans.length === 1 && plans[0].address === plan, 'fetchPlans 按商家过滤正确');

  // 用户买卡
  await user.sendTransaction([await getBuyCardInstructionAsync({ buyer: user.identity, merchant, plan })]);
  let cards = await fetchCardsByOwner(user.rpc, user.identity.address);
  assert(cards.length === 1 && cards[0].escrow === 400_000_001n, 'fetchCardsByOwner 查到卡，托管金额正确');
  assert((await fetchCardsByMerchant(shop.rpc, merchant)).length === 1, 'fetchCardsByMerchant 查到顾客的卡');
  const card = cards[0];

  // 签到 2 次
  const before = await balance(shop);
  for (let i = 0; i < 2; i++) {
    await user.sendTransaction([
      getCheckInInstruction({ owner: user.identity, card: card.address, merchant, authority: shop.identity.address }),
    ]);
  }
  assert((await balance(shop)) - before === 200_000_000n, '签到 2 次，商家收到 0.2 SOL');

  // 未超时退款应失败，且错误能翻译成中文
  try {
    await user.sendTransaction([getRefundInstruction({ owner: user.identity, card: card.address, merchant })]);
    throw new Error('refund should fail');
  } catch (e) {
    const msg = friendlyError(e, t);
    assert(msg === 'err.6006', `营业中退款被拒，错误提示：「${msg}」`);
  }

  // 等待超时 → 跑路 → 退款
  await new Promise((r) => setTimeout(r, 5000));
  m = (await fetchMerchant(shop.rpc, merchant)).data;
  assert(isDefaulted(m, Math.floor(Date.now() / 1000)), '前端判定商家已违约');
  const ub = await balance(user);
  await user.sendTransaction([getRefundInstruction({ owner: user.identity, card: card.address, merchant })]);
  const refunded = (await balance(user)) - ub;
  assert(refunded > 200_000_001n, `用户退回 ${Number(refunded) / 1e9} SOL（剩余托管 + 租金 - 手续费）`);
  cards = await fetchCardsByOwner(user.rpc, user.identity.address);
  assert(cards.length === 0, '卡片已关闭');
  m = (await fetchMerchant(shop.rpc, merchant)).data;
  assert(m.totalRefunded === 200_000_001n && m.refundCount === 1n && m.totalEscrowed === 0n, '商家信用数据正确');
  console.log('\nE2E 全部通过 ✅');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
