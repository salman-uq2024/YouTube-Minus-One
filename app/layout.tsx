import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ReactNode } from 'react';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'YouTube Minus One';

export const metadata: Metadata = {
  title: appName,
  description: 'Discover YouTube videos without Shorts, using official APIs only.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-white">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 bg-surface/70 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
              <Link href="/" className="text-lg font-semibold">
                {appName}
              </Link>
              <nav className="flex items-center gap-4 text-sm text-white/70">
                <Link href="/explore">Explore</Link>
                <Link href="/terms">Terms</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/compliance">Compliance</Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 bg-background">{children}</main>
          <footer className="border-t border-white/10 bg-surface/70 py-6 text-sm text-white/70">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 md:flex-row md:items-center md:justify-between">
              <p>
                This app uses the YouTube API Services and the official IFrame Player. We do not modify or block
                ads, nor provide downloads or background playback.
              </p>
              <p>
                <Link href="/compliance" className="hover:underline">
                  Compliance details
                </Link>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
