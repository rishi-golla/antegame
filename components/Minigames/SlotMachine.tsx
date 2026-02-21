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
  const [heartbeatEffect, setHeartbeatEffect] = useState(false);
  const [finalReelSlowdown, setFinalReelSlowdown] = useState(false);
  const [screenShake, setScreenShake] = useState(0); // 0 = none, 1 = mild, 2 = strong
  
  // Enhanced reel state for realistic spinning
  const [reelPositions, setReelPositions] = useState([0, 0, 0]); // Vertical scroll positions
  const [reelVelocities, setReelVelocities] = useState([0, 0, 0]); // Current spin speeds
  const [blurIntensity, setBlurIntensity] = useState([0, 0, 0]); // Blur during fast spin
  
  const finalReelsRef = useRef<SlotSymbol[]>(['cherry', 'cherry', 'cherry']);
  const startTriggeredRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const reelRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  // Create extended symbol arrays for realistic reel scrolling (20+ symbols each)
  const REEL_SYMBOLS_EXTENDED = [
    ['cherry', 'seven', 'diamond', 'bar', 'skull', 'cherry', 'diamond', 'bar', 'seven', 'cherry', 'skull', 'diamond', 'bar', 'seven', 'cherry', 'diamond', 'skull', 'bar', 'seven', 'cherry'],
    ['bar', 'cherry', 'skull', 'diamond', 'seven', 'bar', 'cherry', 'diamond', 'skull', 'bar', 'seven', 'cherry', 'diamond', 'bar', 'skull', 'seven', 'cherry', 'bar', 'diamond', 'skull'],
    ['skull', 'bar', 'seven', 'cherry', 'diamond', 'skull', 'bar', 'cherry', 'seven', 'skull', 'diamond', 'bar', 'cherry', 'skull', 'seven', 'diamond', 'bar', 'skull', 'cherry', 'seven']
  ];

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

  // Physics-based reel animation loop
  useEffect(() => {
    const animateReels = () => {
      setReelPositions(prev => prev.map((pos, index) => {
        if (!spinning[index]) return pos;
        return (pos + reelVelocities[index]) % (REEL_SYMBOLS_EXTENDED[index].length * 60); // 60px per symbol
      }));

      setBlurIntensity(prev => prev.map((blur, index) => {
        const targetBlur = Math.min(reelVelocities[index] * 0.5, 15); // Max 15px blur
        return blur + (targetBlur - blur) * 0.1; // Smooth blur transition
      }));

      if (spinning.some(Boolean)) {
        animationFrameRef.current = requestAnimationFrame(animateReels);
      }
    };

    if (spinning.some(Boolean)) {
      animationFrameRef.current = requestAnimationFrame(animateReels);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [spinning, reelVelocities]);

  const stopReelAuto = useCallback((reelIndex: number, finalSymbol: SlotSymbol, isLastReel = false) => {
    // Start deceleration process
    const targetPosition = REEL_SYMBOLS_EXTENDED[reelIndex].indexOf(finalSymbol) * 60;
    
    // Gradual deceleration with overshoot and bounce
    const decelerate = () => {
      setReelVelocities(prev => {
        const newVelocities = [...prev];
        const currentVel = newVelocities[reelIndex];
        
        if (currentVel > 2) {
          // Fast deceleration
          newVelocities[reelIndex] = currentVel * 0.92;
        } else {
          // Final positioning with overshoot
          const currentPos = reelPositions[reelIndex] % (REEL_SYMBOLS_EXTENDED[reelIndex].length * 60);
          const distance = targetPosition - currentPos;
          const adjustedDistance = distance > 300 ? distance - REEL_SYMBOLS_EXTENDED[reelIndex].length * 60 : distance;
          
          if (Math.abs(adjustedDistance) > 5) {
            newVelocities[reelIndex] = adjustedDistance * 0.1;
          } else {
            // Final stop
            newVelocities[reelIndex] = 0;
            setReelPositions(prev => {
              const newPos = [...prev];
              newPos[reelIndex] = targetPosition;
              return newPos;
            });
            
            setStopped(prev => { const n = [...prev]; n[reelIndex] = true; return n; });
            setSpinning(prev => { const n = [...prev]; n[reelIndex] = false; return n; });
            setBlurIntensity(prev => { const n = [...prev]; n[reelIndex] = 0; return n; });
            play('minigames/slot-stop');
            
            // Special effects for final reel
            if (isLastReel && reelIndex === 2) {
              const [r1, r2] = finalReelsRef.current;
              const r3 = finalSymbol;
              
              const willBeCloseResult = (r1 === r2) || (r2 === r3 && r1 !== r2) || (r1 === r3 && r1 !== r2);
              
              if (willBeCloseResult) {
                setHeartbeatEffect(true);
                const shakeLevel = (r1 === r2) ? 2 : 1;
                setScreenShake(shakeLevel);
                setTimeout(() => {
                  setHeartbeatEffect(false);
                  setScreenShake(0);
                }, 1000);
              }
            }
            
            return newVelocities;
          }
        }
        
        return newVelocities;
      });
      
      if (reelVelocities[reelIndex] !== 0) {
        setTimeout(decelerate, 16); // ~60fps
      }
    };
    
    decelerate();
    
    setReels(prev => { const n = [...prev]; n[reelIndex] = finalSymbol; return n; });
  }, [play, reelPositions, reelVelocities]); // eslint-disable-line react-hooks/exhaustive-deps

  const doStart = useCallback((finals: SlotSymbol[]) => {
    if (startTriggeredRef.current) return;
    startTriggeredRef.current = true;
    finalReelsRef.current = finals;
    setGameStarted(true);
    setLeverPulled(true);
    setSpinning([true, true, true]);
    play('minigames/slot-spin');

    // Set initial high velocities for each reel with slight variation
    setReelVelocities([
      12 + Math.random() * 3,  // Reel 1: 12-15 speed
      15 + Math.random() * 3,  // Reel 2: 15-18 speed  
      18 + Math.random() * 3   // Reel 3: 18-21 speed (fastest)
    ]);

    // Auto-stop reels with staggered timing and realistic deceleration
    setTimeout(() => stopReelAuto(0, finals[0]), 1800);
    setTimeout(() => stopReelAuto(1, finals[1]), 2800);
    setTimeout(() => stopReelAuto(2, finals[2], true), 4200); // Final reel takes longest
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
    setBlurIntensity(prev => { const n = [...prev]; n[reelIndex] = 0; return n; });
    setCurrentReel(currentReel + 1);
  };

  return (
    <div className={`slotMachine pixelMinigame ${heartbeatEffect ? 'slot-heartbeat' : ''} ${screenShake > 0 ? `slot-shake-${screenShake}` : ''}`}>
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
              className={`slotReel ${stopped[index] ? 'stopped' : ''} ${currentReel === index && gameStarted && !stopped[index] ? 'active' : ''} ${index === 2 && finalReelSlowdown ? 'final-reel-slowdown' : ''}`}
              onClick={() => stopReel(index)}
              ref={reelRefs[index]}
            >
              {/* Reel window - shows multiple symbols with clipping */}
              <div className="reel-window">
                <div 
                  className="reel-strip"
                  style={{
                    transform: `translateY(-${reelPositions[index]}px)`,
                    filter: stopped[index] ? 'none' : `blur(${blurIntensity[index]}px)`,
                    transition: stopped[index] ? 'filter 0.2s ease-out' : 'none'
                  }}
                >
                  {/* Render extended symbol list for continuous scrolling */}
                  {REEL_SYMBOLS_EXTENDED[index].concat(REEL_SYMBOLS_EXTENDED[index]).map((sym, symIndex) => (
                    <div 
                      key={`${index}-${symIndex}`}
                      className={`reel-symbol ${sym}`}
                      style={{
                        height: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img 
                        src={SYMBOL_IMAGES[sym as SlotSymbol]} 
                        alt={sym} 
                        className="reel-symbol-img"
                        style={{
                          width: '40px',
                          height: '40px',
                          imageRendering: 'pixelated'
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Reel window overlay with visible center highlight */}
                <div className="reel-window-overlay">
                  <div className="reel-center-highlight" />
                </div>
              </div>
              
              {/* Light strips on reel borders */}
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
