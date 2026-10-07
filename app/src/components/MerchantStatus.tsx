'use client';

import type { Merchant } from '@/generated';
import { formatSol, isDefaulted, secondsUntilDefault } from '@/lib/solana';
import { useNow } from '@/lib/hooks';
import { type T, useI18n } from '@/lib/i18n';

function fmtDuration(s: number, t: T): string {
  if (s >= 86400) return t('dur.d', { n: Math.floor(s / 86400) });
  if (s >= 3600) return t('dur.h', { n: Math.floor(s / 3600) });
  if (s >= 60) return t('dur.ms', { m: Math.floor(s / 60), s: s % 60 });
  return t('dur.s', { n: s });
}

/** 营业状态徽章：正常营业（倒计时）/ 疑似跑路 / 已关店 */
export function StatusBadge({ merchant }: { merchant: Merchant }) {
  const now = useNow();
  const { t } = useI18n();
  if (merchant.closed) return <span className="badge badge-danger">{t('status.closed')}</span>;
  if (isDefaulted(merchant, now)) return <span className="badge badge-danger">{t('status.defaulted')}</span>;
  return (
    <span className="badge badge-ok" title={t('status.openHint')}>
      {t('status.open', { time: fmtDuration(secondsUntilDefault(merchant, now), t) })}
    </span>
  );
}

/** 商家链上信用数据 */
export function MerchantStats({ merchant }: { merchant: Merchant }) {
  const { t } = useI18n();
  const sold = Number(merchant.cardsSold);
  const refundRate = sold === 0 ? 0 : (Number(merchant.refundCount) / sold) * 100;
  const items = [
    { label: t('stats.escrow'), value: `${formatSol(merchant.totalEscrowed)} SOL`, hint: t('stats.escrowHint') },
    { label: t('stats.released'), value: `${formatSol(merchant.totalReleased)} SOL`, hint: t('stats.releasedHint') },
    { label: t('stats.refunded'), value: `${formatSol(merchant.totalRefunded)} SOL`, hint: t('stats.refundedHint') },
    { label: t('stats.soldRate'), value: t('stats.soldRateValue', { n: sold, rate: refundRate.toFixed(0) }), hint: '' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-xl bg-hover p-3" title={i.hint}>
          <div className="text-xs text-muted">{i.label}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{i.value}</div>
        </div>
      ))}
    </div>
  );
}
