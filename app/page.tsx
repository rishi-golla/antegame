'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudio } from '@/context/AudioContext';
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
import ProfileScreen from '@/components/Auth/ProfileScreen';
import AudioControls from '@/components/UI/AudioControls';
import WalletButton from '@/components/Auth/WalletButton';
import ReferralButton from '@/components/Auth/ReferralButton';
import RefundModal from '@/components/Lobby/RefundModal';
import QuickPlay from '@/components/Lobby/QuickPlay';
import QuickPlayLobby from '@/components/Lobby/QuickPlayLobby';

type Screen = 'menu' | 'free-play-setup' | 'free-play-game' | 'quick-play' | 'create' | 'join' | 'lobby' | 'game' | 'profile' | 'leaderboard';

const MENU_MUSIC_SCREENS: Screen[] = ['menu', 'quick-play', 'profile', 'leaderboard'];

function StopMusic() {
  const { stopMusic } = useAudio();
  useEffect(() => { stopMusic(); }, [stopMusic]);
  return null;
}

function LobbyMusic({ screen }: { screen: Screen }) {
  const { playMusic, stopMusic } = useAudio();

  useEffect(() => {
    if (MENU_MUSIC_SCREENS.includes(screen)) {
      playMusic('music/bgm-lobby');
    } else {
      stopMusic();
    }
  }, [screen, playMusic, stopMusic]);

  return null;
}

function MainMenu({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="setupScreen">
      <div className="topBarBtns"><ReferralButton /><WalletButton /></div>
      <div className="setupCard casinoMenuCard">
        <h1 className="setupTitle marqueeTitle">Ante</h1>
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
  const { stopMusic } = useAudio();
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);

  useEffect(() => { stopMusic(); }, [stopMusic]);
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
  const { stopMusic } = useAudio();
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);
  const myPlayerIndex = roomState?.players.findIndex(p => p.isYou) ?? null;

  useEffect(() => { stopMusic(); }, [stopMusic]);

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

function QuickPlayFlow({ onBack }: { onBack: () => void }) {
  const [qpScreen, setQpScreen] = useState<'select' | 'lobby' | 'game'>('select');
  const { roomState } = useSocket();
  const myPlayerIndex = roomState?.players.findIndex(p => p.isYou) ?? null;

  useEffect(() => {
    if (roomState?.phase === 'playing' && qpScreen === 'lobby') {
      setQpScreen('game');
    }
  }, [roomState?.phase, qpScreen]);

  switch (qpScreen) {
    case 'select':
      return <QuickPlay onMatched={() => setQpScreen('lobby')} onBack={onBack} />;
    case 'lobby':
      return <QuickPlayLobby onLeave={() => setQpScreen('select')} onGameStart={() => setQpScreen('game')} />;
    case 'game':
      return (
        <MultiplayerGameProvider>
          <TurnTimer />
          <main className="gameScreen">
            <PlayerList myPlayerIndex={myPlayerIndex} />
            <Board />
            <SidePanel />
          </main>
          <TradeOfferView myPlayerIndex={myPlayerIndex} />
          <GameOver onPlayAgain={onBack} roomCode={roomState?.code} />
        </MultiplayerGameProvider>
      );
  }
}

function RefundOverlay() {
  const { pendingRefund, clearPendingRefund } = useSocket();
  if (!pendingRefund) return null;
  return <RefundModal refund={pendingRefund} onDone={clearPendingRefund} />;
}

function OnlineFlow({ onBack, initialScreen = 'create', roomCode: initialRoomCode }: { onBack: () => void; initialScreen?: 'create' | 'join'; roomCode?: string }) {
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
      return <JoinRoom onJoined={() => setScreen('lobby')} onBack={onBack} initialCode={initialRoomCode} />;
    case 'lobby':
      return <RoomLobby onLeave={handleLeaveLobby} />;
    case 'game':
      return <OnlineGameScreen onPlayAgain={onBack} roomCode={roomState?.code} />;
  }
}

/** Map screen state to URL path and extract screen from URL */
function screenToPath(screen: Screen, roomCode?: string): string {
  switch (screen) {
    case 'menu': return '/';
    case 'free-play-setup': return '/free-play';
    case 'free-play-game': return '/free-play/game';
    case 'quick-play': return '/quick-play';
    case 'create': return '/create';
    case 'join': return roomCode ? `/join?room=${roomCode}` : '/join';
    case 'lobby': return roomCode ? `/lobby?room=${roomCode}` : '/lobby';
    case 'game': return roomCode ? `/game?room=${roomCode}` : '/game';
    case 'profile': return '/profile';
    case 'leaderboard': return '/leaderboard';
    default: return '/';
  }
}

function pathToScreen(): { screen: Screen; roomCode?: string } {
  if (typeof window === 'undefined') return { screen: 'menu' };
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room') ?? undefined;

  if (path === '/free-play/game') return { screen: 'free-play-game' };
  if (path === '/free-play') return { screen: 'free-play-setup' };
  if (path === '/quick-play') return { screen: 'quick-play' };
  if (path === '/create') return { screen: 'create' };
  if (path === '/join') return { screen: 'join', roomCode: room };
  if (path === '/lobby') return { screen: 'lobby', roomCode: room };
  if (path === '/game') return { screen: 'game', roomCode: room };
  if (path === '/profile') return { screen: 'profile' };
  if (path === '/leaderboard') return { screen: 'leaderboard' };
  // Also check for ?room= on root (shared link)
  if (room) return { screen: 'join', roomCode: room };
  return { screen: 'menu' };
}

function AuthGate() {
  const { user, loading, isNewUser } = useMultiChain();
  const initial = pathToScreen();
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | undefined>(initial.roomCode);
  const [freePlayConfig, setFreePlayConfig] = useState<{ names: string[]; sprites: string[]; colors: string[] } | null>(null);
  const suppressPushRef = useRef(false);

  // Push browser history on screen change
  const navigate = useCallback((newScreen: Screen, roomCode?: string) => {
    setScreen(newScreen);
    if (roomCode) setPendingRoomCode(roomCode);
    const path = screenToPath(newScreen, roomCode ?? pendingRoomCode);
    window.history.pushState({ screen: newScreen, roomCode }, '', path);
  }, [pendingRoomCode]);

  // Handle back/forward button
  useEffect(() => {
    const handlePop = () => {
      const { screen: s, roomCode } = pathToScreen();
      suppressPushRef.current = true;
      setScreen(s);
      if (roomCode) setPendingRoomCode(roomCode);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Replace initial state so first back doesn't break
  useEffect(() => {
    const path = screenToPath(initial.screen, initial.roomCode);
    window.history.replaceState({ screen: initial.screen, roomCode: initial.roomCode }, '', path);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    return <><StopMusic /><ConnectScreen onFreePlay={() => navigate('free-play-setup')} /></>;
  }

  // New user needs profile setup
  if (!user.displayName || !user.characterId) {
    return <ProfileSetup />;
  }

  const content = (() => { switch (screen) {
    case 'menu':
      return <MainMenu onNavigate={navigate} />;

    case 'free-play-setup':
      return (
        <GameSetup
          onStart={(names, sprites, colors) => {
            setFreePlayConfig({ names, sprites, colors });
            navigate('free-play-game');
          }}
        />
      );

    case 'free-play-game': {
      const cfg = freePlayConfig || { names: ['Player 1', 'Player 2'], sprites: ['', ''], colors: ['#ff6b6b', '#5cd6c0'] };
      return (
        <GameProvider playerNames={cfg.names} playerSprites={cfg.sprites} playerColors={cfg.colors}>
          <FreePlayScreen onPlayAgain={() => navigate('menu')} />
        </GameProvider>
      );
    }

    case 'quick-play':
      return (
        <SocketProvider>
          <div className="topBarBtns"><ReferralButton /><WalletButton /></div>
          <RefundOverlay />
          <QuickPlayFlow onBack={() => navigate('menu')} />
        </SocketProvider>
      );

    case 'profile':
      return (
        <>
          <div className="topBarBtns"><ReferralButton /><WalletButton /></div>
          <ProfileScreen onBack={() => navigate('menu')} />
        </>
      );

    case 'leaderboard':
      // Placeholder until batch 9.5
      return (
        <div className="setupScreen">
          <div className="topBarBtns"><ReferralButton /><WalletButton /></div>
          <div className="setupCard">
            <h1 className="setupTitle">Leaderboard</h1>
            <p className="setupSubtitle casinoSubtitle">Coming soon...</p>
            <button className="lobbyBackBtn" onClick={() => navigate('menu')}>Back</button>
          </div>
        </div>
      );

    case 'create':
    case 'join':
    case 'lobby':
    case 'game':
      return (
        <SocketProvider>
          <div className="topBarBtns"><ReferralButton /><WalletButton /></div>
          <RefundOverlay />
          <OnlineFlow
            onBack={() => navigate('menu')}
            initialScreen={screen === 'join' ? 'join' : 'create'}
            roomCode={pendingRoomCode}
          />
        </SocketProvider>
      );

    default:
      return <MainMenu onNavigate={navigate} />;
  } })();

  return (
    <>
      <AudioControls
        onHome={screen !== 'menu' ? () => navigate('menu') : undefined}
        inGame={screen === 'free-play-game' || screen === 'create' || screen === 'join' || screen === 'quick-play'}
      />
      <LobbyMusic screen={screen} />
      {content}
    </>
  );
}

function Home() {
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

import dynamic from 'next/dynamic';
export default dynamic(() => Promise.resolve(Home), { ssr: false });
