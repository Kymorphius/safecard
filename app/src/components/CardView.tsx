'use client';

import { type Address } from '@solana/kit';
import { type Card, type Merchant, getCheckInInstruction, getRefundInstruction } from '@/generated';
import { type WithAddress, formatSol, isDefaulted } from '@/lib/solana';
import { useApp, useNow, useSend } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { TxStatus } from './TxStatus';

export function CardView({
  card,
  merchant,
  planName,
  onChange,
}: {
  card: WithAddress<Card>;
  merchant: WithAddress<Merchant>;
  planName?: string;
  onChange: () => void;
}) {
  const { client, wallet } = useApp();
  const now = useNow();
  const send = useSend();
  const { t } = useI18n();
  const isOwner = wallet === card.owner;
  const used = card.totalSessions - card.remainingSessions;
  const defaulted = isDefaulted(merchant, now);
  const canRefund = card.remainingSessions === 0 || defaulted;
  const canCheckIn = card.remainingSessions > 0 && !merchant.closed;

  const run = (kind: 'checkin' | 'refund') => {
    const ix =
      kind === 'checkin'
        ? getCheckInInstruction({
            owner: client.identity,
            card: card.address,
            merchant: merchant.address,
            authority: merchant.authority as Address,
          })
        : getRefundInstruction({ owner: client.identity, card: card.address, merchant: merchant.address });
    send.dispatchAsync([ix]).then(onChange, () => {});
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm text-muted">{merchant.name}</div>
          <div className="text-lg font-semibold">{planName ?? t('card.default')}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">{t('card.escrow')}</div>
          <div className="text-lg font-semibold tabular-nums">{formatSol(card.escrow)} SOL</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-sm">
          <span>{t('card.used', { used, total: card.totalSessions })}</span>
          <span className="text-muted">{t('card.left', { n: card.remainingSessions })}</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: card.totalSessions }, (_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i < used ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </div>
      </div>

      {isOwner && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn" disabled={!canCheckIn || send.isRunning} onClick={() => run('checkin')}>
            {t('card.checkIn', { amount: formatSol(card.remainingSessions === 1 ? card.escrow : card.perSession) })}
          </button>
          <button
            className={canRefund ? 'btn-danger' : 'btn-ghost'}
            disabled={!canRefund || send.isRunning}
            onClick={() => run('refund')}
            title={canRefund ? '' : t('card.refundBlocked')}
          >
            {card.remainingSessions === 0 ? t('card.close') : t('card.refund', { amount: formatSol(card.escrow) })}
          </button>
        </div>
      )}
      <div className="mt-2">
        <TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} />
      </div>
    </div>
  );
}
