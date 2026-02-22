'use client';

import { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/context/SocketContext';

interface CountdownTimerProps {
  /** Total seconds for this phase (fallback if no server data) */
  duration: number;
  /** Called when timer hits 0 */
  onExpire: () => void;
  /** Unique key to reset timer (e.g. phase + playerIndex) */
  resetKey: string;
}

export default function CountdownTimer({ duration, onExpire, resetKey }: CountdownTimerProps) {
  const { turnTimer } = useSocket();
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredRef = useRef(false);

  // Derive remaining from server turn timer (seconds), fallback to duration
  const serverSeconds = turnTimer ? Math.ceil(turnTimer.remaining / 1000) : null;
  const serverTotal = turnTimer ? Math.ceil(turnTimer.total / 1000) : null;
  const [remaining, setRemaining] = useState(duration);

  // Sync with server timer ticks
  useEffect(() => {
    if (serverSeconds !== null) {
      setRemaining(serverSeconds);
      if (serverSeconds <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setTimeout(() => onExpireRef.current(), 0);
      }
    }
  }, [serverSeconds]);

  // Reset expired flag when resetKey changes
  useEffect(() => {
    expiredRef.current = false;
  }, [resetKey]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const total = serverTotal ?? duration;
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = circumference * (1 - progress);
  const isWarning = remaining <= 5 && remaining > 0;

  return (
    <div className={`countdownTimer ${isWarning ? 'countdownWarning' : ''}`}>
      <svg width="48" height="48" viewBox="0 0 48 48" className="countdownRing">
        {/* Background track */}
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke="rgba(212,175,55,0.15)"
          strokeWidth="3"
        />
        {/* Countdown arc */}
        <circle
          cx="24" cy="24" r={radius}
          fill="none"
          stroke={isWarning ? '#ff4444' : '#d4af37'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 24 24)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span className="countdownNumber">{remaining}</span>
    </div>
  );
}
