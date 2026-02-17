import crypto from 'crypto';
import { db, getUser, upsertUser, updateLastSeen } from './db';
import type { DbUser } from './db';

const SESSION_DURATION_DAYS = 30;

export function createSession(walletAddress: string): string {
  const token = crypto.randomBytes(32).toString('hex'); // 64-char hex
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60;
  db.prepare('INSERT INTO sessions (token, wallet_address, expires_at) VALUES (?, ?, ?)').run(
    token,
    walletAddress,
    expiresAt
  );
  return token;
}

export function validateSession(token: string): DbUser | null {
  const now = Math.floor(Date.now() / 1000);
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON s.wallet_address = u.wallet_address
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, now) as DbUser | undefined;

  if (row) {
    updateLastSeen(row.wallet_address);
  }
  return row ?? null;
}

export function destroySession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getSessionFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session=([a-f0-9]{64})/);
  return match?.[1] ?? null;
}

// Nonce store (in-memory, 5 min TTL)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

export function createNonce(): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 5 * 60 * 1000;
  nonceStore.set(nonce, { nonce, expiresAt });
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const entry = nonceStore.get(nonce);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    nonceStore.delete(nonce);
    return false;
  }
  nonceStore.delete(nonce);
  return true;
}

// Cleanup expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of nonceStore) {
    if (now > val.expiresAt) nonceStore.delete(key);
  }
}, 60 * 1000);
