import { MerchantList } from '@/components/MerchantList';

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="py-6">
        <h1 className="text-3xl font-bold sm:text-4xl">预付卡，再也不怕老板跑路</h1>
        <p className="mt-3 max-w-2xl text-muted">
          你买的健身卡、理发卡、课时卡，钱不直接进老板口袋，而是托管在 Solana 链上。
          每消费一次、你签名确认，才放一次的钱给商家。商家关门或长期不服务，剩下的钱你一键取回。
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ['💰', '买卡', '钱进入链上托管账户，商家动不了'],
            ['✅', '签到', '每次消费由你签名，按次放款给商家'],
            ['🏃', '跑路？', '超时没服务或关店，剩余余额一键退回'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="card">
              <div className="text-2xl">{icon}</div>
              <div className="mt-2 font-semibold">{title}</div>
              <div className="mt-1 text-sm text-muted">{desc}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="h2">商家（链上信用公开可查）</h2>
        <MerchantList />
      </section>
    </div>
  );
}
