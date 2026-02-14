'use client';

import { useGame } from '@/context/GameContext';
import { useEffect, useRef } from 'react';

export default function GameLogView() {
  const { state } = useGame();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [state.log.length]);

  return (
    <div className="sideContent">
      <div className="feed logFeed" ref={feedRef}>
        {state.log.map((entry, i) => (
          <div key={i} className="logEntry" style={{ animationDelay: `${Math.min(i, 5) * 70}ms` }}>
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
