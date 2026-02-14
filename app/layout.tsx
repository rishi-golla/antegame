import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monopoly Game',
  description: 'Multiplayer indie monopoly-style board game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
