'use client';

import { useI18n } from '@/lib/i18n';
import { MerchantList } from './MerchantList';

export function Home() {
  const { t } = useI18n();
  const steps = [
    ['💰', t('home.step1.title'), t('home.step1.desc')],
    ['✅', t('home.step2.title'), t('home.step2.desc')],
    ['🏃', t('home.step3.title'), t('home.step3.desc')],
  ];
  return (
    <div className="space-y-8">
      <section className="py-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('home.title')}</h1>
        <p className="mt-3 max-w-2xl text-muted">{t('home.body')}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map(([icon, title, desc]) => (
            <div key={icon} className="card">
              <div className="text-2xl">{icon}</div>
              <div className="mt-2 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-muted">{desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="h2">{t('home.merchants')}</h2>
        <MerchantList />
      </section>
    </div>
  );
}
