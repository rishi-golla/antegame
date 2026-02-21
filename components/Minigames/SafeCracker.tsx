'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface SafeCrackerProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

interface GuessResult {
  guess: number[];
  correctPosition: number;
  correctDigit: number;
}

export default function SafeCracker({ onResult, baseAmount, context, spectator = false }: SafeCrackerProps) {
  const { play } = useAudio();
  const [combination, setCombination] = useState<number[]>([]);
  const [currentGuess, setCurrentGuess] = useState<number[]>([1, 1, 1]);
  const [attempts, setAttempts] = useState<GuessResult[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [gameEnded, setGameEnded] = useState(false);
  const [cracked, setCracked] = useState(false);
  const [selectedDial, setSelectedDial] = useState(0);
  const [dialRotation, setDialRotation] = useState([0, 0, 0]);
  const [textInput, setTextInput] = useState('');

  // Refs to avoid nested setState
  const comboRef = useRef<number[]>([]);
  const attemptsRef = useRef<GuessResult[]>([]);
  const attemptNumRef = useRef(1);
  const endedRef = useRef(false);
  const guessRef = useRef<number[]>([1, 1, 1]);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      setCombination(data.combo);
      comboRef.current = data.combo;
    } else if (data.type === 'dial') {
      adjustDialInternal(data.index, data.direction);
    } else if (data.type === 'submit') {
      submitGuessInternal();
    } else if (data.type === 'select-dial') {
      setSelectedDial(data.index);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const combo = [1 + Math.floor(Math.random() * 4), 1 + Math.floor(Math.random() * 4), 1 + Math.floor(Math.random() * 4)];
    setCombination(combo);
    comboRef.current = combo;
    if (!spectator) {
      emitAction({ type: 'init', combo });
    }
    const timer = setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        setGameEnded(true);
        onResult('catastrophic');
      }
    }, 90000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustDialInternal = (dialIndex: number, direction: 1 | -1) => {
    play('minigames/safe-dial');
    setCurrentGuess(prev => {
      const n = [...prev];
      n[dialIndex] = ((n[dialIndex] - 1 + direction + 4) % 4) + 1;
      guessRef.current = n;
      return n;
    });
    setDialRotation(prev => {
      const n = [...prev];
      n[dialIndex] += direction * 36;
      return n;
    });
  };

  const adjustDial = (dialIndex: number, direction: 1 | -1) => {
    if (endedRef.current || spectator) return;
    adjustDialInternal(dialIndex, direction);
    emitAction({ type: 'dial', index: dialIndex, direction });
  };

  const selectDial = (index: number) => {
    if (spectator) return;
    setSelectedDial(index);
    emitAction({ type: 'select-dial', index });
  };

  const submitGuessInternal = () => {
    if (endedRef.current) return;

    const cg = guessRef.current;
    const combo = comboRef.current;
    const ca = attemptNumRef.current;

    // Calculate feedback
    let correctPosition = 0;
    let correctDigit = 0;
    const comboUsed = [false, false, false];
    const guessUsed = [false, false, false];

    for (let i = 0; i < 3; i++) {
      if (cg[i] === combo[i]) { correctPosition++; comboUsed[i] = true; guessUsed[i] = true; }
    }
    for (let i = 0; i < 3; i++) {
      if (!guessUsed[i]) {
        for (let j = 0; j < 3; j++) {
          if (!comboUsed[j] && cg[i] === combo[j]) { correctDigit++; comboUsed[j] = true; break; }
        }
      }
    }

    const result: GuessResult = { guess: [...cg], correctPosition, correctDigit };
    const newAttempts = [...attemptsRef.current, result];
    attemptsRef.current = newAttempts;
    setAttempts(newAttempts);

    if (correctPosition === 3) {
      // Cracked!
      play('minigames/safe-crack');
      setCracked(true);
      endedRef.current = true;
      setGameEnded(true);
      setTimeout(() => onResult(ca <= 2 ? 'win' : ca === 3 ? 'close-win' : 'close-loss'), 1500);
    } else if (ca >= 4) {
      // Out of attempts
      endedRef.current = true;
      setGameEnded(true);
      const totalCorrect = Math.max(...newAttempts.map(a => a.correctPosition + a.correctDigit));
      setTimeout(() => onResult(totalCorrect >= 2 ? 'loss' : 'catastrophic'), 1000);
    } else {
      // Reset guess for next attempt
      guessRef.current = [1, 1, 1];
      setCurrentGuess([1, 1, 1]);
      setDialRotation([0, 0, 0]);
    }

    attemptNumRef.current = ca + 1;
    setCurrentAttempt(ca + 1);
  };

  const submitGuess = () => {
    if (endedRef.current || spectator || attemptNumRef.current > 4) return;
    emitAction({ type: 'submit' });
    submitGuessInternal();
  };

  return (
    <div className="safeCracker pixelMinigame">
      <div className="safeHeader">
        <h2 className="safeTitle">SAFE CRACKER</h2>
        <div className="safeProgress">
          ATTEMPT {Math.min(currentAttempt, 4)}/4
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
              <div key={index} className={`dial ${selectedDial === index ? 'selected' : ''}`} onClick={() => selectDial(index)}>
                <button className="dialBtn up pixelBtn" onClick={(e) => { e.stopPropagation(); adjustDial(index, 1); }} disabled={spectator}>▲</button>
                <div className="dialValue">
                  <img src="/assets/minigames/safe/dial.png" alt="" className="dialImg" style={{ transform: `rotate(${dialRotation[index]}deg)` }} />
                  <span className="dialDigit">{digit}</span>
                </div>
                <button className="dialBtn down pixelBtn" onClick={(e) => { e.stopPropagation(); adjustDial(index, -1); }} disabled={spectator}>▼</button>
              </div>
            ))}
          </div>

          {!gameEnded && currentAttempt <= 4 && (
            <div className="safeSubmitRow">
              <input
                type="text"
                className="safeTextInput"
                placeholder="e.g. 132"
                maxLength={3}
                value={textInput}
                disabled={spectator}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^1-4]/g, '');
                  setTextInput(val);
                  if (val.length <= 3) {
                    const digits = val.split('').map(Number);
                    const newGuess = [digits[0] ?? 1, digits[1] ?? 1, digits[2] ?? 1];
                    guessRef.current = newGuess;
                    setCurrentGuess(newGuess);
                    setDialRotation(newGuess.map(d => d * 36));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.length === 3) {
                    submitGuess();
                    setTextInput('');
                  }
                }}
              />
              <button className="submitBtn pixelBtn" onClick={() => { submitGuess(); setTextInput(''); }} disabled={spectator}>TRY</button>
            </div>
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
        {cracked ? 'SAFE CRACKED!' : gameEnded ? `FAILED! CODE: [${combination.join('')}]` : 'DIGITS 1-4. SET COMBO AND TRY. 🟢=RIGHT PLACE 🟡=WRONG PLACE'}
      </div>
    </div>
  );
}
