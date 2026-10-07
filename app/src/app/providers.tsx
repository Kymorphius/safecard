'use client';

import React from 'react';
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { ClientProvider } from '@solana/react';
import { RPC_URL } from '@/lib/solana';
import { I18nProvider } from '@/lib/i18n';

// 整个应用共用一个 client；已连接的钱包同时作为付款人和签名人。
// 交易用 v0（默认），兼容目前所有主流钱包。
export const client = createClient()
  .use(walletSigner({ chain: 'solana:devnet', autoConnect: true }))
  .use(solanaRpc({ rpcUrl: RPC_URL }));

export type AppClient = Awaited<typeof client>;

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ClientProvider client={client}>{children}</ClientProvider>
    </I18nProvider>
  );
}
