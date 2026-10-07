'use client';

import { AlertCircle, ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';
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
  if (isRunning)
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <Loader2 size={13} className="animate-spin" /> {t('tx.pending')}
      </p>
    );
  if (error)
    return (
      <p className="flex items-start gap-2 text-xs text-danger">
        <AlertCircle size={13} className="mt-px shrink-0" /> {friendlyError(error, t)}
      </p>
    );
  if (signature)
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <CheckCircle2 size={13} className="text-accent" /> {t('tx.confirmed')}
        <a
          className="inline-flex items-center gap-0.5 text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
          href={explorerUrl('tx', signature)}
          target="_blank"
          rel="noreferrer"
        >
          {t('tx.view')} <ArrowUpRight size={12} />
        </a>
      </p>
    );
  return null;
}
