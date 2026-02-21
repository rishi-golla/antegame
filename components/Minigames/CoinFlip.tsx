'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

  // All game state in refs
  const resultsRef = useRef<FlipResult[]>([]);
  const phaseRef = useRef<'choosing' | 'flipping' | 'done'>('choosing');
  const displaySideRef = useRef<CoinSide>('heads');
  const flipBusyRef = useRef(false);
  const endedRef = useRef(false);

  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const executeFlipRef = useRef<(guess: CoinSide, actual: CoinSide) => void>(() => {});

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'flip') {
      executeFlipRef.current(data.guess, data.actual);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  // Safety timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        onResult('catastrophic');
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const executeFlip = useCallback((guess: CoinSide, actual: CoinSide) => {
    if (flipBusyRef.current || endedRef.current) return;
    flipBusyRef.current = true;
    phaseRef.current = 'flipping';
    rerender();

    play('minigames/coin-flip-air');

    // Animate coin spinning
    let count = 0;
    const interval = setInterval(() => {
      displaySideRef.current = displaySideRef.current === 'heads' ? 'tails' : 'heads';
      rerender();
      count++;
      if (count >= 10) {
        clearInterval(interval);
        displaySideRef.current = actual;
        rerender();

        const result: FlipResult = { actual, guessed: guess, correct: guess === actual };
        resultsRef.current = [...resultsRef.current, result];
        rerender();

        setTimeout(() => {
          const allResults = resultsRef.current;
          if (allResults.length >= 3) {
            phaseRef.current = 'done';
            rerender();
            const correctCount = allResults.filter(r => r.correct).length;
            setTimeout(() => {
              if (endedRef.current) return;
              endedRef.current = true;
              if (correctCount === 3) onResult('win');
              else if (correctCount === 2) onResult('close-win');
              else if (correctCount === 1) onResult('close-loss');
              else onResult('loss');
            }, 800);
          } else {
            phaseRef.current = 'choosing';
            flipBusyRef.current = false;
            rerender();
          }
        }, 600);
      }
    }, 150);
  }, [play, onResult]);

  useEffect(() => { executeFlipRef.current = executeFlip; }, [executeFlip]);

  const makeGuess = (side: CoinSide) => {
    if (phaseRef.current !== 'choosing' || spectator || flipBusyRef.current) return;
    const actual: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
    emitAction({ type: 'flip', guess: side, actual });
    executeFlip(side, actual);
  };

  const phase = phaseRef.current;
  const displaySide = displaySideRef.current;
  const results = resultsRef.current;
  const coinImg = displaySide === 'heads'
    ? '/assets/minigames/coin/coin-heads.png'
    : '/assets/minigames/coin/coin-tails.png';

  const roundNum = Math.min(results.length + 1, 3);
  const correctCount = results.filter(r => r.correct).length;

  return (
    <div className="coinFlip pixelMinigame">
      <div className="coinHeader">
        <h2 className="coinTitle">COIN FLIP</h2>
        <div className="coinProgress">FLIP {roundNum}/3 | CORRECT: {correctCount}</div>
      </div>

      <div className="coinContainer">
        <div className={`coin ${phase === 'flipping' ? 'coinFlipping' : ''}`}>
          <img src={coinImg} alt={displaySide} className="coinImg" />
        </div>
      </div>

      {phase === 'choosing' && (
        <div className="coinControls">
          <button className="coinBtn headsBtn pixelBtn" onClick={() => makeGuess('heads')}>HEADS</button>
          <button className="coinBtn tailsBtn pixelBtn" onClick={() => makeGuess('tails')}>TAILS</button>
        </div>
      )}

      {phase === 'flipping' && (
        <div className="coinWaiting">
          <div className="flipPrompt">FLIPPING...</div>
        </div>
      )}

      <div className="coinResults">
        {results.map((result, index) => (
          <div key={index} className={`coinResultRow ${result.correct ? 'correct' : 'incorrect'}`}>
            <span>FLIP {index + 1}:</span>
            <span>{result.guessed.toUpperCase()}</span>
            <span>→ {result.actual.toUpperCase()}</span>
            <span>{result.correct ? '✓' : '✗'}</span>
          </div>
        ))}
      </div>

      <div className="coinInstructions">
        {phase === 'done' ? 'GAME COMPLETE!' : phase === 'flipping' ? 'FLIPPING...' : `CALL FLIP ${roundNum}:`}
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
