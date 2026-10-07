'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'safecard.lang';

// [English, 中文]；{name} 为插值占位符
const dict = {
  // nav / wallet
  'nav.myCards': ['My cards', '我的卡'],
  'nav.merchant': ['Merchant', '商家后台'],
  'wallet.loading': ['Loading wallets…', '加载钱包…'],
  'wallet.connect': ['Connect wallet', '连接钱包'],
  'wallet.connecting': ['Connecting…', '连接中…'],
  'wallet.disconnectHint': ['Click to disconnect', '点击断开'],
  'wallet.none': ['No wallet found. Install Phantom or Solflare.', '没有检测到钱包，请安装 Phantom 或 Solflare'],

  // tx status
  'tx.pending': ['Waiting for signature and confirmation…', '等待钱包签名并上链…'],
  'tx.confirmed': ['Confirmed', '已上链'],
  'tx.view': ['View transaction', '查看交易'],

  // common
  'common.loading': ['Loading on-chain data…', '读取链上数据…'],
  'common.loadFailed': ['Failed to load. Please refresh.', '读取失败，请刷新重试'],
  'common.connectFirst': ['Connect your wallet first.', '请先连接钱包。'],
  'common.sessionsPrice': ['{n} sessions · {price} SOL', '{n} 次 · {price} SOL'],

  // home
  'home.eyebrow': ['Prepaid escrow on Solana', 'Solana 链上预付托管'],
  'home.title.pre': ['Prepaid cards that ', '预付卡，\n再也不怕老板'],
  'home.title.em': ['can’t', '跑路'],
  'home.title.post': [' run away with your money.', ''],
  'home.ctaBrowse': ['Browse merchants', '浏览商家'],
  'home.ctaMerchant': ['Open a shop', '我是商家'],
  'home.howItWorks': ['How it works', '运作方式'],
  'home.body': [
    'Gym memberships, haircut bundles, class passes: your money doesn’t go straight into the owner’s pocket. It sits in escrow on Solana. Each time you use the service and sign, one session’s worth is released to the merchant. If the shop closes or stops serving, you take the rest back in one click.',
    '你买的健身卡、理发卡、课时卡，钱不直接进老板口袋，而是托管在 Solana 链上。每消费一次、你签名确认，才放一次的钱给商家。商家关门或长期不服务，剩下的钱你一键取回。',
  ],
  'home.step1.title': ['Buy', '买卡'],
  'home.step1.desc': ['Funds go into an on-chain escrow the merchant can’t touch', '钱进入链上托管账户，商家动不了'],
  'home.step2.title': ['Check in', '签到'],
  'home.step2.desc': ['You sign each visit; one session is paid out per check-in', '每次消费由你签名，按次放款给商家'],
  'home.step3.title': ['Shop vanished?', '跑路？'],
  'home.step3.desc': ['No service for too long, or closed: refund the balance in one click', '超时没服务或关店，剩余余额一键退回'],
  'home.merchants': ['Merchants', '商家'],
  'home.merchantsSub': ['Every number below is read straight from the chain.', '以下数据全部直接读取自链上，公开可查。'],
  'home.noMerchants.before': ['No merchants yet. Go to ', '还没有商家。去 '],
  'home.noMerchants.after': [' to register the first one.', ' 注册第一家店吧。'],
  'home.inEscrow': ['{amount} SOL in escrow', '托管中 {amount} SOL'],
  'home.sold': ['{n} sold', '售卡 {n}'],
  'home.refunds': ['{n} refunds', '退款 {n}'],

  // merchant status
  'status.closed': ['Closed · refunds open', '已关店 · 可退款'],
  'status.defaulted': ['No service · refunds open', '超时未服务 · 可退款'],
  'status.open': ['Open · {time} until default', '营业中 · 跑路判定还剩 {time}'],
  'status.openHint': [
    'If nobody checks in within this time, cardholders can refund',
    '超过这个时间没有任何签到，持卡人即可退款',
  ],
  'dur.d': ['{n}d', '{n} 天'],
  'dur.h': ['{n}h', '{n} 小时'],
  'dur.ms': ['{m}m {s}s', '{m} 分 {s} 秒'],
  'dur.s': ['{n}s', '{n} 秒'],

  // stats
  'stats.escrow': ['In escrow', '托管中'],
  'stats.escrowHint': ['Paid by customers, not yet used. The merchant can’t touch it.', '用户已付、尚未消费，商家动不了'],
  'stats.released': ['Released to merchant', '已结算给商家'],
  'stats.releasedHint': ['Paid out after customers sign a check-in', '用户签到确认后放款'],
  'stats.refunded': ['Refunded', '已退款'],
  'stats.refundedHint': ['Returned to customers after the merchant defaulted', '商家违约后退回用户'],
  'stats.soldRate': ['Cards sold / refund rate', '售卡 / 退款率'],
  'stats.soldRateValue': ['{n} / {rate}%', '{n} 张 / {rate}%'],

  // card
  'card.default': ['Prepaid card', '预付卡'],
  'card.escrow': ['In escrow', '卡内托管'],
  'card.used': ['Used {used} / {total}', '已用 {used} / {total} 次'],
  'card.left': ['{n} left', '剩 {n} 次'],
  'card.checkIn': ['Check in', '签到消费'],
  'card.checkInHint': ['Releases {amount} SOL to the merchant', '放 {amount} SOL 给商家'],
  'card.sessions': ['Sessions', '次数'],
  'card.refundBlocked': ['Merchant is still active, so refunds aren’t available yet', '商家正常营业中，不能退款'],
  'card.close': ['Close card (reclaim rent)', '关闭卡片（退还租金）'],
  'card.refund': ['Refund {amount} SOL', '退回 {amount} SOL'],

  // merchant dashboard
  'md.connectFirst': ['Connect the merchant wallet first.', '请先连接商家钱包。'],
  'md.register': ['Register as a merchant', '注册商家'],
  'md.shopName': ['Shop name', '店名'],
  'md.defaultShopName': ['Iron Gym', '铁馆健身'],
  'md.timeoutLabel': [
    'Default rule: if nobody checks in for this long, cardholders can refund',
    '跑路判定：超过多久没有任何签到，持卡人可退款',
  ],
  'md.preset60': ['60 seconds (demo)', '60 秒（演示用）'],
  'md.preset1d': ['1 day', '1 天'],
  'md.preset30d': ['30 days', '30 天'],
  'md.registerBtn': ['Register', '注册'],
  'md.plans': ['Plans', '套餐'],
  'md.noPlans': ['No plans yet', '还没有套餐'],
  'md.qr': ['Check-in QR', '签到二维码'],
  'md.qrHint': ['Customers scan with their wallet to check in', '顾客用钱包扫码签到'],
  'md.openStore': ['Open store page', '打开店铺页'],
  'md.customerCards': ['Customer cards', '顾客的卡'],
  'md.col.customer': ['Customer', '顾客'],
  'md.col.plan': ['Plan', '套餐'],
  'md.col.left': ['Sessions left', '剩余次数'],
  'md.col.escrow': ['In escrow', '托管中'],
  'md.noCards': ['No cards sold yet', '还没有顾客买卡'],
  'md.closeConfirm': [
    'After closing, no more sales or check-ins, and every cardholder can refund immediately. Continue?',
    '关店后不能再卖卡和签到，所有持卡人可立即退款。确定吗？',
  ],
  'md.closeBtn': ['Close shop', '关店'],
  'md.dangerZone': ['Danger zone', '危险操作'],
  'md.dangerDesc': [
    'Closing stops new sales and check-ins. Every cardholder can withdraw their remaining balance immediately. Use this to demo a runaway merchant.',
    '关店后停止售卡和签到，所有持卡人可立即取回剩余余额。可用于演示商家跑路。',
  ],
  'md.overview': ['Overview', '概览'],
  'md.rename': ['Rename', '改名'],
  'md.save': ['Save', '保存'],
  'md.cancel': ['Cancel', '取消'],
  'md.planName': ['Plan name', '套餐名'],
  'md.defaultPlanName': ['12 PT sessions', '12 次私教课'],
  'md.price': ['Total price (SOL)', '总价 SOL'],
  'md.sessions': ['Sessions', '次数'],
  'md.addPlan': ['Add plan', '上架套餐'],

  // store page
  'store.invalid': ['Invalid merchant address', '无效的商家地址'],
  'store.notFound': ['Merchant not found', '没找到这个商家'],
  'store.myCards': ['My cards here', '我在这家店的卡'],
  'store.trackRecord': ['On-chain track record', '链上信用'],
  'store.plans': ['Plans', '套餐'],
  'store.noPlans': ['This merchant has no plans yet', '商家还没有上架套餐'],
  'store.perSession': ['(~{amount} SOL each)', '（每次约 {amount} SOL）'],
  'store.owned': ['Owned', '已持有'],
  'store.connectToBuy': ['Connect wallet to buy', '连接钱包后购买'],
  'store.buy': ['Buy card', '买卡'],
  'store.buyHint': ['Funds are held in escrow, not paid to the merchant', '资金进入链上托管，不直接付给商家'],
  'store.merchantAccount': ['Merchant account', '商家账户'],

  // my cards
  'my.title': ['My cards', '我的卡'],
  'my.empty.before': ['No cards yet. Pick a shop on the ', '还没有卡。去 '],
  'my.empty.link': ['home page', '首页'],
  'my.empty.after': ['.', ' 挑一家店吧。'],

  // errors
  'err.6000': ['Name is too long (max 32 bytes)', '名称太长（最多 32 字节）'],
  'err.6001': ['Timeout must be greater than 0', '超时时间必须大于 0'],
  'err.6002': ['A plan needs at least 1 session and at least 1 lamport per session', '套餐至少 1 次，且单价不能低于 1 lamport/次'],
  'err.6003': ['This merchant is closed', '商家已关店'],
  'err.6004': ['This plan is no longer on sale', '该套餐已下架'],
  'err.6005': ['This card has no sessions left', '这张卡已经用完了'],
  'err.6006': ['The merchant is still active, so refunds aren’t available yet', '商家仍在正常营业，暂时不能退款'],
  'err.6007': ['Arithmetic overflow', '数值溢出'],
  'err.2001': ['Not authorized (account mismatch)', '没有权限（账户不匹配）'],
  'err.rejected': ['You cancelled the signature', '你取消了签名'],
  'err.expired': [
    'The transaction expired while waiting for your signature. Nothing was charged. Please try again and confirm within a minute.',
    '交易等待签名太久已过期，没有扣费。请重试，并在一分钟内确认。',
  ],
  'err.network': [
    'The network is busy. Check whether the transaction went through, then try again.',
    '网络繁忙。请先确认交易是否已上链，再重试。',
  ],
  'err.insufficient': ['Insufficient SOL for the amount plus fees', '余额不足（需要 SOL 支付金额和手续费）'],
  'err.inUse': ['Account already exists (e.g. you already hold a card for this plan)', '账户已存在（比如同一套餐已经买过一张卡）'],
} satisfies Record<string, [string, string]>;

export type TKey = keyof typeof dict;
export type T = (key: TKey, vars?: Record<string, string | number>) => string;

function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = dict[key][lang === 'en' ? 0 : 1];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function hasKey(key: string): key is TKey {
  return key in dict;
}

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: T }>({
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 服务端和首次渲染都用英文，挂载后再读取用户选择，避免水合不一致
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  }, []);

  const t = useCallback<T>((key, vars) => translate(lang, key, vars), [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  const opt = (l: Lang, label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors ${
        lang === l ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex items-center rounded-full border border-line p-0.5" role="group" aria-label="Language">
      {opt('en', 'EN')}
      {opt('zh', '中文')}
    </div>
  );
}
