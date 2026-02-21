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

const SYMBOL_IMAGES: Record<SlotSymbol, string> = {
  cherry: '/assets/minigames/slots/cherry.png',
  seven: '/assets/minigames/slots/seven.png',
  diamond: '/assets/minigames/slots/diamond.png',
  bar: '/assets/minigames/slots/bar.png',
  skull: '/assets/minigames/slots/skull.png',
};

const REEL_SYMBOLS_EXTENDED = [
  ['cherry', 'seven', 'diamond', 'bar', 'skull', 'cherry', 'diamond', 'bar', 'seven', 'cherry', 'skull', 'diamond', 'bar', 'seven', 'cherry', 'diamond', 'skull', 'bar', 'seven', 'cherry'],
  ['bar', 'cherry', 'skull', 'diamond', 'seven', 'bar', 'cherry', 'diamond', 'skull', 'bar', 'seven', 'cherry', 'diamond', 'bar', 'skull', 'seven', 'cherry', 'bar', 'diamond', 'skull'],
  ['skull', 'bar', 'seven', 'cherry', 'diamond', 'skull', 'bar', 'cherry', 'seven', 'skull', 'diamond', 'bar', 'cherry', 'skull', 'seven', 'diamond', 'bar', 'skull', 'cherry', 'seven']
];

export default function SlotMachine({ onResult, baseAmount, context, spectator = false }: SlotMachineProps) {
  const { play } = useAudio();

  // All state in refs
  const reelsRef = useRef<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const spinningRef = useRef([false, false, false]);
  const stoppedRef = useRef([false, false, false]);
  const finalReelsRef = useRef<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const initRef = useRef(false);
  const endedRef = useRef(false);
  const positionsRef = useRef([0, 0, 0]);
  const velocitiesRef = useRef([0, 0, 0]);
  const blurRef = useRef([0, 0, 0]);
  const animRef = useRef<number | null>(null);

  // Render state
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const [leverPulled, setLeverPulled] = useState(false);
  const [heartbeatEffect, setHeartbeatEffect] = useState(false);
  const [screenShake, setScreenShake] = useState(0);

  const doStartRef = useRef<(finals: SlotSymbol[]) => void>(() => {});

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'start') {
      doStartRef.current(data.finalReels);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  // Check result when all reels stopped
  const checkResult = useCallback(() => {
    if (endedRef.current) return;
    if (!stoppedRef.current.every(Boolean)) return;

    endedRef.current = true;
    const [r1, r2, r3] = reelsRef.current;

    if (r1 === 'skull' && r2 === 'skull' && r3 === 'skull') { onResult('catastrophic'); return; }
    if (r1 === r2 && r2 === r3) { onResult('win'); return; }

    const getIndex = (s: SlotSymbol) => SYMBOLS.indexOf(s);
    if (r1 === r2) {
      const d = Math.abs(getIndex(r2) - getIndex(r3));
      if (d === 1 || d === SYMBOLS.length - 1) { onResult('close-win'); return; }
    }
    if (r2 === r3) {
      const d = Math.abs(getIndex(r1) - getIndex(r2));
      if (d === 1 || d === SYMBOLS.length - 1) { onResult('close-win'); return; }
    }
    if (r1 === r2 || r2 === r3 || r1 === r3) { onResult('close-loss'); return; }
    onResult('loss');
  }, [onResult]);

  // Stop a single reel
  const stopReel = useCallback((reelIndex: number) => {
    const finalSymbol = finalReelsRef.current[reelIndex];
    reelsRef.current[reelIndex] = finalSymbol;
    spinningRef.current[reelIndex] = false;
    stoppedRef.current[reelIndex] = true;
    velocitiesRef.current[reelIndex] = 0;
    blurRef.current[reelIndex] = 0;

    // Snap position to final symbol
    const targetPos = REEL_SYMBOLS_EXTENDED[reelIndex].indexOf(finalSymbol) * 60;
    positionsRef.current[reelIndex] = targetPos;

    play('minigames/slot-stop');
    rerender();

    // Special effects for last reel
    if (reelIndex === 2) {
      const [r1, r2] = finalReelsRef.current;
      const r3 = finalSymbol;
      const willBeClose = (r1 === r2) || (r2 === r3 && r1 !== r2) || (r1 === r3 && r1 !== r2);
      if (willBeClose) {
        setHeartbeatEffect(true);
        setScreenShake(r1 === r2 ? 2 : 1);
        setTimeout(() => { setHeartbeatEffect(false); setScreenShake(0); }, 1000);
      }
    }

    checkResult();
  }, [play, checkResult]);

  // Start spinning
  const doStart = useCallback((finals: SlotSymbol[]) => {
    if (initRef.current) return;
    initRef.current = true;
    finalReelsRef.current = finals;
    setLeverPulled(true);

    spinningRef.current = [true, true, true];
    stoppedRef.current = [false, false, false];
    velocitiesRef.current = [
      12 + Math.random() * 3,
      15 + Math.random() * 3,
      18 + Math.random() * 3
    ];

    play('minigames/slot-spin');
    rerender();

    // Auto-stop reels with staggered timing
    setTimeout(() => stopReel(0), 1800);
    setTimeout(() => stopReel(1), 2800);
    setTimeout(() => stopReel(2), 4200);
  }, [play, stopReel]);

  useEffect(() => { doStartRef.current = doStart; }, [doStart]);

  // Pull lever to start
  const pullLever = useCallback(() => {
    if (initRef.current || spectator) return;

    const finals: SlotSymbol[] = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ];

    emitAction({ type: 'start', finalReels: finals });
    doStart(finals);
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

  // Animation loop
  useEffect(() => {
    const animate = () => {
      let needsUpdate = false;
      for (let i = 0; i < 3; i++) {
        if (spinningRef.current[i]) {
          positionsRef.current[i] = (positionsRef.current[i] + velocitiesRef.current[i]) % (REEL_SYMBOLS_EXTENDED[i].length * 60);
          // Gradual deceleration
          velocitiesRef.current[i] *= 0.998;
          blurRef.current[i] = Math.min(velocitiesRef.current[i] * 0.5, 12);
          needsUpdate = true;
        }
      }
      if (needsUpdate) {
        rerender();
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const spinning = spinningRef.current;
  const stopped = stoppedRef.current;

  return (
    <div className={`slotMachine pixelMinigame ${heartbeatEffect ? 'slot-heartbeat' : ''} ${screenShake > 0 ? `slot-shake-${screenShake}` : ''}`}>
      <div className="slotFrame">
        <img src="/assets/minigames/slots/slot-machine.png" alt="" className="slotFrameImg" />
        <div className="slotHeader">
          <h2 className="slotTitle">SLOT MACHINE</h2>
          <div className={`slotLever ${leverPulled ? 'pulled' : 'ready'}`} onClick={pullLever}>
            <div className="leverArm"></div>
            <div className="leverKnob"></div>
          </div>
        </div>

        <div className="slotReels">
          {reelsRef.current.map((symbol, index) => (
            <div
              key={index}
              className={`slotReel ${stopped[index] ? 'stopped' : ''} ${spinning[index] ? 'active' : ''}`}
            >
              <div className="reel-window">
                <div
                  className="reel-strip"
                  style={{
                    transform: `translateY(-${positionsRef.current[index]}px)`,
                    filter: stopped[index] ? 'none' : `blur(${blurRef.current[index]}px)`,
                    transition: stopped[index] ? 'filter 0.2s ease-out' : 'none'
                  }}
                >
                  {REEL_SYMBOLS_EXTENDED[index].concat(REEL_SYMBOLS_EXTENDED[index]).map((sym, symIndex) => (
                    <div
                      key={`${index}-${symIndex}`}
                      className={`reel-symbol ${sym}`}
                      style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <img
                        src={SYMBOL_IMAGES[sym as SlotSymbol]}
                        alt={sym}
                        className="reel-symbol-img"
                        style={{ width: '40px', height: '40px' }}
                      />
                    </div>
                  ))}
                </div>
                <div className="reel-window-overlay">
                  <div className="reel-center-highlight" />
                </div>
              </div>
              <div className={`reel-lights ${spinning[index] ? 'chasing' : ''}`}>
                <div className="light-strip left">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="light-bulb" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <div className="light-strip right">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="light-bulb" style={{ animationDelay: `${i * 0.1 + 0.3}s` }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="slotInstructions">
        {!initRef.current ? (
          <p>PULL THE LEVER!</p>
        ) : !stopped.every(Boolean) ? (
          <p>SPINNING...</p>
        ) : (
          <p>CALCULATING...</p>
        )}
      </div>

      <div className="slotPaytable">
        <div className="paytableRow"><img src={SYMBOL_IMAGES.cherry} className="paytableIcon" alt="" />×3 = WIN</div>
        <div className="paytableRow">TWO + ADJACENT = CLOSE WIN</div>
        <div className="paytableRow">TWO MATCHING = CLOSE LOSS</div>
        <div className="paytableRow">NO MATCH = LOSS</div>
      </div>
    </div>
  );
}
