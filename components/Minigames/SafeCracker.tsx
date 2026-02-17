'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface SafeCrackerProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

interface GuessResult {
  guess: number[];
  correctPosition: number; // Green - correct digit in correct position
  correctDigit: number;    // Yellow - correct digit in wrong position
}

export default function SafeCracker({ onResult, baseAmount, context }: SafeCrackerProps) {
  const [combination, setCombination] = useState<number[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([0, 0, 0]);
  const [attempts, setAttempts] = useState<GuessResult[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [gameEnded, setGameEnded] = useState(false);
  const [cracked, setCracked] = useState(false);
  const [selectedDial, setSelectedDial] = useState(0);

  useEffect(() => {
    // Generate random 3-digit combination
    const combo = [
      Math.floor(Math.random() * 10),
      Math.floor(Math.random() * 10),
      Math.floor(Math.random() * 10)
    ];
    setCombination(combo);

    // 15-second timeout
    const timer = setTimeout(() => {
      if (!gameEnded) {
        onResult('catastrophic');
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const adjustDial = (dialIndex: number, direction: 1 | -1) => {
    if (gameEnded) return;
    
    setCurrentGuess(prev => {
      const newGuess = [...prev];
      newGuess[dialIndex] = (newGuess[dialIndex] + direction + 10) % 10;
      return newGuess;
    });
  };

  const submitGuess = () => {
    if (gameEnded || attempts.length >= 3) return;

    // Calculate feedback (Mastermind style)
    let correctPosition = 0;
    let correctDigit = 0;
    const comboUsed = new Array(3).fill(false);
    const guessUsed = new Array(3).fill(false);

    // First pass: count correct positions
    for (let i = 0; i < 3; i++) {
      if (currentGuess[i] === combination[i]) {
        correctPosition++;
        comboUsed[i] = true;
        guessUsed[i] = true;
      }
    }

    // Second pass: count correct digits in wrong positions
    for (let i = 0; i < 3; i++) {
      if (!guessUsed[i]) {
        for (let j = 0; j < 3; j++) {
          if (!comboUsed[j] && currentGuess[i] === combination[j]) {
            correctDigit++;
            comboUsed[j] = true;
            break;
          }
        }
      }
    }

    const result: GuessResult = {
      guess: [...currentGuess],
      correctPosition,
      correctDigit
    };

    const newAttempts = [...attempts, result];
    setAttempts(newAttempts);

    // Check if cracked
    if (correctPosition === 3) {
      setCracked(true);
      setGameEnded(true);
      setTimeout(() => {
        onResult(currentAttempt === 1 ? 'win' : currentAttempt === 2 ? 'close-win' : 'close-loss');
      }, 1500);
      return;
    }

    // Check if out of attempts
    if (currentAttempt === 3) {
      setGameEnded(true);
      const totalCorrect = Math.max(...newAttempts.map(a => a.correctPosition + a.correctDigit));
      setTimeout(() => {
        if (totalCorrect >= 2) {
          onResult('loss');
        } else {
          onResult('catastrophic');
        }
      }, 1000);
      return;
    }

    // Next attempt
    setCurrentAttempt(currentAttempt + 1);
    setCurrentGuess([0, 0, 0]);
  };

  const selectDial = (dialIndex: number) => {
    if (gameEnded) return;
    setSelectedDial(dialIndex);
  };

  return (
    <div className="safeCracker">
      <div className="safeHeader">
        <h2 className="safeTitle">SAFE CRACKER</h2>
        <div className="safeProgress">
          Attempt {currentAttempt}/3
          {cracked && <span className="crackedBadge">CRACKED!</span>}
        </div>
      </div>

      <div className="safeContainer">
        <div className="safeBody">
          <div className="safeDisplay">
            <div className="combinationLock">
              {currentGuess.map((digit, index) => (
                <div 
                  key={index}
                  className={`dial ${selectedDial === index ? 'selected' : ''}`}
                  onClick={() => selectDial(index)}
                >
                  <button 
                    className="dialBtn up"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustDial(index, 1);
                    }}
                  >
                    ▲
                  </button>
                  <div className="dialValue">{digit}</div>
                  <button 
                    className="dialBtn down"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustDial(index, -1);
                    }}
                  >
                    ▼
                  </button>
                </div>
              ))}
            </div>
            
            <div className="safeHandle">
              <div className={`handleWheel ${cracked ? 'unlocked' : ''}`}>
                🔒
              </div>
            </div>
          </div>

          {!gameEnded && currentAttempt <= 3 && (
            <button className="submitBtn" onClick={submitGuess}>
              TRY COMBINATION
            </button>
          )}
        </div>
      </div>

      <div className="attemptsHistory">
        <div className="historyTitle">Previous Attempts:</div>
        {attempts.map((attempt, index) => (
          <div key={index} className="attemptRow">
            <div className="attemptNumber">#{index + 1}:</div>
            <div className="attemptGuess">
              [{attempt.guess.join('')}]
            </div>
            <div className="attemptFeedback">
              <span className="correctPos">🟢×{attempt.correctPosition}</span>
              <span className="correctDig">🟡×{attempt.correctDigit}</span>
            </div>
          </div>
        ))}
        
        {attempts.length === 0 && (
          <div className="noAttempts">No attempts yet</div>
        )}
      </div>

      <div className="safeInstructions">
        {cracked ? (
          'Safe cracked! You win!'
        ) : gameEnded ? (
          `Failed to crack the safe. Combination was: [${combination.join('')}]`
        ) : (
          `Set combination and click TRY. 🟢 = right digit, right place. 🟡 = right digit, wrong place.`
        )}
      </div>

      <div className="safePaytable">
        <div className="paytableRow">Crack in 1 attempt = WIN</div>
        <div className="paytableRow">Crack in 2 attempts = CLOSE WIN</div>
        <div className="paytableRow">Crack in 3 attempts = CLOSE LOSS</div>
        <div className="paytableRow">Fail with 2+ correct = LOSS</div>
        <div className="paytableRow">Fail with 0 correct = CATASTROPHIC</div>
      </div>
    </div>
  );
}