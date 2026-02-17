'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';
import { useWalletClient, useBalance } from 'wagmi';
import { createGameOnChain, formatEther, parseEther } from '@/lib/contracts/monopolyGame';
import { getChainId } from '@/lib/contracts/addresses';

const BUY_IN_OPTIONS = ['0.001', '0.005', '0.01', '0.025', '0.05'];

interface CreateRoomProps {
  onCreated: () => void;
  onBack: () => void;
}

export default function CreateRoom({ onCreated, onBack }: CreateRoomProps) {
  const { createRoom } = useSocket();
  const { user, activeChain } = useMultiChain();
  const { data: walletClient } = useWalletClient();
  const { data: balance } = useBalance({
    address: user?.walletAddress as `0x${string}` | undefined,
    chainId: getChainId(),
  });

  const [name, setName] = useState(user?.displayName ?? '');
  const [selectedChar, setSelectedChar] = useState(
    user?.characterId ?? CHARACTERS[0].id
  );
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [buyIn, setBuyIn] = useState('0.001');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[0];
  const isBase = activeChain === 'base';

  const balanceEth = balance ? parseFloat(balance.formatted) : 0;
  const canAfford = balanceEth >= parseFloat(buyIn);

  const handleCreate = async () => {
    const playerName = name.trim() || user?.displayName || 'Player';
    setLoading(true);
    setError('');
    setStatus('');

    try {
      if (isBase && walletClient) {
        // Step 1: Create room on server first to get the room code
        setStatus('Creating room...');
        const result = await createRoom(playerName, char.color, maxPlayers, {
          walletAddress: user?.walletAddress,
          buyInEth: buyIn,
        });
        if (!result.ok || !result.code) {
          setError(result.error ?? 'Failed to create room');
          setLoading(false);
          return;
        }

        // Step 2: Create game on-chain using the room code as gameId seed
        setStatus('Waiting for wallet approval...');
        let txHash: string;
        try {
          txHash = await createGameOnChain(walletClient, result.code, maxPlayers, buyIn);
        } catch (err: any) {
          // On-chain tx failed — leave the server room so it gets cleaned up
          const { getSocket } = await import('@/lib/socket');
          getSocket().emit('room:leave');
          throw err;
        }

        // Step 3: Notify server that on-chain deposit succeeded
        setStatus('Confirming deposit...');
        const { getSocket } = await import('@/lib/socket');
        await new Promise<void>((resolve) => {
          getSocket().emit('room:base-deposit' as any, { txHash: txHash }, () => resolve());
        });

        setStatus('Transaction confirmed!');
        onCreated();
      } else {
        // Non-Base flow (Solana or no wallet)
        const result = await createRoom(playerName, char.color, maxPlayers);
        if (result.ok) {
          onCreated();
        } else {
          setError(result.error ?? 'Failed to create room');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('User rejected') || err.message?.includes('denied')) {
        setError('Transaction cancelled');
      } else {
        setError(err.shortMessage ?? err.message ?? 'Transaction failed');
      }
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Create Room</h1>
        <p className="setupSubtitle casinoSubtitle">Pick your character</p>

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

        <div className="setupPlayerCount">
          <label>Max Players</label>
          <div className="setupCountBtns">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                className={`setupCountBtn ${maxPlayers === n ? 'active' : ''}`}
                onClick={() => setMaxPlayers(n)}
              >
                {n}
              </button>
            ))}
          </div>
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
              {!canAfford && <span style={{ color: '#ff4444' }}> (insufficient)</span>}
            </p>
          </div>
        )}

        {error && <p className="lobbyError">{error}</p>}
        {status && <p className="lobbyError" style={{ color: '#d4a843' }}>{status}</p>}

        <button
          className="setupStartBtn"
          onClick={handleCreate}
          disabled={loading || (isBase && !canAfford)}
        >
          {loading ? status || 'Creating...' : isBase ? `Create Room (${buyIn} ETH)` : 'Create Room'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
