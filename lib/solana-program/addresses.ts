/**
 * Solana program addresses and PDA derivation helpers.
 */

import { PublicKey } from '@solana/web3.js';
import { createHash } from 'crypto';

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID ?? '8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U'
);

/**
 * Derive the GlobalConfig PDA.
 */
export function getConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Derive the GameAccount PDA from a room code.
 */
export function getGamePda(roomCode: string): PublicKey {
  const gameId = roomCodeToGameId(roomCode);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), gameId],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Derive the NonceAccount PDA from a nonce buffer.
 */
export function getNoncePda(nonce: Uint8Array): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('nonce'), Buffer.from(nonce)],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Convert room code to 32-byte game ID (SHA-256 hash).
 */
export function roomCodeToGameId(roomCode: string): Buffer {
  return createHash('sha256').update(roomCode).digest();
}
