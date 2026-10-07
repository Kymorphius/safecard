'use client';

import { useState } from 'react';
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
  const { t } = useI18n();

  if (wallet) {
    return (
      <button className="btn-ghost" onClick={() => disconnect()} title={t('wallet.disconnectHint')}>
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {shortAddr(wallet)}
      </button>
    );
  }
  return (
    <div className="relative">
      <button className="btn" disabled={isRunning} onClick={() => setOpen((o) => !o)}>
        {isRunning ? t('wallet.connecting') : t('wallet.connect')}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg">
          {wallets.length === 0 && (
            <p className="p-2 text-sm text-muted">{t('wallet.none')}</p>
          )}
          {wallets.map((w) => (
            <button
              key={w.name}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-hover"
              onClick={() => {
                setOpen(false);
                connect(w);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.icon} alt="" className="h-6 w-6" />
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
  const { t } = useI18n();
  const fallback = <span className="text-sm text-muted">{t('wallet.loading')}</span>;
  if (!mounted) return fallback;
  return (
    <WalletReadyGate client={client} fallback={fallback}>
      <Inner />
    </WalletReadyGate>
  );
}
