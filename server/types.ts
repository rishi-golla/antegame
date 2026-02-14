import type { GameState } from '@/types/game';

export interface ServerPlayer {
  id: string; // socket id
  name: string;
  color: string;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  playerIndex: number; // index in GameState.players
}

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface Room {
  code: string;
  hostId: string;
  players: ServerPlayer[];
  phase: RoomPhase;
  maxPlayers: number;
  gameState: GameState | null;
  chatHistory: ChatMessage[];
  createdAt: number;
  lastActivity: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderColor: string;
  text: string;
  system: boolean;
  timestamp: number;
}

// Client -> Server events
export interface ClientToServerEvents {
  'room:create': (data: { name: string; color: string; maxPlayers: number }, cb: (res: { ok: boolean; code?: string; error?: string }) => void) => void;
  'room:join': (data: { code: string; name: string; color: string }, cb: (res: { ok: boolean; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:ready': () => void;
  'room:start': (cb: (res: { ok: boolean; error?: string }) => void) => void;
  'game:roll': () => void;
  'game:buy': () => void;
  'game:decline': () => void;
  'game:end-turn': () => void;
  'game:draw-card': () => void;
  'game:apply-card': () => void;
  'game:resolve-card': () => void;
  'game:jail-escape': (data: { method: 'bail' | 'card' | 'roll' }) => void;
  'room:reconnect': (data: { code: string; name: string }, cb: (res: { ok: boolean; error?: string }) => void) => void;
  'game:bankruptcy': () => void;
  'chat:send': (data: { text: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  'room:state': (room: RoomClientState) => void;
  'room:error': (error: string) => void;
  'game:state': (state: GameState) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (messages: ChatMessage[]) => void;
  'player:disconnected': (data: { playerIndex: number }) => void;
  'player:reconnected': (data: { playerIndex: number }) => void;
}

export interface RoomClientState {
  code: string;
  phase: RoomPhase;
  players: Array<{
    name: string;
    color: string;
    ready: boolean;
    connected: boolean;
    isHost: boolean;
    isYou: boolean;
  }>;
  maxPlayers: number;
  hostName: string;
}
