'use client';

import { useState, useEffect } from 'react';
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

  const minigame = state.activeMinigame;

  useEffect(() => {
    if (minigame?.status === 'intro') {
      playMusic('music/bgm-minigame');
      setTimeout(() => setCurtainOpen(true), 100);
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [minigame?.status]);

  if (!minigame) return null;

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
    const props = { onResult: handleResult, baseAmount: minigame.baseAmount, context: minigame.context };
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
      <div className="minigameOverlay pixelOverlay">
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
            <div className="tierRow tier-close-win">CLOSE: {minigame.context === 'buying' ? '50% PRICE' : '50% RENT'}</div>
            <div className="tierRow tier-close-loss">ALMOST: 150% PENALTY</div>
            <div className="tierRow tier-loss">LOSS: 200% PENALTY</div>
            <div className="tierRow tier-catastrophic">DISASTER: 500% PENALTY</div>
          </div>
        </div>
      </div>
    );
  }

  // Spectator mode: show who's playing but don't render interactive minigame
  if (!isMyTurn) {
    const activePlayer = state.players[state.currentPlayerIndex];
    return (
      <div className="minigameOverlay pixelOverlay">
        <div className="minigameIntro" style={{ textAlign: 'center' }}>
          <h2 className="minigameIntroTitle">{MINIGAME_NAMES[minigame.id] || minigame.id}</h2>
          <p style={{ fontSize: '1.2rem', marginTop: 16, opacity: 0.8 }}>
            🎰 <strong>{activePlayer?.name || 'Player'}</strong> is playing...
          </p>
          <p style={{ fontSize: '0.85rem', marginTop: 8, opacity: 0.5 }}>
            Waiting for their result
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="minigameOverlay pixelOverlay">
      {renderMinigame()}
    </div>
  );
}
