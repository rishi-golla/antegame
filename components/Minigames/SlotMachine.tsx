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
const SYMBOL_HEIGHT = 80; // px per symbol cell
const TOTAL_HEIGHT = SYMBOL_COUNT * SYMBOL_HEIGHT;

const SYMBOL_IMAGES: Record<SlotSymbol, string> = {
  cherry: '/assets/minigames/slots/cherry.png',
  seven: '/assets/minigames/slots/seven.png',
  diamond: '/assets/minigames/slots/diamond.png',
  bar: '/assets/minigames/slots/bar.png',
  skull: '/assets/minigames/slots/skull.png',
};

export default function SlotMachine({ onResult, baseAmount, context, spectator = false }: SlotMachineProps) {
  const { play } = useAudio();
  const [leverPulled, setLeverPulled] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'stopping' | 'done'>('idle');
  const [stoppedReels, setStoppedReels] = useState([false, false, false]);
  const [heartbeatEffect, setHeartbeatEffect] = useState(false);
  const [screenShake, setScreenShake] = useState(0);

  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const animFrameRef = useRef<number | null>(null);
  const posRef = useRef([0, 0, 0]); // current pixel offset
  const speedRef = useRef([0, 0, 0]); // pixels per frame
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
    if (r1 === r2 && r2 === r3) { onResult('win'); return; }

    const idx = (s: SlotSymbol) => SYMBOLS.indexOf(s);
    if (r1 === r2) {
      const d = Math.abs(idx(r2) - idx(r3));
      if (d === 1 || d === SYMBOL_COUNT - 1) { onResult('close-win'); return; }
    }
    if (r2 === r3) {
      const d = Math.abs(idx(r1) - idx(r2));
      if (d === 1 || d === SYMBOL_COUNT - 1) { onResult('close-win'); return; }
    }
    if (r1 === r2 || r2 === r3 || r1 === r3) { onResult('close-loss'); return; }
    onResult('loss');
  }, [onResult]);

  // Land a reel on its target symbol
  const landReel = useCallback((reelIndex: number) => {
    const symbol = finalSymbolsRef.current[reelIndex];
    const targetIdx = SYMBOLS.indexOf(symbol);
    // Position so the target symbol is centered in the window
    const targetPos = targetIdx * SYMBOL_HEIGHT;
    posRef.current[reelIndex] = targetPos;
    speedRef.current[reelIndex] = 0;
    stoppingRef.current[reelIndex] = true;

    // Update the strip position with a bounce
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

    // Effects on last reel
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

  // Animation loop — continuously scroll strips
  const animate = useCallback(() => {
    for (let i = 0; i < 3; i++) {
      if (speedRef.current[i] > 0 && !stoppingRef.current[i]) {
        posRef.current[i] = (posRef.current[i] + speedRef.current[i]) % TOTAL_HEIGHT;
        const strip = stripRefs.current[i];
        if (strip) {
          strip.style.transition = 'none';
          strip.style.transform = `translateY(-${posRef.current[i]}px)`;
          // Motion blur based on speed
          const blur = Math.min(speedRef.current[i] * 0.3, 6);
          strip.style.filter = `blur(${blur}px)`;
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Start spinning
  const doStart = useCallback((finals: SlotSymbol[]) => {
    if (initRef.current) return;
    initRef.current = true;
    finalSymbolsRef.current = finals;
    stoppedCountRef.current = 0;
    stoppingRef.current = [false, false, false];

    // Set initial speeds (pixels per frame at ~60fps)
    speedRef.current = [14, 18, 22];
    setPhase('spinning');

    play('minigames/slot-spin');

    // Stagger stops
    setTimeout(() => landReel(0), 2000);
    setTimeout(() => landReel(1), 3200);
    setTimeout(() => landReel(2), 4600);
  }, [play, landReel]);

  useEffect(() => { doStartRef.current = doStart; }, [doStart]);

  // Start animation loop on mount
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [animate]);

  // Auto-start sequence: lever pull → spin
  useEffect(() => {
    if (spectator) return;

    const startGame = () => {
      const finals: SlotSymbol[] = [
        SYMBOLS[Math.floor(Math.random() * SYMBOL_COUNT)],
        SYMBOLS[Math.floor(Math.random() * SYMBOL_COUNT)],
        SYMBOLS[Math.floor(Math.random() * SYMBOL_COUNT)],
      ];
      emitAction({ type: 'start', finalReels: finals });
      doStart(finals);
    };

    // Pull lever after a beat
    const leverTimer = setTimeout(() => setLeverPulled(true), 500);
    // Start spinning after lever animation
    const spinTimer = setTimeout(startGame, 1400);

    return () => { clearTimeout(leverTimer); clearTimeout(spinTimer); };
  }, [spectator, emitAction, doStart]);

  // Safety timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        onResult('catastrophic');
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, [onResult]);

  // Build the symbol strip (repeat 3x for seamless looping)
  const renderStrip = (reelIndex: number) => {
    const symbols = [...SYMBOLS, ...SYMBOLS, ...SYMBOLS];
    return symbols.map((sym, i) => (
      <div
        key={`${reelIndex}-${i}`}
        className="slotSymbolCell"
      >
        <img
          src={SYMBOL_IMAGES[sym]}
          alt={sym}
          className="slotSymbolImg"
          draggable={false}
        />
      </div>
    ));
  };

  return (
    <div className={`slotMachine ${heartbeatEffect ? 'slot-heartbeat' : ''} ${screenShake > 0 ? `slot-shake-${screenShake}` : ''}`}>
      {/* Lever */}
      <div className={`slotLeverWrap ${leverPulled ? 'pulled' : 'ready'}`}>
        <div className="leverTrack">
          <div className="leverArmNew" />
          <div className="leverBall" />
        </div>
      </div>

      {/* Machine body */}
      <div className="slotBody">
        <div className="slotTopBar">
          <span className="slotTopText">★ ANTE SLOTS ★</span>
        </div>

        <div className="slotReelContainer">
          {[0, 1, 2].map((reelIndex) => (
            <div key={reelIndex} className={`slotReelNew ${stoppedReels[reelIndex] ? 'stopped' : ''}`}>
              <div
                className="slotStrip"
                ref={(el) => { stripRefs.current[reelIndex] = el; }}
              >
                {renderStrip(reelIndex)}
              </div>
              {/* Center line indicator */}
              <div className="reelCenterLine" />
            </div>
          ))}
        </div>

        <div className="slotBottomBar">
          {phase === 'idle' && <span>GET READY...</span>}
          {phase === 'spinning' && <span>SPINNING...</span>}
          {phase === 'stopping' && <span>STOPPING...</span>}
          {phase === 'done' && <span>RESULT!</span>}
        </div>
      </div>

      {/* Paytable */}
      <div className="slotPaytable">
        <div className="paytableRow">
          {SYMBOLS.filter(s => s !== 'skull').map(s => (
            <img key={s} src={SYMBOL_IMAGES[s]} className="paytableIcon" alt={s} />
          ))}
          <span>×3 = BIG WIN</span>
        </div>
        <div className="paytableRow"><span>2 Match + Near = Close Win</span></div>
        <div className="paytableRow">
          <img src={SYMBOL_IMAGES.skull} className="paytableIcon" alt="skull" />
          <span>×3 = CATASTROPHIC</span>
        </div>
      </div>
    </div>
  );
}
