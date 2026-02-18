'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface SafeCrackerProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

interface GuessResult {
  guess: number[];
  correctPosition: number;
  correctDigit: number;
}

export default function SafeCracker({ onResult, baseAmount, context }: SafeCrackerProps) {
  const { play } = useAudio();
  const [combination, setCombination] = useState<number[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([0, 0, 0]);
  const [attempts, setAttempts] = useState<GuessResult[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [gameEnded, setGameEnded] = useState(false);
  const [cracked, setCracked] = useState(false);
  const [selectedDial, setSelectedDial] = useState(0);
  const [dialRotation, setDialRotation] = useState([0, 0, 0]);

  useEffect(() => {
    setCombination([Math.floor(Math.random() * 5), Math.floor(Math.random() * 5), Math.floor(Math.random() * 5)]);
    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 45000);
    return () => clearTimeout(timer);
  }, []);

  const adjustDial = (dialIndex: number, direction: 1 | -1) => {
    if (gameEnded) return;
    play('minigames/safe-dial');
    setCurrentGuess(prev => {
      const n = [...prev];
      n[dialIndex] = (n[dialIndex] + direction + 5) % 5;
      return n;
    });
    setDialRotation(prev => {
      const n = [...prev];
      n[dialIndex] += direction * 36;
      return n;
    });
  };

  const submitGuess = () => {
    if (gameEnded || attempts.length >= 4) return;
    let correctPosition = 0;
    let correctDigit = 0;
    const comboUsed = [false, false, false];
    const guessUsed = [false, false, false];

    for (let i = 0; i < 3; i++) {
      if (currentGuess[i] === combination[i]) { correctPosition++; comboUsed[i] = true; guessUsed[i] = true; }
    }
    for (let i = 0; i < 3; i++) {
      if (!guessUsed[i]) {
        for (let j = 0; j < 3; j++) {
          if (!comboUsed[j] && currentGuess[i] === combination[j]) { correctDigit++; comboUsed[j] = true; break; }
        }
      }
    }

    const result: GuessResult = { guess: [...currentGuess], correctPosition, correctDigit };
    const newAttempts = [...attempts, result];
    setAttempts(newAttempts);

    if (correctPosition === 3) {
      play('minigames/safe-crack');
      setCracked(true); setGameEnded(true);
      setTimeout(() => onResult(currentAttempt <= 2 ? 'win' : currentAttempt === 3 ? 'close-win' : 'close-loss'), 1500);
      return;
    }
    if (currentAttempt === 4) {
      setGameEnded(true);
      const totalCorrect = Math.max(...newAttempts.map(a => a.correctPosition + a.correctDigit));
      setTimeout(() => onResult(totalCorrect >= 2 ? 'loss' : 'catastrophic'), 1000);
      return;
    }
    setCurrentAttempt(currentAttempt + 1);
    setCurrentGuess([0, 0, 0]);
  };

  return (
    <div className="safeCracker pixelMinigame">
      <div className="safeHeader">
        <h2 className="safeTitle">SAFE CRACKER</h2>
        <div className="safeProgress">
          ATTEMPT {currentAttempt}/4
          {cracked && <span className="crackedBadge">CRACKED!</span>}
        </div>
      </div>

      <div className="safeContainer">
        <div className="safeImgWrap">
          <img src={cracked ? '/assets/minigames/safe/safe-open.png' : '/assets/minigames/safe/safe-closed.png'} alt="safe" className="safeImg" />
        </div>

        <div className="safeBody">
          <div className="combinationLock">
            {currentGuess.map((digit, index) => (
              <div key={index} className={`dial ${selectedDial === index ? 'selected' : ''}`} onClick={() => setSelectedDial(index)}>
                <button className="dialBtn up pixelBtn" onClick={(e) => { e.stopPropagation(); adjustDial(index, 1); }}>▲</button>
                <div className="dialValue">
                  <img src="/assets/minigames/safe/dial.png" alt="" className="dialImg" style={{ transform: `rotate(${dialRotation[index]}deg)` }} />
                  <span className="dialDigit">{digit}</span>
                </div>
                <button className="dialBtn down pixelBtn" onClick={(e) => { e.stopPropagation(); adjustDial(index, -1); }}>▼</button>
              </div>
            ))}
          </div>

          {!gameEnded && currentAttempt <= 4 && (
            <button className="submitBtn pixelBtn" onClick={submitGuess}>TRY COMBINATION</button>
          )}
        </div>
      </div>

      <div className="attemptsHistory">
        <div className="historyTitle">PREVIOUS ATTEMPTS:</div>
        {attempts.map((attempt, index) => (
          <div key={index} className="attemptRow">
            <div className="attemptNumber">#{index + 1}:</div>
            <div className="attemptGuess">[{attempt.guess.join('')}]</div>
            <div className="attemptFeedback">
              <span className="correctPos">🟢×{attempt.correctPosition}</span>
              <span className="correctDig">🟡×{attempt.correctDigit}</span>
            </div>
          </div>
        ))}
        {attempts.length === 0 && <div className="noAttempts">NO ATTEMPTS YET</div>}
      </div>

      <div className="safeInstructions">
        {cracked ? 'SAFE CRACKED!' : gameEnded ? `FAILED! CODE: [${combination.join('')}]` : 'DIGITS 0-4. SET COMBO AND TRY. 🟢=RIGHT PLACE 🟡=WRONG PLACE'}
      </div>
    </div>
  );
}
