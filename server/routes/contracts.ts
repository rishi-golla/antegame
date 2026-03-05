/**
 * REST endpoints for contract signature requests.
 * All endpoints require session auth. Cancellation-by-ID is admin-only.
 */

import { Router, type Request, type Response } from 'express';
import { signSettlement, signCancellation, signCancellationByGameId, getSignerAddress, roomCodeToGameId } from '../contracts';
import { signSolanaSettlement, signSolanaCancellation, getSolanaSignerAddress, roomCodeToSolanaGameIdHex } from '../solana-contracts';
import { closeGameOnSolana } from '../solana-closeGame';
import { getSessionFromCookie, validateSession, isAdmin } from '../auth';
import { appendPendingRefunds, readPendingRefunds, findSettlement, findCancellation, withRoomLock } from '../refundStore';
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

  if (!_rm) {
    res.status(503).json({ error: 'Room manager not available' });
    return;
  }

  {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    // Chain guard: this endpoint is for Base/EVM only
    if (room.chain === 'solana') {
      res.status(400).json({ error: 'Use /solana/settlement-signature for Solana games' });
      return;
    }
    if (room.phase !== 'finished' && room.gameState?.phase !== 'game-over') {
      res.status(400).json({ error: 'Game is not finished' });
      return;
    }
    if (room.gameState?.phase === 'game-over' && room.phase !== 'finished') {
      room.phase = 'finished';
    }
    if (room.gameState?.winner === null || room.gameState?.winner === undefined) {
      res.status(400).json({ error: 'No winner determined for this game' });
      return;
    }
    const winnerPlayer = room.players[room.gameState.winner];
    if (winnerPlayer?.walletAddress?.toLowerCase() !== winnerAddress.toLowerCase()) {
      res.status(403).json({ error: 'You are not the winner' });
      return;
    }
    // Mutual exclusion: reject if a cancellation was already issued
    const existingCancel = findCancellation(roomCode, 'base');
    if (existingCancel) {
      res.status(409).json({ error: 'Cancellation already issued for this game' });
      return;
    }
  }

  const gameId = roomCodeToGameId(roomCode);

  await withRoomLock(roomCode, async () => {
    const existing = findSettlement(roomCode, winnerAddress, 'base');
    if (existing) {
      res.json({ nonce: existing.nonce, signature: existing.signature, gameId });
      return;
    }

    // Re-check cancellation inside lock
    const cancelCheck = findCancellation(roomCode, 'base');
    if (cancelCheck) {
      res.status(409).json({ error: 'Cancellation already issued for this game' });
      return;
    }

    const result = await signSettlement(roomCode, winnerAddress);
    if (!result) {
      res.status(503).json({ error: 'Signing not available -- signer key not configured' });
      return;
    }

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
  if (!_rm) {
    res.status(503).json({ error: 'Room manager not available' });
    return;
  }

  {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Chain guard: this endpoint is for Base/EVM only
    if (room.chain === 'solana') {
      res.status(400).json({ error: 'Use /solana/cancellation-signature for Solana games' });
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

    // In lobby phase, only the host can request cancellation
    if (room.phase === 'lobby') {
      const hostPlayer = room.players.find((p) => p.id === room.hostId);
      if (hostPlayer?.walletAddress?.toLowerCase() !== user.wallet_address.toLowerCase()) {
        res.status(403).json({ error: 'Only the host can cancel in lobby' });
        return;
      }
    }

    // Mutual exclusion: reject if a settlement was already issued
    const existingSettle = findSettlement(roomCode, '', 'base');
    if (existingSettle) {
      res.status(409).json({ error: 'Settlement already issued for this game' });
      return;
    }
  }

  const gameId = roomCodeToGameId(roomCode);

  await withRoomLock(roomCode, async () => {
    const existingCancel = findCancellation(roomCode, 'base');
    if (existingCancel) {
      res.json({ nonce: existingCancel.nonce, signature: existingCancel.signature, gameId });
      return;
    }

    // Re-check settlement inside lock
    const settleCheck = findSettlement(roomCode, '', 'base');
    if (settleCheck) {
      res.status(409).json({ error: 'Settlement already issued for this game' });
      return;
    }

    const result = await signCancellation(roomCode);
    if (!result) {
      res.status(503).json({ error: 'Signing not available -- signer key not configured' });
      return;
    }

    await appendPendingRefunds([{
      roomCode,
      gameId,
      nonce: result.nonce,
      signature: result.signature,
      timestamp: Date.now(),
      reason: 'cancellation',
    }]);

    res.json({ nonce: result.nonce, signature: result.signature, gameId });
  });
});

router.post('/cancellation-signature-by-id', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  // Admin-only endpoint
  if (!isAdmin(user.wallet_address)) {
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

  // Check for existing settlement or cancellation by game ID
  const refunds = readPendingRefunds();
  const existingSettle = refunds.find(
    (r: any) => r.type === 'settlement' && r.gameId === gameId
  );
  if (existingSettle) {
    res.status(409).json({ error: 'Settlement already issued for this game' });
    return;
  }
  const existingCancel = refunds.find(
    (r: any) => r.gameId === gameId && r.nonce && r.signature &&
      (r.reason === 'cancellation' || r.reason === 'admin_cancellation')
  );
  if (existingCancel) {
    res.json({ nonce: existingCancel.nonce, signature: existingCancel.signature, gameId });
    return;
  }

  try {
    const result = await signCancellationByGameId(gameId as `0x${string}`);
    if (!result) {
      res.status(503).json({ error: 'Signing not available -- signer key not configured' });
      return;
    }

    // Persist so other code paths can detect this cancellation
    await appendPendingRefunds([{
      gameId,
      nonce: result.nonce,
      signature: result.signature,
      timestamp: Date.now(),
      reason: 'admin_cancellation',
    }]);

    res.json({ nonce: result.nonce, signature: result.signature, gameId });
  } catch (err: any) {
    console.error('[contracts] cancellation-signature-by-id error:', err);
    res.status(500).json({ error: 'Internal signing error' });
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

  // Query by indexed game_id column (O(1) lookup instead of full table scan)
  const match = db.prepare(
    `SELECT room_code, winner_wallet, chain FROM game_history WHERE game_id = ? LIMIT 1`
  ).get(gameId) as { room_code: string; winner_wallet: string; chain?: string } | undefined;
  if (!match) {
    res.status(404).json({ error: 'No recorded game found for this gameId' });
    return;
  }

  if (match.winner_wallet.toLowerCase() !== walletAddress) {
    res.status(403).json({ error: 'You are not the recorded winner of this game' });
    return;
  }

  const roomCode = match.room_code;
  const chain = match.chain ?? 'base';

  await withRoomLock(roomCode, async () => {
    // Check for existing persisted settlement (idempotent)
    const existing = findSettlement(roomCode, walletAddress, chain === 'solana' ? 'solana' : undefined);
    if (existing) {
      res.json({ nonce: existing.nonce, signature: existing.signature, gameId });
      return;
    }

    // Mutual exclusion: reject if cancellation already issued
    const existingCancel = findCancellation(roomCode, chain);
    if (existingCancel) {
      res.status(409).json({ error: 'Cancellation already issued for this game' });
      return;
    }

    try {
      let result: { nonce: string; signature: string } | null;
      if (chain === 'solana') {
        result = signSolanaSettlement(roomCode, walletAddress);
      } else {
        result = await signSettlement(roomCode, walletAddress as `0x${string}`);
      }
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
        chain,
      }]);

      res.json({ nonce: result.nonce, signature: result.signature, gameId });
    } catch (err: any) {
      console.error('[contracts] retroactive-settlement error:', err);
      res.status(500).json({ error: 'Internal signing error' });
    }
  });
});

router.get('/signer', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const address = getSignerAddress();
  if (!address) {
    res.json({ address: null, configured: false });
    return;
  }
  res.json({ address, configured: true });
});

// --- Solana Endpoints ---

router.post('/solana/settlement-signature', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`sol-settlement:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  if (!contractRateLimit(`sol-settlement:user:${user.wallet_address}`, 3, 60000)) {
    res.status(429).json({ error: 'Too many requests for this wallet' });
    return;
  }

  const { roomCode, winnerAddress } = req.body ?? {};
  if (!roomCode || typeof roomCode !== 'string' || roomCode.length < 1 || roomCode.length > 10) {
    res.status(400).json({ error: 'roomCode must be a string (1-10 chars)' });
    return;
  }
  if (!winnerAddress || typeof winnerAddress !== 'string' || winnerAddress.length < 32 || winnerAddress.length > 44) {
    res.status(400).json({ error: 'winnerAddress must be a valid Solana address (32-44 chars)' });
    return;
  }

  // Verify caller is the winner
  if (user.wallet_address !== winnerAddress) {
    res.status(403).json({ error: 'You can only request settlement for your own address' });
    return;
  }

  if (!_rm) {
    res.status(503).json({ error: 'Room manager not available' });
    return;
  }

  {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.chain !== 'solana') {
      res.status(400).json({ error: 'Room is not a Solana game' });
      return;
    }
    if (room.phase !== 'finished' && room.gameState?.phase !== 'game-over') {
      res.status(400).json({ error: 'Game is not finished' });
      return;
    }
    if (room.gameState?.phase === 'game-over' && room.phase !== 'finished') {
      room.phase = 'finished';
    }
    if (room.gameState?.winner === null || room.gameState?.winner === undefined) {
      res.status(400).json({ error: 'No winner determined for this game' });
      return;
    }
    const winnerPlayer = room.players[room.gameState.winner];
    if (winnerPlayer?.walletAddress !== winnerAddress) {
      res.status(403).json({ error: 'You are not the winner' });
      return;
    }
    // Mutual exclusion: reject if a cancellation was already issued
    const existingCancel = findCancellation(roomCode, 'solana');
    if (existingCancel) {
      res.status(409).json({ error: 'Cancellation already issued for this game' });
      return;
    }
  }

  const gameId = roomCodeToSolanaGameIdHex(roomCode);

  await withRoomLock(roomCode, async () => {
    // Idempotent: check for existing settlement
    const existing = findSettlement(roomCode, winnerAddress, 'solana');
    if (existing) {
      res.json({ nonce: existing.nonce, signature: existing.signature, gameId });
      return;
    }

    // Re-check cancellation inside lock
    const cancelCheck = findCancellation(roomCode, 'solana');
    if (cancelCheck) {
      res.status(409).json({ error: 'Cancellation already issued for this game' });
      return;
    }

    const result = signSolanaSettlement(roomCode, winnerAddress);
    if (!result) {
      res.status(503).json({ error: 'Solana signing not available -- signer key not configured' });
      return;
    }

    await appendPendingRefunds([{
      walletAddress: winnerAddress,
      roomCode,
      gameId,
      nonce: result.nonce,
      signature: result.signature,
      timestamp: Date.now(),
      reason: 'unclaimed_settlement',
      type: 'settlement',
      chain: 'solana',
    }]);

    res.json({ nonce: result.nonce, signature: result.signature, gameId });
  });
});

router.post('/solana/cancellation-signature', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`sol-cancel:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  if (!contractRateLimit(`sol-cancel:user:${user.wallet_address}`, 3, 60000)) {
    res.status(429).json({ error: 'Too many requests for this wallet' });
    return;
  }

  const { roomCode } = req.body ?? {};
  if (!roomCode || typeof roomCode !== 'string' || roomCode.length < 1 || roomCode.length > 10) {
    res.status(400).json({ error: 'roomCode must be a string (1-10 chars)' });
    return;
  }

  if (!_rm) {
    res.status(503).json({ error: 'Room manager not available' });
    return;
  }

  {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.chain !== 'solana') {
      res.status(400).json({ error: 'Room is not a Solana game' });
      return;
    }
    const isPlayer = room.players.some(
      (p) => p.walletAddress === user.wallet_address
    );
    if (!isPlayer) {
      res.status(403).json({ error: 'You are not a player in this game' });
      return;
    }
    if (room.phase === 'playing' && room.gameState?.phase !== 'game-over') {
      res.status(400).json({ error: 'Cannot cancel an active game' });
      return;
    }
    if (room.phase === 'lobby') {
      const hostPlayer = room.players.find((p) => p.id === room.hostId);
      if (hostPlayer?.walletAddress !== user.wallet_address) {
        res.status(403).json({ error: 'Only the host can cancel in lobby' });
        return;
      }
    }

    // Mutual exclusion: reject if a settlement was already issued
    const existingSettle = findSettlement(roomCode, '', 'solana');
    if (existingSettle) {
      res.status(409).json({ error: 'Settlement already issued for this game' });
      return;
    }
  }

  const gameId = roomCodeToSolanaGameIdHex(roomCode);

  await withRoomLock(roomCode, async () => {
    const existingCancel = findCancellation(roomCode, 'solana');
    if (existingCancel) {
      res.json({ nonce: existingCancel.nonce, signature: existingCancel.signature, gameId });
      return;
    }

    // Re-check settlement inside lock
    const settleCheck = findSettlement(roomCode, '', 'solana');
    if (settleCheck) {
      res.status(409).json({ error: 'Settlement already issued for this game' });
      return;
    }

    const result = signSolanaCancellation(roomCode);
    if (!result) {
      res.status(503).json({ error: 'Solana signing not available -- signer key not configured' });
      return;
    }

    await appendPendingRefunds([{
      roomCode,
      gameId,
      nonce: result.nonce,
      signature: result.signature,
      timestamp: Date.now(),
      reason: 'cancellation',
      chain: 'solana',
    }]);

    res.json({ nonce: result.nonce, signature: result.signature, gameId });
  });
});

router.post('/solana/close-game', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const ip = req.ip ?? 'unknown';
  if (!contractRateLimit(`sol-close:${ip}`, 5, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { roomCode } = req.body ?? {};
  if (!roomCode || typeof roomCode !== 'string' || roomCode.length < 1 || roomCode.length > 10) {
    res.status(400).json({ error: 'roomCode must be a string (1-10 chars)' });
    return;
  }

  try {
    const txSignature = await closeGameOnSolana(roomCode);
    res.json({ txSignature });
  } catch (err: any) {
    const msg = err?.message || 'close_game failed';
    console.error('[contracts] solana/close-game error:', msg);
    // Graceful: don't fail loudly -- the user already got their refund
    res.status(500).json({ error: msg });
  }
});

router.get('/solana/signer', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const address = getSolanaSignerAddress();
  if (!address) {
    res.json({ address: null, configured: false });
    return;
  }
  res.json({ address, configured: true });
});

export default router;
