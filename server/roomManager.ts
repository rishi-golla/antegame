import type { Room, ServerPlayer, ChatMessage } from './types';
import { createGame } from '@/lib/gameEngine';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>();

  createRoom(
    socketId: string,
    name: string,
    color: string,
    maxPlayers: number
  ): { ok: boolean; code?: string; error?: string } {
    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (this.rooms.has(code) && attempts < 100) {
      code = generateCode();
      attempts++;
    }

    const player: ServerPlayer = {
      id: socketId,
      name,
      color,
      ready: false,
      connected: true,
      disconnectedAt: null,
      playerIndex: 0,
    };

    const room: Room = {
      code,
      hostId: socketId,
      players: [player],
      phase: 'lobby',
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 6),
      gameState: null,
      chatHistory: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return { ok: true, code };
  }

  joinRoom(
    code: string,
    socketId: string,
    name: string,
    color: string
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.phase !== 'lobby') return { ok: false, error: 'Game already in progress' };
    if (room.players.length >= room.maxPlayers) return { ok: false, error: 'Room is full' };

    const player: ServerPlayer = {
      id: socketId,
      name,
      color,
      ready: false,
      connected: true,
      disconnectedAt: null,
      playerIndex: room.players.length,
    };

    room.players.push(player);
    room.lastActivity = Date.now();
    this.socketToRoom.set(socketId, code);

    return { ok: true };
  }

  leaveRoom(socketId: string): { code: string; deleted: boolean } | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    this.socketToRoom.delete(socketId);
    room.players = room.players.filter((p) => p.id !== socketId);
    room.lastActivity = Date.now();

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return { code, deleted: true };
    }

    // Transfer host if host left
    if (room.hostId === socketId) {
      room.hostId = room.players[0].id;
    }

    // Reindex players
    room.players.forEach((p, i) => {
      p.playerIndex = i;
    });

    return { code, deleted: false };
  }

  setReady(code: string, socketId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;

    const player = room.players.find((p) => p.id === socketId);
    if (!player) return false;

    player.ready = !player.ready;
    room.lastActivity = Date.now();
    return true;
  }

  startGame(
    code: string,
    socketId: string
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.hostId !== socketId) return { ok: false, error: 'Only the host can start' };
    if (room.players.length < 2) return { ok: false, error: 'Need at least 2 players' };
    if (!room.players.every((p) => p.ready)) return { ok: false, error: 'Not all players are ready' };

    const names = room.players.map((p) => p.name);
    const gameState = createGame(names);

    // Apply player colors from lobby
    gameState.players.forEach((gp, i) => {
      gp.color = room.players[i].color;
    });

    room.gameState = gameState;
    room.phase = 'playing';
    room.lastActivity = Date.now();

    return { ok: true };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  findRoomBySocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  getPlayerInRoom(code: string, socketId: string): ServerPlayer | undefined {
    const room = this.rooms.get(code);
    return room?.players.find((p) => p.id === socketId);
  }

  addChatMessage(code: string, message: ChatMessage): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.chatHistory.push(message);
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }
    room.lastActivity = Date.now();
  }

  // Mark player as disconnected (for reconnection)
  markDisconnected(socketId: string): { code: string; playerIndex: number } | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.find((p) => p.id === socketId);
    if (!player) return null;

    player.connected = false;
    player.disconnectedAt = Date.now();

    return { code, playerIndex: player.playerIndex };
  }

  // Reconnect player with new socket ID
  reconnect(
    code: string,
    oldSocketId: string,
    newSocketId: string
  ): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;

    const player = room.players.find((p) => p.id === oldSocketId);
    if (!player) return false;

    this.socketToRoom.delete(oldSocketId);
    this.socketToRoom.set(newSocketId, code);
    player.id = newSocketId;
    player.connected = true;
    player.disconnectedAt = null;

    return true;
  }

  // Clean up stale rooms
  cleanup(maxInactivityMs = 30 * 60 * 1000): string[] {
    const now = Date.now();
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > maxInactivityMs) {
        for (const p of room.players) {
          this.socketToRoom.delete(p.id);
        }
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
