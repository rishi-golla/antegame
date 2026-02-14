'use client';

import { GameProvider } from '@/context/GameContext';
import Board from '@/components/Board/Board';
import SidePanel from '@/components/SidePanel/SidePanel';
import PlayerList from '@/components/PlayerList/PlayerList';

export default function Home() {
  return (
    <GameProvider>
      <main className="gameScreen">
        <PlayerList />
        <Board />
        <SidePanel />
      </main>
    </GameProvider>
  );
}
