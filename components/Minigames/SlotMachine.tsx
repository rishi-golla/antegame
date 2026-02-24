'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface SlotMachineProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

type SlotSymbol = 'cherry' | 'seven' | 'diamond' | 'bar' | 'skull';

const SYMBOLS: SlotSymbol[] = ['cherry', 'seven', 'diamond', 'bar', 'skull'];
const SYMBOL_COUNT = SYMBOLS.length;
const SYMBOL_HEIGHT = 100;
const TOTAL_HEIGHT = SYMBOL_COUNT * SYMBOL_HEIGHT;

const SYMBOL_DISPLAY: Record<SlotSymbol, { char: string; color: string }> = {
  cherry: { char: '★', color: '#d4af37' },
  seven: { char: '7', color: '#ffd700' },
  diamond: { char: '★', color: '#f5e6a3' },
  bar: { char: '▪', color: '#e8d5b5' },
  skull: { char: '✕', color: '#ff1744' },
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@600;700;800&display=swap');

@keyframes slotChaseLight {
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}
@keyframes slotMarqueeFlash {
  0%, 100% { opacity: 1; text-shadow: 0 0 10px #ffd700, 0 0 30px #ffd700; }
  50% { opacity: 0.6; text-shadow: 0 0 5px #ffd700; }
}
@keyframes slotLeverPull {
  0% { transform: translateY(0); }
  40% { transform: translateY(50px); }
  100% { transform: translateY(0); }
}
@keyframes slotBulbPulse {
  0%, 100% { box-shadow: 0 0 12px rgba(255,215,0,0.8), 0 0 24px rgba(255,140,0,0.5), 0 0 40px rgba(255,215,0,0.3); transform: scale(1); }
  50% { box-shadow: 0 0 20px rgba(255,215,0,1), 0 0 40px rgba(255,140,0,0.8), 0 0 60px rgba(255,215,0,0.5); transform: scale(1.1); }
}
@keyframes slotBounce {
  0% { transform: translateY(var(--land-y)); }
  50% { transform: translateY(calc(var(--land-y) - 8px)); }
  100% { transform: translateY(var(--land-y)); }
}
@keyframes slotJackpot {
  0%, 100% { box-shadow: inset 0 0 30px rgba(255,215,0,0.3), 0 0 20px rgba(255,215,0,0.5); }
  50% { box-shadow: inset 0 0 60px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.8); }
}
@keyframes slotShake1 {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
@keyframes slotShake2 {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px) rotate(-1deg); }
  75% { transform: translateX(6px) rotate(1deg); }
}
@keyframes winLineGlow {
  0%, 100% { box-shadow: 0 0 6px #ffd700, 0 0 12px #ffd700; opacity: 0.8; }
  50% { box-shadow: 0 0 12px #ffd700, 0 0 24px #ffd700, 0 0 36px rgba(255,215,0,0.4); opacity: 1; }
}
@keyframes slotHeartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
`;

export default function SlotMachine({ onResult, baseAmount, context, spectator = false }: SlotMachineProps) {
  const { play } = useAudio();
  const [leverPulled, setLeverPulled] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'stopping' | 'done'>('idle');
  const [stoppedReels, setStoppedReels] = useState([false, false, false]);
  const [heartbeatEffect, setHeartbeatEffect] = useState(false);
  const [screenShake, setScreenShake] = useState(0);
  const [jackpot, setJackpot] = useState(false);

  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const animFrameRef = useRef<number | null>(null);
  const posRef = useRef([0, 0, 0]);
  const speedRef = useRef([0, 0, 0]);
  const finalSymbolsRef = useRef<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const stoppingRef = useRef([false, false, false]);
  const stoppedCountRef = useRef(0);
  const endedRef = useRef(false);
  const initRef = useRef(false);

  const doStartRef = useRef<(finals: SlotSymbol[]) => void>(() => {});

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'start') {
      doStartRef.current(data.finalReels);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  const checkResult = useCallback((finals: SlotSymbol[]) => {
    if (endedRef.current) return;
    endedRef.current = true;

    const [r1, r2, r3] = finals;
    if (r1 === 'skull' && r2 === 'skull' && r3 === 'skull') { onResult('catastrophic'); return; }
    if (r1 === r2 && r2 === r3) { setJackpot(true); onResult('win'); return; }

    // Two matching reels = close-win (player was close to a triple)
    if (r1 === r2 || r2 === r3 || r1 === r3) { onResult('close-win'); return; }
    onResult('loss');
  }, [onResult]);

  const landReel = useCallback((reelIndex: number) => {
    const symbol = finalSymbolsRef.current[reelIndex];
    const targetIdx = SYMBOLS.indexOf(symbol);
    const targetPos = targetIdx * SYMBOL_HEIGHT;
    posRef.current[reelIndex] = targetPos;
    speedRef.current[reelIndex] = 0;
    stoppingRef.current[reelIndex] = true;

    const strip = stripRefs.current[reelIndex];
    if (strip) {
      strip.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.4)';
      strip.style.transform = `translateY(-${targetPos}px)`;
      strip.style.filter = 'none';
    }

    play('minigames/slot-stop');
    stoppedCountRef.current++;

    setStoppedReels(prev => {
      const next = [...prev];
      next[reelIndex] = true;
      return next;
    });

    if (reelIndex === 2) {
      const [r1, r2] = finalSymbolsRef.current;
      const r3 = symbol;
      if (r1 === r2 || r2 === r3 || r1 === r3) {
        setHeartbeatEffect(true);
        setScreenShake(r1 === r2 && r2 === r3 ? 2 : 1);
        setTimeout(() => { setHeartbeatEffect(false); setScreenShake(0); }, 1000);
      }
    }

    if (stoppedCountRef.current >= 3) {
      setPhase('done');
      setTimeout(() => checkResult(finalSymbolsRef.current), 500);
    }
  }, [play, checkResult]);

  const animate = useCallback(() => {
    for (let i = 0; i < 3; i++) {
      if (speedRef.current[i] > 0 && !stoppingRef.current[i]) {
        posRef.current[i] = (posRef.current[i] + speedRef.current[i]) % TOTAL_HEIGHT;
        const strip = stripRefs.current[i];
        if (strip) {
          strip.style.transition = 'none';
          strip.style.transform = `translateY(-${posRef.current[i]}px)`;
          const blur = Math.min(speedRef.current[i] * 0.3, 6);
          strip.style.filter = `blur(${blur}px)`;
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const doStart = useCallback((finals: SlotSymbol[]) => {
    if (initRef.current) return;
    initRef.current = true;
    finalSymbolsRef.current = finals;
    stoppedCountRef.current = 0;
    stoppingRef.current = [false, false, false];

    speedRef.current = [14, 18, 22];
    setPhase('spinning');

    play('minigames/slot-spin');

    setTimeout(() => landReel(0), 2000);
    setTimeout(() => landReel(1), 3200);
    setTimeout(() => landReel(2), 4600);
  }, [play, landReel]);

  useEffect(() => { doStartRef.current = doStart; }, [doStart]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [animate]);

  const handlePullLever = useCallback(() => {
    if (spectator || leverPulled) return;
    setLeverPulled(true);

    const finals: SlotSymbol[] = [
      SYMBOLS[Math.floor(Math.random() * SYMBOL_COUNT)],
      SYMBOLS[Math.floor(Math.random() * SYMBOL_COUNT)],
      SYMBOLS[Math.floor(Math.random() * SYMBOL_COUNT)],
    ];
    emitAction({ type: 'start', finalReels: finals });
    setTimeout(() => doStart(finals), 800);
  }, [spectator, leverPulled, emitAction, doStart]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        onResult('catastrophic');
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const renderStrip = (reelIndex: number) => {
    const symbols = [...SYMBOLS, ...SYMBOLS, ...SYMBOLS];
    return symbols.map((sym, i) => {
      const display = SYMBOL_DISPLAY[sym];
      return (
        <div
          key={`${reelIndex}-${i}`}
          style={{
            height: SYMBOL_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: sym === 'seven' ? 'Cinzel, serif' : 'Nunito, sans-serif',
            fontSize: sym === 'seven' ? 56 : 48,
            fontWeight: 900,
            color: display.color,
            textShadow: `0 0 8px ${display.color}44, 0 2px 4px rgba(0,0,0,0.5)`,
          }}
        >
          {display.char}
        </div>
      );
    });
  };

  // Rivet component
  const Rivet = ({ top, left }: { top: number | string; left: number | string }) => (
    <div style={{
      position: 'absolute', top, left, width: 10, height: 10, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 35%, #d4af37, #8b6914)',
      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.6), 0 0 4px rgba(212,175,55,0.3)',
      zIndex: 10,
    }} />
  );

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
        animation: screenShake === 2 ? 'slotShake2 0.15s infinite' : screenShake === 1 ? 'slotShake1 0.15s infinite' : heartbeatEffect ? 'slotHeartbeat 0.4s infinite' : 'none',
      }}>
        {/* Machine body */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(180deg, #2e1a1a 0%, #2a0f1f 40%, #1a0f0f 100%)',
          border: '3px solid transparent',
          borderImage: 'linear-gradient(180deg, #c9a84c, #8b6914, #c9a84c) 1',
          borderRadius: 12,
          padding: 0,
          width: 420,
          boxShadow: jackpot
            ? '0 0 40px rgba(255,215,0,0.6), inset 0 0 30px rgba(255,215,0,0.2)'
            : '0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
          animation: jackpot ? 'slotJackpot 0.5s infinite' : 'none',
          overflow: 'hidden',
        }}>
          {/* Rivets */}
          <Rivet top={6} left={6} />
          <Rivet top={6} left="calc(100% - 16px)" />
          <Rivet top="calc(100% - 16px)" left={6} />
          <Rivet top="calc(100% - 16px)" left="calc(100% - 16px)" />

          {/* Top marquee */}
          <div style={{
            background: 'linear-gradient(90deg, #1a0f0f, #3d0f22, #1a0f0f)',
            padding: '10px 0',
            textAlign: 'center',
            borderBottom: '2px solid #c9a84c',
          }}>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: 28,
              fontWeight: 900,
              color: '#ffd700',
              letterSpacing: 4,
              animation: phase === 'done' && jackpot ? 'slotMarqueeFlash 0.3s infinite' : 'none',
              textShadow: '0 0 10px rgba(255,215,0,0.5)',
            }}>
              ANTE SLOTS
            </span>
          </div>

          {/* Reel area */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 0,
            padding: '20px 28px',
            position: 'relative',
            background: 'linear-gradient(180deg, #1a0f0f, #0d0505, #1a0f0f)',
          }}>
            {[0, 1, 2].map((reelIndex) => (
              <div key={reelIndex} style={{ display: 'flex', alignItems: 'center' }}>
                {reelIndex > 0 && (
                  <div style={{
                    width: 3, height: SYMBOL_HEIGHT + 10,
                    background: 'linear-gradient(180deg, #666, #ccc, #666)',
                    borderRadius: 2,
                    boxShadow: '0 0 4px rgba(255,255,255,0.2)',
                  }} />
                )}
                <div style={{
                  width: 100, height: SYMBOL_HEIGHT, overflow: 'hidden',
                  position: 'relative',
                  background: '#1a0f0f',
                  boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8), inset 0 0 6px rgba(0,0,0,0.5)',
                  borderRadius: 4,
                  margin: '0 2px',
                }}>
                  <div ref={(el) => { stripRefs.current[reelIndex] = el; }}>
                    {renderStrip(reelIndex)}
                  </div>
                </div>
              </div>
            ))}

            {/* Win line */}
            <div style={{
              position: 'absolute',
              left: 16, right: 16,
              top: '50%',
              height: 2,
              background: '#ffd700',
              transform: 'translateY(-50%)',
              opacity: phase === 'done' ? 1 : 0.3,
              animation: phase === 'done' ? 'winLineGlow 0.8s infinite' : 'none',
              zIndex: 5,
              pointerEvents: 'none',
              borderRadius: 1,
            }} />
          </div>

          {/* Status bar */}
          <div style={{
            background: 'linear-gradient(90deg, #1a0f0f, #2a0f1f, #1a0f0f)',
            padding: '8px 0',
            textAlign: 'center',
            borderTop: '2px solid #c9a84c',
            fontFamily: 'Nunito, sans-serif',
            fontSize: 16,
            fontWeight: 700,
            color: '#c9a84c',
            letterSpacing: 2,
          }}>
            {phase === 'idle' && 'GET READY...'}
            {phase === 'spinning' && 'SPINNING...'}
            {phase === 'stopping' && 'STOPPING...'}
            {phase === 'done' && (jackpot ? 'JACKPOT!' : 'RESULT!')}
          </div>

          {/* Coin tray */}
          <div style={{
            height: 12,
            background: 'linear-gradient(180deg, rgba(212,175,55,0.15), rgba(255,215,0,0.05), transparent)',
            borderTop: '1px solid rgba(212,175,55,0.2)',
          }} />
        </div>

        {/* Lever */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginLeft: -4, width: 44,
          cursor: leverPulled ? 'default' : 'pointer',
        }}
          onClick={handlePullLever}
        >
          {/* Glowing bulb on top */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: leverPulled
              ? 'radial-gradient(circle at 35% 35%, #8b6914, #5a4a20)'
              : 'radial-gradient(circle at 35% 35%, #fff8a0, #ffd700, #ff8c00)',
            boxShadow: leverPulled
              ? '0 2px 6px rgba(0,0,0,0.5)'
              : '0 0 12px rgba(255,215,0,0.8), 0 0 24px rgba(255,140,0,0.5), 0 0 40px rgba(255,215,0,0.3), inset 0 1px 2px rgba(255,255,255,0.6)',
            animation: leverPulled ? 'slotLeverPull 0.8s ease-out' : 'slotBulbPulse 1s ease-in-out infinite',
            zIndex: 2,
            transition: 'all 0.3s ease',
          }} />
          {/* Lever shaft */}
          <div style={{
            width: 8, height: 100,
            background: 'linear-gradient(90deg, #8b6914, #d4af37, #8b6914)',
            borderRadius: 3,
            boxShadow: '1px 0 3px rgba(0,0,0,0.3)',
            marginTop: -2,
          }} />
          {/* Base */}
          <div style={{
            width: 16, height: 8,
            background: 'linear-gradient(180deg, #8b6914, #5a4a20)',
            borderRadius: '0 0 4px 4px',
          }} />
        </div>
      </div>

      {/* Paytable */}
      <div style={{
        marginTop: 12,
        padding: '8px 16px',
        background: 'rgba(0,0,0,0.4)',
        borderRadius: 8,
        border: '1px solid #c9a84c33',
        fontFamily: 'Nunito, sans-serif',
        fontSize: 11,
        color: '#999',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          {SYMBOLS.filter(s => s !== 'skull').map(s => (
            <span key={s} style={{ color: SYMBOL_DISPLAY[s].color, fontSize: 16, fontWeight: 900 }}>
              {SYMBOL_DISPLAY[s].char}
            </span>
          ))}
          <span>×3 = BIG WIN</span>
        </div>
        <div>2 Match + Near = Close Win</div>
        <div style={{ color: '#ff4444' }}>
          <span style={{ fontWeight: 900 }}>✕</span> ×3 = CATASTROPHIC
        </div>
      </div>
    </>
  );
}
