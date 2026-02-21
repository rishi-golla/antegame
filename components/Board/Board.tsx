'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { useMood } from '@/hooks/useMood';
import Tile from './Tile';
import type { BoardTile } from './Tile';
import DicePips from './DicePips';
import BoardCenterArt from './BoardCenterArt';
import PropertyPopup from './PropertyPopup';
import MoneyFloat, { useMoneyFloats } from './MoneyFloat';
import RentAnimation from './RentAnimation';
import ScreenEffects from '@/components/UI/ScreenEffects';
import { TILES } from '@/lib/gameData';
// import { particles } from '@/lib/particles';

function buildBoardTiles(): BoardTile[] {
  const tiles: BoardTile[] = [];
  let idx = 0;

  const push = (row: number, col: number, rowSpan: number, colSpan: number, orientation: string, isCorner = false) => {
    tiles.push({
      index: idx,
      label: TILES[idx]?.name ?? `Tile ${idx}`,
      row, col, rowSpan, colSpan, orientation, isCorner,
    });
    idx += 1;
  };

  push(12, 12, 2, 2, 'corner', true);
  for (let col = 11; col >= 3; col--) push(12, col, 2, 1, 'bottom');
  push(12, 1, 2, 2, 'corner', true);
  for (let row = 11; row >= 3; row--) push(row, 1, 1, 2, 'left');
  push(1, 1, 2, 2, 'corner', true);
  for (let col = 3; col <= 11; col++) push(1, col, 2, 1, 'top');
  push(1, 12, 2, 2, 'corner', true);
  for (let row = 3; row <= 11; row++) push(row, 12, 1, 2, 'right');

  return tiles;
}

const boardTiles = buildBoardTiles();

export default function Board() {
  const { state } = useGame();
  const { play, playMusic, playAmbient, setMusicIntensity, playMoneySound, playDistantCelebration } = useAudio();
  const { setMood } = useMood();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayPositions, setDisplayPositions] = useState<number[]>([]);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const [isDiceFocus, setIsDiceFocus] = useState(false);
  const [rollPhase, setRollPhase] = useState('idle');
  const [impactPulse, setImpactPulse] = useState(false);
  const [activeTile, setActiveTile] = useState(0);
  const [boardSize, setBoardSize] = useState(0);
  const [popupTile, setPopupTile] = useState<number | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<Set<number>>(new Set());
  const [hotProperties, setHotProperties] = useState<Record<number, number>>({}); // tileIndex -> landing count
  const [nearMissAlert, setNearMissAlert] = useState<{ type: 'good' | 'bad'; tile: number; message: string } | null>(null);
  const [declineWarning, setDeclineWarning] = useState<{ tileIndex: number; rent: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const prevDiceRef = useRef<[number, number] | null>(null);
  const prevPhaseRef = useRef(state.phase);
  const prevPositionsRef = useRef<number[]>([]);
  const prevPropertiesRef = useRef<number[][]>([]);
  const prevLandedTileRef = useRef<number | null>(null);
  const { floats, addFloat } = useMoneyFloats();

  // Stable position key for tracking changes
  const positionKey = state.players.map((p) => p.position).join(',');
  
  // Track hot properties (landing frequency)
  useEffect(() => {
    const currentPositions = state.players.map((p) => p.position);
    if (prevPositionsRef.current.length > 0) {
      // Check for players who changed position (landed on new tiles)
      for (let i = 0; i < currentPositions.length; i++) {
        const prev = prevPositionsRef.current[i];
        const curr = currentPositions[i];
        if (prev !== undefined && prev !== curr && !state.players[i].bankrupt) {
          // Player landed on a new tile - increment hot property counter
          setHotProperties(prevHot => ({
            ...prevHot,
            [curr]: (prevHot[curr] || 0) + 1
          }));

          // Near-miss: only for HIGH-VALUE scenarios
          const playerMoney = state.players[i].money;
          const almostTile1 = (curr + 39) % 40;
          const almostTile2 = (curr + 1) % 40;
          
          for (const almostIndex of [almostTile1, almostTile2]) {
            const almostTileData = TILES[almostIndex];
            
            // Near miss: almost sent to jail (always dramatic)
            if (almostTileData.type === 'corner' && almostTileData.cornerKind === 'go-to-jail') {
              setNearMissAlert({ type: 'bad', tile: almostIndex, message: 'Dodged Go To Jail!' });
              play('sfx/dice-roll', { volume: 0.3, pitch: 0.7 });
              setTimeout(() => setNearMissAlert(null), 1800);
              break;
            }
            
            // Near miss: almost landed on opponent's EXPENSIVE property (rent > $300)
            const owner = state.players.find(p => p.properties.includes(almostIndex) && !p.mortgaged.includes(almostIndex));
            if (owner && owner.id !== i && almostTileData.type === 'property') {
              const houses = owner.houses[almostIndex] || 0;
              const rent = almostTileData.rent[houses > 0 ? houses : 0];
              if (rent >= 300) {
                setNearMissAlert({ type: 'bad', tile: almostIndex, message: `Dodged $${rent} rent!` });
                play('sfx/dice-roll', { volume: 0.3, pitch: 0.7 });
                setTimeout(() => setNearMissAlert(null), 1800);
                break;
              }
            }
            
            // Near miss: almost hit dark-blue or green unowned property (high value only)
            if (almostTileData.type === 'property' && !state.players.some(p => p.properties.includes(almostIndex))) {
              const group = almostTileData.colorGroup;
              if ((group === 'dark-blue' || group === 'green') && playerMoney >= almostTileData.price) {
                setNearMissAlert({ type: 'good', tile: almostIndex, message: `Missed ${almostTileData.name}!` });
                setTimeout(() => setNearMissAlert(null), 1800);
                break;
              }
            }
          }
        }
      }
    }
  }, [positionKey, state.players]);

  // Initialize display positions and start ambient
  useEffect(() => {
    if (displayPositions.length === 0 && state.players.length > 0) {
      const positions = state.players.map((p) => p.position);
      setDisplayPositions(positions);
      prevPositionsRef.current = positions;
      // Start ambient sounds and BGM when entering the game board
      playAmbient();
      playMusic('music/bgm-game');
    }
  }, [state.players.length, playAmbient, playMusic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate token movement step-by-step
  useEffect(() => {
    if (displayPositions.length === 0) return;

    const currentPositions = state.players.map((p) => p.position);
    let cancelled = false;

    // Find which players moved
    for (let playerIdx = 0; playerIdx < currentPositions.length; playerIdx++) {
      const prev = prevPositionsRef.current[playerIdx];
      const curr = currentPositions[playerIdx];

      if (prev === undefined || prev === curr) continue;

      // Detect jail teleport (sent to jail = position jumps to 10 without passing through)
      const isJailTeleport = curr === 10 && state.players[playerIdx].inJail;
      // Detect backward movement or large jumps (> 12 steps forward = likely teleport)
      const forwardSteps = curr > prev ? curr - prev : 40 - prev + curr;

      if (isJailTeleport || forwardSteps > 12) {
        // Direct jump — no animation
        setDisplayPositions((dp) => {
          const next = [...dp];
          next[playerIdx] = curr;
          return next;
        });
        setActiveTile(curr);
        continue;
      }

      // Build step sequence
      const steps: number[] = [];
      let pos = prev;
      for (let i = 0; i < forwardSteps; i++) {
        pos = (pos + 1) % 40;
        steps.push(pos);
      }

      if (steps.length === 0) continue;

      // Animate steps
      setIsAnimating(true);
      let stepIdx = 0;

      const interval = setInterval(() => {
        if (cancelled || stepIdx >= steps.length) {
          clearInterval(interval);
          if (!cancelled) {
            setIsAnimating(false);
            setActiveTile(curr);
            play('sfx/token-land', { volume: 0.3 });
          }
          return;
        }

        const nextPos = steps[stepIdx];
        if (nextPos === 0) play('sfx/pass-go', { volume: 0.5 });
        play('sfx/token-step', { volume: 0.12, pitch: 0.9 + Math.random() * 0.2 });
        setDisplayPositions((dp) => {
          const next = [...dp];
          next[playerIdx] = nextPos;
          return next;
        });
        setActiveTile(nextPos);
        stepIdx++;
      }, 150);
    }

    prevPositionsRef.current = currentPositions;

    return () => { cancelled = true; };
  }, [positionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track money changes for floats and sounds
  const prevMoneyRef = useRef<number[]>([]);
  const moneyKey = state.players.map((p) => p.money).join(',');
  const isFirstRender = useRef(true);
  useEffect(() => {
    const currentMoney = state.players.map((p) => p.money);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevMoneyRef.current = currentMoney;
      return;
    }
    if (prevMoneyRef.current.length > 0) {
      state.players.forEach((player, i) => {
        const diff = currentMoney[i] - prevMoneyRef.current[i];
        if (diff !== 0 && !player.bankrupt) {
          addFloat(diff, player.color);
          // Play money sound for current player, distant celebration for others
          if (i === state.currentPlayerIndex) {
            if (diff > 0) {
              playMoneySound(diff);
            }
          } else if (diff > 0) {
            // Other player gained money - play distant celebration
            playDistantCelebration();
          }
        }
      });
    }
    prevMoneyRef.current = currentMoney;
  }, [moneyKey, state.currentPlayerIndex, playMoneySound, playDistantCelebration, addFloat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Music intensity and mood detection
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) return;

    let intensity: 'calm' | 'normal' | 'tense' | 'hype' = 'normal';
    let mood: 'winning' | 'losing' | 'danger' | 'neutral' | 'hype' = 'neutral';

    // Detect game state for intensity
    if (state.phase === 'minigame') {
      intensity = 'hype';
      mood = 'hype';
    } else if (currentPlayer.money < 50) {
      intensity = 'tense';
      mood = 'danger';
    } else if (currentPlayer.money < 100) {
      intensity = 'tense';
      mood = 'losing';
    } else if (state.phase === 'waiting' || state.phase === 'game-over') {
      intensity = 'calm';
    } else if (currentPlayer.money > 2000) {
      mood = 'winning';
    }

    setMusicIntensity(intensity);
    setMood(mood);
  }, [state.phase, state.currentPlayerIndex, state.players, setMusicIntensity, setMood]);

  // Track property purchases for celebration animation
  useEffect(() => {
    const currentProperties = state.players.map(p => p.properties);
    const isFirstRender = prevPropertiesRef.current.length === 0;

    if (isFirstRender) {
      prevPropertiesRef.current = currentProperties;
      return;
    }

    // Find newly purchased properties
    const newPurchases = new Set<number>();
    state.players.forEach((player, i) => {
      const prevPlayerProps = prevPropertiesRef.current[i] || [];
      const currentPlayerProps = player.properties;
      
      currentPlayerProps.forEach(propIndex => {
        if (!prevPlayerProps.includes(propIndex)) {
          newPurchases.add(propIndex);
        }
      });
    });

    if (newPurchases.size > 0) {
      setRecentPurchases(newPurchases);
      
      // Clear animations after 800ms
      setTimeout(() => {
        setRecentPurchases(new Set());
      }, 800);
    }

    prevPropertiesRef.current = currentProperties;
  }, [state.players]);

  // Phase 3: Track property declines for loss aversion warnings
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex];
    
    // Phase transition from 'buying' to something else = property decision was made
    if (prevPhaseRef.current === 'buying' && state.phase !== 'buying' && currentPlayer) {
      const landedTile = currentPlayer.position;
      const tileData = TILES[landedTile];
      
      // Check if property was declined — only warn for properties $200+ (worth caring about)
      if (tileData.type === 'property' && !currentPlayer.properties.includes(landedTile) && tileData.price >= 200) {
        const baseRent = tileData.rent[0];
        setDeclineWarning({ tileIndex: landedTile, rent: baseRent });
        play('sfx/decline-property', { volume: 0.5 });
        setTimeout(() => setDeclineWarning(null), 2000);
      }
    }
    
    if (state.phase === 'buying') {
      prevLandedTileRef.current = currentPlayer?.position || null;
    }
    
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.currentPlayerIndex, state.players, play]);

  useEffect(() => {
    if (!frameRef.current) return;
    const updateSize = () => {
      if (!frameRef.current) return;
      const { clientWidth, clientHeight } = frameRef.current;
      setBoardSize(Math.max(0, Math.floor(Math.min(clientWidth, clientHeight))));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  const animateRoll = useCallback((finalDice: [number, number]) => {
    setIsDiceFocus(true);
    setRollPhase('charge');
    play('sfx/dice-shake', { volume: 0.4 });

    const jitter = setInterval(() => {
      setDisplayDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 40);

    setTimeout(() => setRollPhase('throw'), 140);
    setTimeout(() => {
      setImpactPulse(true);
      setRollPhase('impact');
      play('sfx/dice-roll', { volume: 0.5 });
      setTimeout(() => setImpactPulse(false), 180);
    }, 520);

    setTimeout(() => {
      clearInterval(jitter);
      setDisplayDice(finalDice);
      setRollPhase('result');
      setTimeout(() => {
        setIsDiceFocus(false);
        setRollPhase('idle');
      }, 300);
    }, 980);
  }, []);

  useEffect(() => {
    if (prevDiceRef.current === null) {
      // First render -- store initial values, don't animate
      prevDiceRef.current = state.dice;
      prevPhaseRef.current = state.phase;
      return;
    }
    const diceChanged = prevDiceRef.current[0] !== state.dice[0] || prevDiceRef.current[1] !== state.dice[1];
    if (diceChanged && (prevPhaseRef.current === 'rolling' || prevPhaseRef.current === 'in-jail')) {
      animateRoll(state.dice);
    }
    prevPhaseRef.current = state.phase;
    prevDiceRef.current = state.dice;
  }, [state.dice, state.phase, animateRoll]);

  // Build a "display players" with animated positions
  const displayPlayers = state.players.map((p, i) => ({
    ...p,
    position: displayPositions[i] ?? p.position,
  }));

  return (
    <section className="boardWrap">
      {/* Global screen effects overlay */}
      <ScreenEffects />
      
      <div ref={frameRef} className={`boardFrame ${isDiceFocus ? 'focused' : ''}`}>
        <div className="boardGrid" style={boardSize ? { width: `${boardSize}px`, height: `${boardSize}px` } : undefined}>
          {boardTiles.map((tile) => (
            <Tile
              key={tile.index}
              tile={tile}
              activeTile={activeTile}
              players={displayPlayers}
              currentPlayerIndex={state.currentPlayerIndex}
              onTileClick={(idx) => setPopupTile(idx)}
              isJustPurchased={recentPurchases.has(tile.index)}
              hotLevel={hotProperties[tile.index] || 0}
              isNearMiss={nearMissAlert?.tile === tile.index}
              isDeclineFlash={declineWarning?.tileIndex === tile.index}
            />
          ))}
          <BoardCenterArt isRolling={isDiceFocus} isAnimating={isAnimating} />
          <MoneyFloat floats={floats} />
          <RentAnimation boardSize={boardSize} />
        </div>

        {/* Phase 3: Near-Miss Alert Overlay */}
        {nearMissAlert && (
          <div className={`near-miss-overlay near-miss-${nearMissAlert.type}`}>
            <div className="near-miss-content">
              <div className="near-miss-title">
                {nearMissAlert.type === 'good' ? '😱 CLOSE CALL!' : '😅 JUST MISSED!'}
              </div>
              <div className="near-miss-message">{nearMissAlert.message}</div>
            </div>
          </div>
        )}

        {/* Phase 3: Property Decline Warning */}
        {declineWarning && (
          <div className="decline-warning-overlay">
            <div className="decline-warning-content">
              <div className="decline-warning-icon">⚠️</div>
              <div className="decline-warning-title">WARNING!</div>
              <div className="decline-warning-message">
                Next player who lands here<br />
                pays <span className="decline-rent-amount">${declineWarning.rent}</span> rent!
              </div>
              <div className="decline-warning-subtitle">You just missed your chance to own this!</div>
            </div>
          </div>
        )}

        {isDiceFocus && (
          <div className={`diceFocusLayer phase-${rollPhase} ${impactPulse ? 'impact' : ''}`}>
            <div className="diceFocusBackdrop" />
            <div className="diceFocusOrbit">
              <div className="diceFocusShadow" />
              <div className={`focusDie dieA ${rollPhase === 'result' ? 'result' : ''}`}>
                <DicePips value={displayDice[0]} />
              </div>
              <div className={`focusDie dieB ${rollPhase === 'result' ? 'result' : ''}`}>
                <DicePips value={displayDice[1]} />
              </div>
            </div>
          </div>
        )}
      </div>

      {popupTile !== null && (
        <PropertyPopup tileIndex={popupTile} onClose={() => setPopupTile(null)} />
      )}
    </section>
  );
}
