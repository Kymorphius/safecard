import { type T, type TKey, hasKey } from './i18n';

/** 把钱包 / RPC / 合约错误翻译成用户能看懂的话 */
export function friendlyError(err: unknown, t: T): string {
  const programError = (code: number) => {
    const key = `err.${code}`;
    return hasKey(key) ? t(key as TKey) : null;
  };
  const seen = new Set<unknown>();
  let cur: unknown = err;
  const texts: string[] = [];
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as {
      message?: string;
      context?: { code?: number; lastValidBlockHeight?: unknown; __code?: number };
      cause?: unknown;
    };
    // 区块哈希过期（签名等太久）：Kit 的 SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED 带有 lastValidBlockHeight
    if (e.context && 'lastValidBlockHeight' in e.context) return t('err.expired');
    const code = e.context?.code;
    if (typeof code === 'number' && programError(code)) return programError(code)!;
    if (e.message) texts.push(e.message);
    cur = e.cause;
  }
  const all = texts.join(' | ');
  const hex = all.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex && programError(parseInt(hex[1], 16))) return programError(parseInt(hex[1], 16))!;
  if (/block height exceeded|blockhash not found|expired/i.test(all)) return t('err.expired');
  if (/reject|denied|cancel/i.test(all)) return t('err.rejected');
  if (/failed to fetch|network|429|too many requests|timed? ?out/i.test(all)) return t('err.network');
  if (/insufficient|0x1\b/i.test(all)) return t('err.insufficient');
  if (/already in use/i.test(all)) return t('err.inUse');
  return texts[0] ?? String(err);
}
