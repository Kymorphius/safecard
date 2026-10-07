'use client';

import Link from 'next/link';
import { type Merchant, type Plan, fetchAllMaybeMerchant, fetchAllMaybePlan } from '@/generated';
import { fetchCardsByOwner, type WithAddress } from '@/lib/solana';
import { useApp, usePoll } from '@/lib/hooks';
import { CardView } from './CardView';

export function MyCards() {
  const { client, wallet } = useApp();
  const q = usePoll(wallet ? `mycards:${wallet}` : null, async () => {
    const cards = await fetchCardsByOwner(client.rpc, wallet!);
    const merchantAddrs = [...new Set(cards.map((c) => c.merchant))];
    const [merchants, plans] = await Promise.all([
      fetchAllMaybeMerchant(client.rpc, merchantAddrs),
      fetchAllMaybePlan(client.rpc, cards.map((c) => c.plan)),
    ]);
    const mMap = new Map<string, WithAddress<Merchant>>();
    merchants.forEach((m) => m.exists && mMap.set(m.address, { ...m.data, address: m.address }));
    const pMap = new Map<string, Plan>();
    plans.forEach((p) => p.exists && pMap.set(p.address, p.data));
    return { cards, mMap, pMap };
  }, 4000);

  if (!wallet) return <p className="text-muted">请先连接钱包。</p>;
  if (!q.data) return <p className="text-muted">读取链上数据…</p>;
  const { cards, mMap, pMap } = q.data;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">我的卡</h1>
      {cards.length === 0 && (
        <p className="text-muted">还没有卡。去 <Link className="underline" href="/">首页</Link> 挑一家店吧。</p>
      )}
      {cards.map((c) => {
        const m = mMap.get(c.merchant);
        return m ? (
          <CardView key={c.address} card={c} merchant={m} planName={pMap.get(c.plan)?.name} onChange={q.refresh} />
        ) : null;
      })}
    </div>
  );
}
