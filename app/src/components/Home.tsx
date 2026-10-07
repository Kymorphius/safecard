'use client';

import Link from 'next/link';
import { ArrowRight, QrCode, Undo2, Wallet } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { MerchantList } from './MerchantList';
import { PrepaidCard } from './PrepaidCard';

export function Home() {
  const { t, lang } = useI18n();
  const steps = [
    { icon: Wallet, title: t('home.step1.title'), desc: t('home.step1.desc') },
    { icon: QrCode, title: t('home.step2.title'), desc: t('home.step2.desc') },
    { icon: Undo2, title: t('home.step3.title'), desc: t('home.step3.desc') },
  ];
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-12 pt-6 md:grid-cols-[1.15fr_1fr] md:pt-12">
        <div>
          <div className="pill pill-ok mb-6">
            <span className="dot dot-live" />
            {t('home.eyebrow')}
          </div>
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] whitespace-pre-line sm:text-[56px]">
            {t('home.title.pre')}
            <span className={`font-serif font-normal text-accent ${lang === 'en' ? 'italic' : ''}`}>
              {t('home.title.em')}
            </span>
            {t('home.title.post')}
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">{t('home.body')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#merchants" className="btn">
              {t('home.ctaBrowse')} <ArrowRight size={14} />
            </a>
            <Link href="/merchant" className="btn-secondary">
              {t('home.ctaMerchant')}
            </Link>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <div className="w-full max-w-[380px] -rotate-[4deg] transition-transform duration-500 hover:rotate-0">
            <PrepaidCard
              merchantName="Iron Gym"
              planName={t('md.defaultPlanName')}
              used={4}
              total={12}
              escrowSol="0.08"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="eyebrow mb-5">{t('home.howItWorks')}</div>
        <div className="panel grid md:grid-cols-3">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className={`p-6 ${i > 0 ? 'border-t border-line md:border-t-0 md:border-l' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-surface-2">
                  <Icon size={16} strokeWidth={1.75} className="text-accent" />
                </span>
                <span className="mono text-xs text-subtle">0{i + 1}</span>
              </div>
              <div className="mt-5 text-[15px] font-semibold tracking-tight">{title}</div>
              <div className="mt-1.5 text-sm leading-relaxed text-muted">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="merchants" className="scroll-mt-24">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="eyebrow mb-2">{t('home.merchants')}</div>
            <p className="text-sm text-muted">{t('home.merchantsSub')}</p>
          </div>
        </div>
        <MerchantList />
      </section>
    </div>
  );
}
