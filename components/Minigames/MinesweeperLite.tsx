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

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@600;700;800&display=swap');

@keyframes msRevealPop {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes msExplode {
  0% { transform: scale(1); background: #ff2222; }
  30% { transform: scale(1.3); background: #ff4400; box-shadow: 0 0 30px #ff4400, 0 0 60px rgba(255,68,0,0.5); }
  100% { transform: scale(1); background: #441111; }
}
@keyframes msShake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-4px) translateY(2px); }
  30% { transform: translateX(4px) translateY(-2px); }
  50% { transform: translateX(-3px) translateY(1px); }
  70% { transform: translateX(3px); }
  90% { transform: translateX(-2px); }
}
@keyframes msPulse {
  0%, 100% { box-shadow: inset 0 0 20px rgba(255,215,0,0.05); }
  50% { box-shadow: inset 0 0 30px rgba(255,215,0,0.12); }
}
@keyframes msCellHover {
  0% { transform: scale(1); }
  100% { transform: scale(0.96) translateY(2px); }
}
@keyframes msParticleBurst {
  0% { opacity: 1; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
}
`;

export default function MinesweeperLite({ onResult, baseAmount, context, spectator = false }: MinesweeperLiteProps) {
  const { play } = useAudio();
  const [grid, setGrid] = useState<Cell[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [safeCount, setSafeCount] = useState(0);
  const [firstClick, setFirstClick] = useState(true);
  const [shaking, setShaking] = useState(false);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      const newGrid: Cell[] = [];
      for (let i = 0; i < GRID_SIZE; i++) {
        newGrid.push({ id: i, hasMine: data.mines.includes(i), state: 'hidden', safeRevealed: false });
      }
      setGrid(newGrid);
    } else if (data.type === 'click') {
      doClick(data.cellId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    if (!spectator) {
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
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
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

  const tensionLevel = safeCount / (GRID_SIZE - MINE_COUNT);

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        animation: shaking ? 'msShake 0.5s ease-out' : 'none',
      }}>
        {/* Title */}
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 22,
          fontWeight: 900,
          color: '#ffd700',
          letterSpacing: 3,
          margin: 0,
          textShadow: '0 0 10px rgba(255,215,0,0.4)',
        }}>
          VAULT SWEEP
        </h2>

        {/* Digital display */}
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 16,
          color: '#d4af37',
          background: '#1a0f0f',
          border: '2px solid #4a2828',
          borderRadius: 6,
          padding: '6px 16px',
          letterSpacing: 3,
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), 0 0 8px rgba(212,175,55,0.15)',
          textShadow: '0 0 6px rgba(212,175,55,0.5)',
        }}>
          SAFE: {safeCount}/{GRID_SIZE - MINE_COUNT}
        </div>

        {/* Vault frame + grid */}
        <div style={{
          background: 'linear-gradient(135deg, #2e1a1a, #2a0f1f)',
          border: '4px solid #4a2828',
          borderImage: 'linear-gradient(180deg, #d4af37, #8b6914, #d4af37) 1',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 2px 8px rgba(0,0,0,0.4)',
          animation: tensionLevel > 0.5 ? `msPulse ${2 - tensionLevel}s infinite` : 'none',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
          }}>
            {grid.map((cell) => (
              <button
                key={cell.id}
                onClick={() => clickCell(cell.id)}
                disabled={gameEnded || cell.state !== 'hidden' || spectator}
                style={{
                  width: 72, height: 72,
                  border: 'none',
                  borderRadius: 6,
                  cursor: cell.state === 'hidden' && !gameEnded && !spectator ? 'pointer' : 'default',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  ...(cell.state === 'hidden' ? {
                    background: 'linear-gradient(145deg, #3a2020 0%, #2a0f1f 50%, #2e1a1a 100%)',
                    border: '1px solid rgba(212,175,55,0.4)',
                    boxShadow: '2px 2px 6px rgba(0,0,0,0.5), -1px -1px 3px rgba(212,175,55,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
                  } : cell.state === 'revealed' ? {
                    background: 'radial-gradient(circle, #2e1a1a, #1a0f0f)',
                    boxShadow: '0 0 12px rgba(212,175,55,0.3), inset 0 0 8px rgba(212,175,55,0.1)',
                    animation: 'msRevealPop 0.4s ease-out',
                  } : {
                    background: '#3d0f22',
                    boxShadow: '0 0 20px rgba(107,26,58,0.5), inset 0 0 12px rgba(255,23,68,0.3)',
                    animation: 'msExplode 0.6s ease-out',
                  }),
                }}
              >
                {cell.state === 'hidden' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%',
                  }}>
                    <span style={{
                      fontFamily: 'Nunito, sans-serif',
                      fontSize: 11,
                      color: '#b89a6a',
                      fontWeight: 700,
                      opacity: 0.6,
                    }}>
                      {String(cell.id + 1).padStart(2, '0')}
                    </span>
                  </div>
                )}
                {cell.state === 'revealed' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%',
                  }}>
                    <span style={{
                      fontSize: 28,
                      color: '#ffd700',
                      textShadow: '0 0 8px rgba(255,215,0,0.6)',
                      fontWeight: 900,
                    }}>
                      ◆
                    </span>
                  </div>
                )}
                {cell.state === 'mine' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '100%', height: '100%',
                  }}>
                    <span style={{
                      fontSize: 28,
                      color: '#ff3333',
                      textShadow: '0 0 12px rgba(255,0,0,0.8)',
                      fontWeight: 900,
                    }}>
                      ✕
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          color: '#c9a84c',
          letterSpacing: 1,
          textAlign: 'center',
        }}>
          {!gameStarted ? 'TAP DEPOSIT BOXES — AVOID 3 MINES' : gameEnded ? (safeCount === GRID_SIZE - MINE_COUNT ? '✦ VAULT CLEARED ✦' : '✕ DETONATION ✕') : `${GRID_SIZE - MINE_COUNT - safeCount} SAFE REMAINING`}
        </div>

        {/* Paytable */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          fontFamily: 'Nunito, sans-serif',
          fontSize: 10,
          color: '#777',
          textAlign: 'center',
          padding: '6px 12px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 6,
          border: '1px solid #c9a84c22',
        }}>
          <div>6 SAFE = WIN</div>
          <div>4-5 SAFE = CLOSE WIN</div>
          <div>2-3 SAFE = CLOSE LOSS</div>
          <div>1 SAFE = LOSS</div>
        </div>
      </div>
    </>
  );
}
