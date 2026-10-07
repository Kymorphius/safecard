import { type Address, address } from '@solana/kit';
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { shortAddr } from './solana';

export type Currency = {
  symbol: string;
  decimals: number;
  /** null 表示原生 SOL */
  mint: Address | null;
  tokenProgram: Address | null;
  /** devnet 上没有官方版本、由我们自行发行的测试代币 */
  test?: boolean;
};

export const SOL: Currency = { symbol: 'SOL', decimals: 9, mint: null, tokenProgram: null };

// Devnet 地址。上主网时换成主网的 USDC / USDT mint 即可。
export const TOKENS: Currency[] = [
  {
    // Circle 官方 devnet USDC（faucet.circle.com）
    symbol: 'USDC',
    decimals: 6,
    mint: address(process.env.NEXT_PUBLIC_USDC_MINT ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  },
  {
    // devnet 没有官方 USDT，这是 SafeCard 发行的测试代币（6 位小数，与 USDT 一致）
    symbol: 'USDT',
    decimals: 6,
    mint: address(process.env.NEXT_PUBLIC_USDT_MINT ?? 'e8v7L6Hue3ZWbB7pXEDLfVKMqE3ZujFfNvnHxetr9Ex'),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    test: true,
  },
];

export const CURRENCIES: Currency[] = [SOL, ...TOKENS];

export function currencyForMint(mint: Address): Currency {
  return (
    TOKENS.find((c) => c.mint === mint) ?? {
      symbol: shortAddr(mint),
      decimals: 0,
      mint,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    }
  );
}

/** 金额（不带单位），最多显示 4 位小数 */
export function formatAmount(amount: bigint | number, c: Currency): string {
  const n = Number(amount) / 10 ** c.decimals;
  return n.toLocaleString(undefined, { maximumFractionDigits: Math.min(c.decimals, 4) });
}

/** 金额加单位，例如 "25 USDC" */
export function formatMoney(amount: bigint | number, c: Currency): string {
  return `${formatAmount(amount, c)} ${c.symbol}`;
}

/** 把用户输入的十进制金额转成最小单位；格式不对返回 null */
export function parseAmount(input: string, c: Currency): bigint | null {
  const s = input.trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > c.decimals) return null;
  const scale = BigInt(10) ** BigInt(c.decimals);
  return BigInt(whole || '0') * scale + BigInt((frac + '0'.repeat(c.decimals)).slice(0, c.decimals) || '0');
}
