/**
 * Backup the SQLite database using the online backup API.
 * Safe to run while the server is running (WAL-mode safe).
 * 
 * Run: npx tsx scripts/backup-db.ts
 * Or add to cron for automatic backups.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'monopoly.db');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');
const MAX_BACKUPS = 48; // Keep last 48 backups (2 days if hourly)

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = path.join(BACKUP_DIR, `monopoly-${timestamp}.db`);

try {
  const db = new Database(DB_PATH, { readonly: true });
  db.backup(backupPath);
  db.close();
  console.log(`✅ Backup created: ${backupPath}`);

  // Prune old backups
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('monopoly-') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (backups.length > MAX_BACKUPS) {
    for (const old of backups.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
      console.log(`🗑️  Pruned old backup: ${old}`);
    }
  }
} catch (e: any) {
  console.error(`❌ Backup failed: ${e.message}`);
  process.exit(1);
}
