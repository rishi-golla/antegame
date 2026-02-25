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

// All in-game minigame assets (sprites, UI elements)
const MINIGAME_ASSET_PATHS = [
  // Cards
  '/assets/minigames/cards/card-back.png',
  '/assets/minigames/cards/card-table.png',
  '/assets/minigames/cards/deck.png',
  // Coin flip
  '/assets/minigames/coin/coin-heads.png',
  '/assets/minigames/coin/coin-tails.png',
  // Darts
  '/assets/minigames/darts/dart.png',
  '/assets/minigames/darts/dartboard.png',
  // Dice
  '/assets/minigames/dice/dice-1.png',
  '/assets/minigames/dice/dice-2.png',
  '/assets/minigames/dice/dice-3.png',
  '/assets/minigames/dice/dice-4.png',
  '/assets/minigames/dice/dice-5.png',
  '/assets/minigames/dice/dice-6.png',
  '/assets/minigames/dice/dice-cup.png',
  // Horses (card war)
  '/assets/minigames/horses/horse-1.png',
  '/assets/minigames/horses/horse-2.png',
  '/assets/minigames/horses/horse-3.png',
  '/assets/minigames/horses/track.png',
  // Minesweeper
  '/assets/minigames/minesweeper/gem.png',
  '/assets/minigames/minesweeper/mine.png',
  '/assets/minigames/minesweeper/tile-hidden.png',
  '/assets/minigames/minesweeper/tile-revealed.png',
  // Results
  '/assets/minigames/results/jackpot.png',
  '/assets/minigames/results/lose-banner.png',
  '/assets/minigames/results/win-banner.png',
  // Safe cracker
  '/assets/minigames/safe/dial.png',
  '/assets/minigames/safe/safe-closed.png',
  '/assets/minigames/safe/safe-open.png',
  // Slots
  '/assets/minigames/slots/bar.png',
  '/assets/minigames/slots/cherry.png',
  '/assets/minigames/slots/diamond.png',
  '/assets/minigames/slots/seven.png',
  '/assets/minigames/slots/skull.png',
  '/assets/minigames/slots/slot-machine.png',
  // Wheel
  '/assets/minigames/wheel/wheel-pointer.png',
  '/assets/minigames/wheel/wheel-stand.png',
  '/assets/minigames/wheel/wheel.png',
];

// Global cache so images are only preloaded once across mounts
let _preloadStarted = false;
const _loadedImages = new Set<string>();

export function preloadAllMinigameBackgrounds() {
  if (_preloadStarted) return;
  _preloadStarted = true;
  // Preload backgrounds first (higher priority)
  Object.entries(MINIGAME_BG_PATHS).forEach(([id, src]) => {
    const img = new Image();
    img.onload = () => _loadedImages.add(id);
    img.src = src;
  });
  // Then preload all in-game assets
  MINIGAME_ASSET_PATHS.forEach((src) => {
    const img = new Image();
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

  const minigame = state.activeMinigame;
  const currentPlayerName = state.players[state.currentPlayerIndex]?.name || 'Player';
  const currentPlayerMinigameBoost = getBuffModifier(state.players[state.currentPlayerIndex], 'minigame-boost');

  // Persist minigame data so the result overlay can display after activeMinigame is cleared
  const savedMinigameRef = useRef(minigame);
  if (minigame) {
    savedMinigameRef.current = minigame;
  }

  // Preload all backgrounds on first mount
  useEffect(() => {
    preloadAllMinigameBackgrounds();
  }, []);

  // Reset state when a new minigame starts
  useEffect(() => {
    if (minigame?.status === 'intro') {
      playMusic('music/bgm-minigame');
      setResultLocked(false);
      setResultTier(null);
      setShowResult(false);
      setShowIntro(true);
      setCurtainOpen(false);
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

  // Background loads in the background via CSS; never block the UI with a loading screen

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
    const tier = resultTier;
    // Always clean up overlay state to prevent softlock, even if tier is null
    setResultTier(null);
    setResultLocked(false);
    setShowResult(false);
    savedMinigameRef.current = null;
    clearMinigameServerResult();
    playMusic('music/bgm-game');
    // In multiplayer, the server already resolved the game state when we
    // dispatched MINIGAME_RESULT earlier. In free play, dispatch now.
    if (tier && !isMultiplayer) {
      dispatch({ type: 'MINIGAME_RESULT', tier });
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
        {!spectator && !resultLocked && (
          <div className="minigameTimerWrapper">
            <CountdownTimer
              duration={30}
              onExpire={() => {
                if (!resultLocked) handleResult('catastrophic');
              }}
              resetKey={`minigame-${displayMinigame.id}-${state.currentPlayerIndex}`}
            />
          </div>
        )}
        <div className={spectator ? 'spectatorView' : ''}>
          {renderMinigame()}
        </div>
      </div>
    </>
  );
}
