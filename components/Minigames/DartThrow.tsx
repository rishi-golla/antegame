'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface DartThrowProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

interface DartPosition { x: number; y: number; }

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
    const timer = setTimeout(() => { if (!thrown) onResult('catastrophic'); }, 15000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (oscillating && !thrown) {
      const oscillateInterval = setInterval(() => {
        setCrosshairX(prev => Math.max(20, Math.min(DARTBOARD_SIZE - 20, prev + (Math.random() - 0.5) * 8)));
        setCrosshairY(prev => Math.max(20, Math.min(DARTBOARD_SIZE - 20, prev + (Math.random() - 0.5) * 8)));
      }, 100);
      return () => clearInterval(oscillateInterval);
    }
  }, [oscillating, thrown]);

  const startOscillation = () => { if (!thrown) setOscillating(true); };

  const throwDart = () => {
    if (!oscillating || thrown) return;
    setThrown(true);
    setOscillating(false);
    setDartPosition({ x: crosshairX, y: crosshairY });

    const distance = Math.sqrt(Math.pow(crosshairX - CENTER_X, 2) + Math.pow(crosshairY - CENTER_Y, 2));
    let hitResult: string;
    let tier: MinigameTier;

    if (distance <= 15) { hitResult = 'BULLSEYE!'; tier = 'win'; }
    else if (distance <= 35) { hitResult = 'INNER RING'; tier = 'close-win'; }
    else if (distance <= 60) { hitResult = 'OUTER RING'; tier = 'close-loss'; }
    else if (distance <= 90) { hitResult = 'EDGE HIT'; tier = 'loss'; }
    else { hitResult = 'COMPLETE MISS!'; tier = 'catastrophic'; }

    setResult(hitResult);
    setTimeout(() => onResult(tier), 1500);
  };

  return (
    <div className="dartThrow pixelMinigame">
      <div className="dartHeader">
        <h2 className="dartTitle">DART THROW</h2>
        {result && <div className="dartResult">{result}</div>}
      </div>

      <div className="dartContainer">
        <div className="dartboard">
          <img src="/assets/minigames/darts/dartboard.png" alt="dartboard" className="dartboardImg" />

          {!thrown && (
            <div className={`crosshair ${oscillating ? 'oscillating' : ''}`}
              style={{ left: crosshairX - 10, top: crosshairY - 10 }}>
              ✕
            </div>
          )}

          {thrown && dartPosition && (
            <div className="dart" style={{ left: dartPosition.x - 16, top: dartPosition.y - 16 }}>
              <img src="/assets/minigames/darts/dart.png" alt="dart" className="dartImg" />
            </div>
          )}
        </div>
      </div>

      <div className="dartControls">
        {!oscillating && !thrown && (
          <button className="dartBtn oscillateBtn pixelBtn" onClick={startOscillation}>START AIMING</button>
        )}
        {oscillating && !thrown && (
          <button className="dartBtn throwBtn pixelBtn" onClick={throwDart}>THROW DART!</button>
        )}
      </div>

      <div className="dartInstructions">
        {!oscillating ? 'CLICK START AIMING!' : !thrown ? 'CLICK THROW WHEN READY!' : `HIT: ${result}`}
      </div>

      <div className="dartPaytable">
        <div className="paytableRow">BULLSEYE = WIN</div>
        <div className="paytableRow">INNER = CLOSE WIN</div>
        <div className="paytableRow">OUTER = CLOSE LOSS</div>
        <div className="paytableRow">EDGE = LOSS</div>
      </div>
    </div>
  );
}
