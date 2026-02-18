/**
 * Server-side contract interaction for MonopolyGame.sol
 *
 * The server acts as the `gameSigner` -- it signs messages that authorize:
 * 1. Settlement (winner claims pot via claimWinnings)
 * 2. Cancellation (game cancelled via cancelGame)
 *
 * The server NEVER holds player funds. It only produces signatures.
 *
 * TODO: Load real signer key and contract addresses from env once deployed.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodePacked,
  keccak256,
  type Address,
  type Hash,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';
import { loadSecureKeys } from './keys';

// --- Config ---

const CHAIN_ENV = process.env.CHAIN_ENV ?? 'base-sepolia';
const RPC_URL = process.env.BASE_RPC_URL ?? (
  CHAIN_ENV === 'base-mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org'
);
const CHAIN_ID = CHAIN_ENV === 'base-mainnet' ? 8453 : 84532;
const CONTRACT_ADDRESS = (process.env.MONOPOLY_GAME_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address;

// Game signer private key -- loaded from secure keyfile, fallback to env
const secureKeys = loadSecureKeys();
const SIGNER_PRIVATE_KEY = (secureKeys.GAME_SIGNER_PRIVATE_KEY ?? process.env.GAME_SIGNER_PRIVATE_KEY) as Hex | undefined;

function getChain() {
  return CHAIN_ENV === 'base-mainnet' ? base : baseSepolia;
}

function getSignerAccount() {
  if (!SIGNER_PRIVATE_KEY) {
    console.warn('[contracts] GAME_SIGNER_PRIVATE_KEY not set -- signing disabled');
    return null;
  }
  return privateKeyToAccount(SIGNER_PRIVATE_KEY);
}

// --- Game ID ---

export function roomCodeToGameId(roomCode: string): Hash {
  return keccak256(encodePacked(['string'], [roomCode]));
}

// --- Nonce generation ---

export function generateNonce(): Hash {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as Hash;
}

// --- Settlement signing ---

/**
 * Sign a settlement message authorizing `winnerAddress` to claim winnings.
 *
 * The contract verifies:
 *   keccak256(abi.encodePacked(gameId, winner, nonce, contractAddress, chainId))
 *   signed by gameSigner
 *
 * Returns { nonce, signature } for the client to submit to claimWinnings().
 */
export async function signSettlement(
  roomCode: string,
  winnerAddress: Address,
): Promise<{ nonce: Hash; signature: Hex } | null> {
  const account = getSignerAccount();
  if (!account) {
    console.warn('[contracts] signSettlement: no signer key, returning null');
    return null;
  }

  const gameId = roomCodeToGameId(roomCode);
  const nonce = generateNonce();

  const messageHash = keccak256(
    encodePacked(
      ['bytes32', 'address', 'bytes32', 'address', 'uint256'],
      [gameId, winnerAddress, nonce, CONTRACT_ADDRESS, BigInt(CHAIN_ID)],
    ),
  );

  // EIP-191 personal sign (produces the "\x19Ethereum Signed Message:\n32" prefix)
  const signature = await account.signMessage({ message: { raw: messageHash } });

  return { nonce, signature };
}

/**
 * Sign a cancellation message.
 *
 * The contract verifies:
 *   keccak256(abi.encodePacked("CANCEL", gameId, nonce, contractAddress, chainId))
 *   signed by gameSigner
 */
export async function signCancellation(
  roomCode: string,
): Promise<{ nonce: Hash; signature: Hex } | null> {
  const account = getSignerAccount();
  if (!account) {
    console.warn('[contracts] signCancellation: no signer key, returning null');
    return null;
  }

  const gameId = roomCodeToGameId(roomCode);
  const nonce = generateNonce();

  const messageHash = keccak256(
    encodePacked(
      ['string', 'bytes32', 'bytes32', 'address', 'uint256'],
      ['CANCEL', gameId, nonce, CONTRACT_ADDRESS, BigInt(CHAIN_ID)],
    ),
  );

  const signature = await account.signMessage({ message: { raw: messageHash } });

  return { nonce, signature };
}

/**
 * Sign a cancellation by raw gameId (for retroactive refunds on old games).
 */
export async function signCancellationByGameId(
  gameId: Hash,
): Promise<{ nonce: Hash; signature: Hex } | null> {
  const account = getSignerAccount();
  if (!account) {
    console.warn('[contracts] signCancellationByGameId: no signer key, returning null');
    return null;
  }

  const nonce = generateNonce();

  const messageHash = keccak256(
    encodePacked(
      ['string', 'bytes32', 'bytes32', 'address', 'uint256'],
      ['CANCEL', gameId, nonce, CONTRACT_ADDRESS, BigInt(CHAIN_ID)],
    ),
  );

  const signature = await account.signMessage({ message: { raw: messageHash } });

  return { nonce, signature };
}

/**
 * Get the signer's public address (for verifying it matches contract's gameSigner).
 */
export function getSignerAddress(): Address | null {
  const account = getSignerAccount();
  return account?.address ?? null;
}
