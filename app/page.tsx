'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useBalance, useAccount } from 'wagmi';
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
import GameSetup from '@/components/GameSetup/GameSetup';
import RoomLobby from '@/components/Lobby/RoomLobby';
import TradeModal, { TradeOfferView } from '@/components/Board/TradeModal';
import ConnectScreen from '@/components/Auth/ConnectScreen';
import LandingPage from '@/components/Landing/LandingPage';
import ProfileSetup from '@/components/Auth/ProfileSetup';
import ProfileScreen from '@/components/Auth/ProfileScreen';
import AudioControls from '@/components/UI/AudioControls';
import WalletButton from '@/components/Auth/WalletButton';
import ReferralButton from '@/components/Auth/ReferralButton';
import CampaignLeaderboardScreen from '@/components/Auth/CampaignLeaderboardScreen';
import QuickPlayLobby from '@/components/Lobby/QuickPlayLobby';
import TurnSummary from '@/components/UI/TurnSummary';
import StuckGameBanner from '@/components/UI/StuckGameBanner';
import ReconnectOverlay from '@/components/UI/ReconnectOverlay';
import TurnAnnounce from '@/components/TurnAnnounce';
import { getGameSession, clearGameSession } from '@/lib/gameSession';

type Screen = 'menu' | 'free-play-setup' | 'free-play-game' | 'quick-play' | 'create' | 'join' | 'lobby' | 'game' | 'profile' | 'leaderboard';

const MENU_MUSIC_SCREENS: Screen[] = ['menu', 'quick-play', 'profile', 'leaderboard'];

const GameOver = dynamic(() => import('@/components/GameOver/GameOver'), { ssr: false });
const CreateRoom = dynamic(() => import('@/components/Lobby/CreateRoom'), { ssr: false });
const JoinRoom = dynamic(() => import('@/components/Lobby/JoinRoom'), { ssr: false });
const RefundModal = dynamic(() => import('@/components/Lobby/RefundModal'), { ssr: false });
const QuickPlay = dynamic(() => import('@/components/Lobby/QuickPlay'), { ssr: false });

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

function CampaignBanner({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [phase, setPhase] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [boostEnd, setBoostEnd] = useState<number | null>(null);
  const [campaignEnd, setCampaignEnd] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/referrals/campaign')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.phase === 'none') return;
        setPhase(data.phase);
        if (data.boostEndsUtc) setBoostEnd(new Date(data.boostEndsUtc).getTime());
        if (data.campaignEndUtc) setCampaignEnd(new Date(data.campaignEndUtc).getTime());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!phase || phase === 'none' || phase === 'ended') return;
    const target = phase === 'boost' ? boostEnd : campaignEnd;
    if (!target) return;
    function tick() {
      const diff = Math.max(0, target! - Date.now());
      if (diff <= 0) { setCountdown('00:00:00'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, boostEnd, campaignEnd]);

  if (!phase || phase === 'none') return null;

  return (
    <button
      className="campaignBanner"
      onClick={() => onNavigate('leaderboard')}
    >
      {phase === 'boost' ? (
        <>
          <span className="campaignBannerTag">LIVE</span>
          <span>Referral Boost -- 50% fees for {countdown}</span>
        </>
      ) : phase === 'normal' ? (
        <>
          <span className="campaignBannerTag">LIVE</span>
          <span>Referral Campaign -- {countdown} left</span>
        </>
      ) : phase === 'upcoming' ? (
        <span>Referral Campaign starting soon</span>
      ) : (
        <span>Referral Campaign ended -- View results</span>
      )}
      <span className="campaignBannerArrow">&rarr;</span>
    </button>
  );
}

function MainMenu({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { user } = useMultiChain();
  const { address } = useAccount();
  const { data: balanceData } = useBalance({ address });

  const balanceStr = useMemo(() => {
    if (!balanceData) return null;
    const val = parseFloat(balanceData.formatted);
    return val > 0 ? val.toFixed(4) : null;
  }, [balanceData]);

  return (
    <div className="menuScreen">
      <div className="topBarBtns"><ReferralButton /><WalletButton /></div>

      {/* Background image */}
      <img src="/assets/landing/menu-bg.webp" alt="" style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.2,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Floating particles */}
      <div className="menuParticles">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="menuParticle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
            opacity: 0.15 + Math.random() * 0.25,
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
          }} />
        ))}
      </div>

      <div className="menuLobby">
        {/* Branding — use mascot instead of logo */}
        <div className="menuBranding">
          <img src="/assets/sprites/card-shark.webp" alt="Ante" className="menuMascot" />
          <h1 className="menuTitle">Ante</h1>
          <p className="menuSubtitle">Stake crypto. Roll dice. Win the pot.</p>
          {balanceStr && (
            <div className="menuStatusRow">
              <span className="menuBalance">$ {balanceStr} ETH</span>
            </div>
          )}
        </div>

        <CampaignBanner onNavigate={onNavigate} />

        {/* Main action cards */}
        <div className="menuActionCards">
          <button className="menuActionCard" onClick={() => onNavigate('quick-play')}>
            <img src="/assets/menu-icons/quick-play.webp" alt="" className="menuActionImg" />
            <div className="menuActionInfo">
              <h3 className="menuActionName">Quick Play</h3>
              <p className="menuActionDesc">Jump into a game instantly. Auto-matched by stake tier.</p>
            </div>
          </button>
          <button className="menuActionCard" onClick={() => onNavigate('create')}>
            <img src="/assets/menu-icons/create-room.webp" alt="" className="menuActionImg" />
            <div className="menuActionInfo">
              <h3 className="menuActionName">Create Room</h3>
              <p className="menuActionDesc">Set the stakes and invite your friends.</p>
            </div>
          </button>
          <button className="menuActionCard" onClick={() => onNavigate('join')}>
            <img src="/assets/menu-icons/join-room.webp" alt="" className="menuActionImg" />
            <div className="menuActionInfo">
              <h3 className="menuActionName">Join Room</h3>
              <p className="menuActionDesc">Enter a room code to join a private game.</p>
            </div>
          </button>
        </div>

        {/* Secondary row */}
        <div className="menuSecondaryRow">
          <button className="menuGhostBtn" onClick={() => onNavigate('free-play-setup')}>
            <img src="/assets/menu-icons/free-play.webp" alt="" className="menuGhostImg" />
            Free Play
          </button>
          <button className="menuGhostBtn" onClick={() => onNavigate('profile')}>
            <img src="/assets/menu-icons/profile.webp" alt="" className="menuGhostImg" />
            Profile
          </button>
          <button className="menuGhostBtn" onClick={() => onNavigate('leaderboard')}>
            <img src="/assets/menu-icons/leaderboard.webp" alt="" className="menuGhostImg" />
            Leaderboard
          </button>
          <button className="menuGhostBtn" onClick={() => window.location.assign('/bridge')}>
            Bridge SOL → Base
          </button>
        </div>
      </div>
    </div>
  );
}

function FreePlayScreen({ onPlayAgain }: { onPlayAgain: () => void }) {
  const { stopMusic } = useAudio();
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderName: string; senderColor: string; text: string; system: boolean; timestamp: number }>>([]);

  const handleSendChat = (text: string) => {
    setChatMessages(prev => [...prev, {
      id: `local-${Date.now()}`,
      senderName: 'You',
      senderColor: '#d4af37',
      text,
      system: false,
      timestamp: Date.now(),
    }]);
  };

  useEffect(() => { stopMusic(); }, [stopMusic]);
  return (
    <>
      <main className="gameScreen">
        <PlayerList onTrade={setTradeTarget} />
        <Board />
        <SidePanel chatMessages={chatMessages} onSendChat={handleSendChat} />
      </main>
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
      <TradeOfferView myPlayerIndex={null} />
      <TurnAnnounce />
      <TurnSummary />
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
      <StuckGameBanner />
      <ReconnectOverlay onBackToMenu={onPlayAgain} />
      <main className="gameScreen">
        <PlayerList onTrade={setTradeTarget} myPlayerIndex={myPlayerIndex} />
        <Board />
        <SidePanel chatMessages={chatMessages} onSendChat={sendChat} />
      </main>
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} myPlayerIndex={myPlayerIndex} />
      )}
      <TradeOfferView myPlayerIndex={myPlayerIndex} />
      <TurnAnnounce />
      <TurnSummary />
      <GameOver onPlayAgain={onPlayAgain} roomCode={roomCode} />
    </MultiplayerGameProvider>
  );
}

function QuickPlayFlow({ onBack }: { onBack: () => void }) {
  const [qpScreen, setQpScreen] = useState<'select' | 'lobby' | 'game'>('select');
  const { roomState, reconnectFailed, clearReconnectFailed } = useSocket();
  const myPlayerIndex = roomState?.players.findIndex(p => p.isYou) ?? null;

  useEffect(() => {
    if (roomState?.phase === 'playing' && qpScreen !== 'game') {
      setQpScreen('game');
    }
  }, [roomState?.phase, qpScreen]);

  // If reconnect failed (room gone / game ended), go back to menu
  useEffect(() => {
    if (reconnectFailed) {
      clearReconnectFailed();
      onBack();
    }
  }, [reconnectFailed, clearReconnectFailed, onBack]);

  switch (qpScreen) {
    case 'select':
      return <QuickPlay onMatched={() => setQpScreen('lobby')} onBack={onBack} />;
    case 'lobby':
      return <QuickPlayLobby onLeave={() => setQpScreen('select')} onGameStart={() => setQpScreen('game')} />;
    case 'game':
      return (
        <MultiplayerGameProvider>
          <StuckGameBanner />
          <ReconnectOverlay onBackToMenu={onBack} />
          <main className="gameScreen">
            <PlayerList myPlayerIndex={myPlayerIndex} />
            <Board />
            <SidePanel />
          </main>
          <TradeOfferView myPlayerIndex={myPlayerIndex} />
          <TurnAnnounce />
          <TurnSummary />
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
  const { roomState, leaveRoom, reconnectFailed, clearReconnectFailed } = useSocket();

  useEffect(() => {
    // Auto-transition to game when server confirms we're in an active game
    // (covers lobby->game, and reconnect landing on create/join->game)
    if (roomState?.phase === 'playing' && screen !== 'game') {
      setScreen('game');
    }
    // Room was cancelled (e.g. deposited player left) — go back to create screen
    if (roomState?.phase === 'finished' && screen === 'lobby') {
      setScreen('create');
    }
  }, [roomState?.phase, screen]);

  // If reconnect failed (room gone / game ended), go back to menu
  useEffect(() => {
    if (reconnectFailed) {
      clearReconnectFailed();
      onBack();
    }
  }, [reconnectFailed, clearReconnectFailed, onBack]);

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

  // Save ref param synchronously before replaceState strips it from the URL
  useState(() => {
    if (typeof window !== 'undefined') {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref) sessionStorage.setItem('ref', ref);
    }
  });
  const [freePlayConfig, setFreePlayConfig] = useState<{ names: string[]; sprites: string[]; colors: string[]; characterIds: string[] } | null>(null);
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

  // Auto-route to game screen if there's an active session in localStorage
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const session = getGameSession();
    if (session && screen === 'menu') {
      navigate('game', session.roomCode);
    }
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before closing tab during active game
  const isInActiveGame = screen === 'game' || screen === 'quick-play';
  useEffect(() => {
    if (!isInActiveGame) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isInActiveGame]);

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
    return <><StopMusic /><LandingPage onFreePlay={() => navigate('free-play-setup')} /></>;
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
          onStart={(names, sprites, colors, characterIds) => {
            setFreePlayConfig({ names, sprites, colors, characterIds });
            navigate('free-play-game');
          }}
        />
      );

    case 'free-play-game': {
      if (!freePlayConfig) {
        // No config (page was refreshed) — redirect to setup
        navigate('free-play-setup');
        return null;
      }
      return (
        <GameProvider playerNames={freePlayConfig.names} playerSprites={freePlayConfig.sprites} playerColors={freePlayConfig.colors} playerCharacterIds={freePlayConfig.characterIds}>
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
      return (
        <>
          <div className="topBarBtns"><ReferralButton /><WalletButton /></div>
          <CampaignLeaderboardScreen onBack={() => navigate('menu')} />
        </>
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
        onHome={screen !== 'menu' ? () => {
          if (isInActiveGame) {
            const confirmed = window.confirm(
              'Leave game? You\'ll have 2 minutes to reconnect before being removed.'
            );
            if (!confirmed) return;
          }
          navigate('menu');
        } : undefined}
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
