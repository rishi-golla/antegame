'use client';

import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';

export default function TurnAnnounce() {
  const { state } = useGame();
  const [announcement, setAnnouncement] = useState<{ name: string; color: string } | null>(null);
  const prevIndexRef = useRef<number>(state.currentPlayerIndex);
  const prevPhaseRef = useRef(state.phase);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevIndexRef.current = state.currentPlayerIndex;
      prevPhaseRef.current = state.phase;
      return;
    }

    const indexChanged = prevIndexRef.current !== state.currentPlayerIndex;
    const isTurnStart = state.phase === 'rolling' || state.phase === 'in-jail' || state.phase === 'waiting';

    if (indexChanged && isTurnStart) {
      const player = state.players[state.currentPlayerIndex];
      if (player && !player.bankrupt) {
        setAnnouncement({ name: player.name, color: player.color });
        setTimeout(() => setAnnouncement(null), 1200);
      }
    }

    prevIndexRef.current = state.currentPlayerIndex;
    prevPhaseRef.current = state.phase;
  }, [state.currentPlayerIndex, state.phase, state.players]);

  if (!announcement) return null;

  return (
    <>
      <style>{`
        @keyframes ta-slideIn {
          0% { transform: translateX(-120%); opacity: 0; }
          15% { transform: translateX(0); opacity: 1; }
          65% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }
        @keyframes ta-backdropFade {
          0% { opacity: 0; }
          10% { opacity: 1; }
          70% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes ta-underline {
          0% { transform: scaleX(0); }
          20% { transform: scaleX(1); }
          70% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'ta-backdropFade 1.2s ease-out forwards',
        background: 'rgba(0,0,0,0.4)',
        willChange: 'opacity',
      }}>
        <div style={{
          animation: 'ta-slideIn 1.2s ease-out forwards',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          willChange: 'transform, opacity',
        }}>
          <div style={{
            fontFamily: 'Cinzel, serif',
            fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
            fontWeight: 700,
            color: announcement.color,
            textShadow: `0 0 30px ${announcement.color}88, 0 2px 8px rgba(0,0,0,0.8)`,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>
            {announcement.name.toUpperCase()}&apos;S TURN
          </div>
          <div style={{
            width: '80%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #d4af37, transparent)',
            marginTop: '8px',
            animation: 'ta-underline 1.2s ease-out forwards',
            transformOrigin: 'center',
            willChange: 'transform',
          }} />
        </div>
      </div>
    </>
  );
}
