/**
 * On-chain deposit verification for Base (EVM).
 * Verifies that a transaction actually deposited the correct amount
 * to the MonopolyGame contract for the expected gameId and player.
 */

import { createPublicClient, http, decodeEventLog, parseEther, type Address, type Hash } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { roomCodeToGameId } from './contracts';
import { isDepositVerified, markDepositVerified } from './db';

const CHAIN_ENV = process.env.CHAIN_ENV ?? 'base-sepolia';
const RPC_URL = process.env.BASE_RPC_URL ?? (
  CHAIN_ENV === 'base-mainnet' ? 'https://mainnet.base.org' : 'https://sepolia.base.org'
);
const CONTRACT_ADDRESS = (process.env.MONOPOLY_GAME_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address;

const chain = CHAIN_ENV === 'base-mainnet' ? base : baseSepolia;

const client = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

// PlayerJoined event signature: PlayerJoined(bytes32 indexed gameId, address indexed player, uint256 buyIn)
const PLAYER_JOINED_ABI = [{
  type: 'event',
  name: 'PlayerJoined',
  inputs: [
    { name: 'gameId', type: 'bytes32', indexed: true },
    { name: 'player', type: 'address', indexed: true },
    { name: 'buyIn', type: 'uint256', indexed: false },
  ],
}] as const;

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

/**
 * Verify that a transaction hash represents a valid deposit to the contract.
 * 
 * Checks:
 * 1. Transaction exists and is confirmed (not pending)
 * 2. Transaction was sent TO the MonopolyGame contract
 * 3. Transaction succeeded (status = 'success')
 * 4. Transaction emits PlayerJoined event with correct gameId and player
 * 5. Transaction hash hasn't been used before (prevent reuse)
 */
export async function verifyDeposit(
  txHash: string,
  roomCode: string,
  expectedWallet: string,
  expectedBuyInEth?: string,
): Promise<VerifyResult> {
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    return { ok: false, error: 'Invalid transaction hash' };
  }

  // Prevent tx hash reuse (persisted to SQLite)
  const txKey = txHash.toLowerCase();
  if (isDepositVerified(txKey)) {
    return { ok: false, error: 'Transaction already used for a deposit' };
  }

  try {
    // 1. Get transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash as Hash });

    if (!receipt) {
      return { ok: false, error: 'Transaction not found or not yet confirmed' };
    }

    // 2. Check it succeeded
    if (receipt.status !== 'success') {
      return { ok: false, error: 'Transaction failed on-chain' };
    }

    // 3. Check it was sent to our contract
    if (receipt.to?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return { ok: false, error: 'Transaction not sent to the game contract' };
    }

    // 4. Find the PlayerJoined event log
    const expectedGameId = roomCodeToGameId(roomCode);

    let foundValidLog = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;

      try {
        const decoded = decodeEventLog({
          abi: PLAYER_JOINED_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (
          decoded.eventName === 'PlayerJoined' &&
          (decoded.args as any).gameId?.toLowerCase() === expectedGameId.toLowerCase() &&
          (decoded.args as any).player?.toLowerCase() === expectedWallet.toLowerCase()
        ) {
          // H1: Verify deposit amount matches room buy-in
          if (expectedBuyInEth) {
            const expectedWei = parseEther(expectedBuyInEth);
            const actualWei = (decoded.args as any).buyIn as bigint;
            if (actualWei < expectedWei) {
              return { ok: false, error: `Deposit amount too low. Expected ${expectedBuyInEth} ETH.` };
            }
          }
          foundValidLog = true;
          break;
        }
      } catch {
        // Not a PlayerJoined log, skip
        continue;
      }
    }

    if (!foundValidLog) {
      return { ok: false, error: 'Transaction does not contain a valid deposit for this game and player' };
    }

    // 5. Mark as verified (persisted to SQLite)
    markDepositVerified(txKey, roomCode, expectedWallet);

    return { ok: true };
  } catch (e: any) {
    console.error('[depositVerifier] Error verifying deposit:', e.message);
    return { ok: false, error: 'Failed to verify transaction on-chain' };
  }
}

/**
 * Cleanup old verified hashes (no-op: SQLite handles persistence).
 * Kept for backwards compatibility with callers.
 */
export function cleanupVerifiedHashes() {
  // No-op: verified deposits are now persisted in SQLite
}
