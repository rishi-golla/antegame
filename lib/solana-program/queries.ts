/**
 * Account readers for the Monopoly Game Solana program.
 */

import { PublicKey } from '@solana/web3.js';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import { getProgram, getConnection } from './index';
import { getGamePda, getConfigPda } from './addresses';

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
