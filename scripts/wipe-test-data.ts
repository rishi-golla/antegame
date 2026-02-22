/**
 * Wipe all test data from the database before launch.
 * Run: npx tsx scripts/wipe-test-data.ts
 * 
 * This is DESTRUCTIVE — it removes all users, games, sessions, referrals.
 * Only run this before launch on a dev/staging database.
 */

import Database from 'better-sqlite3';
import path from 'path';
import readline from 'readline';

const DB_PATH = path.join(process.cwd(), 'data', 'monopoly.db');
const db = new Database(DB_PATH);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise(r => rl.question(q, r));
}

async function main() {
  // Show current counts
  const users = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  const games = (db.prepare('SELECT COUNT(*) as c FROM game_history').get() as any).c;
  const sessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c;
  const referrals = (db.prepare('SELECT COUNT(*) as c FROM referrals').get() as any).c;
  const earnings = (db.prepare('SELECT COUNT(*) as c FROM referral_earnings').get() as any).c;

  console.log('\n📊 Current database:');
  console.log(`  Users:      ${users}`);
  console.log(`  Games:      ${games}`);
  console.log(`  Sessions:   ${sessions}`);
  console.log(`  Referrals:  ${referrals}`);
  console.log(`  Earnings:   ${earnings}`);

  const answer = await ask('\n⚠️  DELETE ALL DATA? Type "yes" to confirm: ');
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    process.exit(0);
  }

  db.pragma('foreign_keys = OFF');
  db.exec(`
    DELETE FROM referral_earnings;
    DELETE FROM referrals;
    DELETE FROM game_history;
    DELETE FROM sessions;
    DELETE FROM stats;
    DELETE FROM users;
  `);
  db.pragma('foreign_keys = ON');
  db.exec('VACUUM');

  console.log('\n✅ All data wiped. Database is clean for launch.');
  rl.close();
}

main();
