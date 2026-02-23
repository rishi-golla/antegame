import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { getSessionFromCookie, validateSession } from './auth';
import { RoomManager } from './roomManager';
import { applyGameAction, applyJailEscape, isCurrentPlayer, autoAdvanceTurnEnd } from './gameManager';
import { declareBankruptcy, startMinigame, resolveMinigame, payRentNormally, endTurn, declinePurchase, drawCard, resolveCard, attemptJailEscape, rollDice, resolveLanding } from '@/lib/gameEngine';
import { buildHouse, sellHouse, mortgageProperty, unmortgageProperty } from '@/lib/propertyActions';
import { proposeTrade, acceptTrade, rejectTrade, cancelTrade, counterTrade } from '@/lib/trading';
import authRouter, { sessionMiddleware } from './routes/auth';
import statsRouter from './routes/stats';
import contractsRouter, { setRoomManager } from './routes/contracts';
import { signCancellation, roomCodeToGameId } from './contracts';
import { recordGameResult } from './stats';
import { db } from './db';
import { initMinigame, recordMinigameAction, resolveServerMinigame, cleanupMinigame } from './minigameEngine';
import { roomCreateSchema, roomJoinSchema, chatSendSchema, roomReconnectSchema, gambleSchema, jailEscapeSchema, tileIndexSchema, minigameActionSchema, tradeOfferSchema, validateJoinSchema, quickPlayBaseSchema, quickPlaySchema } from './socketSchemas';
import { verifyDeposit, cleanupVerifiedHashes } from './depositVerifier';
import type { Room } from './types';
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

// Track which rooms already had results recorded (prevent double-recording)
const recordedRooms = new Set<string>();

function tryRecordGameResult(room: Room) {
  if (recordedRooms.has(room.code)) return;
  if (!room.gameState || room.gameState.phase !== 'game-over') return;
  recordedRooms.add(room.code);

  const gs = room.gameState;
  const winnerIdx = gs.winner;
  const winnerPlayer = winnerIdx !== null && winnerIdx !== undefined ? gs.players[winnerIdx] : null;
  const winnerServerPlayer = winnerIdx !== null && winnerIdx !== undefined
    ? room.players.find(p => p.playerIndex === winnerIdx) : null;

  const entryFeeWei = room.buyInEth ? Math.floor(parseFloat(room.buyInEth) * 1e9) : (room.entryFeeLamports || 0);
  const pot = entryFeeWei * room.players.filter(p => p.deposited).length;
  const houseCut = Math.floor(pot * 0.05);
  const winnerPayout = pot - houseCut;

  // Calculate proper placings based on net worth
  const playerRankings = gs.players.map((p, i) => ({
    index: i,
    bankrupt: p.bankrupt,
    netWorth: p.bankrupt ? 0 : p.money + p.properties.reduce((sum, ti) => {
      const t = gs.tiles[ti];
      return sum + ((t.type === 'property' || t.type === 'railroad' || t.type === 'utility') ? t.mortgageValue : 0);
    }, 0),
  })).sort((a, b) => {
    if (a.index === winnerIdx) return -1;
    if (b.index === winnerIdx) return 1;
    if (a.bankrupt && !b.bankrupt) return 1;
    if (!a.bankrupt && b.bankrupt) return -1;
    return b.netWorth - a.netWorth;
  });
  const placingMap = new Map<number, number>();
  playerRankings.forEach((pr, rank) => placingMap.set(pr.index, rank + 1));

  const players = gs.players.map((p, i) => {
    const sp = room.players.find(rp => rp.playerIndex === i);
    return {
      walletAddress: sp?.walletAddress ?? '',
      name: p.name,
      placing: placingMap.get(i) ?? gs.players.length,
    };
  });

  try {
    recordGameResult({
      roomCode: room.code,
      durationMs: Date.now() - room.createdAt,
      playerCount: gs.players.length,
      players,
      winnerWallet: winnerServerPlayer?.walletAddress ?? '',
      winnerName: winnerPlayer?.name ?? 'Unknown',
      entryFeeLamports: entryFeeWei,
      winnerPayoutLamports: winnerPayout,
      houseProfitLamports: houseCut,
    });
    console.log(`[stats] Recorded game result for room ${room.code}`);
  } catch (e) {
    console.error('[stats] Failed to record game result:', e);
  }
}

nextApp.prepare().then(() => {
  const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

  const app = express();

  // M1: Security headers
  app.use(helmet({
    contentSecurityPolicy: dev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
      },
    },
  }));

  // H1/M3: CORS lockdown
  app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }));

  // Skip express.json for Next.js API routes (body must remain unconsumed)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/rpc')) return next();
    express.json()(req, res, next);
  });

  // Health check — Railway uses this for deployment readiness
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({
        ok: true,
        uptime: Math.floor(process.uptime()),
        timestamp: Date.now(),
      });
    } catch (e: any) {
      res.status(503).json({ ok: false, error: e.message });
    }
  });

  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/contracts', contractsRouter);
  const httpServer = createServer(app);

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true },
  });

  // H1: Socket.IO authentication middleware
  io.use((socket, next) => {
    const cookie = socket.handshake.headers.cookie;
    const token = getSessionFromCookie(cookie);
    if (token) {
      const user = validateSession(token);
      if (user) {
        (socket as any).user = user;
        (socket as any).walletAddress = user.wallet_address;
      }
    }
    // Allow unauthenticated connections for now (free play), but tag them
    next();
  });

  // H5: Socket rate limiting
  const socketEventCounts = new Map<string, { total: number; chat: number; resetAt: number }>();

  function checkSocketRateLimit(socketId: string, event: string): boolean {
    const now = Date.now();
    let entry = socketEventCounts.get(socketId);
    if (!entry || now > entry.resetAt) {
      entry = { total: 0, chat: 0, resetAt: now + 1000 };
      socketEventCounts.set(socketId, entry);
    }
    entry.total++;
    if (event === 'chat:send') entry.chat++;
    if (entry.total > 10) return false; // H5: 10 events/sec
    if (entry.chat > 2) return false;   // H5: 2 chat/sec
    return true;
  }

  // H6: Room join rate limiting
  const joinAttempts = new Map<string, number[]>();
  function checkJoinRateLimit(socketId: string): boolean {
    const now = Date.now();
    const attempts = (joinAttempts.get(socketId) ?? []).filter(t => now - t < 60000);
    if (attempts.length >= 5) return false;
    attempts.push(now);
    joinAttempts.set(socketId, attempts);
    return true;
  }

  // Cleanup rate limit maps
  setInterval(() => {
    socketEventCounts.clear();
    const now = Date.now();
    for (const [k, v] of joinAttempts) {
      const recent = v.filter(t => now - t < 60000);
      if (recent.length === 0) joinAttempts.delete(k);
      else joinAttempts.set(k, recent);
    }
  }, 30000);

  // === DISCONNECT TIMEOUT ===
  // Auto-bankrupt players who don't reconnect within 2 minutes
  const DISCONNECT_TIMEOUT_MS = 2 * 60 * 1000;
  const disconnectTimers = new Map<string, NodeJS.Timeout>(); // key: `${roomCode}:${socketId}`

  function startDisconnectTimer(code: string, socketId: string) {
    const key = `${code}:${socketId}`;
    clearDisconnectTimer(key);

    const timer = setTimeout(() => {
      disconnectTimers.delete(key);
      const room = rm.getRoom(code);
      if (!room?.gameState || room.gameState.phase === 'game-over') return;

      const player = room.players.find(p => p.id === socketId && !p.connected);
      if (!player) return; // reconnected in time

      console.log(`[disconnect-timeout] ${player.name} didn't reconnect — auto-bankrupting`);
      try {
        room.gameState = declareBankruptcy(room.gameState, player.playerIndex);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          tryRecordGameResult(room);
          broadcastRoomState(code);
        } else if (room.gameState.currentPlayerIndex === player.playerIndex) {
          // If it's still their turn somehow, advance
          room.gameState = endTurn(room.gameState);
        }
        broadcastGameState(code);
        systemMessage(code, `${player.name} was removed for disconnecting.`);
        if (room.gameState.phase !== 'game-over') {
          startTurnTimer(code);
        }
      } catch (e: any) {
        console.error(`[disconnect-timeout] Error bankrupting ${player.name}:`, e.message);
      }
    }, DISCONNECT_TIMEOUT_MS);

    disconnectTimers.set(key, timer);
  }

  function clearDisconnectTimer(key: string) {
    const existing = disconnectTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      disconnectTimers.delete(key);
    }
  }

  // Cleanup stale rooms every 5 minutes
  setInterval(() => {
    const removed = rm.cleanup();
    for (const code of removed) {
      clearTurnTimer(code);
      cancelQuickPlayCountdown(code);
      lastTimerState.delete(code);
      recordedRooms.delete(code);
      // Clean up disconnect timers for removed rooms
      for (const [key] of disconnectTimers) {
        if (key.startsWith(`${code}:`)) clearDisconnectTimer(key);
      }
    }
    cleanupVerifiedHashes();
  }, 5 * 60 * 1000);

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

    // Auto-advance at 0: force the player through their current phase
    const timeout = setTimeout(() => {
      clearInterval(interval);
      turnTimers.delete(code);
      const r = rm.getRoom(code);
      if (!r?.gameState || r.gameState.phase === 'game-over') return;
      const currentIdx = r.gameState.currentPlayerIndex;
      const player = r.gameState.players[currentIdx];
      if (player.bankrupt) return;

      const phase = r.gameState.phase;
      console.log(`[turn-timer] ${player.name} timed out in phase "${phase}" — auto-advancing`);

      try {
        switch (phase) {
          case 'rolling':
            // Auto-roll for them
            r.gameState = rollDice(r.gameState);
            break;
          case 'landed':
          case 'buying':
            // Decline purchase (or skip if not a buyable tile), end turn
            try {
              r.gameState = declinePurchase(r.gameState);
            } catch { /* not buyable, just end turn */ }
            if (r.gameState.phase !== 'turn-end' && r.gameState.phase !== 'game-over') {
              r.gameState = { ...r.gameState, phase: 'turn-end' as any };
            }
            r.gameState = autoAdvanceTurnEnd(r.gameState);
            break;
          case 'paying-rent':
            // Force pay rent
            r.gameState = autoAdvanceTurnEnd(payRentNormally(r.gameState));
            break;
          case 'drawing-card':
          case 'applying-card': {
            // Draw + apply card, then end turn
            if (!r.gameState.drawnCard) {
              r.gameState = drawCard(r.gameState);
            }
            r.gameState = resolveCard(r.gameState);
            r.gameState = autoAdvanceTurnEnd(r.gameState);
            break;
          }
          case 'in-jail':
            // Auto-attempt roll to escape
            r.gameState = attemptJailEscape(r.gameState, 'roll');
            r.gameState = autoAdvanceTurnEnd(r.gameState);
            break;
          case 'in-debt':
            // Can't resolve debt in time — bankrupt
            r.gameState = declareBankruptcy(r.gameState, currentIdx);
            if (r.gameState.phase !== 'game-over') {
              r.gameState = endTurn(r.gameState);
            }
            break;
          case 'turn-end':
            // Just end the turn
            r.gameState = endTurn(r.gameState);
            break;
          case 'minigame':
            // Timeout in minigame = catastrophic loss (server-authoritative)
            cleanupMinigame(code);
            r.gameState = autoAdvanceTurnEnd(resolveMinigame(r.gameState, 'catastrophic'));
            break;
          case 'trading':
            // Cancel any active trade and return to previous phase
            if (r.gameState.activeTradeOffer) {
              r.gameState = cancelTrade(r.gameState);
            }
            break;
          default:
            // Fallback: bankrupt
            console.log(`[turn-timer] Unknown phase "${phase}" — bankrupting`);
            r.gameState = declareBankruptcy(r.gameState, currentIdx);
            if (r.gameState.phase !== 'game-over') {
              r.gameState = endTurn(r.gameState);
            }
            break;
        }
      } catch (e: any) {
        console.error(`[turn-timer] Error auto-advancing phase "${phase}":`, e.message);
        // Fallback: bankrupt on error
        r.gameState = declareBankruptcy(r.gameState, currentIdx);
        if (r.gameState.phase !== 'game-over') {
          r.gameState = endTurn(r.gameState);
        }
      }

      if (r.gameState.phase === 'game-over') {
        r.phase = 'finished';
        tryRecordGameResult(r);
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
    // Timer managed by broadcastGameState's phase-change detection
    if (room.gameState.phase === 'game-over') {
      clearTurnTimer(code);
      lastTimerState.delete(code);
    } else {
      const key = `${room.gameState.currentPlayerIndex}:${room.gameState.phase}`;
      if (lastTimerState.get(code) !== key) {
        lastTimerState.set(code, key);
        startTurnTimer(code);
      }
    }
  }

  // Track last known player+phase per room to know when to restart timer
  const lastTimerState = new Map<string, string>();

  function broadcastGameState(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState) return;
    io.to(code).emit('game:state', room.gameState);
    if (room.gameState.phase === 'game-over') {
      clearTurnTimer(code);
      lastTimerState.delete(code);
    } else {
      // Restart timer when player or phase changes (not on every broadcast)
      const key = `${room.gameState.currentPlayerIndex}:${room.gameState.phase}`;
      if (lastTimerState.get(code) !== key) {
        lastTimerState.set(code, key);
        startTurnTimer(code);
      }
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
    // Wrap event handlers with rate limiting
    const originalOn = socket.on.bind(socket);
    const rateLimitedOn: typeof socket.on = (event: any, handler: any) => {
      return originalOn(event, (...args: any[]) => {
        if (typeof event === 'string' && event !== 'disconnect' && event !== 'disconnecting') {
          if (!checkSocketRateLimit(socket.id, event)) {
            socket.emit('room:error', 'Rate limited — slow down');
            return;
          }
        }
        return handler(...args);
      });
    };
    // Use rate-limited wrapper for game events (keep original for internal use)
    const rateLimitSocket = { ...socket, on: rateLimitedOn } as typeof socket;

    // Room: Create (M5: validated, rate limited)
    socket.on('room:create', (data, cb) => {
      if (!checkJoinRateLimit(socket.id)) {
        return cb({ ok: false, error: 'Too many room creations. Try again later.' });
      }
      const parsed = roomCreateSchema.safeParse(data);
      if (!parsed.success) return cb({ ok: false, error: 'Invalid input' });
      const result = rm.createRoom(socket.id, parsed.data.name, parsed.data.color, parsed.data.maxPlayers, {
        walletAddress: parsed.data.walletAddress,
        buyInEth: parsed.data.buyInEth,
        onChainTxHash: parsed.data.onChainTxHash,
        characterId: parsed.data.characterId,
      });
      if (result.ok && result.code) {
        socket.join(result.code);
        broadcastRoomState(result.code);
        systemMessage(result.code, `${parsed.data.name} created the room.`);
      }
      cb(result);
    });

    // Room: Join (H6: rate limited)
    socket.on('room:join', (data, cb) => {
      if (!checkSocketRateLimit(socket.id, 'room:join')) {
        return cb({ ok: false, error: 'Rate limited' });
      }
      if (!checkJoinRateLimit(socket.id)) {
        return cb({ ok: false, error: 'Too many join attempts. Try again later.' });
      }
      const parsed = roomJoinSchema.safeParse(data);
      if (!parsed.success) return cb({ ok: false, error: 'Invalid input' });
      const code = parsed.data.code.toUpperCase();
      const result = rm.joinRoom(code, socket.id, parsed.data.name, parsed.data.color, {
        walletAddress: parsed.data.walletAddress,
        onChainTxHash: parsed.data.onChainTxHash,
        characterId: parsed.data.characterId,
      });
      if (result.ok) {
        socket.join(code);
        // Send chat history to new joiner
        const room = rm.getRoom(code);
        if (room) {
          socket.emit('chat:history', room.chatHistory);
        }
        broadcastRoomState(code);
        systemMessage(code, `${parsed.data.name} joined the room.`);
      }
      cb(result);
    });

    // Room: Pre-validate join (check color/capacity before on-chain deposit)
    (socket as any).on('room:validate-join', (data: unknown, cb: (res: { ok: boolean; error?: string }) => void) => {
      const parsed = validateJoinSchema.safeParse(data);
      if (!parsed.success) return cb({ ok: false, error: 'Invalid input' });
      const code = parsed.data.code.toUpperCase();
      const room = rm.getRoom(code);
      if (!room) { cb({ ok: false, error: 'Room not found' }); return; }
      if (room.phase !== 'lobby') { cb({ ok: false, error: 'Game already started' }); return; }
      if (room.players.length >= room.maxPlayers) { cb({ ok: false, error: 'Room is full' }); return; }
      if (room.players.some((p: any) => p.color === parsed.data.color)) { cb({ ok: false, error: 'Color already taken in this room' }); return; }
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
      // 'game:end-turn' — removed: server auto-advances turn-end via setTimeout
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
          // Auto-advance turn after 2.5s when turn-end (no doubles)
          if (room.gameState && room.gameState.phase === 'turn-end' && room.gameState.doublesCount === 0) {
            setTimeout(() => {
              const r = rm.getRoom(code);
              if (!r?.gameState || r.gameState.phase !== 'turn-end') return;
              r.gameState = endTurn(r.gameState);
              broadcastGameState(code);
              if (r.gameState.phase === 'game-over') {
                r.phase = 'finished';
                tryRecordGameResult(r);
                broadcastRoomState(code);
              } else {
                startTurnTimer(code);
              }
            }, 2500);
          }
        } else {
          socket.emit('room:error', result.error ?? 'Action failed');
        }
      });
    }

    // Jail escape
    socket.on('game:jail-escape', (data) => {
      const parsed = jailEscapeSchema.safeParse(data);
      if (!parsed.success) { socket.emit('room:error', 'Invalid input'); return; }
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room) return;

      const result = applyJailEscape(room, socket.id, parsed.data.method);
      if (result.ok) {
        broadcastGameState(code);
      } else {
        socket.emit('room:error', result.error ?? 'Action failed');
      }
    });

    // Chat (H3: XSS sanitized, H5: rate limited)
    socket.on('chat:send', (data) => {
      if (!checkSocketRateLimit(socket.id, 'chat:send')) return;
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const player = rm.getPlayerInRoom(code, socket.id);
      if (!player) return;

      // H3: Strip HTML tags to prevent XSS
      const sanitized = String(data.text ?? '').replace(/<[^>]*>/g, '').slice(0, 500);
      if (!sanitized.trim()) return;

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderName: player.name.replace(/<[^>]*>/g, ''),
        senderColor: player.color,
        text: sanitized,
        system: false,
        timestamp: Date.now(),
      };
      broadcastChat(code, msg);
    });

    // Reconnect (M9: validate session + wallet match)
    socket.on('room:reconnect', (data, cb) => {
      const parsed = roomReconnectSchema.safeParse(data);
      if (!parsed.success) return cb({ ok: false, error: 'Invalid input' });
      const code = parsed.data.code.toUpperCase();
      const room = rm.getRoom(code);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      // M9: Require authenticated session for reconnection
      const socketUser = (socket as any).user;

      // Find disconnected player by name
      const disconnected = room.players.find(
        (p) => p.name === parsed.data.name && !p.connected
      );
      if (!disconnected) return cb({ ok: false, error: 'No disconnected player with that name' });

      // M9: Verify the reconnecting wallet matches the original player
      if (disconnected.walletAddress) {
        if (!socketUser || socketUser.wallet_address.toLowerCase() !== disconnected.walletAddress.toLowerCase()) {
          return cb({ ok: false, error: 'Wallet mismatch — cannot reconnect as this player' });
        }
      }

      const success = rm.reconnect(code, disconnected.id, socket.id);
      if (!success) return cb({ ok: false, error: 'Reconnection failed' });

      // Cancel disconnect auto-bankrupt timer
      clearDisconnectTimer(`${code}:${disconnected.id}`);

      socket.join(code);
      // Send chat history
      socket.emit('chat:history', room.chatHistory);
      systemMessage(code, `${parsed.data.name} reconnected.`);
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
        room.gameState = autoAdvanceTurnEnd(declareBankruptcy(room.gameState, player.playerIndex));
        room.lastActivity = Date.now();
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          tryRecordGameResult(room);
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
      const parsed = tileIndexSchema.safeParse(data);
      if (!parsed.success) { socket.emit('room:error', 'Invalid tile index'); return; }
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      // Phase restriction: only allow property actions during appropriate phases
      const allowedPhases = ['rolling', 'buying', 'turn-end', 'in-debt'];
      if (action === 'build-house' || action === 'unmortgage') {
        // Building/unmortgaging only during pre-roll or turn-end, NOT during debt
        if (!['rolling', 'turn-end'].includes(room.gameState.phase)) {
          socket.emit('room:error', `Cannot ${action} during ${room.gameState.phase} phase`);
          return;
        }
      } else {
        // Selling houses / mortgaging allowed during debt too
        if (!allowedPhases.includes(room.gameState.phase)) {
          socket.emit('room:error', `Cannot ${action} during ${room.gameState.phase} phase`);
          return;
        }
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
        room.gameState = autoAdvanceTurnEnd(fns[action]());
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
      const parsed = tradeOfferSchema.safeParse(data);
      if (!parsed.success) { socket.emit('room:error', 'Invalid trade offer'); return; }
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      // Verify the proposer is actually the fromPlayer
      const proposer = room.players.find((p) => p.id === socket.id);
      if (!proposer || proposer.playerIndex !== parsed.data.offer.fromPlayer) {
        socket.emit('room:error', 'You can only propose trades as yourself');
        return;
      }
      try {
        room.gameState = proposeTrade(room.gameState, parsed.data.offer);
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
        room.gameState = autoAdvanceTurnEnd(acceptTrade(room.gameState));
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
      const counterParsed = tradeOfferSchema.safeParse(data);
      if (!counterParsed.success) { socket.emit('room:error', 'Invalid counter-offer'); return; }
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
      // Enforce counter-offer swaps the from/to correctly (recipient becomes proposer)
      if (counterParsed.data.offer.fromPlayer !== player.playerIndex || counterParsed.data.offer.toPlayer !== room.gameState.activeTradeOffer.fromPlayer) {
        socket.emit('room:error', 'Invalid counter-offer participants');
        return;
      }
      try {
        room.gameState = counterTrade(room.gameState, counterParsed.data.offer);
        room.lastActivity = Date.now();
        broadcastGameStateTradePrivate(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Counter-offer failed');
      }
    });

    // Minigame actions (H2: server-side resolution)
    socket.on('game:gamble', (data) => {
      const parsed = gambleSchema.safeParse(data);
      if (!parsed.success) { socket.emit('room:error', 'Invalid input'); return; }
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      // Validate phase: gamble only valid in buying (for property gamble) or paying-rent
      const validGamblePhases = ['buying', 'paying-rent'];
      if (!validGamblePhases.includes(room.gameState.phase)) {
        socket.emit('room:error', `Cannot gamble during ${room.gameState.phase} phase`);
        return;
      }
      try {
        room.gameState = startMinigame(room.gameState, data.context);
        room.lastActivity = Date.now();

        // H2: Initialize server-side minigame state
        if (room.gameState.activeMinigame) {
          const player = room.players.find(p => p.id === socket.id);
          const mgData = initMinigame(
            room.gameState.activeMinigame.id,
            code,
            player?.playerIndex ?? 0
          );
          // Send commitment hash and init data to all players
          io.to(code).emit('game:minigame-init' as any, {
            minigameId: room.gameState.activeMinigame.id,
            commitHash: mgData.commitHash,
            initData: mgData.initData,
          });
        }

        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Gamble failed');
      }
    });

    // H2: Server-side minigame action processing
    socket.on('game:minigame-action', (data) => {
      const parsed = minigameActionSchema.safeParse(data);
      if (!parsed.success) { socket.emit('room:error', 'Invalid minigame action'); return; }
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) return;
      if (room.gameState.phase !== 'minigame') return;

      // Record action server-side and get any reveals
      const result = recordMinigameAction(code, parsed.data);

      // Broadcast action to spectators (visual sync)
      socket.to(code).emit('game:minigame-action', data);

      // Send any server reveals back to all players
      if (result.reveal) {
        io.to(code).emit('game:minigame-reveal' as any, result.reveal);
      }
    });

    // H2: Client requests minigame resolution — server determines tier
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
        // H2: Resolve server-side — ignore client-sent tier
        const serverResult = resolveServerMinigame(code);
        const tier = serverResult?.tier ?? 'loss'; // fallback if no server state

        room.gameState = autoAdvanceTurnEnd(resolveMinigame(room.gameState, tier));
        room.lastActivity = Date.now();

        // Send the server-determined result + secret for verification
        io.to(code).emit('game:minigame-server-result' as any, {
          tier,
          secret: serverResult?.secret,
          commitHash: serverResult?.commitHash,
        });

        cleanupMinigame(code);
        broadcastGameState(code);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          tryRecordGameResult(room);
          broadcastRoomState(code);
          clearTurnTimer(code);
        } else {
          startTurnTimer(code);
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
        room.gameState = autoAdvanceTurnEnd(payRentNormally(room.gameState));
        room.lastActivity = Date.now();
        broadcastGameState(code);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          tryRecordGameResult(room);
          broadcastRoomState(code);
        }
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Pay rent failed');
      }
    });

    // Quick Play
    (socket as any).on('room:quick-play-base', (data: { name: string; color: string; buyInEth: string; walletAddress: string }, cb: (res: any) => void) => {
      const qpParsed = quickPlayBaseSchema.safeParse(data);
      if (!qpParsed.success) { cb({ ok: false, error: 'Invalid input' }); return; }
      const existing = rm.findQuickPlayRoomByEth(qpParsed.data.buyInEth);
      if (existing) {
        // Check color conflict
        if (existing.players.some((p: any) => p.color === qpParsed.data.color)) {
          cb({ ok: false, error: 'Color already taken in this lobby. Pick a different character.' });
          return;
        }
        const joinResult = rm.joinRoom(existing.code, socket.id, qpParsed.data.name, qpParsed.data.color, {
          walletAddress: qpParsed.data.walletAddress,
        });
        if (joinResult.ok) {
          socket.join(existing.code);
          const room = rm.getRoom(existing.code);
          if (room) socket.emit('chat:history', room.chatHistory);
          broadcastRoomState(existing.code);
          systemMessage(existing.code, `${qpParsed.data.name} joined the table.`);
          checkQuickPlayCountdown(existing.code);
          cb({ ok: true, code: existing.code, isHost: false });
        } else {
          cb(joinResult);
        }
      } else {
        const result = rm.createQuickPlayRoomBase(socket.id, qpParsed.data.name, qpParsed.data.color, qpParsed.data.buyInEth, qpParsed.data.walletAddress);
        if (result.ok && result.code) {
          socket.join(result.code);
          broadcastRoomState(result.code);
          systemMessage(result.code, `${qpParsed.data.name} created a table. Waiting for players...`);
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

    // Base on-chain deposit confirmation — with on-chain verification
    socket.on('room:base-deposit', async (data, cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return cb({ ok: false, error: 'Not in a room' });
      const room = rm.getRoom(code);
      if (!room?.isOnChain) return cb({ ok: false, error: 'Not an on-chain room' });
      const player = rm.getPlayerInRoom(code, socket.id);
      if (!player) return cb({ ok: false, error: 'Player not found' });

      const txHash = data?.txHash;
      if (!txHash || typeof txHash !== 'string') {
        return cb({ ok: false, error: 'Transaction hash required' });
      }

      // Verify the deposit on-chain
      const walletAddress = player.walletAddress ?? (socket as any).user?.wallet_address;
      if (!walletAddress) return cb({ ok: false, error: 'Wallet address not found' });

      const verification = await verifyDeposit(txHash, code, walletAddress);
      if (!verification.ok) {
        console.warn(`[deposit] Verification failed for ${player.name}: ${verification.error}`);
        return cb({ ok: false, error: verification.error ?? 'Deposit verification failed' });
      }

      const success = rm.markBaseDeposited(code, socket.id);
      if (!success) return cb({ ok: false, error: 'Deposit tracking failed' });
      io.to(code).emit('player:deposited', { playerIndex: player.playerIndex });
      systemMessage(code, `${player.name} deposited ${room.buyInEth} ETH on Base. ✓ Verified`);
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
          systemMessage(code, `${room.players.find((p) => p.id === socket.id)?.name ?? 'A player'} disconnected. They have 2 minutes to reconnect.`);
          io.to(code).emit('player:disconnected', { playerIndex: result.playerIndex });
          broadcastRoomState(code);

          // Start disconnect timer — auto-bankrupt if they don't reconnect
          startDisconnectTimer(code, socket.id);

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
    // Require authenticated session — only return refunds for your own wallet
    const token = getSessionFromCookie(req.headers.cookie);
    const user = token ? validateSession(token) : null;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const addr = req.params.address.toLowerCase();
    if (user.wallet_address.toLowerCase() !== addr) {
      res.status(403).json({ error: 'Can only check refunds for your own wallet' });
      return;
    }
    try {
      const fs = require('fs');
      const refundPath = './pending-refunds.json';
      let refunds: any[] = [];
      try { refunds = JSON.parse(fs.readFileSync(refundPath, 'utf8')); } catch {}
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
