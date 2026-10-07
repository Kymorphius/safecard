import React from 'react';

export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        {/* 标题里含交互控件时不能放进 <h1>（会嵌套 <p>/<input>） */}
        {typeof title === 'string' ? (
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</h1>
        ) : (
          <div className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{title}</div>
        )}
        {sub && <div className="mt-2 text-sm text-muted">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="panel p-10 text-center text-sm text-muted">{children}</div>;
}

export function Section({
  title,
  right,
  children,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="section-title">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** 币种标签，例如 USDC */
export function CurrencyTag({ symbol }: { symbol: string }) {
  return (
    <span className="mono rounded-md border border-line-strong px-1.5 py-0.5 text-[10px] tracking-wide text-muted">
      {symbol}
    </span>
  );
}
