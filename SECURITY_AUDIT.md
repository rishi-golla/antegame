# 🔒 Ante Security Audit — Pre-Launch Report

**Date:** 2026-02-22  
**Auditor:** CamBot (automated deep audit)  
**Scope:** Full stack — smart contracts, server, client, infra  
**Severity Scale:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW | ℹ️ INFO

---

## Executive Summary

The codebase has **solid fundamentals** (signature verification, nonce-based auth, reentrancy guards, key separation) but has **several critical and high-severity issues** that MUST be fixed before any real money touches this system. The smart contracts are the strongest layer; the server and API layer have the most gaps.

**Critical findings: 3 | High: 8 | Medium: 9 | Low: 7 | Info: 5**

---

## 🔴 CRITICAL — Fix Before Launch

### C1: Cancellation Signature Endpoint Has No Auth or Player Verification

**File:** `server/routes/contracts.ts` lines 70-90  
**Impact:** Anyone can request a cancellation signature for ANY game by providing a roomCode. This lets an attacker cancel an active game and trigger refunds, effectively griefing players mid-game and stealing the outcome.

```typescript
// CURRENT — no auth, no player check
router.post('/cancellation-signature', async (req, res) => {
  const { roomCode } = req.body ?? {};
  // TODO: Verify the caller is a player in this game  ← THIS TODO IS UNFIXED
  // TODO: Verify the game is in a cancellable state   ← THIS TOO
  const result = await signCancellation(roomCode);
```

**Fix:**
- Require session auth (cookie check)
- Verify the authenticated wallet is a player in this game
- Verify the game is in a cancellable state (lobby or stuck, NOT active)
- Add rate limiting

### C2: Cancellation-by-ID Endpoint Has ZERO Auth

**File:** `server/routes/contracts.ts` lines 92-110  
**Impact:** The `/cancellation-signature-by-id` endpoint accepts any `gameId` with NO authentication whatsoever. An attacker can cancel ANY on-chain game (past or present) by providing the gameId hash. This is the most dangerous endpoint in the system.

**Fix:**
- Add session auth requirement
- Verify admin-only access (this should be an admin endpoint)
- Or remove entirely — it exists for "retroactive refunds" but is extremely dangerous

### C3: Alchemy API Key Exposed as NEXT_PUBLIC

**File:** `.env`  
```
NEXT_PUBLIC_BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/kPcbUY1U22DkHU6Vr2RC7
```

**Impact:** The Alchemy API key `kPcbUY1U22DkHU6Vr2RC7` is embedded in the client bundle via `NEXT_PUBLIC_*`. Anyone viewing source can extract it and abuse your Alchemy quota (DDoS your RPC, rack up charges, or use it for their own projects).

**Fix:**
- Use a server-side RPC proxy (Next.js API route that proxies to Alchemy)
- Or use a free public RPC for client-side reads and keep the Alchemy key server-only
- Rotate this key immediately after fixing

---

## 🟠 HIGH — Fix Before Launch

### H1: Socket.IO Has No Authentication

**File:** `server/index.ts` line 88  
```typescript
cors: { origin: '*' },
```

**Impact:** There is NO Socket.IO middleware verifying that a connecting client is authenticated. Any script can connect, create rooms, join games, send chat messages, and manipulate game state. Combined with `origin: '*'`, this is wide open.

**Fix:**
- Add socket.io auth middleware that validates the session cookie
- Restrict CORS origin to your actual domain
- Rate-limit socket connections per IP

### H2: Game Logic Runs Server-Side But Trusts Client-Sent Minigame Results

**File:** `server/index.ts` line 858  
```typescript
socket.on('game:minigame-result', (data) => {
  room.gameState = resolveMinigame(room.gameState, data.tier);
```

**Impact:** The minigame tier (`win`, `close-win`, `close-loss`, `loss`, `catastrophic`) is determined entirely client-side. A player can intercept the socket event and always send `tier: 'win'` to get free properties and dodge rent. This is the #1 cheat vector.

**Fix:**
- Minigame results MUST be determined server-side
- Client sends player actions (e.g., "I clicked at position X at time T")
- Server runs the minigame logic and determines the tier
- This is a significant refactor but absolutely critical for real-money games

### H3: Chat Messages Not Sanitized for XSS

**File:** `server/index.ts` lines 596-612  
Chat messages are limited to 500 chars but not sanitized. If rendered with `dangerouslySetInnerHTML` anywhere (or in a context that interprets HTML), this is XSS.

**Current mitigation:** React escapes text by default, so this is medium-risk in practice. But if any future change renders chat as HTML, it becomes critical.

**Fix:**
- Sanitize chat input server-side (strip HTML tags at minimum)
- Validate display names too (same risk)
- Add CSP headers

### H4: Display Name Not Validated for Malicious Content

**File:** `server/routes/auth.ts` PATCH `/profile`  
```typescript
const name = displayName.trim().slice(0, 20);
if (name.length < 1) { ... }
```

Only length-checked, not content-checked. Names like `<script>alert(1)</script>` or `\n\n\n` or emoji floods would be accepted. While React escapes HTML, names appear in game logs, chat, leaderboards, and could cause layout issues.

**Fix:**
- Alphanumeric + spaces + limited special chars only
- Regex: `/^[a-zA-Z0-9 _\-\.]{1,20}$/`

### H5: No Rate Limiting on Socket Events

**File:** `server/index.ts`  
There's rate limiting on HTTP auth endpoints but NONE on socket events. A malicious client can spam `game:roll`, `chat:send`, `room:create` etc. at thousands of requests per second.

**Fix:**
- Add per-socket rate limiting (e.g., max 10 events/second)
- Add per-event rate limiting (e.g., max 2 chat messages/second)
- Disconnect sockets that exceed limits

### H6: Room Codes Are Predictable / Brute-Forceable

**File:** `server/roomManager.ts`  
Room codes are 6 characters from a 31-character alphabet = ~887M combinations. But with no rate limiting on `room:join`, an attacker can rapidly try codes to find and join active rooms uninvited.

**Fix:**
- Add rate limiting on join attempts (e.g., 5 per minute per IP)
- Consider longer codes or adding a password option for private rooms
- Log and alert on rapid join attempts

### H7: Solana Escrow Private Key Stored on Disk

**File:** `server/solana.ts`  
```typescript
const KEYPAIR_PATH = path.join(process.cwd(), 'data', 'escrow-keypair.json');
```

The Solana escrow keypair is stored as plaintext JSON in the `data/` directory. While `.gitignore` excludes `data/`, this is a private key controlling user funds sitting in a file.

**Fix:**
- Move to `~/.config/ante/keys.json` like the EVM keys
- Verify file permissions (chmod 600)
- Consider using an HSM or KMS for production
- At minimum, encrypt at rest

### H8: Settlement Signature Doesn't Verify Caller Identity

**File:** `server/routes/contracts.ts` `/settlement-signature`  
The endpoint checks that `winnerAddress` matches the game winner, but it does NOT verify that the HTTP caller is actually the winner. Anyone who knows the room code can request the settlement signature for the winner's address.

**The signature itself is safe** (only the winner's address can use it on-chain due to `msg.sender` check in the contract), but exposing signatures unnecessarily is poor practice and could leak timing information.

**Fix:**
- Require session auth
- Verify `req.user.wallet_address === winnerAddress`

---

## 🟡 MEDIUM

### M1: No HTTPS Enforcement

No helmet, no HSTS, no secure headers. In production, all traffic must be HTTPS.

**Fix:**
- Add `helmet` middleware
- Set `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`
- Ensure cookies have `secure: true` in production (currently conditional on `NODE_ENV`)

### M2: Session Token in Cookie Without Rotation

**File:** `server/auth.ts`  
Session tokens are 32-byte random hex (good), but they're never rotated. A 30-day session that never rotates increases the window for token theft.

**Fix:**
- Rotate session token on sensitive actions (profile change, settlement claim)
- Consider shorter session duration with refresh tokens

### M3: CORS Origin: '*' on Express + Socket.IO

**File:** `server/index.ts`  
Both express and socket.io accept requests from any origin. This allows any website to make authenticated requests if the user has a session cookie.

**Fix:**
- Set CORS origin to your production domain only
- `origin: ['https://ante.casino', 'http://localhost:3000']`

### M4: Database Not Encrypted at Rest

**File:** `server/db.ts`  
SQLite database stores wallet addresses, session tokens, game history, and referral data in plaintext. If the server is compromised, all data is immediately accessible.

**Fix:**
- Use SQLCipher for encrypted SQLite
- Or ensure disk encryption is enabled on the production server
- At minimum, restrict file permissions to the app user only

### M5: No Input Validation on Socket Events

Socket event handlers don't validate input types/shapes. A malicious client can send unexpected data types causing crashes or undefined behavior.

```typescript
socket.on('room:create', (data, cb) => {
  // data.name, data.color etc. are trusted without validation
```

**Fix:**
- Validate all socket input with zod or similar
- Type-check at runtime, not just TypeScript compile-time

### M6: npm Audit Shows 43 Vulnerabilities (4 High)

Notable:
- `next` 10.0.0-15.5.9: DoS via Image Optimizer, HTTP deserialization DoS
- `lodash`: Prototype pollution in `_.unset`/`_.omit`

**Fix:**
- `npm audit fix` for non-breaking fixes
- Upgrade Next.js to 16.x (breaking change but needed)
- Replace lodash with native JS where possible

### M7: Referral System Allows Gaming via Self-Created Wallets

A user can create wallet B, use wallet A's referral link, then play games between A and B to generate referral earnings for A. The 10% house fee referral means they effectively get a discount.

**Fix:**
- Minimum game count before referral earnings activate
- Only count referral earnings from games with 3+ unique players
- Monitor for wallet clusters playing only against each other

### M8: Emergency Cancel Timeout May Be Too Short

**File:** `contracts/MonopolyGame.sol`  
`EMERGENCY_TIMEOUT = 24 hours` — any player can emergency-cancel after 24h if the server goes down. This is reasonable but should be considered: a 24h server outage during a game means all funds are refundable.

**Fix:**
- This is actually fine for user protection. Just be aware.
- Ensure your server has 99.9%+ uptime with monitoring

### M9: Game State Manipulation via Reconnect

**File:** `server/index.ts` `room:reconnect`  
Reconnect takes a room code and old socket ID. If an attacker knows both (observable from the client), they could potentially hijack another player's session.

**Fix:**
- Require wallet signature for reconnection
- Or tie reconnection to the session cookie
- Don't accept raw socket IDs from the client

---

## 🟢 LOW

### L1: Server Rooms Are In-Memory Only
Game state is lost on server restart. If the server crashes mid-game with real money deposited, the on-chain funds are locked until emergency cancel (24h).

**Fix:** Persist room state to DB periodically (every action or every 30s).

### L2: No Game Replay / Audit Trail
There's no way to verify game fairness post-hoc. For a real-money game, players should be able to audit that the game logic was applied correctly.

**Fix:** Log every game action with timestamps to the database.

### L3: Chat History Limited to 100 Messages In-Memory
Not a security issue per se, but chat history is lost on server restart and limited to 100 messages.

### L4: Leaderboard Endpoint Has No Pagination
`/api/stats/leaderboard` returns up to 50 entries. Fine for now, but could become a performance issue.

### L5: `getPlayerHistory` Uses LIKE for JSON Search
```typescript
WHERE players LIKE '%${walletAddress}%'
```
This is SQL injection-safe (parameterized query), but it's a performance issue on large datasets and could return false matches.

### L6: FeeVault Has No Admin Transfer Function
If the admin key is compromised, there's no way to transfer admin to a new address. Consider adding a two-step admin transfer.

### L7: No Monitoring or Alerting
No health check endpoint, no error reporting service, no uptime monitoring.

---

## ℹ️ INFO — Observations

### I1: Smart Contracts Are Well-Written
- Reentrancy guard on all fund transfers ✅
- Nonce replay protection ✅
- Proper signature verification with EIP-191 ✅
- Fee cap at 10% (MAX_FEE_BPS = 1000) ✅
- Emergency cancel for player protection ✅
- Events for all state changes ✅

### I2: Key Management Is Good
Private keys stored in `~/.config/ante/keys.json` with permission checking. Not in `.env`, not in git. Good practice.

### I3: Auth Flow Is Solid
Nonce-based wallet auth with one-time use, 5-min expiry. Rate limited. Both EVM and Solana verification. Session cookies are httpOnly + sameSite strict.

### I4: Database Schema Is Clean
WAL mode, foreign keys enforced, proper indexes, session cleanup on timer.

### I5: Dice/Randomness Is Fine for Off-Chain
`Math.random()` is used for dice rolls and game logic. This is fine because game logic runs server-side and results are authoritative. For on-chain games, you'd need VRF, but that's not the architecture here.

---

## Priority Fix Order

1. **🔴 C1 + C2:** Lock down cancellation endpoints (30 min fix)
2. **🔴 C3:** Rotate Alchemy key, proxy RPC calls (1h fix)
3. **🟠 H2:** Server-side minigame resolution (biggest refactor, 1-2 days)
4. **🟠 H1:** Socket.IO auth + CORS lockdown (2h fix)
5. **🟠 H5:** Socket rate limiting (1h fix)
6. **🟠 H4:** Display name validation (15 min fix)
7. **🟠 H8:** Settlement endpoint auth (30 min fix)
8. **🟠 H7:** Move Solana key to secure keyfile (15 min fix)
9. **🟠 H6:** Room join rate limiting (30 min fix)
10. **🟡 M1-M9:** Medium issues (1-2 days total)

---

## Smart Contract Specific Notes

The Solidity contracts (`MonopolyGame.sol`, `FeeVault.sol`) are relatively simple and follow good patterns. Key observations:

- **No flash loan risk:** Buy-in is fixed per game, no price oracle dependency
- **No MEV risk:** Settlement is signature-gated, not first-come
- **Reentrancy:** Protected by OpenZeppelin's `ReentrancyGuard` on `claimWinnings` and `claimRefund`
- **Missing:** `claimWinnings` doesn't check `deposited[gameId][msg.sender]` — technically a player who was added to the players array but somehow didn't deposit could claim. However, `joinGame` requires deposit, so this is only exploitable if there's a bug in `joinGame` or `createGame`.
- **Consider:** Adding a `pause` mechanism for emergency situations
- **Consider:** Having contracts audited by a professional firm (Trail of Bits, OpenZeppelin, etc.) before significant TVL

---

*This audit covers the codebase as of 2026-02-22. It is not a substitute for a professional security audit, especially for the smart contracts which will hold real user funds.*
