'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface WheelOfFortuneProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

type WheelSegment = {
  id: number;
  tier: MinigameTier;
  label: string;
  color: string;
};

const WHEEL_SEGMENTS: WheelSegment[] = [
  { id: 1, tier: 'win', label: 'WIN', color: '#d4af37' },
  { id: 2, tier: 'close-win', label: 'CLOSE', color: '#b8860b' },
  { id: 3, tier: 'close-loss', label: 'ALMOST', color: '#8b4513' },
  { id: 4, tier: 'loss', label: 'LOSS', color: '#6b1a3a' },
  { id: 5, tier: 'win', label: 'WIN', color: '#d4af37' },
  { id: 6, tier: 'close-win', label: 'CLOSE', color: '#b8860b' },
  { id: 7, tier: 'close-loss', label: 'ALMOST', color: '#8b4513' },
  { id: 8, tier: 'loss', label: 'LOSS', color: '#6b1a3a' },
  { id: 9, tier: 'close-win', label: 'CLOSE', color: '#b8860b' },
  { id: 10, tier: 'close-loss', label: 'ALMOST', color: '#8b4513' },
  { id: 11, tier: 'loss', label: 'LOSS', color: '#6b1a3a' },
  { id: 12, tier: 'catastrophic', label: '✕✕', color: '#3d0f22' }
];

function darkenColor(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

const STYLE_ID = 'wheel-of-fortune-styles';

export default function WheelOfFortune({ onResult, baseAmount, context, spectator = false }: WheelOfFortuneProps) {
  const { play } = useAudio();
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const spinTriggeredRef = useRef(false);
  const [bulbOffset, setBulbOffset] = useState(0);

  // Inject styles
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes wof-pulse-spin-btn {
        0%, 100% { transform: translateX(-50%) scale(1); box-shadow: 0 0 15px rgba(212,175,55,0.5); }
        50% { transform: translateX(-50%) scale(1.08); box-shadow: 0 0 30px rgba(212,175,55,0.9); }
      }
      @keyframes wof-pointer-bounce {
        0%, 100% { transform: translateX(-50%) rotate(0deg); }
        50% { transform: translateX(-50%) rotate(-8deg); }
      }
      @keyframes wof-glow-pulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      @keyframes wof-result-pop {
        0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
        60% { transform: translateX(-50%) scale(1.15); opacity: 1; }
        100% { transform: translateX(-50%) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(STYLE_ID)?.remove(); };
  }, []);

  // Chase light animation
  useEffect(() => {
    const iv = setInterval(() => setBulbOffset(o => (o + 1) % 24), 120);
    return () => clearInterval(iv);
  }, []);

  const doSpin = useCallback((totalRotation: number, selectedSegment: WheelSegment) => {
    if (spinTriggeredRef.current) return;
    spinTriggeredRef.current = true;
    setSpinning(true);
    setCanSpin(false);
    play('minigames/wheel-spin');

    let tickDelay = 80;
    const scheduleTick = () => {
      tickIntervalRef.current = setTimeout(() => {
        play('minigames/wheel-tick');
        tickDelay = Math.min(tickDelay * 1.15, 500);
        scheduleTick();
      }, tickDelay);
    };
    scheduleTick();

    setRotation(totalRotation);

    setTimeout(() => {
      if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);
      setSpinning(false);
      setResult(selectedSegment);
      setTimeout(() => { onResult(selectedSegment.tier); }, 1500);
    }, 4000);
  }, [play, onResult]);

  const doSpinRef = useRef(doSpin);
  useEffect(() => { doSpinRef.current = doSpin; }, [doSpin]);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'spin') {
      doSpinRef.current(data.totalRotation, data.selectedSegment);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => { if (canSpin) onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, [onResult, canSpin]);

  const spinWheel = () => {
    if (spinning || !canSpin || spectator) return;

    const baseRotations = 4 + Math.random() * 3;
    const finalPosition = Math.random() * 360;
    const totalRotation = rotation + (baseRotations * 360) + finalPosition;

    const segmentAngle = 360 / 12;
    const normalizedAngle = (360 - (totalRotation % 360)) % 360;
    const segmentIndex = Math.floor(normalizedAngle / segmentAngle);
    const selectedSegment = WHEEL_SEGMENTS[segmentIndex];

    emitAction({ type: 'spin', totalRotation, selectedSegment });
    doSpin(totalRotation, selectedSegment);
  };

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 20;
  const outerR = size / 2 - 4;
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;
  const bulbCount = 24;

  const resultSegmentIdx = result ? WHEEL_SEGMENTS.findIndex(s => s.id === result.id) : -1;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      background: 'linear-gradient(180deg, #1a0a0a 0%, #0d0505 100%)',
      borderRadius: '16px', padding: '24px 28px', border: '1px solid #3d2a0a', maxWidth: '600px', margin: '0 auto',
      boxShadow: '0 0 40px rgba(212,175,55,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <h2 style={{
        fontFamily: "'Cinzel', serif", fontSize: '36px', fontWeight: 700,
        color: '#d4af37', letterSpacing: '3px', margin: 0,
        textShadow: '0 0 20px rgba(212,175,55,0.6), 0 2px 4px rgba(0,0,0,0.8)',
      }}>
        WHEEL OF FORTUNE
      </h2>

      <div style={{
        width: size + 40, height: size + 100, position: 'relative', margin: '0 auto',
      }}>
        {/* Pointer */}
        <div style={{
          position: 'absolute', top: -2, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10, width: 0, height: 0,
          borderLeft: '14px solid transparent', borderRight: '14px solid transparent',
          borderTop: '28px solid #d4af37',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
          animation: spinning ? 'wof-pointer-bounce 0.15s ease-in-out infinite' : 'none',
        }} />
        <div style={{
          position: 'absolute', top: -2, left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 11, width: 0, height: 0,
          borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
          borderTop: '18px solid #f5e6a3',
        }} />

        <svg
          width={size + 20}
          height={size + 20}
          viewBox={`-10 -10 ${size + 20} ${size + 20}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 4s cubic-bezier(0.12, 0.7, 0.3, 1)' : 'none',
            filter: spinning ? 'none' : undefined,
          }}
        >
          <defs>
            {WHEEL_SEGMENTS.map((seg, i) => (
              <radialGradient key={`grad-${i}`} id={`wof-seg-grad-${i}`} cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor={seg.color} stopOpacity="1" />
                <stop offset="60%" stopColor={seg.color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={darkenColor(seg.color, 80)} stopOpacity="1" />
              </radialGradient>
            ))}
            <radialGradient id="wof-hub-grad" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#f5e6a3" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#8b6914" />
            </radialGradient>
            <radialGradient id="wof-hub-inner" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#ffe082" />
              <stop offset="100%" stopColor="#b8860b" />
            </radialGradient>
          </defs>

          {/* Outer decorative ring */}
          <circle cx={cx} cy={cy} r={outerR + 6} fill="none" stroke="#2a1a00" strokeWidth="14" />
          <circle cx={cx} cy={cy} r={outerR + 6} fill="none" stroke="url(#wof-hub-grad)" strokeWidth="3" />

          {/* Light bulbs on outer ring */}
          {Array.from({ length: bulbCount }).map((_, i) => {
            const angle = (i / bulbCount) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const br = outerR + 6;
            const bx = cx + Math.cos(rad) * br;
            const by = cy + Math.sin(rad) * br;
            const isLit = (i + bulbOffset) % 3 === 0;
            return (
              <circle key={`bulb-${i}`} cx={bx} cy={by} r={3.5}
                fill={isLit ? '#fffbe6' : '#5a4a20'}
                stroke="#8b7320" strokeWidth="0.5"
                style={{ filter: isLit ? 'drop-shadow(0 0 4px #fffbe6)' : 'none' }}
              />
            );
          })}

          {/* Inner gold trim ring */}
          <circle cx={cx} cy={cy} r={radius + 2} fill="none" stroke="#d4af37" strokeWidth="3" />
          <circle cx={cx} cy={cy} r={radius - 1} fill="none" stroke="#8b6914" strokeWidth="1" />

          {/* Segments */}
          {WHEEL_SEGMENTS.map((seg, i) => {
            const startDeg = i * segmentAngle - 90;
            const endDeg = (i + 1) * segmentAngle - 90;
            const startRad = (startDeg * Math.PI) / 180;
            const endRad = (endDeg * Math.PI) / 180;

            const x1 = cx + Math.cos(startRad) * radius;
            const y1 = cy + Math.sin(startRad) * radius;
            const x2 = cx + Math.cos(endRad) * radius;
            const y2 = cy + Math.sin(endRad) * radius;

            const largeArc = segmentAngle > 180 ? 1 : 0;
            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            const midRad = ((startDeg + endDeg) / 2 * Math.PI) / 180;
            const textR = radius * 0.65;
            const tx = cx + Math.cos(midRad) * textR;
            const ty = cy + Math.sin(midRad) * textR;
            const textRotation = (startDeg + endDeg) / 2 + 90;

            const isDimmed = result && i !== resultSegmentIdx;
            const isWinner = result && i === resultSegmentIdx;

            return (
              <g key={seg.id} style={{
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.5s ease',
              }}>
                <path d={path} fill={`url(#wof-seg-grad-${i})`} stroke="#1a0f0f" strokeWidth="1.5" />
                {isWinner && (
                  <path d={path} fill="none" stroke="#fff" strokeWidth="2"
                    style={{ animation: 'wof-glow-pulse 0.6s ease-in-out infinite', filter: 'drop-shadow(0 0 8px ' + seg.color + ')' }}
                  />
                )}
                <text
                  x={tx} y={ty}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#fff" fontSize="12" fontWeight="bold"
                  fontFamily="'Cinzel', serif"
                  transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)', pointerEvents: 'none' } as any}
                >
                  {seg.label}
                </text>
              </g>
            );
          })}

          {/* Center hub */}
          <circle cx={cx} cy={cy} r={26} fill="url(#wof-hub-grad)" stroke="#8b6914" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={16} fill="url(#wof-hub-inner)" stroke="#d4af37" strokeWidth="1.5" />
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
            fill="#1a0a0a" fontSize="8" fontWeight="bold" fontFamily="'Cinzel', serif">
            ★
          </text>
        </svg>

        {/* Spin button */}
        {canSpin && !spinning && !result && (
          <button
            onClick={spinWheel}
            disabled={spectator}
            style={{
              position: 'absolute', bottom: 8, left: '50%',
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, #f5e6a3 0%, #d4af37 40%, #8b6914 100%)',
              color: '#1a0a0a', border: '2px solid #d4af37',
              borderRadius: '30px', padding: '14px 40px',
              fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: '1rem',
              letterSpacing: '4px', cursor: spectator ? 'default' : 'pointer',
              animation: 'wof-pulse-spin-btn 1.8s ease-in-out infinite',
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            SPIN
          </button>
        )}

        {spinning && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%',
            transform: 'translateX(-50%)',
            color: '#d4af37', fontFamily: "'Cinzel', serif", fontSize: '0.85rem',
            letterSpacing: '2px', textShadow: '0 0 10px rgba(212,175,55,0.6)',
          }}>
            ★ SPINNING ★
          </div>
        )}

        {result && (
          <div style={{
            position: 'absolute', bottom: 6, left: '50%',
            textAlign: 'center',
            animation: 'wof-result-pop 0.5s ease-out forwards',
          }}>
            <div style={{
              color: '#a0906a', fontSize: '0.55rem', fontFamily: "'Cinzel', serif",
              letterSpacing: '2px', marginBottom: '2px',
            }}>RESULT</div>
            <div style={{
              color: result.color, fontSize: '1.1rem', fontFamily: "'Cinzel', serif",
              fontWeight: 700, textShadow: `0 0 15px ${result.color}`,
            }}>{result.label}</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center',
        marginTop: '4px',
      }}>
        {[
          { color: '#d4af37', label: 'WIN' },
          { color: '#b8860b', label: 'CLOSE WIN' },
          { color: '#8b4513', label: 'CLOSE LOSS' },
          { color: '#6b1a3a', label: 'LOSS' },
          { color: '#3d0f22', label: 'DISASTER' },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '14px', color: '#a0906a', fontFamily: "'Nunito', sans-serif",
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${item.color}, ${darkenColor(item.color, 60)})`,
              border: '1px solid rgba(212,175,55,0.4)',
              display: 'inline-block',
            }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
