'use client';

import { BadgeCheck, CalendarCheck, Flame, ShieldCheck, Sprout, Trophy } from 'lucide-react';
import type { Badge } from '@/lib/badges';
import { useI18n } from '@/lib/i18n';

const ICONS = {
  first: Sprout,
  regular: CalendarCheck,
  halfway: Flame,
  finisher: Trophy,
  protected: ShieldCheck,
} as const;

export function BadgeGrid({ badges, loading }: { badges: Badge[]; loading: boolean }) {
  const { t } = useI18n();
  const unlocked = badges.filter((b) => b.unlocked).length;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="section-title">{t('badge.title')}</h2>
        <span className="num text-xs text-subtle">
          {loading ? t('badge.loading') : t('badge.count', { n: unlocked, total: badges.length })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {badges.map((b) => {
          const Icon = ICONS[b.id];
          return (
            <div
              key={b.id}
              className={`panel flex flex-col gap-3 p-4 transition-opacity ${b.unlocked ? '' : 'opacity-45'}`}
              title={t(b.desc)}
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${
                  b.unlocked ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-subtle'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-sm font-semibold">{t(b.title)}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted">{t(b.desc)}</div>
              </div>
              {!b.unlocked && b.progress && (
                <div className="mt-auto">
                  <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(b.progress[0] / b.progress[1]) * 100}%` }}
                    />
                  </div>
                  <div className="num mt-1 text-[11px] text-subtle">
                    {b.progress[0]} / {b.progress[1]}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 商家徽章：从未因违约发生退款 */
export function NoRefundsPill() {
  const { t } = useI18n();
  return (
    <span className="pill pill-ok" title={t('badge.noRefunds.desc')}>
      <BadgeCheck size={13} className="text-accent" />
      {t('badge.noRefunds')}
    </span>
  );
}
