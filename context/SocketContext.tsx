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
  createRoom: (name: string, color: string, maxPlayers: number) => Promise<{ ok: boolean; code?: string; error?: string }>;
  joinRoom: (code: string, name: string, color: string) => Promise<{ ok: boolean; error?: string }>;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => Promise<{ ok: boolean; error?: string }>;
  sendChat: (text: string) => void;
  sendGameAction: (action: string, data?: Record<string, unknown>) => void;
  sendPropertyAction: (action: string, tileIndex: number) => void;
  sendTradeAction: (action: string, data?: Record<string, unknown>) => void;
  quickPlay: (entryFeeLamports: number) => Promise<{ ok: boolean; code?: string; error?: string }>;
  sendDeposit: (txSignature: string) => Promise<{ ok: boolean; error?: string }>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomClientState | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:state');
      socket.off('game:state');
      socket.off('chat:message');
      socket.off('chat:history');
      disconnectSocket();
    };
  }, []);

  const createRoom = useCallback(
    (name: string, color: string, maxPlayers: number) => {
      return new Promise<{ ok: boolean; code?: string; error?: string }>((resolve) => {
        const socket = getSocket();
        socket.emit('room:create', { name, color, maxPlayers }, (res) => {
          resolve(res);
        });
      });
    },
    []
  );

  const joinRoom = useCallback(
    (code: string, name: string, color: string) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const socket = getSocket();
        socket.emit('room:join', { code, name, color }, (res) => {
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
    if (action === 'propose' && data?.offer) {
      socket.emit('game:propose-trade', { offer: data.offer as any });
    } else if (action === 'accept') {
      socket.emit('game:accept-trade');
    } else if (action === 'reject') {
      socket.emit('game:reject-trade');
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
    const socket = getSocket();
    if (action === 'jail-escape' && data?.method) {
      socket.emit('game:jail-escape', { method: data.method as 'bail' | 'card' | 'roll' });
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
