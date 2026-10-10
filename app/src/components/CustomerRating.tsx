'use client';

import Link from 'next/link';
import { Award } from 'lucide-react';
import type { Membership, Merchant } from '@/generated';
import { customerLevel } from '@/lib/loyalty';
import type { WithAddress } from '@/lib/solana';
import { useI18n } from '@/lib/i18n';

/** 用户等级 + 常去的店（来自链上会员记录） */
export function CustomerRating({
  memberships,
  merchants,
}: {
  memberships: WithAddress<Membership>[];
  merchants: Map<string, WithAddress<Merchant>>;
}) {
  const { t } = useI18n();
  const { total, level } = customerLevel(memberships);
  const nextLevel = level.next;
  const progress = nextLevel ? (total - level.min) / (nextLevel - level.min) : 1;
  const nextKey = (['level.regular', 'level.loyal', 'level.vip'] as const).find((_, i) => [5, 20, 50][i] === nextLevel);
  const shops = [...memberships].sort((a, b) => Number(b.checkIns - a.checkIns)).slice(0, 4);

  return (
    <section>
      <h2 className="section-title mb-3">{t('rating.title')}</h2>
      <div className="panel grid gap-6 p-5 sm:grid-cols-[1fr_1.4fr] sm:p-6">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent bg-accent-soft text-accent">
            <Award size={20} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{t(level.key)}</div>
            <div className="num text-xs text-muted">{t('rating.total', { n: total })}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(progress, 1) * 100}%` }} />
            </div>
            <div className="num mt-1 text-[11px] text-subtle">
              {nextLevel && nextKey ? t('rating.toNext', { n: nextLevel - total, level: t(nextKey) }) : t('rating.top')}
            </div>
          </div>
        </div>
        <div>
          <div className="eyebrow mb-2">{t('rating.shops')}</div>
          {shops.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="divide-y divide-line">
              {shops.map((m) => (
                <li key={m.address} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/m/${m.merchant}`} className="truncate hover:underline">
                    {merchants.get(m.merchant)?.name ?? m.merchant.slice(0, 6)}
                  </Link>
                  <span className="num text-muted">{t('rating.atShop', { n: m.checkIns.toString() })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
