'use client';

import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { particles } from '@/lib/particles';

interface PhysicalCoin {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  life: number;
  size: number;
  value: number;
  phase: 'flying' | 'bouncing' | 'settled';
  bounceCount: number;
}

interface RentTransaction {
  id: string;
  amount: number;
  fromPosition: number;
  toPosition: number;
  startTime: number;
  fromPlayer: number;
  toPlayer: number;
  coins: PhysicalCoin[];
}

interface RentAnimationProps {
  boardSize: number;
}

// Convert tile index to approximate x,y coordinates on the board
function getTilePosition(tileIndex: number, boardSize: number): { x: number; y: number } {
  const tileSize = boardSize / 14; // Board is 14x14 grid
  
  // Bottom edge (0-10)
  if (tileIndex <= 10) {
    return {
      x: (13 - tileIndex) * tileSize + tileSize / 2,
      y: 13 * tileSize + tileSize / 2
    };
  }
  // Left edge (11-20)
  else if (tileIndex <= 20) {
    return {
      x: tileSize / 2,
      y: (13 - (tileIndex - 10)) * tileSize + tileSize / 2
    };
  }
  // Top edge (21-30)
  else if (tileIndex <= 30) {
    return {
      x: (tileIndex - 20) * tileSize + tileSize / 2,
      y: tileSize / 2
    };
  }
  // Right edge (31-39)
  else {
    return {
      x: 13 * tileSize + tileSize / 2,
      y: (tileIndex - 30) * tileSize + tileSize / 2
    };
  }
}

// Physical coin component with 3D CSS effects
function PhysicalCoinElement({ coin, fromColor, toColor }: {
  coin: PhysicalCoin;
  fromColor: string;
  toColor: string;
}) {
  // 3D perspective effect based on rotation
  const perspective = Math.abs(Math.cos(coin.rotation));
  const scaleX = 0.2 + perspective * 0.8;
  const brightness = 0.7 + perspective * 0.3;
  
  return (
    <div
      className="physical-coin"
      style={{
        position: 'absolute',
        left: coin.x,
        top: coin.y,
        width: coin.size,
        height: coin.size,
        transform: `translate(-50%, -50%) scaleX(${scaleX}) rotate(${coin.rotation}rad)`,
        background: `linear-gradient(135deg, 
          #FFD700 0%, 
          #FFA500 30%, 
          #FF8C00 70%, 
          #B8860B 100%)`,
        borderRadius: '50%',
        border: '2px solid #DAA520',
        boxShadow: `
          inset 2px 2px 6px rgba(255, 255, 255, 0.3),
          inset -2px -2px 6px rgba(0, 0, 0, 0.3),
          0 ${coin.phase === 'flying' ? 8 : 4}px ${coin.phase === 'flying' ? 16 : 8}px rgba(0, 0, 0, 0.4)
        `,
        filter: `brightness(${brightness})`,
        zIndex: 100,
        pointerEvents: 'none',
        transition: coin.phase === 'settled' ? 'all 0.3s ease-out' : 'none'
      }}
    >
      {/* Coin inner detail */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '20%',
          width: '60%',
          height: '60%',
          borderRadius: '50%',
          background: 'linear-gradient(45deg, rgba(255,255,255,0.4) 0%, transparent 50%)',
          transform: `scaleX(${1/scaleX})` // Counteract parent scaleX
        }}
      />
      
      {/* Value indicator for larger amounts */}
      {coin.value >= 100 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scaleX(${1/scaleX})`,
            fontSize: '8px',
            fontWeight: 'bold',
            color: '#8B4513',
            textShadow: '0 0 2px rgba(255,255,255,0.8)'
          }}
        >
          ${coin.value >= 500 ? '5' : '1'}
        </div>
      )}
    </div>
  );
}

export default function RentAnimation({ boardSize }: RentAnimationProps) {
  const { state } = useGame();
  const [transactions, setTransactions] = useState<RentTransaction[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const prevRentRef = useRef<{ amount: number; toPlayer: number } | null>(null);
  const prevPhaseRef = useRef(state.phase);

  // Physics update loop
  useEffect(() => {
    const updatePhysics = () => {
      setTransactions(prev => prev.map(transaction => ({
        ...transaction,
        coins: transaction.coins.map(coin => {
          if (coin.phase === 'settled') return coin;

          // Apply gravity and movement
          const newVy = coin.vy + 0.5; // Gravity
          const newX = coin.x + coin.vx;
          const newY = coin.y + coin.vy;
          const newRotation = coin.rotation + coin.rotationSpeed;

          // Ground collision (approximate)
          const groundLevel = window.innerHeight * 0.8;
          const hasHitGround = newY >= groundLevel && coin.phase === 'flying';

          if (hasHitGround) {
            // Bounce with energy loss
            const bounceVelocity = -coin.vy * 0.6;
            const bounceCount = coin.bounceCount + 1;
            
            return {
              ...coin,
              x: newX,
              y: groundLevel,
              vx: coin.vx * 0.8, // Friction
              vy: bounceVelocity,
              rotation: newRotation,
              phase: bounceCount >= 3 ? ('settled' as const) : ('bouncing' as const),
              bounceCount,
              life: coin.life - 1
            };
          }

          return {
            ...coin,
            x: newX,
            y: newY,
            vx: coin.phase === 'bouncing' ? coin.vx * 0.99 : coin.vx, // Air resistance
            vy: newVy,
            rotation: newRotation,
            life: coin.life - 1
          };
        }).filter(coin => coin.life > 0)
      })));

      // Remove empty transactions
      setTransactions(prev => prev.filter(t => t.coins.length > 0));

      if (transactions.length > 0) {
        animationFrameRef.current = requestAnimationFrame(updatePhysics);
      }
    };

    if (transactions.length > 0) {
      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [transactions.length]);

  // Detect rent payment and create coin animation
  useEffect(() => {
    if (prevPhaseRef.current === 'paying-rent' && state.phase !== 'paying-rent' && state.pendingRent) {
      const { amount, toPlayer } = state.pendingRent;
      const fromPlayer = state.currentPlayerIndex;
      
      if (fromPlayer !== toPlayer) {
        const fromPos = getTilePosition(state.players[fromPlayer].position, boardSize);
        const toPos = getTilePosition(state.players[toPlayer].position, boardSize);
        
        // Create physical coins based on amount
        const coinCount = Math.min(Math.max(Math.floor(amount / 50), 3), 12);
        const coins: PhysicalCoin[] = [];
        
        for (let i = 0; i < coinCount; i++) {
          const angle = (Math.PI * 2 * i) / coinCount + (Math.random() - 0.5) * 0.5;
          const distance = Math.sqrt((toPos.x - fromPos.x) ** 2 + (toPos.y - fromPos.y) ** 2);
          const speed = 4 + Math.random() * 3;
          const timeToTarget = distance / (speed * 10);
          
          // Calculate initial velocity for parabolic arc
          const vx = (toPos.x - fromPos.x) / timeToTarget + (Math.random() - 0.5) * 2;
          const vy = (toPos.y - fromPos.y) / timeToTarget - 8 - Math.random() * 4; // Arc upward
          
          // Coin value based on position in pour
          const coinValue = amount >= 500 ? 500 : amount >= 100 ? 100 : 50;
          
          coins.push({
            id: `coin-${Date.now()}-${i}`,
            x: fromPos.x + (Math.random() - 0.5) * 20,
            y: fromPos.y + (Math.random() - 0.5) * 20,
            vx,
            vy,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            life: 300 + Math.random() * 100, // 5-6 seconds
            size: amount >= 500 ? 24 : amount >= 100 ? 20 : 16,
            value: coinValue,
            phase: 'flying' as const,
            bounceCount: 0
          });
          
          // Coins will be added to transaction after it's created
        }

        // Create transaction with all coins
        const transaction: RentTransaction = {
          id: `rent-${Date.now()}`,
          amount,
          fromPosition: state.players[fromPlayer].position,
          toPosition: state.players[toPlayer].position,
          startTime: Date.now(),
          fromPlayer,
          toPlayer,
          coins: coins // Add all coins at once
        };

        setTransactions(prev => [...prev, transaction]);

        // Trigger particle effect at destination
        setTimeout(() => {
          particles.createEffect('coin-pour', toPos.x, toPos.y, Math.min(amount / 200, 2));
        }, 1500);

        // Cleanup after animation
        setTimeout(() => {
          setTransactions(prev => prev.filter(t => t.id !== transaction.id));
        }, 8000);
      }
    }

    prevRentRef.current = state.pendingRent;
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.pendingRent, state.currentPlayerIndex, state.players, boardSize]);

  if (boardSize === 0 || transactions.length === 0) {
    return null;
  }

  return (
    <div className="physical-rent-animation">
      {transactions.map(transaction => {
        const fromColor = state.players[transaction.fromPlayer]?.color || '#ff0000';
        const toColor = state.players[transaction.toPlayer]?.color || '#00ff00';
        
        return (
          <div key={transaction.id} className="coin-transaction">
            {transaction.coins.map(coin => (
              <PhysicalCoinElement
                key={coin.id}
                coin={coin}
                fromColor={fromColor}
                toColor={toColor}
              />
            ))}
            
            {/* Amount counter that appears near destination */}
            <div
              className="rent-amount-display"
              style={{
                position: 'absolute',
                left: getTilePosition(transaction.toPosition, boardSize).x,
                top: getTilePosition(transaction.toPosition, boardSize).y - 50,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0, 0, 0, 0.8)',
                color: toColor,
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                border: `1px solid ${toColor}`,
                boxShadow: `0 0 10px ${toColor}40`,
                zIndex: 200,
                animation: 'rent-amount-appear 0.5s ease-out forwards',
                animationDelay: '1s'
              }}
            >
              +${transaction.amount.toLocaleString()}
            </div>
          </div>
        );
      })}
    </div>
  );
}