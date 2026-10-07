'use client';

import type { Merchant } from '@/generated';
import { formatSol, isDefaulted, secondsUntilDefault } from '@/lib/solana';
import { useNow } from '@/lib/hooks';

function fmtDuration(s: number): string {
  if (s >= 86400) return `${Math.floor(s / 86400)} 天`;
  if (s >= 3600) return `${Math.floor(s / 3600)} 小时`;
  if (s >= 60) return `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
  return `${s} 秒`;
}

/** 营业状态徽章：正常营业（倒计时）/ 疑似跑路 / 已关店 */
export function StatusBadge({ merchant }: { merchant: Merchant }) {
  const now = useNow();
  if (merchant.closed) return <span className="badge badge-danger">已关店 · 可退款</span>;
  if (isDefaulted(merchant, now)) return <span className="badge badge-danger">超时未服务 · 可退款</span>;
  return (
    <span className="badge badge-ok" title="超过这个时间没有任何签到，持卡人即可退款">
      营业中 · 跑路判定还剩 {fmtDuration(secondsUntilDefault(merchant, now))}
    </span>
  );
}

/** 商家链上信用数据 */
export function MerchantStats({ merchant }: { merchant: Merchant }) {
  const sold = Number(merchant.cardsSold);
  const refundRate = sold === 0 ? 0 : (Number(merchant.refundCount) / sold) * 100;
  const items = [
    { label: '托管中', value: `${formatSol(merchant.totalEscrowed)} SOL`, hint: '用户已付、尚未消费，商家动不了' },
    { label: '已结算给商家', value: `${formatSol(merchant.totalReleased)} SOL`, hint: '用户签到确认后放款' },
    { label: '已退款', value: `${formatSol(merchant.totalRefunded)} SOL`, hint: '商家违约后退回用户' },
    { label: '售卡 / 退款率', value: `${sold} 张 / ${refundRate.toFixed(0)}%`, hint: '' },
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
