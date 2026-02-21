'use client';

import { useState } from 'react';
import { CHARACTERS, type CharacterDef } from '@/lib/assetMap';

interface GameSetupProps {
  onStart: (names: string[], sprites: string[], colors: string[]) => void;
}

interface PlayerSetup {
  name: string;
  characterId: string | null;
}

export default function GameSetup({ onStart }: GameSetupProps) {
  const [playerCount, setPlayerCount] = useState(4);
  const [players, setPlayers] = useState<PlayerSetup[]>(
    Array.from({ length: 6 }, (_, i) => ({ name: `Player ${i + 1}`, characterId: null }))
  );

  const updateName = (index: number, value: string) => {
    const next = [...players];
    next[index] = { ...next[index], name: value };
    setPlayers(next);
  };

  const selectCharacter = (playerIndex: number, charId: string) => {
    const next = [...players];
    // Toggle off if already selected
    if (next[playerIndex].characterId === charId) {
      next[playerIndex] = { ...next[playerIndex], characterId: null };
    } else {
      next[playerIndex] = { ...next[playerIndex], characterId: charId };
    }
    setPlayers(next);
  };

  const takenCharacters = players
    .slice(0, playerCount)
    .map((p) => p.characterId)
    .filter(Boolean) as string[];

  const handleStart = () => {
    const activePlayers = players.slice(0, playerCount);
    const finalNames = activePlayers.map((p, i) => p.name.trim() || `Player ${i + 1}`);
    const finalSprites = activePlayers.map((p) => {
      const char = CHARACTERS.find((c) => c.id === p.characterId);
      return char?.sprite ?? '';
    });
    const finalColors = activePlayers.map((p) => {
      const char = CHARACTERS.find((c) => c.id === p.characterId);
      return char?.color ?? ['#ff6b6b', '#5cd6c0', '#ffd166', '#8fb8ff', '#c084fc', '#fb923c'][0];
    });
    onStart(finalNames, finalSprites, finalColors);
  };

  const [activePlayerTab, setActivePlayerTab] = useState(0);

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Ante</h1>
        <p className="setupSubtitle casinoSubtitle">Choose your characters</p>

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

        {/* Player tabs */}
        <div className="setupCountBtns" style={{ marginBottom: 12 }}>
          {Array.from({ length: playerCount }).map((_, i) => {
            const char = CHARACTERS.find((c) => c.id === players[i].characterId);
            return (
              <button
                key={i}
                className={`setupCountBtn ${activePlayerTab === i ? 'active' : ''}`}
                onClick={() => setActivePlayerTab(i)}
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.78rem' }}
              >
                {players[i].name.trim() || `P${i + 1}`}
              </button>
            );
          })}
        </div>

        {/* Active player config */}
        <div className="setupPlayerRow" style={{ marginBottom: 12 }}>
          <div
            className="setupPlayerColor casinoChipSelector"
            style={{
              background: CHARACTERS.find((c) => c.id === players[activePlayerTab].characterId)?.color ?? '#555',
              overflow: 'hidden',
            }}
          >
            {players[activePlayerTab].characterId ? (
              <img
                src={CHARACTERS.find((c) => c.id === players[activePlayerTab].characterId)!.sprite}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as const }}
              />
            ) : (
              (players[activePlayerTab].name[0] || `${activePlayerTab + 1}`).toUpperCase()
            )}
          </div>
          <input
            className="setupPlayerInput"
            placeholder={`Player ${activePlayerTab + 1}`}
            value={players[activePlayerTab].name}
            onChange={(e) => updateName(activePlayerTab, e.target.value)}
            maxLength={16}
          />
        </div>

        {/* Character selection grid */}
        <div className="characterGrid">
          {CHARACTERS.map((char) => {
            const isSelected = players[activePlayerTab].characterId === char.id;
            const isTaken = takenCharacters.includes(char.id) && !isSelected;
            return (
              <div
                key={char.id}
                className={`characterCard ${isSelected ? 'characterCardSelected' : ''} ${isTaken ? 'characterCardDisabled' : ''}`}
                onClick={() => !isTaken && selectCharacter(activePlayerTab, char.id)}
              >
                <img src={char.sprite} alt={char.name} className="characterCardSprite" draggable={false} />
                <span className="characterCardName">{char.name}</span>
                <span className="characterCardBuff">{char.buff.name}</span>
                <span className="characterCardBuffDesc">{char.buff.description}</span>
              </div>
            );
          })}
        </div>

        <button className="setupStartBtn" onClick={handleStart}>
          Start Game
        </button>
      </div>
    </div>
  );
}
