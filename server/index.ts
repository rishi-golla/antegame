import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './roomManager';
import { applyGameAction, applyJailEscape, isCurrentPlayer } from './gameManager';
import { declareBankruptcy, startMinigame, resolveMinigame, payRentNormally, endTurn } from '@/lib/gameEngine';
import { buildHouse, sellHouse, mortgageProperty, unmortgageProperty } from '@/lib/propertyActions';
import { proposeTrade, acceptTrade, rejectTrade, cancelTrade, counterTrade } from '@/lib/trading';
import authRouter, { sessionMiddleware } from './routes/auth';
import statsRouter from './routes/stats';
import contractsRouter, { setRoomManager } from './routes/contracts';
import { signCancellation, roomCodeToGameId } from './contracts';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatMessage,
  RoomClientState,
} from './types';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const rm = new RoomManager();
  setRoomManager(rm);

nextApp.prepare().then(() => {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/contracts', contractsRouter);
  const httpServer = createServer(app);

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  // Cleanup stale rooms every 5 minutes
  setInterval(() => rm.cleanup(), 5 * 60 * 1000);

  // === TURN TIMER SYSTEM ===
  const TURN_TIME_MS = 45_000;
  const MINIGAME_TIME_MS = 90_000;
  const turnTimers = new Map<string, { timeout: NodeJS.Timeout; interval: NodeJS.Timeout; remaining: number }>();

  function clearTurnTimer(code: string) {
    const timer = turnTimers.get(code);
    if (timer) {
      clearTimeout(timer.timeout);
      clearInterval(timer.interval);
      turnTimers.delete(code);
    }
  }

  function startTurnTimer(code: string) {
    clearTurnTimer(code);
    const room = rm.getRoom(code);
    if (!room?.gameState || room.gameState.phase === 'game-over') return;

    const inMinigame = room.gameState.activeMinigame !== null;
    const timeMs = inMinigame ? MINIGAME_TIME_MS : TURN_TIME_MS;
    let remaining = timeMs;

    // Tick every second
    const interval = setInterval(() => {
      remaining -= 1000;
      io.to(code).emit('turn:timer', { remaining: Math.max(0, remaining), total: timeMs });
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    // Auto-bankrupt at 0
    const timeout = setTimeout(() => {
      clearInterval(interval);
      turnTimers.delete(code);
      const r = rm.getRoom(code);
      if (!r?.gameState || r.gameState.phase === 'game-over') return;
      const currentIdx = r.gameState.currentPlayerIndex;
      const player = r.gameState.players[currentIdx];
      if (player.bankrupt) return;
      console.log(`[turn-timer] ${player.name} timed out — auto-bankrupt`);
      r.gameState = declareBankruptcy(r.gameState, currentIdx);
      // If game isn't over, advance turn
      if (r.gameState.phase !== 'game-over') {
        r.gameState = endTurn(r.gameState);
      }
      if (r.gameState.phase === 'game-over') {
        r.phase = 'finished';
        broadcastRoomState(code);
      }
      broadcastGameState(code);
      // Start timer for next player
      if (r.gameState.phase !== 'game-over') {
        startTurnTimer(code);
      }
    }, timeMs);

    turnTimers.set(code, { timeout, interval, remaining });

    // Send initial tick
    io.to(code).emit('turn:timer', { remaining: timeMs, total: timeMs });
  }
  // === END TURN TIMER ===

  function broadcastRoomState(code: string) {
    const room = rm.getRoom(code);
    if (!room) return;

    for (const player of room.players) {
      const socket = io.sockets.sockets.get(player.id);
      if (!socket) continue;

      const clientState: RoomClientState = {
        code: room.code,
        phase: room.phase,
        maxPlayers: room.maxPlayers,
        hostName: room.players.find((p) => p.id === room.hostId)?.name ?? '',
        entryFeeLamports: room.entryFeeLamports,
        potLamports: room.potLamports,
        isQuickPlay: room.isQuickPlay,
        buyInEth: room.buyInEth,
        isOnChain: room.isOnChain,
        players: room.players.map((p) => ({
          name: p.name,
          color: p.color,
          ready: p.ready,
          connected: p.connected,
          isHost: p.id === room.hostId,
          isYou: p.id === player.id,
          deposited: p.deposited,
        })),
      };

      socket.emit('room:state', clientState);
    }
  }

  /**
   * Send game state to only the two players involved in a trade.
   * Everyone else gets state with activeTradeOffer stripped.
   */
  function broadcastGameStateTradePrivate(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState) return;
    const offer = room.gameState.activeTradeOffer;
    const involvedIndices = offer ? [offer.fromPlayer, offer.toPlayer] : [];

    for (const player of room.players) {
      const sock = io.sockets.sockets.get(player.id);
      if (!sock) continue;
      if (involvedIndices.includes(player.playerIndex)) {
        // Trade participants see the full state
        sock.emit('game:state', room.gameState);
      } else {
        // Everyone else sees state without the trade offer
        sock.emit('game:state', { ...room.gameState, activeTradeOffer: null, phase: room.gameState.previousPhase ?? room.gameState.phase });
      }
    }
    // Still manage turn timer
    if (room.gameState.phase === 'game-over') {
      clearTurnTimer(code);
    } else {
      startTurnTimer(code);
    }
  }

  function broadcastGameState(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState) return;
    io.to(code).emit('game:state', room.gameState);
    // Reset turn timer on every state broadcast (new turn or player acted)
    if (room.gameState.phase === 'game-over') {
      clearTurnTimer(code);
    } else {
      startTurnTimer(code);
    }
  }

  function broadcastChat(code: string, message: ChatMessage) {
    rm.addChatMessage(code, message);
    io.to(code).emit('chat:message', message);
  }

  function systemMessage(code: string, text: string) {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderName: 'System',
      senderColor: '#8ca8d6',
      text,
      system: true,
      timestamp: Date.now(),
    };
    broadcastChat(code, msg);
  }

  // Quick Play countdown management
  const quickPlayCountdowns = new Map<string, { timer: NodeJS.Timeout; remaining: number }>();

  const startQuickPlayCountdown = (code: string, seconds: number) => {
    const existing = quickPlayCountdowns.get(code);
    if (existing) clearInterval(existing.timer);

    let remaining = seconds;
    const timer = setInterval(() => {
      const room = rm.getRoom(code);
      if (!room || room.phase !== 'lobby') {
        clearInterval(timer);
        quickPlayCountdowns.delete(code);
        return;
      }

      io.to(code).emit('quickplay:countdown' as any, { remaining, total: seconds });
      remaining--;

      if (remaining < 0) {
        clearInterval(timer);
        quickPlayCountdowns.delete(code);
        if (room.players.length >= 2) {
          // Auto-ready all players for quick play start
          for (const p of room.players) {
            p.ready = true;
          }
          const startResult = rm.startGame(code, room.hostId);
          if (startResult.ok && room.gameState) {
            broadcastGameState(code);
            broadcastRoomState(code);
            systemMessage(code, 'Game starting!');
            startTurnTimer(code);
          }
        }
      }
    }, 1000);

    quickPlayCountdowns.set(code, { timer, remaining });
  };

  const cancelQuickPlayCountdown = (code: string) => {
    const existing = quickPlayCountdowns.get(code);
    if (existing) {
      clearInterval(existing.timer);
      quickPlayCountdowns.delete(code);
      io.to(code).emit('quickplay:countdown-cancel' as any);
    }
  };

  const checkQuickPlayCountdown = (code: string) => {
    const room = rm.getRoom(code);
    if (!room || !room.isQuickPlay) return;

    // Only count deposited players for countdown (on-chain rooms)
    const depositedCount = room.isOnChain
      ? room.players.filter((p: any) => p.deposited).length
      : room.players.length;
    const hasCountdown = quickPlayCountdowns.has(code);

    if (depositedCount >= 6) {
      const existing = quickPlayCountdowns.get(code);
      if (!existing || existing.remaining > 5) {
        startQuickPlayCountdown(code, 5);
      }
    } else if (depositedCount >= 4) {
      if (!hasCountdown) {
        startQuickPlayCountdown(code, 30);
      }
    } else {
      if (hasCountdown) {
        cancelQuickPlayCountdown(code);
      }
    }
  };

  io.on('connection', (socket) => {
    // Room: Create
    socket.on('room:create', (data, cb) => {
      const result = rm.createRoom(socket.id, data.name, data.color, data.maxPlayers, {
        walletAddress: data.walletAddress,
        buyInEth: data.buyInEth,
        onChainTxHash: data.onChainTxHash,
      });
      if (result.ok && result.code) {
        socket.join(result.code);
        broadcastRoomState(result.code);
        systemMessage(result.code, `${data.name} created the room.`);
      }
      cb(result);
    });

    // Room: Join
    socket.on('room:join', (data, cb) => {
      const code = data.code.toUpperCase();
      const result = rm.joinRoom(code, socket.id, data.name, data.color, {
        walletAddress: data.walletAddress,
        onChainTxHash: data.onChainTxHash,
      });
      if (result.ok) {
        socket.join(code);
        // Send chat history to new joiner
        const room = rm.getRoom(code);
        if (room) {
          socket.emit('chat:history', room.chatHistory);
        }
        broadcastRoomState(code);
        systemMessage(code, `${data.name} joined the room.`);
      }
      cb(result);
    });

    // Room: Pre-validate join (check color/capacity before on-chain deposit)
    (socket as any).on('room:validate-join', (data: { code: string; color: string }, cb: (res: { ok: boolean; error?: string }) => void) => {
      const code = data.code.toUpperCase();
      const room = rm.getRoom(code);
      if (!room) { cb({ ok: false, error: 'Room not found' }); return; }
      if (room.phase !== 'lobby') { cb({ ok: false, error: 'Game already started' }); return; }
      if (room.players.length >= room.maxPlayers) { cb({ ok: false, error: 'Room is full' }); return; }
      if (room.players.some((p: any) => p.color === data.color)) { cb({ ok: false, error: 'Color already taken in this room' }); return; }
      cb({ ok: true });
    });

    // Room: Leave
    socket.on('room:leave', async () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      const player = rm.getPlayerInRoom(code, socket.id);
      const result = rm.leaveRoom(socket.id);
      if (result) {
        socket.leave(code);
        if (result.deleted) clearTurnTimer(code);
        if (!result.deleted && player) {
          systemMessage(code, `${player.name} left the room.`);
          broadcastRoomState(code);
          checkQuickPlayCountdown(code);
        }
        if (result.deleted) {
          cancelQuickPlayCountdown(code);
        }
        // Only sign cancellation if the leaving player actually deposited on-chain
        const playerDeposited = player?.deposited === true;
        const anyDeposited = room?.players.some((p: any) => p.deposited) ?? false;
        if (playerDeposited && (result.deleted || (room && room.phase === 'lobby'))) {
          try {
            const cancellation = await signCancellation(code);
            if (cancellation) {
              const gameId = roomCodeToGameId(code);
              // Emit to the leaving player so they can claim refund
              socket.emit('game:cancellation:signature', {
                nonce: cancellation.nonce,
                signature: cancellation.signature,
                gameId,
                roomCode: code,
              });
              // Also emit to remaining deposited players if any
              if (!result.deleted && anyDeposited) {
                io.to(code).emit('game:cancellation:signature', {
                  nonce: cancellation.nonce,
                  signature: cancellation.signature,
                  gameId,
                  roomCode: code,
                });
              }
            }
          } catch (err) {
            console.error('Failed to sign cancellation for room', code, err);
          }
        }
      }
    });

    // Room: Ready
    socket.on('room:ready', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      rm.setReady(code, socket.id);
      broadcastRoomState(code);
    });

    // Room: Start
    socket.on('room:start', (cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return cb({ ok: false, error: 'Not in a room' });
      const result = rm.startGame(code, socket.id);
      if (result.ok) {
        systemMessage(code, 'Game started!');
        broadcastRoomState(code);
        broadcastGameState(code);
      }
      cb(result);
    });

    // Game actions
    const gameActions = [
      'game:roll',
      'game:buy',
      'game:decline',
      'game:end-turn',
      'game:draw-card',
      'game:apply-card',
      'game:resolve-card',
      'game:resolve-debt',
    ] as const;

    for (const event of gameActions) {
      socket.on(event, () => {
        const code = rm.findRoomBySocket(socket.id);
        if (!code) return;
        const room = rm.getRoom(code);
        if (!room) return;

        const action = event.replace('game:', '') as Parameters<typeof applyGameAction>[2];
        const result = applyGameAction(room, socket.id, action);

        if (result.ok) {
          broadcastGameState(code);
          if (room.phase === 'finished') {
            broadcastRoomState(code);
          }
          // Auto-advance turn after 1.5s when turn-end (no doubles)
          if (room.gameState && room.gameState.phase === 'turn-end' && room.gameState.doublesCount === 0) {
            setTimeout(() => {
              const r = rm.getRoom(code);
              if (!r?.gameState || r.gameState.phase !== 'turn-end') return;
              r.gameState = endTurn(r.gameState);
              broadcastGameState(code);
              if (r.gameState.phase === 'game-over') {
                r.phase = 'finished';
                broadcastRoomState(code);
              } else {
                startTurnTimer(code);
              }
            }, 1500);
          }
        } else {
          socket.emit('room:error', result.error ?? 'Action failed');
        }
      });
    }

    // Jail escape
    socket.on('game:jail-escape', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room) return;

      const result = applyJailEscape(room, socket.id, data.method);
      if (result.ok) {
        broadcastGameState(code);
      } else {
        socket.emit('room:error', result.error ?? 'Action failed');
      }
    });

    // Chat
    socket.on('chat:send', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const player = rm.getPlayerInRoom(code, socket.id);
      if (!player) return;

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderName: player.name,
        senderColor: player.color,
        text: data.text.slice(0, 500), // limit message length
        system: false,
        timestamp: Date.now(),
      };
      broadcastChat(code, msg);
    });

    // Reconnect
    socket.on('room:reconnect', (data, cb) => {
      const code = data.code.toUpperCase();
      const room = rm.getRoom(code);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      // Find disconnected player by name
      const disconnected = room.players.find(
        (p) => p.name === data.name && !p.connected
      );
      if (!disconnected) return cb({ ok: false, error: 'No disconnected player with that name' });

      const success = rm.reconnect(code, disconnected.id, socket.id);
      if (!success) return cb({ ok: false, error: 'Reconnection failed' });

      socket.join(code);
      // Send chat history
      socket.emit('chat:history', room.chatHistory);
      systemMessage(code, `${data.name} reconnected.`);
      io.to(code).emit('player:reconnected', { playerIndex: disconnected.playerIndex });
      broadcastRoomState(code);
      if (room.gameState) {
        broadcastGameState(code);
      }
      cb({ ok: true });
    });

    // Game: Declare bankruptcy
    socket.on('game:bankruptcy', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;

      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      try {
        room.gameState = declareBankruptcy(room.gameState, player.playerIndex);
        room.lastActivity = Date.now();
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
        }
        broadcastGameState(code);
        if (room.phase === 'finished') {
          broadcastRoomState(code);
        }
      } catch {
        socket.emit('room:error', 'Cannot declare bankruptcy');
      }
    });

    // Property actions (can be done on your turn)
    const propertyActionHandler = (
      action: 'build-house' | 'sell-house' | 'mortgage' | 'unmortgage',
      data: { tileIndex: number }
    ) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      try {
        const fns = {
          'build-house': () => buildHouse(room.gameState!, player.playerIndex, data.tileIndex),
          'sell-house': () => sellHouse(room.gameState!, player.playerIndex, data.tileIndex),
          'mortgage': () => mortgageProperty(room.gameState!, player.playerIndex, data.tileIndex),
          'unmortgage': () => unmortgageProperty(room.gameState!, player.playerIndex, data.tileIndex),
        };
        room.gameState = fns[action]();
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Action failed');
      }
    };

    socket.on('game:build-house', (data) => propertyActionHandler('build-house', data));
    socket.on('game:sell-house', (data) => propertyActionHandler('sell-house', data));
    socket.on('game:mortgage', (data) => propertyActionHandler('mortgage', data));
    socket.on('game:unmortgage', (data) => propertyActionHandler('unmortgage', data));

    // Trade actions
    socket.on('game:propose-trade', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      try {
        room.gameState = proposeTrade(room.gameState, data.offer);
        room.lastActivity = Date.now();
        broadcastGameStateTradePrivate(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Trade proposal failed');
      }
    });

    (socket as any).on('game:accept-trade', (data: any, cb?: (res: any) => void) => {
      console.log('[server] game:accept-trade received from', socket.id);
      const code = rm.findRoomBySocket(socket.id);
      if (!code) { console.log('[trade] no room found'); cb?.({ ok: false, error: 'No room' }); return; }
      const room = rm.getRoom(code);
      if (!room?.gameState?.activeTradeOffer) { console.log('[trade] no active offer'); cb?.({ ok: false, error: 'No active offer' }); return; }
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) { console.log('[trade] player not found'); cb?.({ ok: false, error: 'Player not found' }); return; }
      if (player.playerIndex !== room.gameState.activeTradeOffer.toPlayer) {
        console.log('[trade:accept] blocked', { you: player.playerIndex, toPlayer: room.gameState.activeTradeOffer.toPlayer });
        cb?.({ ok: false, error: 'Only the trade recipient can accept' });
        socket.emit('room:error', 'Only the trade recipient can accept');
        return;
      }
      try {
        const offer = room.gameState.activeTradeOffer!;
        const fromName = room.gameState.players[offer.fromPlayer].name;
        const toName = room.gameState.players[offer.toPlayer].name;
        room.gameState = acceptTrade(room.gameState);
        room.lastActivity = Date.now();
        broadcastGameState(code);
        // Announce the completed trade to all players
        const parts: string[] = [];
        if (offer.offerMoney > 0 || offer.offerProperties.length > 0) {
          const items: string[] = [];
          if (offer.offerMoney > 0) items.push(`$${offer.offerMoney}`);
          offer.offerProperties.forEach((idx: number) => { items.push(room.gameState!.tiles[idx]?.name ?? `Tile ${idx}`); });
          parts.push(`${fromName} gave ${items.join(', ')}`);
        }
        if (offer.requestMoney > 0 || offer.requestProperties.length > 0) {
          const items: string[] = [];
          if (offer.requestMoney > 0) items.push(`$${offer.requestMoney}`);
          offer.requestProperties.forEach((idx: number) => { items.push(room.gameState!.tiles[idx]?.name ?? `Tile ${idx}`); });
          parts.push(`${toName} gave ${items.join(', ')}`);
        }
        systemMessage(code, `Trade completed! ${parts.join(' | ')}`);
        console.log('[trade:accept] success');
        cb?.({ ok: true });
      } catch (e: any) {
        console.log('[trade:accept] error:', e.message);
        cb?.({ ok: false, error: e.message });
        socket.emit('room:error', e.message ?? 'Accept trade failed');
      }
    });

    (socket as any).on('game:reject-trade', (data: any, cb?: (res: any) => void) => {
      console.log('[server] game:reject-trade received from', socket.id);
      const code = rm.findRoomBySocket(socket.id);
      if (!code) { cb?.({ ok: false, error: 'No room' }); return; }
      const room = rm.getRoom(code);
      if (!room?.gameState?.activeTradeOffer) { cb?.({ ok: false, error: 'No active offer' }); return; }
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) { cb?.({ ok: false, error: 'Player not found' }); return; }
      if (player.playerIndex !== room.gameState.activeTradeOffer.toPlayer) {
        cb?.({ ok: false, error: 'Only the trade recipient can reject' });
        socket.emit('room:error', 'Only the trade recipient can reject');
        return;
      }
      try {
        room.gameState = rejectTrade(room.gameState);
        room.lastActivity = Date.now();
        broadcastGameStateTradePrivate(code);
        cb?.({ ok: true });
      } catch (e: any) {
        cb?.({ ok: false, error: e.message });
        socket.emit('room:error', e.message ?? 'Reject trade failed');
      }
    });

    (socket as any).on('game:cancel-trade', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState?.activeTradeOffer) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      // Only the proposer can cancel
      if (player.playerIndex !== room.gameState.activeTradeOffer.fromPlayer) {
        socket.emit('room:error', 'Only the trade proposer can cancel');
        return;
      }
      room.gameState = cancelTrade(room.gameState);
      room.lastActivity = Date.now();
      broadcastGameStateTradePrivate(code);
    });

    (socket as any).on('game:counter-trade', (data: { offer: any }) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState?.activeTradeOffer) return;
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      // Only the recipient can counter
      if (player.playerIndex !== room.gameState.activeTradeOffer.toPlayer) {
        socket.emit('room:error', 'Only the trade recipient can counter');
        return;
      }
      try {
        room.gameState = counterTrade(room.gameState, data.offer);
        room.lastActivity = Date.now();
        broadcastGameStateTradePrivate(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Counter-offer failed');
      }
    });

    // Minigame actions
    socket.on('game:gamble', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        room.gameState = startMinigame(room.gameState, data.context);
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Gamble failed');
      }
    });

    // Relay minigame actions to spectators
    socket.on('game:minigame-action', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) return;
      // Broadcast to all OTHER players in the room
      socket.to(code).emit('game:minigame-action', data);
    });

    socket.on('game:minigame-result', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        room.gameState = resolveMinigame(room.gameState, data.tier);
        room.lastActivity = Date.now();
        broadcastGameState(code);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          broadcastRoomState(code);
        }
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Minigame result failed');
      }
    });

    socket.on('game:pay-rent', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        room.gameState = payRentNormally(room.gameState);
        room.lastActivity = Date.now();
        broadcastGameState(code);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          broadcastRoomState(code);
        }
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Pay rent failed');
      }
    });

    // Quick Play
    (socket as any).on('room:quick-play-base', (data: { name: string; color: string; buyInEth: string; walletAddress: string }, cb: (res: any) => void) => {
      const existing = rm.findQuickPlayRoomByEth(data.buyInEth);
      if (existing) {
        // Check color conflict
        if (existing.players.some((p: any) => p.color === data.color)) {
          cb({ ok: false, error: 'Color already taken in this lobby. Pick a different character.' });
          return;
        }
        const joinResult = rm.joinRoom(existing.code, socket.id, data.name, data.color, {
          walletAddress: data.walletAddress,
        });
        if (joinResult.ok) {
          socket.join(existing.code);
          const room = rm.getRoom(existing.code);
          if (room) socket.emit('chat:history', room.chatHistory);
          broadcastRoomState(existing.code);
          systemMessage(existing.code, `${data.name} joined the table.`);
          checkQuickPlayCountdown(existing.code);
          cb({ ok: true, code: existing.code, isHost: false });
        } else {
          cb(joinResult);
        }
      } else {
        const result = rm.createQuickPlayRoomBase(socket.id, data.name, data.color, data.buyInEth, data.walletAddress);
        if (result.ok && result.code) {
          socket.join(result.code);
          broadcastRoomState(result.code);
          systemMessage(result.code, `${data.name} created a table. Waiting for players...`);
        }
        cb({ ...result, isHost: true });
      }
    });

    // Quick Play — Solana (legacy)
    socket.on('room:quick-play', (data, cb) => {
      const existing = rm.findQuickPlayRoom(data.entryFeeLamports);
      if (existing) {
        const joinResult = rm.joinRoom(existing.code, socket.id, data.name, data.color);
        if (joinResult.ok) {
          const player = rm.getPlayerInRoom(existing.code, socket.id);
          if (player) player.walletAddress = data.walletAddress;
          socket.join(existing.code);
          const room = rm.getRoom(existing.code);
          if (room) socket.emit('chat:history', room.chatHistory);
          broadcastRoomState(existing.code);
          systemMessage(existing.code, `${data.name} joined the table.`);

          // Auto-start when full (4 players) or schedule 60s timer
          if (existing.players.length >= existing.maxPlayers) {
            // Will start when all deposited+ready
          }
          cb({ ok: true, code: existing.code });
        } else {
          cb(joinResult);
        }
      } else {
        const result = rm.createQuickPlayRoom(socket.id, data.name, data.color, data.entryFeeLamports, data.walletAddress);
        if (result.ok && result.code) {
          socket.join(result.code);
          broadcastRoomState(result.code);
          systemMessage(result.code, `${data.name} created a quick-play table.`);
        }
        cb(result);
      }
    });

    // Deposit
    socket.on('room:deposit', (data, cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return cb({ ok: false, error: 'Not in a room' });
      // In production, verify the tx signature on-chain here
      const success = rm.markDeposited(code, socket.id);
      if (!success) return cb({ ok: false, error: 'Deposit tracking failed' });
      const player = rm.getPlayerInRoom(code, socket.id);
      if (player) {
        io.to(code).emit('player:deposited', { playerIndex: player.playerIndex });
        systemMessage(code, `${player.name} deposited entry fee.`);
      }
      broadcastRoomState(code);
      cb({ ok: true });
    });

    // Base on-chain deposit confirmation
    socket.on('room:base-deposit', (data, cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return cb({ ok: false, error: 'Not in a room' });
      const room = rm.getRoom(code);
      if (!room?.isOnChain) return cb({ ok: false, error: 'Not an on-chain room' });
      // TODO: In production, verify the tx hash on-chain
      const success = rm.markBaseDeposited(code, socket.id);
      if (!success) return cb({ ok: false, error: 'Deposit tracking failed' });
      const player = rm.getPlayerInRoom(code, socket.id);
      if (player) {
        io.to(code).emit('player:deposited', { playerIndex: player.playerIndex });
        systemMessage(code, `${player.name} deposited ${room.buyInEth} ETH on Base.`);
      }
      broadcastRoomState(code);
      // Check if enough deposited players to start countdown
      checkQuickPlayCountdown(code);
      cb({ ok: true });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;

      const room = rm.getRoom(code);
      if (!room) return;

      if (room.phase === 'finished') {
        // Game is over — just mark disconnected, don't remove from room
        // This prevents the winner from losing the room while claiming winnings
        const player = room.players.find((p) => p.id === socket.id);
        if (player) player.connected = false;
      } else if (room.phase === 'playing') {
        // Mark disconnected for reconnection
        const result = rm.markDisconnected(socket.id);
        if (result) {
          systemMessage(code, `${room.players.find((p) => p.id === socket.id)?.name ?? 'A player'} disconnected.`);
          io.to(code).emit('player:disconnected', { playerIndex: result.playerIndex });
          broadcastRoomState(code);

          // Check if ALL players are now disconnected — auto-cancel and prepare refunds
          const allDisconnected = room.players.every((p: any) => !p.connected);
          if (allDisconnected && room.isOnChain) {
            console.log(`[room ${code}] All players disconnected — auto-cancelling for refunds`);
            try {
              const cancellation = await signCancellation(code);
              if (cancellation) {
                const gameId = roomCodeToGameId(code);
                // Store pending refunds so players can claim later
                const pendingRefunds = room.players
                  .filter((p: any) => p.deposited && p.walletAddress)
                  .map((p: any) => ({
                    walletAddress: p.walletAddress,
                    roomCode: code,
                    gameId,
                    nonce: cancellation.nonce,
                    signature: cancellation.signature,
                    timestamp: Date.now(),
                  }));

                // Write to file for persistence
                const fs = await import('fs');
                const refundPath = './pending-refunds.json';
                let existing: any[] = [];
                try { existing = JSON.parse(fs.readFileSync(refundPath, 'utf8')); } catch {}
                existing.push(...pendingRefunds);
                fs.writeFileSync(refundPath, JSON.stringify(existing, null, 2));
                console.log(`[room ${code}] Stored ${pendingRefunds.length} pending refunds`);

                room.phase = 'finished';
                broadcastRoomState(code);
              }
            } catch (err) {
              console.error(`[room ${code}] Failed to auto-cancel:`, err);
            }
          }
        }
      } else {
        // In lobby, just leave
        const player = rm.getPlayerInRoom(code, socket.id);
        const leaveResult = rm.leaveRoom(socket.id);
        if (leaveResult && !leaveResult.deleted && player) {
          systemMessage(code, `${player.name} left the room.`);
          broadcastRoomState(code);
        }
      }
    });
  });

  // Next.js handler
  // API: Check pending refunds for a wallet address
  app.get('/api/refunds/:address', (req, res) => {
    try {
      const fs = require('fs');
      const refundPath = './pending-refunds.json';
      let refunds: any[] = [];
      try { refunds = JSON.parse(fs.readFileSync(refundPath, 'utf8')); } catch {}
      const addr = req.params.address.toLowerCase();
      const matching = refunds.filter((r: any) => r.walletAddress?.toLowerCase() === addr);
      res.json({ refunds: matching });
    } catch {
      res.json({ refunds: [] });
    }
  });

  app.all('{*path}', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
