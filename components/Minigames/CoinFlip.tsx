'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface CoinFlipProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

type CoinSide = 'heads' | 'tails';

interface FlipResult {
  actual: CoinSide;
  guessed: CoinSide;
  correct: boolean;
}

export default function CoinFlip({ onResult, baseAmount, context, spectator = false }: CoinFlipProps) {
  const { play } = useAudio();
  const [currentFlip, setCurrentFlip] = useState(1);
  const [flipping, setFlipping] = useState(false);
  const [currentSide, setCurrentSide] = useState<CoinSide>('heads');
  const [guess, setGuess] = useState<CoinSide | null>(null);
  const [flipResults, setFlipResults] = useState<FlipResult[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [flipStartTime, setFlipStartTime] = useState<number | null>(null);
  const [pendingFlipResult, setPendingFlipResult] = useState<CoinSide | null>(null);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'guess') {
      setGuess(data.side);
      setFlipStartTime(Date.now());
    } else if (data.type === 'flip-result') {
      setPendingFlipResult(data.actual);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const makeGuess = (side: CoinSide) => {
    if (flipping || guess || gameEnded || spectator) return;
    setGuess(side);
    setFlipStartTime(Date.now());
    emitAction({ type: 'guess', side });
  };

  const doFlip = useCallback((actualResult: CoinSide) => {
    play('minigames/coin-flip-air');
    setFlipping(true);

    let flipCount = 0;
    const flipInterval = setInterval(() => {
      setCurrentSide(prev => prev === 'heads' ? 'tails' : 'heads');
      flipCount++;
      if (flipCount >= 10) {
        clearInterval(flipInterval);
        setCurrentSide(actualResult);
        setGuess(g => {
          const isCorrect = g === actualResult;
          const flipResult: FlipResult = { actual: actualResult, guessed: g!, correct: isCorrect };
          setFlipResults(prev => {
            const newResults = [...prev, flipResult];
            setTimeout(() => {
              setFlipping(false);
              setCurrentFlip(cf => {
                if (cf === 3) {
                  setGameEnded(true);
                  const correctCount = newResults.filter(r => r.correct).length;
                  setTimeout(() => {
                    if (correctCount === 3) onResult('win');
                    else if (correctCount === 2) onResult('close-win');
                    else if (correctCount === 1) onResult('close-loss');
                    else onResult('loss');
                  }, 1000);
                } else {
                  setGuess(null);
                }
                return cf + 1;
              });
            }, 500);
            return newResults;
          });
          return g;
        });
      }
    }, 150);
  }, [play, onResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-flip after guess
  useEffect(() => {
    if (guess && !flipping) {
      const timer = setTimeout(() => {
        if (spectator && pendingFlipResult) {
          doFlip(pendingFlipResult);
          setPendingFlipResult(null);
        } else if (!spectator) {
          const actual: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
          emitAction({ type: 'flip-result', actual });
          doFlip(actual);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [guess, flipping, spectator, pendingFlipResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const coinImg = currentSide === 'heads'
    ? '/assets/minigames/coin/coin-heads.png'
    : '/assets/minigames/coin/coin-tails.png';

  return (
    <div className="coinFlip pixelMinigame">
      <div className="coinHeader">
        <h2 className="coinTitle">COIN FLIP</h2>
        <div className="coinProgress">FLIP {Math.min(currentFlip, 3)}/3 | CORRECT: {flipResults.filter(r => r.correct).length}</div>
      </div>

      <div className="coinContainer">
        <div className={`coin ${flipping ? 'coinFlipping' : ''}`}>
          <img src={coinImg} alt={currentSide} className="coinImg" />
        </div>
      </div>

      {!gameEnded && !flipping && !guess && (
        <div className="coinControls">
          <button className="coinBtn headsBtn pixelBtn" onClick={() => makeGuess('heads')} disabled={spectator}>HEADS</button>
          <button className="coinBtn tailsBtn pixelBtn" onClick={() => makeGuess('tails')} disabled={spectator}>TAILS</button>
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
        {gameEnded ? 'GAME COMPLETE!' : flipping ? 'FLIPPING...' : guess ? 'GET READY...' : `CALL FLIP ${Math.min(currentFlip, 3)}:`}
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
