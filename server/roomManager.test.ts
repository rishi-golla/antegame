import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from './roomManager';

let rm: RoomManager;

beforeEach(() => {
  rm = new RoomManager();
});

describe('createRoom', () => {
  it('creates a room and returns a 6-char code', () => {
    const result = rm.createRoom('socket-1', 'Alice', '#ff6b6b', 4);
    expect(result.ok).toBe(true);
    expect(result.code).toHaveLength(6);
  });

  it('host is added as first player', () => {
    const result = rm.createRoom('socket-1', 'Alice', '#ff6b6b', 4);
    const room = rm.getRoom(result.code!);
    expect(room).toBeTruthy();
    expect(room!.players).toHaveLength(1);
    expect(room!.players[0].name).toBe('Alice');
    expect(room!.hostId).toBe('socket-1');
  });
});

describe('joinRoom', () => {
  it('joins an existing room', () => {
    const { code } = rm.createRoom('socket-1', 'Alice', '#ff6b6b', 4);
    const result = rm.joinRoom(code!, 'socket-2', 'Bob', '#5cd6c0');
    expect(result.ok).toBe(true);
    const room = rm.getRoom(code!);
    expect(room!.players).toHaveLength(2);
  });

  it('fails with invalid code', () => {
    const result = rm.joinRoom('XXXXXX', 'socket-2', 'Bob', '#5cd6c0');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('fails when room is full', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    const result = rm.joinRoom(code!, 's3', 'Carol', '#ffd166');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('full');
  });

  it('fails when game already started', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.setReady(code!, 's1');
    rm.setReady(code!, 's2');
    rm.startGame(code!, 's1');
    const result = rm.joinRoom(code!, 's3', 'Carol', '#ffd166');
    expect(result.ok).toBe(false);
  });
});

describe('ready and start', () => {
  it('toggles ready status', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.setReady(code!, 's2');
    expect(rm.getRoom(code!)!.players[1].ready).toBe(true);
    rm.setReady(code!, 's2');
    expect(rm.getRoom(code!)!.players[1].ready).toBe(false);
  });

  it('host can start when all players are ready', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.setReady(code!, 's1');
    rm.setReady(code!, 's2');
    const result = rm.startGame(code!, 's1');
    expect(result.ok).toBe(true);
    expect(rm.getRoom(code!)!.phase).toBe('playing');
    expect(rm.getRoom(code!)!.gameState).toBeTruthy();
  });

  it('non-host cannot start', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.setReady(code!, 's1');
    rm.setReady(code!, 's2');
    const result = rm.startGame(code!, 's2');
    expect(result.ok).toBe(false);
  });

  it('cannot start if not all ready', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 2);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.setReady(code!, 's1');
    const result = rm.startGame(code!, 's1');
    expect(result.ok).toBe(false);
  });

  it('needs at least 2 players to start', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 4);
    rm.setReady(code!, 's1');
    const result = rm.startGame(code!, 's1');
    expect(result.ok).toBe(false);
  });
});

describe('leaveRoom', () => {
  it('removes player from room', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 4);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.leaveRoom('s2');
    expect(rm.getRoom(code!)!.players).toHaveLength(1);
  });

  it('deletes room when last player leaves', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 4);
    rm.leaveRoom('s1');
    expect(rm.getRoom(code!)).toBeUndefined();
  });

  it('transfers host when host leaves', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 4);
    rm.joinRoom(code!, 's2', 'Bob', '#5cd6c0');
    rm.leaveRoom('s1');
    expect(rm.getRoom(code!)!.hostId).toBe('s2');
  });
});

describe('findRoomBySocket', () => {
  it('returns the room code for a socket', () => {
    const { code } = rm.createRoom('s1', 'Alice', '#ff6b6b', 4);
    expect(rm.findRoomBySocket('s1')).toBe(code);
  });

  it('returns undefined for unknown socket', () => {
    expect(rm.findRoomBySocket('unknown')).toBeUndefined();
  });
});
