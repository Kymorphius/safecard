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
    const e = cur as { message?: string; context?: { code?: number }; cause?: unknown };
    const code = e.context?.code;
    if (typeof code === 'number' && programError(code)) return programError(code)!;
    if (e.message) texts.push(e.message);
    cur = e.cause;
  }
  const all = texts.join(' | ');
  const hex = all.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex && programError(parseInt(hex[1], 16))) return programError(parseInt(hex[1], 16))!;
  if (/reject|denied|cancel/i.test(all)) return t('err.rejected');
  if (/insufficient|0x1\b/i.test(all)) return t('err.insufficient');
  if (/already in use/i.test(all)) return t('err.inUse');
  return texts[0] ?? String(err);
}
