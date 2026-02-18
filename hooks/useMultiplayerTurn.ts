'use client';

import { useContext } from 'react';
import { useGame } from '@/context/GameContext';

/**
 * Returns whether the current client is the active player in a multiplayer game.
 * In free play (no socket), always returns true.
 * In multiplayer, checks roomState to find our playerIndex and compares to currentPlayerIndex.
 */
export function useMultiplayerTurn(): { isMyTurn: boolean; myPlayerIndex: number | null } {
  const { state } = useGame();

  // Try to get socket context — may not exist in free play
  try {
    const { useSocket } = require('@/context/SocketContext');
    const { roomState } = useSocket();
    if (roomState) {
      const myIndex = roomState.players.findIndex((p: any) => p.isYou);
      return {
        isMyTurn: myIndex === state.currentPlayerIndex,
        myPlayerIndex: myIndex >= 0 ? myIndex : null,
      };
    }
  } catch {}

  // Free play — always your turn (local game)
  return { isMyTurn: true, myPlayerIndex: null };
}
