'use client';

import { type Address, isAddress } from '@solana/kit';
import { ArrowUpRight, Lock } from 'lucide-react';
import { type Merchant, fetchMaybeMerchant, getBuyCardInstructionAsync } from '@/generated';
import { explorerUrl, fetchCardsByOwner, fetchPlans, formatSol, shortAddr, type WithAddress } from '@/lib/solana';
import { useApp, usePoll, useSend } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { CardView } from './CardView';
import { MerchantStats, StatusBadge } from './MerchantStatus';
import { TxStatus } from './TxStatus';
import { EmptyState, PageHeader, Section } from './ui';

export function MerchantPublic({ merchantAddress }: { merchantAddress: string }) {
  const { client, wallet } = useApp();
  const valid = isAddress(merchantAddress);
  const addr = merchantAddress as Address;
  const send = useSend();
  const { t } = useI18n();

  const merchantQ = usePoll(valid ? `m:${addr}` : null, async () => {
    const m = await fetchMaybeMerchant(client.rpc, addr, { commitment: 'confirmed' });
    return m.exists ? ({ ...m.data, address: m.address } as WithAddress<Merchant>) : null;
  }, 4000);
  const plans = usePoll(valid ? `plans:${addr}` : null, () => fetchPlans(client.rpc, addr));
  const myCards = usePoll(wallet && valid ? `cards:${wallet}:${addr}` : null, async () =>
    (await fetchCardsByOwner(client.rpc, wallet!)).filter((c) => c.merchant === addr), 4000);

  const refreshAll = () => {
    merchantQ.refresh();
    plans.refresh();
    myCards.refresh();
  };

  if (!valid) return <EmptyState>{t('store.invalid')}</EmptyState>;
  if (merchantQ.data === undefined) return <div className="panel h-64 animate-pulse" />;
  const merchant = merchantQ.data;
  if (!merchant) return <EmptyState>{t('store.notFound')}</EmptyState>;

  const buy = async (plan: Address) => {
    const ix = await getBuyCardInstructionAsync({ buyer: client.identity, merchant: addr, plan });
    send.dispatchAsync([ix]).then(refreshAll, () => {});
  };
  const ownedPlans = new Set(myCards.data?.map((c) => c.plan));

  return (
    <div className="space-y-10">
      <PageHeader
        title={merchant.name}
        sub={
          <a
            href={explorerUrl('address', merchant.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-subtle hover:text-fg"
          >
            {t('store.merchantAccount')} <span className="mono">{shortAddr(merchant.address)}</span>
            <ArrowUpRight size={12} />
          </a>
        }
        right={<StatusBadge merchant={merchant} />}
      />

      {wallet && myCards.data && myCards.data.length > 0 && (
        <Section title={t('store.myCards')}>
          <div className="space-y-4">
            {myCards.data.map((c) => (
              <CardView
                key={c.address}
                card={c}
                merchant={merchant}
                planName={plans.data?.find((p) => p.address === c.plan)?.name}
                onChange={refreshAll}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title={t('store.trackRecord')}>
        <MerchantStats merchant={merchant} />
      </Section>

      <Section title={t('store.plans')}>
        {!plans.data?.length ? (
          <EmptyState>{t('store.noPlans')}</EmptyState>
        ) : (
          <div className="panel divide-y divide-line overflow-hidden">
            {plans.data.map((p) => (
              <div key={p.address} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="text-[15px] font-medium">{p.name}</div>
                  <div className="num mt-0.5 text-xs text-muted">
                    {t('common.sessionsPrice', { n: p.sessions, price: formatSol(p.price) })}{' '}
                    {t('store.perSession', { amount: formatSol(p.price / BigInt(p.sessions)) })}
                  </div>
                </div>
                <button
                  className={ownedPlans.has(p.address) ? 'btn-secondary' : 'btn'}
                  disabled={!wallet || merchant.closed || ownedPlans.has(p.address) || send.isRunning}
                  onClick={() => buy(p.address)}
                >
                  {ownedPlans.has(p.address) ? t('store.owned') : !wallet ? t('store.connectToBuy') : t('store.buy')}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-subtle">
          <Lock size={12} /> {t('store.buyHint')}
        </div>
        <div className="mt-2">
          <TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} />
        </div>
      </Section>
    </div>
  );
}
