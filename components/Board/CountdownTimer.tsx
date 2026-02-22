'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface CountdownTimerProps {
  /** Total seconds for this phase */
  duration: number;
  /** Called when timer hits 0 */
  onExpire: () => void;
  /** Unique key to reset timer (e.g. phase + playerIndex) */
  resetKey: string;
}

export default function CountdownTimer({ duration, onExpire, resetKey }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredRef = useRef(false);

  // Reset when key changes
  useEffect(() => {
    setRemaining(duration);
    expiredRef.current = false;
  }, [resetKey, duration]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          // Fire on next tick to avoid state update during render
          setTimeout(() => onExpireRef.current(), 0);
          return 0;
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resetKey]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / duration;
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
