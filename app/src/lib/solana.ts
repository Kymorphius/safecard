import {
  type Address,
  type Decoder,
  type ReadonlyUint8Array,
  type GetProgramAccountsApi,
  type Rpc,
  getAddressEncoder,
  getBase58Decoder,
  getBase64Encoder,
  getProgramDerivedAddress,
  getU64Encoder,
} from '@solana/kit';
import {
  type Card,
  type Merchant,
  type MerchantTokenStats,
  type Plan,
  type TokenCard,
  type TokenPlan,
  CARD_DISCRIMINATOR,
  MERCHANT_DISCRIMINATOR,
  MERCHANT_TOKEN_STATS_DISCRIMINATOR,
  PLAN_DISCRIMINATOR,
  SAFECARD_PROGRAM_ADDRESS,
  TOKEN_CARD_DISCRIMINATOR,
  TOKEN_PLAN_DISCRIMINATOR,
  getCardDecoder,
  getMerchantDecoder,
  getMerchantTokenStatsDecoder,
  getPlanDecoder,
  getTokenCardDecoder,
  getTokenPlanDecoder,
} from '@/generated';

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
export const CLUSTER = 'devnet';

export type WithAddress<T> = T & { address: Address };

type AnyRpc = Rpc<GetProgramAccountsApi>;

const base58 = getBase58Decoder();
const base64 = getBase64Encoder();

/** 按账户类型拉取程序下的所有账户，可附加 memcmp 过滤（偏移量相对账户起始位置） */
async function fetchAllOfType<T extends object>(
  rpc: AnyRpc,
  discriminator: ReadonlyUint8Array,
  decoder: Decoder<T>,
  filters: { offset: number; address: Address }[] = [],
): Promise<WithAddress<T>[]> {
  const res = await rpc
    .getProgramAccounts(SAFECARD_PROGRAM_ADDRESS, {
      encoding: 'base64',
      commitment: 'confirmed',
      filters: [
        { memcmp: { offset: BigInt(0), bytes: base58.decode(discriminator) as never, encoding: 'base58' } },
        ...filters.map((f) => ({
          memcmp: { offset: BigInt(f.offset), bytes: f.address as never, encoding: 'base58' as const },
        })),
      ],
    })
    .send();
  return res.map(({ pubkey, account }) => ({
    ...decoder.decode(base64.encode(account.data[0])),
    address: pubkey,
  }));
}

// 账户布局：8 字节 discriminator 之后的字段偏移
export const fetchMerchants = (rpc: AnyRpc) =>
  fetchAllOfType<Merchant>(rpc, MERCHANT_DISCRIMINATOR, getMerchantDecoder());

export const fetchPlans = (rpc: AnyRpc, merchant: Address) =>
  fetchAllOfType<Plan>(rpc, PLAN_DISCRIMINATOR, getPlanDecoder(), [{ offset: 8, address: merchant }]);

export const fetchCardsByOwner = (rpc: AnyRpc, owner: Address) =>
  fetchAllOfType<Card>(rpc, CARD_DISCRIMINATOR, getCardDecoder(), [{ offset: 8, address: owner }]);

export const fetchCardsByMerchant = (rpc: AnyRpc, merchant: Address) =>
  fetchAllOfType<Card>(rpc, CARD_DISCRIMINATOR, getCardDecoder(), [{ offset: 40, address: merchant }]);

export const fetchTokenPlans = (rpc: AnyRpc, merchant: Address) =>
  fetchAllOfType<TokenPlan>(rpc, TOKEN_PLAN_DISCRIMINATOR, getTokenPlanDecoder(), [{ offset: 8, address: merchant }]);

export const fetchTokenCardsByOwner = (rpc: AnyRpc, owner: Address) =>
  fetchAllOfType<TokenCard>(rpc, TOKEN_CARD_DISCRIMINATOR, getTokenCardDecoder(), [{ offset: 8, address: owner }]);

export const fetchTokenCardsByMerchant = (rpc: AnyRpc, merchant: Address) =>
  fetchAllOfType<TokenCard>(rpc, TOKEN_CARD_DISCRIMINATOR, getTokenCardDecoder(), [{ offset: 40, address: merchant }]);

/** 不传 merchant 时返回所有商家的代币统计（首页用） */
export const fetchTokenStats = (rpc: AnyRpc, merchant?: Address) =>
  fetchAllOfType<MerchantTokenStats>(
    rpc,
    MERCHANT_TOKEN_STATS_DISCRIMINATOR,
    getMerchantTokenStatsDecoder(),
    merchant ? [{ offset: 8, address: merchant }] : [],
  );

export async function findPlanPda(
  merchant: Address,
  planId: bigint,
  kind: 'sol' | 'token' = 'sol',
): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: SAFECARD_PROGRAM_ADDRESS,
    seeds: [kind === 'sol' ? 'plan' : 'token_plan', getAddressEncoder().encode(merchant), getU64Encoder().encode(planId)],
  });
  return pda;
}

/** 商家是否已“违约”（关店或超时无签到），与合约 Merchant::is_defaulted 一致 */
export function isDefaulted(m: Merchant, nowSec: number): boolean {
  return m.closed || BigInt(nowSec) - m.lastActiveTs > m.inactivityTimeout;
}

/** 距离可退款还剩多少秒（已违约返回 0） */
export function secondsUntilDefault(m: Merchant, nowSec: number): number {
  if (m.closed) return 0;
  const left = Number(m.lastActiveTs + m.inactivityTimeout) - nowSec + 1;
  return Math.max(0, left);
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function explorerUrl(kind: 'address' | 'tx', value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=${CLUSTER}`;
}
