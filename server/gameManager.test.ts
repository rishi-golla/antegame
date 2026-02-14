import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './roomManager';
import { applyGameAction, applyJailEscape, isCurrentPlayer } from './gameManager';

let rm: RoomManager;
let code: string;

beforeEach(() => {
  rm = new RoomManager();
  const result = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
  code = result.code!;
  rm.joinRoom(code, 's2', 'Bob', '#5cd6c0');
  rm.setReady(code, 's1');
  rm.setReady(code, 's2');
  rm.startGame(code, 's1');
});

describe('isCurrentPlayer', () => {
  it('returns true for current player', () => {
    const room = rm.getRoom(code)!;
    expect(isCurrentPlayer(room, 's1')).toBe(true);
  });

  it('returns false for non-current player', () => {
    const room = rm.getRoom(code)!;
    expect(isCurrentPlayer(room, 's2')).toBe(false);
  });
});

describe('applyGameAction', () => {
  it('allows current player to roll', () => {
    const room = rm.getRoom(code)!;
    const result = applyGameAction(room, 's1', 'roll');
    expect(result.ok).toBe(true);
    expect(result.state).toBeTruthy();
    expect(result.state!.dice[0]).toBeGreaterThanOrEqual(1);
    expect(result.state!.dice[0]).toBeLessThanOrEqual(6);
  });

  it('rejects action from non-current player', () => {
    const room = rm.getRoom(code)!;
    const result = applyGameAction(room, 's2', 'roll');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Not your turn');
  });

  it('updates room game state after action', () => {
    const room = rm.getRoom(code)!;
    const oldLog = room.gameState!.log.length;
    applyGameAction(room, 's1', 'roll');
    // Log should have new entries after rolling
    expect(room.gameState!.log.length).toBeGreaterThan(oldLog);
  });

  it('rejects action when game not started', () => {
    const rm2 = new RoomManager();
    const { code: c2 } = rm2.createRoom('s1', 'Alice', '#ff6b6b', 2);
    const room = rm2.getRoom(c2!)!;
    const result = applyGameAction(room, 's1', 'roll');
    expect(result.ok).toBe(false);
  });
});

describe('applyJailEscape', () => {
  it('rejects from non-current player', () => {
    const room = rm.getRoom(code)!;
    const result = applyJailEscape(room, 's2', 'bail');
    expect(result.ok).toBe(false);
  });
});
