# Batch 9: Wallet Auth + Crypto Game

## Investigation Summary

### Current Architecture
- **Frontend:** Next.js 14 App Router, single `app/page.tsx` with screen state machine
- **Backend:** Custom Express 5 server (`server/index.ts`) with Socket.IO
- **State:** In-memory `RoomManager` class, `Map<string, Room>` keyed by room code
- **Player Identity:** Ephemeral per session. `ServerPlayer` has socket ID, name, color
- **Socket Auth:** None. Socket connects anonymously
- **Character System:** 8 chibi characters in `lib/assetMap.ts` (id, name, sprite path, color)
- **Room Flow:** `room:create` -> lobby -> `room:start` -> game. Already has room codes, lobbies, ready system
- **Deps:** Express 5, React 18, Socket.IO 4, Vitest

### Key Decisions
- **Crypto only.** No free play, no guest mode, no local play
- **Wallet = account.** Connect Phantom/Solflare/Backpack = logged in
- **Two play modes:** Quick Play (matchmaking into random lobby) and Private Room (create with code, share with friends)
- **Prize:** Winner gets 2x entry fee. Losers get nothing. House keeps the rest
- **MVP escrow:** Server-controlled wallet, not a full on-chain program

### What Gets Removed
- `GameSetup` component (local play setup)
- `local-setup`, `local-game` screens from page.tsx
- Local `GameProvider` usage (all games are multiplayer)

### Integration Points
- `server/index.ts`: auth routes, session middleware, matchmaking logic, deposit verification, settlement
- `server/types.ts`: wallet on ServerPlayer, entry fee on Room, new socket events
- `server/roomManager.ts`: matchmaking queue, entry fee enforcement, deposit tracking
- `app/page.tsx`: wallet gate, new screen flow, remove local play
- `context/SocketContext.tsx`: wallet address on all room events
- Lobby components: entry fee display, deposit flow, balance checks

---

## App Flow

```
[Not Connected]
  -> ConnectScreen: "CONNECT WALLET" (full page, casino themed)
  -> Wallet popup (Phantom/Solflare/Backpack)
  -> Sign nonce message

[First Time]
  -> ProfileSetup: pick display name + character
  -> Saved to DB

[Authenticated]
  -> MainMenu:
       QUICK PLAY (pick entry fee -> auto-match into lobby)
       PRIVATE ROOM (create with code / join with code)
       PROFILE (stats, history, edit name/character)
       LEADERBOARD (rankings)

[Quick Play]
  -> Pick entry fee tier (0.05, 0.1, 0.25, 0.5, 1 SOL)
  -> Matchmaking: join existing waiting room OR create new one
  -> Auto-join lobby when enough players (2-6)
  -> Deposit & Ready
  -> Game starts when all deposited

[Private Room]
  -> Create: pick entry fee + max players -> get room code -> share
  -> Join: enter room code -> see entry fee -> join if balance sufficient
  -> Lobby with deposit & ready
  -> Game starts when host starts + all deposited

[Game Over]
  -> Winner gets 2x entry fee via on-chain settlement
  -> Losers get nothing
  -> Show Solscan tx link
  -> Stats updated
```

---

## Prize Structure

| Players | Entry | Total Pot | Winner Gets | House Keeps | House % |
|---------|-------|-----------|-------------|-------------|---------|
| 2 | 0.1 SOL | 0.2 SOL | 0.2 SOL | 0 SOL | 0% |
| 3 | 0.1 SOL | 0.3 SOL | 0.2 SOL | 0.1 SOL | 33% |
| 4 | 0.1 SOL | 0.4 SOL | 0.2 SOL | 0.2 SOL | 50% |
| 5 | 0.1 SOL | 0.5 SOL | 0.2 SOL | 0.3 SOL | 60% |
| 6 | 0.1 SOL | 0.6 SOL | 0.2 SOL | 0.4 SOL | 67% |

Winner always gets exactly 2x their entry fee. House profit scales with room size.

---

## Batch 9.1: Database Layer

**Tasks:**

1. Install `better-sqlite3`, `@types/better-sqlite3`

2. Create `server/db.ts`:
   - SQLite at `data/monopoly.db`, auto-create directory, WAL mode
   - Auto-migrate on import (create tables if not exist)
   - Tables:
     - `users`: `wallet_address TEXT PRIMARY KEY`, `chain TEXT NOT NULL`, `display_name TEXT NOT NULL`, `character_id TEXT NOT NULL`, `created_at INTEGER NOT NULL`, `last_seen INTEGER NOT NULL`
     - `sessions`: `token TEXT PRIMARY KEY`, `wallet_address TEXT NOT NULL REFERENCES users`, `expires_at INTEGER NOT NULL`
     - `stats`: `wallet_address TEXT PRIMARY KEY REFERENCES users`, `games_played INTEGER DEFAULT 0`, `games_won INTEGER DEFAULT 0`, `total_earned_lamports INTEGER DEFAULT 0`, `total_lost_lamports INTEGER DEFAULT 0`, `minigames_played INTEGER DEFAULT 0`, `minigames_won INTEGER DEFAULT 0`
     - `game_history`: `id TEXT PRIMARY KEY`, `finished_at INTEGER NOT NULL`, `duration_ms INTEGER NOT NULL`, `player_count INTEGER NOT NULL`, `players TEXT NOT NULL` (JSON), `winner_wallet TEXT`, `winner_name TEXT`, `entry_fee_lamports INTEGER NOT NULL`, `winner_payout_lamports INTEGER NOT NULL`, `house_profit_lamports INTEGER NOT NULL`
   - Helpers: `getUser(wallet)`, `upsertUser(...)`, `getUserStats(wallet)`, `updateLastSeen(wallet)`

3. Add `data/` to `.gitignore`

4. Expired session cleanup on server start + hourly interval

**Tests:**
- Tables created on first import
- User CRUD works
- Session create/validate/destroy cycle
- Expired sessions cleaned up

---

## Batch 9.2: Wallet Auth Backend

**Tasks:**

1. Install `bs58`

2. Create `server/auth.ts`:
   - `createSession(walletAddress)`: random 64-char hex token, 30-day expiry, insert to sessions table
   - `validateSession(token)`: lookup + expiry check, returns user or null, updates last_seen
   - `destroySession(token)`: delete from sessions
   - `getSessionFromCookie(req)`: parse `monopoly_session` cookie

3. Create `server/routes/auth.ts`:
   - `GET /api/auth/nonce`: random nonce, stored in memory (5 min TTL), returns `{ nonce, message }`
   - `POST /api/auth/verify-wallet`: `{ walletAddress, signature, nonce, chain }` -- verify ed25519 signature, consume nonce, upsert user, create session, set cookie, return `{ user, isNewUser }`
   - `GET /api/auth/me`: returns `{ user, stats }` or `{ authenticated: false }`
   - `POST /api/auth/logout`: destroy session, clear cookie
   - `PATCH /api/auth/profile`: update display_name and character_id (validated)
   - Rate limiting: 10 req/min per IP on verify and nonce

4. Mount in `server/index.ts` before Next.js catch-all

5. Session middleware: parse cookie, attach `req.user`

**Tests:**
- Nonce generated, consumed on use, expired after 5 min
- Valid signature passes, invalid rejected
- Session created on verify, cookie set
- Profile update validates character_id against CHARACTERS array

---

## Batch 9.3: Frontend Wallet Connect

**Tasks:**

1. Install `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/web3.js`

2. Create `context/WalletContext.tsx`:
   - Phantom, Solflare, Backpack adapters
   - `ConnectionProvider` with RPC from `NEXT_PUBLIC_SOLANA_RPC` env var
   - `WalletProvider` with `autoConnect: true`

3. Create `context/AuthContext.tsx`:
   - State: `user`, `isAuthenticated`, `isLoading`, `isNewUser`
   - On mount: `GET /api/auth/me` to resume session
   - `connectAndSign()`: connect wallet -> get nonce -> sign message -> verify -> set user
   - `disconnect()`: logout API call, disconnect wallet, clear state
   - `updateProfile(displayName, characterId)`: PATCH call
   - Expose all state + actions

4. Create `components/Auth/ConnectScreen.tsx`:
   - Full-page landing. Casino themed: dark bg, gold crest, game title
   - "CONNECT WALLET" large gold button
   - Wallet icons below (Phantom, Solflare, Backpack)
   - Tagline: "Stake SOL. Roll dice. Win the pot."
   - This is the FIRST thing anyone sees

5. Create `components/Auth/ProfileSetup.tsx`:
   - Shown once on first wallet connect (`isNewUser` flag)
   - "Welcome to the Casino" header
   - Display name input + character picker grid (reuse CHARACTERS + existing CSS)
   - "Enter the Casino" submit button
   - Cannot be skipped

6. Create `components/Auth/WalletButton.tsx`:
   - Fixed top-right on all authenticated screens
   - Connected: pill with character sprite + truncated address + display name
   - Click: dropdown with Profile, Leaderboard, Disconnect
   - Casino styled: gold border, dark bg

7. Update `app/page.tsx`:
   - Wrap in `WalletContext` > `AuthContext`
   - If not authenticated: show `ConnectScreen` (nothing else accessible)
   - If `isNewUser`: show `ProfileSetup` overlay
   - If authenticated: show main menu
   - Remove `local-setup`, `local-game` screens
   - Remove `GameSetup` import
   - New screens: `menu`, `quick-play`, `create`, `join`, `lobby`, `game`, `profile`, `leaderboard`

**Design:**
- ConnectScreen: dramatic, dark, full-bleed. Gold crest centered. Single CTA button
- ProfileSetup: `.setupCard` / `.casinoMenuCard` container, `.characterGrid` for picker
- WalletButton: `.walletBtn` fixed top-right, z-index above everything

---

## Batch 9.4: Matchmaking + Room Flow

**Tasks:**

1. Update `server/types.ts`:
   - `ServerPlayer`: add `walletAddress: string` (required), `deposited: boolean`
   - `Room`: add `entryFeeLamports: number`, `potLamports: number`, `isQuickPlay: boolean`
   - `RoomClientState`: add `entryFee: number` (SOL), `pot: number` (SOL), per-player deposit status, `isQuickPlay`
   - New `ClientToServerEvents`:
     - `room:create`: add `entryFeeLamports`, `walletAddress` (required)
     - `room:join`: add `walletAddress` (required)
     - `room:quick-play`: `{ entryFeeLamports, walletAddress, name, color }` -- join or create
     - `room:deposit`: `{ txSignature }` -- confirm on-chain deposit
   - New `ServerToClientEvents`:
     - `room:deposit-confirmed`: `{ playerIndex }` -- broadcast deposit confirmation
     - `game:settlement`: `{ txSignature, winnerPayout, houseProfit }`

2. Update `server/roomManager.ts`:
   - All rooms require `walletAddress` and `entryFeeLamports`
   - `deposited` flag on each `ServerPlayer`, default false
   - New method `findQuickPlayRoom(entryFeeLamports)`: finds a waiting room with matching entry fee that has space, or returns null
   - `createRoom` sets `isQuickPlay` flag
   - Game start blocked until all players have `deposited: true` and `ready: true`
   - Quick play rooms: auto-start when full (max players reached + all deposited)
   - Private rooms: host starts manually when ready

3. Create matchmaking logic in `server/index.ts`:
   - Handle `room:quick-play` event:
     1. Find existing quick play room with same entry fee that has space
     2. If found, join it
     3. If not found, create new quick play room (max 4 players default)
     4. Return room state to player
   - Quick play rooms auto-start when 4 players joined and all deposited
   - If only 2-3 players after 60s waiting, start anyway (minimum 2)

4. Update `app/page.tsx` main menu:
   - Two big buttons:
     - "QUICK PLAY" (gold, prominent) -- pick entry fee then matchmake
     - "PRIVATE ROOM" (slightly smaller) -- create or join with code
   - Below: "Profile" and "Leaderboard" links
   - SOL balance shown in wallet button

5. Create `components/QuickPlay/QuickPlayScreen.tsx`:
   - Entry fee tier selector: 0.05, 0.1, 0.25, 0.5, 1 SOL as gold chip buttons
   - Each chip shows: fee amount + "Prize: X SOL" (2x fee)
   - Shows wallet balance, disables chips player can't afford
   - "FIND GAME" button -- triggers matchmaking
   - Loading state: "Searching for players..." with casino spinner
   - Auto-transitions to lobby when matched

6. Update `components/Lobby/CreateRoom.tsx`:
   - Add entry fee selector (same chips as QuickPlay)
   - Pot preview: "4 players x 0.1 SOL = 0.4 SOL pot | Winner: 0.2 SOL"
   - Wallet balance shown
   - Name + character auto-filled from profile
   - Disable create if balance < entry fee

7. Update `components/Lobby/JoinRoom.tsx`:
   - After entering code, show room's entry fee
   - Block join if balance < entry fee

8. Update `components/Lobby/RoomLobby.tsx`:
   - Gold banner at top: "Entry: 0.1 SOL | Prize: 0.2 SOL"
   - Each player row: name, character, deposit status (yellow pending / green confirmed)
   - "Deposit & Ready" button triggers wallet transaction
   - Quick play rooms: auto-start when full. Show countdown "Starting in 5..."
   - Private rooms: host start button, disabled until all deposited
   - If player leaves pre-game: refund their deposit (shown in UI)

9. Update `context/SocketContext.tsx`:
   - All room functions pass `walletAddress` from auth context
   - New `quickPlay(entryFeeLamports)` function
   - New `sendDeposit(txSignature)` function

**Design:**
- Quick Play screen: big gold chips, casino vibe, "FIND GAME" as main CTA
- Entry fee chips: circular, gold border, selected = bright glow + scale up
- Balance: monospace, green if sufficient, red if not
- Matchmaking spinner: pixel art dice or slot reel animation
- Lobby deposit status: checkmark icons, green/yellow colors

---

## Batch 9.5: Escrow + Settlement + Stats + Leaderboard

**Tasks:**

1. Create `server/solana.ts`:
   - Load server keypair from `SOLANA_KEYPAIR` env var (base58) or `SOLANA_KEYPAIR_PATH` file
   - Connect to `SOLANA_RPC_URL`
   - MVP approach: server-controlled escrow wallet (not a program)
   - Functions:
     - `getEscrowAddress()`: returns escrow public key
     - `verifyDeposit(fromWallet, expectedLamports)`: check recent txs to escrow for matching amount
     - `settlePot(winnerWallet, entryFeeLamports)`: send 2x entry fee to winner, return tx signature
     - `refundPlayer(playerWallet, amount)`: refund a single player, return tx signature
     - `getBalance(wallet)`: get SOL balance
   - Retry logic: 3 attempts with exponential backoff on settlement failures
   - Failed settlements flagged in DB for manual review

2. Create `lib/solana-client.ts` (frontend):
   - `depositToEscrow(amount)`: wallet adapter sends SOL to escrow address, returns tx signature
   - `getEscrowAddress()`: from env var `NEXT_PUBLIC_ESCROW_ADDRESS`
   - `getSolBalance(wallet)`: read via RPC

3. Wire deposit flow:
   - Player clicks "Deposit & Ready" -> `depositToEscrow(entryFee)` -> wallet popup
   - On tx confirm, send `room:deposit` with tx signature to server
   - Server calls `verifyDeposit` -> if valid, mark player deposited, broadcast confirmation
   - If verify fails, tell player to retry

4. Wire settlement:
   - In `server/index.ts`, on game-over:
     1. Determine winner (last non-bankrupt)
     2. Calculate: winnerPayout = 2 * entryFeeLamports, houseProfit = potLamports - winnerPayout
     3. Call `settlePot(winnerWallet, entryFeeLamports)`
     4. Emit `game:settlement` with tx signature, amounts
     5. Record game result in DB
   - If settlement fails after 3 retries: emit `game:settlement-failed`, flag in DB

5. Wire refunds:
   - Player leaves lobby before game starts: server calls `refundPlayer`, updates room state
   - Room cancelled (host leaves with no one else): refund all deposited players
   - Quick play room timeout (no one joins in 5 min): refund and close

6. Create `server/stats.ts`:
   - `recordGameResult(room, gameState)`: insert game_history, update stats for all players
   - Winner: games_won++, total_earned += winnerPayout
   - Losers: total_lost += entryFee
   - All: games_played++

7. Create `server/routes/stats.ts`:
   - `GET /api/stats/leaderboard`: top 50 by games_won, returns wallet, displayName, characterId, gamesPlayed, gamesWon, winRate, totalEarnedSol
   - `GET /api/stats/profile/:wallet`: public profile
   - `GET /api/stats/me`: current user stats + last 30 games
   - Mount: `app.use('/api/stats', statsRouter)`

8. Create `components/Auth/ProfileScreen.tsx`:
   - Character sprite (large), display name, wallet (truncated + copy)
   - Edit name + character inline
   - Stats grid: games played, won, win rate, SOL earned, SOL lost, net profit
   - Game history table: date, players, result, entry fee, payout

9. Create `components/Auth/LeaderboardScreen.tsx`:
   - Ranked table: position, sprite, name, games won, win rate, SOL earned
   - Top 3: gold/silver/bronze with larger rows
   - Tabs: "All Time", "This Week"
   - Casino themed: dark bg, gold headers

10. Update `components/GameOver/GameOver.tsx`:
    - Settlement section:
      - "Settling on-chain..." spinner during tx
      - "Winner received X SOL" with Solscan link
      - Breakdown: pot, winner payout (2x entry), house profit
      - Each player: "+X SOL" (green) or "-X SOL" (red)
    - "Play Again" -> back to menu

---

## Environment Variables
```
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_ESCROW_ADDRESS=<escrow wallet public key>
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_KEYPAIR=<base58 encoded server/escrow keypair>
SOLANA_NETWORK=mainnet-beta
WINNER_MULTIPLIER=2
```

## Edge Cases
- Wallet disconnects mid-game: game continues, settlement goes to their wallet regardless
- Player disconnects from lobby before game: refund deposit after 60s
- Transaction fails during deposit: player stays un-ready, can retry
- Transaction fails during settlement: retry 3x, then flag for manual review
- Insufficient balance on join/create: blocked with error showing required amount
- Server restart mid-game: game state lost, escrow funds safe on-chain, manual settlement needed
- Double deposit: server only counts first valid one
- 2-player rooms: winner gets 2x = full pot, house gets 0 (break even). Minimum viable game
- Quick play timeout: if room has 2+ players after 60s waiting, start. If only 1 after 5 min, refund and close
- Network congestion: configurable priority fees via env var

## Security
- Server keypair is only settlement authority
- Nonce-based signature verification (no replay attacks)
- Rate limiting on auth endpoints
- Session tokens: 64-char hex (256 bits entropy)
- httpOnly cookies
- Escrow key never sent to frontend
- All deposits verified on-chain

## File Structure (new files)
```
data/                              (gitignored)
  monopoly.db
server/
  db.ts
  auth.ts
  solana.ts
  stats.ts
  routes/
    auth.ts
    stats.ts
context/
  WalletContext.tsx
  AuthContext.tsx
lib/
  solana-client.ts
components/Auth/
  ConnectScreen.tsx
  WalletButton.tsx
  ProfileSetup.tsx
  ProfileScreen.tsx
  LeaderboardScreen.tsx
components/QuickPlay/
  QuickPlayScreen.tsx
```

## Migration
- Replaces entire existing flow. Local play removed
- Wallet connect gates everything. No anonymous access
- Database auto-creates on first run
- Start on devnet, flip to mainnet via env var
- Old components to delete: `GameSetup.tsx`, local GameProvider logic
