'use client';

import Link from 'next/link';
import { fetchMerchants, formatSol } from '@/lib/solana';
import { useApp, usePoll } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { StatusBadge } from './MerchantStatus';

export function MerchantList() {
  const { client } = useApp();
  const { t } = useI18n();
  const { data, error, loading } = usePoll('merchants', () => fetchMerchants(client.rpc), 8000);

  if (loading) return <p className="text-muted">{t('common.loading')}</p>;
  if (error) return <p className="text-danger">{t('common.loadFailed')}</p>;
  if (!data?.length)
    return (
      <p className="text-muted">
        {t('home.noMerchants.before')}
        <Link className="underline" href="/merchant">{t('nav.merchant')}</Link>
        {t('home.noMerchants.after')}
      </p>
    );

  const sorted = [...data].sort((a, b) => Number(b.cardsSold - a.cardsSold));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((m) => (
        <Link key={m.address} href={`/m/${m.address}`} className="card block transition hover:border-accent">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">{m.name}</div>
            <StatusBadge merchant={m} />
          </div>
          <div className="mt-3 flex gap-4 text-sm text-muted">
            <span>{t('home.inEscrow', { amount: formatSol(m.totalEscrowed) })}</span>
            <span>{t('home.sold', { n: m.cardsSold.toString() })}</span>
            <span>{t('home.refunds', { n: m.refundCount.toString() })}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
