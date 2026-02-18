import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'monopoly.db');
const db = new Database(DB_PATH);

// WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Auto-migrate on import
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    chain TEXT NOT NULL DEFAULT 'solana',
    display_name TEXT,
    character_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES users(wallet_address),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stats (
    wallet_address TEXT PRIMARY KEY REFERENCES users(wallet_address),
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    total_earned_lamports INTEGER NOT NULL DEFAULT 0,
    total_lost_lamports INTEGER NOT NULL DEFAULT 0,
    minigames_played INTEGER NOT NULL DEFAULT 0,
    minigames_won INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finished_at INTEGER NOT NULL DEFAULT (unixepoch()),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    player_count INTEGER NOT NULL,
    players TEXT NOT NULL,
    winner_wallet TEXT,
    winner_name TEXT,
    entry_fee_lamports INTEGER NOT NULL DEFAULT 0,
    winner_payout_lamports INTEGER NOT NULL DEFAULT 0,
    house_profit_lamports INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS referrals (
    referee_wallet TEXT PRIMARY KEY REFERENCES users(wallet_address),
    referrer_wallet TEXT NOT NULL REFERENCES users(wallet_address),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS referral_earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_wallet TEXT NOT NULL,
    referee_wallet TEXT NOT NULL,
    game_id INTEGER NOT NULL REFERENCES game_history(id),
    amount_wei TEXT NOT NULL DEFAULT '0',
    chain TEXT NOT NULL DEFAULT 'base',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    paid_out INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON sessions(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_game_history_finished ON game_history(finished_at);
  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
  CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer ON referral_earnings(referrer_wallet);
  CREATE INDEX IF NOT EXISTS idx_referral_earnings_unpaid ON referral_earnings(paid_out) WHERE paid_out = 0;
`);

// Session cleanup
function cleanExpiredSessions() {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}

// Cleanup on start
cleanExpiredSessions();

// Cleanup hourly
setInterval(cleanExpiredSessions, 60 * 60 * 1000);

// Helpers
export interface DbUser {
  wallet_address: string;
  chain: string;
  display_name: string | null;
  character_id: string | null;
  created_at: number;
  last_seen: number;
}

export interface DbStats {
  wallet_address: string;
  games_played: number;
  games_won: number;
  total_earned_lamports: number;
  total_lost_lamports: number;
  minigames_played: number;
  minigames_won: number;
}

export function getUser(walletAddress: string): DbUser | undefined {
  return db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(walletAddress) as DbUser | undefined;
}

export function upsertUser(
  walletAddress: string,
  chain: string = 'solana',
  displayName?: string,
  characterId?: string
): DbUser {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO users (wallet_address, chain, display_name, character_id, created_at, last_seen)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, display_name),
      character_id = COALESCE(excluded.character_id, character_id),
      last_seen = excluded.last_seen
  `).run(walletAddress, chain, displayName ?? null, characterId ?? null, now, now);

  // Ensure stats row exists
  db.prepare(`
    INSERT OR IGNORE INTO stats (wallet_address) VALUES (?)
  `).run(walletAddress);

  return getUser(walletAddress)!;
}

export function getUserStats(walletAddress: string): DbStats | undefined {
  return db.prepare('SELECT * FROM stats WHERE wallet_address = ?').get(walletAddress) as DbStats | undefined;
}

export function updateLastSeen(walletAddress: string): void {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET last_seen = ? WHERE wallet_address = ?').run(now, walletAddress);
}

// --- Referrals ---

export function setReferral(refereeWallet: string, referrerWallet: string): boolean {
  // Can't refer yourself
  if (refereeWallet.toLowerCase() === referrerWallet.toLowerCase()) return false;
  // Only set once (first referrer wins)
  const existing = db.prepare('SELECT 1 FROM referrals WHERE referee_wallet = ?').get(refereeWallet);
  if (existing) return false;
  // Referrer must exist
  const referrer = getUser(referrerWallet);
  if (!referrer) return false;
  db.prepare('INSERT INTO referrals (referee_wallet, referrer_wallet) VALUES (?, ?)').run(refereeWallet, referrerWallet);
  return true;
}

export function getReferrer(refereeWallet: string): string | null {
  const row = db.prepare('SELECT referrer_wallet FROM referrals WHERE referee_wallet = ?').get(refereeWallet) as { referrer_wallet: string } | undefined;
  return row?.referrer_wallet ?? null;
}

export function getReferralCount(referrerWallet: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM referrals WHERE referrer_wallet = ?').get(referrerWallet) as { cnt: number };
  return row.cnt;
}

export function getReferrals(referrerWallet: string): Array<{ referee_wallet: string; created_at: number }> {
  return db.prepare('SELECT referee_wallet, created_at FROM referrals WHERE referrer_wallet = ? ORDER BY created_at DESC').all(referrerWallet) as any[];
}

export function recordReferralEarning(referrerWallet: string, refereeWallet: string, gameId: number, amountWei: string, chain: string = 'base'): void {
  db.prepare('INSERT INTO referral_earnings (referrer_wallet, referee_wallet, game_id, amount_wei, chain) VALUES (?, ?, ?, ?, ?)').run(referrerWallet, refereeWallet, gameId, amountWei, chain);
}

export function getReferralEarnings(referrerWallet: string): { total_wei: string; unpaid_wei: string; paid_wei: string } {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CAST(amount_wei AS INTEGER)), 0) as total,
      COALESCE(SUM(CASE WHEN paid_out = 0 THEN CAST(amount_wei AS INTEGER) ELSE 0 END), 0) as unpaid,
      COALESCE(SUM(CASE WHEN paid_out = 1 THEN CAST(amount_wei AS INTEGER) ELSE 0 END), 0) as paid
    FROM referral_earnings WHERE referrer_wallet = ?
  `).get(referrerWallet) as { total: number; unpaid: number; paid: number };
  return { total_wei: String(row.total), unpaid_wei: String(row.unpaid), paid_wei: String(row.paid) };
}

export function getUnpaidReferralPayouts(): Array<{ referrer_wallet: string; total_unpaid_wei: string }> {
  return db.prepare(`
    SELECT referrer_wallet, CAST(SUM(CAST(amount_wei AS INTEGER)) AS TEXT) as total_unpaid_wei
    FROM referral_earnings WHERE paid_out = 0
    GROUP BY referrer_wallet
    ORDER BY SUM(CAST(amount_wei AS INTEGER)) DESC
  `).all() as any[];
}

export function markReferralsPaid(referrerWallet: string): number {
  const result = db.prepare('UPDATE referral_earnings SET paid_out = 1 WHERE referrer_wallet = ? AND paid_out = 0').run(referrerWallet);
  return result.changes;
}

export { db };
export default db;
