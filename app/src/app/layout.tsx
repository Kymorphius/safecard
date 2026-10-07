import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './globals.css';
import { Providers } from './providers';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'SafeCard',
  description: 'Prepaid cards with on-chain escrow: paid out per visit, refundable if the shop disappears',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full">
      <body className="page-glow flex min-h-full flex-col">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-8 sm:px-6">{children}</main>
          <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-xs text-subtle sm:px-6">
            SafeCard · Solana Devnet
          </footer>
        </Providers>
      </body>
    </html>
  );
}
