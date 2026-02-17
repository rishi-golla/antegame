'use client';

import { useState, useEffect } from 'react';
import { WalletContextProvider } from '@/context/WalletContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SocketProvider, useSocket } from '@/context/SocketContext';
import { MultiplayerGameProvider } from '@/context/MultiplayerGameContext';
import Board from '@/components/Board/Board';
import SidePanel from '@/components/SidePanel/SidePanel';
import PlayerList from '@/components/PlayerList/PlayerList';
import GameOver from '@/components/GameOver/GameOver';
import CreateRoom from '@/components/Lobby/CreateRoom';
import JoinRoom from '@/components/Lobby/JoinRoom';
import RoomLobby from '@/components/Lobby/RoomLobby';
import TradeModal from '@/components/Board/TradeModal';
import ConnectScreen from '@/components/Auth/ConnectScreen';
import ProfileSetup from '@/components/Auth/ProfileSetup';
import WalletButton from '@/components/Auth/WalletButton';
import QuickPlayScreen from '@/components/QuickPlay/QuickPlayScreen';
import ProfileScreen from '@/components/Auth/ProfileScreen';
import LeaderboardScreen from '@/components/Auth/LeaderboardScreen';

type Screen = 'menu' | 'quick-play' | 'create' | 'join' | 'lobby' | 'game' | 'profile' | 'leaderboard';

function MainMenu({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="setupScreen">
      <WalletButton />
      <div className="setupCard casinoMenuCard">
        <h1 className="setupTitle marqueeTitle">Monopoly</h1>
        <p className="setupSubtitle casinoSubtitle">Choose how to play</p>
        <div className="menuButtons">
          <button className="setupStartBtn neonBtn" onClick={() => onNavigate('quick-play')}>
            Quick Play
          </button>
          <button className="setupStartBtn neonBtn menuBtnAlt" onClick={() => onNavigate('create')}>
            Create Room
          </button>
          <button className="setupStartBtn neonBtn menuBtnAlt" onClick={() => onNavigate('join')}>
            Join Room
          </button>
          <button className="lobbyBackBtn" onClick={() => onNavigate('profile')}>
            Profile
          </button>
          <button className="lobbyBackBtn" onClick={() => onNavigate('leaderboard')}>
            Leaderboard
          </button>
        </div>
      </div>
    </div>
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

function AuthGate() {
  const { user, loading } = useAuth();
  const [screen, setScreen] = useState<Screen>('menu');

  if (loading) {
    return (
      <div className="connectScreen">
        <div className="connectCard">
          <p className="connectTagline">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <ConnectScreen />;
  }

  if (!user.displayName || !user.characterId) {
    return <ProfileSetup />;
  }

  switch (screen) {
    case 'menu':
      return <MainMenu onNavigate={setScreen} />;

    case 'quick-play':
      return (
        <SocketProvider>
          <WalletButton />
          <QuickPlayScreen onFound={() => setScreen('lobby')} onBack={() => setScreen('menu')} />
        </SocketProvider>
      );

    case 'profile':
      return (
        <>
          <WalletButton />
          <ProfileScreen onBack={() => setScreen('menu')} />
        </>
      );

    case 'leaderboard':
      return (
        <>
          <WalletButton />
          <LeaderboardScreen onBack={() => setScreen('menu')} />
        </>
      );

    case 'create':
    case 'join':
    case 'lobby':
    case 'game':
      return (
        <SocketProvider>
          <WalletButton />
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

export default function Home() {
  return (
    <WalletContextProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </WalletContextProvider>
  );
}
