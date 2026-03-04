import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { createHmac, randomUUID } from 'crypto';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { getSessionFromCookie, validateSession } from './auth';
import { RoomManager } from './roomManager';
import { applyGameAction, applyJailEscape, isCurrentPlayer, autoAdvanceTurnEnd } from './gameManager';
import { declareBankruptcy, startMinigame, resolveMinigame, payRentNormally, endTurn, declinePurchase, drawCard, applyDrawnCard, resolveCard, attemptJailEscape, rollDice, resolveLanding } from '@/lib/gameEngine';
import { buildHouse, sellHouse, mortgageProperty, unmortgageProperty } from '@/lib/propertyActions';
import { proposeTrade, acceptTrade, rejectTrade, cancelTrade, counterTrade } from '@/lib/trading';
import authRouter, { sessionMiddleware } from './routes/auth';
import statsRouter from './routes/stats';
import contractsRouter, { setRoomManager } from './routes/contracts';
import { signCancellation, signSettlement, roomCodeToGameId } from './contracts';
import { signSolanaSettlement, signSolanaCancellation, roomCodeToSolanaGameIdHex, roomCodeToSolanaGameId } from './solana-contracts';
import { verifySolanaDeposit } from './solana-depositVerifier';
import { appendPendingRefunds, findSettlement, findCancellation, withRoomLock } from './refundStore';
import { recordGameResult } from './stats';
import { db } from './db';
import { initMinigame, recordMinigameAction, resolveServerMinigame, cleanupMinigame, hasActiveMinigame } from './minigameEngine';
import { roomCreateSchema, roomJoinSchema, chatSendSchema, roomReconnectSchema, gambleSchema, jailEscapeSchema, tileIndexSchema, minigameActionSchema, minigameResultSchema, tradeOfferSchema, validateJoinSchema, quickPlayBaseSchema, quickPlaySolanaSchema } from './socketSchemas';
import { ALLOWED_SOL_BUY_INS } from './socketSchemas';
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
// Assigned inside nextApp.prepare() closure
let _persistSettlementForWinner: (code: string) => Promise<void> = async () => {};

async function emitDiscordGameEvent(payload: {
  type: 'game.started' | 'game.ended' | 'game.cancelled';
  roomCode: string;
  winnerName?: string;
  reason?: string;
}) {
  const webhookUrl = process.env.DISCORD_BOT_GAME_WEBHOOK_URL;
  const secret = process.env.GAME_WEBHOOK_SECRET;
  if (!webhookUrl || !secret) return;

  const body = {
    event_id: randomUUID(),
    type: payload.type,
    room_code: payload.roomCode,
    winner_name: payload.winnerName,
    reason: payload.reason,
    timestamp: Date.now(),
  };
  const raw = JSON.stringify(body);
  const sig = createHmac('sha256', secret).update(raw).digest('hex');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ante-signature': `sha256=${sig}`,
      },
      body: raw,
    });
  } catch (err) {
    console.error('[discord-webhook] Failed to emit game event:', err);
  }
}

function tryRecordGameResult(room: Room) {
  if (recordedRooms.has(room.code)) return;
  if (!room.gameState || room.gameState.phase !== 'game-over') return;
  recordedRooms.add(room.code);

  // Fire-and-forget settlement persistence for on-chain games
  _persistSettlementForWinner(room.code).catch((err) =>
    console.error(`[tryRecordGameResult] persistSettlement error for ${room.code}:`, err)
  );

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
      chain: room.chain ?? 'base',
      durationMs: Date.now() - room.createdAt,
      playerCount: gs.players.length,
      players,
      winnerWallet: winnerServerPlayer?.walletAddress ?? '',
      winnerName: winnerPlayer?.name ?? 'Unknown',
      entryFeeLamports: entryFeeWei,
      winnerPayoutLamports: winnerPayout,
      houseProfitLamports: houseCut,
    });
    emitDiscordGameEvent({
      type: 'game.ended',
      roomCode: room.code,
      winnerName: winnerPlayer?.name ?? 'Unknown',
    }).catch((err) => console.error('[discord-webhook] emit game.ended failed:', err));
    console.log(`[stats] Recorded game result for room ${room.code}`);
  } catch (e) {
    console.error('[stats] Failed to record game result:', e);
  }
}

nextApp.prepare().then(() => {
  const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

  const app = express();

  // Trust reverse proxy (Railway) for correct req.ip in rate limiting
  app.set('trust proxy', 1);

  // M1: Security headers
  app.use(helmet({
    contentSecurityPolicy: dev ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: [
          "'self'",
          'wss://*.helius-rpc.com', 'https://*.helius-rpc.com',
          'wss://api.mainnet-beta.solana.com', 'https://api.mainnet-beta.solana.com',
          'https://*.walletconnect.com', 'wss://*.walletconnect.com',
          'https://*.walletconnect.org', 'wss://*.walletconnect.org',
          ...ALLOWED_ORIGINS.map(o => o.replace('https://', 'wss://')),
          ...ALLOWED_ORIGINS,
        ],
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
    if (req.path.startsWith('/api/rpc') || req.path.startsWith('/api/bridge')) return next();
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

  // Track socket IP for free-play reconnection binding
  const playerIpMap = new Map<string, string>();

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
        // Check if sole remaining player can win immediately
        if (room.gameState.phase !== 'game-over') {
          fastTrackIfSoleRemaining(code);
        }
        if (room.gameState.phase !== 'game-over') {
          startTurnTimer(code);
        }
      } catch (e: any) {
        console.error(`[disconnect-timeout] Error bankrupting ${player.name}:`, e.message);
        // Ragequit: force the remaining player to win (NOT refund-both)
        try {
          forceWinForRemaining(code, player.playerIndex);
        } catch (e2: any) {
          console.error(`[disconnect-timeout] forceWin also failed, falling back to cancellation:`, e2.message);
          forceGameCancellation(code, `disconnect-bankruptcy-error: ${e.message}`).catch(err =>
            console.error(`[forceGameCancellation] unhandled error for ${code}:`, err)
          );
        }
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

  // Clear all disconnect timers for a room
  function clearAllDisconnectTimers(code: string) {
    for (const [key] of disconnectTimers) {
      if (key.startsWith(`${code}:`)) clearDisconnectTimer(key);
    }
  }

  // Shared refund store (serialized writes to prevent race conditions)

  /**
   * Persist a settlement signature for the winner of an on-chain game.
   * Called whenever a game reaches game-over so the winner can claim later
   * even if they close the tab before clicking "Claim Winnings".
   */
  async function persistSettlementForWinner(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState || !room.isOnChain) return;
    if (room.gameState.winner === null || room.gameState.winner === undefined) return;

    const winnerIdx = room.gameState.winner;
    const winnerPlayer = room.players.find((p) => p.playerIndex === winnerIdx);
    if (!winnerPlayer?.walletAddress) return;

    const chain = room.chain ?? 'base';

    await withRoomLock(code, async () => {
      // Mutual exclusion: skip if cancellation already issued
      const existingCancel = findCancellation(code, chain);
      if (existingCancel) {
        console.log(`[persistSettlement] Skipping for ${code}: cancellation already exists`);
        return;
      }

      // Deduplicate: skip if already persisted
      const existing = findSettlement(code, winnerPlayer.walletAddress!, chain);
      if (existing) return;

      try {
        if (chain === 'solana') {
          const settlement = signSolanaSettlement(code, winnerPlayer.walletAddress!);
          if (!settlement) return;

          const gameId = roomCodeToSolanaGameIdHex(code);
          await appendPendingRefunds([{
            walletAddress: winnerPlayer.walletAddress,
            roomCode: code,
            gameId,
            nonce: settlement.nonce,
            signature: settlement.signature,
            timestamp: Date.now(),
            reason: 'unclaimed_settlement',
            type: 'settlement',
            chain: 'solana',
          }]);
          console.log(`[persistSettlement:solana] Stored settlement for winner ${winnerPlayer.name} in room ${code}`);
        } else {
          const settlement = await signSettlement(code, winnerPlayer.walletAddress as `0x${string}`);
          if (!settlement) return;

          const gameId = roomCodeToGameId(code);
          await appendPendingRefunds([{
            walletAddress: winnerPlayer.walletAddress,
            roomCode: code,
            gameId,
            nonce: settlement.nonce,
            signature: settlement.signature,
            timestamp: Date.now(),
            reason: 'unclaimed_settlement',
            type: 'settlement',
            chain: 'base',
          }]);
          console.log(`[persistSettlement:base] Stored settlement for winner ${winnerPlayer.name} in room ${code}`);
        }
      } catch (err) {
        console.error(`[persistSettlement] Failed for room ${code}:`, err);
      }
    });
  }
  _persistSettlementForWinner = persistSettlementForWinner;

  /**
   * Nuclear option: force-cancel a game and store refunds.
   * Only called from internal error handlers when the game is genuinely broken.
   * NOT exposed to players.
   */
  async function forceGameCancellation(code: string, reason: string) {
    const room = rm.getRoom(code);
    if (!room) return;
    if (room.phase === 'finished') return; // already done

    console.error(`[forceGameCancellation] room=${code} reason=${reason}`);

    // Clear all timers
    clearTurnTimer(code);
    clearAllDisconnectTimers(code);
    cancelQuickPlayCountdown(code);

    room.phase = 'finished';

    // Sign cancellation for on-chain games so players can claim refunds
    if (room.isOnChain) {
      const chain = room.chain ?? 'base';
      try {
        await withRoomLock(code, async () => {
          // Mutual exclusion: skip if settlement already issued
          const existingSettle = findSettlement(code, '', chain);
          if (existingSettle) {
            console.log(`[forceGameCancellation] Skipping cancellation for ${code}: settlement already exists`);
            return;
          }
          // Skip if cancellation already issued
          const existingCancel = findCancellation(code, chain);
          if (existingCancel) {
            console.log(`[forceGameCancellation] Cancellation already exists for ${code}`);
            io.to(code).emit('game:cancellation:signature', {
              nonce: existingCancel.nonce,
              signature: existingCancel.signature,
              gameId: existingCancel.gameId,
              roomCode: code,
            });
            return;
          }

          let cancellation: { nonce: string; signature: string } | null = null;
          let gameId: string;

          if (chain === 'solana') {
            cancellation = signSolanaCancellation(code);
            gameId = roomCodeToSolanaGameIdHex(code);
          } else {
            cancellation = await signCancellation(code);
            gameId = roomCodeToGameId(code);
          }

          if (cancellation) {
            const pendingRefunds = room.players
              .filter((p: any) => p.deposited && p.walletAddress)
              .map((p: any) => ({
                walletAddress: p.walletAddress,
                roomCode: code,
                gameId,
                nonce: cancellation!.nonce,
                signature: cancellation!.signature,
                timestamp: Date.now(),
                reason,
                chain,
              }));

            await appendPendingRefunds(pendingRefunds);
            console.log(`[forceGameCancellation] Stored ${pendingRefunds.length} pending refunds for room ${code}`);

            io.to(code).emit('game:cancellation:signature', {
              nonce: cancellation.nonce,
              signature: cancellation.signature,
              gameId,
              roomCode: code,
            });
          }
        });
      } catch (err) {
        console.error(`[forceGameCancellation] Failed to sign cancellation for room ${code}:`, err);
      }
    }

    broadcastRoomState(code);
    if (room.gameState) {
      broadcastGameState(code);
    }
    emitDiscordGameEvent({
      type: 'game.cancelled',
      roomCode: code,
      reason,
    }).catch((err) => console.error('[discord-webhook] emit game.cancelled failed:', err));
  }

  /**
   * Force a win for the remaining player when the quitter's bankruptcy throws.
   * Directly sets game-over with the non-quitter as winner and persists
   * the settlement so the winner can claim on-chain. Only falls through to
   * forceGameCancellation (refund-both) if this also fails.
   */
  function forceWinForRemaining(code: string, quitterIndex: number) {
    const room = rm.getRoom(code);
    if (!room?.gameState) throw new Error('No game state');

    // Find a non-bankrupt player who isn't the quitter
    const candidates = room.gameState.players.filter(
      (p) => !p.bankrupt && p.id !== quitterIndex
    );
    if (candidates.length === 0) throw new Error('No remaining player to award win');

    const winner = candidates[0];
    const gs = room.gameState;

    // Manually mark quitter bankrupt + set game-over
    const updatedPlayers = gs.players.map((p, i) =>
      i === quitterIndex ? { ...p, bankrupt: true, money: 0, properties: [], houses: {}, mortgaged: [], getOutOfJailCards: 0 } : p
    );
    room.gameState = {
      ...gs,
      players: updatedPlayers,
      phase: 'game-over' as any,
      winner: winner.id,
      log: [...gs.log, { message: `${gs.players[quitterIndex].name} forfeited. ${winner.name} wins!`, timestamp: Date.now() }],
    };

    room.phase = 'finished';
    tryRecordGameResult(room);
    clearTurnTimer(code);
    clearAllDisconnectTimers(code);
    broadcastGameState(code);
    broadcastRoomState(code);
    systemMessage(code, `${gs.players[quitterIndex].name} forfeited. ${winner.name} wins!`);
  }

  /**
   * Schedule card resolve + turn-end after a short delay.
   * Extracted so both the draw-card auto-resolve and the apply-card action can use it.
   */
  function scheduleCardResolve(code: string) {
    setTimeout(() => {
      const r = rm.getRoom(code);
      if (!r?.gameState || r.gameState.phase !== 'applying-card') return;
      r.gameState = resolveCard(r.gameState);
      broadcastGameState(code);
      if (r.gameState.phase === 'game-over') {
        r.phase = 'finished';
        tryRecordGameResult(r);
        broadcastRoomState(code);
      }
      // turn-end auto-advance handled centrally by broadcastGameState
    }, 500);
  }

  /**
   * After a bankruptcy, check if only 1 non-backrupt player remains
   * and all others are either bankrupt or disconnected. If so, immediately
   * bankrupt disconnected players so the game ends without waiting for timers.
   */
  function fastTrackIfSoleRemaining(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState || room.gameState.phase === 'game-over') return;

    const activePlayers = room.gameState.players.filter((p) => !p.bankrupt);
    if (activePlayers.length !== 1) return;

    // Check that all other non-bankrupt players are disconnected
    const remainingPlayer = activePlayers[0];
    const serverPlayer = room.players.find((p) => p.playerIndex === remainingPlayer.id);
    if (!serverPlayer?.connected) return; // the sole remaining player is also disconnected

    // Immediately bankrupt all disconnected non-bankrupt players
    const disconnectedActive = room.players.filter((p) => {
      const gp = room.gameState!.players[p.playerIndex];
      return !p.connected && gp && !gp.bankrupt;
    });

    for (const dp of disconnectedActive) {
      clearDisconnectTimer(`${code}:${dp.id}`);
      try {
        room.gameState = declareBankruptcy(room.gameState!, dp.playerIndex);
      } catch (err) {
        console.error(`[fastTrack] Failed to bankrupt player ${dp.playerIndex}:`, err);
        forceGameCancellation(code, 'fasttrack-bankruptcy-error').catch(e =>
          console.error(`[forceGameCancellation] unhandled error for ${code}:`, e)
        );
        return;
      }
      if (room.gameState!.phase === 'game-over') break;
    }

    // Game should now be over with the remaining player as winner
    if (room.gameState!.phase === 'game-over') {
      room.phase = 'finished';
      tryRecordGameResult(room);
      clearTurnTimer(code);
      clearAllDisconnectTimers(code);
      broadcastGameState(code);
      broadcastRoomState(code);
      systemMessage(code, `${remainingPlayer.name} wins — all other players disconnected.`);
    }
  }

  // Per-room per-player idle warning counters: Map<roomCode, Map<playerIndex, warningCount>>
  // Players get 3 warnings (auto-action), 4th timeout = forced bankruptcy
  const idleWarnings = new Map<string, Map<number, number>>();

  function getIdleWarnings(code: string, playerIndex: number): number {
    return idleWarnings.get(code)?.get(playerIndex) ?? 0;
  }

  function incrementIdleWarning(code: string, playerIndex: number): number {
    if (!idleWarnings.has(code)) idleWarnings.set(code, new Map());
    const roomWarnings = idleWarnings.get(code)!;
    const current = roomWarnings.get(playerIndex) ?? 0;
    const next = current + 1;
    roomWarnings.set(playerIndex, next);
    return next;
  }

  function resetIdleWarnings(code: string, playerIndex: number) {
    idleWarnings.get(code)?.delete(playerIndex);
  }

  // Cleanup stale rooms every 5 minutes + sweep for stuck games
  const STALE_GAME_MS = 2 * 60 * 60 * 1000; // 2 hours
  setInterval(() => {
    const removed = rm.cleanup();
    for (const code of removed) {
      clearTurnTimer(code);
      cancelQuickPlayCountdown(code);
      lastTimerState.delete(code);
      recordedRooms.delete(code);
      idleWarnings.delete(code);
      clearAllDisconnectTimers(code);
    }
    cleanupVerifiedHashes();

    // Sweep for stuck active games
    const now = Date.now();
    for (const code of rm.getAllRoomCodes()) {
      const room = rm.getRoom(code);
      if (!room || room.phase !== 'playing' || !room.gameState) continue;

      // All players disconnected but auto-cancel wasn't triggered (race condition)
      const allDisconnected = room.players.every((p) => !p.connected);
      if (allDisconnected) {
        console.log(`[stale-sweep] All players disconnected in room ${code} — force cancelling`);
        forceGameCancellation(code, 'stale-sweep-all-disconnected').catch(err =>
          console.error(`[forceGameCancellation] unhandled error for ${code}:`, err)
        );
        continue;
      }

      // No activity for 2+ hours — game is stuck
      if (now - room.lastActivity > STALE_GAME_MS) {
        console.log(`[stale-sweep] Room ${code} inactive for 2+ hours — force cancelling`);
        forceGameCancellation(code, 'stale-sweep-inactive-2h').catch(err =>
          console.error(`[forceGameCancellation] unhandled error for ${code}:`, err)
        );
      }
    }
  }, 5 * 60 * 1000);

  // === TURN-END AUTO-ADVANCE (2.5s) ===
  // Centralized 2.5s auto-advance for turn-end phase.
  // Scheduled from broadcastGameState so every code path is covered.
  const turnEndTimers = new Map<string, NodeJS.Timeout>();

  function clearTurnEndTimer(code: string) {
    const t = turnEndTimers.get(code);
    if (t) { clearTimeout(t); turnEndTimers.delete(code); }
  }

  function scheduleTurnEndAdvance(code: string) {
    clearTurnEndTimer(code);
    turnEndTimers.set(code, setTimeout(() => {
      turnEndTimers.delete(code);
      const r = rm.getRoom(code);
      if (!r?.gameState || r.gameState.phase !== 'turn-end') return;
      r.gameState = endTurn(r.gameState);
      lastTimerState.delete(code);
      broadcastGameState(code);
      if (r.gameState.phase === 'game-over') {
        r.phase = 'finished';
        tryRecordGameResult(r);
        broadcastRoomState(code);
      }
    }, 2500));
  }

  // === TURN TIMER SYSTEM ===
  const TURN_TIME_MS = 45_000;
  const MINIGAME_TIME_MS = 90_000;
  const turnTimers = new Map<string, { timeout: NodeJS.Timeout; interval: NodeJS.Timeout; remaining: number }>();

  function clearTurnTimer(code: string) {
    clearTurnEndTimer(code);
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

      // Non-idle phases: always handle immediately (no warning needed)
      if (phase === 'turn-end') {
        r.gameState = endTurn(r.gameState);
        broadcastGameState(code);
        if (r.gameState.phase === 'game-over') {
          r.phase = 'finished';
          tryRecordGameResult(r);
          broadcastRoomState(code);
        } else {
          startTurnTimer(code);
        }
        return;
      }
      if (phase === 'trading') {
        if (r.gameState.activeTradeOffer) {
          r.gameState = cancelTrade(r.gameState);
        }
        broadcastGameState(code);
        startTurnTimer(code);
        return;
      }

      // Idle timeout: increment warning counter
      const warnings = incrementIdleWarning(code, currentIdx);
      const MAX_WARNINGS = 3;
      console.log(`[turn-timer] ${player.name} timed out in phase "${phase}" — warning ${warnings}/${MAX_WARNINGS}`);

      try {
        if (warnings > MAX_WARNINGS) {
          // 4th timeout: forced bankruptcy
          console.log(`[turn-timer] ${player.name} exceeded ${MAX_WARNINGS} warnings — declaring bankruptcy`);
          const bankruptMsg = `${player.name} was bankrupted for being idle (${MAX_WARNINGS} warnings exceeded).`;
          r.gameState = declareBankruptcy(r.gameState, currentIdx);
          r.gameState = { ...r.gameState, log: [...r.gameState.log, { message: bankruptMsg, playerIndex: currentIdx, timestamp: Date.now() }] };
          systemMessage(code, bankruptMsg);
          resetIdleWarnings(code, currentIdx);
          if (r.gameState.phase !== 'game-over') {
            r.gameState = endTurn(r.gameState);
          }
        } else {
          // Warnings 1-3: auto-play the current phase and warn
          switch (phase) {
            case 'rolling':
              r.gameState = rollDice(r.gameState);
              break;
            case 'buying':
              r.gameState = declinePurchase(r.gameState);
              break;
            case 'paying-rent':
              r.gameState = payRentNormally(r.gameState);
              break;
            case 'drawing-card':
              r.gameState = applyDrawnCard(drawCard(r.gameState));
              break;
            case 'applying-card':
              r.gameState = resolveCard(r.gameState);
              break;
            case 'in-jail':
              r.gameState = attemptJailEscape(r.gameState, 'roll');
              break;
            case 'in-debt':
              r.gameState = declareBankruptcy(r.gameState, currentIdx);
              break;
            case 'minigame': {
              const serverResult = resolveServerMinigame(code);
              const tier = serverResult?.tier ?? 'catastrophic';
              r.gameState = autoAdvanceTurnEnd(resolveMinigame(r.gameState, tier));
              // Reveal secret/salt for fairness verification
              io.to(code).emit('game:minigame-server-result' as any, {
                tier,
                secret: serverResult?.secret,
                salt: serverResult?.salt,
                commitHash: serverResult?.commitHash,
              });
              cleanupMinigame(code);
              break;
            }
            default:
              // Unknown phase: force end turn
              r.gameState = endTurn(r.gameState);
              break;
          }
          // Auto-advance turn-end if the auto-play landed there
          r.gameState = autoAdvanceTurnEnd(r.gameState);

          const warnMsg = warnings === MAX_WARNINGS
            ? `FINAL WARNING: ${player.name} was idle (${warnings}/${MAX_WARNINGS}). Next timeout = forced bankruptcy!`
            : `${player.name} was idle — auto-action taken. Warning ${warnings}/${MAX_WARNINGS}.`;
          systemMessage(code, warnMsg);
          // Also add to game log
          r.gameState = { ...r.gameState, log: [...r.gameState.log, { message: warnMsg, playerIndex: currentIdx, timestamp: Date.now() }] };
        }
      } catch (e: any) {
        console.error(`[turn-timer] Error auto-advancing phase "${phase}":`, e.message);
        // Fallback: bankrupt on error (guard against double-bankruptcy)
        try {
          if (!r.gameState.players[currentIdx].bankrupt) {
            r.gameState = declareBankruptcy(r.gameState, currentIdx);
            if (r.gameState.phase !== 'game-over') {
              r.gameState = endTurn(r.gameState);
            }
          }
        } catch (e2: any) {
          console.error(`[turn-timer] Fallback bankruptcy also failed:`, e2.message);
          // Ragequit: force the remaining player to win (NOT refund-both)
          try {
            forceWinForRemaining(code, currentIdx);
            return; // forceWin handled everything
          } catch (e3: any) {
            console.error(`[turn-timer] forceWin also failed, falling back to cancellation:`, e3.message);
            forceGameCancellation(code, `idle-bankruptcy-error: ${e2.message}`).catch(err =>
              console.error(`[forceGameCancellation] unhandled error for ${code}:`, err)
            );
            return; // skip normal post-processing below
          }
        }
      }

      // Check if sole remaining player can win immediately
      if (r.gameState.phase !== 'game-over') {
        fastTrackIfSoleRemaining(code);
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
        chain: room.chain,
        players: room.players.map((p) => ({
          name: p.name,
          color: p.color,
          characterId: p.characterId,
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
        // Trade participants see the full state (minus decks)
        sock.emit('game:state', sanitizeGameState(room.gameState));
      } else {
        // Everyone else sees state without the trade offer (minus decks)
        sock.emit('game:state', sanitizeGameState({ ...room.gameState, activeTradeOffer: null, phase: room.gameState.previousPhase ?? room.gameState.phase }));
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

  /** Strip secret information from game state before sending to clients */
  function sanitizeGameState(gs: any): any {
    const { chanceDeck, communityChestDeck, chanceDiscard, communityChestDiscard, ...safe } = gs;
    return {
      ...safe,
      chanceDeckSize: chanceDeck?.length ?? 0,
      communityChestDeckSize: communityChestDeck?.length ?? 0,
    };
  }

  function broadcastGameState(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState) return;
    room.lastActivity = Date.now();
    io.to(code).emit('game:state', sanitizeGameState(room.gameState));
    if (room.gameState.phase === 'game-over') {
      clearTurnTimer(code);
      clearTurnEndTimer(code);
      lastTimerState.delete(code);
    } else if (room.gameState.phase === 'turn-end') {
      // Always schedule the 2.5s auto-advance for turn-end (centralized)
      scheduleTurnEndAdvance(code);
    } else {
      clearTurnEndTimer(code);
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
    // Store IP for free-play reconnection binding
    playerIpMap.set(socket.id, socket.handshake.address);

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
      console.log(`[room:create] raw data:`, JSON.stringify({ buyInEth: data?.buyInEth }), `parsed ok:`, parsed.success, parsed.success ? `buyInEth=${parsed.data.buyInEth ?? 'none'}` : parsed.error?.message);
      if (!parsed.success) return cb({ ok: false, error: 'Invalid input' });

      // C3+C4: On-chain rooms require authenticated session; wallet comes from session
      const isOnChain = !!parsed.data.buyInEth;
      const sessionWallet = (socket as any).walletAddress as string | undefined;
      if (isOnChain) {
        if (!sessionWallet) {
          return cb({ ok: false, error: 'Authentication required for on-chain games' });
        }
      }

      const result = rm.createRoom(socket.id, parsed.data.name, parsed.data.color, parsed.data.maxPlayers, {
        walletAddress: isOnChain ? sessionWallet : parsed.data.walletAddress,
        buyInEth: parsed.data.buyInEth,
        onChainTxHash: parsed.data.onChainTxHash,
        characterId: parsed.data.characterId,
        chain: parsed.data.chain,
        entryFeeLamports: parsed.data.entryFeeLamports,
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

      // C3+C4: On-chain rooms require authenticated session; wallet comes from session
      const joinRoom = rm.getRoom(code);
      const sessionWallet = (socket as any).walletAddress as string | undefined;
      if (joinRoom?.isOnChain) {
        if (!sessionWallet) {
          return cb({ ok: false, error: 'Authentication required for on-chain games' });
        }
      }

      const result = rm.joinRoom(code, socket.id, parsed.data.name, parsed.data.color, {
        walletAddress: joinRoom?.isOnChain ? sessionWallet : parsed.data.walletAddress,
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
      if (parsed.data.characterId && room.players.some((p: any) => p.characterId === parsed.data.characterId)) { cb({ ok: false, error: 'Character already taken in this room' }); return; }
      cb({ ok: true });
    });

    // Room: Leave
    socket.on('room:leave', async () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      const player = rm.getPlayerInRoom(code, socket.id);

      // Mid-game leave: trigger bankruptcy instead of removing from player array
      if (room && room.phase === 'playing' && room.gameState && room.gameState.phase !== 'game-over' && player) {
        // Mark disconnected (preserves player in room, clears socket mapping)
        rm.markDisconnected(socket.id);
        socket.leave(code);

        // Immediately bankrupt the leaving player (same as disconnect timer expiry)
        try {
          clearDisconnectTimer(`${code}:${socket.id}`);
          room.gameState = declareBankruptcy(room.gameState, player.playerIndex);
          if (room.gameState.phase === 'game-over') {
            room.phase = 'finished';
            tryRecordGameResult(room);
            clearTurnTimer(code);
            clearAllDisconnectTimers(code);
            broadcastGameState(code);
            broadcastRoomState(code);
            systemMessage(code, `${player.name} left the game. Game over!`);
          } else {
            // If it was their turn, advance
            if (room.gameState.currentPlayerIndex === player.playerIndex) {
              room.gameState = endTurn(room.gameState);
            }
            broadcastGameState(code);
            broadcastRoomState(code);
            systemMessage(code, `${player.name} left the game and went bankrupt.`);
            // Check if sole remaining player can win immediately
            if (room.gameState.phase !== 'game-over') {
              fastTrackIfSoleRemaining(code);
            }
            if (room.gameState.phase === 'game-over') {
              room.phase = 'finished';
              tryRecordGameResult(room);
              clearTurnTimer(code);
              clearAllDisconnectTimers(code);
              broadcastGameState(code);
              broadcastRoomState(code);
            } else {
              startTurnTimer(code);
            }
          }
        } catch (e: any) {
          console.error(`[room:leave] Error bankrupting ${player.name}:`, e.message);
          // Ragequit: force the remaining player to win (NOT refund-both)
          try {
            forceWinForRemaining(code, player.playerIndex);
          } catch (e2: any) {
            console.error(`[room:leave] forceWin also failed, falling back to cancellation:`, e2.message);
            forceGameCancellation(code, `leave-bankruptcy-error: ${e.message}`).catch(err =>
              console.error(`[forceGameCancellation] unhandled error for ${code}:`, err)
            );
          }
        }
        return;
      }

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
        console.log(`[room:leave] ${player?.name} left ${code}: deposited=${playerDeposited}, deleted=${result.deleted}, phase=${room?.phase}, isOnChain=${room?.isOnChain}`);
        if (playerDeposited && (result.deleted || (room && room.phase === 'lobby'))) {
          try {
            const isSolanaRoom = room?.chain === 'solana';
            const chain = isSolanaRoom ? 'solana' : 'base';

            await withRoomLock(code, async () => {
              // Mutual exclusion: skip if settlement already issued
              const existingSettle = findSettlement(code, '', chain);
              if (existingSettle) {
                console.log(`[room:leave] Skipping cancellation for ${code}: settlement already exists`);
                return;
              }
              // Skip if cancellation already issued
              const existingCancelSig = findCancellation(code, chain);
              if (existingCancelSig) {
                console.log(`[room:leave] Cancellation already exists for ${code}`);
                return;
              }

              const cancellation = isSolanaRoom
                ? signSolanaCancellation(code)
                : await signCancellation(code);
              console.log(`[room:leave] sign${isSolanaRoom ? 'Solana' : ''}Cancellation result for ${code}:`, cancellation ? 'OK' : 'NULL (signer not configured)');
              if (cancellation) {
                const gameId = isSolanaRoom ? roomCodeToSolanaGameIdHex(code) : roomCodeToGameId(code);
                // Persist refund for the leaving player
                const refundsToStore: any[] = [];
                if (player?.walletAddress) {
                  refundsToStore.push({
                    walletAddress: player.walletAddress,
                    roomCode: code,
                    gameId,
                    nonce: cancellation.nonce,
                    signature: cancellation.signature,
                    timestamp: Date.now(),
                    reason: 'player_left_lobby',
                    chain,
                  });
                }
                // Also persist for remaining deposited players if room was deleted
                if (result.deleted && room) {
                  for (const p of room.players) {
                    if (p.deposited && p.walletAddress && p.id !== socket.id) {
                      refundsToStore.push({
                        walletAddress: p.walletAddress,
                        roomCode: code,
                        gameId,
                        nonce: cancellation.nonce,
                        signature: cancellation.signature,
                        timestamp: Date.now(),
                        reason: 'room_deleted',
                        chain,
                      });
                    }
                  }
                }
                // Emit to the leaving player so they can claim refund (emit BEFORE persist so client always gets notified)
                console.log(`[room:leave] Emitting game:cancellation:signature to ${socket.id} for ${code}`);
                socket.emit('game:cancellation:signature', {
                  nonce: cancellation.nonce,
                  signature: cancellation.signature,
                  gameId,
                  roomCode: code,
                });
                // Emit to remaining deposited players and close the room --
                // once a cancellation is signed, the room cannot continue
                if (!result.deleted && room) {
                  io.to(code).emit('game:cancellation:signature', {
                    nonce: cancellation.nonce,
                    signature: cancellation.signature,
                    gameId,
                    roomCode: code,
                  });
                  // Persist refunds for remaining deposited players
                  const remainingRefunds = room.players
                    .filter((p: any) => p.deposited && p.walletAddress && p.id !== socket.id)
                    .map((p: any) => ({
                      walletAddress: p.walletAddress,
                      roomCode: code,
                      gameId,
                      nonce: cancellation.nonce,
                      signature: cancellation.signature,
                      timestamp: Date.now(),
                      reason: 'lobby_cancelled',
                      chain,
                    }));
                  if (remainingRefunds.length > 0) {
                    await appendPendingRefunds(remainingRefunds);
                  }
                  // Close the room so remaining players can't ready up
                  room.phase = 'finished';
                  broadcastRoomState(code);
                }
                // Persist refunds
                if (refundsToStore.length > 0) {
                  await appendPendingRefunds(refundsToStore);
                }
              }
            });
          } catch (err) {
            console.error('Failed to sign cancellation for room', code, err);
          }
        } else {
          console.log(`[room:leave] Skipped cancellation for ${code}: playerDeposited=${playerDeposited}, deleted=${result.deleted}, phase=${room?.phase}`);
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
          // Player took a manual action — reset their idle warnings
          if (room.gameState) {
            resetIdleWarnings(code, room.gameState.currentPlayerIndex);
          }
          broadcastGameState(code);
          if (room.phase === 'finished') {
            broadcastRoomState(code);
          }

          // Auto-resolve card: after draw-card, server drives apply → resolve
          // so the client overlay is purely cosmetic and doesn't block the game
          if (room.gameState && room.gameState.phase === 'drawing-card' && room.gameState.drawnCard && action === 'draw-card') {
            setTimeout(() => {
              const r = rm.getRoom(code);
              if (!r?.gameState) return;
              // Apply card if still in drawing-card phase
              if (r.gameState.phase === 'drawing-card' && r.gameState.drawnCard) {
                r.gameState = applyDrawnCard(r.gameState);
                broadcastGameState(code);
              }
              // Schedule resolve (whether we just applied or player already applied)
              scheduleCardResolve(code);
            }, 1800);
          }

          // If the player manually applied the card (sent apply-card action),
          // the auto-resolve timer above may have already aborted.
          // Schedule resolve directly so the game doesn't get stuck.
          if (room.gameState && room.gameState.phase === 'applying-card' && action === 'apply-card') {
            scheduleCardResolve(code);
          }

          // turn-end auto-advance handled centrally by broadcastGameState
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
        if (room.gameState) resetIdleWarnings(code, room.gameState.currentPlayerIndex);
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
      } else {
        // Free-play: bind reconnection to the original socket's IP
        const originalIp = playerIpMap.get(disconnected.id);
        if (originalIp && originalIp !== socket.handshake.address) {
          return cb({ ok: false, error: 'Cannot reconnect from a different address' });
        }
      }

      // Capture old socket ID before reconnect mutates it
      const oldSocketId = disconnected.id;
      const success = rm.reconnect(code, oldSocketId, socket.id);
      if (!success) return cb({ ok: false, error: 'Reconnection failed' });

      // Cancel disconnect auto-bankrupt timer (keyed by OLD socket ID)
      clearDisconnectTimer(`${code}:${oldSocketId}`);

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

      // Only allow bankruptcy when in debt (prevent voluntary bankruptcy abuse)
      if (room.gameState.phase !== 'in-debt') {
        socket.emit('room:error', 'Can only declare bankruptcy when in debt');
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
        resetIdleWarnings(code, room.gameState.currentPlayerIndex);
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
      // H2: Block trades during phases that shouldn't allow them
      const disallowedPhases = ['minigame', 'in-debt', 'game-over', 'drawing-card', 'applying-card', 'paying-rent'];
      if (disallowedPhases.includes(room.gameState.phase)) {
        socket.emit('room:error', 'Cannot trade during this phase');
        return;
      }
      // Verify the proposer is actually the fromPlayer
      const proposer = room.players.find((p) => p.id === socket.id);
      if (!proposer || proposer.playerIndex !== parsed.data.offer.fromPlayer) {
        socket.emit('room:error', 'You can only propose trades as yourself');
        return;
      }
      // Restrict trade proposals to the current player's turn
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'You can only propose trades on your turn');
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
      // Validate context matches current phase
      const expectedContext = room.gameState.phase === 'buying' ? 'buying' : 'rent';
      if (parsed.data.context !== expectedContext) {
        socket.emit('room:error', 'Gamble context does not match current phase');
        return;
      }
      try {
        resetIdleWarnings(code, room.gameState.currentPlayerIndex);
        room.gameState = startMinigame(room.gameState, parsed.data.context);
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
      const parsed = minigameResultSchema.safeParse(data);
      if (!parsed.success) { socket.emit('room:error', 'Invalid input'); return; }
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      // Guard: reject replayed/duplicate resolution requests
      if (!hasActiveMinigame(code)) {
        socket.emit('room:error', 'No active minigame');
        return;
      }
      try {
        resetIdleWarnings(code, room.gameState.currentPlayerIndex);
        // H2: Resolve server-side — ignore client-sent tier
        const serverResult = resolveServerMinigame(code);
        const tier = serverResult?.tier ?? 'loss'; // fallback if no server state

        room.gameState = autoAdvanceTurnEnd(resolveMinigame(room.gameState, tier));
        room.lastActivity = Date.now();

        // Send the server-determined result + secret + salt for verification
        // Client can verify: sha256(salt + JSON.stringify(secret)) === commitHash
        io.to(code).emit('game:minigame-server-result' as any, {
          tier,
          secret: serverResult?.secret,
          salt: serverResult?.salt,
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
      if (room.gameState.phase !== 'paying-rent') {
        socket.emit('room:error', 'Not in paying-rent phase');
        return;
      }
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        resetIdleWarnings(code, room.gameState.currentPlayerIndex);
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
    (socket as any).on('room:quick-play-base', (data: { name: string; color: string; buyInEth: string; walletAddress: string; characterId?: string }, cb: (res: any) => void) => {
      const qpParsed = quickPlayBaseSchema.safeParse(data);
      if (!qpParsed.success) { cb({ ok: false, error: 'Invalid input' }); return; }

      // C3+C4: Quick play is always on-chain — require auth, use session wallet
      const sessionWallet = (socket as any).walletAddress as string | undefined;
      if (!sessionWallet) {
        cb({ ok: false, error: 'Authentication required for on-chain games' });
        return;
      }

      const existing = rm.findQuickPlayRoomByEth(qpParsed.data.buyInEth);
      if (existing) {
        // Check color conflict
        if (existing.players.some((p: any) => p.color === qpParsed.data.color)) {
          cb({ ok: false, error: 'Color already taken in this lobby. Pick a different character.' });
          return;
        }
        const joinResult = rm.joinRoom(existing.code, socket.id, qpParsed.data.name, qpParsed.data.color, {
          walletAddress: sessionWallet,
          characterId: qpParsed.data.characterId,
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
        const result = rm.createQuickPlayRoomBase(socket.id, qpParsed.data.name, qpParsed.data.color, qpParsed.data.buyInEth, sessionWallet, qpParsed.data.characterId);
        if (result.ok && result.code) {
          socket.join(result.code);
          broadcastRoomState(result.code);
          systemMessage(result.code, `${qpParsed.data.name} created a table. Waiting for players...`);
        }
        cb({ ...result, isHost: true });
      }
    });

    // Quick Play -- Solana (on-chain via Anchor program)
    socket.on('room:quick-play', async (data, cb) => {
      const sessionWallet = (socket as any).user?.wallet_address;
      if (!sessionWallet) return cb({ ok: false, error: 'Authentication required. Please log in.' });

      const qpParsed = quickPlaySolanaSchema.safeParse(data);
      if (!qpParsed.success) return cb({ ok: false, error: qpParsed.error.issues[0]?.message ?? 'Invalid data' });

      // Ensure wallet matches session
      if (qpParsed.data.walletAddress !== sessionWallet) {
        return cb({ ok: false, error: 'Wallet address mismatch' });
      }

      const existing = rm.findQuickPlayRoomByLamports(qpParsed.data.entryFeeLamports);
      if (existing) {
        // Prevent same player joining twice
        if (existing.players.some((p) => p.walletAddress === sessionWallet)) {
          return cb({ ok: false, error: 'You are already in this room' });
        }
        const joinResult = rm.joinRoom(existing.code, socket.id, qpParsed.data.name, qpParsed.data.color, {
          walletAddress: sessionWallet,
          characterId: qpParsed.data.characterId,
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
        const result = rm.createQuickPlayRoomSolana(socket.id, qpParsed.data.name, qpParsed.data.color, qpParsed.data.entryFeeLamports, sessionWallet, qpParsed.data.characterId);
        if (result.ok && result.code) {
          socket.join(result.code);
          broadcastRoomState(result.code);
          systemMessage(result.code, `${qpParsed.data.name} created a table. Waiting for players...`);
        }
        cb({ ...result, isHost: true });
      }
    });

    // Deposit -- Solana (on-chain via Anchor program PDA verification)
    socket.on('room:deposit', async (data, cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) { console.log('[room:deposit] Not in a room'); return cb({ ok: false, error: 'Not in a room' }); }
      const room = rm.getRoom(code);
      console.log(`[room:deposit] code=${code} chain=${room?.chain} isOnChain=${room?.isOnChain} entryFeeLamports=${room?.entryFeeLamports}`);
      if (!room || room.chain !== 'solana') return cb({ ok: false, error: 'Not a Solana room' });
      const player = rm.getPlayerInRoom(code, socket.id);
      if (!player) return cb({ ok: false, error: 'Player not found' });

      const txSignature = data?.txSignature;
      if (!txSignature || typeof txSignature !== 'string') {
        return cb({ ok: false, error: 'Transaction signature required' });
      }

      const walletAddress = player.walletAddress ?? (socket as any).user?.wallet_address;
      if (!walletAddress) return cb({ ok: false, error: 'Wallet address not found' });

      const gameId = roomCodeToSolanaGameId(code);
      const verification = await verifySolanaDeposit(txSignature, code, gameId, walletAddress, room.entryFeeLamports);
      if (!verification.ok) {
        console.warn(`[deposit:solana] Verification failed for ${player.name}: ${verification.error}`);
        return cb({ ok: false, error: verification.error ?? 'Deposit verification failed' });
      }

      const success = rm.markSolanaDeposited(code, socket.id);
      if (!success) return cb({ ok: false, error: 'Deposit tracking failed' });
      io.to(code).emit('player:deposited', { playerIndex: player.playerIndex });
      const solAmount = (room.entryFeeLamports / 1e9).toFixed(2);
      systemMessage(code, `${player.name} deposited ${solAmount} SOL. Verified on-chain`);
      broadcastRoomState(code);
      checkQuickPlayCountdown(code);
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

      const verification = await verifyDeposit(txHash, code, walletAddress, room.buyInEth || undefined);
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
            const chain = room.chain ?? 'base';
            console.log(`[room ${code}] All players disconnected — auto-cancelling for refunds`);
            try {
              await withRoomLock(code, async () => {
                // Mutual exclusion: skip if settlement already issued
                const existingSettle = findSettlement(code, '', chain);
                if (existingSettle) {
                  console.log(`[disconnect] Skipping cancellation for ${code}: settlement already exists`);
                  return;
                }
                const existingCancel = findCancellation(code, chain);
                if (existingCancel) {
                  console.log(`[disconnect] Cancellation already exists for ${code}`);
                  return;
                }

                let cancellation: { nonce: string; signature: string } | null = null;
                let gameId: string;

                if (chain === 'solana') {
                  cancellation = signSolanaCancellation(code);
                  gameId = roomCodeToSolanaGameIdHex(code);
                } else {
                  cancellation = await signCancellation(code);
                  gameId = roomCodeToGameId(code);
                }

                if (cancellation) {
                  const pendingRefunds = room.players
                    .filter((p: any) => p.deposited && p.walletAddress)
                    .map((p: any) => ({
                      walletAddress: p.walletAddress,
                      roomCode: code,
                      gameId,
                      nonce: cancellation!.nonce,
                      signature: cancellation!.signature,
                      timestamp: Date.now(),
                      chain,
                    }));

                  await appendPendingRefunds(pendingRefunds);
                  console.log(`[room ${code}] Stored ${pendingRefunds.length} pending refunds`);

                  room.phase = 'finished';
                  clearAllDisconnectTimers(code);
                  clearTurnTimer(code);
                  broadcastRoomState(code);
                }
              });
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
      const { readPendingRefunds } = require('./refundStore');
      const refunds = readPendingRefunds();
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
