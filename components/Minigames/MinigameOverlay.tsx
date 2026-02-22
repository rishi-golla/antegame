'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { useMultiplayerTurn } from '@/hooks/useMultiplayerTurn';
import type { MinigameTier } from '@/types/game';
import MinigameResult from './MinigameResult';
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

  const [bgReady, setBgReady] = useState(false);
  const bgCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minigame = state.activeMinigame;
  const currentPlayerName = state.players[state.currentPlayerIndex]?.name || 'Player';

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

  useEffect(() => {
    if (minigame?.status === 'intro') {
      playMusic('music/bgm-minigame');
      setTimeout(() => setCurtainOpen(true), 100);
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [minigame?.status, playMusic]);

  if (!minigame) return null;

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

  const handleResult = (tier: MinigameTier) => {
    // Prevent double-result from timeout + game completion race
    if (resultLocked) return;
    setResultLocked(true);
    setResultTier(tier);
    setShowResult(true);
    
    if (tier === 'win') play('minigames/tier-win');
    else if (tier === 'close-win') play('minigames/tier-close-win');
    else if (tier === 'close-loss') play('minigames/tier-close-loss');
    else if (tier === 'loss') play('minigames/tier-loss');
    else if (tier === 'catastrophic') play('minigames/tier-catastrophic');
  };

  const handleDismissResult = () => {
    if (resultTier) {
      playMusic('music/bgm-game');
      dispatch({ type: 'MINIGAME_RESULT', tier: resultTier });
      setShowResult(false);
      setResultTier(null);
    }
  };

  const renderMinigame = () => {
    const noOp = () => {};
    const isSpectator = !isMyTurn;
    const props = {
      onResult: isSpectator ? noOp : handleResult,
      baseAmount: minigame.baseAmount,
      context: minigame.context,
      spectator: isSpectator,
    };
    switch (minigame.id) {
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
      <MinigameResult tier={resultTier} baseAmount={minigame.baseAmount} context={minigame.context} onDismiss={handleDismissResult} />
    );
  }

  if (showIntro) {
    return (
      <div className={`minigameOverlay pixelOverlay mg-${minigame.id}`}>
        <div className={`minigameCurtain ${curtainOpen ? 'open' : ''}`}>
          <div className="curtainLeft"></div>
          <div className="curtainRight"></div>
        </div>
        <div className={`minigameIntro ${curtainOpen ? 'visible' : ''}`}>
          <h2 className="minigameIntroTitle">{MINIGAME_NAMES[minigame.id] || minigame.id.replace('-', ' ').toUpperCase()}</h2>
          <p className="minigameStakes">STAKES: ${minigame.baseAmount}</p>
          <p className="minigameContext">{minigame.context === 'buying' ? 'PROPERTY PURCHASE' : 'RENT PAYMENT'}</p>
          <div className="minigameTierInfo">
            <div className="tierRow tier-win">WIN: {minigame.context === 'buying' ? 'FREE PROPERTY!' : 'NO RENT!'}</div>
            <div className="tierRow tier-close-win">CLOSE: {minigame.context === 'buying' ? `PAY $${Math.floor(minigame.baseAmount * 0.5)}` : `PAY $${Math.floor(minigame.baseAmount * 0.5)} RENT`}</div>
            <div className="tierRow tier-close-loss">ALMOST: PAY ${Math.floor(minigame.baseAmount * 1.5)}</div>
            <div className="tierRow tier-loss">LOSS: PAY ${Math.floor(minigame.baseAmount * 2)}</div>
            <div className="tierRow tier-catastrophic">DISASTER: PAY ${Math.floor(minigame.baseAmount * 5)}</div>
          </div>
        </div>
      </div>
    );
  }

  // Spectators see the minigame but can't interact
  const spectator = !isMyTurn;

  return (
    <>
      <div className={`minigameOverlay pixelOverlay mg-${minigame.id}`}>
        {spectator && (
          <div className="spectatorBanner">
            👁️ Watching {currentPlayerName}
          </div>
        )}
        <div className={spectator ? 'spectatorView' : ''}>
          {renderMinigame()}
        </div>
      </div>
    </>
  );
}
