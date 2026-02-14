'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';

const COLORS = ['#ff6b6b', '#5cd6c0', '#ffd166', '#8fb8ff', '#c084fc', '#fb923c'];

interface CreateRoomProps {
  onCreated: () => void;
  onBack: () => void;
}

export default function CreateRoom({ onCreated, onBack }: CreateRoomProps) {
  const { createRoom } = useSocket();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    setLoading(true);
    setError('');
    const result = await createRoom(name.trim(), color, maxPlayers);
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
        <h1 className="setupTitle">Create Room</h1>
        <p className="setupSubtitle">Set up your multiplayer game</p>

        <div className="setupPlayerRow" style={{ marginBottom: 16 }}>
          <div
            className="setupPlayerColor"
            style={{ background: color, cursor: 'pointer' }}
            onClick={() => {
              const idx = COLORS.indexOf(color);
              setColor(COLORS[(idx + 1) % COLORS.length]);
            }}
          >
            {(name[0] || '?').toUpperCase()}
          </div>
          <input
            className="setupPlayerInput"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
          />
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
