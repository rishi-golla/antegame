import type { GameState } from '@/types/game';

export interface ServerPlayer {
  id: string; // socket id
  name: string;
  color: string;
  characterId?: string;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  playerIndex: number; // index in GameState.players
  walletAddress?: string;
  deposited: boolean;
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
  entryFeeLamports: number;
  potLamports: number;
  isQuickPlay: boolean;
  /** Base chain buy-in in ETH string (e.g. "0.001"). Empty means no on-chain game. */
  buyInEth: string;
  /** Whether this room has an on-chain Base game */
  isOnChain: boolean;
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
  'room:create': (data: { name: string; color: string; characterId?: string; maxPlayers: number; walletAddress?: string; buyInEth?: string; onChainTxHash?: string }, cb: (res: { ok: boolean; code?: string; error?: string }) => void) => void;
  'room:join': (data: { code: string; name: string; color: string; characterId?: string; walletAddress?: string; onChainTxHash?: string }, cb: (res: { ok: boolean; error?: string }) => void) => void;
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
  'game:resolve-debt': () => void;
  'game:jail-escape': (data: { method: 'bail' | 'card' | 'roll' }) => void;
  'room:reconnect': (data: { code: string; name: string }, cb: (res: { ok: boolean; error?: string }) => void) => void;
  'game:bankruptcy': () => void;
  'game:build-house': (data: { tileIndex: number }) => void;
  'game:sell-house': (data: { tileIndex: number }) => void;
  'game:mortgage': (data: { tileIndex: number }) => void;
  'game:unmortgage': (data: { tileIndex: number }) => void;
  'game:propose-trade': (data: { offer: import('@/types/game').TradeOffer }) => void;
  'game:accept-trade': () => void;
  'game:reject-trade': () => void;
  'game:gamble': (data: { context: import('@/types/game').MinigameContext }) => void;
  'game:minigame-result': (data: { tier: import('@/types/game').MinigameTier }) => void;
  'game:pay-rent': () => void;
  'game:minigame-action': (data: any) => void;
  'chat:send': (data: { text: string }) => void;
  'room:quick-play': (data: { walletAddress: string; name: string; color: string; entryFeeLamports: number }, cb: (res: { ok: boolean; code?: string; error?: string }) => void) => void;
  'room:deposit': (data: { txSignature: string }, cb: (res: { ok: boolean; error?: string }) => void) => void;
  'room:base-deposit': (data: { txHash: string }, cb: (res: { ok: boolean; error?: string }) => void) => void;
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
  'player:deposited': (data: { playerIndex: number }) => void;
  'game:settlement': (data: { winnerWallet: string; txSignature: string; payoutLamports: number }) => void;
  'game:settlement:signature': (data: { nonce: string; signature: string; gameId: string; roomCode: string }) => void;
  'game:cancellation:signature': (data: { nonce: string; signature: string; gameId: string; roomCode: string }) => void;
  'game:refund': (data: { walletAddress: string; txSignature: string; amountLamports: number }) => void;
  'turn:timer': (data: { remaining: number; total: number }) => void;
  'game:minigame-action': (data: any) => void;
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
    deposited: boolean;
  }>;
  maxPlayers: number;
  hostName: string;
  entryFeeLamports: number;
  potLamports: number;
  isQuickPlay: boolean;
  buyInEth: string;
  isOnChain: boolean;
}
