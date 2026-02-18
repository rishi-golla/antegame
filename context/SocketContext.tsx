'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { RoomClientState, ChatMessage } from '@/server/types';
import type { GameState } from '@/types/game';
import type { Socket } from 'socket.io-client';

interface SocketContextValue {
  connected: boolean;
  roomState: RoomClientState | null;
  gameState: GameState | null;
  chatMessages: ChatMessage[];
  turnTimer: { remaining: number; total: number } | null;
  createRoom: (name: string, color: string, maxPlayers: number, opts?: { walletAddress?: string; buyInEth?: string; onChainTxHash?: string }) => Promise<{ ok: boolean; code?: string; error?: string }>;
  joinRoom: (code: string, name: string, color: string, opts?: { walletAddress?: string; onChainTxHash?: string }) => Promise<{ ok: boolean; error?: string }>;
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

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('room:state', (state) => {
      setRoomState(state);
    });

    socket.on('game:state', (state) => {
      setGameState(state);
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
      setPendingRefund(data);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:state');
      socket.off('game:state');
      socket.off('chat:message');
      socket.off('chat:history');
      socket.off('turn:timer');
      socket.off('game:cancellation:signature');
      disconnectSocket();
    };
  }, []);

  const createRoom = useCallback(
    (name: string, color: string, maxPlayers: number, opts?: { walletAddress?: string; buyInEth?: string; onChainTxHash?: string }) => {
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
    (code: string, name: string, color: string, opts?: { walletAddress?: string; onChainTxHash?: string }) => {
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
        socket.emit('room:quick-play', { walletAddress, name, color, entryFeeLamports }, (res) => {
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
        rawSocket: getSocket(),
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be inside SocketProvider');
  return ctx;
}
