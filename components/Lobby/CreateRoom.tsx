'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';
import { CHARACTERS } from '@/lib/assetMap';

interface CreateRoomProps {
  onCreated: () => void;
  onBack: () => void;
}

export default function CreateRoom({ onCreated, onBack }: CreateRoomProps) {
  const { createRoom } = useSocket();
  const [name, setName] = useState('');
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0].id);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[0];

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    setLoading(true);
    setError('');
    const result = await createRoom(name.trim(), char.color, maxPlayers);
    setLoading(false);
    if (result.ok) {
      onCreated();
    } else {
      setError(result.error ?? 'Failed to create room');
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

        {error && <p className="lobbyError">{error}</p>}

        <button className="setupStartBtn" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating...' : 'Create Room'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
