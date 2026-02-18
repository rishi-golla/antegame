'use client';

import { useState } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';
import { useSocket } from '@/context/SocketContext';
import { CHARACTERS } from '@/lib/assetMap';
import { useWalletClient, useBalance, useAccount } from 'wagmi';
import { getChainId } from '@/lib/contracts/addresses';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const BUY_IN_OPTIONS = ['0.001', '0.01', '0.05', '0.25', '0.5'];

interface QuickPlayProps {
  onMatched: () => void;
  onBack: () => void;
}

export default function QuickPlay({ onMatched, onBack }: QuickPlayProps) {
  const { user, activeChain } = useMultiChain();
  const { data: walletClient } = useWalletClient();
  const { isConnected: evmConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { data: balance } = useBalance({
    address: user?.walletAddress as `0x${string}` | undefined,
    chainId: getChainId(),
  });

  const [name, setName] = useState(user?.displayName ?? '');
  const [selectedChar, setSelectedChar] = useState(
    user?.characterId ?? CHARACTERS[0].id
  );
  const [buyIn, setBuyIn] = useState('0.01');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[0];
  const isBase = activeChain === 'base';
  const balanceEth = balance ? parseFloat(balance.formatted) : 0;
  const walletReady = !isBase || (evmConnected && walletClient);

  const handleFindMatch = async () => {
    const playerName = name.trim() || user?.displayName || 'Player';
    if (!walletReady) {
      setError('Wallet not connected.');
      openConnectModal?.();
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Searching for match...');

    try {
      const { getSocket } = await import('@/lib/socket');
      const socket = getSocket();

      const result = await new Promise<{ ok: boolean; code?: string; error?: string }>((resolve) => {
        (socket as any).emit('room:quick-play-base', {
          name: playerName,
          color: char.color,
          buyInEth: buyIn,
          walletAddress: user?.walletAddress,
        }, resolve);
      });

      if (result.ok) {
        setStatus('Match found!');
        onMatched();
      } else {
        setError(result.error ?? 'Failed to find match');
      }
    } catch (err: any) {
      setError(err.message ?? 'Matchmaking failed');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Quick Play</h1>
        <p className="setupSubtitle casinoSubtitle">Pick your character & buy-in</p>

        <div className="setupPlayerRow" style={{ marginBottom: 16 }}>
          <div
            className="setupPlayerColor casinoChipSelector"
            style={{ background: char.color, overflow: 'hidden' }}
          >
            <img
              src={char.sprite}
              alt={char.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as any }}
            />
          </div>
          <input
            className="setupPlayerInput"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
          />
        </div>

        <div className="characterGrid">
          {CHARACTERS.map((c) => (
            <div
              key={c.id}
              className={`characterCard ${selectedChar === c.id ? 'characterCardSelected' : ''}`}
              onClick={() => setSelectedChar(c.id)}
            >
              <img src={c.sprite} alt={c.name} className="characterCardSprite" draggable={false} />
              <span className="characterCardName">{c.name}</span>
            </div>
          ))}
        </div>

        {isBase && (
          <div className="setupPlayerCount">
            <label>Buy-In (ETH)</label>
            <div className="setupCountBtns">
              {BUY_IN_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  className={`setupCountBtn ${buyIn === amt ? 'active' : ''}`}
                  onClick={() => setBuyIn(amt)}
                  disabled={balanceEth < parseFloat(amt)}
                >
                  {amt}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 4 }}>
              Balance: {balanceEth.toFixed(4)} ETH
              {balanceEth < parseFloat(buyIn) && <span style={{ color: '#ff4444' }}> (insufficient)</span>}
            </p>
          </div>
        )}

        {isBase && !walletReady && (
          <p className="lobbyError" style={{ color: '#d4a843' }}>
            Wallet not connected.{' '}
            <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => openConnectModal?.()}>
              Reconnect wallet
            </span>
          </p>
        )}
        {error && <p className="lobbyError">{error}</p>}
        {status && <p className="lobbyError" style={{ color: '#d4a843' }}>{status}</p>}

        <button
          className="setupStartBtn"
          onClick={handleFindMatch}
          disabled={loading || (isBase && !walletReady) || (isBase && balanceEth < parseFloat(buyIn))}
        >
          {loading ? status || 'Searching...' : '🎰 Find Match'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
