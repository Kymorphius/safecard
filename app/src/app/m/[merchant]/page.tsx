import { Suspense } from 'react';
import { MerchantPublic } from '@/components/MerchantPublic';

async function Content({ params }: { params: PageProps<'/m/[merchant]'>['params'] }) {
  const { merchant } = await params;
  return <MerchantPublic merchantAddress={merchant} />;
}

export default function Page({ params }: PageProps<'/m/[merchant]'>) {
  return (
    <Suspense fallback={<p className="text-muted">加载中…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
