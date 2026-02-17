import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const KEYPAIR_PATH = path.join(process.cwd(), 'data', 'escrow-keypair.json');
const WINNER_MULTIPLIER = Number(process.env.WINNER_MULTIPLIER || '2');

const connection = new Connection(RPC_URL, 'confirmed');

// Load or generate escrow keypair
function loadKeypair(): Keypair {
  if (fs.existsSync(KEYPAIR_PATH)) {
    const data = JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(data));
  }
  const kp = Keypair.generate();
  const dir = path.dirname(KEYPAIR_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
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
