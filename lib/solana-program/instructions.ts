/**
 * Transaction builders for the Monopoly Game Solana program.
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
  LAMPORTS_PER_SOL,
  Transaction,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { getProgram, getConnection } from './index';
import { getGamePda, getConfigPda, getNoncePda, roomCodeToGameId, PROGRAM_ID } from './addresses';

/**
 * Create a new game on-chain and deposit the buy-in.
 */
export async function createGameOnSolana(
  wallet: AnchorWallet,
  roomCode: string,
  maxPlayers: number,
  buyInLamports: number
): Promise<string> {
  const program = getProgram(wallet);
  const gameId = roomCodeToGameId(roomCode);
  const gamePda = getGamePda(roomCode);

  const tx = await program.methods
    .createGame(Array.from(gameId) as any, maxPlayers, new BN(buyInLamports))
    .accounts({
      game: gamePda,
      host: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: 'confirmed' });

  return tx;
}

/**
 * Join an existing game on-chain and deposit the buy-in.
 */
export async function joinGameOnSolana(
  wallet: AnchorWallet,
  roomCode: string
): Promise<string> {
  const program = getProgram(wallet);
  const gamePda = getGamePda(roomCode);

  const tx = await program.methods
    .joinGame()
    .accounts({
      game: gamePda,
      player: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc({ commitment: 'confirmed' });

  return tx;
}

/**
 * Claim winnings with Ed25519 precompile verification.
 * The nonce and signature come from the server's /api/contracts/solana/settlement-signature endpoint.
 */
export async function claimWinningsOnSolana(
  wallet: AnchorWallet,
  roomCode: string,
  nonceB58: string,
  signatureB58: string,
  signerPubkeyB58: string
): Promise<string> {
  const program = getProgram(wallet);
  const gamePda = getGamePda(roomCode);
  const configPda = getConfigPda();
  const nonce = bs58.decode(nonceB58);
  const signature = bs58.decode(signatureB58);
  const signerPubkey = new PublicKey(signerPubkeyB58);
  const noncePda = getNoncePda(nonce);

  // Build the message that was signed (must match program expectations)
  const gameId = roomCodeToGameId(roomCode);
  const message = Buffer.concat([
    gameId,
    wallet.publicKey.toBuffer(),
    Buffer.from(nonce),
    PROGRAM_ID.toBuffer(),
  ]);

  // Create Ed25519 precompile instruction
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: signerPubkey.toBytes(),
    message,
    signature,
  });

  // Fetch config to get fee_vault
  const config = await (program.account as any).globalConfig.fetch(configPda);

  // Build the program instruction separately
  const claimIx = await program.methods
    .claimWinnings(Array.from(nonce) as any)
    .accounts({
      game: gamePda,
      config: configPda,
      winner: wallet.publicKey,
      feeVault: (config as any).feeVault,
      nonceAccount: noncePda,
      payer: wallet.publicKey,
      ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Build tx manually to guarantee Ed25519 is at index 0
  const connection = getConnection();
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: wallet.publicKey });
  tx.add(ed25519Ix);
  tx.add(claimIx);

  const signed = await wallet.signTransaction(tx);
  const txSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(txSig, 'confirmed');

  return txSig;
}

/**
 * Cancel a game on-chain with Ed25519 precompile verification.
 */
export async function cancelGameOnSolana(
  wallet: AnchorWallet,
  roomCode: string,
  nonceB58: string,
  signatureB58: string,
  signerPubkeyB58: string
): Promise<string> {
  const program = getProgram(wallet);
  const gamePda = getGamePda(roomCode);
  const configPda = getConfigPda();
  const nonce = bs58.decode(nonceB58);
  const signature = bs58.decode(signatureB58);
  const signerPubkey = new PublicKey(signerPubkeyB58);
  const noncePda = getNoncePda(nonce);

  // Build cancellation message
  const gameId = roomCodeToGameId(roomCode);
  const message = Buffer.concat([
    Buffer.from('CANCEL'),
    gameId,
    Buffer.from(nonce),
    PROGRAM_ID.toBuffer(),
  ]);

  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: signerPubkey.toBytes(),
    message,
    signature,
  });

  // Build the program instruction separately
  const cancelIx = await program.methods
    .cancelGame(Array.from(nonce) as any)
    .accounts({
      game: gamePda,
      config: configPda,
      nonceAccount: noncePda,
      payer: wallet.publicKey,
      ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Build tx manually to guarantee Ed25519 is at index 0
  const connection = getConnection();
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: wallet.publicKey });
  tx.add(ed25519Ix);
  tx.add(cancelIx);

  const signed = await wallet.signTransaction(tx);
  const txSig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(txSig, 'confirmed');

  return txSig;
}

/**
 * Claim refund from a cancelled game.
 */
export async function claimRefundOnSolana(
  wallet: AnchorWallet,
  roomCode: string
): Promise<string> {
  const program = getProgram(wallet);
  const gamePda = getGamePda(roomCode);

  const tx = await program.methods
    .claimRefund()
    .accounts({
      game: gamePda,
      player: wallet.publicKey,
    })
    .rpc({ commitment: 'confirmed' });

  return tx;
}

/**
 * Emergency cancel -- any player after 24 hours.
 */
export async function emergencyCancelOnSolana(
  wallet: AnchorWallet,
  roomCode: string
): Promise<string> {
  const program = getProgram(wallet);
  const gamePda = getGamePda(roomCode);

  const tx = await program.methods
    .emergencyCancel()
    .accounts({
      game: gamePda,
      player: wallet.publicKey,
    })
    .rpc({ commitment: 'confirmed' });

  return tx;
}

/**
 * Convert SOL to lamports.
 */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/**
 * Convert lamports to SOL.
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}
