import { Router, type Request, type Response } from 'express';
import { getLeaderboard, getPlayerStats, getPlayerHistory } from '../stats';
import { getSessionFromCookie, validateSession, isAdmin } from '../auth';

const router = Router();

function parseChain(query: any): string | undefined {
  const chain = query.chain;
  if (chain === 'base' || chain === 'solana') return chain;
  return undefined;
}

// GET /api/stats/leaderboard
router.get('/leaderboard', (req: Request, res: Response) => {
  const chain = parseChain(req.query);
  const data = getLeaderboard(50, chain);
  res.json({ leaderboard: data });
});

// GET /api/stats/profile/:wallet — requires auth, only your own profile
router.get('/profile/:wallet', (req: Request, res: Response) => {
  const token = getSessionFromCookie(req.headers.cookie);
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }
  const user = validateSession(token);
  if (!user) { res.status(401).json({ error: 'Session expired' }); return; }

  const wallet = req.params.wallet as string;
  // Only allow viewing your own profile (or admin)
  if (user.wallet_address.toLowerCase() !== wallet.toLowerCase() && !isAdmin(user.wallet_address)) {
    res.status(403).json({ error: 'Can only view your own profile' });
    return;
  }

  const chain = parseChain(req.query);
  const stats = getPlayerStats(wallet, chain);
  if (!stats) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }
  const history = getPlayerHistory(wallet as string, 20, chain);
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
  const chain = parseChain(req.query);
  const stats = getPlayerStats(user.wallet_address, chain);
  const history = getPlayerHistory(user.wallet_address, 20, chain);
  res.json({ stats: stats ?? null, history });
});

export default router;
