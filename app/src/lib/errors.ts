const PROGRAM_ERRORS: Record<number, string> = {
  6000: '名称太长（最多 32 字节）',
  6001: '超时时间必须大于 0',
  6002: '套餐至少 1 次，且单价不能低于 1 lamport/次',
  6003: '商家已关店',
  6004: '该套餐已下架',
  6005: '这张卡已经用完了',
  6006: '商家仍在正常营业，暂时不能退款',
  6007: '数值溢出',
  2001: '没有权限（账户不匹配）',
};

/** 把钱包 / RPC / 合约错误翻译成用户能看懂的话 */
export function friendlyError(err: unknown): string {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  const texts: string[] = [];
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as { message?: string; context?: { code?: number }; cause?: unknown };
    const code = e.context?.code;
    if (typeof code === 'number' && PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
    if (e.message) texts.push(e.message);
    cur = e.cause;
  }
  const all = texts.join(' | ');
  const hex = all.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) {
    const code = parseInt(hex[1], 16);
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  }
  if (/reject|denied|cancel/i.test(all)) return '你取消了签名';
  if (/insufficient|0x1\b/i.test(all)) return '余额不足（需要 SOL 支付金额和手续费）';
  if (/already in use/i.test(all)) return '账户已存在（比如同一套餐已经买过一张卡）';
  return texts[0] ?? String(err);
}
