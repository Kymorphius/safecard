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
  type Plan,
  CARD_DISCRIMINATOR,
  MERCHANT_DISCRIMINATOR,
  PLAN_DISCRIMINATOR,
  SAFECARD_PROGRAM_ADDRESS,
  getCardDecoder,
  getMerchantDecoder,
  getPlanDecoder,
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

export async function findPlanPda(merchant: Address, planId: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: SAFECARD_PROGRAM_ADDRESS,
    seeds: ['plan', getAddressEncoder().encode(merchant), getU64Encoder().encode(planId)],
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

const LAMPORTS_PER_SOL = 1_000_000_000;
export function formatSol(lamports: bigint | number, digits = 4): string {
  const n = Number(lamports) / LAMPORTS_PER_SOL;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
export function solToLamports(sol: string): bigint {
  const [whole, frac = ''] = sol.trim().split('.');
  return BigInt(whole || '0') * BigInt(LAMPORTS_PER_SOL) + BigInt((frac + '000000000').slice(0, 9));
}

export function shortAddr(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export function explorerUrl(kind: 'address' | 'tx', value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=${CLUSTER}`;
}
