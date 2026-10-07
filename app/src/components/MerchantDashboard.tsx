'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { type Address } from '@solana/kit';
import {
  fetchMaybeMerchant,
  findMerchantPda,
  getCloseMerchantInstructionAsync,
  getCreatePlanInstruction,
  getRegisterMerchantInstructionAsync,
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
import { MerchantStats, StatusBadge } from './MerchantStatus';
import { TxStatus } from './TxStatus';
import type { Merchant } from '@/generated';

const TIMEOUT_PRESETS = [
  { label: '60 秒（演示用）', value: 60 },
  { label: '1 天', value: 86400 },
  { label: '30 天', value: 30 * 86400 },
];

export function MerchantDashboard() {
  const { client, wallet } = useApp();
  const [merchantPda, setMerchantPda] = useState<Address | null>(null);

  useEffect(() => {
    setMerchantPda(null);
    if (wallet) findMerchantPda({ authority: wallet }).then(([pda]) => setMerchantPda(pda));
  }, [wallet]);

  const merchantQ = usePoll(merchantPda, async () => {
    const m = await fetchMaybeMerchant(client.rpc, merchantPda!, { commitment: 'confirmed' });
    return m.exists ? ({ ...m.data, address: m.address } as WithAddress<Merchant>) : null;
  });

  if (!wallet) return <p className="text-muted">请先连接商家钱包。</p>;
  if (merchantQ.data === undefined) return <p className="text-muted">读取链上数据…</p>;
  if (merchantQ.data === null) return <RegisterForm onDone={merchantQ.refresh} />;
  return <Dashboard merchant={merchantQ.data} refresh={merchantQ.refresh} />;
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const { client } = useApp();
  const send = useSend();
  const [name, setName] = useState('铁馆健身');
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
    <div className="card max-w-md">
      <h1 className="h2">注册商家</h1>
      <label className="label">店名</label>
      <input className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
      <label className="label mt-3">跑路判定：超过多久没有任何签到，持卡人可退款</label>
      <select className="input" value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))}>
        {TIMEOUT_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <button className="btn mt-4" disabled={!name || send.isRunning} onClick={submit}>注册</button>
      <div className="mt-2"><TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} /></div>
    </div>
  );
}

function Dashboard({ merchant, refresh }: { merchant: WithAddress<Merchant>; refresh: () => void }) {
  const { client } = useApp();
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
    if (!confirm('关店后不能再卖卡和签到，所有持卡人可立即退款。确定吗？')) return;
    const ix = await getCloseMerchantInstructionAsync({ authority: client.identity });
    closeSend.dispatchAsync([ix]).then(refreshAll, () => {});
  };

  const planName = (addr: string) => plans.data?.find((p) => p.address === addr)?.name ?? '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{merchant.name}</h1>
        <StatusBadge merchant={merchant} />
      </div>
      <MerchantStats merchant={merchant} />

      <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <div className="card">
          <h2 className="h2">套餐</h2>
          {plans.data?.length ? (
            <ul className="mb-4 divide-y divide-line">
              {plans.data.map((p) => (
                <li key={p.address} className="flex justify-between py-2 text-sm">
                  <span>{p.name}</span>
                  <span className="tabular-nums text-muted">{p.sessions} 次 · {formatSol(p.price)} SOL</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted">还没有套餐</p>
          )}
          {!merchant.closed && <PlanForm merchant={merchant} onDone={refreshAll} />}
        </div>

        <div className="card flex flex-col items-center text-center">
          <h2 className="h2">签到二维码</h2>
          {origin && (
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG value={checkInUrl} size={168} />
            </div>
          )}
          <p className="mt-2 text-xs text-muted">顾客用钱包扫码签到</p>
          <Link className="mt-1 text-xs underline" href={`/m/${merchant.address}`}>打开店铺页</Link>
        </div>
      </div>

      <div className="card">
        <h2 className="h2">顾客的卡</h2>
        {cards.data?.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-1">顾客</th><th>套餐</th><th>剩余次数</th><th className="text-right">托管中</th></tr>
            </thead>
            <tbody>
              {cards.data.map((c) => (
                <tr key={c.address} className="border-t border-line">
                  <td className="py-2 font-mono">{shortAddr(c.owner)}</td>
                  <td>{planName(c.plan)}</td>
                  <td className="tabular-nums">{c.remainingSessions} / {c.totalSessions}</td>
                  <td className="text-right tabular-nums">{formatSol(c.escrow)} SOL</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted">还没有顾客买卡</p>
        )}
      </div>

      {!merchant.closed && (
        <div>
          <button className="btn-danger" disabled={closeSend.isRunning} onClick={closeShop}>🚪 关店（演示跑路）</button>
          <div className="mt-2"><TxStatus isRunning={closeSend.isRunning} error={closeSend.error} signature={closeSend.data} /></div>
        </div>
      )}
    </div>
  );
}

function PlanForm({ merchant, onDone }: { merchant: WithAddress<Merchant>; onDone: () => void }) {
  const { client } = useApp();
  const send = useSend();
  const [name, setName] = useState('12 次私教课');
  const [price, setPrice] = useState('0.12');
  const [sessions, setSessions] = useState(12);

  const submit = async () => {
    const plan = await findPlanPda(merchant.address, merchant.planCount);
    const ix = getCreatePlanInstruction({
      authority: client.identity,
      merchant: merchant.address,
      plan,
      name,
      price: solToLamports(price),
      sessions,
    });
    send.dispatchAsync([ix]).then(onDone, () => {});
  };

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
      <div><label className="label">套餐名</label><input className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} /></div>
      <div><label className="label">总价 SOL</label><input className="input" value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} /></div>
      <div><label className="label">次数</label><input className="input" type="number" min={1} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} /></div>
      <div className="col-span-3">
        <button className="btn" disabled={!name || !(Number(price) > 0) || sessions < 1 || send.isRunning} onClick={submit}>上架套餐</button>
        <div className="mt-2"><TxStatus isRunning={send.isRunning} error={send.error} signature={send.data} /></div>
      </div>
    </div>
  );
}
