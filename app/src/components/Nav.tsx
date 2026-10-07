import Link from 'next/link';
import { WalletButton } from './WalletButton';

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🛡️</span> SafeCard <span className="hidden text-muted sm:inline">安心卡</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          <Link href="/cards" className="nav-link">我的卡</Link>
          <Link href="/merchant" className="nav-link">商家后台</Link>
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}
