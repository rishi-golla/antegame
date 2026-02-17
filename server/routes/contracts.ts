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

const router = Router();

router.post('/settlement-signature', async (req, res) => {
  const { roomCode, winnerAddress } = req.body ?? {};

  if (!roomCode || !winnerAddress) {
    res.status(400).json({ error: 'roomCode and winnerAddress required' });
    return;
  }

  // TODO: Verify the caller's session matches winnerAddress
  // TODO: Verify the room actually finished and this address won

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
