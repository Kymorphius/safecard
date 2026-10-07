import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'SafeCard 安心卡',
  description: '链上托管的预付卡：按次放款，商家跑路一键退款',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
