'use client';

import { ShieldCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

/** 拟物预付卡：无论明暗主题都是深色卡面 */
export function PrepaidCard({
  merchantName,
  planName,
  used,
  total,
  escrowLabel,
  dimmed = false,
}: {
  merchantName: string;
  planName: string;
  used: number;
  total: number;
  /** 带单位的托管金额，例如 "0.08 SOL"、"25 USDC" */
  escrowLabel: string;
  dimmed?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`relative aspect-[1.586] w-full max-w-[380px] overflow-hidden rounded-[20px] border border-white/10 p-5 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)] transition-opacity sm:p-6 ${
        dimmed ? 'opacity-60' : ''
      }`}
      style={{
        background:
          'radial-gradient(120% 90% at 100% 0%, rgba(63,216,174,0.22), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(120,120,255,0.12), transparent 60%), linear-gradient(150deg, #1d1d22 0%, #0d0d10 100%)',
      }}
    >
      {/* 细纹理 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 9px)',
        }}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.14em] text-white/70 uppercase">
            <ShieldCheck size={14} strokeWidth={1.75} className="text-[#3fd8ae]" />
            SafeCard
          </div>
          {/* 芯片 */}
          <div className="h-7 w-9 rounded-md border border-white/15 bg-gradient-to-br from-white/25 to-white/5">
            <div className="mx-auto mt-[9px] h-px w-6 bg-white/25" />
            <div className="mx-auto mt-[5px] h-px w-6 bg-white/25" />
          </div>
        </div>

        <div>
          <div className="font-serif text-[26px] leading-none italic sm:text-[30px]">{merchantName}</div>
          <div className="mt-1.5 text-[13px] text-white/60">{planName}</div>
        </div>

        <div>
          <div className="flex gap-[3px]">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={`h-[3px] flex-1 rounded-full ${i < used ? 'bg-white/20' : 'bg-[#3fd8ae]'}`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <div className="text-[10px] tracking-[0.14em] text-white/45 uppercase">{t('card.escrow')}</div>
              <div className="mono num mt-0.5 text-[15px]">{escrowLabel}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[0.14em] text-white/45 uppercase">{t('card.sessions')}</div>
              <div className="mono num mt-0.5 text-[15px]">
                {total - used}
                <span className="text-white/40"> / {total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
