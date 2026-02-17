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

const SYMBOL_DISPLAY: Record<SlotSymbol, string> = {
  cherry: '🍒',
  seven: '7️⃣',
  diamond: '💎',
  bar: '📊',
  skull: '💀'
};

export default function SlotMachine({ onResult, baseAmount, context }: SlotMachineProps) {
  const [reels, setReels] = useState<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const [spinning, setSpinning] = useState([false, false, false]);
  const [stopped, setStopped] = useState([false, false, false]);
  const [currentReel, setCurrentReel] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const reelRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    // 15-second timeout
    const timer = setTimeout(() => {
      onResult('catastrophic');
    }, 15000);
    setTimeoutId(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [onResult]);

  useEffect(() => {
    // Auto-resolve when all reels are stopped
    if (stopped.every(Boolean)) {
      if (timeoutId) clearTimeout(timeoutId);
      calculateResult();
    }
  }, [stopped]);

  const startGame = () => {
    setGameStarted(true);
    setSpinning([true, true, true]);
    
    // Start spinning animation for all reels
    reelRefs.forEach((ref, index) => {
      if (ref.current) {
        ref.current.style.animation = 'slotSpin 0.1s steps(5) infinite';
      }
    });

    // Auto-spin each reel with randomized symbols
    const spinIntervals = reelRefs.map((ref, index) => {
      return setInterval(() => {
        const newReels = [...reels];
        newReels[index] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        setReels(newReels);
      }, 100);
    });

    // Store intervals for cleanup
    (window as any).slotIntervals = spinIntervals;
  };

  const stopReel = (reelIndex: number) => {
    if (reelIndex !== currentReel || stopped[reelIndex] || !spinning[reelIndex]) return;

    // Stop the specific reel
    const intervals = (window as any).slotIntervals || [];
    if (intervals[reelIndex]) {
      clearInterval(intervals[reelIndex]);
    }

    // Stop animation
    if (reelRefs[reelIndex].current) {
      reelRefs[reelIndex].current!.style.animation = 'none';
    }

    // Set final symbol
    const finalSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const newReels = [...reels];
    newReels[reelIndex] = finalSymbol;
    setReels(newReels);

    // Mark as stopped
    const newStopped = [...stopped];
    newStopped[reelIndex] = true;
    setStopped(newStopped);

    const newSpinning = [...spinning];
    newSpinning[reelIndex] = false;
    setSpinning(newSpinning);

    // Move to next reel
    setCurrentReel(currentReel + 1);
  };

  const calculateResult = () => {
    const [r1, r2, r3] = reels;
    
    // Check for three skulls (catastrophic)
    if (r1 === 'skull' && r2 === 'skull' && r3 === 'skull') {
      onResult('catastrophic');
      return;
    }

    // Check for three matching symbols (win)
    if (r1 === r2 && r2 === r3) {
      onResult('win');
      return;
    }

    // Check for two matching + adjacent third (close-win)
    const symbolOrder = SYMBOLS;
    const getIndex = (symbol: SlotSymbol) => symbolOrder.indexOf(symbol);
    
    if (r1 === r2) {
      const diff = Math.abs(getIndex(r2) - getIndex(r3));
      if (diff === 1 || diff === symbolOrder.length - 1) {
        onResult('close-win');
        return;
      }
    }
    
    if (r2 === r3) {
      const diff = Math.abs(getIndex(r1) - getIndex(r2));
      if (diff === 1 || diff === symbolOrder.length - 1) {
        onResult('close-win');
        return;
      }
    }

    // Check for two matching anywhere (close-loss)
    if (r1 === r2 || r2 === r3 || r1 === r3) {
      onResult('close-loss');
      return;
    }

    // Check for one matching (loss)
    const uniqueSymbols = new Set(reels);
    if (uniqueSymbols.size === 2) {
      onResult('loss');
      return;
    }

    // No matches (loss)
    onResult('loss');
  };

  return (
    <div className="slotMachine">
      <div className="slotHeader">
        <h2 className="slotTitle">SLOT MACHINE</h2>
        <div className="slotLever" onClick={!gameStarted ? startGame : undefined}>
          <div className={`leverHandle ${gameStarted ? 'pulled' : ''}`}>🎰</div>
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
              {SYMBOL_DISPLAY[symbol]}
            </div>
            <div className="slotReelBorder"></div>
          </div>
        ))}
      </div>

      <div className="slotInstructions">
        {!gameStarted ? (
          <p>Click the lever to start!</p>
        ) : currentReel < 3 ? (
          <p>Click reel {currentReel + 1} to stop it!</p>
        ) : (
          <p>Calculating result...</p>
        )}
      </div>

      <div className="slotPaytable">
        <div className="paytableRow">🍒🍒🍒 / 7️⃣7️⃣7️⃣ / 💎💎💎 / 📊📊📊 = WIN</div>
        <div className="paytableRow">Two + adjacent = CLOSE WIN</div>
        <div className="paytableRow">Two matching = CLOSE LOSS</div>
        <div className="paytableRow">One match = LOSS</div>
        <div className="paytableRow">💀💀💀 = CATASTROPHIC</div>
      </div>
    </div>
  );
}