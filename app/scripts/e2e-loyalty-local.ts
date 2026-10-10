// 会员优惠端到端：用前端同一套代码在本地验证器上跑
//   solana-test-validator --bpf-program <ID> ../target/deploy/safecard.so
//   npx tsx scripts/e2e-loyalty-local.ts
import { createClient, lamports } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { airdropSigner, generatedSigner } from '@solana/kit-plugin-signer';
import {
  fetchMerchant,
  findMerchantPda,
  getRegisterMerchantInstructionAsync,
  getSetLoyaltyInstructionAsync,
} from '../src/generated';
import { buyIx, checkInIx, createPlanIx } from '../src/lib/actions';
import { SOL } from '../src/lib/currency';
import {
  customerLevel,
  fetchLoyalty,
  fetchMembership,
  fetchMembershipsByCustomer,
  fetchMembershipsByMerchant,
  loyaltyAddress,
  memberPrice,
  merchantScore,
  qualifies,
} from '../src/lib/loyalty';
import { fetchUiCardsByOwner, fetchUiPlans } from '../src/lib/model';

const LAMPORTS = 1_000_000_000n;
const makeClient = async () =>
  createClient().use(generatedSigner()).use(solanaLocalRpc()).use(airdropSigner(lamports(5n * LAMPORTS)));
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
}
const now = () => Math.floor(Date.now() / 1000);

async function main() {
  const shop = await makeClient();
  const user = await makeClient();
  await shop.sendTransaction([
    await getRegisterMerchantInstructionAsync({ authority: shop.identity, name: 'Loyal Yoga', inactivityTimeout: 3600 }),
  ]);
  const [mAddr] = await findMerchantPda({ authority: shop.identity.address });
  const merchant = async () => ({ ...(await fetchMerchant(shop.rpc, mAddr)).data, address: mAddr });
  for (const name of ['10 classes', 'Next 10'])
    await shop.sendTransaction([await createPlanIx(shop.identity, await merchant(), SOL, name, LAMPORTS / 10n, 10)]);
  const plans = await fetchUiPlans(shop.rpc, mAddr);

  await shop.sendTransaction([
    await getSetLoyaltyInstructionAsync({
      authority: shop.identity,
      loyalty: await loyaltyAddress(mAddr),
      minCheckIns: 3,
      discountBps: 1000,
      activeWindow: 0,
    }),
  ]);
  const loyalty = await fetchLoyalty(shop.rpc, mAddr);
  assert(loyalty?.discountBps === 1000 && loyalty.minCheckIns === 3, '商家设置会员优惠：满 3 次 9 折');

  await user.sendTransaction([await buyIx(user.identity, plans[0])]);
  let card = (await fetchUiCardsByOwner(user.rpc, user.identity.address))[0];
  for (let i = 0; i < 3; i++) await user.sendTransaction([await checkInIx(user.identity, card, await merchant())]);
  const member = await fetchMembership(user.rpc, mAddr, user.identity.address);
  assert(member?.checkIns === 3n, '签到 3 次后会员记录为 3');
  assert(qualifies(loyalty, member, now()), '前端判定已满足会员条件');

  await user.sendTransaction([await buyIx(user.identity, plans[1], true)]);
  card = (await fetchUiCardsByOwner(user.rpc, user.identity.address)).find((c) => c.plan === plans[1].address)!;
  const expected = memberPrice(plans[1].price, plans[1].sessions, loyalty!);
  assert(card.escrow === expected && expected === (LAMPORTS / 10n) * 9n / 10n, `第二张卡按会员价 ${Number(expected) / 1e9} SOL 买入`);

  const members = await fetchMembershipsByMerchant(shop.rpc, mAddr);
  const score = merchantScore(await merchant(), members, now());
  assert(members.length === 1 && score > 0 && score <= 100, `商家评分 ${score}（基于 1 位活跃顾客、3 次签到）`);
  const { total, level } = customerLevel(await fetchMembershipsByCustomer(user.rpc, user.identity.address));
  assert(total === 3 && level.key === 'level.new', '用户等级：累计 3 次，Newcomer');
  console.log('\nLoyalty E2E 全部通过 ✅');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
