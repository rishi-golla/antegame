/**
 * Server-side close_game instruction for the Solana Anchor program.
 *
 * Closes a settled or fully-refunded GameAccount PDA. The on-chain program
 * enforces that recipient == config.authority, so rent goes to the authority
 * wallet first. We then transfer it onward to the host (players[0]) who
 * originally paid it.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createHash } from 'crypto';
import { loadSecureKeys } from './keys';

// --- Config ---

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(
  process.env.SOLANA_PROGRAM_ID ?? '8HvezzN7yPPPNri1pjPzsM79YtevVFGwV66FWNsaoP1U'
);

// Anchor discriminator for close_game: first 8 bytes from IDL
const CLOSE_GAME_DISCRIMINATOR = Buffer.from([237, 236, 157, 201, 253, 20, 248, 67]);

// --- Helpers ---

function getConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

function roomCodeToGameId(roomCode: string): Buffer {
  return createHash('sha256').update(roomCode).digest();
}

function getGamePda(roomCode: string): PublicKey {
  const gameId = roomCodeToGameId(roomCode);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('game'), gameId],
    PROGRAM_ID
  );
  return pda;
}

function getConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    PROGRAM_ID
  );
  return pda;
}

function loadAuthorityKeypair(): Keypair | null {
  const keys = loadSecureKeys();
  const raw = keys.SOLANA_AUTHORITY_SECRET ?? process.env.SOLANA_AUTHORITY_SECRET;
  if (!raw) {
    console.warn('[solana-closeGame] SOLANA_AUTHORITY_SECRET not set -- close_game disabled');
    return null;
  }
  try {
    const secretKey = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secretKey);
  } catch (err) {
    console.error('[solana-closeGame] Failed to load authority keypair:', err);
    return null;
  }
}

let _authorityKeypair: Keypair | null | undefined;

function getAuthorityKeypair(): Keypair | null {
  if (_authorityKeypair === undefined) {
    _authorityKeypair = loadAuthorityKeypair();
  }
  return _authorityKeypair;
}

// --- Public API ---

/**
 * Close game account, reclaiming rent into the authority wallet.
 *
 * The on-chain close_game requires recipient == config.authority. Recovered
 * rent stays in the authority wallet, which self-funds future close_game
 * transaction fees. The ~0.003 SOL rent is disclosed to users as a
 * non-refundable network fee at game creation time.
 */
export async function closeGameOnSolana(roomCode: string): Promise<string> {
  const authority = getAuthorityKeypair();
  if (!authority) {
    throw new Error('Authority keypair not configured');
  }

  const connection = getConnection();
  const gamePda = getGamePda(roomCode);
  const configPda = getConfigPda();

  const closeTx = new Transaction().add(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: gamePda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: authority.publicKey, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    ],
    data: CLOSE_GAME_DISCRIMINATOR,
  }));

  const sig = await sendAndConfirmTransaction(connection, closeTx, [authority], {
    commitment: 'confirmed',
  });

  console.log(`[solana-closeGame] Closed game ${roomCode}, tx: ${sig}`);
  return sig;
}
