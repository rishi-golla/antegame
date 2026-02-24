'use client';

import { useEffect, useRef, useState } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface MinigameResultProps {
  tier: MinigameTier;
  baseAmount: number;
  context: MinigameContext;
  onDismiss: () => void;
  /** Card Shark buff discount rate (0.0 - 1.0), applied to loss penalties */
  minigameBoost?: number;
}

function useCountUp(target: number, duration = 600, startDelay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let raf: number;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.floor(eased * target));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, startDelay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, startDelay]);
  return value;
}

const TIERS: Record<MinigameTier, {
  label: string;
  subtitle: Record<MinigameContext, string>;
  color: string;
  bg: string;
  accent: string;
}> = {
  win: {
    label: 'Jackpot!',
    subtitle: { buying: 'Property is yours — FREE!', rent: 'Rent dodged!' },
    color: '#ffd700',
    bg: 'linear-gradient(180deg, #1a2e1a 0%, #0f1a0f 100%)',
    accent: '#4ade80',
  },
  'close-win': {
    label: 'Close Win',
    subtitle: { buying: 'Property at half price!', rent: 'Half rent' },
    color: '#4ade80',
    bg: 'linear-gradient(180deg, #162e22 0%, #0f1a14 100%)',
    accent: '#4ade80',
  },
  'close-loss': {
    label: 'Close Call',
    subtitle: { buying: 'No property — penalty!', rent: '1.5× rent' },
    color: '#fbbf24',
    bg: 'linear-gradient(180deg, #2e2210 0%, #1a150a 100%)',
    accent: '#f59e0b',
  },
  loss: {
    label: 'You Lost',
    subtitle: { buying: 'No property — double penalty!', rent: 'Double rent' },
    color: '#f87171',
    bg: 'linear-gradient(180deg, #2e1414 0%, #1a0c0c 100%)',
    accent: '#ef4444',
  },
  catastrophic: {
    label: 'Disaster',
    subtitle: { buying: 'No property — 5× penalty!', rent: '5× rent!' },
    color: '#ef4444',
    bg: 'linear-gradient(180deg, #1a0808 0%, #0d0404 100%)',
    accent: '#dc2626',
  },
};

export default function MinigameResult({ tier, baseAmount, context, onDismiss, minigameBoost = 0 }: MinigameResultProps) {
  const { play } = useAudio();
  const hasPlayed = useRef(false);
  const [visible, setVisible] = useState(false);

  const multipliers: Record<MinigameTier, number> = {
    win: 0, 'close-win': 0.5, 'close-loss': 1.5, loss: 2, catastrophic: 5,
  };
  let amount = Math.floor(baseAmount * multipliers[tier]);
  // Match server logic: Card Shark buff reduces loss penalties
  const isLossTier = tier === 'close-loss' || tier === 'loss' || tier === 'catastrophic';
  if (minigameBoost > 0 && isLossTier) {
    if (context === 'buying') {
      // Buying: buff applies to all loss tiers
      amount = Math.floor(amount * (1 - minigameBoost));
    } else if (context === 'rent') {
      // Rent: buff applies to close-loss, loss, catastrophic
      amount = Math.floor(amount * (1 - minigameBoost));
    }
  }
  const displayAmount = useCountUp(amount, 600, 400);
  const config = TIERS[tier];
  const isGood = tier === 'win' || tier === 'close-win';

  useEffect(() => {
    if (!hasPlayed.current) {
      hasPlayed.current = true;
      play(`minigames/tier-${tier}`, { volume: 0.6 });
    }
  }, [tier, play]);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 300);
    const t2 = setTimeout(onDismiss, 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  return (
    <>
      <style>{`
        @keyframes mgr-in {
          0% { opacity: 0; transform: translateY(20px) scale(0.95) }
          100% { opacity: 1; transform: translateY(0) scale(1) }
        }
        @keyframes mgr-bar { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes mgr-glow {
          0%, 100% { box-shadow: 0 0 20px var(--glow), 0 12px 40px rgba(0,0,0,0.5) }
          50% { box-shadow: 0 0 35px var(--glow), 0 12px 40px rgba(0,0,0,0.5) }
        }
        @keyframes mgr-num {
          0% { opacity: 0; transform: translateY(10px) }
          100% { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: visible ? 'rgba(0,0,0,0.7)' : '#000',
        backdropFilter: visible ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: visible ? 'blur(8px)' : 'none',
        transition: 'background 0.4s ease, backdrop-filter 0.4s ease',
        cursor: 'pointer',
      }} onClick={onDismiss}>

        {visible && (
          <div
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              ['--glow' as string]: `${config.accent}40`,
              width: 320, maxWidth: '90vw',
              background: config.bg,
              borderRadius: 16,
              border: `1.5px solid ${config.accent}50`,
              overflow: 'hidden',
              position: 'relative',
              animation: 'mgr-in 0.45s cubic-bezier(0.16, 1, 0.3, 1), mgr-glow 3s ease-in-out 0.5s infinite',
              willChange: 'transform, opacity',
            } as React.CSSProperties}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              textAlign: 'center',
              borderBottom: `1px solid ${config.accent}20`,
            }}>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: 28,
                fontWeight: 900,
                color: config.color,
                letterSpacing: 1,
                textShadow: `0 0 20px ${config.accent}60`,
                marginBottom: 4,
              }}>
                {config.label}
              </div>
              <div style={{
                fontFamily: 'Nunito, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                color: `${config.color}99`,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}>
                {config.subtitle[context]}
              </div>
            </div>

            {/* Amount */}
            <div style={{
              padding: '24px 24px 28px',
              textAlign: 'center',
            }}>
              {tier === 'win' ? (
                <div style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: 36,
                  fontWeight: 900,
                  color: '#ffd700',
                  textShadow: '0 0 20px rgba(255,215,0,0.4)',
                }}>
                  {context === 'buying' ? 'FREE' : '$0'}
                </div>
              ) : (
                <>
                  <div style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: 42,
                    fontWeight: 900,
                    color: config.color,
                    textShadow: `0 0 16px ${config.accent}50`,
                    animation: 'mgr-num 0.4s ease-out 0.3s both',
                    letterSpacing: 1,
                  }}>
                    ${displayAmount}
                  </div>

                  {/* Original → new */}
                  <div style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: 13,
                    color: 'rgba(200,180,150,0.5)',
                    marginTop: 8,
                  }}>
                    <span style={{ textDecoration: 'line-through' }}>${baseAmount}</span>
                    <span style={{ color: config.color, opacity: 0.7, marginLeft: 8 }}>
                      {multipliers[tier]}×
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
              background: 'rgba(255,255,255,0.05)',
            }}>
              <div style={{
                height: '100%',
                background: config.accent,
                opacity: 0.5,
                transformOrigin: 'left',
                animation: 'mgr-bar 2.5s linear forwards',
              }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
