'use client';

import { useState, useEffect } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';

interface LeaderboardEntry {
  wallet_address: string;
  display_name: string;
  character_id: string;
  games_played: number;
  games_won: number;
  total_earned_lamports: number;
}

interface LeaderboardScreenProps {
  onBack: () => void;
}

export default function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const { activeChain, user } = useMultiChain();
  const chain = activeChain ?? user?.chain;
  const currencyLabel = chain === 'solana' ? 'SOL' : 'ETH';
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const chainParam = activeChain ? `?chain=${activeChain}` : '';
    fetch(`/api/stats/leaderboard${chainParam}`)
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((data) => setEntries(data.leaderboard ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeChain]);

  const medalColors = ['var(--gold-bright)', '#c0c0c0', '#cd7f32'];

  return (
    <div className="setupScreen">
      <div className="setupCard leaderboardCard">
        <h1 className="setupTitle marqueeTitle">Leaderboard</h1>
        <p className="setupSubtitle casinoSubtitle">Top 50 Players</p>

        {loading ? (
          <p className="connectTagline">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="connectTagline">No games played yet</p>
        ) : (
          <div className="leaderboardTable">
            <div className="leaderboardHeader">
              <span className="lbRank">#</span>
              <span className="lbPlayer">Player</span>
              <span className="lbWins">Wins</span>
              <span className="lbEarned">{currencyLabel} Won</span>
            </div>
            {entries.map((entry, i) => {
              const char = CHARACTERS.find((c) => c.id === entry.character_id);
              return (
                <div key={entry.wallet_address} className={`leaderboardRow ${i < 3 ? 'leaderboardTop3' : ''}`}>
                  <span
                    className="lbRank"
                    style={i < 3 ? { color: medalColors[i], textShadow: `0 0 6px ${medalColors[i]}` } : undefined}
                  >
                    {i + 1}
                  </span>
                  <span className="lbPlayer">
                    {char && (
                      <img src={char.sprite} alt="" className="lbSprite" />
                    )}
                    {entry.display_name ?? entry.wallet_address.slice(0, 8)}
                  </span>
                  <span className="lbWins">{entry.games_won}</span>
                  <span className="lbEarned">{(entry.total_earned_lamports / 1e9).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}

        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
