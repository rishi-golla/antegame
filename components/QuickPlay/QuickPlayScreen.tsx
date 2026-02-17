'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';

const FEE_TIERS = [
  { label: '0.05 SOL', lamports: 50_000_000 },
  { label: '0.1 SOL', lamports: 100_000_000 },
  { label: '0.25 SOL', lamports: 250_000_000 },
  { label: '0.5 SOL', lamports: 500_000_000 },
  { label: '1 SOL', lamports: 1_000_000_000 },
];

interface QuickPlayScreenProps {
  onFound: () => void;
  onBack: () => void;
}

export default function QuickPlayScreen({ onFound, onBack }: QuickPlayScreenProps) {
  const { quickPlay } = useSocket();
  const { user } = useAuth();
  const [selected, setSelected] = useState(1); // default 0.1 SOL
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const handleFind = async () => {
    if (!user) return;
    setSearching(true);
    setError('');
    try {
      const result = await quickPlay(FEE_TIERS[selected].lamports);
      if (result.ok) {
        onFound();
      } else {
        setError(result.error ?? 'Failed to find game');
      }
    } catch {
      setError('Connection error');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Quick Play</h1>
        <p className="setupSubtitle casinoSubtitle">Pick your stakes</p>

        <div className="feeChips">
          {FEE_TIERS.map((tier, i) => (
            <button
              key={tier.lamports}
              className={`feeChip ${selected === i ? 'feeChipSelected' : ''}`}
              onClick={() => setSelected(i)}
            >
              {tier.label}
            </button>
          ))}
        </div>

        <div className="feePotPreview">
          <span>Winner takes:</span>
          <span className="feePotAmount">
            {((FEE_TIERS[selected].lamports * 2) / 1_000_000_000).toFixed(2)} SOL+
          </span>
        </div>

        {error && <p className="lobbyError">{error}</p>}

        <button
          className="setupStartBtn neonBtn"
          onClick={handleFind}
          disabled={searching}
        >
          {searching ? 'SEARCHING...' : 'FIND GAME'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
