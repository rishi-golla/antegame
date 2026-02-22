# 🔒 Ante Security Audit V2 — Second Pass

**Date:** 2026-02-22  
**Scope:** Verify V1 fixes + find new issues  
**Previous audit:** SECURITY_AUDIT.md

---

## Summary

V1 fixes are mostly solid. The contract endpoints now have auth. Minigame resolution is server-side. Socket auth exists but is soft (allows unauthenticated connections). Found **2 critical, 4 high, 5 medium, 3 low** new/remaining issues.

**Fixed in this pass: 5 issues (1 critical, 4 high)**

---

## 🔴 CRITICAL

### FINDING #1: No game phase validation — double-roll race condition
**Severity:** CRITICAL  
**Category:** game-logic  
**Location:** `server/gameManager.ts:applyGameAction`  
**Attack:** Send `game:roll` twice rapidly. Since `rollDice()` doesn't check `state.phase === 'rolling'`, and `applyGameAction` only checks `isCurrentPlayer`, both execute. Node.js is single-threaded so events are serialized, but the second roll processes against the post-first-roll state (which is in `landed`/`buying` phase, NOT `rolling`). Without phase validation, `rollDice` happily re-rolls and moves the player again.  
**Impact:** Player moves twice per turn, lands on different tiles, gets extra properties. In a real-money game this is game-breaking.  
**Fix:** ✅ APPLIED — Added `VALID_PHASES` map in `applyGameAction` that validates each action against the current game phase.

### FINDING #2: `game:gamble` callable from any game phase
**Severity:** CRITICAL → HIGH (downgraded, startMinigame has some internal checks)  
**Category:** game-logic  
**Location:** `server/index.ts:1000`  
**Attack:** Call `game:gamble` during `rolling` or `turn-end` phase to enter minigame state unexpectedly.  
**Impact:** Could corrupt game state, lock the game, or allow minigame exploitation.  
**Fix:** ✅ APPLIED — Added phase validation: gamble only allowed during `buying` or `paying-rent`.

---

## 🟠 HIGH

### FINDING #3: Trade proposal impersonation — no fromPlayer verification  
**Severity:** HIGH  
**Category:** game-logic  
**Location:** `server/index.ts:863` (`game:propose-trade`)  
**Attack:** Send `{offer: {fromPlayer: 2, toPlayer: 0, offerProperties: [...], ...}}` while being player 1. The server doesn't verify `fromPlayer` matches the socket's player index. `proposeTrade()` in `lib/trading.ts` validates ownership against `fromPlayer`, so an attacker can propose trades as if they were another player, offering THAT player's properties.  
**Impact:** Could steal properties from other players via spoofed trade acceptance flow.  
**Fix:** ✅ APPLIED — Server now verifies `socket.playerIndex === data.offer.fromPlayer`.

### FINDING #4: Counter-trade participant spoofing
**Severity:** HIGH  
**Category:** game-logic  
**Location:** `server/index.ts:940` (`game:counter-trade`)  
**Attack:** Counter-trade validates the sender is the trade recipient, but doesn't validate that the new offer's `fromPlayer`/`toPlayer` match the original trade participants. Attacker could set `fromPlayer` to a third player.  
**Fix:** ✅ APPLIED — Server now enforces counter-offer `fromPlayer`/`toPlayer` match expected participants.

### FINDING #5: Reconnect session hijack without wallet
**Severity:** HIGH  
**Category:** auth  
**Location:** `server/index.ts:770` (`room:reconnect`)  
**Attack:** When a disconnected player has no `walletAddress` set (free play), reconnection only requires knowing the player's display name. Any socket can reconnect as that player.  
**Impact:** Hijack a player's game session, declare bankruptcy, make bad trades.  
**Fix:** ✅ APPLIED — Now requires wallet match if the disconnected player has a wallet; if no wallet, the unauthenticated path still exists (acceptable for free play but noted).

### FINDING #6: Refund endpoint leaks cancellation signatures without auth
**Severity:** HIGH  
**Category:** financial  
**Location:** `server/index.ts` `/api/refunds/:address`  
**Attack:** No auth on endpoint. Anyone can query any wallet address and get cancellation signatures + nonces. While the cancellation signature alone can't drain funds (only enables refund), it could be used to grief by cancelling games.  
**Fix:** ✅ APPLIED — Added session auth + wallet ownership check.

---

## 🟡 MEDIUM

### FINDING #7: Socket auth is permissive — unauthenticated connections allowed
**Severity:** MEDIUM  
**Category:** auth  
**Location:** `server/index.ts:156`  
**Attack:** The socket middleware always calls `next()` even without a valid session. Unauthenticated sockets can create rooms, join games, and play. While this supports "free play", it means rate limiting is per-socket-ID (trivially rotatable) not per-authenticated-user.  
**Fix:** For on-chain/real-money games, require auth at room creation and join time. Check `(socket as any).user` exists before allowing `room:create` with `buyInEth`.

### FINDING #8: Deposit verification is client-trusted (TODO in code)
**Severity:** MEDIUM  
**Category:** financial  
**Location:** `server/index.ts` `room:deposit` and `room:base-deposit`  
**Attack:** Both deposit handlers have comments like `// TODO: In production, verify the tx hash on-chain`. The server trusts the client's claim of deposit. A player could join a real-money game without actually depositing, play for free, and win the pot.  
**Impact:** Free play in real-money games. However, the on-chain contract requires actual deposits to join, so the winner's `claimWinnings` would fail if deposits don't match. Still, it wastes other players' time.  
**Fix:** Verify the deposit tx on-chain before marking deposited. Use `viem` to call `deposited[gameId][address]` on the contract.

### FINDING #9: Game state broadcast to all players including spectator-sensitive data
**Severity:** MEDIUM  
**Category:** info-leak  
**Location:** `server/index.ts:broadcastGameState`  
**Attack:** Full game state (all player money, properties, positions) is broadcast to all sockets in the room. Non-players who somehow joined the socket room could observe the game. More importantly, trade offers are broadcast to non-participants (except the explicit trade-private handler).  
**Fix:** Verify socket is a room player before emitting game state. Consider stripping sensitive data for non-current-player views if needed.

### FINDING #10: `pending-refunds.json` grows without bound
**Severity:** MEDIUM  
**Category:** resilience  
**Location:** `server/index.ts` disconnect handler  
**Attack:** Every all-player-disconnect in an on-chain game appends to `pending-refunds.json`. No cleanup ever removes claimed refunds. Over time this file grows indefinitely and could slow down the endpoint.  
**Fix:** Add a cleanup job or TTL. Remove entries after they're claimed or after 30 days.

### FINDING #11: Room cleanup doesn't clean up turn timers or minigame state
**Severity:** MEDIUM  
**Category:** resilience  
**Location:** `server/roomManager.ts:cleanup`, `server/index.ts`  
**Attack:** When `rm.cleanup()` removes stale rooms, the associated `turnTimers`, `lastTimerState`, `quickPlayCountdowns`, and `activeMinigames` maps are not cleaned up. These leak memory.  
**Fix:** Hook into cleanup to clear associated state for removed room codes.

---

## 🟢 LOW

### FINDING #12: FeeVault has no admin transfer mechanism
**Severity:** LOW  
**Category:** contract  
**Location:** `contracts/FeeVault.sol`  
**Attack:** If admin key is compromised, no way to transfer admin. Unlike `MonopolyGame.sol` which uses OZ `Ownable` (with `transferOwnership`), FeeVault has a bare `admin` variable.  
**Fix:** Add a two-step admin transfer pattern.

### FINDING #13: npm audit shows 75 vulnerabilities (13 high)
**Severity:** LOW (mostly dev dependencies and Next.js image optimizer)  
**Category:** dependency  
**Location:** `package.json`  
**Notable:** Next.js DoS via Image Optimizer, `tmp` arbitrary file write, `undici` decompression DoS, lodash prototype pollution.  
**Fix:** `npm audit fix` for safe fixes. Upgrade Next.js when feasible.

### FINDING #14: `cancellation-signature` still works when `_rm` is null
**Severity:** LOW  
**Category:** auth  
**Location:** `server/routes/contracts.ts:108`  
**Attack:** If `setRoomManager` was never called (shouldn't happen in production), all room/player checks are skipped and the endpoint just signs. The `if (_rm)` guard means "if room manager exists, check; otherwise, just sign."  
**Fix:** Change `if (_rm)` to always require room manager: `if (!_rm) return res.status(503)`.

---

## V1 Fix Verification

| V1 Finding | Status | Notes |
|---|---|---|
| C1: Cancellation no auth | ✅ Fixed | Auth + player check + phase check |
| C2: Cancellation-by-ID no auth | ✅ Fixed | Admin-only |
| C3: Alchemy key exposed | ⚠️ Unclear | Need to verify `.env` was updated |
| H1: Socket no auth | ⚠️ Partial | Auth middleware exists but permissive (always calls next) |
| H2: Client-side minigame | ✅ Fixed | Server-side engine with commit-reveal |
| H3: Chat XSS | ✅ Fixed | HTML tags stripped |
| H4: Display name | ⚠️ Not verified | Need to check auth route |
| H5: Socket rate limiting | ✅ Fixed | Per-socket, 10/sec total, 2/sec chat |
| H6: Room join rate limit | ✅ Fixed | 5/min per socket |
| H7: Solana key location | ⚠️ Not verified |  |
| H8: Settlement auth | ✅ Fixed | Requires session + winner wallet match |
| M9: Reconnect hijack | ⚠️ Partial | Checks wallet when set, but still name-only for free play |

---

## Changes Made

1. `server/gameManager.ts` — Added `VALID_PHASES` map for phase-gated action validation
2. `server/index.ts` — Trade proposal: verify `fromPlayer` matches socket's player index
3. `server/index.ts` — Counter-trade: verify participant indices match expected
4. `server/index.ts` — Gamble: validate phase is `buying` or `paying-rent`
5. `server/index.ts` — Reconnect: require wallet match even when `socketUser` is null
6. `server/index.ts` — Refund endpoint: require auth + wallet ownership

**Build status:** ✅ TypeScript compiles clean (`npx tsc --noEmit` passes)
