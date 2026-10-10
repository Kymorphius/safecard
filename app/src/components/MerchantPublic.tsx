'use client';

import { type Address, isAddress } from '@solana/kit';
import { ArrowUpRight, Gift, Lock } from 'lucide-react';
import { type Merchant, fetchMaybeMerchant } from '@/generated';
import { buyIx } from '@/lib/actions';
import { formatMoney } from '@/lib/currency';
import { type UiPlan, fetchTokenTotals, fetchUiCardsByOwner, fetchUiPlans, toTokenTotals } from '@/lib/model';
import { explorerUrl, shortAddr, type WithAddress } from '@/lib/solana';
import { useApp, useNow, usePoll, useSend } from '@/lib/hooks';
import {
  discountPercent,
  fetchLoyalty,
  fetchMembership,
  loyaltyEnabled,
  memberPrice,
  qualifies,
  windowDays,
} from '@/lib/loyalty';
import { useI18n } from '@/lib/i18n';
import { CardView } from './CardView';
import { MerchantStats, StatusBadge } from './MerchantStatus';
import { merchantHasNoRefunds } from '@/lib/badges';
import { NoRefundsPill } from './Badges';
import { TxStatus } from './TxStatus';
import { CurrencyTag, EmptyState, PageHeader, Section } from './ui';

export function MerchantPublic({ merchantAddress }: { merchantAddress: string }) {
  const { client, wallet } = useApp();
  const valid = isAddress(merchantAddress);
  const addr = merchantAddress as Address;
  const send = useSend();
  const { t } = useI18n();
  const now = useNow();

  const merchantQ = usePoll(valid ? `m:${addr}` : null, async () => {
    const m = await fetchMaybeMerchant(client.rpc, addr, { commitment: 'confirmed' });
    return m.exists ? ({ ...m.data, address: m.address } as WithAddress<Merchant>) : null;
  }, 4000);
  const plans = usePoll(valid ? `plans:${addr}` : null, () => fetchUiPlans(client.rpc, addr));
  const tokenStats = usePoll(valid ? `tstats:${addr}` : null, () => fetchTokenTotals(client.rpc, addr), 8000);
  const loyalty = usePoll(valid ? `loyalty:${addr}` : null, () => fetchLoyalty(client.rpc, addr), 15000);
  const membership = usePoll(wallet && valid ? `member:${addr}:${wallet}` : null, () =>
    fetchMembership(client.rpc, addr, wallet!), 6000);
  const myCards = usePoll(wallet && valid ? `cards:${wallet}:${addr}` : null, async () =>
    (await fetchUiCardsByOwner(client.rpc, wallet!)).filter((c) => c.merchant === addr), 4000);

  const refreshAll = () => {
    merchantQ.refresh();
    plans.refresh();
    myCards.refresh();
    tokenStats.refresh();
    membership.refresh();
  };

  if (!valid) return <EmptyState>{t('store.invalid')}</EmptyState>;
  if (merchantQ.data === undefined) return <div className="panel h-64 animate-pulse" />;
  const merchant = merchantQ.data;
  if (!merchant) return <EmptyState>{t('store.notFound')}</EmptyState>;

  const isMember = qualifies(loyalty.data, membership.data, now);
  const buy = async (plan: UiPlan) => {
    const ix = await buyIx(client.identity, plan, isMember);
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
        right={
          <div className="flex flex-wrap items-center gap-2">
            {merchantHasNoRefunds(merchant) && <NoRefundsPill />}
            <StatusBadge merchant={merchant} />
          </div>
        }
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

      {loyaltyEnabled(loyalty.data) && (
        <Section title={t('loyalty.offer')}>
          <MemberOffer loyalty={loyalty.data} checkIns={Number(membership.data?.checkIns ?? 0)} member={isMember} connected={!!wallet} />
        </Section>
      )}

      <Section title={t('store.trackRecord')}>
        <MerchantStats merchant={merchant} tokenTotals={toTokenTotals(tokenStats.data ?? [])} />
      </Section>

      <Section title={t('store.plans')}>
        {!plans.data?.length ? (
          <EmptyState>{t('store.noPlans')}</EmptyState>
        ) : (
          <div className="panel divide-y divide-line overflow-hidden">
            {plans.data.map((p) => (
              <div key={p.address} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium">{p.name}</span>
                    <CurrencyTag symbol={p.currency.symbol} />
                  </div>
                  <div className="num mt-0.5 text-xs text-muted">
                    {isMember && loyalty.data ? (
                      <>
                        <span className="line-through">{formatMoney(p.price, p.currency)}</span>{' '}
                        <span className="text-accent">
                          {t('loyalty.memberPrice')} {formatMoney(memberPrice(p.price, p.sessions, loyalty.data), p.currency)}
                        </span>
                        {' · '}
                        {t('common.sessions', { n: p.sessions })}
                      </>
                    ) : (
                      <>
                        {t('common.sessionsPrice', { n: p.sessions, price: formatMoney(p.price, p.currency) })}{' '}
                        {t('store.perSession', { amount: formatMoney(p.price / BigInt(p.sessions), p.currency) })}
                      </>
                    )}
                  </div>
                </div>
                <button
                  className={ownedPlans.has(p.address) ? 'btn-secondary' : 'btn'}
                  disabled={!wallet || merchant.closed || ownedPlans.has(p.address) || send.isRunning}
                  onClick={() => buy(p)}
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

function MemberOffer({
  loyalty,
  checkIns,
  member,
  connected,
}: {
  loyalty: NonNullable<Parameters<typeof discountPercent>[0]>;
  checkIns: number;
  member: boolean;
  connected: boolean;
}) {
  const { t } = useI18n();
  const pct = discountPercent(loyalty);
  const days = windowDays(loyalty);
  const progress = Math.min(checkIns / loyalty.minCheckIns, 1);
  return (
    <div className="panel flex flex-wrap items-center gap-5 p-5">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent bg-accent-soft text-accent">
        <Gift size={18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-[15px] font-medium">
          {days > 0
            ? t('loyalty.ruleWindow', { pct, n: loyalty.minCheckIns, days })
            : t('loyalty.rule', { pct, n: loyalty.minCheckIns })}
        </div>
        {connected && (
          <>
            <div className="h-1.5 max-w-sm overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className={`text-xs ${member ? 'text-accent' : 'text-muted'}`}>
              {member
                ? t('loyalty.unlocked')
                : checkIns >= loyalty.minCheckIns
                  ? t('loyalty.lapsed')
                  : t('loyalty.progress', { n: checkIns, min: loyalty.minCheckIns })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
