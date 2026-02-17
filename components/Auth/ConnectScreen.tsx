'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ConnectScreen() {
  const { connectAndSign } = useAuth();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      await connectAndSign();
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    } finally {
      setConnecting(false);
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
        <p className="connectChain">Powered by Solana</p>
      </div>
    </div>
  );
}
