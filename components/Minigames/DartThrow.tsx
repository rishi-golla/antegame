'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface LuckyNumberProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

const STYLE_ID = 'lucky-number-styles';

export default function LuckyNumber({ onResult, spectator = false }: LuckyNumberProps) {
  const { play } = useAudio();
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [houseNumber, setHouseNumber] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  // Inject styles
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes ln-chip-select {
        0% { transform: scale(1); box-shadow: 0 0 0 rgba(212,175,55,0); }
        100% { transform: scale(1.15); box-shadow: 0 0 25px rgba(212,175,55,0.8); }
      }
      @keyframes ln-lock-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 15px rgba(212,175,55,0.4); }
        50% { transform: scale(1.06); box-shadow: 0 0 35px rgba(212,175,55,0.9); }
      }
      @keyframes ln-countdown-tick {
        0% { transform: scale(2); opacity: 0; }
        30% { transform: scale(1); opacity: 1; }
        80% { transform: scale(0.95); opacity: 1; }
        100% { transform: scale(0.6); opacity: 0; }
      }
      @keyframes ln-slide-left {
        0% { transform: translateX(-200px); opacity: 0; }
        60% { transform: translateX(10px); opacity: 1; }
        100% { transform: translateX(0); opacity: 1; }
      }
      @keyframes ln-slide-right {
        0% { transform: translateX(200px); opacity: 0; }
        60% { transform: translateX(-10px); opacity: 1; }
        100% { transform: translateX(0); opacity: 1; }
      }
      @keyframes ln-vs-appear {
        0% { transform: scale(0) rotate(-20deg); opacity: 0; }
        60% { transform: scale(1.3) rotate(5deg); opacity: 1; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes ln-gold-explode {
        0% { text-shadow: 0 0 10px rgba(212,175,55,0.5); transform: scale(1); }
        50% { text-shadow: 0 0 40px rgba(255,215,0,1), 0 0 80px rgba(212,175,55,0.6); transform: scale(1.15); }
        100% { text-shadow: 0 0 20px rgba(212,175,55,0.8); transform: scale(1); }
      }
      @keyframes ln-neon-flicker {
        0%, 100% { text-shadow: 0 0 4px currentColor, 0 0 11px currentColor; }
        50% { text-shadow: 0 0 2px currentColor, 0 0 6px currentColor; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'select') {
      setSelected(data.num);
    } else if (data.type === 'lock') {
      setSelected(data.selected);
      setLocked(true);
      setHouseNumber(data.house);
      setCountdown(3);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!done) onResult('catastrophic');
    }, 30000);
    return () => clearTimeout(timer);
  }, [done, onResult]);

  const selectNumber = (num: number) => {
    if (locked || spectator) return;
    setSelected(num);
    emitAction({ type: 'select', num });
  };

  const lockIn = useCallback(() => {
    if (selected === null || locked || spectator) return;
    play('minigames/dart-throw');
    const house = Math.floor(Math.random() * 10) + 1;
    setLocked(true);
    setHouseNumber(house);
    setCountdown(3);
    emitAction({ type: 'lock', selected, house });
  }, [selected, locked, spectator, emitAction]);

  useEffect(() => {
    if (countdown === null || countdown < 0) return;
    if (countdown === 0) {
      setRevealed(true);
      const house = houseNumber!;
      const player = selected!;
      const diff = Math.abs(player - house);
      let tier: MinigameTier;
      if (diff === 0) { tier = 'win'; play('minigames/dart-bullseye'); }
      else if (diff === 1) tier = 'close-win';
      else if (diff === 2) tier = 'close-loss';
      else if (diff <= 4) tier = 'loss';
      else tier = 'catastrophic';
      setDone(true);
      setTimeout(() => onResult(tier), 1500);
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, houseNumber, selected, onResult]);

  const diff = revealed && selected !== null && houseNumber !== null
    ? Math.abs(selected - houseNumber)
    : null;

  const getDiffStyle = (d: number) => {
    if (d === 0) return { color: '#ffd700', animation: 'ln-gold-explode 1s ease-in-out infinite', fontSize: '1.2rem' };
    if (d === 1) return { color: '#f5c542', textShadow: '0 0 15px rgba(245,197,66,0.7)', fontSize: '1rem' };
    if (d === 2) return { color: '#eab308', fontSize: '0.9rem' };
    return { color: '#6b1a3a', fontSize: '0.85rem' };
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
      background: 'linear-gradient(180deg, #1a0a0a 0%, #0d0505 100%)',
      borderRadius: '16px', padding: '20px 16px', border: '1px solid #3d2a0a',
      boxShadow: '0 0 40px rgba(212,175,55,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <h2 style={{
        fontFamily: "'Cinzel', serif", fontSize: '1.3rem', fontWeight: 700,
        color: '#d4af37', letterSpacing: '3px', margin: 0,
        textShadow: '0 0 20px rgba(212,175,55,0.6), 0 2px 4px rgba(0,0,0,0.8)',
      }}>
        LUCKY NUMBER
      </h2>

      {/* Number Grid */}
      {!locked && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px',
            padding: '8px',
          }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
              const isSelected = selected === n;
              return (
                <button key={n} onClick={() => selectNumber(n)} disabled={spectator}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: isSelected
                      ? 'radial-gradient(circle at 35% 35%, #ffe082, #d4af37 50%, #8b6914)'
                      : 'radial-gradient(circle at 35% 35%, #3d2a0a, #1a0f0f 70%)',
                    border: isSelected ? '3px solid #ffd700' : '2px solid #5a4a20',
                    color: isSelected ? '#1a0a0a' : '#d4af37',
                    fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1.1rem',
                    cursor: spectator ? 'default' : 'pointer',
                    position: 'relative',
                    animation: isSelected ? 'ln-chip-select 0.3s ease-out forwards' : 'none',
                    boxShadow: isSelected
                      ? '0 0 20px rgba(212,175,55,0.6), inset 0 1px 0 rgba(255,255,255,0.2)'
                      : '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
                    transition: 'all 0.2s ease',
                  }}>
                  {/* Inner ring */}
                  <div style={{
                    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
                    borderRadius: '50%',
                    border: `1px solid ${isSelected ? 'rgba(139,105,20,0.6)' : 'rgba(90,74,32,0.4)'}`,
                    pointerEvents: 'none',
                  }} />
                  <span style={{ position: 'relative', zIndex: 1 }}>{n}</span>
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <button onClick={lockIn} disabled={spectator}
              style={{
                background: 'linear-gradient(180deg, #f5e6a3 0%, #d4af37 40%, #8b6914 100%)',
                color: '#1a0a0a', border: '2px solid #d4af37',
                borderRadius: '30px', padding: '12px 40px',
                fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1rem',
                letterSpacing: '4px', cursor: spectator ? 'default' : 'pointer',
                animation: 'ln-lock-pulse 1.8s ease-in-out infinite',
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
              }}>
              LOCK IN
            </button>
          )}
        </>
      )}

      {/* Countdown */}
      {locked && !revealed && countdown !== null && countdown > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 120, position: 'relative',
        }}>
          <div key={countdown} style={{
            fontFamily: "'Cinzel', serif", fontWeight: 700,
            fontSize: '4rem', color: '#d4af37',
            textShadow: '0 0 30px rgba(212,175,55,0.8), 0 0 60px rgba(212,175,55,0.3)',
            animation: 'ln-countdown-tick 0.8s ease-out forwards',
          }}>
            {countdown}
          </div>
        </div>
      )}

      {/* Reveal VS screen */}
      {revealed && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '16px', padding: '16px 0',
        }}>
          <div style={{
            textAlign: 'center',
            animation: 'ln-slide-left 0.6s ease-out forwards',
          }}>
            <div style={{
              fontFamily: "'Cinzel', serif", fontSize: '0.6rem', color: '#a0906a',
              letterSpacing: '2px', marginBottom: '4px',
            }}>YOU</div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #f5e6a3, #d4af37 50%, #8b6914)',
              border: '3px solid #d4af37',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1.8rem',
              color: '#1a0a0a',
              boxShadow: '0 0 20px rgba(212,175,55,0.5)',
            }}>
              {selected}
            </div>
          </div>

          <div style={{
            fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1.8rem',
            color: '#d4af37',
            textShadow: '0 0 20px rgba(212,175,55,0.8)',
            animation: 'ln-vs-appear 0.5s ease-out 0.3s both',
          }}>
            VS
          </div>

          <div style={{
            textAlign: 'center',
            animation: 'ln-slide-right 0.6s ease-out forwards',
          }}>
            <div style={{
              fontFamily: "'Cinzel', serif", fontSize: '0.6rem', color: '#a0906a',
              letterSpacing: '2px', marginBottom: '4px',
            }}>HOUSE</div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #6b1a3a, #3d0f22 50%, #2a0f1f)',
              border: '3px solid #d4af37',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1.8rem',
              color: '#fff8e7',
              boxShadow: '0 0 20px rgba(212,175,55,0.4)',
            }}>
              {houseNumber}
            </div>
          </div>
        </div>
      )}

      {/* Diff result */}
      {diff !== null && (
        <div style={{
          fontFamily: "'Cinzel', serif", fontWeight: 700,
          letterSpacing: '3px', textAlign: 'center',
          ...getDiffStyle(diff),
        }}>
          {diff === 0 ? '★ EXACT MATCH ★' : `OFF BY ${diff}`}
        </div>
      )}

      {/* Paytable */}
      <div style={{
        padding: '10px 16px', borderRadius: '10px',
        background: 'rgba(26,15,15,0.5)', border: '1px solid #2a1a00',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: "'Cinzel', serif", fontSize: '0.65rem', color: '#d4af37',
          letterSpacing: '2px', textAlign: 'center', marginBottom: '6px',
          animation: 'ln-neon-flicker 3s ease-in-out infinite',
        }}>
          ★ PAYTABLE ★
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 20px',
          fontSize: '0.6rem', fontFamily: "'Nunito', sans-serif", color: '#706040',
        }}>
          <span>EXACT MATCH</span><span style={{ color: '#d4af37', textAlign: 'right' }}>WIN</span>
          <span>OFF BY 1</span><span style={{ color: '#b8860b', textAlign: 'right' }}>CLOSE WIN</span>
          <span>OFF BY 2</span><span style={{ color: '#8b4513', textAlign: 'right' }}>CLOSE LOSS</span>
          <span>OFF BY 3-4</span><span style={{ color: '#6b1a3a', textAlign: 'right' }}>LOSS</span>
        </div>
      </div>
    </div>
  );
}
