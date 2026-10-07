'use client';

import { type Address, isAddress } from '@solana/kit';
import { type Merchant, fetchMaybeMerchant, getBuyCardInstructionAsync } from '@/generated';
import { fetchCardsByOwner, fetchPlans, formatSol, type WithAddress } from '@/lib/solana';
import { useApp, usePoll, useSend } from '@/lib/hooks';
import { CardView } from './CardView';
import { MerchantStats, StatusBadge } from './MerchantStatus';
import { useI18n } from '@/lib/i18n';
import { TxStatus } from './TxStatus';

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

  if (!valid) return <p className="text-danger">{t('store.invalid')}</p>;
  if (merchantQ.data === undefined) return <p className="text-muted">{t('common.loading')}</p>;
  const merchant = merchantQ.data;
  if (!merchant) return <p className="text-danger">{t('store.notFound')}</p>;

  const buy = async (plan: Address) => {
    const ix = await getBuyCardInstructionAsync({ buyer: client.identity, merchant: addr, plan });
    send.dispatchAsync([ix]).then(refreshAll, () => {});
  };
  const ownedPlans = new Set(myCards.data?.map((c) => c.plan));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{merchant.name}</h1>
        <StatusBadge merchant={merchant} />
      </div>

      {wallet && myCards.data && myCards.data.length > 0 && (
        <section>
          <h2 className="h2">{t('store.myCards')}</h2>
          <div className="space-y-3">
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
        </section>
      )}

      <section>
        <h2 className="h2">{t('store.trackRecord')}</h2>
        <MerchantStats merchant={merchant} />
      </section>

      <section>
        <h2 className="h2">{t('store.plans')}</h2>
        {!plans.data?.length && <p className="text-sm text-muted">{t('store.noPlans')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.data?.map((p) => (
            <div key={p.address} className="card">
              <div className="font-semibold">{p.name}</div>
              <div className="mt-1 text-sm text-muted">
                {t('common.sessionsPrice', { n: p.sessions, price: formatSol(p.price) })}{' '}
                {t('store.perSession', { amount: formatSol(p.price / BigInt(p.sessions)) })}
              </div>
              <button
                className="btn mt-3"
                disabled={!wallet || merchant.closed || ownedPlans.has(p.address) || send.isRunning}
                onClick={() => buy(p.address)}
              >
                {ownedPlans.has(p.address) ? t('store.owned') : !wallet ? t('store.connectToBuy') : t('store.buy')}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2"><TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} /></div>
      </section>
    </div>
  );
}
