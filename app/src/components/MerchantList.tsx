'use client';

import Link from 'next/link';
import { fetchMerchants, formatSol } from '@/lib/solana';
import { useApp, usePoll } from '@/lib/hooks';
import { StatusBadge } from './MerchantStatus';

export function MerchantList() {
  const { client } = useApp();
  const { data, error, loading } = usePoll('merchants', () => fetchMerchants(client.rpc), 8000);

  if (loading) return <p className="text-muted">读取链上数据…</p>;
  if (error) return <p className="text-danger">读取失败，请刷新重试</p>;
  if (!data?.length)
    return (
      <p className="text-muted">
        还没有商家。去 <Link className="underline" href="/merchant">商家后台</Link> 注册第一家店吧。
      </p>
    );

  const sorted = [...data].sort((a, b) => Number(b.cardsSold - a.cardsSold));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sorted.map((m) => (
        <Link key={m.address} href={`/m/${m.address}`} className="card block transition hover:border-accent">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">{m.name}</div>
            <StatusBadge merchant={m} />
          </div>
          <div className="mt-3 flex gap-4 text-sm text-muted">
            <span>托管中 {formatSol(m.totalEscrowed)} SOL</span>
            <span>售卡 {m.cardsSold.toString()}</span>
            <span>退款 {m.refundCount.toString()}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
