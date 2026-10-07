'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { fetchMerchants, formatSol, shortAddr } from '@/lib/solana';
import { useApp, usePoll } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { StatusBadge } from './MerchantStatus';

export function MerchantList() {
  const { client } = useApp();
  const { t } = useI18n();
  const { data, error, loading } = usePoll('merchants', () => fetchMerchants(client.rpc), 8000);

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
  return (
    <div className="panel divide-y divide-line overflow-hidden">
      {sorted.map((m) => (
        <Link
          key={m.address}
          href={`/m/${m.address}`}
          className="group grid items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[1.4fr_1fr_auto]"
        >
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium">{m.name}</div>
            <div className="mono mt-0.5 text-xs text-subtle">{shortAddr(m.address)}</div>
          </div>
          <div className="flex gap-5 text-xs text-muted">
            <span className="num">{t('home.inEscrow', { amount: formatSol(m.totalEscrowed) })}</span>
            <span className="num">{t('home.sold', { n: m.cardsSold.toString() })}</span>
            <span className="num">{t('home.refunds', { n: m.refundCount.toString() })}</span>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <StatusBadge merchant={m} />
            <ChevronRight size={16} className="text-subtle transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}
