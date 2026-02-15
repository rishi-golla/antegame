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
  | { type: 'JAIL_ESCAPE'; method: 'bail' | 'card' | 'roll' }
  | { type: 'BANKRUPTCY' }
  | { type: 'BUILD_HOUSE'; tileIndex: number }
  | { type: 'SELL_HOUSE'; tileIndex: number }
  | { type: 'MORTGAGE'; tileIndex: number }
  | { type: 'UNMORTGAGE'; tileIndex: number }
  | { type: 'PROPOSE_TRADE'; offer: import('@/types/game').TradeOffer }
  | { type: 'ACCEPT_TRADE' }
  | { type: 'REJECT_TRADE' };

export function MultiplayerGameProvider({ children }: { children: ReactNode }) {
  const { gameState, sendGameAction, sendPropertyAction, sendTradeAction } = useSocket();

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
      case 'BANKRUPTCY':
        sendGameAction('bankruptcy');
        break;
      case 'BUILD_HOUSE':
        sendPropertyAction('build-house', action.tileIndex);
        break;
      case 'SELL_HOUSE':
        sendPropertyAction('sell-house', action.tileIndex);
        break;
      case 'MORTGAGE':
        sendPropertyAction('mortgage', action.tileIndex);
        break;
      case 'UNMORTGAGE':
        sendPropertyAction('unmortgage', action.tileIndex);
        break;
      case 'PROPOSE_TRADE':
        sendTradeAction('propose', { offer: action.offer });
        break;
      case 'ACCEPT_TRADE':
        sendTradeAction('accept');
        break;
      case 'REJECT_TRADE':
        sendTradeAction('reject');
        break;
    }
  };

  return (
    <GameContext.Provider value={{ state: gameState, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}
