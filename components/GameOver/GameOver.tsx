'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { useSocket } from '@/context/SocketContext';
import { getNetWorth } from '@/lib/gameEngine';
import { useWalletClient } from 'wagmi';
import { claimWinnings } from '@/lib/contracts/monopolyGame';
import { getTxUrl } from '@/lib/contracts/addresses';
import type { Hash } from 'viem';
import { useWallet } from '@solana/wallet-adapter-react';
import { claimWinningsOnSolana } from '@/lib/solana-program/instructions';

interface GameOverProps {
  onPlayAgain: () => void;
  roomCode?: string;
}

export default function GameOver({ onPlayAgain, roomCode }: GameOverProps) {
  const { state } = useGame();
  const { user } = useMultiChain();
  const { roomState } = useSocket();
  const { data: walletClient } = useWalletClient();
  const { publicKey: solPublicKey, signTransaction: solSignTransaction, signAllTransactions: solSignAllTransactions } = useWallet();

  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [claimError, setClaimError] = useState('');

  if (state.winner === null) return null;

  const winner = state.players[state.winner];
  const chain = user?.chain;
  const isBase = chain === 'base';
  const isSolana = chain === 'solana';
  const isOnChain = isBase || isSolana;
  // Use room state's isYou to reliably identify the current player's index,
  // then compare with the winner index. Falls back to name match for free play.
  const myPlayerIndex = roomState?.players.findIndex((p: any) => p.isYou) ?? -1;
  const isWinner = myPlayerIndex >= 0
    ? myPlayerIndex === state.winner
    : !!(user?.displayName && winner.name === user.displayName);

  const rankings = [...state.players]
    .sort((a, b) => {
      if (a.bankrupt && !b.bankrupt) return 1;
      if (!a.bankrupt && b.bankrupt) return -1;
      return getNetWorth(state, b.id) - getNetWorth(state, a.id);
    });

  const handleClaim = async () => {
    if (!roomCode) return;
    setClaiming(true);
    setClaimError('');

    try {
      if (isSolana) {
        if (!solPublicKey) {
          setClaimError('Solana wallet not connected');
          return;
        }

        // Request Ed25519 settlement signature from server
        const res = await fetch('/api/contracts/solana/settlement-signature', {
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

        // Get signer public key
        const signerRes = await fetch('/api/contracts/solana/signer');
        const signerData = await signerRes.json();
        if (!signerData.address) {
          setClaimError('Solana signer not configured');
          return;
        }

        // Call claimWinnings on Solana
        if (!solSignTransaction) {
          setClaimError('Wallet does not support signing');
          return;
        }
        const wallet = { publicKey: solPublicKey, signTransaction: solSignTransaction, signAllTransactions: solSignAllTransactions ?? (async (txs: any[]) => { const out = []; for (const tx of txs) out.push(await solSignTransaction(tx)); return out; }) };
        const txSig = await claimWinningsOnSolana(
          wallet as any,
          roomCode,
          data.nonce,
          data.signature,
          signerData.address
        );

        setClaimTxHash(txSig);
        setClaimed(true);
      } else {
        // Base EVM flow
        if (!walletClient) return;

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

        const txHash = await claimWinnings(
          walletClient,
          roomCode,
          data.nonce as Hash,
          data.signature as `0x${string}`,
        );

        setClaimTxHash(txHash);
        setClaimed(true);
      }
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
        {/* jackpotLights removed */}
        
        {/* Winner crown - SVG instead of emoji */}
        <svg className="gameOverCrownSvg" width="64" height="48" viewBox="0 0 64 48" fill="none">
          <path d="M8 40L2 12L16 24L32 4L48 24L62 12L56 40H8Z" fill="url(#crownGold)" stroke="#B8860B" strokeWidth="2"/>
          <circle cx="16" cy="40" r="3" fill="#FF4444"/>
          <circle cx="32" cy="40" r="3" fill="#44FF44"/>
          <circle cx="48" cy="40" r="3" fill="#4444FF"/>
          <circle cx="32" cy="8" r="3" fill="#FFD700"/>
          <defs>
            <linearGradient id="crownGold" x1="32" y1="4" x2="32" y2="40">
              <stop offset="0%" stopColor="#FFD700"/>
              <stop offset="50%" stopColor="#D4AF37"/>
              <stop offset="100%" stopColor="#B8860B"/>
            </linearGradient>
          </defs>
        </svg>

        {roomCode && (
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'rgba(212,175,55,0.5)', letterSpacing: '0.15em', marginBottom: 4 }}>
            ROOM {roomCode}
          </div>
        )}
        <div className="jackpotLabel">WINNER</div>
        <h1 className="gameOverTitle jackpotWinner">{winner.name}</h1>
        <p className="gameOverWinnerWorth">${getNetWorth(state, winner.id).toLocaleString()}</p>
        <p className="gameOverSub">Final Standings</p>

        <div className="gameOverRankings">
          {rankings.map((player, i) => {
            const worth = getNetWorth(state, player.id);
            const isWinnerRank = player.id === winner.id;
            return (
              <div key={player.id} className={`gameOverRank ${player.bankrupt ? 'bankrupt' : ''} ${isWinnerRank ? 'winnerRank' : ''}`}>
                <span className="gameOverPos">#{i + 1}</span>
                <div className="gameOverAvatar" style={{ background: player.color }}>
                  {player.sprite ? (
                    <img src={player.sprite} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as const }} />
                  ) : player.name[0]}
                </div>
                <span className="gameOverName">{player.name}</span>
                <span className={`gameOverWorth ${player.bankrupt ? 'worthBankrupt' : ''}`}>
                  {player.bankrupt ? 'Bankrupt' : `$${worth.toLocaleString()}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Settlement for on-chain games (Base or Solana) */}
        {isOnChain && isWinner && !claimed && (
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

        {isOnChain && claimed && claimTxHash && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Winnings claimed!
            </p>
            {isBase && (
              <a
                href={getTxUrl(claimTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#d4a843', fontSize: '0.75rem' }}
              >
                View on Basescan
              </a>
            )}
            {isSolana && (
              <a
                href={`https://explorer.solana.com/tx/${claimTxHash}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#d4a843', fontSize: '0.75rem' }}
              >
                View on Solana Explorer
              </a>
            )}
          </div>
        )}

        {isOnChain && !isWinner && (
          <p className="gameOverFootnote">
            Better luck next time. Your buy-in has been claimed by the winner.
          </p>
        )}

        {/* Only show Play Again after winner has claimed or for free/non-winner */}
        {(!isOnChain || !isWinner || claimed) && (
          <button className="setupStartBtn" onClick={onPlayAgain} style={{ marginTop: 12 }}>
            Play Again
          </button>
        )}
        {isOnChain && isWinner && !claimed && (
          <p className="gameOverFootnote">Claim your winnings before leaving</p>
        )}
      </div>
    </div>
  );
}
