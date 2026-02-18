import './globals.css';
import type { Metadata } from 'next';
import { AudioProvider } from '@/context/AudioContext';
export const metadata: Metadata = {
  title: 'Ante',
  description: 'Stake crypto. Roll dice. Win the pot.',
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
