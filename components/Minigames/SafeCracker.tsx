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

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@600;700;800&display=swap');

@keyframes scDialShake {
  0%, 100% { transform: rotate(var(--rot)); }
  20% { transform: rotate(calc(var(--rot) + 8deg)); }
  40% { transform: rotate(calc(var(--rot) - 6deg)); }
  60% { transform: rotate(calc(var(--rot) + 4deg)); }
  80% { transform: rotate(calc(var(--rot) - 2deg)); }
}
@keyframes scVaultOpen {
  0% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
  100% { transform: perspective(800px) rotateY(-90deg); opacity: 0.3; }
}
@keyframes scGoldSpill {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; }
  100% { opacity: 0; transform: scale(2); }
}
@keyframes scAlarm {
  0%, 100% { background: linear-gradient(135deg, #2a0f1f, #1a0f0f); }
  50% { background: linear-gradient(135deg, #3d0f22, #2a0f1f); }
}
@keyframes scLockStamp {
  0% { transform: scale(3) rotate(-15deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(-12deg); opacity: 0.9; }
  100% { transform: scale(1) rotate(-12deg); opacity: 1; }
}
@keyframes scTumblerFill {
  0% { background: #2a0f1f; box-shadow: none; }
  100% { background: #8b6914; box-shadow: 0 0 8px rgba(212,175,55,0.6); }
}
@keyframes scClickGlow {
  0% { box-shadow: 0 0 0 rgba(212,175,55,0); }
  50% { box-shadow: 0 0 15px rgba(212,175,55,0.5); }
  100% { box-shadow: 0 0 0 rgba(212,175,55,0); }
}
`;

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
  const [shaking, setShaking] = useState(false);
  const [failed, setFailed] = useState(false);

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
      n[dialIndex] += direction * 90;
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
      play('minigames/safe-crack');
      setCracked(true);
      endedRef.current = true;
      setGameEnded(true);
      setTimeout(() => onResult(ca <= 2 ? 'win' : ca === 3 ? 'close-win' : 'close-loss'), 1500);
    } else if (ca >= 4) {
      endedRef.current = true;
      setGameEnded(true);
      setFailed(true);
      const totalCorrect = Math.max(...newAttempts.map(a => a.correctPosition + a.correctDigit));
      setTimeout(() => onResult(totalCorrect >= 2 ? 'loss' : 'catastrophic'), 1000);
    } else {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
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

  // Best correct positions so far for tumbler display
  const bestCorrectPos = attempts.length > 0 ? Math.max(...attempts.map(a => a.correctPosition)) : 0;

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        animation: failed ? 'scAlarm 0.3s infinite' : 'none',
        position: 'relative',
      }}>
        {/* Title */}
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 22,
          fontWeight: 900,
          color: '#ffd700',
          letterSpacing: 3,
          margin: 0,
          textShadow: '0 0 10px rgba(255,215,0,0.4)',
        }}>
          SAFE CRACKER
        </h2>

        {/* Attempt counter */}
        <div style={{
          fontFamily: 'monospace',
          fontSize: 14,
          color: cracked ? '#d4af37' : '#d4af37',
          background: '#1a0f0f',
          border: '2px solid #4a2828',
          borderRadius: 6,
          padding: '4px 14px',
          letterSpacing: 2,
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.8)',
        }}>
          ATTEMPT {Math.min(currentAttempt, 4)}/4
          {cracked && <span style={{ color: '#ffd700', marginLeft: 8 }}>✦ CRACKED</span>}
        </div>

        {/* Tumblers */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid #d4af37',
              background: i < bestCorrectPos ? '#8b6914' : '#2a0f1f',
              boxShadow: i < bestCorrectPos ? '0 0 8px rgba(212,175,55,0.6), inset 0 0 4px rgba(212,175,55,0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.5)',
              transition: 'all 0.4s ease',
            }} />
          ))}
        </div>

        {/* Vault dial */}
        {!cracked && !failed && (
          <div style={{
            position: 'relative',
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'conic-gradient(from 0deg, #2a0f1f, #3d0f22, #2a0f1f, #2e1a1a, #2a0f1f)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.4), 0 0 0 4px #4a2828, 0 0 0 6px rgba(212,175,55,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Tick marks */}
            {Array.from({ length: 40 }, (_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: i % 10 === 0 ? 3 : 1,
                height: i % 10 === 0 ? 14 : 8,
                background: i % 10 === 0 ? '#ffd700' : '#b89a6a',
                top: 6,
                left: '50%',
                transformOrigin: '50% 94px',
                transform: `translateX(-50%) rotate(${i * 9}deg)`,
              }} />
            ))}

            {/* Rotating indicator */}
            <div style={{
              position: 'absolute',
              width: 4, height: 60,
              background: 'linear-gradient(180deg, #ff4444, #cc2222)',
              top: 16,
              left: '50%',
              transformOrigin: '50% 84px',
              transform: `translateX(-50%) rotate(${dialRotation[selectedDial]}deg)`,
              borderRadius: 2,
              transition: shaking ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.4)',
              animation: shaking ? 'scDialShake 0.4s ease-out' : 'none',
              zIndex: 2,
            } as any} />

            {/* Center pin */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #ffd700, #c9a84c, #8b6914)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
              zIndex: 3,
            }} />
          </div>
        )}

        {/* Cracked — vault open */}
        {cracked && (
          <div style={{
            width: 200, height: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: 180, height: 180,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #2e1a1a, #2a0f1f)',
              border: '4px solid #d4af37',
              animation: 'scVaultOpen 1s ease-out forwards',
              transformOrigin: 'left center',
            }} />
            <div style={{
              position: 'absolute',
              width: 120, height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,215,0,0.4), rgba(255,215,0,0.1), transparent)',
              animation: 'scGoldSpill 1.5s ease-out',
              pointerEvents: 'none',
            }} />
            <span style={{
              position: 'absolute',
              fontFamily: 'Cinzel, serif',
              fontSize: 28,
              fontWeight: 900,
              color: '#ffd700',
              textShadow: '0 0 20px rgba(255,215,0,0.8)',
            }}>
              ✦
            </span>
          </div>
        )}

        {/* Failed — LOCKED OUT */}
        {failed && (
          <div style={{
            width: 200, height: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: 180, height: 180,
              borderRadius: 12,
              background: 'repeating-linear-gradient(45deg, #3d0f22, #3d0f22 10px, #2a0f1f 10px, #2a0f1f 20px)',
              border: '4px solid #6b1a3a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: 'Cinzel, serif',
                fontSize: 18,
                fontWeight: 900,
                color: '#ff3333',
                textShadow: '0 0 10px rgba(255,0,0,0.6)',
                animation: 'scLockStamp 0.5s ease-out',
                border: '3px solid #ff3333',
                padding: '6px 14px',
                borderRadius: 4,
              }}>
                LOCKED OUT
              </span>
            </div>
          </div>
        )}

        {/* Dial controls — 3 combination rings */}
        {!cracked && !failed && (
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            {currentGuess.map((digit, index) => (
              <div key={index} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <button
                  onClick={(e) => { e.stopPropagation(); adjustDial(index, 1); }}
                  disabled={spectator}
                  onMouseDown={() => selectDial(index)}
                  style={{
                    width: 36, height: 28,
                    background: 'linear-gradient(180deg, #3a2020, #2a0f1f)',
                    border: '1px solid #d4af37',
                    borderRadius: 4,
                    color: '#ccc',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: spectator ? 'default' : 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >▲</button>
                <div
                  onClick={() => selectDial(index)}
                  style={{
                    width: 48, height: 48,
                    borderRadius: '50%',
                    background: selectedDial === index
                      ? 'radial-gradient(circle, #3d0f22, #2a0f1f)'
                      : 'radial-gradient(circle, #2a0f1f, #1a0f0f)',
                    border: selectedDial === index ? '2px solid #ffd700' : '2px solid #d4af37',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: selectedDial === index ? '0 0 10px rgba(255,215,0,0.3)' : 'inset 0 2px 6px rgba(0,0,0,0.5)',
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: 22,
                    fontWeight: 900,
                    color: selectedDial === index ? '#ffd700' : '#ccc',
                  }}>
                    {digit}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); adjustDial(index, -1); }}
                  disabled={spectator}
                  onMouseDown={() => selectDial(index)}
                  style={{
                    width: 36, height: 28,
                    background: 'linear-gradient(180deg, #2a0f1f, #3a2020)',
                    border: '1px solid #d4af37',
                    borderRadius: 4,
                    color: '#ccc',
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: spectator ? 'default' : 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >▼</button>
              </div>
            ))}
          </div>
        )}

        {/* Text input + submit */}
        {!gameEnded && currentAttempt <= 4 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
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
                  setDialRotation(newGuess.map(d => d * 90));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInput.length === 3) {
                  submitGuess();
                  setTextInput('');
                }
              }}
              style={{
                width: 80,
                padding: '8px 12px',
                fontFamily: 'monospace',
                fontSize: 16,
                color: '#ffd700',
                background: '#0a0a0a',
                border: '2px solid #333',
                borderRadius: 6,
                textAlign: 'center',
                letterSpacing: 6,
                outline: 'none',
              }}
            />
            <button
              onClick={() => { submitGuess(); setTextInput(''); }}
              disabled={spectator}
              style={{
                fontFamily: 'Nunito, sans-serif',
                fontSize: 14,
                fontWeight: 800,
                color: '#1a0f0f',
                background: 'linear-gradient(180deg, #ffd700, #d4af37)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                cursor: spectator ? 'default' : 'pointer',
                letterSpacing: 2,
                boxShadow: '0 2px 8px rgba(255,215,0,0.3)',
              }}
            >TRY</button>
          </div>
        )}

        {/* Attempts history */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          width: '100%', maxWidth: 280,
        }}>
          <div style={{
            fontFamily: 'Nunito, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            color: '#888',
            letterSpacing: 1,
          }}>PREVIOUS ATTEMPTS:</div>
          {attempts.map((attempt, index) => (
            <div key={index} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 4,
              border: '1px solid #333',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>#{index + 1}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 14, color: '#e0e0e0', letterSpacing: 3 }}>[{attempt.guess.join('')}]</span>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#d4af37' }}>●×{attempt.correctPosition}</span>
              <span style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, color: '#b89a6a' }}>◐×{attempt.correctDigit}</span>
            </div>
          ))}
          {attempts.length === 0 && (
            <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, color: '#555', fontStyle: 'italic' }}>NO ATTEMPTS YET</div>
          )}
        </div>

        {/* Instructions */}
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: '#888',
          textAlign: 'center',
          maxWidth: 280,
        }}>
          {cracked ? '✦ SAFE CRACKED ✦' : failed ? `FAILED — CODE: [${combination.join('')}]` : 'DIGITS 1-4. SET COMBO AND TRY. ● = RIGHT PLACE  ◐ = WRONG PLACE'}
        </div>
      </div>
    </>
  );
}
