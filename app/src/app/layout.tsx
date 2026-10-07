import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'SafeCard',
  description: 'Prepaid cards with on-chain escrow: paid out per visit, refundable if the shop disappears',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
