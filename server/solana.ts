import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

import os from 'os';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const KEYPAIR_PATH = path.join(os.homedir(), '.config', 'ante', 'solana-escrow.json');
const LEGACY_KEYPAIR_PATH = path.join(process.cwd(), 'data', 'escrow-keypair.json');
const WINNER_MULTIPLIER = Number(process.env.WINNER_MULTIPLIER || '2');

const connection = new Connection(RPC_URL, 'confirmed');

// Load or generate escrow keypair (H7: secure location with permission check)
function loadKeypair(): Keypair {
  // Try new secure location first
  if (fs.existsSync(KEYPAIR_PATH)) {
    // Check file permissions
    const stat = fs.statSync(KEYPAIR_PATH);
    const mode = stat.mode & 0o777;
    if (mode !== 0o600) {
      console.warn(`[solana] WARNING: ${KEYPAIR_PATH} has permissions ${mode.toString(8)}, expected 600. Run: chmod 600 ${KEYPAIR_PATH}`);
    }
    const data = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(data));
  }

  // Migrate from legacy location if exists
  if (fs.existsSync(LEGACY_KEYPAIR_PATH)) {
    console.log(`[solana] Migrating escrow keypair from ${LEGACY_KEYPAIR_PATH} to ${KEYPAIR_PATH}`);
    const data = fs.readFileSync(LEGACY_KEYPAIR_PATH, 'utf-8');
    const dir = path.dirname(KEYPAIR_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KEYPAIR_PATH, data, { mode: 0o600 });
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(data)));
  }

  // Generate new keypair
  const kp = Keypair.generate();
  const dir = path.dirname(KEYPAIR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  console.log(`Generated escrow keypair: ${kp.publicKey.toBase58()}`);
  return kp;
}

const escrowKeypair = loadKeypair();

export function getEscrowPublicKey(): PublicKey {
  return escrowKeypair.publicKey;
}

export function getEscrowAddress(): string {
  return escrowKeypair.publicKey.toBase58();
}

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

export async function verifyDeposit(
  txSignature: string,
  expectedFrom: string,
  expectedLamports: number
): Promise<boolean> {
  return retry(async () => {
    const tx = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) return false;

    // Check that escrow received at least expectedLamports
    const escrowIndex = tx.transaction.message.getAccountKeys().staticAccountKeys.findIndex(
      (k) => k.toBase58() === escrowKeypair.publicKey.toBase58()
    );
    if (escrowIndex < 0) return false;

    const preBalance = tx.meta.preBalances[escrowIndex] ?? 0;
    const postBalance = tx.meta.postBalances[escrowIndex] ?? 0;
    const received = postBalance - preBalance;
    return received >= expectedLamports;
  });
}

export async function settlePot(
  winnerWallet: string,
  payoutLamports: number
): Promise<string> {
  return retry(async () => {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: escrowKeypair.publicKey,
        toPubkey: new PublicKey(winnerWallet),
        lamports: payoutLamports,
      })
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [escrowKeypair]);
    return sig;
  });
}

export async function refundPlayer(
  walletAddress: string,
  amountLamports: number
): Promise<string> {
  return retry(async () => {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: escrowKeypair.publicKey,
        toPubkey: new PublicKey(walletAddress),
        lamports: amountLamports,
      })
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [escrowKeypair]);
    return sig;
  });
}

export async function getBalance(walletAddress?: string): Promise<number> {
  const pubkey = walletAddress ? new PublicKey(walletAddress) : escrowKeypair.publicKey;
  return connection.getBalance(pubkey);
}

export { WINNER_MULTIPLIER, connection };
