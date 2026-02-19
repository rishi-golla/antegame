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
    maxPlayers: number,
    opts?: { walletAddress?: string; buyInEth?: string; onChainTxHash?: string; characterId?: string }
  ): { ok: boolean; code?: string; error?: string } {
    // Generate unique code
    let code = generateCode();
    let attempts = 0;
    while (this.rooms.has(code) && attempts < 100) {
      code = generateCode();
      attempts++;
    }

    const isOnChain = !!opts?.buyInEth;

    const player: ServerPlayer = {
      id: socketId,
      name,
      color,
      characterId: opts?.characterId,
      ready: false,
      connected: true,
      disconnectedAt: null,
      playerIndex: 0,
      walletAddress: opts?.walletAddress,
      deposited: false,
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
      entryFeeLamports: 0,
      potLamports: 0,
      isQuickPlay: false,
      buyInEth: opts?.buyInEth ?? '',
      isOnChain,
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return { ok: true, code };
  }

  joinRoom(
    code: string,
    socketId: string,
    name: string,
    color: string,
    opts?: { walletAddress?: string; onChainTxHash?: string; characterId?: string }
  ): { ok: boolean; error?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.phase !== 'lobby') return { ok: false, error: 'Game already in progress' };
    if (room.players.length >= room.maxPlayers) return { ok: false, error: 'Room is full' };
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, error: 'Name already taken in this room' };
    }
    if (room.players.some((p) => p.color === color)) {
      return { ok: false, error: 'Color already taken in this room' };
    }

    const player: ServerPlayer = {
      id: socketId,
      name,
      color,
      characterId: opts?.characterId,
      ready: false,
      connected: true,
      disconnectedAt: null,
      playerIndex: room.players.length,
      walletAddress: opts?.walletAddress,
      deposited: false,
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

    // Apply player colors and character IDs from lobby
    gameState.players.forEach((gp, i) => {
      gp.color = room.players[i].color;
      gp.characterId = room.players[i].characterId;
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

  // Find an open quick-play room with matching entry fee
  findQuickPlayRoom(entryFeeLamports: number): Room | undefined {
    for (const [, room] of this.rooms) {
      if (
        room.isQuickPlay &&
        room.phase === 'lobby' &&
        room.entryFeeLamports === entryFeeLamports &&
        room.players.length < room.maxPlayers
      ) {
        return room;
      }
    }
    return undefined;
  }

  // Find quick-play room by ETH buy-in tier
  findQuickPlayRoomByEth(buyInEth: string): Room | undefined {
    for (const [, room] of this.rooms) {
      if (
        room.isQuickPlay &&
        room.phase === 'lobby' &&
        room.buyInEth === buyInEth &&
        room.players.length < room.maxPlayers
      ) {
        return room;
      }
    }
    return undefined;
  }

  // Create a quick-play room
  createQuickPlayRoom(
    socketId: string,
    name: string,
    color: string,
    entryFeeLamports: number,
    walletAddress: string
  ): { ok: boolean; code?: string; error?: string } {
    const result = this.createRoom(socketId, name, color, 4);
    if (result.ok && result.code) {
      const room = this.rooms.get(result.code)!;
      room.isQuickPlay = true;
      room.entryFeeLamports = entryFeeLamports;
      const player = room.players[0];
      player.walletAddress = walletAddress;
    }
    return result;
  }

  // Create a quick-play room for Base chain (ETH tiers)
  createQuickPlayRoomBase(
    socketId: string,
    name: string,
    color: string,
    buyInEth: string,
    walletAddress: string
  ): { ok: boolean; code?: string; error?: string } {
    const result = this.createRoom(socketId, name, color, 6);
    if (result.ok && result.code) {
      const room = this.rooms.get(result.code)!;
      room.isQuickPlay = true;
      room.buyInEth = buyInEth;
      room.isOnChain = true;
      room.maxPlayers = 6;
      const player = room.players[0];
      player.walletAddress = walletAddress;
    }
    return result;
  }

  // Mark player as deposited (Solana path)
  markDeposited(code: string, socketId: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    const player = room.players.find((p) => p.id === socketId);
    if (!player) return false;
    player.deposited = true;
    room.potLamports += room.entryFeeLamports;
    return true;
  }

  // Mark player as deposited for Base on-chain games
  markBaseDeposited(code: string, socketId: string): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.isOnChain) return false;
    const player = room.players.find((p) => p.id === socketId);
    if (!player) return false;
    player.deposited = true;
    // Auto-ready on deposit for quick play rooms
    if (room.isQuickPlay) {
      player.ready = true;
    }
    return true;
  }

  // Check if all players deposited and ready
  allDepositedAndReady(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;
    if (room.isOnChain) return room.players.every((p) => p.ready && p.deposited);
    if (room.entryFeeLamports === 0) return room.players.every((p) => p.ready);
    return room.players.every((p) => p.ready && p.deposited);
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
