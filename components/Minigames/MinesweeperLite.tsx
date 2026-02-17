'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

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

const GRID_SIZE = 9; // 3x3 grid
const MINE_COUNT = 3;

export default function MinesweeperLite({ onResult, baseAmount, context }: MinesweeperLiteProps) {
  const [grid, setGrid] = useState<Cell[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [safeCount, setSafeCount] = useState(0);
  const [firstClick, setFirstClick] = useState(true);

  useEffect(() => {
    initializeGrid();
    
    // 15-second timeout
    const timer = setTimeout(() => {
      if (!gameEnded) {
        onResult('catastrophic');
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const initializeGrid = () => {
    const newGrid: Cell[] = [];
    
    // Create empty grid
    for (let i = 0; i < GRID_SIZE; i++) {
      newGrid.push({
        id: i,
        hasMine: false,
        state: 'hidden',
        safeRevealed: false
      });
    }

    // Place mines randomly
    const minePositions = new Set<number>();
    while (minePositions.size < MINE_COUNT) {
      const pos = Math.floor(Math.random() * GRID_SIZE);
      minePositions.add(pos);
    }

    minePositions.forEach(pos => {
      newGrid[pos].hasMine = true;
    });

    setGrid(newGrid);
  };

  const clickCell = (cellId: number) => {
    if (gameEnded || grid[cellId].state !== 'hidden') return;

    setGameStarted(true);
    const newGrid = [...grid];
    const clickedCell = newGrid[cellId];

    if (clickedCell.hasMine) {
      // Hit a mine - game over immediately
      clickedCell.state = 'mine';
      setGrid(newGrid);
      setGameEnded(true);

      if (firstClick) {
        // First click was a mine - catastrophic
        setTimeout(() => {
          onResult('catastrophic');
        }, 1000);
      } else {
        // Calculate result based on safe tiles revealed so far
        setTimeout(() => {
          calculateResult(safeCount);
        }, 1000);
      }
    } else {
      // Safe tile
      clickedCell.state = 'revealed';
      clickedCell.safeRevealed = true;
      const newSafeCount = safeCount + 1;
      setSafeCount(newSafeCount);
      setGrid(newGrid);
      setFirstClick(false);

      // Check if all safe tiles are revealed
      if (newSafeCount === GRID_SIZE - MINE_COUNT) {
        setGameEnded(true);
        setTimeout(() => {
          calculateResult(newSafeCount);
        }, 500);
      }
    }
  };

  const calculateResult = (safeTilesRevealed: number) => {
    if (safeTilesRevealed === 6) {
      onResult('win');
    } else if (safeTilesRevealed >= 4) {
      onResult('close-win');
    } else if (safeTilesRevealed >= 2) {
      onResult('close-loss');
    } else if (safeTilesRevealed === 1) {
      onResult('loss');
    } else {
      // This case is handled by firstClick mine check
      onResult('catastrophic');
    }
  };

  const getCellContent = (cell: Cell) => {
    switch (cell.state) {
      case 'hidden':
        return '⬜';
      case 'revealed':
        return '💎';
      case 'mine':
        return '💀';
      default:
        return '⬜';
    }
  };

  const getCellClass = (cell: Cell) => {
    let className = 'minesweeperCell';
    if (cell.state === 'revealed') className += ' safe';
    if (cell.state === 'mine') className += ' mine';
    if (cell.state === 'hidden') className += ' hidden';
    return className;
  };

  return (
    <div className="minesweeperLite">
      <div className="minesweeperHeader">
        <h2 className="minesweeperTitle">MINESWEEPER LITE</h2>
        <div className="minesweeperStats">
          Safe Found: {safeCount} / {GRID_SIZE - MINE_COUNT}
        </div>
      </div>

      <div className="minesweeperGrid">
        {grid.map((cell) => (
          <button
            key={cell.id}
            className={getCellClass(cell)}
            onClick={() => clickCell(cell.id)}
            disabled={gameEnded || cell.state !== 'hidden'}
          >
            <span className="cellContent">
              {getCellContent(cell)}
            </span>
          </button>
        ))}
      </div>

      <div className="minesweeperInstructions">
        {!gameStarted ? (
          'Click tiles to reveal them. Avoid the 3 hidden mines!'
        ) : gameEnded ? (
          safeCount === GRID_SIZE - MINE_COUNT ? 'All safe tiles found!' : 'Game Over!'
        ) : (
          `${GRID_SIZE - MINE_COUNT - safeCount} safe tiles remaining`
        )}
      </div>

      <div className="minesweeperPaytable">
        <div className="paytableRow">6 safe (all) = WIN</div>
        <div className="paytableRow">4-5 safe = CLOSE WIN</div>
        <div className="paytableRow">2-3 safe = CLOSE LOSS</div>
        <div className="paytableRow">1 safe = LOSS</div>
        <div className="paytableRow">First click mine = CATASTROPHIC</div>
      </div>
    </div>
  );
}