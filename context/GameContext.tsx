'use client';

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { GameState, GamePhase } from '@/types/game';
import {
  createGame,
  rollDice,
  buyProperty,
  declinePurchase,
  endTurn,
  drawCard,
  applyDrawnCard,
  attemptJailEscape,
} from '@/lib/gameEngine';

type GameAction =
  | { type: 'ROLL' }
  | { type: 'BUY' }
  | { type: 'DECLINE' }
  | { type: 'END_TURN' }
  | { type: 'DRAW_CARD' }
  | { type: 'APPLY_CARD' }
  | { type: 'JAIL_ESCAPE'; method: 'bail' | 'card' | 'roll' };

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
    case 'JAIL_ESCAPE':
      return attemptJailEscape(state, action.method);
    default:
      return state;
  }
}

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

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
