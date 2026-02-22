'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface MinigameResultProps {
  tier: MinigameTier;
  baseAmount: number;
  context: MinigameContext;
  onDismiss: () => void;
}

function useCountUp(target: number, duration = 500, startDelay = 400) {
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

const TIER_CONFIG: Record<MinigameTier, {
  title: string;
  icon: string;
  bannerBg: string;
  bannerText: string;
  borderColor: string;
  glowColor: string;
  amountColor: string;
  lingo: Record<MinigameContext, string>;
  stamp?: { text: string; color: string; rotation: number; opacity: number };
}> = {
  win: {
    title: '★ JACKPOT ★',
    icon: '♛',
    bannerBg: 'linear-gradient(135deg, #1a0f0f, #2a1520, #1a0f0f)',
    bannerText: '#FFD700',
    borderColor: '#FFD700',
    glowColor: 'rgba(255,215,0,0.6)',
    amountColor: '#4ade80',
    lingo: { buying: 'FREE PROPERTY', rent: 'RENT DODGED' },
  },
  'close-win': {
    title: 'CLOSE WIN',
    icon: '⊙',
    bannerBg: 'linear-gradient(135deg, #2d6a4f, #40916c, #2d6a4f)',
    bannerText: '#d8f3dc',
    borderColor: '#40916c',
    glowColor: 'rgba(74,222,128,0.3)',
    amountColor: '#4ade80',
    lingo: { buying: 'HALF PRICE DEAL', rent: 'LUCKY DISCOUNT' },
  },
  'close-loss': {
    title: 'CLOSE CALL',
    icon: '▲',
    bannerBg: 'linear-gradient(135deg, #b45309, #d97706, #b45309)',
    bannerText: '#fef3c7',
    borderColor: '#d97706',
    glowColor: 'rgba(251,191,36,0.3)',
    amountColor: '#fbbf24',
    lingo: { buying: 'OVERCHARGED', rent: 'SURCHARGE APPLIED' },
    stamp: { text: 'PENALTY', color: 'rgba(251,191,36,0.12)', rotation: -12, opacity: 1 },
  },
  loss: {
    title: 'YOU LOST',
    icon: '▼',
    bannerBg: 'linear-gradient(135deg, #7f1d1d, #991b1b, #7f1d1d)',
    bannerText: '#fecaca',
    borderColor: '#991b1b',
    glowColor: 'rgba(248,113,113,0.3)',
    amountColor: '#f87171',
    lingo: { buying: 'DOUBLE PENALTY', rent: 'DOUBLE RENT' },
    stamp: { text: 'PENALTY', color: 'rgba(220,38,38,0.15)', rotation: -15, opacity: 1 },
  },
  catastrophic: {
    title: '☠ DISASTER ☠',
    icon: '☠',
    bannerBg: 'linear-gradient(135deg, #1a1a1a, #2d0000, #1a1a1a)',
    bannerText: '#ef4444',
    borderColor: '#cc0000',
    glowColor: 'rgba(239,68,68,0.4)',
    amountColor: '#ef4444',
    lingo: { buying: 'CATASTROPHIC LOSS', rent: 'RUINOUS RENT' },
    stamp: { text: 'CONDEMNED', color: 'rgba(200,0,0,0.18)', rotation: -10, opacity: 1 },
  },
};

export default function MinigameResult({ tier, baseAmount, context, onDismiss }: MinigameResultProps) {
  const { play } = useAudio();
  const hasPlayed = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const multipliers: Record<MinigameTier, number> = {
    'win': 0, 'close-win': 0.5, 'close-loss': 1.5, 'loss': 2, 'catastrophic': 5
  };
  const amount = Math.floor(baseAmount * multipliers[tier]);
  const displayAmount = useCountUp(amount, 500, 500);

  const config = TIER_CONFIG[tier];
  const multiplierLabel = tier === 'close-win' ? '×0.5' : tier === 'close-loss' ? '×1.5' : tier === 'loss' ? '×2' : tier === 'catastrophic' ? '×5' : '';

  useEffect(() => {
    if (!hasPlayed.current) {
      hasPlayed.current = true;
      play(`minigames/tier-${tier}`, { volume: 0.6 });
    }
  }, [tier, play]);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(onDismiss, 2000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const rng = useCallback((seed: number) => {
    return ((seed * 9301 + 49297) % 233280) / 233280;
  }, []);

  // Format dollar amount into individual digit boxes
  const digits = `$${displayAmount}`.split('');

  return (
    <>
      <style>{`
        @keyframes mr-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mr-progressRing { from { width: 0% } to { width: 100% } }

        /* Entrances */
        @keyframes mr-bounceIn { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.08) } 80% { transform: scale(0.97) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes mr-slideUp { 0% { transform: translateY(120px); opacity: 0 } 60% { transform: translateY(-12px) } 80% { transform: translateY(4px) } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes mr-dropSlam { 0% { transform: translateY(-120px); opacity: 0 } 70% { transform: translateY(8px) } 85% { transform: translateY(-3px) } 100% { transform: translateY(0); opacity: 1 } }
        @keyframes mr-flipReveal { 0% { transform: perspective(800px) rotateY(180deg) } 100% { transform: perspective(800px) rotateY(0deg) } }
        @keyframes mr-slamIn { 0% { transform: scale(2); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }

        /* Digit roll-in */
        @keyframes mr-digitIn { 0% { transform: translateY(-20px); opacity: 0 } 100% { transform: translateY(0); opacity: 1 } }

        /* Effects */
        @keyframes mr-goldCycle { 0%,100% { color: #FFD700 } 50% { color: #FFF8E1 } }
        @keyframes mr-shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
        @keyframes mr-greenPulse { 0%,100% { box-shadow: 0 0 20px rgba(74,222,128,0.2) } 50% { box-shadow: 0 0 40px rgba(74,222,128,0.4), 0 0 80px rgba(74,222,128,0.15) } }
        @keyframes mr-spotlight { 0%,100% { opacity: 0.05 } 50% { opacity: 0.15 } }
        @keyframes mr-coin { 0% { transform: translate(0,0) scale(1); opacity: 1 } 100% { transform: translate(var(--cx), var(--cy)) scale(0.3); opacity: 0 } }
        @keyframes mr-confetti { 0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 0.9 } 100% { transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rot)); opacity: 0 } }
        @keyframes mr-amberFlash { 0% { opacity: 0.8 } 100% { opacity: 0 } }
        @keyframes mr-tiltSnap { 0% { transform: rotate(1.5deg) } 100% { transform: rotate(0deg) } }
        @keyframes mr-redVignette { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mr-floatUp { 0% { opacity: 0.8; transform: translateY(0) } 100% { opacity: 0; transform: translateY(-50px) } }
        @keyframes mr-glitch { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-3px) } 50% { transform: translateX(2px) } 75% { transform: translateX(-2px) } }
        @keyframes mr-redFlash { 0% { opacity: 0 } 30% { opacity: 0.6 } 100% { opacity: 0 } }
        @keyframes mr-screenShake { 0%,100% { transform: translate(0,0) } 10% { transform: translate(-4px,2px) } 30% { transform: translate(3px,-3px) } 50% { transform: translate(-3px,3px) } 70% { transform: translate(4px,-1px) } 90% { transform: translate(-1px,-2px) } }
        @keyframes mr-fire { 0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.9 } 100% { transform: translateY(-100px) translateX(var(--fx)) scale(0.2); opacity: 0 } }
        @keyframes mr-warningStripe { from { background-position-x: 0 } to { background-position-x: 40px } }
        @keyframes mr-flicker { 0%,100% { opacity: 1 } 5% { opacity: 0.3 } 15% { opacity: 0.5 } 20% { opacity: 1 } }
        @keyframes mr-skullSlam { 0% { transform: scale(3) translateY(-30px); opacity: 0 } 50% { transform: scale(1) translateY(5px); opacity: 1 } 70% { transform: scale(1.1) translateY(-3px) } 100% { transform: scale(1) translateY(0) } }
        @keyframes mr-sparkle { 0%,100% { opacity: 0; transform: scale(0.5) } 50% { opacity: 1; transform: scale(1.2) } }
        @keyframes mr-chipFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes mr-borderShimmer { 0% { border-color: rgba(255,215,0,0.4) } 50% { border-color: rgba(255,215,0,1) } 100% { border-color: rgba(255,215,0,0.4) } }
        @keyframes mr-crackLine { 0% { opacity: 0; transform: scaleX(0) } 100% { opacity: 0.4; transform: scaleX(1) } }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        backdropFilter: revealed ? 'blur(10px)' : 'none',
        backgroundColor: revealed ? 'rgba(0,0,0,0.75)' : '#000',
        transition: 'background-color 0.3s, backdrop-filter 0.3s',
        animation: tier === 'close-loss' && revealed ? 'mr-tiltSnap 0.4s ease-out forwards' : tier === 'catastrophic' && revealed ? 'mr-screenShake 0.5s ease-out' : undefined,
      }}>
        {/* Black reveal */}
        {!revealed && <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', zIndex: 10000 }} />}

        {/* === Spotlight cone from above (all tiers) === */}
        {revealed && (
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '500px', height: '60%',
            background: `linear-gradient(180deg, ${config.glowColor} 0%, transparent 100%)`,
            clipPath: 'polygon(40% 0%, 60% 0%, 75% 100%, 25% 100%)',
            opacity: 0.3, pointerEvents: 'none', zIndex: 1,
            animation: 'mr-spotlight 3s ease-in-out infinite',
          }} />
        )}

        {/* === CATASTROPHIC ambient effects === */}
        {tier === 'catastrophic' && revealed && (
          <>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'red', animation: 'mr-redFlash 0.3s ease-out forwards', pointerEvents: 'none', zIndex: 2 }} />
            {['top', 'bottom'].map(pos => (
              <div key={pos} style={{
                position: 'absolute', [pos]: 0, left: 0, right: 0, height: '20px',
                background: 'repeating-linear-gradient(45deg, #000 0px, #000 10px, #cc0000 10px, #cc0000 20px)',
                backgroundSize: '40px 40px',
                animation: 'mr-warningStripe 0.5s linear infinite',
                pointerEvents: 'none', zIndex: 3, opacity: 0.7,
              }} />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={`fire-${i}`} style={{
                position: 'absolute', bottom: '5%',
                left: `${10 + rng(i * 7) * 80}%`,
                width: `${6 + rng(i * 3) * 6}px`, height: `${6 + rng(i * 3) * 6}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${rng(i) > 0.5 ? '#FF6B00' : '#FF2020'}, transparent)`,
                animation: `mr-fire ${1.5 + rng(i * 5) * 1.5}s ease-out ${rng(i * 2) * 0.8}s infinite`,
                ['--fx' as string]: `${(rng(i * 11) - 0.5) * 40}px`,
                pointerEvents: 'none', zIndex: 2, willChange: 'transform, opacity',
              } as React.CSSProperties} />
            ))}
          </>
        )}

        {/* === WIN ambient effects === */}
        {tier === 'win' && revealed && (
          <>
            {Array.from({ length: 20 }).map((_, i) => {
              const angle = (i / 20) * Math.PI * 2;
              const dist = 80 + rng(i * 13) * 120;
              return (
                <div key={`coin-${i}`} style={{
                  position: 'absolute', width: '10px', height: '10px', borderRadius: '50%',
                  background: 'radial-gradient(circle at 30% 30%, #FFE066, #B8860B)',
                  boxShadow: '0 0 4px rgba(255,215,0,0.6)',
                  ['--cx' as string]: `${Math.cos(angle) * dist}px`,
                  ['--cy' as string]: `${Math.sin(angle) * dist}px`,
                  animation: `mr-coin ${0.8 + rng(i * 7) * 0.6}s cubic-bezier(0.25,0.46,0.45,0.94) ${0.4 + rng(i * 3) * 0.4}s forwards`,
                  opacity: 0, pointerEvents: 'none', zIndex: 2, willChange: 'transform, opacity',
                } as React.CSSProperties} />
              );
            })}
            {Array.from({ length: 30 }).map((_, i) => {
              const colors = ['#FFD700', '#FF6B6B', '#4ade80', '#60a5fa', '#f59e0b', '#c084fc', '#fb7185', '#34d399'];
              return (
                <div key={`conf-${i}`} style={{
                  position: 'absolute', top: '-10px',
                  left: `${(i / 30) * 100}%`,
                  width: `${3 + rng(i * 2) * 4}px`, height: `${12 + rng(i * 5) * 12}px`,
                  backgroundColor: colors[i % colors.length], borderRadius: '1px',
                  ['--drift' as string]: `${(rng(i * 9) - 0.5) * 80}px`,
                  ['--rot' as string]: `${rng(i * 4) * 720}deg`,
                  animation: `mr-confetti ${2 + rng(i * 6) * 2}s linear ${rng(i * 8) * 1}s infinite`,
                  pointerEvents: 'none', zIndex: 2, willChange: 'transform, opacity',
                } as React.CSSProperties} />
              );
            })}
          </>
        )}

        {/* === CLOSE WIN sparkles === */}
        {tier === 'close-win' && revealed && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={`sp-${i}`} style={{
              position: 'absolute',
              left: `${10 + rng(i * 7) * 80}%`, top: `${10 + rng(i * 11) * 80}%`,
              width: '8px', height: '8px',
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              backgroundColor: '#e5e7eb',
              animation: `mr-sparkle ${1 + rng(i * 3) * 1}s ease-in-out ${rng(i * 5) * 1.5}s infinite`,
              pointerEvents: 'none', zIndex: 2, willChange: 'transform, opacity',
            }} />
          ))
        )}

        {/* === CLOSE LOSS amber flash === */}
        {tier === 'close-loss' && revealed && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(255,176,0,0.8)',
            animation: 'mr-amberFlash 0.3s ease-out forwards',
            pointerEvents: 'none', zIndex: 3,
          }} />
        )}

        {/* === LOSS vignette === */}
        {tier === 'loss' && revealed && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(139,0,0,0.5) 100%)',
            animation: 'mr-redVignette 1s ease-out forwards',
            pointerEvents: 'none', zIndex: 1,
          }} />
        )}

        {/* ============== THE TICKET CARD ============== */}
        {revealed && (
          <div style={{
            position: 'relative', zIndex: 10,
            width: '380px', maxWidth: '92vw',
            opacity: 0,
            animation: tier === 'win' ? 'mr-bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' :
              tier === 'close-win' ? 'mr-slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' :
              tier === 'close-loss' ? 'mr-dropSlam 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards' :
              tier === 'loss' ? 'mr-dropSlam 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards' :
              tier === 'catastrophic' ? 'mr-slamIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards' : 'mr-fadeIn 0.3s forwards',
          }}>
            <div style={{
              position: 'relative',
              background: `
                repeating-linear-gradient(135deg, transparent, transparent 20px, rgba(212,175,55,0.02) 20px, rgba(212,175,55,0.02) 21px),
                linear-gradient(180deg, #1a0f0f 0%, #2a0f1f 100%)
              `,
              borderRadius: '16px',
              border: `2px solid ${config.borderColor}`,
              overflow: 'hidden',
              boxShadow: `0 0 40px ${config.glowColor}, 0 20px 60px rgba(0,0,0,0.6)`,
              animation: tier === 'win' ? 'mr-borderShimmer 2s ease-in-out infinite' :
                tier === 'close-win' ? 'mr-greenPulse 2s ease-in-out infinite' : undefined,
            }}>
              {/* Perforated top edge */}
              <div style={{
                position: 'absolute', top: -1, left: 0, right: 0, height: '6px',
                background: `radial-gradient(circle at 8px 0, transparent 4px, ${config.borderColor}22 4px)`,
                backgroundSize: '16px 6px',
                pointerEvents: 'none', zIndex: 10,
              }} />

              {/* Corner ornaments */}
              {[{ top: 8, left: 8 }, { top: 8, right: 8 }, { bottom: 8, left: 8 }, { bottom: 8, right: 8 }].map((pos, i) => (
                <div key={`corner-${i}`} style={{
                  position: 'absolute', ...pos,
                  width: '12px', height: '12px',
                  border: `1px solid ${config.borderColor}`,
                  transform: 'rotate(45deg)',
                  opacity: 0.4, pointerEvents: 'none', zIndex: 5,
                }} />
              ))}

              {/* Gold foil watermark */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '120px', color: '#d4af37', opacity: 0.06,
                fontFamily: 'Cinzel, serif', pointerEvents: 'none', zIndex: 0,
                lineHeight: 1,
              }}>✦</div>

              {/* === TOP BANNER === */}
              <div style={{
                background: config.bannerBg,
                padding: '14px 24px 12px',
                textAlign: 'center',
                position: 'relative',
              }}>
                <h2 style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: tier === 'win' || tier === 'catastrophic' ? '28px' : '22px',
                  fontWeight: 900,
                  margin: 0,
                  color: config.bannerText,
                  letterSpacing: '3px',
                  animation: tier === 'win' ? 'mr-goldCycle 2s ease-in-out infinite' :
                    tier === 'catastrophic' ? 'mr-flicker 2s infinite' : undefined,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}>{config.title}</h2>
              </div>

              {/* === CARD BODY === */}
              <div style={{
                padding: '24px 28px 20px',
                textAlign: 'center',
                position: 'relative',
                zIndex: 2,
              }}>
                {/* Context label */}
                <div style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  color: '#b89a6a',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                }}>
                  {context === 'buying' ? 'PROPERTY PURCHASE' : 'RENT PAYMENT'}
                </div>

                {/* Casino lingo */}
                <div style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: config.amountColor,
                  marginBottom: '20px',
                  textShadow: `0 0 10px ${config.glowColor}`,
                }}>
                  {config.lingo[context]}
                </div>

                {/* === TIER ICON === */}
                <div style={{
                  fontSize: '48px',
                  lineHeight: 1,
                  marginBottom: '12px',
                  color: config.amountColor,
                  filter: `drop-shadow(0 0 8px ${config.glowColor})`,
                  animation: tier === 'catastrophic' ? 'mr-flicker 1.5s infinite' : undefined,
                }}>
                  {config.icon}
                </div>

                {/* === DOLLAR AMOUNT — ODOMETER === */}
                {tier !== 'win' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '3px', marginBottom: '8px',
                  }}>
                    {digits.map((d, i) => (
                      <div key={i} style={{
                        width: d === '$' ? '24px' : '22px',
                        height: '38px',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(212,175,55,0.2)',
                        borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Cinzel, serif',
                        fontSize: d === '$' ? '22px' : '20px',
                        fontWeight: 900,
                        color: d === '$' ? '#d4af37' : config.amountColor,
                        textShadow: `0 0 6px ${config.glowColor}`,
                        animation: `mr-digitIn 0.3s ease-out ${0.4 + i * 0.08}s both`,
                        willChange: 'transform, opacity',
                      }}>{d}</div>
                    ))}

                    {/* Multiplier chip */}
                    {multiplierLabel && (
                      <div style={{
                        width: '32px', height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2a0f1f, #1a0f0f)',
                        border: `2px solid ${config.borderColor}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Nunito, sans-serif',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: config.amountColor,
                        marginLeft: '6px',
                        boxShadow: `0 0 8px ${config.glowColor}`,
                        position: 'relative',
                      }}>
                        {/* Chip inner ring */}
                        <div style={{
                          position: 'absolute', inset: '3px',
                          borderRadius: '50%',
                          border: `1px dashed ${config.borderColor}55`,
                          pointerEvents: 'none',
                        }} />
                        {multiplierLabel}
                      </div>
                    )}
                  </div>
                )}

                {/* WIN special: no amount, just big text */}
                {tier === 'win' && (
                  <div style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '24px',
                    fontWeight: 900,
                    color: '#FFD700',
                    textShadow: '0 0 15px rgba(255,215,0,0.5)',
                    marginBottom: '8px',
                  }}>
                    {context === 'buying' ? 'FREE' : '$0'}
                  </div>
                )}

                {/* Base amount struck through */}
                {tier !== 'win' && (
                  <div style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: '12px',
                    color: '#b89a6a',
                    marginBottom: '20px',
                    opacity: 0.7,
                  }}>
                    <span style={{ textDecoration: 'line-through', marginRight: '8px' }}>${baseAmount}</span>
                    <span style={{ color: config.amountColor }}>→ ${amount}</span>
                  </div>
                )}

                {/* Loss floating dollar signs */}
                {tier === 'loss' && revealed && (
                  <div style={{ position: 'absolute', top: '40%', left: '50%', pointerEvents: 'none', zIndex: 20 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={`ds-${i}`} style={{
                        position: 'absolute',
                        left: `${(rng(i * 17) - 0.5) * 60}px`,
                        fontFamily: 'Cinzel, serif', fontSize: '16px',
                        color: 'rgba(248,113,113,0.6)',
                        animation: `mr-floatUp 1.2s ease-out ${i * 0.15}s forwards`,
                        opacity: 0, willChange: 'transform, opacity',
                      }}>$</span>
                    ))}
                  </div>
                )}

                {/* === CONTINUE CHIP-BUTTON === */}
                <button onClick={onDismiss} style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  padding: '10px 36px',
                  border: '2px solid #d4af37',
                  borderRadius: '24px',
                  background: 'linear-gradient(180deg, #d4af37, #8b7320)',
                  color: '#1a0f0f',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 5,
                  boxShadow: '0 0 12px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  animation: 'mr-chipFloat 2s ease-in-out 1s infinite',
                  willChange: 'transform',
                  transition: 'box-shadow 0.2s',
                }}>
                  {/* Inner dashed ring */}
                  <div style={{
                    position: 'absolute', inset: '4px',
                    borderRadius: '20px',
                    border: '1px dashed rgba(255,255,255,0.2)',
                    pointerEvents: 'none',
                  }} />
                  CONTINUE ▸
                </button>
              </div>

              {/* Stamp overlay */}
              {config.stamp && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: `translate(-50%, -50%) rotate(${config.stamp.rotation}deg)`,
                  fontFamily: 'Cinzel, serif',
                  fontSize: '42px',
                  fontWeight: 900,
                  letterSpacing: '8px',
                  color: config.stamp.color,
                  pointerEvents: 'none',
                  zIndex: 3,
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}>
                  {config.stamp.text}
                </div>
              )}

              {/* Close loss hairline crack */}
              {tier === 'close-loss' && (
                <div style={{
                  position: 'absolute', top: '35%', left: '10%', right: '10%',
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  transform: 'rotate(-5deg)',
                  animation: 'mr-crackLine 0.5s ease-out 0.5s both',
                  pointerEvents: 'none', zIndex: 4,
                }} />
              )}

              {/* Shimmer sweep (close-win) */}
              {tier === 'close-win' && (
                <div style={{
                  position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '16px', pointerEvents: 'none', zIndex: 4,
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)',
                    animation: 'mr-shimmer 2.5s ease-in-out 1s infinite',
                    willChange: 'transform',
                  }} />
                </div>
              )}

              {/* Loss scanline overlay */}
              {tier === 'loss' && (
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4,
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)',
                  opacity: 0.5,
                }} />
              )}

              {/* Auto-dismiss progress */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
                backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${config.borderColor}, ${config.amountColor})`,
                  animation: 'mr-progressRing 2s linear forwards',
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
