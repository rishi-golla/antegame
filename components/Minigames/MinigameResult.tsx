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
        const eased = 1 - Math.pow(1 - t, 3); // decelerate
        setValue(Math.floor(eased * target));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, startDelay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, startDelay]);
  return value;
}

export default function MinigameResult({ tier, baseAmount, context, onDismiss }: MinigameResultProps) {
  const { play } = useAudio();
  const hasPlayed = useRef(false);
  const [revealed, setRevealed] = useState(false);

  const multipliers: Record<MinigameTier, number> = {
    'win': 0, 'close-win': 0.5, 'close-loss': 1.5, 'loss': 2, 'catastrophic': 5
  };
  const amount = Math.floor(baseAmount * multipliers[tier]);
  const displayAmount = useCountUp(amount, 500, tier === 'loss' ? 1200 : 400);

  const info: Record<MinigameTier, { title: string; description: string }> = {
    'win': { title: 'JACKPOT!', description: context === 'buying' ? 'FREE PROPERTY!' : 'NO RENT!' },
    'close-win': { title: 'CLOSE WIN!', description: context === 'buying' ? `GOT IT FOR $${amount} (50% OFF)` : `PAID $${amount} RENT (50%)` },
    'close-loss': { title: 'CLOSE CALL', description: context === 'buying' ? `LOST $${amount} (1.5× PENALTY)` : `PAID $${amount} RENT (1.5×)` },
    'loss': { title: 'YOU LOST', description: context === 'buying' ? `LOST $${amount} (2× PENALTY)` : `PAID $${amount} RENT (2×)` },
    'catastrophic': { title: 'DISASTER!', description: context === 'buying' ? `LOST $${amount} (5× PENALTY)` : `PAID $${amount} RENT (5×)` },
  };

  const { title, description } = info[tier];

  useEffect(() => {
    if (!hasPlayed.current) {
      hasPlayed.current = true;
      play(`minigames/tier-${tier}`, { volume: 0.6 });
    }
  }, [tier, play]);

  // Dramatic reveal delay
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss after 8s (from mount)
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  // Loss card flip delay
  const [flipped, setFlipped] = useState(tier !== 'loss');
  useEffect(() => {
    if (tier === 'loss') {
      const t = setTimeout(() => setFlipped(true), 1300); // 500 black + 800 pause
      return () => clearTimeout(t);
    }
  }, [tier]);

  const rng = useCallback((seed: number) => {
    // deterministic-ish per index for SSR safety
    return ((seed * 9301 + 49297) % 233280) / 233280;
  }, []);

  return (
    <>
      <style>{`
        @keyframes mr-fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mr-blackReveal { 0% { opacity: 1 } 99% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes mr-progressBar { from { width: 0% } to { width: 100% } }
        @keyframes mr-btnPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,215,0,0.3) } 50% { transform: scale(1.03); box-shadow: 0 0 20px rgba(255,215,0,0.5) } }

        /* WIN */
        @keyframes mr-winCard { 0% { transform: scale(0); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes mr-goldCycle { 0%,100% { color: #FFD700 } 50% { color: #FFF8E1 } }
        @keyframes mr-coin { 0% { transform: translate(0,0) scale(1); opacity: 1 } 100% { transform: translate(var(--cx), var(--cy)) scale(0.3); opacity: 0 } }
        @keyframes mr-confetti { 0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 1 } 100% { transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rot)); opacity: 0.6 } }
        @keyframes mr-spotlight { 0% { transform: translateX(-200%) rotate(25deg) } 100% { transform: translateX(200%) rotate(25deg) } }
        @keyframes mr-chase { 0% { offset-distance: 0% } 100% { offset-distance: 100% } }

        /* CLOSE WIN */
        @keyframes mr-slideUp { 0% { transform: translateY(100vh) } 60% { transform: translateY(-20px) } 80% { transform: translateY(5px) } 100% { transform: translateY(0) } }
        @keyframes mr-greenGlow { 0%,100% { box-shadow: 0 0 30px rgba(74,222,128,0.3), 0 0 60px rgba(74,222,128,0.1); transform: scale(1) } 50% { box-shadow: 0 0 50px rgba(74,222,128,0.5), 0 0 100px rgba(74,222,128,0.2); transform: scale(1.03) } }
        @keyframes mr-shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }
        @keyframes mr-sparkle { 0%,100% { opacity: 0; transform: scale(0.5) } 50% { opacity: 1; transform: scale(1.2) } }

        /* CLOSE LOSS */
        @keyframes mr-dropIn { 0% { transform: translateY(-100vh) } 70% { transform: translateY(10px) } 85% { transform: translateY(-3px) } 100% { transform: translateY(0) } }
        @keyframes mr-amberFlash { 0% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes mr-tiltSnap { 0% { transform: rotate(1.5deg) } 100% { transform: rotate(0deg) } }
        @keyframes mr-crackFade { 0% { opacity: 0.6 } 100% { opacity: 0 } }

        /* LOSS */
        @keyframes mr-cardFlip { 0% { transform: perspective(800px) rotateY(180deg) } 100% { transform: perspective(800px) rotateY(0deg) } }
        @keyframes mr-redVignette { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mr-floatUp { 0% { opacity: 0.8; transform: translateY(0) } 100% { opacity: 0; transform: translateY(-60px) } }
        @keyframes mr-vhsGlitch { 0%,100% { transform: translateX(0); clip-path: inset(0) } 25% { transform: translateX(-3px); clip-path: inset(10% 0 80% 0) } 50% { transform: translateX(2px); clip-path: inset(40% 0 30% 0) } 75% { transform: translateX(-2px); clip-path: inset(70% 0 5% 0) } }

        /* CATASTROPHIC */
        @keyframes mr-redFlash { 0% { opacity: 0 } 30% { opacity: 0.6 } 100% { opacity: 0 } }
        @keyframes mr-screenShake { 0%,100% { transform: translate(0,0) } 10% { transform: translate(-4px,2px) } 20% { transform: translate(3px,-3px) } 30% { transform: translate(-2px,4px) } 40% { transform: translate(4px,-1px) } 50% { transform: translate(-3px,3px) } 60% { transform: translate(2px,-4px) } 70% { transform: translate(-4px,1px) } 80% { transform: translate(3px,3px) } 90% { transform: translate(-1px,-2px) } }
        @keyframes mr-slamIn { 0% { transform: scale(2.5); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes mr-warningStripe { from { background-position-x: 0px } to { background-position-x: 40px } }
        @keyframes mr-flicker { 0%,100% { opacity: 1 } 5% { opacity: 0.3 } 10% { opacity: 1 } 15% { opacity: 0.5 } 20% { opacity: 1 } }
        @keyframes mr-fire { 0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.9 } 100% { transform: translateY(-120px) translateX(var(--fx)) scale(0.2); opacity: 0 } }
        @keyframes mr-skullSlam { 0% { transform: scale(3) translateY(-50px); opacity: 0 } 50% { transform: scale(1) translateY(10px); opacity: 1 } 70% { transform: scale(1.1) translateY(-5px) } 100% { transform: scale(1) translateY(0) } }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: revealed ? 'blur(8px)' : 'none',
        backgroundColor: revealed ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,1)',
        transition: 'background-color 0.3s, backdrop-filter 0.3s',
        animation: tier === 'close-loss' && revealed ? 'mr-tiltSnap 0.4s ease-out forwards' : undefined,
      }}>
        {/* Black screen overlay */}
        {!revealed && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#000', zIndex: 10000 }} />
        )}

        {/* === CATASTROPHIC effects === */}
        {tier === 'catastrophic' && revealed && (
          <>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'red', animation: 'mr-redFlash 0.2s ease-out forwards', pointerEvents: 'none', zIndex: 1 }} />
            <div style={{ position: 'absolute', inset: 0, animation: 'mr-screenShake 0.5s ease-out', pointerEvents: 'none', zIndex: 1 }} />
            {/* Fire particles */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={`fire-${i}`} style={{
                position: 'absolute', bottom: '10%',
                left: `${10 + rng(i * 7) * 80}%`,
                width: `${6 + rng(i * 3) * 8}px`, height: `${6 + rng(i * 3) * 8}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${rng(i) > 0.5 ? '#FF6B00' : '#FF2020'}, transparent)`,
                animation: `mr-fire ${1.5 + rng(i * 5) * 1.5}s ease-out ${rng(i * 2) * 0.8}s infinite`,
                ['--fx' as string]: `${(rng(i * 11) - 0.5) * 40}px`,
                pointerEvents: 'none', zIndex: 2,
                willChange: 'transform, opacity',
              } as React.CSSProperties} />
            ))}
            {/* Warning stripes top/bottom */}
            {['top', 'bottom'].map(pos => (
              <div key={pos} style={{
                position: 'absolute', [pos]: 0, left: 0, right: 0, height: '24px',
                background: 'repeating-linear-gradient(45deg, #000 0px, #000 10px, #cc0000 10px, #cc0000 20px)',
                backgroundSize: '40px 40px',
                animation: 'mr-warningStripe 0.5s linear infinite',
                pointerEvents: 'none', zIndex: 3, opacity: 0.8,
              }} />
            ))}
          </>
        )}

        {/* === WIN effects === */}
        {tier === 'win' && revealed && (
          <>
            {/* Spotlight beams */}
            {[0, 1].map(i => (
              <div key={`spot-${i}`} style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden', opacity: 0.15,
              }}>
                <div style={{
                  position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%',
                  background: `linear-gradient(${i ? '25deg' : '-25deg'}, transparent 40%, rgba(255,215,0,0.4) 50%, transparent 60%)`,
                  animation: `mr-spotlight ${3 + i}s ease-in-out ${i * 1.5}s infinite`,
                  willChange: 'transform',
                }} />
              </div>
            ))}
            {/* Gold coin particles */}
            {Array.from({ length: 20 }).map((_, i) => {
              const angle = (i / 20) * Math.PI * 2;
              const dist = 100 + rng(i * 13) * 150;
              return (
                <div key={`coin-${i}`} style={{
                  position: 'absolute', width: '12px', height: '12px', borderRadius: '50%',
                  background: 'radial-gradient(circle at 30% 30%, #FFE066, #B8860B)',
                  boxShadow: '0 0 4px rgba(255,215,0,0.6)',
                  ['--cx' as string]: `${Math.cos(angle) * dist}px`,
                  ['--cy' as string]: `${Math.sin(angle) * dist}px`,
                  animation: `mr-coin ${1 + rng(i * 7) * 0.8}s cubic-bezier(0.25,0.46,0.45,0.94) ${0.5 + rng(i * 3) * 0.5}s forwards`,
                  opacity: 0, pointerEvents: 'none', zIndex: 2,
                  willChange: 'transform, opacity',
                } as React.CSSProperties} />
              );
            })}
            {/* Confetti ribbons */}
            {Array.from({ length: 35 }).map((_, i) => {
              const colors = ['#FFD700', '#FF6B6B', '#4ade80', '#60a5fa', '#f59e0b', '#c084fc', '#fb7185', '#34d399'];
              return (
                <div key={`conf-${i}`} style={{
                  position: 'absolute', top: '-10px',
                  left: `${(i / 35) * 100}%`,
                  width: `${3 + rng(i * 2) * 4}px`, height: `${15 + rng(i * 5) * 15}px`,
                  backgroundColor: colors[i % colors.length],
                  borderRadius: '1px',
                  ['--drift' as string]: `${(rng(i * 9) - 0.5) * 80}px`,
                  ['--rot' as string]: `${rng(i * 4) * 720}deg`,
                  animation: `mr-confetti ${2.5 + rng(i * 6) * 2}s linear ${rng(i * 8) * 1.5}s infinite`,
                  pointerEvents: 'none', zIndex: 2, opacity: 0,
                  willChange: 'transform, opacity',
                } as React.CSSProperties} />
              );
            })}
          </>
        )}

        {/* === CLOSE WIN sparkles === */}
        {tier === 'close-win' && revealed && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`sp-${i}`} style={{
                position: 'absolute',
                left: `${10 + rng(i * 7) * 80}%`,
                top: `${10 + rng(i * 11) * 80}%`,
                width: '8px', height: '8px',
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                backgroundColor: '#e5e7eb',
                animation: `mr-sparkle ${1 + rng(i * 3) * 1}s ease-in-out ${rng(i * 5) * 1.5}s infinite`,
                pointerEvents: 'none', zIndex: 2,
                willChange: 'transform, opacity',
              }} />
            ))}
          </>
        )}

        {/* === CLOSE LOSS crack + amber flash === */}
        {tier === 'close-loss' && revealed && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255,176,0,1)',
              animation: 'mr-amberFlash 0.3s ease-out forwards',
              pointerEvents: 'none', zIndex: 3,
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: [
                'linear-gradient(0deg, transparent 49.5%, rgba(255,255,255,0.3) 49.5%, rgba(255,255,255,0.3) 50.5%, transparent 50.5%)',
                'linear-gradient(45deg, transparent 49.5%, rgba(255,255,255,0.2) 49.5%, rgba(255,255,255,0.2) 50.5%, transparent 50.5%)',
                'linear-gradient(-45deg, transparent 49.5%, rgba(255,255,255,0.2) 49.5%, rgba(255,255,255,0.2) 50.5%, transparent 50.5%)',
                'linear-gradient(90deg, transparent 49.5%, rgba(255,255,255,0.15) 49.5%, rgba(255,255,255,0.15) 50.5%, transparent 50.5%)',
                'linear-gradient(22deg, transparent 49.5%, rgba(255,255,255,0.15) 49.5%, rgba(255,255,255,0.15) 50.5%, transparent 50.5%)',
                'linear-gradient(-22deg, transparent 49.5%, rgba(255,255,255,0.1) 49.5%, rgba(255,255,255,0.1) 50.5%, transparent 50.5%)',
              ].join(', '),
              animation: 'mr-crackFade 3s ease-out 0.3s forwards',
              pointerEvents: 'none', zIndex: 2, opacity: 0.6,
            }} />
          </>
        )}

        {/* === LOSS red vignette === */}
        {tier === 'loss' && revealed && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(139,0,0,0.6) 100%)',
            animation: 'mr-redVignette 1s ease-out forwards',
            pointerEvents: 'none', zIndex: 1,
          }} />
        )}

        {/* === RESULT CARD === */}
        {revealed && (
          <div style={{
            position: 'relative', zIndex: 10,
            width: '340px', maxWidth: '90vw',
            perspective: tier === 'loss' ? '800px' : undefined,
          }}>
            {/* Catastrophic skull */}
            {tier === 'catastrophic' && (
              <div style={{
                textAlign: 'center', fontSize: '48px', color: '#cc0000',
                animation: 'mr-skullSlam 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                marginBottom: '8px', filter: 'drop-shadow(0 0 10px rgba(200,0,0,0.6))',
                willChange: 'transform, opacity',
              }}>☠</div>
            )}

            <div style={{
              position: 'relative',
              backgroundColor: '#1a1a2e',
              borderRadius: '16px',
              padding: '32px 24px 20px',
              border: tier === 'win' ? '2px solid #FFD700' : tier === 'catastrophic' ? '2px solid #cc0000' : '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
              transformStyle: tier === 'loss' ? 'preserve-3d' : undefined,
              animation: !flipped && tier === 'loss' ? undefined :
                tier === 'win' ? 'mr-winCard 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' :
                tier === 'close-win' ? 'mr-slideUp 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' :
                tier === 'close-loss' ? 'mr-dropIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards' :
                tier === 'loss' ? 'mr-cardFlip 0.6s ease-out forwards' :
                tier === 'catastrophic' ? 'mr-slamIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards' : undefined,
              willChange: 'transform, opacity',
              ...(tier === 'close-win' ? {
                animation: `mr-slideUp 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, mr-greenGlow 2s ease-in-out 0.7s infinite`,
              } : {}),
              // Loss card back (before flip)
              ...(!flipped && tier === 'loss' ? {
                background: `repeating-linear-gradient(45deg, #1a1a2e 0px, #1a1a2e 15px, #222244 15px, #222244 16px), repeating-linear-gradient(-45deg, #1a1a2e 0px, #1a1a2e 15px, #222244 15px, #222244 16px)`,
                transform: 'perspective(800px) rotateY(180deg)',
              } : {}),
              // VHS glitch on loss reveal
              ...(flipped && tier === 'loss' ? {
                animation: 'mr-cardFlip 0.6s ease-out forwards, mr-vhsGlitch 0.3s linear 0.6s',
              } : {}),
            }}>
              {/* Close-win shimmer overlay */}
              {tier === 'close-win' && (
                <div style={{
                  position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '16px', pointerEvents: 'none', zIndex: 1,
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)',
                    animation: 'mr-shimmer 2.5s ease-in-out 1s infinite',
                    willChange: 'transform',
                  }} />
                </div>
              )}

              {/* Win chase lights border */}
              {tier === 'win' && (
                <div style={{ position: 'absolute', inset: '-2px', borderRadius: '18px', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                  {Array.from({ length: 16 }).map((_, i) => {
                    const total = 16;
                    const pct = (i / total) * 100;
                    // Place dots around perimeter
                    const perim = 2 * (340 + 200); // approx perimeter
                    const pos = (i / total) * perim;
                    let x = 0, y = 0;
                    if (pos < 340) { x = pos; y = 0; }
                    else if (pos < 340 + 200) { x = 340; y = pos - 340; }
                    else if (pos < 680 + 200) { x = 340 - (pos - 540); y = 200; }
                    else { x = 0; y = 200 - (pos - 880); }
                    return (
                      <div key={`cl-${i}`} style={{
                        position: 'absolute',
                        left: `${(x / 344) * 100}%`, top: `${(y / 204) * 100}%`,
                        width: '4px', height: '4px', borderRadius: '50%',
                        backgroundColor: '#FFD700',
                        opacity: 0.8,
                        animation: `mr-sparkle 1s ease-in-out ${(i / total) * 1}s infinite`,
                      }} />
                    );
                  })}
                </div>
              )}

              {/* Card content */}
              <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                <h2 style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: tier === 'win' || tier === 'catastrophic' ? '32px' : '26px',
                  margin: '0 0 8px',
                  color: tier === 'win' ? '#FFD700' : tier === 'close-win' ? '#4ade80' : tier === 'close-loss' ? '#fbbf24' : tier === 'loss' ? '#f87171' : '#ef4444',
                  textShadow: tier === 'win' ? '0 0 20px rgba(255,215,0,0.6)' : tier === 'catastrophic' ? '0 0 15px rgba(255,0,0,0.5)' : undefined,
                  animation: tier === 'win' ? 'mr-goldCycle 2s ease-in-out infinite' : tier === 'catastrophic' ? 'mr-flicker 2s infinite' : undefined,
                  letterSpacing: '2px',
                }}>{title}</h2>

                <p style={{
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.8)',
                  margin: '0 0 16px',
                  lineHeight: 1.5,
                }}>
                  {tier === 'win' ? description : (
                    context === 'buying'
                      ? `${tier === 'close-win' ? 'GOT IT FOR' : 'LOST'} $${displayAmount}${tier === 'close-win' ? ' (50% OFF)' : tier === 'close-loss' ? ' (1.5× PENALTY)' : tier === 'loss' ? ' (2× PENALTY)' : ' (5× PENALTY)'}`
                      : `PAID $${displayAmount} RENT (${tier === 'close-win' ? '50%' : tier === 'close-loss' ? '1.5×' : tier === 'loss' ? '2×' : '5×'})`
                  )}
                </p>

                {/* Loss floating dollar signs */}
                {tier === 'loss' && flipped && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={`ds-${i}`} style={{
                        position: 'absolute',
                        left: `${(rng(i * 17) - 0.5) * 80}px`,
                        fontFamily: 'Cinzel, serif',
                        fontSize: '18px',
                        color: 'rgba(248,113,113,0.7)',
                        animation: `mr-floatUp 1.5s ease-out ${i * 0.2}s forwards`,
                        opacity: 0,
                        willChange: 'transform, opacity',
                      }}>$</span>
                    ))}
                  </div>
                )}

                {tier !== 'win' && (
                  <div style={{
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: '16px',
                  }}>BASE: ${baseAmount}</div>
                )}

                <button onClick={onDismiss} style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  padding: '10px 32px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #B8860B, #FFD700, #B8860B)',
                  color: '#1a1a2e',
                  cursor: 'pointer',
                  animation: 'mr-btnPulse 2s ease-in-out 1s infinite',
                  willChange: 'transform, box-shadow',
                  position: 'relative',
                  zIndex: 5,
                }}>CONTINUE</button>
              </div>

              {/* Auto-dismiss progress bar */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
                backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '0 0 16px 16px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #B8860B, #FFD700)',
                  animation: 'mr-progressBar 8s linear forwards',
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
