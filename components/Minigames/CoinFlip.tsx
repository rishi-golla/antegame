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

const STYLE_ID = 'coin-flip-styles';

export default function CoinFlip({ onResult, baseAmount, context, spectator = false }: CoinFlipProps) {
  const { play } = useAudio();

  const resultsRef = useRef<FlipResult[]>([]);
  const phaseRef = useRef<'choosing' | 'flipping' | 'done'>('choosing');
  const displaySideRef = useRef<CoinSide>('heads');
  const flipBusyRef = useRef(false);
  const endedRef = useRef(false);

  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const executeFlipRef = useRef<(guess: CoinSide, actual: CoinSide) => void>(() => {});

  // Inject styles
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes cf-toss {
        0% { transform: translateY(0) rotateY(0deg) scale(1); }
        15% { transform: translateY(-120px) rotateY(540deg) scale(0.9); }
        30% { transform: translateY(-160px) rotateY(1080deg) scale(0.85); }
        50% { transform: translateY(-140px) rotateY(1800deg) scale(0.88); }
        70% { transform: translateY(-60px) rotateY(2520deg) scale(0.95); }
        85% { transform: translateY(10px) rotateY(3060deg) scale(1.02); }
        92% { transform: translateY(-5px) rotateY(3240deg) scale(1); }
        100% { transform: translateY(0) rotateY(3600deg) scale(1); }
      }
      @keyframes cf-wobble {
        0%, 100% { transform: rotateZ(-2deg) rotateX(3deg); }
        25% { transform: rotateZ(2deg) rotateX(-2deg); }
        50% { transform: rotateZ(-1deg) rotateX(2deg); }
        75% { transform: rotateZ(1.5deg) rotateX(-1deg); }
      }
      @keyframes cf-shine {
        0% { left: -60%; }
        100% { left: 160%; }
      }
      @keyframes cf-chip-pulse {
        0%, 100% { box-shadow: 0 0 10px rgba(212,175,55,0.3); }
        50% { box-shadow: 0 0 25px rgba(212,175,55,0.7); }
      }
      @keyframes cf-glow-green {
        0%, 100% { text-shadow: 0 0 8px rgba(74,222,128,0.6); }
        50% { text-shadow: 0 0 20px rgba(74,222,128,1); }
      }
      @keyframes cf-glow-red {
        0%, 100% { text-shadow: 0 0 8px rgba(239,68,68,0.6); }
        50% { text-shadow: 0 0 20px rgba(239,68,68,1); }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'flip') {
      executeFlipRef.current(data.guess, data.actual);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

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
  const roundNum = Math.min(results.length + 1, 3);
  const correctCount = results.filter(r => r.correct).length;

  const suits = ['♠', '♥', '♦', '♣'];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
      background: 'linear-gradient(180deg, #1a0a0a 0%, #0d0505 100%)',
      borderRadius: '16px', padding: '20px 16px', border: '1px solid #3d2a0a',
      boxShadow: '0 0 40px rgba(212,175,55,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
      fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Cinzel', serif", fontSize: '1.3rem', fontWeight: 700,
          color: '#d4af37', letterSpacing: '3px', margin: 0,
          textShadow: '0 0 20px rgba(212,175,55,0.6), 0 2px 4px rgba(0,0,0,0.8)',
        }}>
          COIN FLIP
        </h2>
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
          marginTop: '6px', fontSize: '0.75rem', color: '#a0906a',
          fontFamily: "'Nunito', sans-serif", letterSpacing: '1px',
        }}>
          <span>FLIP {roundNum}/3</span>
          <span style={{ color: '#3d2a0a' }}>▪</span>
          {/* Progress as suits */}
          <span style={{ display: 'flex', gap: '4px' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                color: i < results.length
                  ? (results[i].correct ? '#4ade80' : '#ef4444')
                  : '#3d2a0a',
                fontSize: '0.85rem',
              }}>
                {suits[i]}
              </span>
            ))}
          </span>
          <span style={{ color: '#3d2a0a' }}>▪</span>
          <span style={{ color: '#d4af37' }}>{correctCount} CORRECT</span>
        </div>
      </div>

      {/* Coin */}
      <div style={{
        width: 140, height: 140, perspective: '600px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 120, height: 120, position: 'relative',
          transformStyle: 'preserve-3d',
          animation: phase === 'flipping'
            ? 'cf-toss 1.5s ease-in-out'
            : (phase === 'choosing' ? 'cf-wobble 3s ease-in-out infinite' : 'none'),
        }}>
          {/* Coin face — using original coin images */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            border: '3px solid #d4af37',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(212,175,55,0.5), inset 0 -2px 6px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            position: 'relative',
            background: '#1a0f0f',
          }}>
            <img
              src={displaySide === 'heads' ? '/assets/minigames/coin/coin-heads.png' : '/assets/minigames/coin/coin-tails.png'}
              alt={displaySide}
              style={{
                width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%',
                zIndex: 1,
              }}
            />
            {/* Shine sweep */}
            {phase !== 'flipping' && (
              <div style={{
                position: 'absolute', top: 0, width: '40%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                animation: 'cf-shine 3s ease-in-out infinite',
                pointerEvents: 'none', zIndex: 2,
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Buttons */}
      {phase === 'choosing' && (
        <div style={{ display: 'flex', gap: '20px' }}>
          {(['heads', 'tails'] as CoinSide[]).map(side => (
            <button key={side} onClick={() => makeGuess(side)} disabled={spectator}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: side === 'heads'
                  ? 'radial-gradient(circle at 40% 40%, #f5e6a3, #d4af37 60%, #8b6914)'
                  : 'radial-gradient(circle at 40% 40%, #8b6914, #d4af37 60%, #f5e6a3)',
                border: 'none', cursor: spectator ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                animation: 'cf-chip-pulse 2s ease-in-out infinite',
                position: 'relative',
              }}>
              {/* Inner ring for chip look */}
              <div style={{
                position: 'absolute', top: 6, left: 6, right: 6, bottom: 6,
                borderRadius: '50%',
                border: `2px dashed ${side === 'heads' ? 'rgba(139,105,20,0.5)' : 'rgba(139,105,20,0.5)'}`,
                pointerEvents: 'none',
              }} />
              <span style={{
                fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '0.65rem',
                color: '#1a0a0a',
                letterSpacing: '1px', zIndex: 1,
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
              }}>
                {side.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}

      {phase === 'flipping' && (
        <div style={{
          color: '#d4af37', fontFamily: "'Cinzel', serif", fontSize: '0.9rem',
          letterSpacing: '3px', textShadow: '0 0 10px rgba(212,175,55,0.6)',
        }}>
          ★ FLIPPING ★
        </div>
      )}

      {/* Results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: 280 }}>
        {results.map((result, index) => (
          <div key={index} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 12px', borderRadius: '8px',
            background: 'rgba(26,15,15,0.6)', border: '1px solid #3d2a0a',
            fontSize: '0.7rem', fontFamily: "'Nunito', sans-serif",
            color: '#a0906a',
          }}>
            <span style={{ fontFamily: "'Cinzel', serif", letterSpacing: '1px' }}>FLIP {index + 1}</span>
            <span>{result.guessed.toUpperCase()}</span>
            <span style={{ color: '#5a4a20' }}>▸</span>
            <span>{result.actual.toUpperCase()}</span>
            <span style={{
              fontWeight: 700, fontSize: '0.85rem',
              color: result.correct ? '#4ade80' : '#ef4444',
              animation: result.correct ? 'cf-glow-green 1.5s ease-in-out infinite' : 'cf-glow-red 1.5s ease-in-out infinite',
            }}>
              {result.correct ? '✦' : '✕'}
            </span>
          </div>
        ))}
      </div>

      {/* Status */}
      <div style={{
        color: '#a0906a', fontFamily: "'Cinzel', serif", fontSize: '0.7rem',
        letterSpacing: '2px',
      }}>
        {phase === 'done' ? '★ GAME COMPLETE ★' : phase === 'flipping' ? '' : `CALL FLIP ${roundNum}`}
      </div>

      {/* Paytable */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px',
        padding: '8px 14px', borderRadius: '8px',
        background: 'rgba(26,15,15,0.5)', border: '1px solid #2a1a00',
        fontSize: '0.6rem', color: '#706040', fontFamily: "'Nunito', sans-serif",
      }}>
        <span>3 CORRECT</span><span style={{ color: '#4ade80', textAlign: 'right' }}>WIN</span>
        <span>2 CORRECT</span><span style={{ color: '#84cc16', textAlign: 'right' }}>CLOSE WIN</span>
        <span>1 CORRECT</span><span style={{ color: '#eab308', textAlign: 'right' }}>CLOSE LOSS</span>
        <span>0 CORRECT</span><span style={{ color: '#f97316', textAlign: 'right' }}>LOSS</span>
      </div>
    </div>
  );
}
