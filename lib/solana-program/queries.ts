/**
 * Account readers for the Monopoly Game Solana program.
 */

import { Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { getProgram, getConnection } from './index';
import { getGamePda, getConfigPda, PROGRAM_ID } from './addresses';
import idl from './idl.json';

export interface OnChainGameData {
  gameId: number[];
  buyIn: number;
  maxPlayers: number;
  pot: number;
  startedAt: number;
  state: { waiting: {} } | { active: {} } | { settled: {} } | { cancelled: {} };
  players: PublicKey[];
  deposited: boolean[];
  refunded: boolean[];
  winner: PublicKey;
  bump: number;
}

/**
 * Read the GameAccount PDA for a given room code.
 */
export async function getGameOnSolana(
  wallet: AnchorWallet,
  roomCode: string
): Promise<OnChainGameData | null> {
  try {
    const program = getProgram(wallet);
    const gamePda = getGamePda(roomCode);
    const data = await (program.account as any).gameAccount.fetch(gamePda);
    return {
      gameId: (data as any).gameId,
      buyIn: (data as any).buyIn.toNumber(),
      maxPlayers: (data as any).maxPlayers,
      pot: (data as any).pot.toNumber(),
      startedAt: (data as any).startedAt.toNumber(),
      state: (data as any).state,
      players: (data as any).players,
      deposited: (data as any).deposited,
      refunded: (data as any).refunded,
      winner: (data as any).winner,
      bump: (data as any).bump,
    };
  } catch {
    return null;
  }
}

/**
 * Read the GameAccount PDA without requiring a signing wallet.
 * Uses a dummy keypair for a read-only Anchor Program instance.
 */
export async function getGameAccountRaw(
  roomCode: string
): Promise<OnChainGameData | null> {
  try {
    const connection = getConnection();
    const dummyKeypair = Keypair.generate();
    const dummyWallet: AnchorWallet = {
      publicKey: dummyKeypair.publicKey,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any) => txs,
    };
    const provider = new AnchorProvider(connection, dummyWallet, {
      commitment: 'confirmed',
    });
    const programIdl = { ...idl, address: PROGRAM_ID.toBase58() };
    const program = new Program(programIdl as any, provider);
    const gamePda = getGamePda(roomCode);
    const data = await (program.account as any).gameAccount.fetch(gamePda);
    return {
      gameId: (data as any).gameId,
      buyIn: (data as any).buyIn.toNumber(),
      maxPlayers: (data as any).maxPlayers,
      pot: (data as any).pot.toNumber(),
      startedAt: (data as any).startedAt.toNumber(),
      state: (data as any).state,
      players: (data as any).players,
      deposited: (data as any).deposited,
      refunded: (data as any).refunded,
      winner: (data as any).winner,
      bump: (data as any).bump,
    };
  } catch {
    return null;
  }
}

/**
 * Read the GlobalConfig PDA.
 */
export async function getConfigOnSolana(wallet: AnchorWallet) {
  try {
    const program = getProgram(wallet);
    const configPda = getConfigPda();
    return await (program.account as any).globalConfig.fetch(configPda);
  } catch {
    return null;
  }
}

/**
 * Get SOL balance for a wallet address.
 */
export async function getSolBalance(walletAddress: string): Promise<number> {
  const connection = getConnection();
  return connection.getBalance(new PublicKey(walletAddress));
}
