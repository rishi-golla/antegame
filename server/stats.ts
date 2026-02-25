import { db, getReferrer, recordReferralEarning } from './db';
import { roomCodeToGameId } from './contracts';

const CAMPAIGN_BOOST_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCampaignStartTime(): number {
  const env = process.env.CAMPAIGN_START_UTC;
  if (!env) return Date.now();
  const parsed = Date.parse(env);
  return isNaN(parsed) ? Date.now() : parsed;
}

export function getCampaignReferralRate(): number {
  const elapsed = Date.now() - getCampaignStartTime();
  return elapsed < CAMPAIGN_BOOST_DURATION_MS ? 0.50 : 0.10;
}

export interface GameResultData {
  roomCode?: string;
  durationMs: number;
  playerCount: number;
  players: Array<{ walletAddress: string; name: string; placing: number }>;
  winnerWallet: string;
  winnerName: string;
  entryFeeLamports: number;
  winnerPayoutLamports: number;
  houseProfitLamports: number;
}

export function recordGameResult(data: GameResultData): number {
  const insertHistory = db.prepare(`
    INSERT INTO game_history (finished_at, duration_ms, player_count, players, winner_wallet, winner_name, entry_fee_lamports, winner_payout_lamports, house_profit_lamports, room_code, game_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStats = db.prepare(`
    UPDATE stats SET
      games_played = games_played + 1,
      games_won = games_won + CASE WHEN wallet_address = ? THEN 1 ELSE 0 END,
      total_earned_lamports = total_earned_lamports + CASE WHEN wallet_address = ? THEN ? ELSE 0 END,
      total_lost_lamports = total_lost_lamports + CASE WHEN wallet_address != ? THEN ? ELSE 0 END
    WHERE wallet_address = ?
  `);

  const now = Math.floor(Date.now() / 1000);
  const playersJson = JSON.stringify(data.players);

  const run = db.transaction(() => {
    const computedGameId = data.roomCode ? roomCodeToGameId(data.roomCode) : '';
    const result = insertHistory.run(
      now,
      data.durationMs,
      data.playerCount,
      playersJson,
      data.winnerWallet,
      data.winnerName,
      data.entryFeeLamports,
      data.winnerPayoutLamports,
      data.houseProfitLamports,
      data.roomCode ?? '',
      computedGameId
    );

    for (const player of data.players) {
      updateStats.run(
        data.winnerWallet,
        data.winnerWallet,
        data.winnerPayoutLamports,
        data.winnerWallet,
        data.entryFeeLamports,
        player.walletAddress
      );
    }

    const gameId = result.lastInsertRowid as number;

    // Credit referral earnings per referred player
    // Rate: 50% of house profit during first 24h of campaign, 10% after
    // M7: Only credit referrals for games with 3+ players to prevent gaming
    if (data.houseProfitLamports > 0 && data.playerCount >= 3) {
      const referralRate = getCampaignReferralRate();
      const perPlayerShare = Math.floor(data.houseProfitLamports * referralRate / data.playerCount);
      if (perPlayerShare > 0) {
        for (const player of data.players) {
          const referrer = getReferrer(player.walletAddress);
          if (referrer) {
            recordReferralEarning(referrer, player.walletAddress, gameId, String(perPlayerShare));
          }
        }
      }
    }

    return gameId;
  });

  return run();
}

export function getLeaderboard(limit = 50) {
  return db
    .prepare(
      `SELECT s.*, u.display_name, u.character_id
       FROM stats s JOIN users u ON s.wallet_address = u.wallet_address
       ORDER BY s.games_won DESC, s.total_earned_lamports DESC
       LIMIT ?`
    )
    .all(limit);
}

export function getPlayerStats(walletAddress: string) {
  return db
    .prepare(
      `SELECT s.*, u.display_name, u.character_id
       FROM stats s JOIN users u ON s.wallet_address = u.wallet_address
       WHERE s.wallet_address = ?`
    )
    .get(walletAddress);
}

export function getPlayerHistory(walletAddress: string, limit = 20) {
  return db
    .prepare(
      `SELECT * FROM game_history
       WHERE players LIKE ?
       ORDER BY finished_at DESC
       LIMIT ?`
    )
    .all(`%${walletAddress}%`, limit);
}
