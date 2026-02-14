'use client';

import { useState } from 'react';

const DEFAULT_COLORS = ['#ff6b6b', '#5cd6c0', '#ffd166', '#8fb8ff', '#c084fc', '#fb923c'];
const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];

interface GameSetupProps {
  onStart: (names: string[]) => void;
}

export default function GameSetup({ onStart }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES.slice());

  const updateName = (index: number, value: string) => {
    const next = [...names];
    next[index] = value;
    setNames(next);
  };

  const handleStart = () => {
    const finalNames = names.slice(0, playerCount).map((n, i) => n.trim() || `Player ${i + 1}`);
    onStart(finalNames);
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle">Monopoly</h1>
        <p className="setupSubtitle">Set up your game</p>

        <div className="setupPlayerCount">
          <label>Players</label>
          <div className="setupCountBtns">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                className={`setupCountBtn ${playerCount === n ? 'active' : ''}`}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="setupPlayerList">
          {Array.from({ length: playerCount }).map((_, i) => (
            <div key={i} className="setupPlayerRow">
              <div className="setupPlayerColor" style={{ background: DEFAULT_COLORS[i] }}>
                {(names[i]?.[0] || `${i + 1}`).toUpperCase()}
              </div>
              <input
                className="setupPlayerInput"
                placeholder={`Player ${i + 1}`}
                value={names[i] || ''}
                onChange={(e) => updateName(i, e.target.value)}
                maxLength={16}
              />
            </div>
          ))}
        </div>

        <button className="setupStartBtn" onClick={handleStart}>
          Start Game
        </button>
      </div>
    </div>
  );
}
