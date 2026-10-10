'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SOL, currencyForMint, formatMoney } from '@/lib/currency';
import { fetchMerchants, fetchTokenStats, shortAddr } from '@/lib/solana';
import { useApp, usePoll } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { merchantHasNoRefunds } from '@/lib/badges';
import { NoRefundsPill } from './Badges';
import { StatusBadge } from './MerchantStatus';

export function MerchantList() {
  const { client } = useApp();
  const { t } = useI18n();
  const { data, error, loading } = usePoll('merchants', () => fetchMerchants(client.rpc), 8000);
  const tokenStats = usePoll('tstats:all', () => fetchTokenStats(client.rpc), 15000);
  const escrowLabel = (m: { address: string; totalEscrowed: bigint }) => {
    const parts = [formatMoney(m.totalEscrowed, SOL)];
    for (const s of tokenStats.data ?? [])
      if (s.merchant === m.address && s.totalEscrowed > BigInt(0)) parts.push(formatMoney(s.totalEscrowed, currencyForMint(s.mint)));
    return parts.join(' · ');
  };

  if (loading) return <div className="panel h-40 animate-pulse" />;
  if (error) return <p className="text-sm text-danger">{t('common.loadFailed')}</p>;
  if (!data?.length)
    return (
      <div className="panel p-8 text-center text-sm text-muted">
        {t('home.noMerchants.before')}
        <Link className="text-fg underline underline-offset-4" href="/merchant">{t('nav.merchant')}</Link>
        {t('home.noMerchants.after')}
      </div>
    );

  const sorted = [...data].sort((a, b) => Number(b.cardsSold - a.cardsSold));
  // 已关店的商家默认折叠：不再营业，但店铺页保留，持卡人仍可进去退款
  const open = sorted.filter((m) => !m.closed);
  const closed = sorted.filter((m) => m.closed);

  const row = (m: (typeof sorted)[number]) => (
    <Link
      key={m.address}
      href={`/m/${m.address}`}
      className="group grid items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[1.4fr_1fr_auto]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium">{m.name}</span>
          {merchantHasNoRefunds(m) && <NoRefundsPill />}
        </div>
        <div className="mono mt-0.5 text-xs text-subtle">{shortAddr(m.address)}</div>
      </div>
      <div className="flex gap-5 text-xs text-muted">
        <span className="num">{t('home.inEscrow', { amount: escrowLabel(m) })}</span>
        <span className="num">{t('home.sold', { n: m.cardsSold.toString() })}</span>
        <span className="num">{t('home.refunds', { n: m.refundCount.toString() })}</span>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <StatusBadge merchant={m} />
        <ChevronRight size={16} className="text-subtle transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );

  return (
    <div className="space-y-4">
      {open.length > 0 ? (
        <div className="panel divide-y divide-line overflow-hidden">{open.map(row)}</div>
      ) : (
        <div className="panel p-8 text-center text-sm text-muted">{t('home.noOpen')}</div>
      )}
      {closed.length > 0 && (
        <details className="group/closed">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-subtle hover:text-fg">
            <ChevronRight size={14} className="transition-transform group-open/closed:rotate-90" />
            {t('home.closedShops', { n: closed.length })}
          </summary>
          <div className="panel mt-3 divide-y divide-line overflow-hidden opacity-70">{closed.map(row)}</div>
        </details>
      )}
    </div>
  );
}
