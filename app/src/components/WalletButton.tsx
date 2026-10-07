'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Wallet } from 'lucide-react';
import {
  useConnect,
  useDisconnect,
  useWallets,
  WalletReadyGate,
} from '@solana/kit-plugin-wallet/react';
import { useApp } from '@/lib/hooks';
import { shortAddr } from '@/lib/solana';
import { useI18n } from '@/lib/i18n';

function Inner() {
  const { client, wallet } = useApp();
  const wallets = useWallets(client);
  const { dispatch: connect, isRunning } = useConnect(client);
  const { dispatch: disconnect } = useDisconnect(client);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (wallet) {
    return (
      <button className="btn-secondary group" onClick={() => disconnect()} title={t('wallet.disconnectHint')}>
        <span className="dot dot-live" />
        <span className="mono text-xs">{shortAddr(wallet)}</span>
        <LogOut size={13} className="text-subtle transition-colors group-hover:text-fg" />
      </button>
    );
  }
  return (
    <div className="relative" ref={ref}>
      <button className="btn" disabled={isRunning} onClick={() => setOpen((o) => !o)}>
        <Wallet size={14} strokeWidth={2} className="hidden sm:block" />
        {isRunning ? t('wallet.connecting') : t('wallet.connect')}
        <ChevronDown size={13} className="hidden opacity-60 sm:block" />
      </button>
      {open && (
        <div className="panel absolute right-0 z-30 mt-2 w-60 p-1.5 shadow-2xl">
          {wallets.length === 0 && <p className="p-3 text-xs leading-relaxed text-muted">{t('wallet.none')}</p>}
          {wallets.map((w) => (
            <button
              key={w.name}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              onClick={() => {
                setOpen(false);
                connect(w);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.icon} alt="" className="h-6 w-6 rounded-md" />
              {w.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WalletButton() {
  const { client, mounted } = useApp();
  const fallback = <div className="h-9 w-32 animate-pulse rounded-full bg-surface-2" />;
  if (!mounted) return fallback;
  return (
    <WalletReadyGate client={client} fallback={fallback}>
      <Inner />
    </WalletReadyGate>
  );
}
