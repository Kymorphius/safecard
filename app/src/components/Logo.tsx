import { ShieldCheck } from 'lucide-react';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface-2"
      style={{ width: size, height: size }}
    >
      <ShieldCheck size={size * 0.56} strokeWidth={1.75} className="text-accent" />
    </span>
  );
}
