'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import Tile from './Tile';
import type { BoardTile } from './Tile';
import DicePips from './DicePips';
import BoardCenterArt from './BoardCenterArt';
import { TILES } from '@/lib/gameData';

/**
 * Build a 40-tile board layout on a 13x13 grid.
 * Each side has 9 non-corner tiles + 4 corner tiles (2x2 each).
 * Corners at grid positions: (12,12), (12,1), (1,1), (1,12)
 * Edges: 9 tiles per side between corners.
 */
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

  // Bottom row, right to left: GO (corner) + 9 tiles + Jail (corner)
  push(12, 12, 2, 2, 'corner', true); // 0: GO
  for (let col = 11; col >= 3; col--) push(12, col, 2, 1, 'bottom'); // 1-9
  push(12, 1, 2, 2, 'corner', true); // 10: Jail

  // Left column, bottom to top: 9 tiles + Free Parking (corner)
  for (let row = 11; row >= 3; row--) push(row, 1, 1, 2, 'left'); // 11-19
  push(1, 1, 2, 2, 'corner', true); // 20: Free Parking

  // Top row, left to right: 9 tiles + Go To Jail (corner)
  for (let col = 3; col <= 11; col++) push(1, col, 2, 1, 'top'); // 21-29
  push(1, 12, 2, 2, 'corner', true); // 30: Go To Jail

  // Right column, top to bottom: 9 tiles
  for (let row = 3; row <= 11; row++) push(row, 12, 1, 2, 'right'); // 31-39

  return tiles;
}

const boardTiles = buildBoardTiles();

export default function Board() {
  const { state } = useGame();
  const [isRolling, setIsRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const [isDiceFocus, setIsDiceFocus] = useState(false);
  const [rollPhase, setRollPhase] = useState('idle');
  const [impactPulse, setImpactPulse] = useState(false);
  const [activeTile, setActiveTile] = useState(0);
  const [boardSize, setBoardSize] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const prevDiceRef = useRef(state.dice);
  const prevPhaseRef = useRef(state.phase);

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
    setIsRolling(true);
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
        setIsRolling(false);
      }, 300);
    }, 980);
  }, []);

  useEffect(() => {
    const diceChanged = prevDiceRef.current[0] !== state.dice[0] || prevDiceRef.current[1] !== state.dice[1];
    if (diceChanged && (prevPhaseRef.current === 'rolling' || prevPhaseRef.current === 'in-jail')) {
      animateRoll(state.dice);
    }
    prevPhaseRef.current = state.phase;
    prevDiceRef.current = state.dice;
  }, [state.dice, state.phase, animateRoll]);

  useEffect(() => {
    const player = state.players[state.currentPlayerIndex];
    if (player) setActiveTile(player.position);
  }, [state.players, state.currentPlayerIndex]);

  return (
    <section className="boardWrap">
      <div ref={frameRef} className={`boardFrame ${isDiceFocus ? 'focused' : ''}`}>
        <div className="boardGrid" style={boardSize ? { width: `${boardSize}px`, height: `${boardSize}px` } : undefined}>
          {boardTiles.map((tile) => (
            <Tile
              key={tile.index}
              tile={tile}
              activeTile={activeTile}
              players={state.players}
            />
          ))}
          <BoardCenterArt isRolling={isRolling} />
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
    </section>
  );
}
