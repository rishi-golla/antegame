/**
 * Shared pending-refunds.json read/write helpers.
 * Uses a promise chain to serialize writes and prevent race conditions.
 * Writes use atomic rename to prevent data corruption on crash.
 *
 * Room-level locks ensure settlement/cancellation mutual exclusion
 * is checked and written atomically (prevents TOCTOU races).
 */
import * as fs from 'fs';
import * as path from 'path';

const REFUND_PATH = path.join(process.cwd(), 'pending-refunds.json');
const REFUND_TMP_PATH = REFUND_PATH + '.tmp';

let refundWriteLock = Promise.resolve();

export function appendPendingRefunds(refunds: any[]): Promise<void> {
  const thisWrite = refundWriteLock.then(async () => {
    let existing: any[] = [];
    try { existing = JSON.parse(fs.readFileSync(REFUND_PATH, 'utf8')); } catch {}
    existing.push(...refunds);
    // Atomic write: write to temp file, then rename (prevents corruption on crash)
    fs.writeFileSync(REFUND_TMP_PATH, JSON.stringify(existing, null, 2));
    fs.renameSync(REFUND_TMP_PATH, REFUND_PATH);
  });
  // Keep chain healthy for subsequent writes even if this one fails
  refundWriteLock = thisWrite.catch((err) => {
    console.error('[appendPendingRefunds] Write failed:', err);
  });
  // Propagate error to the caller of THIS write
  return thisWrite;
}

export function readPendingRefunds(): any[] {
  try {
    return JSON.parse(fs.readFileSync(REFUND_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export function findSettlement(roomCode: string, walletAddress: string, chain?: string): any | undefined {
  const refunds = readPendingRefunds();
  return refunds.find(
    (r: any) => r.type === 'settlement' && r.roomCode === roomCode &&
      (!walletAddress || r.walletAddress?.toLowerCase() === walletAddress.toLowerCase()) &&
      (!chain || (r.chain ?? 'base') === chain)
  );
}

/** Reasons that represent a cancellation (as opposed to a settlement). */
const CANCELLATION_REASONS = new Set([
  'cancellation', 'player_left_lobby', 'room_deleted', 'lobby_cancelled', 'admin_cancellation',
]);

/** Find an existing cancellation signature for a room (any player). Optionally filter by chain. */
export function findCancellation(roomCode: string, chain?: string): any | undefined {
  const refunds = readPendingRefunds();
  return refunds.find(
    (r: any) => CANCELLATION_REASONS.has(r.reason) && r.roomCode === roomCode && r.nonce && r.signature &&
      (!chain || (r.chain ?? 'base') === chain)
  );
}

// --- Room-level locking ---

const roomLocks = new Map<string, Promise<void>>();

/**
 * Acquire a per-room lock for atomic check-then-sign operations.
 * Ensures settlement/cancellation mutual exclusion is not vulnerable to TOCTOU.
 */
export async function withRoomLock<T>(roomCode: string, fn: () => Promise<T>): Promise<T> {
  const prev = roomLocks.get(roomCode) ?? Promise.resolve();
  let resolve: () => void;
  const next = new Promise<void>((r) => { resolve = r; });
  roomLocks.set(roomCode, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
    // Clean up lock entry if no one else is waiting
    if (roomLocks.get(roomCode) === next) {
      roomLocks.delete(roomCode);
    }
  }
}
