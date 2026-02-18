'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface CoinFlipProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

type CoinSide = 'heads' | 'tails';

interface FlipResult {
  actual: CoinSide;
  guessed: CoinSide;
  correct: boolean;
}

export default function CoinFlip({ onResult, baseAmount, context }: CoinFlipProps) {
  const { play } = useAudio();
  const [currentFlip, setCurrentFlip] = useState(1);
  const [flipping, setFlipping] = useState(false);
  const [currentSide, setCurrentSide] = useState<CoinSide>('heads');
  const [guess, setGuess] = useState<CoinSide | null>(null);
  const [flipResults, setFlipResults] = useState<FlipResult[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [flipStartTime, setFlipStartTime] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, []);

  const makeGuess = (side: CoinSide) => {
    if (flipping || guess || gameEnded) return;
    setGuess(side);
    setFlipStartTime(Date.now());
  };

  const flipCoin = () => {
    if (!guess || flipping || gameEnded) return;
    play('minigames/coin-flip-air');
    setFlipping(true);

    let flipCount = 0;
    const flipInterval = setInterval(() => {
      setCurrentSide(prev => prev === 'heads' ? 'tails' : 'heads');
      flipCount++;
      if (flipCount >= 10) {
        clearInterval(flipInterval);
        const actualResult: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
        setCurrentSide(actualResult);
        const isCorrect = guess === actualResult;
        const flipResult: FlipResult = { actual: actualResult, guessed: guess, correct: isCorrect };
        const newResults = [...flipResults, flipResult];
        setFlipResults(newResults);

        setTimeout(() => {
          setFlipping(false);
          if (currentFlip === 3) {
            calculateFinalResult(newResults);
          } else {
            setCurrentFlip(currentFlip + 1);
            setGuess(null);
          }
        }, 500);
      }
    }, 150);
  };

  const calculateFinalResult = (results: FlipResult[]) => {
    setGameEnded(true);
    const correctCount = results.filter(r => r.correct).length;
    const flipTime = flipStartTime ? Date.now() - flipStartTime : 5000;
    setTimeout(() => {
      if (correctCount === 3) onResult('win');
      else if (correctCount === 2) onResult('close-win');
      else if (correctCount === 1) onResult('close-loss');
      else if (correctCount === 0 && flipTime < 3000) onResult('catastrophic');
      else onResult('loss');
    }, 1000);
  };

  useEffect(() => {
    if (guess && !flipping) {
      const autoFlipTimer = setTimeout(() => flipCoin(), 500);
      return () => clearTimeout(autoFlipTimer);
    }
  }, [guess, flipping]);

  const coinImg = currentSide === 'heads'
    ? '/assets/minigames/coin/coin-heads.png'
    : '/assets/minigames/coin/coin-tails.png';

  return (
    <div className="coinFlip pixelMinigame">
      <div className="coinHeader">
        <h2 className="coinTitle">COIN FLIP</h2>
        <div className="coinProgress">FLIP {currentFlip}/3 | CORRECT: {flipResults.filter(r => r.correct).length}</div>
      </div>

      <div className="coinContainer">
        <div className={`coin ${flipping ? 'coinFlipping' : ''}`}>
          <img src={coinImg} alt={currentSide} className="coinImg" />
        </div>
      </div>

      {!gameEnded && !flipping && !guess && (
        <div className="coinControls">
          <button className="coinBtn headsBtn pixelBtn" onClick={() => makeGuess('heads')}>HEADS</button>
          <button className="coinBtn tailsBtn pixelBtn" onClick={() => makeGuess('tails')}>TAILS</button>
        </div>
      )}

      {guess && !flipping && (
        <div className="coinWaiting">
          <div className="selectedGuess">YOU CHOSE: {guess.toUpperCase()}</div>
          <div className="flipPrompt">FLIPPING...</div>
        </div>
      )}

      <div className="coinResults">
        {flipResults.map((result, index) => (
          <div key={index} className={`coinResultRow ${result.correct ? 'correct' : 'incorrect'}`}>
            <span>FLIP {index + 1}:</span>
            <span>{result.guessed.toUpperCase()}</span>
            <span>→ {result.actual.toUpperCase()}</span>
            <span>{result.correct ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>

      <div className="coinInstructions">
        {gameEnded ? 'GAME COMPLETE!' : flipping ? 'FLIPPING...' : guess ? 'GET READY...' : `CALL FLIP ${currentFlip}:`}
      </div>

      <div className="coinPaytable">
        <div className="paytableRow">3 CORRECT = WIN</div>
        <div className="paytableRow">2 CORRECT = CLOSE WIN</div>
        <div className="paytableRow">1 CORRECT = CLOSE LOSS</div>
        <div className="paytableRow">0 CORRECT = LOSS</div>
      </div>
    </div>
  );
}
