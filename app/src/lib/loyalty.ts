/** 会员优惠、商家评分、用户等级 */
import type { Address, GetAccountInfoApi, GetMultipleAccountsApi, GetProgramAccountsApi, Rpc } from '@solana/kit';
import {
  type LoyaltyConfig,
  type Membership,
  type Merchant,
  LOYALTY_CONFIG_DISCRIMINATOR,
  MEMBERSHIP_DISCRIMINATOR,
  fetchMaybeLoyaltyConfig,
  fetchMaybeMembership,
  findLoyaltyPda,
  findMembershipPda,
  getLoyaltyConfigDecoder,
  getMembershipDecoder,
} from '@/generated';
import { type WithAddress, fetchAllOfType } from './solana';
import type { TKey } from './i18n';

type AnyRpc = Rpc<GetProgramAccountsApi & GetMultipleAccountsApi & GetAccountInfoApi>;
const DAY = 86_400;

export async function loyaltyAddress(merchant: Address): Promise<Address> {
  return (await findLoyaltyPda({ merchant }))[0];
}
export async function membershipAddress(merchant: Address, customer: Address): Promise<Address> {
  return (await findMembershipPda({ merchant, owner: customer }))[0];
}

export async function fetchLoyalty(rpc: AnyRpc, merchant: Address): Promise<WithAddress<LoyaltyConfig> | null> {
  const a = await fetchMaybeLoyaltyConfig(rpc, await loyaltyAddress(merchant), { commitment: 'confirmed' });
  return a.exists ? { ...a.data, address: a.address } : null;
}

export async function fetchMembership(
  rpc: AnyRpc,
  merchant: Address,
  customer: Address,
): Promise<WithAddress<Membership> | null> {
  const a = await fetchMaybeMembership(rpc, await membershipAddress(merchant, customer), { commitment: 'confirmed' });
  return a.exists ? { ...a.data, address: a.address } : null;
}

// Membership 布局：discriminator(8) | merchant(32) | customer(32)
export const fetchMembershipsByMerchant = (rpc: AnyRpc, merchant: Address) =>
  fetchAllOfType<Membership>(rpc, MEMBERSHIP_DISCRIMINATOR, getMembershipDecoder(), [{ offset: 8, address: merchant }]);
export const fetchMembershipsByCustomer = (rpc: AnyRpc, customer: Address) =>
  fetchAllOfType<Membership>(rpc, MEMBERSHIP_DISCRIMINATOR, getMembershipDecoder(), [{ offset: 40, address: customer }]);
export const fetchAllMemberships = (rpc: AnyRpc) =>
  fetchAllOfType<Membership>(rpc, MEMBERSHIP_DISCRIMINATOR, getMembershipDecoder());
export const fetchAllLoyalty = (rpc: AnyRpc) =>
  fetchAllOfType<LoyaltyConfig>(rpc, LOYALTY_CONFIG_DISCRIMINATOR, getLoyaltyConfigDecoder());

export function loyaltyEnabled(l: LoyaltyConfig | null | undefined): l is LoyaltyConfig {
  return !!l && l.discountBps > 0;
}

/** 与合约 LoyaltyConfig::qualifies 一致 */
export function qualifies(l: LoyaltyConfig | null | undefined, m: Membership | null | undefined, nowSec: number) {
  if (!loyaltyEnabled(l) || !m) return false;
  return (
    m.checkIns >= BigInt(l.minCheckIns) &&
    (l.activeWindow === BigInt(0) || BigInt(nowSec) - m.lastCheckInTs <= l.activeWindow)
  );
}

/** 与合约 price_for 一致 */
export function memberPrice(price: bigint, sessions: number, l: LoyaltyConfig): bigint {
  const paid = price - (price * BigInt(l.discountBps)) / BigInt(10_000);
  return paid > BigInt(sessions) ? paid : BigInt(sessions);
}

export const discountPercent = (l: LoyaltyConfig) => l.discountBps / 100;
export const windowDays = (l: LoyaltyConfig) => Number(l.activeWindow) / DAY;

/**
 * 商家评分 0–100（链下计算，只用于排序和展示）。
 * 只看近 30 天活跃的会员，每位顾客最多计 10 次签到，避免少数小号刷分；
 * 不同顾客数权重更高；退款率扣分；已关店为 0。
 */
export function merchantScore(m: Merchant, members: Membership[], nowSec: number): number {
  if (m.closed) return 0;
  const active = members.filter((x) => nowSec - Number(x.lastCheckInTs) <= 30 * DAY);
  const reach = active.length;
  const engagement = active.reduce((n, x) => n + Math.min(Number(x.checkIns), 10), 0);
  const activity = 1 - Math.exp(-(reach * 3 + engagement) / 30);
  const sold = Number(m.cardsSold);
  const refundRate = sold ? Number(m.refundCount) / sold : 0;
  return Math.round(100 * activity * (1 - 0.8 * refundRate));
}

export type Level = { key: TKey; min: number; next?: number };
const LEVELS: Level[] = [
  { key: 'level.new', min: 0, next: 5 },
  { key: 'level.regular', min: 5, next: 20 },
  { key: 'level.loyal', min: 20, next: 50 },
  { key: 'level.vip', min: 50 },
];

/** 用户等级：按所有店的签到次数（链上会员记录）累加 */
export function customerLevel(memberships: Membership[]): { total: number; level: Level } {
  const total = memberships.reduce((n, m) => n + Number(m.checkIns), 0);
  const level = [...LEVELS].reverse().find((l) => total >= l.min)!;
  return { total, level };
}
