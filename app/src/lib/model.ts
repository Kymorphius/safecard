/** 把 SOL 套餐/卡片和代币套餐/卡片统一成同一种视图模型，组件里不再区分 */
import type { Address, GetProgramAccountsApi, Rpc } from '@solana/kit';
import type { Card, MerchantTokenStats, Plan, TokenCard, TokenPlan } from '@/generated';
import { type Currency, SOL, currencyForMint } from './currency';
import {
  type WithAddress,
  fetchCardsByMerchant,
  fetchCardsByOwner,
  fetchPlans,
  fetchTokenCardsByMerchant,
  fetchTokenCardsByOwner,
  fetchTokenPlans,
  fetchTokenStats,
} from './solana';

type AnyRpc = Rpc<GetProgramAccountsApi>;

export type UiPlan = {
  kind: 'sol' | 'token';
  address: Address;
  merchant: Address;
  planId: bigint;
  name: string;
  sessions: number;
  price: bigint;
  currency: Currency;
};

export type UiCard = {
  kind: 'sol' | 'token';
  address: Address;
  owner: Address;
  merchant: Address;
  plan: Address;
  totalSessions: number;
  remainingSessions: number;
  perSession: bigint;
  escrow: bigint;
  currency: Currency;
};

const solPlan = (p: WithAddress<Plan>): UiPlan => ({ kind: 'sol', currency: SOL, ...pick(p) });
const tokenPlan = (p: WithAddress<TokenPlan>): UiPlan => ({ kind: 'token', currency: currencyForMint(p.mint), ...pick(p) });
function pick(p: WithAddress<Plan | TokenPlan>) {
  return { address: p.address, merchant: p.merchant, planId: p.planId, name: p.name, sessions: p.sessions, price: p.price };
}

const solCard = (c: WithAddress<Card>): UiCard => ({ kind: 'sol', currency: SOL, ...pickCard(c) });
const tokenCard = (c: WithAddress<TokenCard>): UiCard => ({
  kind: 'token',
  currency: currencyForMint(c.mint),
  ...pickCard(c),
});
function pickCard(c: WithAddress<Card | TokenCard>) {
  return {
    address: c.address,
    owner: c.owner,
    merchant: c.merchant,
    plan: c.plan,
    totalSessions: c.totalSessions,
    remainingSessions: c.remainingSessions,
    perSession: c.perSession,
    escrow: c.escrow,
  };
}

export async function fetchUiPlans(rpc: AnyRpc, merchant: Address): Promise<UiPlan[]> {
  const [sol, token] = await Promise.all([fetchPlans(rpc, merchant), fetchTokenPlans(rpc, merchant)]);
  return [...sol.map(solPlan), ...token.map(tokenPlan)].sort((a, b) => Number(a.planId - b.planId));
}

export async function fetchUiCardsByOwner(rpc: AnyRpc, owner: Address): Promise<UiCard[]> {
  const [sol, token] = await Promise.all([fetchCardsByOwner(rpc, owner), fetchTokenCardsByOwner(rpc, owner)]);
  return [...sol.map(solCard), ...token.map(tokenCard)];
}

export async function fetchUiCardsByMerchant(rpc: AnyRpc, merchant: Address): Promise<UiCard[]> {
  const [sol, token] = await Promise.all([
    fetchCardsByMerchant(rpc, merchant),
    fetchTokenCardsByMerchant(rpc, merchant),
  ]);
  return [...sol.map(solCard), ...token.map(tokenCard)];
}

/** 某商家（或全部商家）在各代币上的金额统计 */
export type TokenTotals = { currency: Currency; escrowed: bigint; released: bigint; refunded: bigint };

export function toTokenTotals(stats: WithAddress<MerchantTokenStats>[]): TokenTotals[] {
  return stats.map((s) => ({
    currency: currencyForMint(s.mint),
    escrowed: s.totalEscrowed,
    released: s.totalReleased,
    refunded: s.totalRefunded,
  }));
}

export async function fetchTokenTotals(rpc: AnyRpc, merchant?: Address): Promise<WithAddress<MerchantTokenStats>[]> {
  return fetchTokenStats(rpc, merchant);
}
