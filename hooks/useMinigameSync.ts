'use client';

import { useEffect, useRef, useCallback, useContext } from 'react';
import { SocketContext } from '@/context/SocketContext';

type ActionHandler = (data: any) => void;

/**
 * Hook for syncing minigame actions between active player and spectators.
 * In free-play (no SocketProvider), this is a no-op.
 */
export function useMinigameSync(spectator: boolean, onAction?: ActionHandler) {
  const socketCtx = useContext(SocketContext);
  const socket = socketCtx?.rawSocket ?? null;
  const handlerRef = useRef<ActionHandler | undefined>(onAction);
  handlerRef.current = onAction;

  // Listen for relayed actions (spectators only)
  useEffect(() => {
    if (!spectator || !socket) return;
    const handler = (data: any) => {
      handlerRef.current?.(data);
    };
    socket.on('game:minigame-action', handler);
    return () => { socket.off('game:minigame-action', handler); };
  }, [spectator, socket]);

  // Emit action (active player only)
  const emitAction = useCallback((data: any) => {
    if (spectator || !socket) return;
    socket.emit('game:minigame-action', data);
  }, [spectator, socket]);

  return { emitAction };
}
