'use client';

import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';

export default function TurnSummary() {
  const { state } = useGame();
  const [show, setShow] = useState(false);
  const [stats, setStats] = useState<{ name: string; color: string; moneyChange: number } | null>(null);
  const prevPlayerRef = useRef(state.currentPlayerIndex);
  const prevMoneyRef = useRef<Record<number, number>>({});

  // Track money per player
  useEffect(() => {
    state.players.forEach(p => {
      if (prevMoneyRef.current[p.id] === undefined) {
        prevMoneyRef.current[p.id] = p.money;
      }
    });
  }, [state.players]);

  // On turn change, briefly flash the previous player's net change
  useEffect(() => {
    const prev = prevPlayerRef.current;
    const curr = state.currentPlayerIndex;

    if (curr !== prev) {
      const player = state.players.find(p => p.id === prev);
      if (player && !player.bankrupt) {
        const prevMoney = prevMoneyRef.current[prev] ?? player.money;
        const diff = player.money - prevMoney;

        if (diff !== 0) {
          setStats({ name: player.name, color: player.color, moneyChange: diff });
          setShow(true);
          setTimeout(() => setShow(false), 1500);
        }
      }

      // Update stored money for all players at turn boundary
      state.players.forEach(p => {
        prevMoneyRef.current[p.id] = p.money;
      });
    }

    prevPlayerRef.current = curr;
  }, [state.currentPlayerIndex, state.players]);

  if (!show || !stats) return null;

  const isPositive = stats.moneyChange > 0;

  return (
    <div className="turn-flash">
      <span className="turn-flash-name">{stats.name}</span>
      <span className={`turn-flash-amount ${isPositive ? 'flash-positive' : 'flash-negative'}`}>
        {isPositive ? '+' : ''}${Math.abs(stats.moneyChange).toLocaleString()}
      </span>
    </div>
  );
}
