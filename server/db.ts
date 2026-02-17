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

  CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON sessions(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_game_history_finished ON game_history(finished_at);
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

export { db };
export default db;
