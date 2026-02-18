'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';

interface MinesweeperLiteProps {
  onResult: (tier: MinigameTier) => void;
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

export default function MinesweeperLite({ onResult, baseAmount, context }: MinesweeperLiteProps) {
  const { play } = useAudio();
  const [grid, setGrid] = useState<Cell[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [safeCount, setSafeCount] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  useEffect(() => {
    initializeGrid();
    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, []);

  const initializeGrid = () => {
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
  };

  const clickCell = (cellId: number) => {
    if (gameEnded || grid[cellId].state !== 'hidden') return;
    play('minigames/mine-click');
    setGameStarted(true);
    const newGrid = [...grid];
    const clickedCell = newGrid[cellId];

    if (clickedCell.hasMine) {
      play('minigames/mine-boom');
      clickedCell.state = 'mine';
      setGrid(newGrid);
      setGameEnded(true);
      if (firstClick) {
        setTimeout(() => onResult('catastrophic'), 1000);
      } else {
        setTimeout(() => calculateResult(safeCount), 1000);
      }
    } else {
      play('minigames/mine-safe');
      clickedCell.state = 'revealed';
      clickedCell.safeRevealed = true;
      const newSafeCount = safeCount + 1;
      setSafeCount(newSafeCount);
      setGrid(newGrid);
      setFirstClick(false);
      if (newSafeCount === GRID_SIZE - MINE_COUNT) {
        setGameEnded(true);
        setTimeout(() => calculateResult(newSafeCount), 500);
      }
    }
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
    // mine
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
            disabled={gameEnded || cell.state !== 'hidden'}
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
