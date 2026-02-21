'use client';

import { useEffect, useRef } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface MinigameResultProps {
  tier: MinigameTier;
  baseAmount: number;
  context: MinigameContext;
  onDismiss: () => void;
}

export default function MinigameResult({ tier, baseAmount, context, onDismiss }: MinigameResultProps) {
  const { play } = useAudio();
  const hasPlayed = useRef(false);

  const multipliers: Record<MinigameTier, number> = {
    'win': 0, 'close-win': 0.5, 'close-loss': 1.5, 'loss': 2, 'catastrophic': 5
  };
  const amount = Math.floor(baseAmount * multipliers[tier]);

  const info: Record<MinigameTier, { title: string; description: string }> = {
    'win': { title: 'JACKPOT!', description: context === 'buying' ? 'FREE PROPERTY!' : 'NO RENT!' },
    'close-win': { title: 'CLOSE WIN!', description: context === 'buying' ? '50% PRICE' : '50% RENT' },
    'close-loss': { title: 'CLOSE CALL', description: '150% PENALTY' },
    'loss': { title: 'YOU LOST', description: '200% PENALTY' },
    'catastrophic': { title: 'DISASTER!', description: '500% PENALTY' },
  };

  const { title, description } = info[tier];

  // Play tier sound on mount
  useEffect(() => {
    if (!hasPlayed.current) {
      hasPlayed.current = true;
      play(`minigames/tier-${tier}`, { volume: 0.6 });
    }
  }, [tier, play]);

  return (
    <div className={`minigameResult tier-${tier}`}>
      {/* Win: golden light rays behind card */}
      {tier === 'win' && (
        <>
          <div className="jackpotRays" />
          <div className="jackpotFlash" />
        </>
      )}

      {/* Win: proper confetti ribbons */}
      {tier === 'win' && (
        <div className="jackpotConfetti">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="confettiRibbon" style={{
              left: `${(i / 40) * 100 + (Math.random() * 2.5 - 1.25)}%`,
              animationDelay: `${Math.random() * 1.5}s`,
              animationDuration: `${2.5 + Math.random() * 2}s`,
              '--ribbon-color': ['#FFD700', '#FF6B6B', '#4ade80', '#60a5fa', '#f59e0b', '#c084fc', '#fb7185', '#34d399'][i % 8],
              '--ribbon-rot': `${Math.random() * 360}deg`,
              '--ribbon-drift': `${Math.random() * 60 - 30}px`,
            } as React.CSSProperties} />
          ))}
        </div>
      )}

      {/* Close-win sparkles */}
      {tier === 'close-win' && (
        <div className="pixelSparkles">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="sparkleStar" style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 1.5}s`,
            }} />
          ))}
        </div>
      )}

      {/* Catastrophic red vignette */}
      {tier === 'catastrophic' && <div className="catastrophicVignette" />}

      <div className="minigameResultCard">
        {/* Animated border glow for win */}
        {tier === 'win' && <div className="jackpotBorderGlow" />}

        <h2 className="minigameResultTitle">{title}</h2>
        <p className="minigameResultDesc">{description}</p>
        {tier !== 'win' && (
          <div className="minigameResultAmount">
            <span className="minigameResultAmountLabel">BASE:</span>
            <span className="minigameResultAmountValue">${baseAmount}</span>
          </div>
        )}
        <button className="minigameResultBtn" onClick={onDismiss}>CONTINUE</button>
      </div>
    </div>
  );
}
