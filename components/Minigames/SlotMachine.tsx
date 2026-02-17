'use client';

import { useState, useEffect, useRef } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface SlotMachineProps {
  onResult: (tier: MinigameTier) => void;
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
  skull: '/assets/minigames/slots/cherry.png', // skull uses cherry placeholder
};

export default function SlotMachine({ onResult, baseAmount, context }: SlotMachineProps) {
  const [reels, setReels] = useState<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [stopped, setStopped] = useState([false, false, false]);
  const [currentReel, setCurrentReel] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [leverPulled, setLeverPulled] = useState(false);

  const reelRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    const timer = setTimeout(() => {
      onResult('catastrophic');
    }, 30000);
    setTimeoutId(timer);
    return () => { if (timer) clearTimeout(timer); };
  }, [onResult]);

  useEffect(() => {
    if (stopped.every(Boolean)) {
      if (timeoutId) clearTimeout(timeoutId);
      calculateResult();
    }
  }, [stopped]);

  const startGame = () => {
    setGameStarted(true);
    setLeverPulled(true);
    setSpinning([true, true, true]);

    reelRefs.forEach((ref) => {
      if (ref.current) {
        ref.current.classList.add('pixelSpin');
      }
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
  };

  const stopReel = (reelIndex: number) => {
    if (reelIndex !== currentReel || stopped[reelIndex] || !spinning[reelIndex]) return;

    const intervals = (window as any).slotIntervals || [];
    if (intervals[reelIndex]) clearInterval(intervals[reelIndex]);

    if (reelRefs[reelIndex].current) {
      reelRefs[reelIndex].current!.classList.remove('pixelSpin');
    }

    const finalSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    setReels(prev => { const n = [...prev]; n[reelIndex] = finalSymbol; return n; });

    setStopped(prev => { const n = [...prev]; n[reelIndex] = true; return n; });
    setSpinning(prev => { const n = [...prev]; n[reelIndex] = false; return n; });
    setCurrentReel(currentReel + 1);
  };

  const calculateResult = () => {
    const [r1, r2, r3] = reels;
    if (r1 === 'skull' && r2 === 'skull' && r3 === 'skull') { onResult('catastrophic'); return; }
    if (r1 === r2 && r2 === r3) { onResult('win'); return; }
    const getIndex = (s: SlotSymbol) => SYMBOLS.indexOf(s);
    if (r1 === r2) { const d = Math.abs(getIndex(r2) - getIndex(r3)); if (d === 1 || d === SYMBOLS.length - 1) { onResult('close-win'); return; } }
    if (r2 === r3) { const d = Math.abs(getIndex(r1) - getIndex(r2)); if (d === 1 || d === SYMBOLS.length - 1) { onResult('close-win'); return; } }
    if (r1 === r2 || r2 === r3 || r1 === r3) { onResult('close-loss'); return; }
    onResult('loss');
  };

  return (
    <div className="slotMachine pixelMinigame">
      <div className="slotFrame">
        <img src="/assets/minigames/slots/slot-machine.png" alt="" className="slotFrameImg" />
        <div className="slotHeader">
          <h2 className="slotTitle">SLOT MACHINE</h2>
          <div className={`slotLever ${leverPulled ? 'pulled' : ''}`} onClick={!gameStarted ? startGame : undefined}>
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
          <p>TAP REEL {currentReel + 1} TO STOP!</p>
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
