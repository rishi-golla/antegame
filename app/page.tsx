'use client';

import { useState, useEffect } from 'react';
import { GameProvider } from '@/context/GameContext';
import { SocketProvider, useSocket } from '@/context/SocketContext';
import { MultiplayerGameProvider } from '@/context/MultiplayerGameContext';
import Board from '@/components/Board/Board';
import SidePanel from '@/components/SidePanel/SidePanel';
import PlayerList from '@/components/PlayerList/PlayerList';
import GameSetup from '@/components/GameSetup/GameSetup';
import GameOver from '@/components/GameOver/GameOver';
import CreateRoom from '@/components/Lobby/CreateRoom';
import JoinRoom from '@/components/Lobby/JoinRoom';
import RoomLobby from '@/components/Lobby/RoomLobby';
import AuctionOverlay from '@/components/Board/AuctionOverlay';
import TradeModal from '@/components/Board/TradeModal';

type Screen = 'menu' | 'local-setup' | 'create' | 'join' | 'lobby' | 'local-game' | 'online-game';

function MainMenu({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle">Monopoly</h1>
        <p className="setupSubtitle">Choose how to play</p>
        <div className="menuButtons">
          <button className="setupStartBtn" onClick={() => onNavigate('create')}>
            Create Room
          </button>
          <button className="setupStartBtn menuBtnAlt" onClick={() => onNavigate('join')}>
            Join Room
          </button>
          <button className="lobbyBackBtn" onClick={() => onNavigate('local-setup')}>
            Local Play
          </button>
        </div>
      </div>
    </div>
  );
}

function LocalGameScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);

  return (
    <>
      <main className="gameScreen">
        <PlayerList onTrade={setTradeTarget} />
        <Board />
        <SidePanel />
      </main>
      <AuctionOverlay />
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
      <GameOver onPlayAgain={onPlayAgain} />
    </>
  );
}

function OnlineGameScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const { chatMessages, sendChat } = useSocket();
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);

  return (
    <MultiplayerGameProvider>
      <main className="gameScreen">
        <PlayerList onTrade={setTradeTarget} />
        <Board />
        <SidePanel chatMessages={chatMessages} onSendChat={sendChat} />
      </main>
      <AuctionOverlay />
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
      <GameOver onPlayAgain={onPlayAgain} />
    </MultiplayerGameProvider>
  );
}

function OnlineFlow({ onBack, initialScreen = 'create' }: { onBack: () => void; initialScreen?: 'create' | 'join' }) {
  const [screen, setScreen] = useState<'create' | 'join' | 'lobby' | 'game'>(initialScreen);
  const { roomState, leaveRoom } = useSocket();

  // Auto-transition to game when room phase changes
  useEffect(() => {
    if (roomState?.phase === 'playing' && screen === 'lobby') {
      setScreen('game');
    }
  }, [roomState?.phase, screen]);

  const handleLeaveLobby = () => {
    leaveRoom();
    onBack();
  };

  switch (screen) {
    case 'create':
      return <CreateRoom onCreated={() => setScreen('lobby')} onBack={onBack} />;
    case 'join':
      return <JoinRoom onJoined={() => setScreen('lobby')} onBack={onBack} />;
    case 'lobby':
      return <RoomLobby onLeave={handleLeaveLobby} />;
    case 'game':
      return <OnlineGameScreen onPlayAgain={onBack} />;
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [localPlayerNames, setLocalPlayerNames] = useState<string[]>([]);

  switch (screen) {
    case 'menu':
      return <MainMenu onNavigate={setScreen} />;

    case 'local-setup':
      return (
        <GameSetup
          onStart={(names) => {
            setLocalPlayerNames(names);
            setScreen('local-game');
          }}
        />
      );

    case 'local-game':
      return (
        <GameProvider playerNames={localPlayerNames}>
          <LocalGameScreen onPlayAgain={() => setScreen('menu')} />
        </GameProvider>
      );

    case 'create':
    case 'join':
    case 'lobby':
    case 'online-game':
      return (
        <SocketProvider>
          <OnlineFlow
            onBack={() => setScreen('menu')}
            initialScreen={screen === 'join' ? 'join' : 'create'}
          />
        </SocketProvider>
      );

    default:
      return <MainMenu onNavigate={setScreen} />;
  }
}
