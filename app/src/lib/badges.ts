import {
  type Address,
  type GetSignaturesForAddressApi,
  type GetTransactionApi,
  type Rpc,
  type Signature,
  getBase64Encoder,
} from '@solana/kit';
import {
  type Card,
  type CheckedInEvent,
  type RefundedEvent,
  SAFECARD_PROGRAM_ADDRESS,
  parseCheckedInEvent,
  parseRefundedEvent,
} from '@/generated';
import type { TKey } from './i18n';

/** 最多回溯多少笔交易（公共 RPC 有限流，别太多） */
const HISTORY_LIMIT = 30;
const CONCURRENCY = 3;

export type History = { checkIns: CheckedInEvent[]; refunds: RefundedEvent[] };

/** 从用户最近的交易日志里解析出 SafeCard 的签到和退款事件 */
export async function fetchHistory(
  rpc: Rpc<GetSignaturesForAddressApi & GetTransactionApi>,
  owner: Address,
): Promise<History> {
  const sigs = await rpc.getSignaturesForAddress(owner, { limit: HISTORY_LIMIT, commitment: 'confirmed' }).send();
  const ok = sigs.filter((s) => !s.err).map((s) => s.signature as Signature);
  const base64 = getBase64Encoder();
  const history: History = { checkIns: [], refunds: [] };

  for (let i = 0; i < ok.length; i += CONCURRENCY) {
    const txs = await Promise.all(
      ok.slice(i, i + CONCURRENCY).map((sig) =>
        rpc
          .getTransaction(sig, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' })
          .send()
          .catch(() => null),
      ),
    );
    for (const tx of txs) {
      const logs = tx?.meta?.logMessages ?? [];
      if (!logs.some((l) => l.includes(SAFECARD_PROGRAM_ADDRESS))) continue;
      for (const line of logs) {
        if (!line.startsWith('Program data: ')) continue;
        const bytes = base64.encode(line.slice('Program data: '.length));
        try {
          const e = parseCheckedInEvent(bytes);
          if (e.owner === owner) history.checkIns.push(e);
          continue;
        } catch {}
        try {
          const e = parseRefundedEvent(bytes);
          if (e.owner === owner) history.refunds.push(e);
        } catch {}
      }
    }
  }
  return history;
}

export type Badge = {
  id: 'first' | 'regular' | 'halfway' | 'finisher' | 'protected';
  title: TKey;
  desc: TKey;
  unlocked: boolean;
  /** 未解锁时的进度，例如 3/5 */
  progress?: [number, number];
};

const REGULAR_TARGET = 5;

/** 根据当前持有的卡和链上历史计算用户徽章 */
export function customerBadges(cards: Card[], history: History | undefined): Badge[] {
  const usedOnCards = cards.reduce((n, c) => n + (c.totalSessions - c.remainingSessions), 0);
  // 历史只回溯最近若干笔，和当前卡片的已用次数取较大值
  const totalCheckIns = Math.max(history?.checkIns.length ?? 0, usedOnCards);
  const finished =
    cards.some((c) => c.remainingSessions === 0) || !!history?.checkIns.some((e) => e.remainingSessions === 0);
  const halfway = finished || cards.some((c) => (c.totalSessions - c.remainingSessions) * 2 >= c.totalSessions);
  // 用完的卡关闭时退款金额为 0；金额 > 0 说明是商家违约后拿回的钱
  const protectedRefund = !!history?.refunds.some((e) => e.amount > BigInt(0));

  return [
    { id: 'first', title: 'badge.first', desc: 'badge.first.desc', unlocked: totalCheckIns >= 1 },
    {
      id: 'regular',
      title: 'badge.regular',
      desc: 'badge.regular.desc',
      unlocked: totalCheckIns >= REGULAR_TARGET,
      progress: [Math.min(totalCheckIns, REGULAR_TARGET), REGULAR_TARGET],
    },
    { id: 'halfway', title: 'badge.halfway', desc: 'badge.halfway.desc', unlocked: halfway },
    { id: 'finisher', title: 'badge.finisher', desc: 'badge.finisher.desc', unlocked: finished },
    { id: 'protected', title: 'badge.protected', desc: 'badge.protected.desc', unlocked: protectedRefund },
  ];
}

/** 商家徽章：卖出过卡且从未因违约发生退款 */
export function merchantHasNoRefunds(m: { cardsSold: bigint; refundCount: bigint }): boolean {
  return m.cardsSold > BigInt(0) && m.refundCount === BigInt(0);
}
