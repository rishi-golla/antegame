'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface WheelOfFortuneProps {
  onResult: (tier: MinigameTier) => void;
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
  { id: 2, tier: 'close-win', label: 'CLOSE WIN', color: '#84cc16' },
  { id: 3, tier: 'close-loss', label: 'CLOSE LOSS', color: '#eab308' },
  { id: 4, tier: 'loss', label: 'LOSS', color: '#f97316' },
  { id: 5, tier: 'win', label: 'WIN', color: '#4ade80' },
  { id: 6, tier: 'close-win', label: 'CLOSE WIN', color: '#84cc16' },
  { id: 7, tier: 'close-loss', label: 'CLOSE LOSS', color: '#eab308' },
  { id: 8, tier: 'loss', label: 'LOSS', color: '#f97316' },
  { id: 9, tier: 'close-win', label: 'CLOSE WIN', color: '#84cc16' },
  { id: 10, tier: 'close-loss', label: 'CLOSE LOSS', color: '#eab308' },
  { id: 11, tier: 'loss', label: 'LOSS', color: '#f97316' },
  { id: 12, tier: 'catastrophic', label: 'DISASTER', color: '#ef4444' }
];

export default function WheelOfFortune({ onResult, baseAmount, context }: WheelOfFortuneProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [canSpin, setCanSpin] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => { if (canSpin) onResult('catastrophic'); }, 15000);
    return () => clearTimeout(timer);
  }, [onResult, canSpin]);

  const spinWheel = () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setCanSpin(false);

    const baseRotations = 3 + Math.random() * 3;
    const finalPosition = Math.random() * 360;
    const totalRotation = rotation + (baseRotations * 360) + finalPosition;
    setRotation(totalRotation);

    const segmentAngle = 360 / 12;
    const normalizedAngle = (360 - (totalRotation % 360)) % 360;
    const segmentIndex = Math.floor(normalizedAngle / segmentAngle);
    const selectedSegment = WHEEL_SEGMENTS[segmentIndex];

    setTimeout(() => {
      setSpinning(false);
      setResult(selectedSegment);
      setTimeout(() => { onResult(selectedSegment.tier); }, 1500);
    }, 3000);
  };

  return (
    <div className="wheelOfFortune pixelMinigame">
      <div className="wheelHeader">
        <h2 className="wheelTitle">WHEEL OF FORTUNE</h2>
      </div>

      <div className="wheelContainer">
        <div className="wheelPointerWrap">
          <img src="/assets/minigames/wheel/wheel-pointer.png" alt="pointer" className="wheelPointerImg" />
        </div>

        <div className="wheelImgWrap" style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 3s steps(60)' : 'none'
        }}>
          <img src="/assets/minigames/wheel/wheel.png" alt="wheel" className="wheelImg" />
        </div>

        <div className="wheelStandWrap">
          <img src="/assets/minigames/wheel/wheel-stand.png" alt="stand" className="wheelStandImg" />
        </div>

        {canSpin && !spinning && !result && (
          <button className="wheelSpinBtn pixelBtn" onClick={spinWheel}>SPIN</button>
        )}

        {result && (
          <div className="wheelResult">
            <div className="wheelResultLabel">RESULT:</div>
            <div className="wheelResultValue" style={{ color: result.color }}>{result.label}</div>
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
