import { Router, type Request, type Response } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { verifyMessage } from 'viem';
import {
  createNonce,
  consumeNonce,
  createSession,
  validateSession,
  destroySession,
  getSessionFromCookie,
  isAdmin,
} from '../auth';
import { upsertUser, getUser, getUserStats, setReferral, getReferrer, getReferralCount, getReferrals, getReferralEarnings, getUnpaidReferralPayouts, markReferralsPaid, getCampaignLeaderboard, db } from '../db';
import type { DbUser } from '../db';

const router = Router();

// Simple in-memory rate limiter
const rateLimits = new Map<string, number[]>();
function rateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = rateLimits.get(key) ?? [];
  const recent = hits.filter((t) => now - t < windowMs);
  if (recent.length >= maxReqs) return false;
  recent.push(now);
  rateLimits.set(key, recent);
  return true;
}

// Cleanup rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateLimits) {
    const recent = hits.filter((t) => now - t < 60000);
    if (recent.length === 0) rateLimits.delete(key);
    else rateLimits.set(key, recent);
  }
}, 60000);

function nonceMessage(nonce: string): string {
  return `Sign this message to connect to Ante Casino.\n\nNonce: ${nonce}`;
}

// GET /api/auth/nonce
router.get('/nonce', (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (!rateLimit(`nonce:${ip}`, 10, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  const nonce = createNonce();
  res.json({ nonce, message: nonceMessage(nonce) });
});

// POST /api/auth/verify-wallet
router.post('/verify-wallet', async (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (!rateLimit(`verify:${ip}`, 10, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { walletAddress, signature, nonce, chain, ref } = req.body as {
    walletAddress?: string;
    signature?: string;
    nonce?: string;
    chain?: string;
    ref?: string;
  };

  if (!walletAddress || !signature || !nonce) {
    res.status(400).json({ error: 'Missing walletAddress, signature, or nonce' });
    return;
  }

  // Consume nonce (one-time use)
  if (!consumeNonce(nonce)) {
    res.status(400).json({ error: 'Invalid or expired nonce' });
    return;
  }

  const message = nonceMessage(nonce);
  const resolvedChain = chain === 'base' ? 'base' : 'solana';

  if (resolvedChain === 'base') {
    // EVM: EIP-191 personal_sign verification
    try {
      const valid = await verifyMessage({
        address: walletAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
      if (!valid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  } else {
    // Solana: Ed25519 verification
    try {
      const msgBytes = new TextEncoder().encode(message);
      const publicKey = bs58.decode(walletAddress);
      const sig = bs58.decode(signature);
      const valid = nacl.sign.detached.verify(msgBytes, sig, publicKey);
      if (!valid) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    } catch {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  // Upsert user and create session
  const user = upsertUser(walletAddress, resolvedChain);
  const isNewUser = !user.display_name;
  const token = createSession(walletAddress);

  // Track referral (setReferral prevents duplicates and self-referral)
  const isValidRef = (r: string) =>
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r) || /^0x[0-9a-fA-F]{40}$/.test(r);
  if (ref && typeof ref === 'string' && isValidRef(ref)) {
    setReferral(walletAddress, ref);
  }

  res.cookie('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });

  res.json({
    user: {
      walletAddress: user.wallet_address,
      displayName: user.display_name,
      characterId: user.character_id,
      chain: user.chain,
    },
    isNewUser,
  });
});

// GET /api/auth/me
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

  const stats = getUserStats(user.wallet_address);
  res.json({
    user: {
      walletAddress: user.wallet_address,
      displayName: user.display_name,
      characterId: user.character_id,
      chain: user.chain,
    },
    stats: stats ?? null,
  });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const token = getSessionFromCookie(req.headers.cookie);
  if (token) {
    destroySession(token);
  }
  res.clearCookie('session', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ ok: true });
});

// PATCH /api/auth/profile
router.patch('/profile', (req: Request, res: Response) => {
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

  const { displayName, characterId } = req.body as {
    displayName?: string;
    characterId?: string;
  };

  if (displayName !== undefined) {
    const name = displayName.trim().slice(0, 20);
    if (name.length < 1) {
      res.status(400).json({ error: 'Display name too short' });
      return;
    }
    // H4: Validate display name content
    if (!/^[a-zA-Z0-9 _\-\.]{1,20}$/.test(name)) {
      res.status(400).json({ error: 'Display name can only contain letters, numbers, spaces, hyphens, underscores, and dots' });
      return;
    }
    db.prepare('UPDATE users SET display_name = ? WHERE wallet_address = ?').run(name, user.wallet_address);
  }

  if (characterId !== undefined) {
    const VALID_CHARACTER_IDS = ['high-roller', 'singer', 'dealer', 'mobster', 'tourist', 'card-shark', 'vip', 'bartender'];
    if (!VALID_CHARACTER_IDS.includes(characterId)) {
      res.status(400).json({ error: 'Invalid character ID' });
      return;
    }
    db.prepare('UPDATE users SET character_id = ? WHERE wallet_address = ?').run(characterId, user.wallet_address);
  }

  const updated = getUser(user.wallet_address);
  res.json({
    user: {
      walletAddress: updated!.wallet_address,
      displayName: updated!.display_name,
      characterId: updated!.character_id,
      chain: updated!.chain,
    },
  });
});

// GET /api/auth/referrals — get my referral stats
router.get('/referrals', (req: Request, res: Response) => {
  const token = getSessionFromCookie(req.headers.cookie);
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }
  const user = validateSession(token);
  if (!user) { res.status(401).json({ error: 'Session expired' }); return; }

  const count = getReferralCount(user.wallet_address);
  const referrals = getReferrals(user.wallet_address);
  const earnings = getReferralEarnings(user.wallet_address);
  const myReferrerWallet = getReferrer(user.wallet_address);
  let referredBy: { wallet: string; displayName: string | null } | null = null;
  if (myReferrerWallet) {
    const referrerUser = getUser(myReferrerWallet);
    referredBy = { wallet: myReferrerWallet, displayName: referrerUser?.display_name ?? null };
  }

  // Enrich referral list with display names
  const enriched = referrals.map(r => {
    const u = getUser(r.referee_wallet);
    return { wallet: r.referee_wallet, name: u?.display_name ?? null, joinedAt: r.created_at };
  });

  res.json({
    referralCode: user.wallet_address,
    referredBy,
    count,
    referrals: enriched,
    earnings: {
      totalWei: earnings.total_wei,
      unpaidWei: earnings.unpaid_wei,
      paidWei: earnings.paid_wei,
    },
  });
});

// GET /api/auth/referrals/payouts — admin: get all unpaid referral payouts
router.get('/referrals/payouts', (req: Request, res: Response) => {
  const token = getSessionFromCookie(req.headers.cookie);
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }
  const user = validateSession(token);
  if (!user) { res.status(401).json({ error: 'Session expired' }); return; }

  // Only allow your wallet (admin check)
  if (!isAdmin(user.wallet_address)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const payouts = getUnpaidReferralPayouts();
  res.json({ payouts });
});

// POST /api/auth/referrals/mark-paid — admin: mark a referrer as paid
router.post('/referrals/mark-paid', (req: Request, res: Response) => {
  const token = getSessionFromCookie(req.headers.cookie);
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }
  const user = validateSession(token);
  if (!user) { res.status(401).json({ error: 'Session expired' }); return; }

  if (!isAdmin(user.wallet_address)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { referrerWallet } = req.body as { referrerWallet?: string };
  if (!referrerWallet) { res.status(400).json({ error: 'Missing referrerWallet' }); return; }

  const count = markReferralsPaid(referrerWallet);
  res.json({ marked: count });
});

// GET /api/auth/referrals/campaign — campaign leaderboard (public)
router.get('/referrals/campaign', (_req: Request, res: Response) => {
  const campaignEnv = process.env.CAMPAIGN_START_UTC;
  const campaignStartMs = campaignEnv ? Date.parse(campaignEnv) : NaN;

  if (!campaignEnv || isNaN(campaignStartMs)) {
    res.json({ active: false, phase: 'none', leaderboard: [] });
    return;
  }

  const BOOST_DURATION_MS = 24 * 60 * 60 * 1000;
  const CAMPAIGN_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  const campaignEndMs = campaignStartMs + CAMPAIGN_DURATION_MS;
  const now = Date.now();

  let phase: 'upcoming' | 'boost' | 'normal' | 'ended';
  if (now < campaignStartMs) {
    phase = 'upcoming';
  } else if (now < campaignStartMs + BOOST_DURATION_MS) {
    phase = 'boost';
  } else if (now < campaignEndMs) {
    phase = 'normal';
  } else {
    phase = 'ended';
  }

  const startUnix = Math.floor(campaignStartMs / 1000);
  const endUnix = Math.floor(campaignEndMs / 1000);
  const leaderboard = getCampaignLeaderboard(startUnix, endUnix);

  res.json({
    active: phase === 'boost' || phase === 'normal',
    phase,
    campaignStartUtc: new Date(campaignStartMs).toISOString(),
    campaignEndUtc: new Date(campaignEndMs).toISOString(),
    boostEndsUtc: new Date(campaignStartMs + BOOST_DURATION_MS).toISOString(),
    timeRemainingMs: Math.max(0, campaignEndMs - now),
    boostTimeRemainingMs: Math.max(0, campaignStartMs + BOOST_DURATION_MS - now),
    referralRatePercent: phase === 'boost' ? 50 : 10,
    leaderboard,
  });
});

// Session middleware helper
export function sessionMiddleware(req: Request, _res: Response, next: () => void) {
  const token = getSessionFromCookie(req.headers.cookie);
  if (token) {
    const user = validateSession(token);
    if (user) {
      (req as any).user = user;
    }
  }
  next();
}

export default router;
