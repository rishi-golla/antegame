'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import CutsceneSprite from './CutsceneSprite';
import CutsceneTile from './CutsceneTile';
import { TILES } from '@/lib/gameData';

interface CutsceneOverlayProps {
  playerColor: string;
  playerName: string;
  steps: number[]; // tile indices the player passes through (including destination)
  onComplete: () => void;
}

const MS_PER_TILE = 375;
const TILE_WIDTH = 120;

export default function CutsceneOverlay({ playerColor, playerName, steps, onComplete }: CutsceneOverlayProps) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not started
  const [spriteState, setSpriteState] = useState<'running' | 'landing' | 'idle'>('idle');
  const [fading, setFading] = useState(false);
  const [goFlashTiles, setGoFlashTiles] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const totalDuration = steps.length * MS_PER_TILE;

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSpriteState('landing');
    setTimeout(() => {
      setFading(true);
      setTimeout(() => {
        onComplete();
      }, 300);
    }, 400);
  }, [onComplete]);

  useEffect(() => {
    if (steps.length === 0) {
      onComplete();
      return;
    }

    // Start running
    setSpriteState('running');
    setCurrentStep(0);

    // Check for GO tile (index 0) in steps for green flash
    const goIndices = new Set<number>();
    steps.forEach((tileIdx, i) => {
      if (tileIdx === 0 && i < steps.length - 1) {
        goIndices.add(i);
      }
    });
    setGoFlashTiles(goIndices);

    // Advance through steps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= steps.length) {
        clearInterval(interval);
        finish();
        return;
      }
      setCurrentStep(step);
    }, MS_PER_TILE);

    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera offset: keep sprite centered by translating the scene
  const cameraX = currentStep >= 0 ? -(currentStep * TILE_WIDTH) : 0;
  // Easing: apply CSS transition on the container
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={`cutsceneOverlay ${fading ? 'cutsceneFadeOut' : 'cutsceneFadeIn'}`}>
      <div className="cutsceneBackdrop" />

      {/* Player name banner */}
      <div className="cutscenePlayerBanner" style={{ color: playerColor }}>
        {playerName}
      </div>

      {/* Scene container */}
      <div className="cutsceneViewport">
        <div
          className="cutsceneScene"
          style={{
            transform: `translateX(calc(50% - ${TILE_WIDTH / 2}px + ${cameraX}px))`,
            transition: currentStep <= 0
              ? 'none'
              : `transform ${MS_PER_TILE}ms ${isLastStep ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'linear'}`,
          }}
        >
          {steps.map((tileIdx, i) => (
            <CutsceneTile
              key={`${i}-${tileIdx}`}
              tile={TILES[tileIdx]}
              isLanding={i === steps.length - 1 && spriteState === 'landing'}
              isGoPassing={goFlashTiles.has(i) && currentStep >= i}
            />
          ))}

          {/* Sprite positioned at current step */}
          <div
            className="cutsceneSpriteContainer"
            style={{
              transform: `translateX(${(currentStep >= 0 ? currentStep : 0) * TILE_WIDTH + TILE_WIDTH / 2 - 20}px)`,
              transition: currentStep <= 0
                ? 'none'
                : `transform ${MS_PER_TILE}ms ${isLastStep ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'linear'}`,
            }}
          >
            <CutsceneSprite color={playerColor} state={spriteState} />
          </div>
        </div>
      </div>
    </div>
  );
}
