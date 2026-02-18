# Batch 14: Quick Play — Matchmaking Lobbies

## Overview
Quick Play is a matchmaking system where players pick their buy-in tier and character, then get placed into a lobby with others at the same tier. Lobbies auto-fill and launch with countdown timers.

## Investigation Summary

### Current State
- Quick Play button exists on main menu → shows "Coming soon..." placeholder
- Server has basic `findQuickPlayRoom` / `createQuickPlayRoom` in RoomManager (Solana-era, uses `entryFeeLamports`)
- Server `room:quick-play` socket handler joins existing room or creates new one
- Room type has `isQuickPlay`, `entryFeeLamports`, `buyInEth`, `isOnChain` fields
- No countdown timer logic, no matchmaking queue, no tier-based routing
- Buy-in tiers from CreateRoom: `0.001, 0.01, 0.05, 0.25, 0.5` ETH

### Key Files
- `app/page.tsx` — Quick Play placeholder (line ~205)
- `server/roomManager.ts` — `findQuickPlayRoom()`, `createQuickPlayRoom()`
- `server/index.ts` — `room:quick-play` handler (line ~607)
- `server/types.ts` — Room interface
- `components/Lobby/CreateRoom.tsx` — buy-in buttons + character picker (reuse)
- `context/SocketContext.tsx` — `quickPlay()` method exists
- `lib/contracts/monopolyGame.ts` — `createGameOnChain`, `joinGameOnChain`

### Design Decisions
- **5 buy-in tiers**: 0.001, 0.01, 0.05, 0.25, 0.5 ETH — each tier is its own matchmaking pool
- **Player cap**: 6 players max per lobby
- **Countdown triggers at 4/6**: 30-second countdown starts
- **Countdown accelerates at 6/6**: drops to 5 seconds
- **On-chain**: First player creates game on-chain, others join. All deposit before game starts.
- **Character selection**: Same picker as Create/Join room (sprite + name)
- **No room code needed**: System handles room assignment automatically

---

## Sub-batch 14.1: Quick Play UI — Character & Tier Selection
**Goal**: Replace the placeholder with a proper selection screen.

**New Component**: `components/Lobby/QuickPlay.tsx`

**UI Flow**:
1. Player sees character grid (same as JoinRoom) + name input
2. Below: 5 buy-in tier buttons (same style as CreateRoom): `0.001 | 0.01 | 0.05 | 0.25 | 0.5`
3. Balance display + insufficient funds indicator
4. "Find Match" button → initiates matchmaking

**Tasks**:
1. Create `QuickPlay.tsx` component with character picker, name input, buy-in tier selector
2. Reuse `BUY_IN_OPTIONS` array and `setupCountBtn` styling from CreateRoom
3. Add wallet balance check (same as CreateRoom — disable tiers player can't afford)
4. "Find Match" button emits `room:quick-play` with `{ name, color, buyInEth, walletAddress }`
5. Wire into `page.tsx` — replace placeholder, wrap in `SocketProvider`
6. On successful match → transition to QuickPlayLobby (14.2)

---

## Sub-batch 14.2: Quick Play Lobby — Waiting Room with Countdown
**Goal**: A lobby screen showing matched players, countdown timer, and auto-start.

**New Component**: `components/Lobby/QuickPlayLobby.tsx`

**UI Layout**:
```
┌─────────────────────────────────┐
│     QUICK PLAY — 0.01 ETH      │
│         3/6 Players             │
│                                 │
│  [Sprite] Player1  ✓ Ready      │
│  [Sprite] Player2  ✓ Ready      │
│  [Sprite] Player3  ⏳ Joining   │
│  [Empty]  Waiting...            │
│  [Empty]  Waiting...            │
│  [Empty]  Waiting...            │
│                                 │
│     ⏱ Starting in: 28s          │
│                                 │
│        [Leave Queue]            │
└─────────────────────────────────┘
```

**Tasks**:
1. Create `QuickPlayLobby.tsx` — shows player list with sprites, ready status, empty slots
2. Buy-in tier displayed prominently in header
3. Player count: "3/6 Players"
4. Countdown timer (visible once 4+ players joined)
5. "Leave Queue" button → emits `room:leave`, goes back to Quick Play selection
6. Auto-transition to game when server starts the game (listen for `game:state`)
7. Chat panel (reuse existing chat component)

---

## Sub-batch 14.3: Server — Tier-Based Matchmaking & Countdown
**Goal**: Server manages per-tier queues with countdown logic.

**Tasks**:
1. **Refactor `findQuickPlayRoom`**: Search by `buyInEth` instead of `entryFeeLamports` (Base chain)
2. **Refactor `createQuickPlayRoom`**: Accept `buyInEth`, set `room.buyInEth`, `room.maxPlayers = 6`
3. **New: `room:quick-play-base`** socket handler:
   - Check for existing quick-play room at this buy-in tier with space
   - If found → join it, emit room state
   - If not → create new quick-play room (max 6 players)
   - Color conflict: if character color taken, reject with available colors list
4. **Countdown timer logic** (in `server/index.ts`):
   - Track `countdownTimer` per room (like existing `turnTimer`)
   - When room hits **4 players** → start 30-second countdown, broadcast `quickplay:countdown` events every second
   - When room hits **6 players** → accelerate countdown to 5 seconds
   - If player leaves and drops below 4 → cancel countdown
   - When countdown hits 0 → auto-start game (same as `room:start` logic)
5. **On-chain game creation**:
   - First player to join: server calls `createGameOnChain` with game signer
   - Subsequent players: join on-chain via client wallet
   - Track on-chain status per player in room state
6. **Broadcast enhanced room state** for quick play:
   - Include `countdown: { remaining: number; total: number } | null`
   - Include `tier: string` (buy-in ETH amount)

**Socket Events** (new):
- `room:quick-play-base` — client → server (find/create match)
- `quickplay:countdown` — server → client (countdown tick)
- `quickplay:starting` — server → client (game about to start)

---

## Sub-batch 14.4: On-Chain Integration
**Goal**: Wire deposits into the quick play flow.

**Tasks**:
1. **Client-side deposit flow** in QuickPlayLobby:
   - After matched into room, prompt wallet approval for buy-in deposit
   - Call `joinGameOnChain` (or `createGameOnChain` if first player)
   - Wait for tx receipt
   - Emit `room:base-deposit` to server
   - Show "Deposit confirmed ✓" badge next to player name
2. **Server tracks deposits**:
   - Players must deposit before countdown starts counting them
   - Only deposited players count toward the 4/6 threshold
   - If countdown ends and some players haven't deposited → kick undeposited, refund/cancel if below minimum
3. **First player creates on-chain game**:
   - Server signs `createGameOnChain` with game signer for the quick-play room
   - OR: first player's client creates it, server tracks the game ID
   - Subsequent players `joinGameOnChain` client-side
4. **Leave/disconnect during matchmaking**:
   - Deposited player leaves → emit cancellation signature for refund
   - Undeposited player leaves → just remove from room, no on-chain action

---

## Sub-batch 14.5: Polish & Edge Cases
**Goal**: Smooth out the experience.

**Tasks**:
1. **Matchmaking status messages**: "Searching for players...", "Found 2/6...", "Almost full!", "Starting soon!"
2. **Sound effects**: Queue found chime, player join sound, countdown tick, countdown accelerate, match start fanfare
3. **Prevent duplicate queuing**: Player can only be in one quick-play queue at a time
4. **Handle disconnects**: If player disconnects during countdown, remove them, adjust countdown
5. **Minimum players**: Game requires at least 2 deposited players to start. If countdown ends with <2, reset and wait.
6. **Re-queue after game**: After a game ends, offer "Play Again (same tier)" button that re-queues
7. **Lobby music**: Keep menu music playing during quick play selection, stop when game starts
8. **Loading states**: Skeleton UI while searching for match
9. **Cancel search**: If no one found after 60s, show "No players found. Try a different tier?" with option to keep waiting

---

## Edge Cases
- Player picks color already taken in matched room → server rejects with error, client shows "Color taken, pick another"
- All 5 tiers have 0 players → each new player creates a fresh room for their tier
- Player disconnects after depositing but before game starts → cancellation signature + refund
- Two players queue for same tier simultaneously → both join same room (server handles race condition with room lock)
- Player tries to quick-play without wallet connected → show "Connect wallet first" error
- Countdown at 3s, player joins making it 6/6 → countdown stays at 3s (already below 5s threshold)

## File Changes Summary
| File | Changes |
|------|---------|
| `components/Lobby/QuickPlay.tsx` | **NEW** — tier selection + character picker |
| `components/Lobby/QuickPlayLobby.tsx` | **NEW** — matchmaking waiting room with countdown |
| `app/page.tsx` | Replace quick-play placeholder, wire new components |
| `server/index.ts` | New `room:quick-play-base` handler, countdown timer logic |
| `server/roomManager.ts` | Refactor quick play methods for ETH tiers |
| `server/types.ts` | Add countdown fields to Room/RoomClientState |
| `context/SocketContext.tsx` | Add `quickPlayBase()` method, countdown listener |
| `app/globals.css` | QuickPlay + QuickPlayLobby styles |
| `public/sounds/sfx/` | queue-found.mp3, countdown-tick.mp3, match-start.mp3 |

## Priority Order
1. **14.1** — UI selection screen (user-facing entry point)
2. **14.3** — Server matchmaking + countdown (core logic)
3. **14.2** — Lobby waiting room (display matched state)
4. **14.4** — On-chain deposits (payments)
5. **14.5** — Polish (nice-to-have)
