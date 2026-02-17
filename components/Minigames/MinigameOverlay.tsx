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
import HorseRace from './HorseRace';
import DartThrow from './DartThrow';
import Blackjack from './Blackjack';
import CoinFlip from './CoinFlip';
import SafeCracker from './SafeCracker';

interface MinigameOverlayProps {
  // Props are passed from state via useGame
}

export default function MinigameOverlay({}: MinigameOverlayProps) {
  const { state, dispatch } = useGame();
  const [showIntro, setShowIntro] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [resultTier, setResultTier] = useState<MinigameTier | null>(null);

  const minigame = state.activeMinigame;

  useEffect(() => {
    if (minigame?.status === 'intro') {
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
    const props = { 
      onResult: handleResult, 
      baseAmount: minigame.baseAmount, 
      context: minigame.context 
    };

    switch (minigame.id) {
      case 'slots':
        return <SlotMachine {...props} />;
      case 'higher-lower':
        return <HigherLower {...props} />;
      case 'craps':
        return <Craps {...props} />;
      case 'wheel':
        return <WheelOfFortune {...props} />;
      case 'minesweeper':
        return <MinesweeperLite {...props} />;
      case 'horse-race':
        return <HorseRace {...props} />;
      case 'darts':
        return <DartThrow {...props} />;
      case 'blackjack':
        return <Blackjack {...props} />;
      case 'coin-flip':
        return <CoinFlip {...props} />;
      case 'safe-cracker':
        return <SafeCracker {...props} />;
      default:
        return (
          <div className="minigameIntro">
            <h2>Minigame Not Found</h2>
            <button className="rollButton" onClick={() => handleResult('loss')}>
              Continue
            </button>
          </div>
        );
    }
  };

  if (showResult && resultTier) {
    return (
      <MinigameResult
        tier={resultTier}
        baseAmount={minigame.baseAmount}
        context={minigame.context}
        onDismiss={handleDismissResult}
      />
    );
  }

  if (showIntro) {
    return (
      <div className="minigameOverlay">
        <div className="minigameIntro">
          <h2>{minigame.id.replace('-', ' ').toUpperCase()}</h2>
          <p className="minigameStakes">Stakes: ${minigame.baseAmount}</p>
          <p className="minigameContext">
            {minigame.context === 'buying' ? 'Property Purchase' : 'Rent Payment'}
          </p>
          <div className="minigameTierInfo">
            <div className="tierRow tier-win">Win: {minigame.context === 'buying' ? 'FREE property!' : 'No rent!'}</div>
            <div className="tierRow tier-close-win">Close: {minigame.context === 'buying' ? '50% price' : '50% rent'}</div>
            <div className="tierRow tier-close-loss">Almost: 150% penalty</div>
            <div className="tierRow tier-loss">Loss: 200% penalty</div>
            <div className="tierRow tier-catastrophic">Disaster: 500% penalty</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="minigameOverlay">
      {renderMinigame()}
    </div>
  );
}