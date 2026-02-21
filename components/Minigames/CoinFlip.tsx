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
  const [displaySide, setDisplaySide] = useState<CoinSide>('heads');
  const [results, setResults] = useState<FlipResult[]>([]);
  const [phase, setPhase] = useState<'choosing' | 'flipping' | 'done'>('choosing');
  const flipRef = useRef(false); // guard against double-flip
  const resultsRef = useRef<FlipResult[]>([]); // stable ref for results

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'flip') {
      executeFlip(data.guess, data.actual);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => onResult('catastrophic'), 30000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const executeFlip = useCallback((guess: CoinSide, actual: CoinSide) => {
    if (flipRef.current) return;
    flipRef.current = true;
    setPhase('flipping');

    play('minigames/coin-flip-air');

    // Animate coin spinning
    let count = 0;
    const interval = setInterval(() => {
      setDisplaySide(prev => prev === 'heads' ? 'tails' : 'heads');
      count++;
      if (count >= 10) {
        clearInterval(interval);
        setDisplaySide(actual);

        const result: FlipResult = { actual, guessed: guess, correct: guess === actual };
        const newResults = [...resultsRef.current, result];
        resultsRef.current = newResults;
        setResults(newResults);

        // Wait then either next round or end game
        setTimeout(() => {
          if (newResults.length >= 3) {
            setPhase('done');
            const correctCount = newResults.filter(r => r.correct).length;
            setTimeout(() => {
              if (correctCount === 3) onResult('win');
              else if (correctCount === 2) onResult('close-win');
              else if (correctCount === 1) onResult('close-loss');
              else onResult('loss');
            }, 800);
          } else {
            setPhase('choosing');
            flipRef.current = false;
          }
        }, 600);
      }
    }, 150);
  }, [play, onResult]);

  const makeGuess = (side: CoinSide) => {
    if (phase !== 'choosing' || spectator) return;
    const actual: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
    emitAction({ type: 'flip', guess: side, actual });
    executeFlip(side, actual);
  };

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
