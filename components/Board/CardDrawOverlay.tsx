'use client';

import { useState, useEffect } from 'react';
import type { Card } from '@/types/game';

interface CardDrawOverlayProps {
  card: Card;
  onDismiss: () => void;
}

const EFFECT_ICONS: Record<string, { shape: string; color: string; glow: string }> = {
  'collect':           { shape: 'bars',    color: '#d4af37', glow: 'rgba(212,175,55,0.4)' },
  'pay':               { shape: 'crack',   color: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  'move-to':           { shape: 'arrow',   color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
  'move-relative':     { shape: 'arrow',   color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
  'go-to-jail':        { shape: 'bars-v',  color: '#888',    glow: 'rgba(136,136,136,0.4)' },
  'get-out-of-jail':   { shape: 'key',     color: '#ffd700', glow: 'rgba(255,215,0,0.5)' },
  'collect-from-each': { shape: 'coins-in', color: '#d4af37', glow: 'rgba(212,175,55,0.4)' },
  'pay-each-player':   { shape: 'coins-out', color: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
  'repairs':           { shape: 'wrench',  color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' },
  'nearest-railroad':  { shape: 'arrow',   color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
  'nearest-utility':   { shape: 'arrow',   color: '#60a5fa', glow: 'rgba(96,165,250,0.4)' },
};

function EffectIcon({ kind }: { kind: string }) {
  const cfg = EFFECT_ICONS[kind] || EFFECT_ICONS['collect'];

  const iconContent: Record<string, React.ReactNode> = {
    bars: (
      // Gold bars stacked
      <div style={{ position: 'relative', width: 40, height: 36 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            bottom: i * 10,
            left: '50%',
            transform: `translateX(-50%) translateX(${(i - 1) * 3}px)`,
            width: 32 - i * 2, height: 10,
            background: `linear-gradient(180deg, #ffd700, #b8860b)`,
            borderRadius: 2,
            border: '1px solid rgba(0,0,0,0.2)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }} />
        ))}
      </div>
    ),
    crack: (
      // Cracked coin
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'linear-gradient(135deg, #b8860b, #8b6914)',
        border: '2px solid #6b5310',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-5%', left: '45%',
          width: 2, height: '110%',
          background: '#ef4444',
          transform: 'rotate(15deg)',
          boxShadow: '0 0 4px rgba(239,68,68,0.6)',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          fontFamily: 'Cinzel, serif', fontSize: 18, fontWeight: 900,
          color: '#1a0f0f',
        }}>$</div>
      </div>
    ),
    arrow: (
      // Compass arrow
      <div style={{ position: 'relative', width: 40, height: 40 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '2px solid rgba(96,165,250,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
            borderBottom: '16px solid #60a5fa',
            filter: 'drop-shadow(0 0 3px rgba(96,165,250,0.5))',
          }} />
        </div>
      </div>
    ),
    'bars-v': (
      // Jail bars
      <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 4, height: 32,
            background: 'linear-gradient(180deg, #777, #444)',
            borderRadius: 2, margin: '0 3px',
            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.5)',
          }} />
        ))}
        <div style={{
          position: 'absolute', top: '50%', left: '10%', right: '10%',
          height: 4, background: 'linear-gradient(90deg, #777, #555)',
          borderRadius: 2, transform: 'translateY(-50%)',
        }} />
      </div>
    ),
    key: (
      // Key shape
      <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          border: '3px solid #ffd700', background: 'transparent',
        }} />
        <div style={{
          width: 20, height: 4,
          background: '#ffd700', borderRadius: 2,
          marginLeft: -2,
        }} />
        <div style={{
          position: 'absolute', right: 6, bottom: 10,
          width: 4, height: 8, background: '#ffd700', borderRadius: 1,
        }} />
      </div>
    ),
    'coins-in': (
      // Coins fanning in
      <div style={{ position: 'relative', width: 44, height: 36 }}>
        {[-15, 0, 15].map((rot, i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 18, height: 18, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffd700, #b8860b)',
            border: '1px solid rgba(0,0,0,0.2)',
            transform: `translate(-50%,-50%) translate(${(i-1)*8}px, 0) rotate(${rot}deg)`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              position: 'absolute', inset: 3, borderRadius: '50%',
              border: '1px dashed rgba(0,0,0,0.15)',
            }} />
          </div>
        ))}
      </div>
    ),
    'coins-out': (
      <div style={{ position: 'relative', width: 44, height: 36 }}>
        {[-20, 0, 20].map((rot, i) => (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: 18, height: 18, borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444, #991b1b)',
            border: '1px solid rgba(0,0,0,0.2)',
            transform: `translate(-50%,-50%) translate(${(i-1)*10}px, 0) rotate(${rot}deg)`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              position: 'absolute', inset: 3, borderRadius: '50%',
              border: '1px dashed rgba(0,0,0,0.15)',
            }} />
          </div>
        ))}
      </div>
    ),
    wrench: (
      // X wrench
      <div style={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 4, background: '#f59e0b', borderRadius: 2,
          transform: 'rotate(45deg)', position: 'absolute',
          boxShadow: '0 0 4px rgba(245,158,11,0.4)',
        }} />
        <div style={{
          width: 32, height: 4, background: '#f59e0b', borderRadius: 2,
          transform: 'rotate(-45deg)', position: 'absolute',
          boxShadow: '0 0 4px rgba(245,158,11,0.4)',
        }} />
      </div>
    ),
  };

  return (
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'rgba(0,0,0,0.4)',
      border: `2px solid ${cfg.color}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 20px ${cfg.glow}, inset 0 0 10px ${cfg.glow}`,
      margin: '0 auto',
    }}>
      {iconContent[cfg.shape] || iconContent['bars']}
    </div>
  );
}

function getFooterText(card: Card): string {
  const e = card.effect as any;
  switch (e.kind) {
    case 'collect': return `+$${e.amount}`;
    case 'pay': return `-$${e.amount}`;
    case 'collect-from-each': return `+$${e.amount} × EACH PLAYER`;
    case 'pay-each-player': return `-$${e.amount} × EACH PLAYER`;
    case 'repairs': return `HOUSE: -$${e.houseCost}  HOTEL: -$${e.hotelCost}`;
    case 'go-to-jail': return 'GO DIRECTLY TO JAIL';
    case 'get-out-of-jail': return 'KEEP THIS CARD';
    case 'move-to': return 'ADVANCE';
    case 'move-relative': return 'MOVE';
    case 'nearest-railroad': return 'ADVANCE TO NEAREST';
    case 'nearest-utility': return 'ADVANCE TO NEAREST';
    default: return '';
  }
}

function isGoodCard(kind: string): boolean {
  return ['collect', 'collect-from-each', 'get-out-of-jail'].includes(kind);
}

export default function CardDrawOverlay({ card, onDismiss }: CardDrawOverlayProps) {
  const [phase, setPhase] = useState<'deck' | 'lift' | 'flip' | 'reveal'>('deck');
  const isRisk = card.deckType === 'chance';
  const good = isGoodCard(card.effect.kind);
  const effectCfg = EFFECT_ICONS[card.effect.kind] || EFFECT_ICONS['collect'];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('lift'), 150);
    const t2 = setTimeout(() => setPhase('flip'), 350);
    const t3 = setTimeout(() => setPhase('reveal'), 600);
    const t4 = setTimeout(onDismiss, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDismiss]);

  return (
    <>
      <style>{`
        @keyframes cdo-deckFade { from { opacity: 0; transform: scale(0.9) } to { opacity: 1; transform: scale(1) } }
        @keyframes cdo-liftCard { 0% { transform: translateY(0) rotate(0deg) } 100% { transform: translateY(-24px) rotate(2deg) } }
        @keyframes cdo-flipCard {
          0% { transform: translateY(-24px) rotate(2deg) rotateY(0deg) }
          50% { transform: translateY(-30px) rotate(0deg) rotateY(90deg) }
          100% { transform: translateY(0) rotate(0deg) rotateY(0deg) }
        }
        @keyframes cdo-contentIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes cdo-sparkle { 0%,100% { opacity: 0; transform: scale(0.5) } 50% { opacity: 1; transform: scale(1.2) } }
        @keyframes cdo-shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
        @keyframes cdo-barsDown { from { transform: translateY(-10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes cdo-keyTurn { 0% { transform: rotate(0deg) } 50% { transform: rotate(-30deg) } 100% { transform: rotate(0deg) } }
        @keyframes cdo-progress { from { width: 0% } to { width: 100% } }
      `}</style>

      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: phase === 'reveal' ? 'blur(8px)' : 'blur(4px)',
          backgroundColor: phase === 'reveal' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
        }}
      >
        {/* Sparkles for good cards */}
        {phase === 'reveal' && good && (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={`sp-${i}`} style={{
              position: 'absolute',
              left: `${20 + ((i * 9301 + 49297) % 233280) / 233280 * 60}%`,
              top: `${15 + ((i * 7919 + 31337) % 233280) / 233280 * 70}%`,
              width: 8, height: 8,
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              backgroundColor: '#d4af37',
              animation: `cdo-sparkle ${1 + (i * 0.3)}s ease-in-out ${0.5 + i * 0.2}s infinite`,
              pointerEvents: 'none', zIndex: 2,
            }} />
          ))
        )}

        {/* Card stack (deck) — visible during deck & lift phases */}
        {(phase === 'deck' || phase === 'lift') && (
          <div style={{
            position: 'relative',
            animation: 'cdo-deckFade 0.2s ease-out forwards',
          }}>
            {/* Bottom cards of stack */}
            {[2, 1].map(i => (
              <div key={`stack-${i}`} style={{
                position: 'absolute',
                top: i * 3, left: i * 2,
                width: 200, height: 280,
                borderRadius: 12,
                background: `
                  repeating-linear-gradient(45deg, #2a0f1f 0px, #2a0f1f 12px, rgba(212,175,55,0.06) 12px, rgba(212,175,55,0.06) 13px),
                  repeating-linear-gradient(-45deg, #2a0f1f 0px, #2a0f1f 12px, rgba(212,175,55,0.06) 12px, rgba(212,175,55,0.06) 13px),
                  linear-gradient(135deg, #1a0f0f, #2a0f1f)
                `,
                border: '2px solid rgba(212,175,55,0.3)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  position: 'absolute', inset: 8,
                  border: '1px dashed rgba(212,175,55,0.15)',
                  borderRadius: 8,
                }} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  fontSize: 28, color: '#d4af37', opacity: 0.3,
                  fontFamily: 'Cinzel, serif',
                }}>◆</div>
              </div>
            ))}

            {/* Top card (lifts) */}
            <div style={{
              position: 'relative',
              width: 200, height: 280,
              borderRadius: 12,
              background: `
                repeating-linear-gradient(45deg, #2a0f1f 0px, #2a0f1f 12px, rgba(212,175,55,0.06) 12px, rgba(212,175,55,0.06) 13px),
                repeating-linear-gradient(-45deg, #2a0f1f 0px, #2a0f1f 12px, rgba(212,175,55,0.06) 12px, rgba(212,175,55,0.06) 13px),
                linear-gradient(135deg, #1a0f0f, #2a0f1f)
              `,
              border: '2px solid rgba(212,175,55,0.4)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              animation: phase === 'lift' ? 'cdo-liftCard 0.3s ease-out forwards' : undefined,
            }}>
              <div style={{
                position: 'absolute', inset: 8,
                border: '1px dashed rgba(212,175,55,0.2)',
                borderRadius: 8,
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                fontSize: 28, color: '#d4af37', opacity: 0.4,
                fontFamily: 'Cinzel, serif',
              }}>◆</div>
            </div>
          </div>
        )}

        {/* The revealed card face */}
        {(phase === 'flip' || phase === 'reveal') && (
          <div
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              width: 280, maxWidth: '88vw',
              position: 'relative',
              animation: phase === 'flip' ? 'cdo-flipCard 0.4s ease-out forwards' : undefined,
              perspective: 800,
            }}
          >
            <div style={{
              position: 'relative',
              background: `
                repeating-linear-gradient(135deg, transparent, transparent 20px, rgba(212,175,55,0.015) 20px, rgba(212,175,55,0.015) 21px),
                linear-gradient(180deg, #1a0f0f 0%, #2a0f1f 100%)
              `,
              borderRadius: 14,
              border: `2px solid ${isRisk ? 'rgba(220,38,38,0.5)' : 'rgba(100,50,150,0.5)'}`,
              overflow: 'hidden',
              boxShadow: `
                0 0 30px ${isRisk ? 'rgba(220,38,38,0.2)' : 'rgba(100,50,150,0.2)'},
                0 16px 48px rgba(0,0,0,0.6)
              `,
            }}>
              {/* Corner ornaments */}
              {[
                { top: 6, left: 6 }, { top: 6, right: 6 },
                { bottom: 6, left: 6 }, { bottom: 6, right: 6 },
              ].map((pos, i) => (
                <div key={`c-${i}`} style={{
                  position: 'absolute', ...pos,
                  width: 10, height: 10,
                  border: '1px solid rgba(212,175,55,0.3)',
                  transform: 'rotate(45deg)',
                  pointerEvents: 'none', zIndex: 5,
                }} />
              ))}

              {/* Top banner */}
              <div style={{
                background: isRisk
                  ? 'linear-gradient(135deg, #7f1d1d, #991b1b, #7f1d1d)'
                  : 'linear-gradient(135deg, #3d0f22, #4a1942, #3d0f22)',
                padding: '10px 20px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: 16,
                  fontWeight: 900,
                  color: isRisk ? '#fecaca' : '#e8d5f5',
                  letterSpacing: 3,
                }}>
                  {isRisk ? '⚡ RISK' : '✦ BLIND CHEST'}
                </div>
              </div>

              {/* Gold divider */}
              <div style={{
                height: 1,
                background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
                opacity: 0.4,
              }} />

              {/* Card body */}
              <div style={{
                padding: '20px 24px 16px',
                textAlign: 'center',
                opacity: phase === 'reveal' ? 1 : 0,
                animation: phase === 'reveal' ? 'cdo-contentIn 0.3s ease-out forwards' : undefined,
              }}>
                {/* Effect icon */}
                <div style={{
                  marginBottom: 16,
                  animation: card.effect.kind === 'go-to-jail' ? 'cdo-barsDown 0.4s ease-out 0.1s both' :
                    card.effect.kind === 'get-out-of-jail' ? 'cdo-keyTurn 0.6s ease-in-out 0.2s' : undefined,
                }}>
                  <EffectIcon kind={card.effect.kind} />
                </div>

                {/* Card text */}
                <p style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff8e7',
                  lineHeight: 1.5,
                  margin: '0 0 16px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}>
                  {card.text}
                </p>

                {/* Dotted divider */}
                <div style={{
                  height: 1,
                  backgroundImage: 'repeating-linear-gradient(90deg, #d4af37 0px, #d4af37 4px, transparent 4px, transparent 8px)',
                  opacity: 0.3,
                  marginBottom: 10,
                }} />

                {/* Footer — mechanical effect */}
                <div style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: effectCfg.color,
                  textShadow: `0 0 6px ${effectCfg.glow}`,
                }}>
                  {getFooterText(card)}
                </div>
              </div>

              {/* Shimmer for good cards */}
              {good && phase === 'reveal' && (
                <div style={{
                  position: 'absolute', inset: 0, overflow: 'hidden',
                  borderRadius: 14, pointerEvents: 'none', zIndex: 4,
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)',
                    animation: 'cdo-shimmer 2.5s ease-in-out 1s infinite',
                    willChange: 'transform',
                  }} />
                </div>
              )}

              {/* Auto-dismiss progress bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${isRisk ? '#991b1b' : '#4a1942'}, ${isRisk ? '#ef4444' : '#8b5cf6'})`,
                  animation: 'cdo-progress 1.8s linear forwards',
                  willChange: 'width',
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
