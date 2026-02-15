'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { CHARACTERS } from '@/lib/assetMap';

interface JoinRoomProps {
  onJoined: () => void;
  onBack: () => void;
}

export default function JoinRoom({ onJoined, onBack }: JoinRoomProps) {
  const { joinRoom } = useSocket();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[1].id);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[1];

  const handleJoin = async () => {
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    if (!code.trim() || code.trim().length !== 6) {
      setError('Enter a 6-character room code');
      return;
    }
    setLoading(true);
    setError('');
    const result = await joinRoom(code.trim().toUpperCase(), name.trim(), char.color);
    setLoading(false);
    if (result.ok) {
      onJoined();
    } else {
      setError(result.error ?? 'Failed to join room');
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
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as const }}
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

        {error && <p className="lobbyError">{error}</p>}

        <button className="setupStartBtn" onClick={handleJoin} disabled={loading}>
          {loading ? 'Joining...' : 'Join Room'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
