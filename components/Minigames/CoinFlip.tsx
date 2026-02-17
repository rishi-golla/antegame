'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

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
  const [currentFlip, setCurrentFlip] = useState(1);
  const [flipping, setFlipping] = useState(false);
  const [currentSide, setCurrentSide] = useState<CoinSide>('heads');
  const [guess, setGuess] = useState<CoinSide | null>(null);
  const [flipResults, setFlipResults] = useState<FlipResult[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [flipStartTime, setFlipStartTime] = useState<number | null>(null);

  useEffect(() => {
    // 15-second timeout
    const timer = setTimeout(() => {
      if (!gameEnded) {
        onResult('catastrophic');
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const makeGuess = (side: CoinSide) => {
    if (flipping || guess || gameEnded) return;
    setGuess(side);
    setFlipStartTime(Date.now());
  };

  const flipCoin = () => {
    if (!guess || flipping || gameEnded) return;

    setFlipping(true);

    // Animate coin flip
    let flipCount = 0;
    const flipInterval = setInterval(() => {
      setCurrentSide(prev => prev === 'heads' ? 'tails' : 'heads');
      flipCount++;
      
      if (flipCount >= 10) {
        clearInterval(flipInterval);
        
        // Determine final result
        const actualResult: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
        setCurrentSide(actualResult);
        
        const isCorrect = guess === actualResult;
        const flipResult: FlipResult = {
          actual: actualResult,
          guessed: guess,
          correct: isCorrect
        };

        const newResults = [...flipResults, flipResult];
        setFlipResults(newResults);

        setTimeout(() => {
          setFlipping(false);
          
          if (currentFlip === 3) {
            // Game over, calculate final result
            calculateFinalResult(newResults);
          } else {
            // Next flip
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
      if (correctCount === 3) {
        onResult('win');
      } else if (correctCount === 2) {
        onResult('close-win');
      } else if (correctCount === 1) {
        onResult('close-loss');
      } else if (correctCount === 0 && flipTime < 3000) {
        // All wrong in under 3 seconds
        onResult('catastrophic');
      } else {
        onResult('loss');
      }
    }, 1000);
  };

  useEffect(() => {
    // Auto-flip after making a guess
    if (guess && !flipping) {
      const autoFlipTimer = setTimeout(() => {
        flipCoin();
      }, 500);
      
      return () => clearTimeout(autoFlipTimer);
    }
  }, [guess, flipping]);

  return (
    <div className="coinFlip">
      <div className="coinHeader">
        <h2 className="coinTitle">COIN FLIP</h2>
        <div className="coinProgress">
          Flip {currentFlip}/3 | Correct: {flipResults.filter(r => r.correct).length}/3
        </div>
      </div>

      <div className="coinContainer">
        <div className={`coin ${flipping ? 'flipping' : ''}`}>
          <div className="coinSide heads">
            <div className="coinFace">
              <div className="coinSymbol">👑</div>
              <div className="coinText">HEADS</div>
            </div>
          </div>
          <div className="coinSide tails">
            <div className="coinFace">
              <div className="coinSymbol">🦅</div>
              <div className="coinText">TAILS</div>
            </div>
          </div>
          <div className="coinDisplay">
            {currentSide === 'heads' ? (
              <div className="coinFace">
                <div className="coinSymbol">👑</div>
                <div className="coinText">HEADS</div>
              </div>
            ) : (
              <div className="coinFace">
                <div className="coinSymbol">🦅</div>
                <div className="coinText">TAILS</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!gameEnded && !flipping && !guess && (
        <div className="coinControls">
          <button 
            className="coinBtn headsBtn"
            onClick={() => makeGuess('heads')}
          >
            HEADS 👑
          </button>
          <button 
            className="coinBtn tailsBtn"
            onClick={() => makeGuess('tails')}
          >
            TAILS 🦅
          </button>
        </div>
      )}

      {guess && !flipping && (
        <div className="coinWaiting">
          <div className="selectedGuess">
            You chose: {guess.toUpperCase()} 
            {guess === 'heads' ? ' 👑' : ' 🦅'}
          </div>
          <div className="flipPrompt">Coin will flip automatically...</div>
        </div>
      )}

      <div className="coinResults">
        {flipResults.map((result, index) => (
          <div key={index} className={`resultRow ${result.correct ? 'correct' : 'incorrect'}`}>
            <span className="resultFlip">Flip {index + 1}:</span>
            <span className="resultGuess">
              Guessed {result.guessed} {result.guessed === 'heads' ? '👑' : '🦅'}
            </span>
            <span className="resultActual">
              Got {result.actual} {result.actual === 'heads' ? '👑' : '🦅'}
            </span>
            <span className="resultStatus">
              {result.correct ? '✓' : '✗'}
            </span>
          </div>
        ))}
      </div>

      <div className="coinInstructions">
        {gameEnded ? (
          'Game complete!'
        ) : flipping ? (
          'Coin is flipping...'
        ) : guess ? (
          'Get ready...'
        ) : (
          `Call flip ${currentFlip}:`
        )}
      </div>

      <div className="coinPaytable">
        <div className="paytableRow">3 correct = WIN</div>
        <div className="paytableRow">2 correct = CLOSE WIN</div>
        <div className="paytableRow">1 correct = CLOSE LOSS</div>
        <div className="paytableRow">0 correct = LOSS</div>
        <div className="paytableRow">All wrong under 3s = CATASTROPHIC</div>
      </div>
    </div>
  );
}