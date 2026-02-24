'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { useMultiplayerTurn } from '@/hooks/useMultiplayerTurn';
import { useSocket } from '@/context/SocketContext';
import type { MinigameTier } from '@/types/game';
import { getBuffModifier } from '@/lib/buffs';
import MinigameResult from './MinigameResult';
import CountdownTimer from '@/components/Board/CountdownTimer';
import SlotMachine from './SlotMachine';
import HigherLower from './HigherLower';
import Craps from './Craps';
import WheelOfFortune from './WheelOfFortune';
import MinesweeperLite from './MinesweeperLite';
import CardWar from './HorseRace';
import LuckyNumber from './DartThrow';
import Blackjack from './Blackjack';
import CoinFlip from './CoinFlip';
import SafeCracker from './SafeCracker';

// All minigame background image paths for preloading
const MINIGAME_BG_PATHS: Record<string, string> = {
  'slots': '/assets/minigames/backgrounds/slots.png',
  'higher-lower': '/assets/minigames/backgrounds/higher-lower.png',
  'craps': '/assets/minigames/backgrounds/craps.png',
  'wheel': '/assets/minigames/backgrounds/wheel.png',
  'minesweeper': '/assets/minigames/backgrounds/minesweeper.png',
  'card-war': '/assets/minigames/backgrounds/card-war.png',
  'lucky-number': '/assets/minigames/backgrounds/lucky-number.png',
  'blackjack': '/assets/minigames/backgrounds/blackjack.png',
  'coin-flip': '/assets/minigames/backgrounds/coin-flip.png',
  'safe-cracker': '/assets/minigames/backgrounds/safe-cracker.png',
};

// Global cache so images are only preloaded once across mounts
let _preloadStarted = false;
const _loadedImages = new Set<string>();

export function preloadAllMinigameBackgrounds() {
  if (_preloadStarted) return;
  _preloadStarted = true;
  Object.entries(MINIGAME_BG_PATHS).forEach(([id, src]) => {
    const img = new Image();
    img.onload = () => _loadedImages.add(id);
    img.src = src;
  });
}

interface MinigameOverlayProps {}

const MINIGAME_NAMES: Record<string, string> = {
  'slots': 'SLOT MACHINE',
  'higher-lower': 'HIGHER OR LOWER',
  'craps': 'CRAPS',
  'wheel': 'WHEEL OF FORTUNE',
  'minesweeper': 'MINESWEEPER',
  'card-war': 'CARD WAR',
  'lucky-number': 'LUCKY NUMBER',
  'blackjack': 'BLACKJACK',
  'coin-flip': 'COIN FLIP',
  'safe-cracker': 'SAFE CRACKER',
};

export default function MinigameOverlay({}: MinigameOverlayProps) {
  const { state, dispatch } = useGame();
  const { play, playMusic } = useAudio();
  const [showIntro, setShowIntro] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [resultTier, setResultTier] = useState<MinigameTier | null>(null);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [resultLocked, setResultLocked] = useState(false);
  const { isMyTurn } = useMultiplayerTurn();
  const { minigameServerResult, clearMinigameServerResult, roomState } = useSocket();
  const isMultiplayer = !!roomState;

  const [bgReady, setBgReady] = useState(false);
  const bgCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minigame = state.activeMinigame;
  const currentPlayerName = state.players[state.currentPlayerIndex]?.name || 'Player';
  const currentPlayerMinigameBoost = getBuffModifier(state.players[state.currentPlayerIndex], 'minigame-boost');

  // Persist minigame data so the result overlay can display after activeMinigame is cleared
  const savedMinigameRef = useRef(minigame);
  if (minigame) {
    savedMinigameRef.current = minigame;
  }

  // Preload all backgrounds on first mount & check active minigame bg
  useEffect(() => {
    preloadAllMinigameBackgrounds();
  }, []);

  useEffect(() => {
    if (!minigame) { setBgReady(false); return; }
    // If already cached, ready immediately
    if (_loadedImages.has(minigame.id)) {
      setBgReady(true);
      return;
    }
    // Load this specific one and wait
    const img = new Image();
    img.onload = () => { _loadedImages.add(minigame.id); setBgReady(true); };
    img.onerror = () => setBgReady(true); // don't block on error
    img.src = MINIGAME_BG_PATHS[minigame.id] || '';
    // Also poll the global cache in case it loaded via the global preloader
    bgCheckRef.current = setInterval(() => {
      if (_loadedImages.has(minigame.id)) {
        setBgReady(true);
        if (bgCheckRef.current) clearInterval(bgCheckRef.current);
      }
    }, 50);
    return () => { if (bgCheckRef.current) clearInterval(bgCheckRef.current); };
  }, [minigame?.id]);

  // Reset state when a new minigame starts
  useEffect(() => {
    if (minigame?.status === 'intro') {
      playMusic('music/bgm-minigame');
      setResultLocked(false);
      setResultTier(null);
      setShowResult(false);
      clearMinigameServerResult();
      setTimeout(() => setCurtainOpen(true), 100);
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [minigame?.status, playMusic, clearMinigameServerResult]);

  // In multiplayer, show result overlay once we receive the server-authoritative tier
  useEffect(() => {
    if (!isMultiplayer || !resultLocked || showResult) return;

    if (minigameServerResult) {
      const serverTier = minigameServerResult.tier;
      setResultTier(serverTier);
      setShowResult(true);

      if (serverTier === 'win') play('minigames/tier-win');
      else if (serverTier === 'close-win') play('minigames/tier-close-win');
      else if (serverTier === 'close-loss') play('minigames/tier-close-loss');
      else if (serverTier === 'loss') play('minigames/tier-loss');
      else if (serverTier === 'catastrophic') play('minigames/tier-catastrophic');
      return;
    }

    // Fallback: if server result doesn't arrive in 3s, show client tier
    const timeout = setTimeout(() => {
      if (resultTier && !showResult) {
        setShowResult(true);
      }
    }, 3000);
    return () => clearTimeout(timeout);
  }, [isMultiplayer, minigameServerResult, resultLocked, showResult, resultTier, play]);

  // Keep overlay visible while result is showing, even after activeMinigame is cleared
  if (!minigame && !showResult && !resultLocked) return null;
  const displayMinigame = minigame ?? savedMinigameRef.current;
  if (!displayMinigame) return null;

  // Show loading screen while background image loads
  if (!bgReady) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#1a0f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{
          fontFamily: 'Cinzel, serif',
          color: '#d4af37',
          fontSize: '1.5rem',
          letterSpacing: '0.1em',
        }}>
          Loading...
        </div>
        <div style={{
          width: '120px',
          height: '3px',
          backgroundColor: 'rgba(212,175,55,0.2)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            backgroundColor: '#d4af37',
            borderRadius: '2px',
            animation: 'mgLoadSlide 1s ease-in-out infinite',
          }} />
        </div>
        <style>{`
          @keyframes mgLoadSlide {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(200%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    );
  }

  const handleResult = (clientTier: MinigameTier) => {
    // Prevent double-result from timeout + game completion race
    if (resultLocked) return;
    setResultLocked(true);

    // In multiplayer, the client sends its result to the server, which responds
    // with the authoritative tier. We dispatch MINIGAME_RESULT to trigger the
    // server round-trip, then wait for minigameServerResult before showing UI.
    if (isMultiplayer) {
      // Dispatch sends game:minigame-result to server; store client tier as pending
      setResultTier(clientTier);
      dispatch({ type: 'MINIGAME_RESULT', tier: clientTier });
      return;
    }

    // Free play: use the client tier directly
    setResultTier(clientTier);
    setShowResult(true);

    if (clientTier === 'win') play('minigames/tier-win');
    else if (clientTier === 'close-win') play('minigames/tier-close-win');
    else if (clientTier === 'close-loss') play('minigames/tier-close-loss');
    else if (clientTier === 'loss') play('minigames/tier-loss');
    else if (clientTier === 'catastrophic') play('minigames/tier-catastrophic');
  };

  const handleDismissResult = () => {
    if (resultTier) {
      playMusic('music/bgm-game');
      // In multiplayer, the server already resolved the game state when we
      // dispatched MINIGAME_RESULT earlier. In free play, dispatch now.
      if (!isMultiplayer) {
        dispatch({ type: 'MINIGAME_RESULT', tier: resultTier });
      }
      clearMinigameServerResult();
      setShowResult(false);
      setResultTier(null);
    }
  };

  const renderMinigame = () => {
    const noOp = () => {};
    const isSpectator = !isMyTurn;
    const props = {
      onResult: isSpectator ? noOp : handleResult,
      baseAmount: displayMinigame.baseAmount,
      context: displayMinigame.context,
      spectator: isSpectator,
    };
    switch (displayMinigame.id) {
      case 'slots': return <SlotMachine {...props} />;
      case 'higher-lower': return <HigherLower {...props} />;
      case 'craps': return <Craps {...props} />;
      case 'wheel': return <WheelOfFortune {...props} />;
      case 'minesweeper': return <MinesweeperLite {...props} />;
      case 'card-war': return <CardWar {...props} />;
      case 'lucky-number': return <LuckyNumber {...props} />;
      case 'blackjack': return <Blackjack {...props} />;
      case 'coin-flip': return <CoinFlip {...props} />;
      case 'safe-cracker': return <SafeCracker {...props} />;
      default:
        return (
          <div className="minigameIntro">
            <h2>MINIGAME NOT FOUND</h2>
            <button className="rollButton" onClick={() => handleResult('loss')}>CONTINUE</button>
          </div>
        );
    }
  };

  if (showResult && resultTier) {
    return (
      <MinigameResult tier={resultTier} baseAmount={displayMinigame.baseAmount} context={displayMinigame.context} onDismiss={handleDismissResult} minigameBoost={currentPlayerMinigameBoost} />
    );
  }

  if (showIntro) {
    return (
      <div className={`minigameOverlay pixelOverlay mg-${displayMinigame.id}`}>
        <div className={`minigameCurtain ${curtainOpen ? 'open' : ''}`}>
          <div className="curtainLeft"></div>
          <div className="curtainRight"></div>
        </div>
        <div className={`minigameIntro ${curtainOpen ? 'visible' : ''}`}>
          <h2 className="minigameIntroTitle">{MINIGAME_NAMES[displayMinigame.id] || displayMinigame.id.replace('-', ' ').toUpperCase()}</h2>
          <p className="minigameStakes">${displayMinigame.baseAmount} on the line</p>
          <p className="minigameContext">{displayMinigame.context === 'buying' ? 'property purchase' : 'rent payment'}</p>
          <div className="minigameTierInfo">
            {(() => {
              const ba = displayMinigame.baseAmount;
              const b = currentPlayerMinigameBoost;
              // Loss tiers get buff discount (matches server logic)
              const disc = (amt: number) => b > 0 ? Math.floor(amt * (1 - b)) : amt;
              return displayMinigame.context === 'buying' ? (
                <>
                  <div className="tierRow tier-win">Win — Get it FREE!</div>
                  <div className="tierRow tier-close-win">Close — Buy for ${Math.floor(ba * 0.5)} (half off)</div>
                  <div className="tierRow tier-close-loss">Almost — Lose ${disc(Math.floor(ba * 1.5))}, no property</div>
                  <div className="tierRow tier-loss">Loss — Lose ${disc(Math.floor(ba * 2))}, no property</div>
                  <div className="tierRow tier-catastrophic">Disaster — Lose ${disc(Math.floor(ba * 5))}, no property</div>
                </>
              ) : (
                <>
                  <div className="tierRow tier-win">Win — No rent!</div>
                  <div className="tierRow tier-close-win">Close — Pay ${Math.floor(ba * 0.5)} rent</div>
                  <div className="tierRow tier-close-loss">Almost — Pay ${disc(Math.floor(ba * 1.5))} rent</div>
                  <div className="tierRow tier-loss">Loss — Pay ${disc(Math.floor(ba * 2))} rent</div>
                  <div className="tierRow tier-catastrophic">Disaster — Pay ${disc(Math.floor(ba * 5))} rent</div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // Spectators see the minigame but can't interact
  const spectator = !isMyTurn;

  return (
    <>
      <div className={`minigameOverlay pixelOverlay mg-${displayMinigame.id}`}>
        {spectator && (
          <div className="spectatorBanner">
            Watching {currentPlayerName}
          </div>
        )}
        <div className="minigameTimerWrapper">
          <CountdownTimer
            duration={30}
            onExpire={() => {
              if (!resultLocked) handleResult('catastrophic');
            }}
            resetKey={`minigame-${displayMinigame.id}-${state.currentPlayerIndex}`}
          />
        </div>
        <div className={spectator ? 'spectatorView' : ''}>
          {renderMinigame()}
        </div>
      </div>
    </>
  );
}
