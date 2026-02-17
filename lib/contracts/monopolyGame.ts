/**
 * Client-side contract interaction for MonopolyGame.sol on Base.
 *
 * All write functions require a wallet client (from wagmi/viem).
 * Read functions use a public client.
 */

import {
  createPublicClient,
  http,
  encodePacked,
  keccak256,
  parseEther,
  formatEther,
  type Address,
  type Hash,
  type WalletClient,
} from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { MONOPOLY_GAME_ABI } from './abi/MonopolyGame';
import { getAddresses, getChainEnv, getRpcUrl, getChainId } from './addresses';

// --- Chain config ---

function getChain() {
  return getChainEnv() === 'base-mainnet' ? base : baseSepolia;
}

function getPublicClient() {
  return createPublicClient({
    chain: getChain(),
    transport: http(getRpcUrl()),
  });
}

// --- Game ID helpers ---

/** Derive a deterministic bytes32 gameId from a room code */
export function roomCodeToGameId(roomCode: string): Hash {
  return keccak256(encodePacked(['string'], [roomCode]));
}

// --- Types ---

export enum OnChainGameState {
  WAITING = 0,
  ACTIVE = 1,
  SETTLED = 2,
  CANCELLED = 3,
}

export interface OnChainGame {
  buyIn: bigint;
  maxPlayers: bigint;
  pot: bigint;
  startedAt: bigint;
  state: OnChainGameState;
  players: Address[];
  winner: Address;
}

// --- Read functions ---

export async function getGameOnChain(roomCode: string): Promise<OnChainGame | null> {
  const client = getPublicClient();
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();

  try {
    const result = await client.readContract({
      address: addresses.monopolyGame,
      abi: MONOPOLY_GAME_ABI,
      functionName: 'getGame',
      args: [gameId],
    });
    return {
      buyIn: result[0],
      maxPlayers: result[1],
      pot: result[2],
      startedAt: result[3],
      state: result[4] as OnChainGameState,
      players: [...result[5]] as Address[],
      winner: result[6] as Address,
    };
  } catch (err) {
    console.error('[contracts] getGameOnChain failed:', err);
    return null;
  }
}

export async function isPlayerDeposited(roomCode: string, player: Address): Promise<boolean> {
  const client = getPublicClient();
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();
  try {
    return await client.readContract({
      address: addresses.monopolyGame,
      abi: MONOPOLY_GAME_ABI,
      functionName: 'deposited',
      args: [gameId, player],
    }) as boolean;
  } catch {
    return false;
  }
}

export async function getFeeBps(): Promise<number> {
  const client = getPublicClient();
  const addresses = getAddresses();
  try {
    const bps = await client.readContract({
      address: addresses.monopolyGame,
      abi: MONOPOLY_GAME_ABI,
      functionName: 'feeBps',
    }) as bigint;
    return Number(bps);
  } catch {
    return 500;
  }
}

// --- Write functions ---

/**
 * Create a game on-chain. The creator sends buyIn as msg.value.
 * Returns the tx hash.
 */
export async function createGameOnChain(
  walletClient: WalletClient,
  roomCode: string,
  maxPlayers: number,
  buyInEth: string,
): Promise<Hash> {
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();
  const buyInWei = parseEther(buyInEth);

  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    account,
    address: addresses.monopolyGame,
    abi: MONOPOLY_GAME_ABI,
    functionName: 'createGame',
    args: [gameId, BigInt(maxPlayers)],
    value: buyInWei,
    chain: getChain(),
  });
  return hash;
}

/**
 * Join an existing game on-chain. Player sends exact buyIn as msg.value.
 * Returns the tx hash.
 */
export async function joinGameOnChain(
  walletClient: WalletClient,
  roomCode: string,
  buyInEth: string,
): Promise<Hash> {
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();
  const buyInWei = parseEther(buyInEth);

  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    account,
    address: addresses.monopolyGame,
    abi: MONOPOLY_GAME_ABI,
    functionName: 'joinGame',
    args: [gameId],
    value: buyInWei,
    chain: getChain(),
  });
  return hash;
}

/**
 * Winner claims their winnings using server-provided signature.
 * This is a PULL model -- the winner initiates the tx, not the server.
 */
export async function claimWinnings(
  walletClient: WalletClient,
  roomCode: string,
  nonce: Hash,
  signature: `0x${string}`,
): Promise<Hash> {
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();

  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    account,
    address: addresses.monopolyGame,
    abi: MONOPOLY_GAME_ABI,
    functionName: 'claimWinnings',
    args: [gameId, nonce, signature],
    chain: getChain(),
  });
  return hash;
}

/**
 * Claim refund from a cancelled game.
 */
export async function claimRefund(
  walletClient: WalletClient,
  roomCode: string,
): Promise<Hash> {
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();

  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    account,
    address: addresses.monopolyGame,
    abi: MONOPOLY_GAME_ABI,
    functionName: 'claimRefund',
    args: [gameId],
    chain: getChain(),
  });
  return hash;
}

/**
 * Emergency cancel (any player, after 24h timeout).
 */
export async function emergencyCancel(
  walletClient: WalletClient,
  roomCode: string,
): Promise<Hash> {
  const gameId = roomCodeToGameId(roomCode);
  const addresses = getAddresses();

  const [account] = await walletClient.getAddresses();
  const hash = await walletClient.writeContract({
    account,
    address: addresses.monopolyGame,
    abi: MONOPOLY_GAME_ABI,
    functionName: 'emergencyCancel',
    args: [gameId],
    chain: getChain(),
  });
  return hash;
}

// --- Utilities ---

export { parseEther, formatEther } from 'viem';
