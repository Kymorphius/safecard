'use client';

import Link from 'next/link';
import { LangToggle, useI18n } from '@/lib/i18n';
import { WalletButton } from './WalletButton';

export function Nav() {
  const { t, lang } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🛡️</span> SafeCard
          {lang === 'zh' && <span className="hidden text-muted sm:inline">安心卡</span>}
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href="/cards" className="nav-link">{t('nav.myCards')}</Link>
          <Link href="/merchant" className="nav-link">{t('nav.merchant')}</Link>
          <LangToggle />
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
