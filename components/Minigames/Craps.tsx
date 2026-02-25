'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface CrapsProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

const CrapsStyles = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Nunito:wght@400;600;700&display=swap');

@keyframes craps-tumble {
  0% { transform: translateY(-40px) rotate(0deg); opacity: 0; }
  20% { transform: translateY(10px) rotate(180deg); opacity: 1; }
  40% { transform: translateY(-15px) rotate(360deg); }
  60% { transform: translateY(5px) rotate(540deg); }
  80% { transform: translateY(-3px) rotate(680deg); }
  100% { transform: translateY(0) rotate(720deg); opacity: 1; }
}

@keyframes craps-winGlow {
  0%, 100% { box-shadow: 0 6px 20px rgba(34,197,94,0.3), inset 0 1px 0 rgba(255,255,255,0.3); }
  50% { box-shadow: 0 6px 30px rgba(34,197,94,0.7), 0 0 40px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.3); }
}

@keyframes craps-lossShake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
  20%, 40%, 60%, 80% { transform: translateX(3px); }
}

@keyframes craps-redFlash {
  0% { background-color: rgba(220,38,38,0); }
  30% { background-color: rgba(220,38,38,0.2); }
  100% { background-color: rgba(220,38,38,0); }
}

@keyframes craps-pointPulse {
  0%, 100% { text-shadow: 0 0 8px rgba(255,165,0,0.4); }
  50% { text-shadow: 0 0 20px rgba(255,165,0,0.8), 0 0 40px rgba(255,165,0,0.3); }
}

@keyframes craps-celebration {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}
`;

/* Pip layout positions for dice faces (3x3 grid, row-col) */
const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[1,1]],
  2: [[0,2],[2,0]],
  3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]],
  5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
};

function CasinoDie({ value, rolling, result, won }: { value: number; rolling: boolean; result: boolean; won?: boolean }) {
  const pips = PIP_POSITIONS[value] || [];

  const dieStyle: React.CSSProperties = {
    width: '130px', height: '130px',
    borderRadius: '12px',
    background: 'linear-gradient(145deg, #f5f0e0, #ddd5c0)',
    border: '2px solid #d4af37',
    boxShadow: result && won
      ? '0 6px 20px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
      : '0 6px 20px rgba(0,0,0,0.4), 0 0 8px rgba(212,175,55,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
    display: 'grid',
    gridTemplateRows: '1fr 1fr 1fr',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '14px',
    position: 'relative' as const,
    animation: rolling ? 'craps-tumble 0.8s ease-out' : result ? (won ? 'craps-winGlow 1.5s ease-in-out infinite' : 'craps-lossShake 0.4s ease-out') : undefined,
    transition: 'box-shadow 0.3s',
  };

  // Build a 3x3 grid, place pips
  const grid = Array.from({ length: 9 }, (_, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const hasPip = pips.some(([r, c]) => r === row && c === col);
    return (
      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hasPip && (
          <div style={{
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'linear-gradient(145deg, #1a0f0f, #2e1a1a)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 1px rgba(255,255,255,0.2)',
          }} />
        )}
      </div>
    );
  });

  return <div style={dieStyle}>{grid}</div>;
}

export default function Craps({ onResult, baseAmount, context, spectator = false }: CrapsProps) {
  const { play } = useAudio();
  const [targetNumber, setTargetNumber] = useState<number | null>(null);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rollPhase, setRollPhase] = useState<'idle' | 'charge' | 'throw' | 'impact' | 'result'>('idle');
  const [gameStarted, setGameStarted] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [pendingRoll, setPendingRoll] = useState<{ d1: number; d2: number } | null>(null);
  const [won, setWon] = useState<boolean | null>(null);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'select-target') {
      setTargetNumber(data.num);
    } else if (data.type === 'roll') {
      setPendingRoll({ d1: data.d1, d2: data.d2 });
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, [onResult]);

  // Client tier is cosmetic in multiplayer (server is authoritative via resolveCraps()).
  // Thresholds match server/minigameEngine.ts. Diff range: 0 (exact) to 10 (2 vs 12).
  const calculateResult = (total: number) => {
    if (!targetNumber) return;
    const difference = Math.abs(total - targetNumber);
    let w = false;
    if (difference === 0) { w = true; onResult('win'); }
    else if (difference === 1) { w = true; onResult('close-win'); }
    else if (difference <= 3) { onResult('close-loss'); }
    else if (difference <= 5) { onResult('loss'); }
    else { onResult('catastrophic'); }
    setWon(w);
  };

  const animateRoll = (finalD1: number, finalD2: number) => {
    const total = finalD1 + finalD2;
    setGameStarted(true);
    setRolling(true);
    play('minigames/dice-tumble');

    setRollPhase('charge');

    let rollCount = 0;
    const totalRolls = 20;

    setTimeout(() => {
      setRollPhase('throw');

      const doRoll = () => {
        if (rollCount >= totalRolls) {
          setDice1(finalD1);
          setDice2(finalD2);
          setRollPhase('impact');
          setTimeout(() => {
            setRollPhase('result');
            setResult(total);
            setRolling(false);
            setTimeout(() => calculateResult(total), 1200);
          }, 200);
          return;
        }
        setDice1(Math.ceil(Math.random() * 6));
        setDice2(Math.ceil(Math.random() * 6));
        rollCount++;
        const delay = 40 + Math.pow(rollCount / totalRolls, 2.5) * 180;
        setTimeout(doRoll, delay);
      };

      doRoll();
    }, 200);
  };

  useEffect(() => {
    if (spectator && pendingRoll && targetNumber && !rolling) {
      const { d1, d2 } = pendingRoll;
      setPendingRoll(null);
      animateRoll(d1, d2);
    }
  }, [spectator, pendingRoll, targetNumber, rolling]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTarget = (num: number) => {
    if (!gameStarted && !spectator) {
      setTargetNumber(num);
      emitAction({ type: 'select-target', num });
    }
  };

  const rollDice = () => {
    if (!targetNumber || rolling || spectator) return;
    const finalD1 = Math.ceil(Math.random() * 6);
    const finalD2 = Math.ceil(Math.random() * 6);
    emitAction({ type: 'roll', d1: finalD1, d2: finalD2 });
    animateRoll(finalD1, finalD2);
  };

  const isPointPhase = gameStarted && !result;

  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: '650px', margin: '0 auto', minHeight: '620px', padding: '12px 0',
      background: isPointPhase
        ? 'linear-gradient(180deg, #2a0f1f 0%, #3d0f22 50%, #1a0f0f 100%)'
        : 'linear-gradient(180deg, #1a0f0f 0%, #2a0f1f 50%, #1a0f0f 100%)',
      borderRadius: '16px', overflow: 'hidden', fontFamily: 'Nunito, sans-serif',
      transition: 'background 0.8s ease',
    }}>
      <style>{CrapsStyles}</style>

      {/* Loss flash overlay */}
      {result && won === false && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', animation: 'craps-redFlash 0.6s ease-out' }} />
      )}

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '24px 0 12px' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif', fontSize: '38px', fontWeight: 900,
          color: '#d4af37', textShadow: '0 0 12px rgba(212,175,55,0.5)',
          margin: 0, letterSpacing: '3px',
        }}>CRAPS</h2>
      </div>

      {/* Target display / Point plaque */}
      {targetNumber && (
        <div style={{
          textAlign: 'center', margin: '8px auto 20px', maxWidth: '300px',
          padding: '12px 32px', borderRadius: '10px',
          background: 'linear-gradient(180deg, #2a1a00 0%, #1a1000 100%)',
          border: '2px solid #d4af37',
          boxShadow: '0 0 16px rgba(212,175,55,0.3), inset 0 0 12px rgba(212,175,55,0.1)',
        }}>
          <div style={{ fontSize: '14px', color: 'rgba(212,175,55,0.6)', letterSpacing: '2px', marginBottom: '4px' }}>TARGET</div>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: '48px', fontWeight: 900, color: '#ffd700',
            animation: isPointPhase ? 'craps-pointPulse 2s ease-in-out infinite' : undefined,
          }}>{targetNumber}</div>
        </div>
      )}

      {/* Target selection */}
      {!gameStarted && (
        <div style={{ textAlign: 'center', padding: '0 20px 16px' }}>
          <div style={{ fontSize: '16px', color: 'rgba(212,175,55,0.7)', letterSpacing: '2px', marginBottom: '16px' }}>
            CHOOSE YOUR TARGET
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '14px' }}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
              <button key={num} onClick={() => selectTarget(num)} disabled={spectator} style={{
                width: '56px', height: '56px', borderRadius: '50%',
                fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '20px',
                background: targetNumber === num
                  ? 'linear-gradient(180deg, #d4af37 0%, #a68628 100%)'
                  : 'linear-gradient(180deg, #2a0f1f 0%, #1a0f0f 100%)',
                color: targetNumber === num ? '#1a0f0f' : '#d4af37',
                border: targetNumber === num ? '2px solid #ffd700' : '2px solid rgba(212,175,55,0.3)',
                cursor: spectator ? 'not-allowed' : 'pointer',
                boxShadow: targetNumber === num ? '0 0 12px rgba(212,175,55,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.15s',
              }}>{num}</button>
            ))}
          </div>
        </div>
      )}

      {/* Dice area */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '50px', padding: '32px 0' }}>
        <CasinoDie value={dice1} rolling={rolling} result={rollPhase === 'result'} won={won === true} />
        <CasinoDie value={dice2} rolling={rolling} result={rollPhase === 'result'} won={won === true} />
      </div>

      {/* Status */}
      <div style={{
        textAlign: 'center', padding: '12px 0',
        fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: '18px',
        color: 'rgba(212,175,55,0.8)', letterSpacing: '1px',
      }}>
        {!targetNumber ? 'SELECT A TARGET (2–12)' : !gameStarted ? 'CLICK ROLL DICE!' : rolling ? 'ROLLING...' : `YOU ROLLED ${dice1 + dice2}!`}
      </div>

      {/* Roll button */}
      {targetNumber && !rolling && !result && (
        <div style={{ textAlign: 'center', padding: '12px 0 24px' }}>
          <button onClick={rollDice} disabled={spectator} style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '18px',
            padding: '16px 56px', borderRadius: '14px',
            background: 'linear-gradient(180deg, #d4af37 0%, #8b6914 100%)',
            color: '#ffd700', border: '3px solid #d4af37',
            cursor: spectator ? 'not-allowed' : 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            letterSpacing: '3px', textTransform: 'uppercase' as const,
            transition: 'transform 0.1s',
          }}
            onMouseDown={e => { (e.target as HTMLElement).style.transform = 'scale(0.95)'; }}
            onMouseUp={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
          >ROLL DICE</button>
        </div>
      )}

      {/* Result */}
      {result && targetNumber && (
        <div style={{
          textAlign: 'center', padding: '12px 0',
          animation: 'craps-celebration 0.4s ease-out both',
        }}>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: '22px', fontWeight: 700,
            color: won ? '#22c55e' : '#dc2626',
            textShadow: won ? '0 0 12px rgba(34,197,94,0.5)' : '0 0 12px rgba(220,38,38,0.5)',
          }}>
            TARGET: {targetNumber} ▪ ROLLED: {result}
          </div>
          <div style={{
            fontSize: '16px', color: 'rgba(212,175,55,0.6)', marginTop: '6px',
          }}>
            DIFFERENCE: {Math.abs(result - targetNumber)}
          </div>
        </div>
      )}

      {/* Paytable */}
      <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
        {[
          ['EXACT', 'WIN'],
          ['OFF BY 1', 'CLOSE WIN'],
          ['OFF BY 2-3', 'CLOSE LOSS'],
          ['OFF BY 4-5', 'LOSS'],
          ['OFF BY 6+', 'DISASTER'],
        ].map(([label, val], i) => (
          <div key={i} style={{ fontSize: '14px', color: 'rgba(212,175,55,0.4)', letterSpacing: '1px', lineHeight: 2 }}>
            {label} = {val}
          </div>
        ))}
      </div>
    </div>
  );
}
