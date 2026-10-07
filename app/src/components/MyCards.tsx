'use client';

import Link from 'next/link';
import { type Merchant, fetchAllMaybeMerchant } from '@/generated';
import { fetchUiCardsByOwner, fetchUiPlans } from '@/lib/model';
import type { WithAddress } from '@/lib/solana';
import { customerBadges, fetchHistory } from '@/lib/badges';
import { useApp, usePoll } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { BadgeGrid } from './Badges';
import { CardView } from './CardView';
import { EmptyState, PageHeader } from './ui';

export function MyCards() {
  const { client, wallet } = useApp();
  const { t } = useI18n();
  const q = usePoll(wallet ? `mycards:${wallet}` : null, async () => {
    const cards = await fetchUiCardsByOwner(client.rpc, wallet!);
    const merchantAddrs = [...new Set(cards.map((c) => c.merchant))];
    const [merchants, plans] = await Promise.all([
      fetchAllMaybeMerchant(client.rpc, merchantAddrs),
      Promise.all(merchantAddrs.map((m) => fetchUiPlans(client.rpc, m))),
    ]);
    const mMap = new Map<string, WithAddress<Merchant>>();
    merchants.forEach((m) => m.exists && mMap.set(m.address, { ...m.data, address: m.address }));
    const pMap = new Map(plans.flat().map((p) => [p.address as string, p]));
    return { cards, mMap, pMap };
  }, 4000);
  // 链上历史较重，只在进入页面时读一次，不轮询
  const history = usePoll(wallet ? `history:${wallet}` : null, () => fetchHistory(client.rpc, wallet!), 10 * 60 * 1000);
  const badges = customerBadges(q.data?.cards ?? [], history.data);

  return (
    <div className="space-y-6">
      <PageHeader title={t('my.title')} />
      {wallet && <BadgeGrid badges={badges} loading={history.loading} />}
      {!wallet ? (
        <EmptyState>{t('common.connectFirst')}</EmptyState>
      ) : !q.data ? (
        <div className="panel h-64 animate-pulse" />
      ) : q.data.cards.length === 0 ? (
        <EmptyState>
          {t('my.empty.before')}
          <Link className="text-fg underline underline-offset-4" href="/">{t('my.empty.link')}</Link>
          {t('my.empty.after')}
        </EmptyState>
      ) : (
        q.data.cards.map((c) => {
          const m = q.data!.mMap.get(c.merchant);
          return m ? (
            <CardView key={c.address} card={c} merchant={m} planName={q.data!.pMap.get(c.plan)?.name} onChange={q.refresh} />
          ) : null;
        })
      )}
    </div>
  );
}
