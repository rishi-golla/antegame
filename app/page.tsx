'use client';

import { useState, useEffect } from 'react';
import { GameProvider } from '@/context/GameContext';
import { WalletContextProvider } from '@/context/WalletContext';
import { EVMWalletProvider } from '@/context/EVMWalletContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { EVMAuthProvider } from '@/context/EVMAuthContext';
import { MultiChainProvider, useMultiChain } from '@/context/MultiChainContext';
import { SocketProvider, useSocket } from '@/context/SocketContext';
import { MultiplayerGameProvider } from '@/context/MultiplayerGameContext';
import Board from '@/components/Board/Board';
import SidePanel from '@/components/SidePanel/SidePanel';
import PlayerList from '@/components/PlayerList/PlayerList';
import GameOver from '@/components/GameOver/GameOver';
import GameSetup from '@/components/GameSetup/GameSetup';
import CreateRoom from '@/components/Lobby/CreateRoom';
import JoinRoom from '@/components/Lobby/JoinRoom';
import RoomLobby from '@/components/Lobby/RoomLobby';
import TradeModal, { TradeOfferView } from '@/components/Board/TradeModal';
import TurnTimer from '@/components/UI/TurnTimer';
import ConnectScreen from '@/components/Auth/ConnectScreen';
import ProfileSetup from '@/components/Auth/ProfileSetup';
import WalletButton from '@/components/Auth/WalletButton';
import RefundModal from '@/components/Lobby/RefundModal';

type Screen = 'menu' | 'free-play-setup' | 'free-play-game' | 'quick-play' | 'create' | 'join' | 'lobby' | 'game' | 'profile' | 'leaderboard';

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
          <button className="lobbyBackBtn" onClick={() => onNavigate('free-play-setup')}>
            Free Play
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

function FreePlayScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);
  return (
    <>
      <main className="gameScreen">
        <PlayerList onTrade={setTradeTarget} />
        <Board />
        <SidePanel />
      </main>
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
      <TradeOfferView myPlayerIndex={null} />
      <GameOver onPlayAgain={onPlayAgain} />
    </>
  );
}

function OnlineGameScreen({ onPlayAgain, roomCode }: { onPlayAgain: () => void; roomCode?: string }) {
  const { chatMessages, sendChat, roomState } = useSocket();
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);
  const myPlayerIndex = roomState?.players.findIndex(p => p.isYou) ?? null;

  return (
    <MultiplayerGameProvider>
      <TurnTimer />
      <main className="gameScreen">
        <PlayerList onTrade={setTradeTarget} myPlayerIndex={myPlayerIndex} />
        <Board />
        <SidePanel chatMessages={chatMessages} onSendChat={sendChat} />
      </main>
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
      <TradeOfferView myPlayerIndex={myPlayerIndex} />
      <GameOver onPlayAgain={onPlayAgain} roomCode={roomCode} />
    </MultiplayerGameProvider>
  );
}

function RefundOverlay() {
  const { pendingRefund, clearPendingRefund } = useSocket();
  if (!pendingRefund) return null;
  return <RefundModal refund={pendingRefund} onDone={clearPendingRefund} />;
}

function OnlineFlow({ onBack, initialScreen = 'create' }: { onBack: () => void; initialScreen?: 'create' | 'join' }) {
  const [screen, setScreen] = useState<'create' | 'join' | 'lobby' | 'game'>(initialScreen);
  const { roomState, leaveRoom, pendingRefund } = useSocket();

  useEffect(() => {
    if (roomState?.phase === 'playing' && screen === 'lobby') {
      setScreen('game');
    }
  }, [roomState?.phase, screen]);

  const handleLeaveLobby = () => {
    leaveRoom();
    // Stay inside SocketProvider so RefundOverlay can appear
    setScreen('create');
  };

  switch (screen) {
    case 'create':
      return <CreateRoom onCreated={() => setScreen('lobby')} onBack={onBack} />;
    case 'join':
      return <JoinRoom onJoined={() => setScreen('lobby')} onBack={onBack} />;
    case 'lobby':
      return <RoomLobby onLeave={handleLeaveLobby} />;
    case 'game':
      return <OnlineGameScreen onPlayAgain={onBack} roomCode={roomState?.code} />;
  }
}

function AuthGate() {
  const { user, loading, isNewUser } = useMultiChain();
  const [screen, setScreen] = useState<Screen>('menu');
  const [freePlayConfig, setFreePlayConfig] = useState<{ names: string[]; sprites: string[]; colors: string[] } | null>(null);

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
    return <ConnectScreen onFreePlay={() => setScreen('free-play-setup')} />;
  }

  // New user needs profile setup
  if (!user.displayName || !user.characterId) {
    return <ProfileSetup />;
  }

  switch (screen) {
    case 'menu':
      return <MainMenu onNavigate={setScreen} />;

    case 'free-play-setup':
      return (
        <GameSetup
          onStart={(names, sprites, colors) => {
            setFreePlayConfig({ names, sprites, colors });
            setScreen('free-play-game');
          }}
        />
      );

    case 'free-play-game': {
      const cfg = freePlayConfig || { names: ['Player 1', 'Player 2'], sprites: ['', ''], colors: ['#ff6b6b', '#5cd6c0'] };
      return (
        <GameProvider playerNames={cfg.names} playerSprites={cfg.sprites} playerColors={cfg.colors}>
          <FreePlayScreen onPlayAgain={() => setScreen('menu')} />
        </GameProvider>
      );
    }

    case 'quick-play':
      // Placeholder until batch 9.4
      return (
        <div className="setupScreen">
          <WalletButton />
          <div className="setupCard">
            <h1 className="setupTitle marqueeTitle">Quick Play</h1>
            <p className="setupSubtitle casinoSubtitle">Coming soon...</p>
            <button className="lobbyBackBtn" onClick={() => setScreen('menu')}>Back</button>
          </div>
        </div>
      );

    case 'profile':
      // Placeholder until batch 9.5
      return (
        <div className="setupScreen">
          <WalletButton />
          <div className="setupCard">
            <h1 className="setupTitle marqueeTitle">Profile</h1>
            <p className="setupSubtitle casinoSubtitle">{user.displayName}</p>
            <p className="connectChain">{user.walletAddress.slice(0, 8)}...</p>
            <button className="lobbyBackBtn" onClick={() => setScreen('menu')}>Back</button>
          </div>
        </div>
      );

    case 'leaderboard':
      // Placeholder until batch 9.5
      return (
        <div className="setupScreen">
          <WalletButton />
          <div className="setupCard">
            <h1 className="setupTitle marqueeTitle">Leaderboard</h1>
            <p className="setupSubtitle casinoSubtitle">Coming soon...</p>
            <button className="lobbyBackBtn" onClick={() => setScreen('menu')}>Back</button>
          </div>
        </div>
      );

    case 'create':
    case 'join':
    case 'lobby':
    case 'game':
      return (
        <SocketProvider>
          <WalletButton />
          <RefundOverlay />
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
      <EVMWalletProvider>
        <AuthProvider>
          <EVMAuthProvider>
            <MultiChainProvider>
              <AuthGate />
            </MultiChainProvider>
          </EVMAuthProvider>
        </AuthProvider>
      </EVMWalletProvider>
    </WalletContextProvider>
  );
}
