/**
 * Solana Ed25519 signing for the Monopoly Game Anchor program.
 *
 * The server acts as the `gameSigner` -- it signs Ed25519 messages that authorize:
 * 1. Settlement (winner claims pot via claimWinnings)
 * 2. Cancellation (game cancelled via cancelGame)
 *
 * The server NEVER holds player funds. It only produces signatures.
 * Replaces the deprecated server/solana.ts escrow model.
 */

import { createHash, randomBytes } from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { loadSecureKeys } from './keys';

// --- Config ---

const SOLANA_PROGRAM_ID_STR = process.env.SOLANA_PROGRAM_ID;
if (!SOLANA_PROGRAM_ID_STR && process.env.NODE_ENV === 'production') {
  throw new Error('SOLANA_PROGRAM_ID must be set in production');
}
const PROGRAM_ID = new PublicKey(
  SOLANA_PROGRAM_ID_STR ?? '8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U'
);

// Load game signer keypair from secure keyfile or env
function loadSignerKeypair(): nacl.SignKeyPair | null {
  const secureKeys = loadSecureKeys();
  const raw = secureKeys.SOLANA_GAME_SIGNER_SECRET ?? process.env.SOLANA_GAME_SIGNER_SECRET;
  if (!raw) {
    console.warn('[solana-contracts] SOLANA_GAME_SIGNER_SECRET not set -- Solana signing disabled');
    return null;
  }

  try {
    // Support both JSON array format and base58 format
    let secretKey: Uint8Array;
    if (raw.startsWith('[')) {
      secretKey = Uint8Array.from(JSON.parse(raw));
    } else {
      secretKey = bs58.decode(raw);
    }
    return nacl.sign.keyPair.fromSecretKey(secretKey);
  } catch (err) {
    console.error('[solana-contracts] Failed to load signer keypair:', err);
    return null;
  }
}

let _signerKeypair: nacl.SignKeyPair | null | undefined;

function getSignerKeypair(): nacl.SignKeyPair | null {
  if (_signerKeypair === undefined) {
    _signerKeypair = loadSignerKeypair();
  }
  return _signerKeypair;
}

// --- Public API ---

/**
 * Convert room code to a 32-byte game ID using SHA-256.
 * Solana uses SHA-256 (not keccak256 like Base).
 */
export function roomCodeToSolanaGameId(roomCode: string): Buffer {
  return createHash('sha256').update(roomCode).digest();
}

/**
 * Get the game ID as a hex string for display/storage.
 */
export function roomCodeToSolanaGameIdHex(roomCode: string): string {
  return '0x' + roomCodeToSolanaGameId(roomCode).toString('hex');
}

/**
 * Sign a settlement message for the winner to claim on-chain.
 * Message format: game_id (32) || winner_pubkey (32) || nonce (32) || program_id (32)
 */
export function signSolanaSettlement(
  roomCode: string,
  winnerPubkey: string
): { nonce: string; signature: string; gameId: string } | null {
  const keypair = getSignerKeypair();
  if (!keypair) return null;

  const gameId = roomCodeToSolanaGameId(roomCode);
  const nonce = randomBytes(32);
  const winnerKey = new PublicKey(winnerPubkey);

  const message = Buffer.concat([
    gameId,
    winnerKey.toBuffer(),
    nonce,
    PROGRAM_ID.toBuffer(),
  ]);

  const signature = nacl.sign.detached(message, keypair.secretKey);

  return {
    nonce: bs58.encode(nonce),
    signature: bs58.encode(signature),
    gameId: '0x' + gameId.toString('hex'),
  };
}

/**
 * Sign a cancellation message for on-chain game cancellation.
 * Message format: "CANCEL" (6) || game_id (32) || nonce (32) || program_id (32)
 */
export function signSolanaCancellation(
  roomCode: string
): { nonce: string; signature: string; gameId: string } | null {
  const keypair = getSignerKeypair();
  if (!keypair) return null;

  const gameId = roomCodeToSolanaGameId(roomCode);
  const nonce = randomBytes(32);

  const message = Buffer.concat([
    Buffer.from('CANCEL'),
    gameId,
    nonce,
    PROGRAM_ID.toBuffer(),
  ]);

  const signature = nacl.sign.detached(message, keypair.secretKey);

  return {
    nonce: bs58.encode(nonce),
    signature: bs58.encode(signature),
    gameId: '0x' + gameId.toString('hex'),
  };
}

/**
 * Get the Solana game signer public key (base58).
 */
export function getSolanaSignerAddress(): string | null {
  const keypair = getSignerKeypair();
  if (!keypair) return null;
  return bs58.encode(keypair.publicKey);
}

/**
 * Get the Solana program ID (base58).
 */
export function getSolanaProgramId(): string {
  return PROGRAM_ID.toBase58();
}
