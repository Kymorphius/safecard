'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, Pencil, Plus } from 'lucide-react';
import { type Address } from '@solana/kit';
import {
  type Merchant,
  fetchMaybeMerchant,
  findMerchantPda,
  getCloseMerchantInstructionAsync,
  getCreatePlanInstruction,
  getRegisterMerchantInstructionAsync,
  getUpdateMerchantInstructionAsync,
} from '@/generated';
import {
  fetchCardsByMerchant,
  fetchPlans,
  findPlanPda,
  formatSol,
  shortAddr,
  solToLamports,
  type WithAddress,
} from '@/lib/solana';
import { useApp, usePoll, useSend } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { MerchantStats, StatusBadge } from './MerchantStatus';
import { TxStatus } from './TxStatus';
import { EmptyState, PageHeader, Section } from './ui';

const TIMEOUT_PRESETS = [
  { label: 'md.preset60', value: 60 },
  { label: 'md.preset1d', value: 86400 },
  { label: 'md.preset30d', value: 30 * 86400 },
] as const;

export function MerchantDashboard() {
  const { client, wallet } = useApp();
  const [merchantPda, setMerchantPda] = useState<Address | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    setMerchantPda(null);
    if (wallet) findMerchantPda({ authority: wallet }).then(([pda]) => setMerchantPda(pda));
  }, [wallet]);

  const merchantQ = usePoll(merchantPda, async () => {
    const m = await fetchMaybeMerchant(client.rpc, merchantPda!, { commitment: 'confirmed' });
    return m.exists ? ({ ...m.data, address: m.address } as WithAddress<Merchant>) : null;
  });

  if (!wallet)
    return (
      <div className="space-y-6">
        <PageHeader title={t('nav.merchant')} />
        <EmptyState>{t('md.connectFirst')}</EmptyState>
      </div>
    );
  if (merchantQ.data === undefined) return <div className="panel h-64 animate-pulse" />;
  if (merchantQ.data === null) return <RegisterForm onDone={merchantQ.refresh} />;
  return <Dashboard merchant={merchantQ.data} refresh={merchantQ.refresh} />;
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const { client } = useApp();
  const send = useSend();
  const { t } = useI18n();
  const [name, setName] = useState<string>(t('md.defaultShopName'));
  const [timeout, setTimeout_] = useState(60);

  const submit = async () => {
    const ix = await getRegisterMerchantInstructionAsync({
      authority: client.identity,
      name,
      inactivityTimeout: timeout,
    });
    send.dispatchAsync([ix]).then(onDone, () => {});
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pt-6">
      <PageHeader eyebrow={t('nav.merchant')} title={t('md.register')} />
      <div className="panel space-y-5 p-6">
        <div>
          <label className="label">{t('md.shopName')}</label>
          <input className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('md.timeoutLabel')}</label>
          <div className="grid grid-cols-3 gap-2">
            {TIMEOUT_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setTimeout_(p.value)}
                className={`rounded-xl border px-2 py-2.5 text-xs transition-colors ${
                  timeout === p.value
                    ? 'border-accent bg-accent-soft text-fg'
                    : 'border-line-strong text-muted hover:text-fg'
                }`}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>
        <button className="btn w-full" disabled={!name || send.isRunning} onClick={submit}>
          {t('md.registerBtn')}
        </button>
        <TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} />
      </div>
    </div>
  );
}

function Dashboard({ merchant, refresh }: { merchant: WithAddress<Merchant>; refresh: () => void }) {
  const { client } = useApp();
  const { t } = useI18n();
  const plans = usePoll(`plans:${merchant.address}`, () => fetchPlans(client.rpc, merchant.address));
  const cards = usePoll(`mcards:${merchant.address}`, () => fetchCardsByMerchant(client.rpc, merchant.address));
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const checkInUrl = `${origin}/m/${merchant.address}`;
  const closeSend = useSend();

  const refreshAll = () => {
    refresh();
    plans.refresh();
    cards.refresh();
  };

  const closeShop = async () => {
    if (!confirm(t('md.closeConfirm'))) return;
    const ix = await getCloseMerchantInstructionAsync({ authority: client.identity });
    closeSend.dispatchAsync([ix]).then(refreshAll, () => {});
  };

  const planName = (addr: string) => plans.data?.find((p) => p.address === addr)?.name ?? '';

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={t('nav.merchant')}
        title={<MerchantName merchant={merchant} onDone={refresh} />}
        sub={<span className="mono text-xs text-subtle">{merchant.address}</span>}
        right={<StatusBadge merchant={merchant} />}
      />

      <MerchantStats merchant={merchant} />

      <div className="grid gap-6 md:grid-cols-[1fr_260px]">
        <Section title={t('md.plans')}>
          <div className="panel overflow-hidden">
            {plans.data?.length ? (
              <ul className="divide-y divide-line">
                {plans.data.map((p) => (
                  <li key={p.address} className="flex items-center justify-between px-5 py-3.5 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="num text-muted">
                      {t('common.sessionsPrice', { n: p.sessions, price: formatSol(p.price) })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">{t('md.noPlans')}</p>
            )}
            {!merchant.closed && (
              <div className="border-t border-line bg-surface-2/50 p-5">
                <PlanForm merchant={merchant} onDone={refreshAll} />
              </div>
            )}
          </div>
        </Section>

        <Section title={t('md.qr')}>
          <div className="panel flex flex-col items-center p-5 text-center">
            <div className="rounded-2xl bg-white p-3">
              {origin ? <QRCodeSVG value={checkInUrl} size={176} /> : <div className="h-[176px] w-[176px]" />}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">{t('md.qrHint')}</p>
            <Link
              className="mt-2 inline-flex items-center gap-0.5 text-xs text-fg underline decoration-line-strong underline-offset-4"
              href={`/m/${merchant.address}`}
            >
              {t('md.openStore')} <ArrowUpRight size={12} />
            </Link>
          </div>
        </Section>
      </div>

      <Section title={t('md.customerCards')}>
        <div className="panel overflow-x-auto">
          {cards.data?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-subtle">
                  <th className="px-5 py-3 font-medium">{t('md.col.customer')}</th>
                  <th className="px-5 py-3 font-medium">{t('md.col.plan')}</th>
                  <th className="px-5 py-3 font-medium">{t('md.col.left')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('md.col.escrow')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-t border-line">
                {cards.data.map((c) => (
                  <tr key={c.address}>
                    <td className="mono px-5 py-3 text-xs">{shortAddr(c.owner)}</td>
                    <td className="px-5 py-3">{planName(c.plan)}</td>
                    <td className="num px-5 py-3">
                      {c.remainingSessions}
                      <span className="text-subtle"> / {c.totalSessions}</span>
                    </td>
                    <td className="num px-5 py-3 text-right">{formatSol(c.escrow)} SOL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">{t('md.noCards')}</p>
          )}
        </div>
      </Section>

      {!merchant.closed && (
        <Section title={t('md.dangerZone')}>
          <div
            className="panel flex flex-wrap items-center justify-between gap-4 p-5"
            style={{ borderColor: 'color-mix(in srgb, var(--danger) 25%, transparent)' }}
          >
            <p className="max-w-lg text-sm text-muted">{t('md.dangerDesc')}</p>
            <div className="space-y-2">
              <button className="btn-danger" disabled={closeSend.isRunning} onClick={closeShop}>
                {t('md.closeBtn')}
              </button>
              <TxStatus isRunning={closeSend.isRunning} error={closeSend.error} signature={closeSend.data} />
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function MerchantName({ merchant, onDone }: { merchant: WithAddress<Merchant>; onDone: () => void }) {
  const { client } = useApp();
  const send = useSend();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(merchant.name);

  if (!editing)
    return (
      <span className="inline-flex items-center gap-3">
        {merchant.name}
        <button
          className="rounded-full p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          onClick={() => {
            setName(merchant.name);
            setEditing(true);
          }}
          aria-label={t('md.rename')}
          title={t('md.rename')}
        >
          <Pencil size={16} />
        </button>
      </span>
    );

  const save = async () => {
    const ix = await getUpdateMerchantInstructionAsync({ authority: client.identity, name });
    send.dispatchAsync([ix]).then(() => {
      setEditing(false);
      onDone();
    }, () => {});
  };

  return (
    <span className="flex flex-col gap-2 text-base font-normal tracking-normal">
      <span className="flex flex-wrap items-center gap-2">
        <input
          className="input h-11 w-72 text-lg"
          value={name}
          maxLength={32}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" disabled={!name || name === merchant.name || send.isRunning} onClick={save}>
          {t('md.save')}
        </button>
        <button className="btn-secondary" disabled={send.isRunning} onClick={() => setEditing(false)}>
          {t('md.cancel')}
        </button>
      </span>
      <TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} />
    </span>
  );
}

function PlanForm({ merchant, onDone }: { merchant: WithAddress<Merchant>; onDone: () => void }) {
  const { client } = useApp();
  const send = useSend();
  const { t } = useI18n();
  const [name, setName] = useState<string>(t('md.defaultPlanName'));
  const [price, setPrice] = useState('0.12');
  // 输入框内容用字符串保存，清空时不会变成 0
  const [sessions, setSessions] = useState('12');
  const sessionsNum = Number(sessions);
  const sessionsValid = Number.isInteger(sessionsNum) && sessionsNum >= 1 && sessionsNum <= 1000;

  const submit = async () => {
    const plan = await findPlanPda(merchant.address, merchant.planCount);
    const ix = getCreatePlanInstruction({
      authority: client.identity,
      merchant: merchant.address,
      plan,
      name,
      price: solToLamports(price),
      sessions: sessionsNum,
    });
    send.dispatchAsync([ix]).then(onDone, () => {});
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
        <div>
          <label className="label">{t('md.planName')}</label>
          <input className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('md.price')}</label>
          <input className="input num" value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('md.sessions')}</label>
          <input
            className="input num"
            type="number"
            min={1}
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn-secondary"
        disabled={!name || !(Number(price) > 0) || !sessionsValid || send.isRunning}
        onClick={submit}
      >
        <Plus size={14} /> {t('md.addPlan')}
      </button>
      <TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} />
    </div>
  );
}
