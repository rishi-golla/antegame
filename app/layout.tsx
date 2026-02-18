import './globals.css';
import type { Metadata } from 'next';
import { AudioProvider } from '@/context/AudioContext';
import AudioControls from '@/components/UI/AudioControls';

export const metadata: Metadata = {
  title: 'Monopoly Game',
  description: 'Multiplayer indie monopoly-style board game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AudioProvider>
          <AudioControls />
          {children}
        </AudioProvider>
      </body>
    </html>
  );
}
