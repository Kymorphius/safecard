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

/** 营业状态：正常营业（倒计时）/ 超时未服务 / 已关店 */
export function StatusBadge({ merchant }: { merchant: Merchant }) {
  const now = useNow();
  const { t } = useI18n();
  if (merchant.closed || isDefaulted(merchant, now))
    return (
      <span className="pill pill-danger">
        <span className="dot bg-danger" />
        {merchant.closed ? t('status.closed') : t('status.defaulted')}
      </span>
    );
  return (
    <span className="pill pill-ok" title={t('status.openHint')}>
      <span className="dot dot-live" />
      <span className="num">{t('status.open', { time: fmtDuration(secondsUntilDefault(merchant, now), t) })}</span>
    </span>
  );
}

/** 商家链上信用数据 */
export function MerchantStats({ merchant }: { merchant: Merchant }) {
  const { t } = useI18n();
  const sold = Number(merchant.cardsSold);
  const refundRate = sold === 0 ? 0 : (Number(merchant.refundCount) / sold) * 100;
  const items = [
    { label: t('stats.escrow'), value: formatSol(merchant.totalEscrowed), unit: 'SOL', hint: t('stats.escrowHint') },
    { label: t('stats.released'), value: formatSol(merchant.totalReleased), unit: 'SOL', hint: t('stats.releasedHint') },
    { label: t('stats.refunded'), value: formatSol(merchant.totalRefunded), unit: 'SOL', hint: t('stats.refundedHint') },
    {
      label: t('stats.soldRate'),
      value: t('stats.soldRateValue', { n: sold, rate: refundRate.toFixed(0) }),
      unit: '',
      hint: '',
    },
  ];
  return (
    <div className="panel grid grid-cols-2 sm:grid-cols-4">
      {items.map((i, idx) => (
        <div
          key={i.label}
          title={i.hint}
          className={`p-4 sm:p-5 ${idx % 2 === 1 ? 'border-l border-line' : ''} ${idx >= 2 ? 'border-t border-line sm:border-t-0' : ''} ${idx === 2 ? 'sm:border-l' : ''}`}
        >
          <div className="text-xs text-muted">{i.label}</div>
          <div className="num mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {i.value}
            {i.unit && <span className="ml-1 text-xs font-normal text-subtle">{i.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
