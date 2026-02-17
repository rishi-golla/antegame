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
    // 15-second timeout
    const timer = setTimeout(() => {
      if (canSpin) {
        onResult('catastrophic');
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [onResult, canSpin]);

  const spinWheel = () => {
    if (spinning || !canSpin) return;

    setSpinning(true);
    setCanSpin(false);

    // Calculate final rotation (3-6 full spins plus random position)
    const baseRotations = 3 + Math.random() * 3; // 3-6 full rotations
    const finalPosition = Math.random() * 360; // Random final position
    const totalRotation = rotation + (baseRotations * 360) + finalPosition;
    
    setRotation(totalRotation);

    // Calculate which segment we landed on
    // Each segment is 30 degrees (360 / 12 segments)
    const segmentAngle = 360 / 12;
    const normalizedAngle = (360 - (totalRotation % 360)) % 360; // Reverse because wheel spins clockwise
    const segmentIndex = Math.floor(normalizedAngle / segmentAngle);
    const selectedSegment = WHEEL_SEGMENTS[segmentIndex];

    // Wait for spin animation to complete
    setTimeout(() => {
      setSpinning(false);
      setResult(selectedSegment);
      
      setTimeout(() => {
        onResult(selectedSegment.tier);
      }, 1500);
    }, 3000);
  };

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  return (
    <div className="wheelOfFortune">
      <div className="wheelHeader">
        <h2 className="wheelTitle">WHEEL OF FORTUNE</h2>
      </div>

      <div className="wheelContainer">
        <div className="wheelPointer">▼</div>
        
        <div 
          className={`wheel ${spinning ? 'spinning' : ''}`}
          style={{ 
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none'
          }}
        >
          {WHEEL_SEGMENTS.map((segment, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            
            // Calculate path for SVG segment
            const centerX = 150;
            const centerY = 150;
            const radius = 140;
            const innerRadius = 20;
            
            const startAngleRad = (startAngle - 90) * (Math.PI / 180);
            const endAngleRad = (endAngle - 90) * (Math.PI / 180);
            
            const x1 = centerX + Math.cos(startAngleRad) * innerRadius;
            const y1 = centerY + Math.sin(startAngleRad) * innerRadius;
            const x2 = centerX + Math.cos(startAngleRad) * radius;
            const y2 = centerY + Math.sin(startAngleRad) * radius;
            
            const x3 = centerX + Math.cos(endAngleRad) * radius;
            const y3 = centerY + Math.sin(endAngleRad) * radius;
            const x4 = centerX + Math.cos(endAngleRad) * innerRadius;
            const y4 = centerY + Math.sin(endAngleRad) * innerRadius;
            
            const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
            
            const pathData = [
              `M ${x1} ${y1}`,
              `L ${x2} ${y2}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x3} ${y3}`,
              `L ${x4} ${y4}`,
              `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}`,
              'Z'
            ].join(' ');

            // Calculate text position
            const textAngle = (startAngle + endAngle) / 2;
            const textRadius = (radius + innerRadius) / 2;
            const textAngleRad = (textAngle - 90) * (Math.PI / 180);
            const textX = centerX + Math.cos(textAngleRad) * textRadius;
            const textY = centerY + Math.sin(textAngleRad) * textRadius;

            return (
              <g key={segment.id}>
                <path
                  d={pathData}
                  fill={segment.color}
                  stroke="#2a1810"
                  strokeWidth="2"
                />
                <text
                  x={textX}
                  y={textY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="'Press Start 2P', monospace"
                  transform={`rotate(${textAngle}, ${textX}, ${textY})`}
                >
                  {segment.label}
                </text>
              </g>
            );
          })}
        </div>

        {canSpin && !spinning && !result && (
          <button className="wheelSpinBtn" onClick={spinWheel}>
            SPIN
          </button>
        )}

        {result && (
          <div className="wheelResult">
            <div className="wheelResultLabel">Result:</div>
            <div className="wheelResultValue" style={{ color: result.color }}>
              {result.label}
            </div>
          </div>
        )}
      </div>

      <div className="wheelLegend">
        <div className="legendRow">
          <span className="legendColor" style={{ backgroundColor: '#4ade80' }}></span>
          2 × WIN
        </div>
        <div className="legendRow">
          <span className="legendColor" style={{ backgroundColor: '#84cc16' }}></span>
          3 × CLOSE WIN
        </div>
        <div className="legendRow">
          <span className="legendColor" style={{ backgroundColor: '#eab308' }}></span>
          3 × CLOSE LOSS
        </div>
        <div className="legendRow">
          <span className="legendColor" style={{ backgroundColor: '#f97316' }}></span>
          3 × LOSS
        </div>
        <div className="legendRow">
          <span className="legendColor" style={{ backgroundColor: '#ef4444' }}></span>
          1 × CATASTROPHIC
        </div>
      </div>
    </div>
  );
}