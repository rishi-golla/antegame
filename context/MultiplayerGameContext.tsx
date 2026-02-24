'use client';

import type { ReactNode, Dispatch } from 'react';
import type { GameState, MinigameTier, MinigameContext } from '@/types/game';
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
  | { type: 'REJECT_TRADE' }
  | { type: 'CANCEL_TRADE' }
  | { type: 'COUNTER_TRADE'; offer: import('@/types/game').TradeOffer }
  | { type: 'GAMBLE'; context: MinigameContext }
  | { type: 'MINIGAME_RESULT'; tier: MinigameTier }
  | { type: 'PAY_RENT' }
  | { type: 'RESOLVE_DEBT' }
  | { type: 'SYSTEM_LOG'; message: string; playerIndex?: number };

export function MultiplayerGameProvider({ children }: { children: ReactNode }) {
  const { gameState, sendGameAction, sendPropertyAction, sendTradeAction } = useSocket();

  if (!gameState) {
    return null;
  }

  const dispatch: Dispatch<GameAction> = (action) => {
    console.log('[MultiplayerDispatch]', action.type);
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
        // Server handles turn-end auto-advance (2.5s delay) — don't send from client
        // to avoid double-advancing turns
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
      case 'CANCEL_TRADE':
        sendTradeAction('cancel');
        break;
      case 'COUNTER_TRADE':
        sendTradeAction('counter', { offer: action.offer });
        break;
      case 'GAMBLE':
        sendGameAction('gamble', { context: action.context });
        break;
      case 'MINIGAME_RESULT':
        sendGameAction('minigame-result', { tier: action.tier });
        break;
      case 'PAY_RENT':
        sendGameAction('pay-rent');
        break;
      case 'RESOLVE_DEBT':
        sendGameAction('resolve-debt');
        break;
      case 'SYSTEM_LOG':
        // System log is local-only (free play); in multiplayer the server sends system messages
        break;
    }
  };

  return (
    <GameContext.Provider value={{ state: gameState, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}
