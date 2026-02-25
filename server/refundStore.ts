/**
 * Shared pending-refunds.json read/write helpers.
 * Uses a promise chain to serialize writes and prevent race conditions.
 */
import * as fs from 'fs';
import * as path from 'path';

const REFUND_PATH = path.join(process.cwd(), 'pending-refunds.json');

let refundWriteLock = Promise.resolve();

export function appendPendingRefunds(refunds: any[]): Promise<void> {
  refundWriteLock = refundWriteLock.then(async () => {
    let existing: any[] = [];
    try { existing = JSON.parse(fs.readFileSync(REFUND_PATH, 'utf8')); } catch {}
    existing.push(...refunds);
    fs.writeFileSync(REFUND_PATH, JSON.stringify(existing, null, 2));
  }).catch(err => {
    console.error('[appendPendingRefunds] Write failed:', err);
  });
  return refundWriteLock;
}

export function readPendingRefunds(): any[] {
  try {
    return JSON.parse(fs.readFileSync(REFUND_PATH, 'utf8'));
  } catch {
    return [];
  }
}

export function findSettlement(roomCode: string, walletAddress: string): any | undefined {
  const refunds = readPendingRefunds();
  return refunds.find(
    (r: any) => r.type === 'settlement' && r.roomCode === roomCode &&
      r.walletAddress?.toLowerCase() === walletAddress.toLowerCase()
  );
}

/** Find an existing cancellation signature for a room (any player). */
export function findCancellation(roomCode: string): any | undefined {
  const refunds = readPendingRefunds();
  return refunds.find(
    (r: any) => r.type !== 'settlement' && r.roomCode === roomCode && r.nonce && r.signature
  );
}
