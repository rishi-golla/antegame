'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface MinesweeperLiteProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

type CellState = 'hidden' | 'revealed' | 'mine';

interface Cell {
  id: number;
  hasMine: boolean;
  state: CellState;
  safeRevealed: boolean;
}

const GRID_SIZE = 9;
const MINE_COUNT = 3;

export default function MinesweeperLite({ onResult, baseAmount, context, spectator = false }: MinesweeperLiteProps) {
  const { play } = useAudio();
  const [grid, setGrid] = useState<Cell[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [safeCount, setSafeCount] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  // Sync: active player emits actions, spectator receives them
  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      // Spectator receives the mine layout from the active player
      const newGrid: Cell[] = [];
      for (let i = 0; i < GRID_SIZE; i++) {
        newGrid.push({ id: i, hasMine: data.mines.includes(i), state: 'hidden', safeRevealed: false });
      }
      setGrid(newGrid);
    } else if (data.type === 'click') {
      // Replay the click
      doClick(data.cellId);
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    if (!spectator) {
      // Active player: generate grid and broadcast mine positions
      const newGrid: Cell[] = [];
      for (let i = 0; i < GRID_SIZE; i++) {
        newGrid.push({ id: i, hasMine: false, state: 'hidden', safeRevealed: false });
      }
      const minePositions = new Set<number>();
      while (minePositions.size < MINE_COUNT) {
        minePositions.add(Math.floor(Math.random() * GRID_SIZE));
      }
      minePositions.forEach(pos => { newGrid[pos].hasMine = true; });
      setGrid(newGrid);
      emitAction({ type: 'init', mines: [...minePositions] });
    }

    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared click logic used by both active player and spectator replay
  const doClick = useCallback((cellId: number) => {
    setGrid(prev => {
      if (!prev.length || prev[cellId]?.state !== 'hidden') return prev;
      const newGrid = [...prev];
      const clickedCell = { ...newGrid[cellId] };

      if (clickedCell.hasMine) {
        play('minigames/mine-boom');
        clickedCell.state = 'mine';
        newGrid[cellId] = clickedCell;
        setGameEnded(true);
        setFirstClick(fc => {
          if (fc) {
            setTimeout(() => onResult('catastrophic'), 1000);
          } else {
            setSafeCount(sc => { setTimeout(() => calculateResult(sc), 1000); return sc; });
          }
          return false;
        });
      } else {
        play('minigames/mine-safe');
        clickedCell.state = 'revealed';
        clickedCell.safeRevealed = true;
        newGrid[cellId] = clickedCell;
        setGameStarted(true);
        setFirstClick(false);
        setSafeCount(sc => {
          const newSc = sc + 1;
          if (newSc === GRID_SIZE - MINE_COUNT) {
            setGameEnded(true);
            setTimeout(() => calculateResult(newSc), 500);
          }
          return newSc;
        });
      }

      return newGrid;
    });
  }, [play, onResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const clickCell = (cellId: number) => {
    if (gameEnded || spectator) return;
    play('minigames/mine-click');
    emitAction({ type: 'click', cellId });
    doClick(cellId);
  };

  const calculateResult = (safeTilesRevealed: number) => {
    if (safeTilesRevealed === 6) onResult('win');
    else if (safeTilesRevealed >= 4) onResult('close-win');
    else if (safeTilesRevealed >= 2) onResult('close-loss');
    else if (safeTilesRevealed === 1) onResult('loss');
    else onResult('catastrophic');
  };

  const renderCell = (cell: Cell) => {
    if (cell.state === 'hidden') {
      return (
        <div className="msTileHidden">
          <span className="msTileQuestion">?</span>
        </div>
      );
    }
    if (cell.state === 'revealed') {
      return (
        <div className="msTileRevealed">
          <span className="msTileGem">💎</span>
        </div>
      );
    }
    return (
      <div className="msTileMine">
        <span className="msTileBomb">💣</span>
      </div>
    );
  };

  return (
    <div className="minesweeperLite pixelMinigame">
      <h2 className="minesweeperTitle">MINESWEEPER LITE</h2>
      <div className="minesweeperStats">SAFE: {safeCount}/{GRID_SIZE - MINE_COUNT}</div>

      <div className="msGrid">
        {grid.map((cell) => (
          <button
            key={cell.id}
            className={`msCell ${cell.state} ${cell.state === 'mine' ? 'msCellExplode' : ''}`}
            onClick={() => clickCell(cell.id)}
            disabled={gameEnded || cell.state !== 'hidden' || spectator}
          >
            {renderCell(cell)}
          </button>
        ))}
      </div>

      <div className="minesweeperInstructions">
        {!gameStarted ? 'TAP TILES! AVOID 3 MINES!' : gameEnded ? (safeCount === GRID_SIZE - MINE_COUNT ? 'ALL SAFE!' : 'BOOM!') : `${GRID_SIZE - MINE_COUNT - safeCount} SAFE REMAINING`}
      </div>

      <div className="minesweeperPaytable">
        <div className="paytableRow">6 SAFE = WIN</div>
        <div className="paytableRow">4-5 SAFE = CLOSE WIN</div>
        <div className="paytableRow">2-3 SAFE = CLOSE LOSS</div>
        <div className="paytableRow">1 SAFE = LOSS</div>
      </div>
    </div>
  );
}
