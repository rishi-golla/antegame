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

  // Auto-advance turn-end when no doubles (skip the "Next Player" click)
  if (newState.phase === 'turn-end' && newState.doublesCount === 0) {
    newState = endTurn(newState);
  }

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
  if (!isCurrentPlayer(room, socketId)) return { ok: false, error: 'Not your turn' };

  let newState = attemptJailEscape(room.gameState, method);

  // Auto-advance turn-end when no doubles
  if (newState.phase === 'turn-end' && newState.doublesCount === 0) {
    newState = endTurn(newState);
  }

  room.gameState = newState;
  room.lastActivity = Date.now();

  return { ok: true, state: newState };
}
