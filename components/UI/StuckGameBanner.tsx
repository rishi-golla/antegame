'use client';

import { useSocket } from '@/context/SocketContext';
import Link from 'next/link';

export default function StuckGameBanner() {
  const { gameStuck } = useSocket();

  if (!gameStuck) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #b91c1c, #991b1b)',
        color: '#fff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        fontSize: '14px',
        fontWeight: 500,
      }}
    >
      <span>
        Game appears stuck. If this persists, you can recover your funds from{' '}
        <Link
          href="/profile"
          style={{ color: '#fbbf24', textDecoration: 'underline', fontWeight: 600 }}
        >
          Profile &gt; Refunds
        </Link>
      </span>
    </div>
  );
}
