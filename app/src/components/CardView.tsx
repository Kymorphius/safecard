'use client';

import { Check, Undo2 } from 'lucide-react';
import type { Merchant } from '@/generated';
import { checkInIx, refundIx } from '@/lib/actions';
import { formatMoney } from '@/lib/currency';
import type { UiCard } from '@/lib/model';
import { type WithAddress, isDefaulted } from '@/lib/solana';
import { useApp, useNow, useSend } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { PrepaidCard } from './PrepaidCard';
import { StatusBadge } from './MerchantStatus';
import { TxStatus } from './TxStatus';

export function CardView({
  card,
  merchant,
  planName,
  onChange,
}: {
  card: UiCard;
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
  const money = (n: bigint) => formatMoney(n, card.currency);
  const nextRelease = money(card.remainingSessions === 1 ? card.escrow : card.perSession);

  const run = async (kind: 'checkin' | 'refund') => {
    const ix =
      kind === 'checkin' ? await checkInIx(client.identity, card, merchant) : await refundIx(client.identity, card);
    send.dispatchAsync([ix]).then(onChange, () => {});
  };

  return (
    <div className="panel grid gap-6 p-5 sm:grid-cols-[minmax(0,380px)_1fr] sm:p-6">
      <PrepaidCard
        merchantName={merchant.name}
        planName={planName ?? t('card.default')}
        used={used}
        total={card.totalSessions}
        escrowLabel={money(card.escrow)}
        dimmed={card.remainingSessions === 0}
      />
      <div className="flex flex-col justify-between gap-5">
        <div className="space-y-3">
          <StatusBadge merchant={merchant} />
          <div className="text-sm text-muted">
            {t('card.used', { used, total: card.totalSessions })} · {t('card.left', { n: card.remainingSessions })}
          </div>
        </div>
        {isOwner && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={!canCheckIn || send.isRunning} onClick={() => run('checkin')}>
                <Check size={14} strokeWidth={2.25} />
                {t('card.checkIn')}
              </button>
              <button
                className={canRefund ? 'btn-danger' : 'btn-secondary'}
                disabled={!canRefund || send.isRunning}
                onClick={() => run('refund')}
                title={canRefund ? '' : t('card.refundBlocked')}
              >
                <Undo2 size={14} />
                {card.remainingSessions === 0 ? t('card.close') : t('card.refund', { amount: money(card.escrow) })}
              </button>
            </div>
            {canCheckIn && <p className="text-xs text-subtle">{t('card.checkInHint', { amount: nextRelease })}</p>}
            <TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} />
          </div>
        )}
      </div>
    </div>
  );
}
