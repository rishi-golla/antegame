import './globals.css';
import type { Metadata } from 'next';
import { AudioProvider } from '@/context/AudioContext';
export const metadata: Metadata = {
  title: 'Ante',
  description: 'Stake crypto. Roll dice. Win the pot.',
  metadataBase: new URL('https://ante.wtf'),
  openGraph: {
    title: 'Ante',
    description: 'Stake crypto. Roll dice. Win the pot.',
    images: [
      {
        url: 'https://ante.wtf/assets/misc/og-image.png',
        width: 1500,
        height: 500,
        alt: 'Ante — Crypto Board Game',
      },
    ],
    type: 'website',
    siteName: 'Ante',
    url: 'https://ante.wtf',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ante',
    description: 'Stake crypto. Roll dice. Win the pot.',
    images: ['https://ante.wtf/assets/misc/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AudioProvider>
          {children}
        </AudioProvider>
      </body>
    </html>
  );
}
