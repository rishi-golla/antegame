'use client';

import { useState } from 'react';

interface MoneyFloatEntry {
  id: number;
  amount: number;
  playerColor: string;
  x: number;
  y: number;
}

let nextId = 0;

export function useMoneyFloats() {
  const [floats, setFloats] = useState<MoneyFloatEntry[]>([]);

  const addFloat = (amount: number, playerColor: string) => {
    const id = nextId++;
    const entry: MoneyFloatEntry = {
      id,
      amount,
      playerColor,
      x: 50 + (Math.random() - 0.5) * 20,
      y: 40 + (Math.random() - 0.5) * 10,
    };
    setFloats((prev) => [...prev, entry]);
    setTimeout(() => {
      setFloats((prev) => prev.filter((f) => f.id !== id));
    }, 1500);
  };

  return { floats, addFloat };
}

export default function MoneyFloat({ floats }: { floats: MoneyFloatEntry[] }) {
  return (
    <>
      {floats.map((f) => (
        <div
          key={f.id}
          className={`moneyFloat ${f.amount >= 0 ? 'moneyPlus' : 'moneyMinus'}`}
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            color: f.playerColor,
          }}
        >
          {f.amount >= 0 ? '+' : ''}${Math.abs(f.amount)}
        </div>
      ))}
    </>
  );
}
