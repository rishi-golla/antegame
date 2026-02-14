'use client';

import { useState } from 'react';
import { GameProvider, useGame } from '@/context/GameContext';
import Board from '@/components/Board/Board';
import SidePanel from '@/components/SidePanel/SidePanel';
import PlayerList from '@/components/PlayerList/PlayerList';
import GameSetup from '@/components/GameSetup/GameSetup';
import GameOver from '@/components/GameOver/GameOver';

function GameScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const { state } = useGame();

  return (
    <>
      <main className="gameScreen">
        <PlayerList />
        <Board />
        <SidePanel />
      </main>
      {state.phase === 'game-over' && <GameOver onPlayAgain={onPlayAgain} />}
    </>
  );
}

export default function Home() {
  const [gameState, setGameState] = useState<'setup' | 'playing'>('setup');
  const [playerNames, setPlayerNames] = useState<string[]>([]);

  const handleStart = (names: string[]) => {
    setPlayerNames(names);
    setGameState('playing');
  };

  const handlePlayAgain = () => {
    setGameState('setup');
    setPlayerNames([]);
  };

  if (gameState === 'setup') {
    return <GameSetup onStart={handleStart} />;
  }

  return (
    <GameProvider playerNames={playerNames}>
      <GameScreen onPlayAgain={handlePlayAgain} />
    </GameProvider>
  );
}
