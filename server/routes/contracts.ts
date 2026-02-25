/**
 * REST endpoints for contract signature requests.
 * All endpoints require session auth. Cancellation-by-ID is admin-only.
 */

import { Router, type Request, type Response } from 'express';
import { signSettlement, signCancellation, signCancellationByGameId, getSignerAddress, roomCodeToGameId } from '../contracts';
import { getSessionFromCookie, validateSession } from '../auth';
import { appendPendingRefunds, findSettlement } from '../refundStore';
import { db } from '../db';
import type { RoomManager } from '../roomManager';

let _rm: RoomManager | null = null;

export function setRoomManager(rm: RoomManager) {
  _rm = rm;
}

// --- Rate limiting for contract endpoints ---
const contractRateLimits = new Map<string, number[]>();
function contractRateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = contractRateLimits.get(key) ?? [];
  const recent = hits.filter((t) => now - t < windowMs);
  if (recent.length >= maxReqs) return false;
  recent.push(now);
  contractRateLimits.set(key, recent);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of contractRateLimits) {
    const recent = hits.filter((t) => now - t < 60000);
    if (recent.length === 0) contractRateLimits.delete(key);
    else contractRateLimits.set(key, recent);
  }
}, 60000);

/** Require authenticated session. Attaches user to req. */
function requireAuth(req: Request, res: Response): ReturnType<typeof validateSession> {
  const token = getSessionFromCookie(req.headers.cookie);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  const user = validateSession(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired' });
    return null;
  }
  return user;
}

const ADMIN_WALLETS = (process.env.ADMIN_WALLET ?? '').toLowerCase().split(',').filter(Boolean);

const router = Router();

router.post('/settlement-signature', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`settlement:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { roomCode, winnerAddress } = req.body ?? {};

  if (!roomCode || !winnerAddress) {
    res.status(400).json({ error: 'roomCode and winnerAddress required' });
    return;
  }

  // Verify caller is the winner
  if (user.wallet_address.toLowerCase() !== winnerAddress.toLowerCase()) {
    res.status(403).json({ error: 'You can only request settlement for your own address' });
    return;
  }

  if (_rm) {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.phase !== 'finished' && room.gameState?.phase !== 'game-over') {
      res.status(400).json({ error: 'Game is not finished' });
      return;
    }
    if (room.gameState?.phase === 'game-over' && room.phase !== 'finished') {
      room.phase = 'finished';
    }
    if (room.gameState?.winner !== null && room.gameState?.winner !== undefined) {
      const winnerPlayer = room.players[room.gameState.winner];
      if (winnerPlayer?.walletAddress?.toLowerCase() !== winnerAddress.toLowerCase()) {
        res.status(403).json({ error: 'You are not the winner' });
        return;
      }
    }
  }

  const gameId = roomCodeToGameId(roomCode);

  // Check for an existing persisted settlement (idempotent)
  const existing = findSettlement(roomCode, winnerAddress);
  if (existing) {
    res.json({ nonce: existing.nonce, signature: existing.signature, gameId });
    return;
  }

  const result = await signSettlement(roomCode, winnerAddress);
  if (!result) {
    res.status(503).json({ error: 'Signing not available -- signer key not configured' });
    return;
  }

  // Persist for future idempotent retrieval
  await appendPendingRefunds([{
    walletAddress: winnerAddress,
    roomCode,
    gameId,
    nonce: result.nonce,
    signature: result.signature,
    timestamp: Date.now(),
    reason: 'unclaimed_settlement',
    type: 'settlement',
  }]);

  res.json({ nonce: result.nonce, signature: result.signature, gameId });
});

router.post('/cancellation-signature', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`cancel:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { roomCode } = req.body ?? {};

  if (!roomCode) {
    res.status(400).json({ error: 'roomCode required' });
    return;
  }

  // Verify caller is a player in this game and game is cancellable
  if (_rm) {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Verify caller is a player in the room
    const isPlayer = room.players.some(
      (p) => p.walletAddress?.toLowerCase() === user.wallet_address.toLowerCase()
    );
    if (!isPlayer) {
      res.status(403).json({ error: 'You are not a player in this game' });
      return;
    }

    // Only allow cancellation in lobby or finished state, NOT during active gameplay
    if (room.phase === 'playing' && room.gameState?.phase !== 'game-over') {
      res.status(400).json({ error: 'Cannot cancel an active game' });
      return;
    }
  }

  const result = await signCancellation(roomCode);
  if (!result) {
    res.status(503).json({ error: 'Signing not available -- signer key not configured' });
    return;
  }

  const gameId = roomCodeToGameId(roomCode);
  res.json({ nonce: result.nonce, signature: result.signature, gameId });
});

router.post('/cancellation-signature-by-id', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  // Admin-only endpoint
  if (!ADMIN_WALLETS.includes(user.wallet_address.toLowerCase())) {
    res.status(403).json({ error: 'Forbidden — admin only' });
    return;
  }

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`cancel-id:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { gameId } = req.body ?? {};

  if (!gameId || typeof gameId !== 'string' || !gameId.startsWith('0x') || gameId.length !== 66) {
    res.status(400).json({ error: 'gameId must be a 0x-prefixed bytes32 hex string (66 chars)' });
    return;
  }

  try {
    const result = await signCancellationByGameId(gameId as `0x${string}`);
    if (!result) {
      res.status(503).json({ error: 'Signing not available -- signer key not configured' });
      return;
    }
    res.json({ nonce: result.nonce, signature: result.signature, gameId });
  } catch (err: any) {
    console.error('[contracts] cancellation-signature-by-id error:', err);
    res.status(500).json({ error: err.message || 'Signing failed' });
  }
});

/**
 * Retroactive settlement: for old games where the winner never claimed.
 * Verifies the caller won via game_history DB, then generates + persists a settlement.
 */
router.post('/retroactive-settlement', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`retro-settle:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { gameId } = req.body ?? {};
  if (!gameId || typeof gameId !== 'string' || !gameId.startsWith('0x') || gameId.length !== 66) {
    res.status(400).json({ error: 'gameId must be a 0x-prefixed bytes32 hex string (66 chars)' });
    return;
  }

  const walletAddress = user.wallet_address.toLowerCase();

  // Look up all game_history entries to find which room_code produced this gameId
  const rows = db.prepare(
    `SELECT room_code, winner_wallet FROM game_history WHERE room_code != '' ORDER BY finished_at DESC`
  ).all() as Array<{ room_code: string; winner_wallet: string }>;

  const match = rows.find((r) => roomCodeToGameId(r.room_code) === gameId);
  if (!match) {
    res.status(404).json({ error: 'No recorded game found for this gameId' });
    return;
  }

  if (match.winner_wallet.toLowerCase() !== walletAddress) {
    res.status(403).json({ error: 'You are not the recorded winner of this game' });
    return;
  }

  const roomCode = match.room_code;

  // Check for existing persisted settlement (idempotent)
  const existing = findSettlement(roomCode, walletAddress);
  if (existing) {
    res.json({ nonce: existing.nonce, signature: existing.signature, gameId });
    return;
  }

  // Generate and persist
  try {
    const result = await signSettlement(roomCode, walletAddress as `0x${string}`);
    if (!result) {
      res.status(503).json({ error: 'Signing not available -- signer key not configured' });
      return;
    }

    await appendPendingRefunds([{
      walletAddress,
      roomCode,
      gameId,
      nonce: result.nonce,
      signature: result.signature,
      timestamp: Date.now(),
      reason: 'retroactive_settlement',
      type: 'settlement',
    }]);

    res.json({ nonce: result.nonce, signature: result.signature, gameId });
  } catch (err: any) {
    console.error('[contracts] retroactive-settlement error:', err);
    res.status(500).json({ error: err.message || 'Signing failed' });
  }
});

router.get('/signer', (_req, res) => {
  const address = getSignerAddress();
  if (!address) {
    res.json({ address: null, configured: false });
    return;
  }
  res.json({ address, configured: true });
});

export default router;
