'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';

const COLORS = ['#ff6b6b', '#5cd6c0', '#ffd166', '#8fb8ff', '#c084fc', '#fb923c'];

interface JoinRoomProps {
  onJoined: () => void;
  onBack: () => void;
}

export default function JoinRoom({ onJoined, onBack }: JoinRoomProps) {
  const { joinRoom } = useSocket();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState(COLORS[1]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    const result = await joinRoom(code.trim().toUpperCase(), name.trim(), color);
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
        <h1 className="setupTitle">Join Room</h1>
        <p className="setupSubtitle">Enter a room code to join</p>

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
