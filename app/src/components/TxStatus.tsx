'use client';

import { explorerUrl } from '@/lib/solana';
import { friendlyError } from '@/lib/errors';

export function TxStatus({
  isRunning,
  error,
  signature,
}: {
  isRunning: boolean;
  error: unknown;
  signature?: string;
}) {
  if (isRunning) return <p className="text-sm text-muted">等待钱包签名并上链…</p>;
  if (error) return <p className="text-sm text-danger">❌ {friendlyError(error)}</p>;
  if (signature)
    return (
      <p className="text-sm text-success">
        ✅ 已上链{' '}
        <a className="underline" href={explorerUrl('tx', signature)} target="_blank" rel="noreferrer">
          查看交易
        </a>
      </p>
    );
  return null;
}
