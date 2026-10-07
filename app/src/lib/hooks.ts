'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address, Instruction } from '@solana/kit';
import { useConnectedWallet } from '@solana/kit-plugin-wallet/react';
import { useAction, useClient } from '@solana/react';
import type { AppClient } from '@/app/providers';

/** 是否已在浏览器挂载。钱包状态只存在于浏览器，挂载前一律按“未连接”渲染，避免水合不一致 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useApp() {
  const client = useClient<AppClient>();
  const mounted = useMounted();
  const connectedState = useConnectedWallet(client);
  const connected = mounted ? connectedState : null;
  const wallet = (connected?.account.address ?? null) as Address | null;
  return { client, connected, wallet, mounted };
}

/** 当前 Unix 秒，每秒刷新（用于倒计时） */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** 轮询拉取数据；key 变化时重新拉取，fn 为 null 时不拉取 */
export function usePoll<T>(key: string | null, fn: (() => Promise<T>) | null, intervalMs = 6000) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async () => {
    if (!fnRef.current) return;
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    setData(undefined);
    if (!key) return;
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [key, intervalMs, refresh]);

  return { data, error, refresh, loading: key != null && data === undefined && !error };
}

/** 发送一组指令，返回交易签名 */
export function useSend() {
  const client = useClient<AppClient>();
  return useAction(async (signal: AbortSignal, instructions: Instruction[]) => {
    const result = await client.sendTransaction(instructions, { abortSignal: signal });
    return result.context.signature as string;
  });
}
