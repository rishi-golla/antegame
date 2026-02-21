'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';

export default function TurnTimer() {
  const { socket } = useSocket();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState(45000);

  useEffect(() => {
    if (!socket) return;

    const handleTimer = (data: { remaining: number; total: number }) => {
      setRemaining(data.remaining);
      setTotal(data.total);
    };

    socket.on('turn:timer', handleTimer);
    return () => { socket.off('turn:timer', handleTimer); };
  }, [socket]);

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
