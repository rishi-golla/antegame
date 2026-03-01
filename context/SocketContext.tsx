'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { getGameSession, saveGameSession, clearGameSession } from '@/lib/gameSession';
import type { RoomClientState, ChatMessage } from '@/server/types';
import type { GameState } from '@/types/game';
import type { Socket } from 'socket.io-client';

interface MinigameServerResult {
  tier: import('@/types/game').MinigameTier;
  secret: any;
  commitHash: string;
}

interface SocketContextValue {
  connected: boolean;
  roomState: RoomClientState | null;
  gameState: GameState | null;
  chatMessages: ChatMessage[];
  turnTimer: { remaining: number; total: number } | null;
  gameStuck: boolean;
  disconnectedPlayers: Set<number>;
  minigameServerResult: MinigameServerResult | null;
  clearMinigameServerResult: () => void;
  reconnecting: boolean;
  reconnectFailed: boolean;
  clearReconnectFailed: () => void;
  createRoom: (name: string, color: string, maxPlayers: number, opts?: { walletAddress?: string; buyInEth?: string; onChainTxHash?: string; characterId?: string; chain?: 'base' | 'solana'; entryFeeLamports?: number }) => Promise<{ ok: boolean; code?: string; error?: string }>;
  joinRoom: (code: string, name: string, color: string, opts?: { walletAddress?: string; onChainTxHash?: string; characterId?: string }) => Promise<{ ok: boolean; error?: string }>;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => Promise<{ ok: boolean; error?: string }>;
  sendChat: (text: string) => void;
  sendGameAction: (action: string, data?: Record<string, unknown>) => void;
  sendPropertyAction: (action: string, tileIndex: number) => void;
  sendTradeAction: (action: string, data?: Record<string, unknown>) => void;
  quickPlay: (entryFeeLamports: number) => Promise<{ ok: boolean; code?: string; error?: string }>;
  sendDeposit: (txSignature: string) => Promise<{ ok: boolean; error?: string }>;
  pendingRefund: { nonce: string; signature: string; gameId: string; roomCode: string } | null;
  clearPendingRefund: () => void;
  rawSocket: any;
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomClientState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [turnTimer, setTurnTimer] = useState<{ remaining: number; total: number } | null>(null);
  const [pendingRefund, setPendingRefund] = useState<{ nonce: string; signature: string; gameId: string; roomCode: string } | null>(null);
  const clearPendingRefund = useCallback(() => setPendingRefund(null), []);
  const [minigameServerResult, setMinigameServerResult] = useState<MinigameServerResult | null>(null);
  const clearMinigameServerResult = useCallback(() => setMinigameServerResult(null), []);
  const [gameStuck, setGameStuck] = useState(false);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<number>>(new Set());
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const clearReconnectFailed = useCallback(() => setReconnectFailed(false), []);
  const lastGameStateAt = useRef<number>(Date.now());
  const reconnectInFlight = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    function attemptReconnect() {
      if (reconnectInFlight.current) return;
      const session = getGameSession();
      if (!session) return;
      if (!socket.connected) return;
      reconnectInFlight.current = true;
      setReconnecting(true);
      socket.emit('room:reconnect', { code: session.roomCode, name: session.playerName }, (res) => {
        reconnectInFlight.current = false;
        setReconnecting(false);
        if (res.ok) {
          setGameStuck(false);
          setReconnectFailed(false);
          lastGameStateAt.current = Date.now();
        } else {
          clearGameSession();
          setReconnectFailed(true);
        }
      });
    }

    socket.on('connect', () => {
      setConnected(true);
      // On initial connect or reconnect, try to rejoin active session
      attemptReconnect();
    });
    socket.on('disconnect', () => setConnected(false));

    // socket.io manager-level reconnect (fires after transport re-establishes)
    socket.io.on('reconnect', () => {
      attemptReconnect();
    });

    socket.on('room:state', (state) => {
      setRoomState(state);
      // Save session when game is active
      if (state.phase === 'playing' && state.code) {
        const me = state.players.find((p: any) => p.isYou);
        if (me) saveGameSession(state.code, me.name);
      }
      // Clear session when game is finished or player is no longer in room
      if (state.phase === 'finished') {
        clearGameSession();
      } else if (state.phase === 'playing') {
        const me = state.players.find((p: any) => p.isYou);
        if (!me) clearGameSession();
      }
    });

    socket.on('game:state', (state) => {
      setGameState(state);
      lastGameStateAt.current = Date.now();
      setGameStuck(false);
      // Game over — clear session so players aren't redirected back
      if (state.phase === 'game-over') {
        clearGameSession();
      }
    });

    socket.on('chat:message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('chat:history', (msgs) => {
      setChatMessages(msgs);
    });

    socket.on('turn:timer' as any, (data: { remaining: number; total: number }) => {
      setTurnTimer(data);
    });

    socket.on('game:cancellation:signature' as any, (data: { nonce: string; signature: string; gameId: string; roomCode: string }) => {
      console.log('[SocketContext] Received game:cancellation:signature', data?.roomCode);
      setPendingRefund(data);
    });

    socket.on('game:minigame-server-result' as any, (data: MinigameServerResult) => {
      setMinigameServerResult(data);
    });

    socket.on('player:disconnected' as any, (data: { playerIndex: number }) => {
      setDisconnectedPlayers((prev) => new Set(prev).add(data.playerIndex));
    });

    socket.on('player:reconnected' as any, (data: { playerIndex: number }) => {
      setDisconnectedPlayers((prev) => {
        const next = new Set(prev);
        next.delete(data.playerIndex);
        return next;
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.io.off('reconnect');
      socket.off('room:state');
      socket.off('game:state');
      socket.off('chat:message');
      socket.off('chat:history');
      socket.off('turn:timer');
      socket.off('game:cancellation:signature' as any);
      socket.off('game:minigame-server-result' as any);
      socket.off('player:disconnected' as any);
      socket.off('player:reconnected' as any);
      disconnectSocket();
    };
  }, []);

  // Watchdog: detect stuck games (no game:state update for 90s while in active game)
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const roomPhaseRef = useRef(roomState?.phase);
  roomPhaseRef.current = roomState?.phase;

  useEffect(() => {
    const STUCK_THRESHOLD_MS = 90_000;
    const CHECK_INTERVAL_MS = 10_000;

    const interval = setInterval(() => {
      if (
        gameStateRef.current &&
        roomPhaseRef.current === 'playing' &&
        gameStateRef.current.phase !== 'game-over' &&
        Date.now() - lastGameStateAt.current > STUCK_THRESHOLD_MS
      ) {
        setGameStuck(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  const createRoom = useCallback(
    (name: string, color: string, maxPlayers: number, opts?: { walletAddress?: string; buyInEth?: string; onChainTxHash?: string; characterId?: string; chain?: 'base' | 'solana'; entryFeeLamports?: number }) => {
      return new Promise<{ ok: boolean; code?: string; error?: string }>((resolve) => {
        const socket = getSocket();
        socket.emit('room:create', { name, color, maxPlayers, ...opts }, (res) => {
          resolve(res);
        });
      });
    },
    []
  );

  const joinRoom = useCallback(
    (code: string, name: string, color: string, opts?: { walletAddress?: string; onChainTxHash?: string; characterId?: string }) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const socket = getSocket();
        socket.emit('room:join', { code, name, color, ...opts }, (res) => {
          resolve(res);
        });
      });
    },
    []
  );

  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    socket.emit('room:leave');
    setRoomState(null);
    setGameState(null);
    setChatMessages([]);
    setDisconnectedPlayers(new Set());
    clearGameSession();
  }, []);

  const toggleReady = useCallback(() => {
    const socket = getSocket();
    socket.emit('room:ready');
  }, []);

  const startGame = useCallback(() => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const socket = getSocket();
      socket.emit('room:start', (res) => {
        resolve(res);
      });
    });
  }, []);

  const sendPropertyAction = useCallback((action: string, tileIndex: number) => {
    const socket = getSocket();
    const eventMap: Record<string, string> = {
      'build-house': 'game:build-house',
      'sell-house': 'game:sell-house',
      'mortgage': 'game:mortgage',
      'unmortgage': 'game:unmortgage',
    };
    const event = eventMap[action];
    if (event) {
      socket.emit(event as any, { tileIndex });
    }
  }, []);

  const sendTradeAction = useCallback((action: string, data?: Record<string, unknown>) => {
    const socket = getSocket();
    console.log('[sendTradeAction]', action, 'connected:', socket.connected, 'id:', socket.id);
    if (action === 'propose' && data?.offer) {
      socket.emit('game:propose-trade', { offer: data.offer as any });
    } else if (action === 'accept') {
      (socket as any).emit('game:accept-trade', {}, (res: any) => {
        console.log('[sendTradeAction] accept callback:', res);
      });
    } else if (action === 'reject') {
      (socket as any).emit('game:reject-trade', {}, (res: any) => {
        console.log('[sendTradeAction] reject callback:', res);
      });
    } else if (action === 'cancel') {
      socket.emit('game:cancel-trade' as any);
    } else if (action === 'counter' && data?.offer) {
      socket.emit('game:counter-trade' as any, { offer: data.offer as any });
    }
  }, []);

  const quickPlay = useCallback(
    (entryFeeLamports: number) => {
      return new Promise<{ ok: boolean; code?: string; error?: string }>((resolve) => {
        const socket = getSocket();
        // Use stored user info - will be set from AuthContext
        const walletAddress = (window as any).__monopolyWallet ?? '';
        const name = (window as any).__monopolyName ?? 'Player';
        const color = (window as any).__monopolyColor ?? '#ff6b6b';
        const characterId = (window as any).__monopolyCharacterId ?? '';
        socket.emit('room:quick-play', { walletAddress, name, color, entryFeeLamports, characterId }, (res) => {
          resolve(res);
        });
      });
    },
    []
  );

  const sendDeposit = useCallback(
    (txSignature: string) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const socket = getSocket();
        socket.emit('room:deposit', { txSignature }, (res) => {
          resolve(res);
        });
      });
    },
    []
  );

  const sendChat = useCallback((text: string) => {
    if (!text.trim()) return;
    const socket = getSocket();
    socket.emit('chat:send', { text: text.trim() });
  }, []);

  const sendGameAction = useCallback((action: string, data?: Record<string, unknown>) => {
    const socket = getSocket() as any;
    if (action === 'jail-escape' && data?.method) {
      socket.emit('game:jail-escape', { method: data.method as 'bail' | 'card' | 'roll' });
      return;
    }
    if (action === 'gamble' && data?.context) {
      socket.emit('game:gamble', { context: data.context });
      return;
    }
    if (action === 'minigame-result' && data?.tier) {
      socket.emit('game:minigame-result', { tier: data.tier });
      return;
    }
    if (action === 'pay-rent') {
      socket.emit('game:pay-rent');
      return;
    }
    const eventMap: Record<string, keyof import('@/server/types').ClientToServerEvents> = {
      'roll': 'game:roll',
      'buy': 'game:buy',
      'decline': 'game:decline',
      'end-turn': 'game:end-turn',
      'draw-card': 'game:draw-card',
      'apply-card': 'game:apply-card',
      'resolve-card': 'game:resolve-card',
      'bankruptcy': 'game:bankruptcy',
      'resolve-debt': 'game:resolve-debt',
    };
    const event = eventMap[action];
    if (event) {
      socket.emit(event);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        connected,
        roomState,
        gameState,
        chatMessages,
        turnTimer,
        gameStuck,
        disconnectedPlayers,
        reconnecting,
        reconnectFailed,
        clearReconnectFailed,
        createRoom,
        joinRoom,
        leaveRoom,
        toggleReady,
        startGame,
        sendChat,
        sendGameAction,
        sendPropertyAction,
        sendTradeAction,
        quickPlay,
        sendDeposit,
        pendingRefund,
        clearPendingRefund,
        minigameServerResult,
        clearMinigameServerResult,
        rawSocket: getSocket(),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

const noop = () => {};
const noopAsync = () => Promise.resolve({ ok: false, error: 'No SocketProvider' });
const FALLBACK: SocketContextValue = {
  connected: false,
  roomState: null,
  gameState: null,
  chatMessages: [],
  turnTimer: null,
  gameStuck: false,
  disconnectedPlayers: new Set(),
  reconnecting: false,
  reconnectFailed: false,
  clearReconnectFailed: noop,
  createRoom: noopAsync as any,
  joinRoom: noopAsync as any,
  leaveRoom: noop,
  toggleReady: noop,
  startGame: noopAsync as any,
  sendChat: noop,
  sendGameAction: noop,
  sendPropertyAction: noop,
  sendTradeAction: noop,
  quickPlay: noopAsync as any,
  sendDeposit: noopAsync as any,
  pendingRefund: null,
  clearPendingRefund: noop,
  minigameServerResult: null,
  clearMinigameServerResult: noop,
  rawSocket: null,
};

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  return ctx ?? FALLBACK;
}
