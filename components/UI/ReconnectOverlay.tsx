'use client';

import { useSocket } from '@/context/SocketContext';
import { clearGameSession } from '@/lib/gameSession';

export default function ReconnectOverlay({ onBackToMenu }: { onBackToMenu: () => void }) {
  const { reconnecting, reconnectFailed, clearReconnectFailed } = useSocket();

  if (!reconnecting && !reconnectFailed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: '#fff',
        fontFamily: 'inherit',
      }}
    >
      {reconnecting && (
        <>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'reconnectSpin 0.8s linear infinite',
            }}
          />
          <p style={{ fontSize: 18, fontWeight: 600 }}>Reconnecting...</p>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Re-establishing connection to the game</p>
          <style>{`@keyframes reconnectSpin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}

      {reconnectFailed && (
        <>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Could not rejoin game</p>
          <p style={{ fontSize: 14, opacity: 0.7, textAlign: 'center', maxWidth: 320 }}>
            The game may have ended or you were removed after being disconnected too long.
          </p>
          <button
            onClick={() => {
              clearGameSession();
              clearReconnectFailed();
              onBackToMenu();
            }}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              background: '#d4af37',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </>
      )}
    </div>
  );
}
