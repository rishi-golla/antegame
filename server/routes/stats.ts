import { Router, type Request, type Response } from 'express';
import { getLeaderboard, getPlayerStats, getPlayerHistory } from '../stats';
import { getSessionFromCookie, validateSession } from '../auth';

const router = Router();

// GET /api/stats/leaderboard
router.get('/leaderboard', (_req: Request, res: Response) => {
  const data = getLeaderboard(50);
  res.json({ leaderboard: data });
});

// GET /api/stats/profile/:wallet
router.get('/profile/:wallet', (req: Request, res: Response) => {
  const wallet = req.params.wallet as string;
  const stats = getPlayerStats(wallet);
  if (!stats) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }
  const history = getPlayerHistory(wallet as string);
  res.json({ stats, history });
});

// GET /api/stats/me
router.get('/me', (req: Request, res: Response) => {
  const token = getSessionFromCookie(req.headers.cookie);
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = validateSession(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  const stats = getPlayerStats(user.wallet_address);
  const history = getPlayerHistory(user.wallet_address);
  res.json({ stats: stats ?? null, history });
});

export default router;
