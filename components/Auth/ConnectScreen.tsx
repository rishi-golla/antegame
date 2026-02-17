'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '@/context/AuthContext';

export default function ConnectScreen({ onFreePlay }: { onFreePlay?: () => void }) {
  const { connectAndSign } = useAuth();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [pendingSign, setPendingSign] = useState(false);

  // When wallet connects, auto-trigger sign
  useEffect(() => {
    if (connected && publicKey && pendingSign) {
      setPendingSign(false);
      setConnecting(true);
      connectAndSign()
        .catch((e: any) => setError(e.message || 'Verification failed'))
        .finally(() => setConnecting(false));
    }
  }, [connected, publicKey, pendingSign, connectAndSign]);

  const handleConnect = () => {
    setError('');
    if (connected && publicKey) {
      // Already connected, just sign
      setConnecting(true);
      connectAndSign()
        .catch((e: any) => setError(e.message || 'Verification failed'))
        .finally(() => setConnecting(false));
    } else {
      // Open wallet adapter modal (shows Phantom, Solflare, etc.)
      setPendingSign(true);
      setVisible(true);
    }
  };

  return (
    <div className="connectScreen">
      <div className="connectCard">
        <div className="connectDice">&#x1F3B2;</div>
        <h1 className="connectTitle">MONOPOLY CASINO</h1>
        <p className="connectTagline">Stake SOL. Roll dice. Win the pot.</p>
        <button
          className="connectBtn"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? 'CONNECTING...' : 'CONNECT WALLET'}
        </button>
        {error && <p className="connectError">{error}</p>}
        {onFreePlay && (
          <button className="lobbyBackBtn" onClick={onFreePlay} style={{ marginTop: 16 }}>
            Play for Free
          </button>
        )}
        <p className="connectChain">Powered by Solana</p>
      </div>
    </div>
  );
}
