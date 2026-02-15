'use client';

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { GameState, GamePhase } from '@/types/game';
import type { TradeOffer } from '@/types/game';
import {
  createGame,
  rollDice,
  buyProperty,
  declinePurchase,
  endTurn,
  drawCard,
  applyDrawnCard,
  resolveCard,
  attemptJailEscape,
  declareBankruptcy,
} from '@/lib/gameEngine';
import { buildHouse, sellHouse, mortgageProperty, unmortgageProperty } from '@/lib/propertyActions';
import { proposeTrade, acceptTrade, rejectTrade } from '@/lib/trading';

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
  | { type: 'PROPOSE_TRADE'; offer: TradeOffer }
  | { type: 'ACCEPT_TRADE' }
  | { type: 'REJECT_TRADE' };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ROLL':
      return rollDice(state);
    case 'BUY':
      return buyProperty(state);
    case 'DECLINE':
      return declinePurchase(state);
    case 'END_TURN':
      return endTurn(state);
    case 'DRAW_CARD':
      return drawCard(state);
    case 'APPLY_CARD':
      return applyDrawnCard(state);
    case 'RESOLVE_CARD':
      return resolveCard(state);
    case 'JAIL_ESCAPE':
      return attemptJailEscape(state, action.method);
    case 'BANKRUPTCY':
      return declareBankruptcy(state, state.currentPlayerIndex);
    case 'BUILD_HOUSE':
      return buildHouse(state, state.currentPlayerIndex, action.tileIndex);
    case 'SELL_HOUSE':
      return sellHouse(state, state.currentPlayerIndex, action.tileIndex);
    case 'MORTGAGE':
      return mortgageProperty(state, state.currentPlayerIndex, action.tileIndex);
    case 'UNMORTGAGE':
      return unmortgageProperty(state, state.currentPlayerIndex, action.tileIndex);
    case 'PROPOSE_TRADE':
      return proposeTrade(state, action.offer);
    case 'ACCEPT_TRADE':
      return acceptTrade(state);
    case 'REJECT_TRADE':
      return rejectTrade(state);
    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const GameContext = createContext<GameContextValue | null>(null);

interface GameProviderProps {
  children: ReactNode;
  playerNames?: string[];
}

export function GameProvider({
  children,
  playerNames = ['Ava', 'Kai', 'Maya', 'Leo'],
}: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, playerNames, createGame);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
