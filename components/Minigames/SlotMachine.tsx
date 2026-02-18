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
  skull: '/assets/minigames/slots/cherry.png',
};

export default function SlotMachine({ onResult, baseAmount, context, spectator = false }: SlotMachineProps) {
  const { play } = useAudio();
  const [reels, setReels] = useState<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [stopped, setStopped] = useState([false, false, false]);
  const [currentReel, setCurrentReel] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [leverPulled, setLeverPulled] = useState(false);
  const finalReelsRef = useRef<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const startTriggeredRef = useRef(false);

  const reelRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const doStartRef = useRef<(finals: SlotSymbol[]) => void>(() => {});

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'start') {
      doStartRef.current(data.finalReels);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 30000);
    setTimeoutId(timer);
    return () => { if (timer) clearTimeout(timer); };
  }, [onResult]);

  useEffect(() => {
    if (stopped.every(Boolean) && gameStarted) {
      if (timeoutId) clearTimeout(timeoutId);
      const [r1, r2, r3] = reels;
      if (r1 === 'skull' && r2 === 'skull' && r3 === 'skull') { onResult('catastrophic'); return; }
      if (r1 === r2 && r2 === r3) { onResult('win'); return; }
      const getIndex = (s: SlotSymbol) => SYMBOLS.indexOf(s);
      if (r1 === r2) { const d = Math.abs(getIndex(r2) - getIndex(r3)); if (d === 1 || d === SYMBOLS.length - 1) { onResult('close-win'); return; } }
      if (r2 === r3) { const d = Math.abs(getIndex(r1) - getIndex(r2)); if (d === 1 || d === SYMBOLS.length - 1) { onResult('close-win'); return; } }
      if (r1 === r2 || r2 === r3 || r1 === r3) { onResult('close-loss'); return; }
      onResult('loss');
    }
  }, [stopped]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopReelAuto = useCallback((reelIndex: number, intervals: any[], finalSymbol: SlotSymbol) => {
    if (intervals[reelIndex]) clearInterval(intervals[reelIndex]);
    if (reelRefs[reelIndex]?.current) {
      reelRefs[reelIndex].current!.classList.remove('pixelSpin');
    }
    play('minigames/slot-stop');
    setReels(prev => { const n = [...prev]; n[reelIndex] = finalSymbol; return n; });
    setStopped(prev => { const n = [...prev]; n[reelIndex] = true; return n; });
    setSpinning(prev => { const n = [...prev]; n[reelIndex] = false; return n; });
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps

  const doStart = useCallback((finals: SlotSymbol[]) => {
    if (startTriggeredRef.current) return;
    startTriggeredRef.current = true;
    finalReelsRef.current = finals;
    setGameStarted(true);
    setLeverPulled(true);
    setSpinning([true, true, true]);
    play('minigames/slot-spin');

    reelRefs.forEach((ref) => {
      if (ref.current) ref.current.classList.add('pixelSpin');
    });

    const spinIntervals = reelRefs.map((_, index) => {
      return setInterval(() => {
        setReels(prev => {
          const newReels = [...prev];
          newReels[index] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          return newReels;
        });
      }, 100);
    });

    (window as any).slotIntervals = spinIntervals;

    // Auto-stop reels with staggered timing
    setTimeout(() => stopReelAuto(0, spinIntervals, finals[0]), 1500);
    setTimeout(() => stopReelAuto(1, spinIntervals, finals[1]), 2500);
    setTimeout(() => stopReelAuto(2, spinIntervals, finals[2]), 3500);
  }, [play, stopReelAuto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync
  useEffect(() => { doStartRef.current = doStart; }, [doStart]);

  const startGame = () => {
    if (spectator || gameStarted) return;
    const finals: SlotSymbol[] = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    ];
    emitAction({ type: 'start', finalReels: finals });
    doStart(finals);
  };

  const stopReel = (reelIndex: number) => {
    if (reelIndex !== currentReel || stopped[reelIndex] || !spinning[reelIndex] || spectator) return;

    const intervals = (window as any).slotIntervals || [];
    if (intervals[reelIndex]) clearInterval(intervals[reelIndex]);

    if (reelRefs[reelIndex].current) {
      reelRefs[reelIndex].current!.classList.remove('pixelSpin');
    }

    const finalSymbol = finalReelsRef.current[reelIndex];
    play('minigames/slot-stop');
    setReels(prev => { const n = [...prev]; n[reelIndex] = finalSymbol; return n; });
    setStopped(prev => { const n = [...prev]; n[reelIndex] = true; return n; });
    setSpinning(prev => { const n = [...prev]; n[reelIndex] = false; return n; });
    setCurrentReel(currentReel + 1);
  };

  return (
    <div className="slotMachine pixelMinigame">
      <div className="slotFrame">
        <img src="/assets/minigames/slots/slot-machine.png" alt="" className="slotFrameImg" />
        <div className="slotHeader">
          <h2 className="slotTitle">SLOT MACHINE</h2>
          <div className={`slotLever ${leverPulled ? 'pulled' : ''}`} onClick={!gameStarted && !spectator ? startGame : undefined}>
            <div className="leverArm"></div>
            <div className="leverKnob"></div>
          </div>
        </div>

        <div className="slotReels">
          {reels.map((symbol, index) => (
            <div
              key={index}
              className={`slotReel ${stopped[index] ? 'stopped' : ''} ${currentReel === index && gameStarted && !stopped[index] ? 'active' : ''}`}
              onClick={() => stopReel(index)}
              ref={reelRefs[index]}
            >
              <div className="slotSymbol">
                <img src={SYMBOL_IMAGES[symbol]} alt={symbol} className="slotSymbolImg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="slotInstructions">
        {!gameStarted ? (
          <p>PULL THE LEVER!</p>
        ) : currentReel < 3 ? (
          <p>{spectator ? 'WATCHING...' : `TAP REEL ${currentReel + 1} TO STOP!`}</p>
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
