/**
 * Solana Anchor program client.
 * Provides the Program instance and re-exports helpers.
 */

import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import type { AnchorWallet } from '@solana/wallet-adapter-react';
import idl from './idl.json';
import { PROGRAM_ID } from './addresses';

export type MonopolyGameIDL = typeof idl;

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

/**
 * Create a Connection to the Solana cluster.
 */
export function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

/**
 * Create an AnchorProvider from a wallet adapter wallet.
 */
export function getProvider(wallet: AnchorWallet): AnchorProvider {
  const connection = getConnection();
  return new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
}

/**
 * Create the Anchor Program instance.
 */
export function getProgram(wallet: AnchorWallet): Program {
  const provider = getProvider(wallet);
  return new Program(idl as any, provider);
}

export { PROGRAM_ID } from './addresses';
export { getConfigPda, getGamePda, getNoncePda, roomCodeToGameId } from './addresses';
