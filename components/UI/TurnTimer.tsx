'use client';

import {} from 'react';
import { useSocket } from '@/context/SocketContext';

export default function TurnTimer() {
  const { turnTimer } = useSocket();

  const remaining = turnTimer?.remaining ?? null;
  const total = turnTimer?.total ?? 45000;

  if (remaining === null || remaining <= 0) return null;

  const seconds = Math.ceil(remaining / 1000);
  const pct = (remaining / total) * 100;
  const isUrgent = seconds <= 10;
  const isCritical = seconds <= 5;

  return (
    <div className={`turnTimer ${isUrgent ? 'urgent' : ''} ${isCritical ? 'critical' : ''}`}>
      <div className="turnTimerBar">
        <div
          className="turnTimerFill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="turnTimerText">{seconds}s</span>
    </div>
  );
}
