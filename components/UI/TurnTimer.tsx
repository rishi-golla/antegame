'use client';

import { useSocket } from '@/context/SocketContext';

export default function TurnTimer() {
  const { turnTimer } = useSocket();

  if (!turnTimer || turnTimer.remaining <= 0) return null;

  const pct = (turnTimer.remaining / turnTimer.total) * 100;
  const seconds = Math.ceil(turnTimer.remaining / 1000);
  const urgent = seconds <= 10;
  const critical = seconds <= 5;

  return (
    <div className={`turnTimerBar ${urgent ? 'urgent' : ''} ${critical ? 'critical' : ''}`}>
      <div className="turnTimerFill" style={{ width: `${pct}%` }} />
      <span className="turnTimerText">{seconds}s</span>
    </div>
  );
}
