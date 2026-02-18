import './globals.css';
import type { Metadata } from 'next';
import { AudioProvider } from '@/context/AudioContext';
export const metadata: Metadata = {
  title: 'Monopoly Game',
  description: 'Multiplayer indie monopoly-style board game',
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
