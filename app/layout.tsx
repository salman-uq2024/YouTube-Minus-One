import '../styles/globals.css';
import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ReactNode } from 'react';

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'YouTube Minus One';

export const metadata: Metadata = {
  title: {
    default: 'YouTube Minus One — Long-form without Shorts',
    template: '%s — YouTube Minus One'
  },
  description: 'Discover YouTube videos without Shorts using the official Data API and IFrame Player only.',
  icons: {
    icon: ['/favicon.ico', '/icon.png'],
    shortcut: ['/favicon.ico'],
    apple: '/apple-icon.png',
    other: [
      { rel: 'mask-icon', url: '/logo.svg' }
    ]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-white">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 bg-surface/70 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold" aria-label={appName}>
                <Image src="/logo.svg" alt="" width={28} height={28} priority />
                <span className="hidden sm:inline">{appName}</span>
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
