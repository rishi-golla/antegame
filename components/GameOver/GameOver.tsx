'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { getNetWorth } from '@/lib/gameEngine';
import { useWalletClient } from 'wagmi';
import { claimWinnings } from '@/lib/contracts/monopolyGame';
import { getTxUrl } from '@/lib/contracts/addresses';
import type { Hash } from 'viem';

interface GameOverProps {
  onPlayAgain: () => void;
  roomCode?: string;
}

export default function GameOver({ onPlayAgain, roomCode }: GameOverProps) {
  const { state } = useGame();
  const { user, activeChain } = useMultiChain();
  const { data: walletClient } = useWalletClient();

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimError, setClaimError] = useState('');

  if (state.winner === null) return null;

  const winner = state.players[state.winner];
  const isBase = activeChain === 'base';
  const isWinner = user?.walletAddress && winner.name === user.displayName;

  const rankings = [...state.players]
    .sort((a, b) => {
      if (a.bankrupt && !b.bankrupt) return 1;
      if (!a.bankrupt && b.bankrupt) return -1;
      return getNetWorth(state, b.id) - getNetWorth(state, a.id);
    });

  const handleClaim = async () => {
    if (!walletClient || !roomCode) return;
    setClaiming(true);
    setClaimError('');

    try {
      // Request settlement signature from server
      const res = await fetch('/api/contracts/settlement-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          winnerAddress: user?.walletAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.nonce || !data.signature) {
        setClaimError(data.error ?? 'Failed to get settlement signature');
        return;
      }

      // Call claimWinnings on-chain
      const txHash = await claimWinnings(
        walletClient,
        roomCode,
        data.nonce as Hash,
        data.signature as `0x${string}`,
      );

      setClaimTxHash(txHash);
      setClaimed(true);
    } catch (err: any) {
      if (err.message?.includes('User rejected') || err.message?.includes('denied')) {
        setClaimError('Transaction cancelled');
      } else {
        setClaimError(err.shortMessage ?? err.message ?? 'Claim failed');
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="gameOverOverlay casinoBackdrop jackpotOverlay">
      <div className="gameOverCard jackpotCard">
        <div className="jackpotLights" />
        <div className="gameOverCrown">&#x1F451;</div>
        <div className="jackpotLabel">JACKPOT</div>
        <h1 className="gameOverTitle jackpotWinner">{winner.name} Wins!</h1>
        <p className="gameOverSub">Final Standings</p>

        <div className="gameOverRankings">
          {rankings.map((player, i) => (
            <div key={player.id} className={`gameOverRank ${player.bankrupt ? 'bankrupt' : ''}`}>
              <span className="gameOverPos">#{i + 1}</span>
              <div className="gameOverAvatar" style={{ background: player.color }}>
                {player.name[0]}
              </div>
              <span className="gameOverName">{player.name}</span>
              <span className="gameOverWorth">
                {player.bankrupt ? 'Bankrupt' : `$${getNetWorth(state, player.id).toLocaleString()}`}
              </span>
            </div>
          ))}
        </div>

        {/* Settlement for Base chain games */}
        {isBase && isWinner && !claimed && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button
              className="setupStartBtn"
              onClick={handleClaim}
              disabled={claiming}
              style={{ background: 'linear-gradient(180deg, #22c55e, #16a34a)', borderColor: '#22c55e' }}
            >
              {claiming ? 'Claiming...' : 'Claim Winnings'}
            </button>
            {claimError && <p className="lobbyError">{claimError}</p>}
          </div>
        )}

        {isBase && claimed && claimTxHash && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Winnings claimed!
            </p>
            <a
              href={getTxUrl(claimTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#d4a843', fontSize: '0.75rem' }}
            >
              View on Basescan
            </a>
          </div>
        )}

        {isBase && !isWinner && (
          <p style={{ marginTop: 16, fontSize: '0.75rem', opacity: 0.6, textAlign: 'center' }}>
            Better luck next time. Your buy-in has been claimed by the winner.
          </p>
        )}

        <button className="setupStartBtn" onClick={onPlayAgain} style={{ marginTop: 12 }}>
          Play Again
        </button>
      </div>
    </div>
  );
}
