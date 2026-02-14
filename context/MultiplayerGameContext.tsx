'use client';

import type { ReactNode, Dispatch } from 'react';
import type { GameState } from '@/types/game';
import { GameContext } from './GameContext';
import { useSocket } from './SocketContext';

type GameAction =
  | { type: 'ROLL' }
  | { type: 'BUY' }
  | { type: 'DECLINE' }
  | { type: 'END_TURN' }
  | { type: 'DRAW_CARD' }
  | { type: 'APPLY_CARD' }
  | { type: 'RESOLVE_CARD' }
  | { type: 'JAIL_ESCAPE'; method: 'bail' | 'card' | 'roll' };

export function MultiplayerGameProvider({ children }: { children: ReactNode }) {
  const { gameState, sendGameAction } = useSocket();

  if (!gameState) {
    return null;
  }

  const dispatch: Dispatch<GameAction> = (action) => {
    switch (action.type) {
      case 'ROLL':
        sendGameAction('roll');
        break;
      case 'BUY':
        sendGameAction('buy');
        break;
      case 'DECLINE':
        sendGameAction('decline');
        break;
      case 'END_TURN':
        sendGameAction('end-turn');
        break;
      case 'DRAW_CARD':
        sendGameAction('draw-card');
        break;
      case 'APPLY_CARD':
        sendGameAction('apply-card');
        break;
      case 'RESOLVE_CARD':
        sendGameAction('resolve-card');
        break;
      case 'JAIL_ESCAPE':
        sendGameAction('jail-escape', { method: action.method });
        break;
    }
  };

  return (
    <GameContext.Provider value={{ state: gameState, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}
