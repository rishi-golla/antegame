import { Router, type Request, type Response } from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  createNonce,
  consumeNonce,
  createSession,
  validateSession,
  destroySession,
  getSessionFromCookie,
} from '../auth';
import { upsertUser, getUser, getUserStats, db } from '../db';
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

// GET /api/auth/nonce
router.get('/nonce', (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (!rateLimit(`nonce:${ip}`, 10, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }
  const nonce = createNonce();
  res.json({ nonce });
});

// POST /api/auth/verify-wallet
router.post('/verify-wallet', (req: Request, res: Response) => {
  const ip = req.ip ?? 'unknown';
  if (!rateLimit(`verify:${ip}`, 10, 60000)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const { walletAddress, signature, nonce } = req.body as {
    walletAddress?: string;
    signature?: string;
    nonce?: string;
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

  // Verify ed25519 signature
  try {
    const message = new TextEncoder().encode(
      `Sign this message to connect to Monopoly Casino.\n\nNonce: ${nonce}`
    );
    const publicKey = bs58.decode(walletAddress);
    const sig = bs58.decode(signature);
    const valid = nacl.sign.detached.verify(message, sig, publicKey);

    if (!valid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Upsert user and create session
  const user = upsertUser(walletAddress, 'solana');
  const token = createSession(walletAddress);

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
  res.clearCookie('session', { path: '/' });
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
    db.prepare('UPDATE users SET display_name = ? WHERE wallet_address = ?').run(name, user.wallet_address);
  }

  if (characterId !== undefined) {
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
