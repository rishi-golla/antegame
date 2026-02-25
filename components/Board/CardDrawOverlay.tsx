'use client';

import { useState, useEffect, useRef } from 'react';
import type { Card } from '@/types/game';

interface CardDrawOverlayProps {
  card: Card;
  onDismiss: () => void;
}

function getEffectLabel(card: Card): string {
  const e = card.effect as any;
  switch (e.kind) {
    case 'collect': return `Collect $${e.amount}`;
    case 'pay': return `Pay $${e.amount}`;
    case 'collect-from-each': return `Collect $${e.amount} from each player`;
    case 'pay-each-player': return `Pay $${e.amount} to each player`;
    case 'repairs': return `House: $${e.houseCost} · Hotel: $${e.hotelCost}`;
    case 'go-to-jail': return 'Go to Jail';
    case 'get-out-of-jail': return 'Keep this card';
    case 'move-to': return 'Advance';
    case 'move-relative': return e.amount > 0 ? `Move forward ${e.amount}` : `Move back ${Math.abs(e.amount)}`;
    case 'nearest-railroad': return 'Advance to nearest Rail';
    case 'nearest-utility': return 'Advance to nearest Utility';
    default: return '';
  }
}

function isGoodCard(kind: string): boolean {
  return ['collect', 'collect-from-each', 'get-out-of-jail'].includes(kind);
}

export default function CardDrawOverlay({ card, onDismiss }: CardDrawOverlayProps) {
  const [phase, setPhase] = useState<'deck' | 'flip' | 'reveal'>('deck');
  const isRisk = card.deckType === 'chance';
  const good = isGoodCard(card.effect.kind);

  // Colors
  const accent = isRisk ? '#dc2626' : '#7c3aed';
  const accentSoft = isRisk ? '#fca5a5' : '#c4b5fd';
  const accentBg = isRisk
    ? 'linear-gradient(180deg, #4a0e0e 0%, #2d0808 100%)'
    : 'linear-gradient(180deg, #2d1a4e 0%, #1a0e30 100%)';

  // Use ref to avoid resetting timers when parent re-renders with new onDismiss identity
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flip'), 200);
    const t2 = setTimeout(() => setPhase('reveal'), 550);
    const t3 = setTimeout(() => onDismissRef.current(), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const effectLabel = getEffectLabel(card);

  return (
    <>
      <style>{`
        @keyframes cdo-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cdo-flipIn {
          0% { transform: rotateY(180deg) scale(0.8); opacity: 0 }
          60% { transform: rotateY(-5deg) scale(1.02) }
          100% { transform: rotateY(0deg) scale(1); opacity: 1 }
        }
        @keyframes cdo-textIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes cdo-progress { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes cdo-shimmer { 0% { left: -60% } 100% { left: 120% } }
      `}</style>

      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'cdo-fadeIn 0.25s ease-out',
          cursor: 'pointer',
        }}
      >
        {/* Card back (deck phase) */}
        {phase === 'deck' && (
          <div style={{
            width: 220, height: 310, borderRadius: 14,
            background: accentBg,
            border: `2px solid ${accent}55`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.6)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'cdo-fadeIn 0.15s ease-out',
          }}>
            <div style={{
              fontFamily: 'Cinzel, serif', fontSize: 20, fontWeight: 900,
              color: `${accent}66`, letterSpacing: 2,
              transform: 'rotate(-8deg)',
            }}>
              {isRisk ? 'RISK' : 'BLIND'}
            </div>
          </div>
        )}

        {/* Card face */}
        {(phase === 'flip' || phase === 'reveal') && (
          <div
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              width: 260, maxWidth: '85vw',
              borderRadius: 14,
              background: '#0f0a0a',
              border: `2px solid ${accent}44`,
              boxShadow: `0 0 40px ${accent}15, 0 16px 48px rgba(0,0,0,0.7)`,
              overflow: 'hidden',
              animation: 'cdo-flipIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              perspective: 1000,
              position: 'relative',
            }}
          >
            {/* Header stripe */}
            <div style={{
              padding: '12px 20px 10px',
              background: accentBg,
              borderBottom: `1px solid ${accent}33`,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: 13,
                fontWeight: 800,
                color: accentSoft,
                letterSpacing: 4,
                textTransform: 'uppercase',
              }}>
                {isRisk ? 'Risk' : 'Blind Chest'}
              </div>
            </div>

            {/* Body */}
            <div style={{
              padding: '24px 24px 20px',
              textAlign: 'center',
              opacity: phase === 'reveal' ? 1 : 0,
              animation: phase === 'reveal' ? 'cdo-textIn 0.3s ease-out forwards' : undefined,
            }}>
              {/* Card text — the main message */}
              <p style={{
                fontFamily: 'Nunito, sans-serif',
                fontSize: 16,
                fontWeight: 600,
                color: '#e8dcc8',
                lineHeight: 1.55,
                margin: '0 0 18px',
              }}>
                {card.text}
              </p>

              {/* Effect pill */}
              <div style={{
                display: 'inline-block',
                padding: '6px 16px',
                borderRadius: 20,
                background: good
                  ? 'rgba(74, 222, 128, 0.12)'
                  : `${accent}18`,
                border: `1px solid ${good ? 'rgba(74, 222, 128, 0.25)' : `${accent}30`}`,
              }}>
                <span style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 13,
                  fontWeight: 800,
                  color: good ? '#4ade80' : accentSoft,
                  letterSpacing: 0.5,
                }}>
                  {effectLabel}
                </span>
              </div>
            </div>

            {/* Subtle shimmer on good cards */}
            {good && phase === 'reveal' && (
              <div style={{
                position: 'absolute', inset: 0, overflow: 'hidden',
                borderRadius: 14, pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: 0, width: '40%', height: '100%',
                  background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
                  animation: 'cdo-shimmer 3s ease-in-out 0.8s infinite',
                }} />
              </div>
            )}

            {/* Progress bar */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
              background: 'rgba(255,255,255,0.05)',
            }}>
              <div style={{
                height: '100%',
                background: accent,
                opacity: 0.6,
                transformOrigin: 'left',
                animation: 'cdo-progress 1.2s linear forwards',
              }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
