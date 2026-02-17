'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface DartThrowProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

interface DartPosition {
  x: number;
  y: number;
}

const DARTBOARD_SIZE = 200;
const CENTER_X = DARTBOARD_SIZE / 2;
const CENTER_Y = DARTBOARD_SIZE / 2;

export default function DartThrow({ onResult, baseAmount, context }: DartThrowProps) {
  const [crosshairX, setCrosshairX] = useState(CENTER_X);
  const [crosshairY, setCrosshairY] = useState(CENTER_Y);
  const [oscillating, setOscillating] = useState(false);
  const [thrown, setThrown] = useState(false);
  const [dartPosition, setDartPosition] = useState<DartPosition | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    // 15-second timeout
    const timer = setTimeout(() => {
      if (!thrown) {
        onResult('catastrophic');
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (oscillating && !thrown) {
      const oscillateInterval = setInterval(() => {
        // Horizontal oscillation
        setCrosshairX(prev => {
          const newX = prev + (Math.random() - 0.5) * 8;
          return Math.max(20, Math.min(DARTBOARD_SIZE - 20, newX));
        });

        // Vertical oscillation
        setCrosshairY(prev => {
          const newY = prev + (Math.random() - 0.5) * 8;
          return Math.max(20, Math.min(DARTBOARD_SIZE - 20, newY));
        });
      }, 100);

      return () => clearInterval(oscillateInterval);
    }
  }, [oscillating, thrown]);

  const startOscillation = () => {
    if (thrown) return;
    setOscillating(true);
  };

  const throwDart = () => {
    if (!oscillating || thrown) return;

    setThrown(true);
    setOscillating(false);
    setDartPosition({ x: crosshairX, y: crosshairY });

    // Calculate distance from center
    const distance = Math.sqrt(
      Math.pow(crosshairX - CENTER_X, 2) + Math.pow(crosshairY - CENTER_Y, 2)
    );

    // Calculate result based on distance
    let hitResult: string;
    let tier: MinigameTier;

    if (distance <= 15) {
      // Bullseye
      hitResult = 'BULLSEYE!';
      tier = 'win';
    } else if (distance <= 35) {
      // Inner ring
      hitResult = 'Inner Ring';
      tier = 'close-win';
    } else if (distance <= 60) {
      // Outer ring
      hitResult = 'Outer Ring';
      tier = 'close-loss';
    } else if (distance <= 90) {
      // Edge
      hitResult = 'Edge Hit';
      tier = 'loss';
    } else {
      // Complete miss
      hitResult = 'Complete Miss!';
      tier = 'catastrophic';
    }

    setResult(hitResult);

    setTimeout(() => {
      onResult(tier);
    }, 1500);
  };

  return (
    <div className="dartThrow">
      <div className="dartHeader">
        <h2 className="dartTitle">DART THROW</h2>
        {result && (
          <div className="dartResult">{result}</div>
        )}
      </div>

      <div className="dartContainer">
        <div className="dartboard">
          {/* Dartboard rings */}
          <div className="dartboardRing bullseye"></div>
          <div className="dartboardRing inner"></div>
          <div className="dartboardRing outer"></div>
          <div className="dartboardRing edge"></div>

          {/* Crosshair */}
          {!thrown && (
            <div 
              className={`crosshair ${oscillating ? 'oscillating' : ''}`}
              style={{
                left: crosshairX - 10,
                top: crosshairY - 10
              }}
            >
              ✕
            </div>
          )}

          {/* Thrown dart */}
          {thrown && dartPosition && (
            <div 
              className="dart"
              style={{
                left: dartPosition.x - 5,
                top: dartPosition.y - 5
              }}
            >
              🎯
            </div>
          )}

          {/* Dartboard labels */}
          <div className="dartboardLabel bullseyeLabel">BULLSEYE</div>
          <div className="dartboardLabel innerLabel">INNER</div>
          <div className="dartboardLabel outerLabel">OUTER</div>
          <div className="dartboardLabel edgeLabel">EDGE</div>
        </div>
      </div>

      <div className="dartControls">
        {!oscillating && !thrown && (
          <button className="dartBtn oscillateBtn" onClick={startOscillation}>
            START AIMING
          </button>
        )}
        
        {oscillating && !thrown && (
          <button className="dartBtn throwBtn" onClick={throwDart}>
            THROW DART!
          </button>
        )}
      </div>

      <div className="dartInstructions">
        {!oscillating ? (
          'Click START AIMING to begin!'
        ) : !thrown ? (
          'Crosshair is moving - click THROW DART when ready!'
        ) : (
          `You hit: ${result}`
        )}
      </div>

      <div className="dartPaytable">
        <div className="paytableRow">🎯 Bullseye = WIN</div>
        <div className="paytableRow">Inner ring = CLOSE WIN</div>
        <div className="paytableRow">Outer ring = CLOSE LOSS</div>
        <div className="paytableRow">Edge = LOSS</div>
        <div className="paytableRow">Complete miss = CATASTROPHIC</div>
      </div>
    </div>
  );
}