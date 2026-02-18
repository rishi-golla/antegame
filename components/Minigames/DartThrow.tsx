'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface LuckyNumberProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

export default function LuckyNumber({ onResult }: LuckyNumberProps) {
  const { play } = useAudio();
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [houseNumber, setHouseNumber] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!done) onResult('catastrophic');
    }, 30000);
    return () => clearTimeout(timer);
  }, [done, onResult]);

  const lockIn = useCallback(() => {
    if (selected === null || locked) return;
    play('minigames/dart-throw');
    setLocked(true);
    const house = Math.floor(Math.random() * 10) + 1;
    setHouseNumber(house);
    setCountdown(3);
  }, [selected, locked]);

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

  return (
    <div className="luckyNumber pixelMinigame">
      <h2 className="luckyNumberTitle">LUCKY NUMBER</h2>

      {!locked && (
        <>
          <div className="luckyNumberGrid">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className={`luckyChip pixelBtn ${selected === n ? 'luckyChipSelected' : ''}`}
                onClick={() => setSelected(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {selected !== null && (
            <button className="luckyLockBtn pixelBtn" onClick={lockIn}>
              LOCK IN
            </button>
          )}
        </>
      )}

      {locked && !revealed && countdown !== null && countdown > 0 && (
        <div className="luckyCountdown">{countdown}</div>
      )}

      {revealed && (
        <div className="luckyReveal">
          <div className="luckyRevealSide">
            <div className="luckyRevealLabel">YOU</div>
            <div className="luckyRevealNumber">{selected}</div>
          </div>
          <div className="luckyRevealVs">vs</div>
          <div className="luckyRevealSide">
            <div className="luckyRevealLabel">HOUSE</div>
            <div className="luckyRevealNumber">{houseNumber}</div>
          </div>
        </div>
      )}

      {diff !== null && (
        <div className="luckyDiff">
          {diff === 0 ? 'EXACT MATCH!' : `OFF BY ${diff}`}
        </div>
      )}

      <div className="luckyPaytable">
        <div className="paytableRow">EXACT = WIN</div>
        <div className="paytableRow">OFF BY 1 = CLOSE WIN</div>
        <div className="paytableRow">OFF BY 2 = CLOSE LOSS</div>
        <div className="paytableRow">OFF BY 3-4 = LOSS</div>
      </div>
    </div>
  );
}
