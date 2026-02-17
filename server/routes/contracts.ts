/**
 * REST endpoints for contract signature requests.
 *
 * POST /api/contracts/settlement-signature
 *   Body: { roomCode: string, winnerAddress: string }
 *   Returns: { nonce, signature, gameId } or error
 *
 * POST /api/contracts/cancellation-signature
 *   Body: { roomCode: string }
 *   Returns: { nonce, signature, gameId } or error
 *
 * GET /api/contracts/signer
 *   Returns: { address } -- the gameSigner public address
 *
 * These are called by the frontend when a game ends and the winner
 * needs a signature to call claimWinnings() on-chain.
 *
 * TODO: Add auth middleware (session check) and verify caller is actually
 * the winner / a player in the game before handing out signatures.
 */

import { Router } from 'express';
import { signSettlement, signCancellation, getSignerAddress, roomCodeToGameId } from '../contracts';
import type { RoomManager } from '../roomManager';

let _rm: RoomManager | null = null;

/** Call once at startup to give routes access to the room manager */
export function setRoomManager(rm: RoomManager) {
  _rm = rm;
}

const router = Router();

router.post('/settlement-signature', async (req, res) => {
  const { roomCode, winnerAddress } = req.body ?? {};

  if (!roomCode || !winnerAddress) {
    res.status(400).json({ error: 'roomCode and winnerAddress required' });
    return;
  }

  // Validate: room exists, game is finished, and requester is the winner
  if (_rm) {
    const room = _rm.getRoom(roomCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.phase !== 'finished') {
      res.status(400).json({ error: 'Game is not finished' });
      return;
    }
    if (room.gameState?.winner !== null && room.gameState?.winner !== undefined) {
      const winnerPlayer = room.players[room.gameState.winner];
      if (winnerPlayer?.walletAddress?.toLowerCase() !== winnerAddress.toLowerCase()) {
        res.status(403).json({ error: 'You are not the winner' });
        return;
      }
    }
  }

  const result = await signSettlement(roomCode, winnerAddress);
  if (!result) {
    res.status(503).json({ error: 'Signing not available -- signer key not configured' });
    return;
  }

  const gameId = roomCodeToGameId(roomCode);
  res.json({ nonce: result.nonce, signature: result.signature, gameId });
});

router.post('/cancellation-signature', async (req, res) => {
  const { roomCode } = req.body ?? {};

  if (!roomCode) {
    res.status(400).json({ error: 'roomCode required' });
    return;
  }

  // TODO: Verify the caller is a player in this game
  // TODO: Verify the game is in a cancellable state

  const result = await signCancellation(roomCode);
  if (!result) {
    res.status(503).json({ error: 'Signing not available -- signer key not configured' });
    return;
  }

  const gameId = roomCodeToGameId(roomCode);
  res.json({ nonce: result.nonce, signature: result.signature, gameId });
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
