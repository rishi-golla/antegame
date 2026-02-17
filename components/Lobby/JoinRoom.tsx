'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';
import { useWalletClient, useBalance } from 'wagmi';
import { joinGameOnChain, getGameOnChain, formatEther } from '@/lib/contracts/monopolyGame';
import { getChainId } from '@/lib/contracts/addresses';

interface JoinRoomProps {
  onJoined: () => void;
  onBack: () => void;
}

export default function JoinRoom({ onJoined, onBack }: JoinRoomProps) {
  const { joinRoom } = useSocket();
  const { user, activeChain } = useMultiChain();
  const { data: walletClient } = useWalletClient();
  const { data: balance } = useBalance({
    address: user?.walletAddress as `0x${string}` | undefined,
    chainId: getChainId(),
  });

  const [name, setName] = useState(user?.displayName ?? '');
  const [code, setCode] = useState('');
  const [selectedChar, setSelectedChar] = useState(
    user?.characterId ?? CHARACTERS[1].id
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [buyInDisplay, setBuyInDisplay] = useState<string | null>(null);

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[1];
  const isBase = activeChain === 'base';
  const balanceEth = balance ? parseFloat(balance.formatted) : 0;

  const handleJoin = async () => {
    const playerName = name.trim() || user?.displayName || 'Player';
    if (!code.trim() || code.trim().length !== 6) {
      setError('Enter a 6-character room code');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('');

    try {
      // Step 1: If Base, check game on-chain and join
      if (isBase && walletClient) {
        // First check the game exists and get buy-in
        setStatus('Checking game...');
        const game = await getGameOnChain(code.trim().toUpperCase());
        if (game) {
          const buyInEth = formatEther(game.buyIn);
          setBuyInDisplay(buyInEth);

          if (balanceEth < parseFloat(buyInEth)) {
            setError(`Insufficient balance. Need ${buyInEth} ETH`);
            setLoading(false);
            return;
          }

          setStatus('Waiting for wallet approval...');
          await joinGameOnChain(walletClient, code.trim().toUpperCase(), buyInEth);
          setStatus('Transaction confirmed. Joining room...');
        }
      }

      // Step 2: Join room on server
      const result = await joinRoom(code.trim().toUpperCase(), playerName, char.color);
      if (result.ok) {
        onJoined();
      } else {
        setError(result.error ?? 'Failed to join room');
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
        <h1 className="setupTitle marqueeTitle">Join Room</h1>
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

        <input
          className="setupPlayerInput lobbyCodeInput"
          placeholder="ROOM CODE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.15em', marginBottom: 16 }}
        />

        {isBase && (
          <p style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'center' }}>
            Balance: {balanceEth.toFixed(4)} ETH
            {buyInDisplay && <span> | Buy-in: {buyInDisplay} ETH</span>}
          </p>
        )}

        {error && <p className="lobbyError">{error}</p>}
        {status && <p className="lobbyError" style={{ color: '#d4a843' }}>{status}</p>}

        <button className="setupStartBtn" onClick={handleJoin} disabled={loading}>
          {loading ? status || 'Joining...' : 'Join Room'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
