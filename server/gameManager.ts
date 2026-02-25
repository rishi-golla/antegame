import type { Room } from './types';
import type { GameState } from '@/types/game';
import {
  rollDice,
  buyProperty,
  declinePurchase,
  endTurn,
  drawCard,
  applyDrawnCard,
  resolveCard,
  attemptJailEscape,
  resolveDebt,
} from '@/lib/gameEngine';

type GameAction =
  | 'roll'
  | 'buy'
  | 'decline'
  | 'end-turn'
  | 'draw-card'
  | 'apply-card'
  | 'resolve-card'
  | 'resolve-debt';

/** Auto-advance past turn-end (handles both doubles and no-doubles) */
export function autoAdvanceTurnEnd(state: GameState): GameState {
  if (state.phase === 'turn-end') {
    return endTurn(state);
  }
  return state;
}

export function isCurrentPlayer(room: Room, socketId: string): boolean {
  if (!room.gameState) return false;
  const player = room.players.find((p) => p.id === socketId);
  if (!player) return false;
  return player.playerIndex === room.gameState.currentPlayerIndex;
}

export function applyGameAction(
  room: Room,
  socketId: string,
  action: GameAction,
  data?: { method?: 'bail' | 'card' | 'roll' }
): { ok: boolean; state?: GameState; error?: string } {
  if (!room.gameState) return { ok: false, error: 'Game not started' };
  if (room.phase !== 'playing') return { ok: false, error: 'Game not in progress' };

  if (!isCurrentPlayer(room, socketId)) {
    return { ok: false, error: 'Not your turn' };
  }

  // Phase validation: each action is only valid in specific game phases
  const phase = room.gameState.phase;
  const VALID_PHASES: Record<GameAction, string[]> = {
    'roll':         ['rolling'],
    'buy':          ['buying'],
    'decline':      ['buying'],
    'end-turn':     ['turn-end'],
    'draw-card':    ['drawing-card'],
    'apply-card':   ['drawing-card', 'applying-card'],
    'resolve-card': ['applying-card', 'drawing-card'],
    'resolve-debt': ['in-debt'],
  };
  const validPhases = VALID_PHASES[action];
  if (validPhases && !validPhases.includes(phase)) {
    return { ok: false, error: `Cannot ${action} during ${phase} phase` };
  }

  let newState: GameState;

  try {
    switch (action) {
      case 'roll':
        newState = rollDice(room.gameState);
        break;
      case 'buy':
        newState = buyProperty(room.gameState);
        break;
      case 'decline':
        newState = declinePurchase(room.gameState);
        break;
      case 'end-turn':
        newState = endTurn(room.gameState);
        break;
      case 'draw-card':
        newState = drawCard(room.gameState);
        break;
      case 'apply-card':
        newState = applyDrawnCard(room.gameState);
        break;
      case 'resolve-card':
        newState = resolveCard(room.gameState);
        break;
      case 'resolve-debt':
        newState = resolveDebt(room.gameState);
        break;
      default:
        return { ok: false, error: 'Unknown action' };
    }
  } catch (e) {
    return { ok: false, error: 'Action failed' };
  }

  // turn-end auto-advance is handled by the server setTimeout (2.5s delay)

  room.gameState = newState;
  room.lastActivity = Date.now();

  if (newState.phase === 'game-over') {
    room.phase = 'finished';
  }

  return { ok: true, state: newState };
}

export function applyJailEscape(
  room: Room,
  socketId: string,
  method: 'bail' | 'card' | 'roll'
): { ok: boolean; state?: GameState; error?: string } {
  if (!room.gameState) return { ok: false, error: 'Game not started' };
  if (room.phase !== 'playing') return { ok: false, error: 'Game not in progress' };
  if (!isCurrentPlayer(room, socketId)) return { ok: false, error: 'Not your turn' };
  if (room.gameState.phase !== 'in-jail') return { ok: false, error: 'Not in jail phase' };

  let newState = attemptJailEscape(room.gameState, method);

  // turn-end auto-advance is handled by the server setTimeout (2.5s delay)

  room.gameState = newState;
  room.lastActivity = Date.now();

  return { ok: true, state: newState };
}
