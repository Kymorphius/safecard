'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LangToggle, useI18n } from '@/lib/i18n';
import { LogoMark } from './Logo';
import { WalletButton } from './WalletButton';

function NavLinks() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <>
      {(
        [
          ['/cards', t('nav.myCards')],
          ['/merchant', t('nav.merchant')],
        ] as const
      ).map(([href, label]) => (
        <Link key={href} href={href} className={`nav-link ${path.startsWith(href) ? 'nav-link-active' : ''}`}>
          {label}
        </Link>
      ))}
    </>
  );
}

/** 读取路径前的占位：同样的链接，只是没有高亮 */
function NavLinksFallback() {
  const { t } = useI18n();
  return (
    <>
      <Link href="/cards" className="nav-link">{t('nav.myCards')}</Link>
      <Link href="/merchant" className="nav-link">{t('nav.merchant')}</Link>
    </>
  );
}

export function Nav() {
  const { lang } = useI18n();
  const links = (
    <Suspense fallback={<NavLinksFallback />}>
      <NavLinks />
    </Suspense>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="hidden text-[15px] font-semibold tracking-tight min-[400px]:inline">SafeCard</span>
          {lang === 'zh' && <span className="hidden text-[13px] text-subtle sm:inline">安心卡</span>}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center sm:flex">{links}</div>
          <LangToggle />
          <WalletButton />
        </nav>
      </div>
      {/* 手机端二级导航 */}
      <div className="flex gap-1 border-t border-line px-4 py-1.5 sm:hidden">{links}</div>
    </header>
  );
}
