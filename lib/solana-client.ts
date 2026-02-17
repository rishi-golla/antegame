import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

export function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

export function getEscrowAddress(): string {
  return process.env.NEXT_PUBLIC_ESCROW_ADDRESS || '';
}

export async function getSolBalance(walletAddress: string): Promise<number> {
  const conn = getConnection();
  const balance = await conn.getBalance(new PublicKey(walletAddress));
  return balance;
}

export async function depositToEscrow(
  walletPublicKey: PublicKey,
  lamports: number,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const conn = getConnection();
  const escrowPubkey = new PublicKey(getEscrowAddress());

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: walletPublicKey,
      toPubkey: escrowPubkey,
      lamports,
    })
  );

  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = walletPublicKey;

  const signed = await signTransaction(tx);
  const sig = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
