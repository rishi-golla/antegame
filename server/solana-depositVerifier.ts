/**
 * On-chain deposit verification for the Solana Anchor program.
 *
 * After a client deposits via createGame/joinGame, the server reads the
 * GameAccount PDA to verify the player's pubkey is in the players vec
 * and deposited[idx] == true.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { isDepositVerified, markDepositVerified } from './db';

const SOLANA_RPC_URL_STR = process.env.SOLANA_RPC_URL;
const SOLANA_PROGRAM_ID_STR = process.env.SOLANA_PROGRAM_ID;
if (process.env.NODE_ENV === 'production') {
  if (!SOLANA_RPC_URL_STR) throw new Error('SOLANA_RPC_URL must be set in production');
  if (!SOLANA_PROGRAM_ID_STR) throw new Error('SOLANA_PROGRAM_ID must be set in production');
}
const RPC_URL = SOLANA_RPC_URL_STR ?? 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(
  SOLANA_PROGRAM_ID_STR ?? '8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U'
);

const connection = new Connection(RPC_URL, 'confirmed');

// Anchor discriminator for GameAccount: first 8 bytes of sha256("account:GameAccount")
const GAME_ACCOUNT_DISCRIMINATOR = Buffer.from([168, 26, 58, 96, 13, 208, 230, 188]);

/**
 * Derive the GameAccount PDA from a game ID buffer.
 */
function getGamePda(gameId: Buffer): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), gameId],
    PROGRAM_ID
  );
  return pda;
}

interface GameAccountData {
  gameId: Buffer;
  buyIn: bigint;
  maxPlayers: number;
  pot: bigint;
  startedAt: bigint;
  state: number; // 0=Waiting, 1=Active, 2=Settled, 3=Cancelled
  players: PublicKey[];
  deposited: boolean[];
  refunded: boolean[];
  winner: PublicKey;
  bump: number;
}

/**
 * Deserialize a GameAccount from raw account data.
 * Layout matches the Anchor program's GameAccount struct.
 */
function deserializeGameAccount(data: Buffer): GameAccountData {
  let offset = 8; // skip discriminator

  const gameId = data.subarray(offset, offset + 32);
  offset += 32;

  const buyIn = data.readBigUInt64LE(offset);
  offset += 8;

  const maxPlayers = data.readUInt8(offset);
  offset += 1;

  const pot = data.readBigUInt64LE(offset);
  offset += 8;

  const startedAt = data.readBigInt64LE(offset);
  offset += 8;

  const state = data.readUInt8(offset);
  offset += 1;

  // Vec<Pubkey>: 4-byte length prefix + N * 32 bytes (Anchor Vec is NOT padded to max)
  const playerCount = data.readUInt32LE(offset);
  offset += 4;

  const players: PublicKey[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(new PublicKey(data.subarray(offset, offset + 32)));
    offset += 32;
  }

  // deposited: [bool; 6]
  const deposited: boolean[] = [];
  for (let i = 0; i < 6; i++) {
    deposited.push(data.readUInt8(offset) === 1);
    offset += 1;
  }

  // refunded: [bool; 6]
  const refunded: boolean[] = [];
  for (let i = 0; i < 6; i++) {
    refunded.push(data.readUInt8(offset) === 1);
    offset += 1;
  }

  const winner = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const bump = data.readUInt8(offset);

  return {
    gameId: Buffer.from(gameId),
    buyIn,
    maxPlayers,
    pot,
    startedAt,
    state,
    players,
    deposited,
    refunded,
    winner,
    bump,
  };
}

/**
 * Read and deserialize a GameAccount PDA.
 */
export async function readGameAccount(gameId: Buffer): Promise<GameAccountData | null> {
  const pda = getGamePda(gameId);
  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo || !accountInfo.data) return null;

  // Verify discriminator
  const disc = accountInfo.data.subarray(0, 8);
  if (!disc.equals(GAME_ACCOUNT_DISCRIMINATOR)) return null;

  return deserializeGameAccount(Buffer.from(accountInfo.data));
}

/**
 * Retry helper with exponential backoff for RPC latency.
 */
async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  throw new Error('Retry exhausted');
}

/**
 * Verify a Solana deposit by checking the on-chain GameAccount PDA.
 * Returns { ok: true } if the player is found in the game and marked as deposited.
 */
export async function verifySolanaDeposit(
  txSignature: string,
  roomCode: string,
  gameId: Buffer,
  playerPubkey: string,
  expectedBuyInLamports: number
): Promise<{ ok: boolean; error?: string }> {
  // Dedup check
  if (isDepositVerified(txSignature)) {
    return { ok: true };
  }

  try {
    const game = await retry(() => readGameAccount(gameId));
    if (!game) {
      return { ok: false, error: 'Game account not found on-chain' };
    }

    // Verify buy-in matches
    if (Number(game.buyIn) !== expectedBuyInLamports) {
      return { ok: false, error: `Buy-in mismatch: expected ${expectedBuyInLamports}, got ${game.buyIn}` };
    }

    // Find player in the game
    const playerKey = new PublicKey(playerPubkey);
    const playerIdx = game.players.findIndex((p) => p.equals(playerKey));
    if (playerIdx < 0) {
      return { ok: false, error: 'Player not found in on-chain game' };
    }

    // Verify deposit flag
    if (!game.deposited[playerIdx]) {
      return { ok: false, error: 'Player deposit not confirmed on-chain' };
    }

    // Mark as verified for dedup
    markDepositVerified(txSignature, roomCode, playerPubkey);

    return { ok: true };
  } catch (err: any) {
    console.error('[solana-depositVerifier] Verification failed:', err);
    return { ok: false, error: 'Deposit verification failed' };
  }
}

export { connection, PROGRAM_ID };
