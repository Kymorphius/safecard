'use client';

import { explorerUrl } from '@/lib/solana';
import { friendlyError } from '@/lib/errors';
import { useI18n } from '@/lib/i18n';

export function TxStatus({
  isRunning,
  error,
  signature,
}: {
  isRunning: boolean;
  error: unknown;
  signature?: string;
}) {
  const { t } = useI18n();
  if (isRunning) return <p className="text-sm text-muted">{t('tx.pending')}</p>;
  if (error) return <p className="text-sm text-danger">❌ {friendlyError(error, t)}</p>;
  if (signature)
    return (
      <p className="text-sm text-success">
        ✅ {t('tx.confirmed')}{' '}
        <a className="underline" href={explorerUrl('tx', signature)} target="_blank" rel="noreferrer">
          {t('tx.view')}
        </a>
      </p>
    );
  return null;
}
