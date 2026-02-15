'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import Tile from './Tile';
import type { BoardTile } from './Tile';
import DicePips from './DicePips';
import BoardCenterArt from './BoardCenterArt';
import PropertyPopup from './PropertyPopup';
import MoneyFloat, { useMoneyFloats } from './MoneyFloat';
import CutsceneOverlay from './CutsceneOverlay';
import { TILES } from '@/lib/gameData';

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
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayPositions, setDisplayPositions] = useState<number[]>([]);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const [isDiceFocus, setIsDiceFocus] = useState(false);
  const [rollPhase, setRollPhase] = useState('idle');
  const [impactPulse, setImpactPulse] = useState(false);
  const [activeTile, setActiveTile] = useState(0);
  const [boardSize, setBoardSize] = useState(0);
  const [popupTile, setPopupTile] = useState<number | null>(null);
  const [cutscene, setCutscene] = useState<{
    playerIndex: number;
    playerColor: string;
    playerName: string;
    steps: number[];
  } | null>(null);
  const cutsceneQueueRef = useRef<Array<{
    playerIndex: number;
    playerColor: string;
    playerName: string;
    steps: number[];
    finalPos: number;
  }>>([]);
  const frameRef = useRef<HTMLDivElement>(null);
  const prevDiceRef = useRef<[number, number] | null>(null);
  const prevPhaseRef = useRef(state.phase);
  const prevPositionsRef = useRef<number[]>([]);
  const { floats, addFloat } = useMoneyFloats();

  // Stable position key for tracking changes
  const positionKey = state.players.map((p) => p.position).join(',');

  // Initialize display positions
  useEffect(() => {
    if (displayPositions.length === 0 && state.players.length > 0) {
      const positions = state.players.map((p) => p.position);
      setDisplayPositions(positions);
      prevPositionsRef.current = positions;
    }
  }, [state.players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle cutscene completion
  const handleCutsceneComplete = useCallback(() => {
    // Apply final position from completed cutscene
    const queue = cutsceneQueueRef.current;
    if (queue.length > 0) {
      const completed = queue.shift()!;
      setDisplayPositions((dp) => {
        const next = [...dp];
        next[completed.playerIndex] = completed.finalPos;
        return next;
      });
      setActiveTile(completed.finalPos);
    }
    // Play next queued cutscene or finish
    if (queue.length > 0) {
      const next = queue[0];
      setCutscene({
        playerIndex: next.playerIndex,
        playerColor: next.playerColor,
        playerName: next.playerName,
        steps: next.steps,
      });
    } else {
      setCutscene(null);
      setIsAnimating(false);
    }
  }, []);

  // Detect position changes and trigger cutscene
  useEffect(() => {
    if (displayPositions.length === 0) return;

    const currentPositions = state.players.map((p) => p.position);

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
        // Direct jump -- no cutscene
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

      const player = state.players[playerIdx];
      const entry = {
        playerIndex: playerIdx,
        playerColor: player.color,
        playerName: player.name,
        steps,
        finalPos: curr,
      };

      // Queue cutscene
      cutsceneQueueRef.current.push(entry);

      // If no cutscene is playing, start this one
      if (!cutscene && cutsceneQueueRef.current.length === 1) {
        setIsAnimating(true);
        setCutscene({
          playerIndex: entry.playerIndex,
          playerColor: entry.playerColor,
          playerName: entry.playerName,
          steps: entry.steps,
        });
      }
    }

    prevPositionsRef.current = currentPositions;
  }, [positionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track money changes for floats
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
        }
      });
    }
    prevMoneyRef.current = currentMoney;
  }, [moneyKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const jitter = setInterval(() => {
      setDisplayDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 40);

    setTimeout(() => setRollPhase('throw'), 140);
    setTimeout(() => {
      setImpactPulse(true);
      setRollPhase('impact');
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
      <div ref={frameRef} className={`boardFrame ${isDiceFocus ? 'focused' : ''}`}>
        <div className="boardGrid" style={boardSize ? { width: `${boardSize}px`, height: `${boardSize}px` } : undefined}>
          {boardTiles.map((tile) => (
            <Tile
              key={tile.index}
              tile={tile}
              activeTile={activeTile}
              players={displayPlayers}
              onTileClick={(idx) => setPopupTile(idx)}
            />
          ))}
          <BoardCenterArt isRolling={isDiceFocus} isAnimating={isAnimating} />
          <MoneyFloat floats={floats} />
        </div>

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

      {cutscene && (
        <CutsceneOverlay
          playerColor={cutscene.playerColor}
          playerName={cutscene.playerName}
          steps={cutscene.steps}
          onComplete={handleCutsceneComplete}
        />
      )}
    </section>
  );
}
