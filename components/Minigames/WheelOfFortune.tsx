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
  { id: 1, tier: 'win', label: 'WIN', color: '#4ade80' },
  { id: 2, tier: 'close-win', label: 'CLOSE', color: '#84cc16' },
  { id: 3, tier: 'close-loss', label: 'ALMOST', color: '#eab308' },
  { id: 4, tier: 'loss', label: 'LOSS', color: '#f97316' },
  { id: 5, tier: 'win', label: 'WIN', color: '#4ade80' },
  { id: 6, tier: 'close-win', label: 'CLOSE', color: '#84cc16' },
  { id: 7, tier: 'close-loss', label: 'ALMOST', color: '#eab308' },
  { id: 8, tier: 'loss', label: 'LOSS', color: '#f97316' },
  { id: 9, tier: 'close-win', label: 'CLOSE', color: '#84cc16' },
  { id: 10, tier: 'close-loss', label: 'ALMOST', color: '#eab308' },
  { id: 11, tier: 'loss', label: 'LOSS', color: '#f97316' },
  { id: 12, tier: 'catastrophic', label: '☠', color: '#ef4444' }
];

export default function WheelOfFortune({ onResult, baseAmount, context, spectator = false }: WheelOfFortuneProps) {
  const { play } = useAudio();
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [canSpin, setCanSpin] = useState(true);
  const spinTriggeredRef = useRef(false);

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
    }, 3500);
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

  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;
  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  return (
    <div className="wheelOfFortune pixelMinigame">
      <h2 className="wheelTitle">WHEEL OF FORTUNE</h2>

      <div className="wheelContainer" style={{ width: size + 40, height: size + 60, position: 'relative', margin: '0 auto' }}>
        <div style={{
          position: 'absolute',
          top: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '28px',
          zIndex: 10,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          lineHeight: 1,
        }}>
          ▼
        </div>

        <svg
          width={size + 20}
          height={size + 20}
          viewBox={`-10 -10 ${size + 20} ${size + 20}`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3.5s cubic-bezier(0.15, 0.6, 0.35, 1)' : 'none',
          }}
        >
          <circle cx={cx} cy={cy} r={radius + 3} fill="none" stroke="#8b7320" strokeWidth="6" />

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

            return (
              <g key={seg.id}>
                <path d={path} fill={seg.color} stroke="#1a0f0f" strokeWidth="2" />
                <text
                  x={tx} y={ty}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#fff" fontSize="9" fontWeight="bold"
                  fontFamily="'Press Start 2P', monospace"
                  transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                  style={{ textShadow: '1px 1px 0 #000' } as any}
                >
                  {seg.label}
                </text>
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={20} fill="#1a0f0f" stroke="#d4af37" strokeWidth="3" />
          <circle cx={cx} cy={cy} r={8} fill="#d4af37" />
        </svg>

        {canSpin && !spinning && !result && (
          <button
            className="wheelSpinBtn pixelBtn"
            onClick={spinWheel}
            disabled={spectator}
            style={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            SPIN
          </button>
        )}

        {result && (
          <div className="wheelResult" style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}>
            <div style={{ color: '#aaa', fontSize: '0.6rem', fontFamily: "'Press Start 2P', monospace" }}>RESULT:</div>
            <div style={{ color: result.color, fontSize: '0.9rem', fontFamily: "'Press Start 2P', monospace", fontWeight: 'bold' }}>{result.label}</div>
          </div>
        )}
      </div>

      <div className="wheelLegend">
        <div className="legendRow"><span className="legendColor" style={{ backgroundColor: '#4ade80' }}></span>WIN</div>
        <div className="legendRow"><span className="legendColor" style={{ backgroundColor: '#84cc16' }}></span>CLOSE WIN</div>
        <div className="legendRow"><span className="legendColor" style={{ backgroundColor: '#eab308' }}></span>CLOSE LOSS</div>
        <div className="legendRow"><span className="legendColor" style={{ backgroundColor: '#f97316' }}></span>LOSS</div>
        <div className="legendRow"><span className="legendColor" style={{ backgroundColor: '#ef4444' }}></span>DISASTER</div>
      </div>
    </div>
  );
}
