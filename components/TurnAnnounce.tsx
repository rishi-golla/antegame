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
        setTimeout(() => setAnnouncement(null), 1800);
      }
    }

    prevIndexRef.current = state.currentPlayerIndex;
    prevPhaseRef.current = state.phase;
  }, [state.currentPlayerIndex, state.phase, state.players]);

  if (!announcement) return null;

  return (
    <>
      <style>{`
        @keyframes ta-textReveal {
          0% { transform: scale(0.85); opacity: 0; filter: blur(8px); }
          20% { transform: scale(1.02); opacity: 1; filter: blur(0); }
          75% { transform: scale(1); opacity: 1; filter: blur(0); }
          100% { transform: scale(1.05); opacity: 0; filter: blur(4px); }
        }
        @keyframes ta-backdropFade {
          0% { opacity: 0; backdrop-filter: blur(0); }
          15% { opacity: 1; backdrop-filter: blur(6px); }
          75% { opacity: 1; backdrop-filter: blur(6px); }
          100% { opacity: 0; backdrop-filter: blur(0); }
        }
        @keyframes ta-underline {
          0% { transform: scaleX(0); opacity: 0; }
          25% { transform: scaleX(1); opacity: 1; }
          75% { transform: scaleX(1); opacity: 1; }
          100% { transform: scaleX(0); opacity: 0; }
        }
        @keyframes ta-glowPulse {
          0%, 100% { text-shadow: 0 0 20px var(--ta-color), 0 2px 8px rgba(0,0,0,0.8); }
          50% { text-shadow: 0 0 40px var(--ta-color), 0 0 80px var(--ta-color), 0 2px 8px rgba(0,0,0,0.8); }
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
        animation: 'ta-backdropFade 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        background: 'rgba(0,0,0,0.5)',
        willChange: 'opacity',
      }}>
        <div style={{
          animation: 'ta-textReveal 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
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
            ['--ta-color' as string]: `${announcement.color}88`,
            animation: 'ta-glowPulse 1s ease-in-out infinite',
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
            animation: 'ta-underline 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            transformOrigin: 'center',
            willChange: 'transform',
          }} />
        </div>
      </div>
    </>
  );
}
