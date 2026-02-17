'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
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
  const [showIntro, setShowIntro] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [resultTier, setResultTier] = useState<MinigameTier | null>(null);
  const [curtainOpen, setCurtainOpen] = useState(false);

  const minigame = state.activeMinigame;

  useEffect(() => {
    if (minigame?.status === 'intro') {
      // Start curtain opening
      setTimeout(() => setCurtainOpen(true), 100);
      const timer = setTimeout(() => {
        setShowIntro(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [minigame?.status]);

  if (!minigame) return null;

  const handleResult = (tier: MinigameTier) => {
    setResultTier(tier);
    setShowResult(true);
  };

  const handleDismissResult = () => {
    if (resultTier) {
      dispatch({ type: 'MINIGAME_RESULT', tier: resultTier });
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

  return (
    <div className="minigameOverlay pixelOverlay">
      {renderMinigame()}
    </div>
  );
}
