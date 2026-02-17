# Batch 9: Wallet Auth + Crypto Game

## Investigation Summary

### Current Architecture
- **Frontend:** Next.js 14 App Router, single `app/page.tsx` with screen state machine (`menu`, `local-setup`, `create`, `join`, `lobby`, `local-game`, `online-game`)
- **Backend:** Custom Express 5 server at `server/index.ts` with Socket.IO, Next.js handler mounted via `app.all('/{*path}')`
- **State:** In-memory `RoomManager` class -- `Map<string, Room>` keyed by room code. No persistence
- **Player Identity:** Ephemeral per session. `ServerPlayer` has `id` (socket ID), `name`, `color`. No user accounts
- **Socket Auth:** None. Socket connects anonymously, player identity set on room create/join
- **Character System:** 8 chibi characters defined in `lib/assetMap.ts` (`CHARACTERS` array with id, name, sprite path, color). Selected during `GameSetup` or `CreateRoom`/`JoinRoom`
- **Room Flow:** `room:create` -> lobby -> `room:start` -> game. `RoomClientState` sent to all clients on changes
- **Deps:** Express 5, React 18, Socket.IO 4, no auth/DB/crypto libraries

### Key Decision: Crypto Only
- NO free play, NO guest mode, NO local play
- Wallet connect is MANDATORY to access the game
- Every room is a crypto room with a SOL entry fee
- Landing page is: Connect Wallet -> Profile Setup (first time) -> Create/Join Room (pick entry fee)
- Removes: `GameSetup`, `local-setup`, `local-game` screens, `GameProvider` local mode

### Integration Points
- **Express server (`server/index.ts`):** Mount auth API routes, add session middleware, add wallet verification to socket handshake
- **Socket events (`server/types.ts`):** Add `walletAddress` to `ServerPlayer`, wallet required for all room events
- **Room manager (`server/roomManager.ts`):** All rooms have entry fee and pot tracking. Wallet required
- **Frontend screens (`app/page.tsx`):** Gate entire app behind wallet connect. Remove local play. Simplify to: connect -> menu -> create/join -> lobby -> game
- **Lobby UI (`CreateRoom.tsx`, `JoinRoom.tsx`, `RoomLobby.tsx`):** Entry fee selector, deposit flow, balance display
- **Game over (`GameOver.tsx`):** Show settlement with Solscan link

### Solana Integration Notes
- Existing code in `~/.openclaw/workspace/sol-sniper/` has Jupiter swap and wallet patterns -- reference but do not import
- Escrow pattern: server-controlled escrow wallet for MVP (upgrade to PDA program later)
- Wallet adapter handles wallet popup, signing, and connection state
- Signature verification: player signs a nonce message, server verifies using ed25519

---

## Batch 9.1: Database Layer

**Tasks:**

1. Install deps: `better-sqlite3`, `@types/better-sqlite3`

2. Create `server/db.ts`:
   - Initialize SQLite at `data/monopoly.db` (auto-create `data/` directory)
   - Enable WAL mode for concurrent read performance
   - Schema auto-migration on import (create tables if not exist)
   - Tables:
     - `users`: `wallet_address TEXT PRIMARY KEY`, `chain TEXT NOT NULL` (solana/evm), `display_name TEXT NOT NULL`, `character_id TEXT NOT NULL`, `created_at INTEGER NOT NULL`, `last_seen INTEGER NOT NULL`
     - `sessions`: `token TEXT PRIMARY KEY`, `wallet_address TEXT NOT NULL REFERENCES users`, `expires_at INTEGER NOT NULL`
     - `stats`: `wallet_address TEXT PRIMARY KEY REFERENCES users`, `games_played INTEGER DEFAULT 0`, `games_won INTEGER DEFAULT 0`, `total_earned_lamports INTEGER DEFAULT 0`, `total_lost_lamports INTEGER DEFAULT 0`, `minigames_played INTEGER DEFAULT 0`, `minigames_won INTEGER DEFAULT 0`, `crypto_games_played INTEGER DEFAULT 0`, `crypto_games_won INTEGER DEFAULT 0`
     - `game_history`: `id TEXT PRIMARY KEY`, `finished_at INTEGER NOT NULL`, `duration_ms INTEGER NOT NULL`, `player_count INTEGER NOT NULL`, `players TEXT NOT NULL` (JSON array), `winner_wallet TEXT`, `winner_name TEXT`, `pot_lamports INTEGER DEFAULT 0`, `is_crypto INTEGER DEFAULT 0`
   - Export helper functions: `getUser(wallet)`, `upsertUser(wallet, chain, displayName, characterId)`, `getUserStats(wallet)`, `updateLastSeen(wallet)`

3. Create `server/db/cleanup.ts`:
   - Expired session cleanup (run on server start and every hour)
   - Delete sessions where `expires_at < now`

4. Add `data/` to `.gitignore`

**Tests:**
- Database file created on first import
- Tables exist after migration
- `upsertUser` creates new user, updates existing
- `getUser` returns null for unknown wallet
- Session CRUD operations work
- Expired session cleanup removes old sessions

---

## Batch 9.2: Wallet Auth Backend

**Tasks:**

1. Install deps: `bs58` (for Solana signature decoding)

2. Create `server/auth.ts` -- session management:
   - `createSession(walletAddress)`: generates random 64-char hex token, inserts into sessions table with 30-day expiry, returns token
   - `validateSession(token)`: looks up token, checks expiry, returns user object or null. Updates `last_seen` on valid session
   - `destroySession(token)`: deletes from sessions table
   - `getSessionFromCookie(req)`: parses `monopoly_session` cookie, calls `validateSession`

3. Create `server/routes/auth.ts` -- Express router:
   - `GET /api/auth/nonce`: generates random 32-byte hex nonce, stores in memory map (nonce -> timestamp, expires in 5 min), returns `{ nonce, message: "Sign this message to log in to Monopoly Casino: <nonce>" }`
   - `POST /api/auth/verify-wallet`: body `{ walletAddress, signature, nonce, chain }`. Verifies:
     - Nonce exists and not expired (consume after use)
     - Signature is valid for the expected message using wallet's public key
     - For Solana: decode base58 signature, verify ed25519 using `@solana/web3.js` PublicKey.verify or tweetnacl
     - On success: upsert user in DB, create session, set `monopoly_session` cookie (httpOnly, sameSite lax, 30 days), return `{ user, isNewUser }`
   - `GET /api/auth/me`: reads session cookie, returns `{ user, stats }` or `{ authenticated: false }`
   - `POST /api/auth/logout`: destroys session, clears cookie
   - `PATCH /api/auth/profile`: authenticated only. Body `{ displayName?, characterId? }`. Validates: displayName 1-20 chars, characterId must be in CHARACTERS array. Updates DB
   - Rate limiting: simple in-memory map, 10 requests per minute per IP on verify-wallet and nonce endpoints

4. Mount in `server/index.ts`: `app.use('/api/auth', authRouter)` before the Next.js catch-all handler

5. Add session middleware to Express:
   - `app.use(sessionMiddleware)` that parses cookie and attaches `req.user` (or null)
   - Type augmentation for Express Request to include `user` property

**Tests:**
- Nonce generated and consumed correctly
- Valid Solana signature passes verification
- Invalid signature rejected
- Session created on successful verify
- Cookie set correctly
- `/me` returns user when authenticated, `{ authenticated: false }` when not
- Profile update validates inputs
- Rate limiting blocks after threshold

---

## Batch 9.3: Frontend Wallet Connect

**Tasks:**

1. Install deps: `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/web3.js`

2. Create `context/WalletContext.tsx`:
   - Imports Phantom, Solflare, Backpack wallet adapters
   - Wraps children in `ConnectionProvider` (RPC endpoint from env var `NEXT_PUBLIC_SOLANA_RPC` with default to mainnet-beta public RPC)
   - Wraps in `WalletProvider` with `autoConnect: true`
   - No wallet adapter default UI -- we build custom

3. Create `context/AuthContext.tsx`:
   - State: `user` (DB user object or null), `isAuthenticated` (boolean), `isLoading` (boolean), `isNewUser` (boolean)
   - On mount: call `GET /api/auth/me`. If authenticated, set user. Otherwise show connect screen
   - `connectAndSign()`:
     1. Trigger wallet connect (via wallet adapter `connect()`)
     2. Call `GET /api/auth/nonce` to get nonce + message
     3. Use wallet adapter `signMessage()` to sign the message
     4. Call `POST /api/auth/verify-wallet` with wallet address, signature (base58 encoded), nonce, chain
     5. If `isNewUser`, set flag to show profile setup screen
     6. Set user state
   - `disconnect()`: call `POST /api/auth/logout`, disconnect wallet adapter, clear state
   - `updateProfile(displayName, characterId)`: call `PATCH /api/auth/profile`, update local state
   - Expose: `user`, `isAuthenticated`, `isLoading`, `isNewUser`, `connectAndSign`, `disconnect`, `updateProfile`, `setNewUserDone`

4. Create `components/Auth/WalletButton.tsx`:
   - Fixed position top-right of screen (or in a header bar)
   - Disconnected state: gold-bordered pill button "CONNECT WALLET" with pixel font, wallet icon
   - Connected state: pill showing character sprite + truncated wallet address (first 4...last 4) + display name
   - Click when connected: dropdown menu with Profile, Leaderboard, Disconnect options
   - Casino styled: gold border, dark background, pixel font for address, Cinzel for name
   - Dropdown styled as dark card with gold dividers

5. Create `components/Auth/ProfileSetup.tsx`:
   - Full screen overlay shown when `isNewUser` is true after wallet connect
   - "Welcome to the Casino" header (Cinzel, gold)
   - Display name input (1-20 chars)
   - Character picker grid (reuse CHARACTERS from assetMap, same `.characterGrid` / `.characterCard` styling as CreateRoom)
   - "Enter the Casino" submit button
   - Calls `updateProfile()`, then `setNewUserDone()`
   - Cannot be skipped -- must pick name and character

6. Update `app/page.tsx`:
   - Wrap entire app in `WalletContext` > `AuthContext`
   - Render `WalletButton` on all screens (fixed position, always visible)
   - Render `ProfileSetup` overlay when `isNewUser` is true
   - Add `profile` and `leaderboard` screens to state machine

7. Update `app/layout.tsx`:
   - No changes needed if providers are in page.tsx (client component)

**Design rules:**
- Wallet button: `.walletBtn` -- fixed top-right, z-index above board, gold border 2px, rounded-full, dark bg
- Profile setup: reuse `.setupScreen`, `.setupCard`, `.casinoMenuCard` containers
- Character grid: reuse `.characterGrid`, `.characterCard`, `.characterCardSelected`
- All text casino themed -- Cinzel headers, Nunito body, gold accents

---

## Batch 9.4: Crypto Room Flow

All rooms are crypto rooms. No free play option exists.

**Tasks:**

1. Update `server/types.ts`:
   - Add to `ServerPlayer`: `walletAddress: string` (required, not nullable)
   - Add to `Room`: `entryFeeLamports: number`, `potLamports: number`
   - Add to `RoomClientState`: `entryFee: number` (in SOL for display), `pot: number` (in SOL), per-player deposit status
   - Update `ClientToServerEvents`:
     - `room:create` data: add `entryFeeLamports`, `walletAddress` (required)
     - `room:join` data: add `walletAddress` (required)
     - New event: `room:deposit` with tx signature

2. Update `server/roomManager.ts`:
   - `createRoom` requires `walletAddress` and `entryFeeLamports` -- reject without
   - `joinRoom` requires `walletAddress` -- reject without
   - Track pot: `potLamports = entryFeeLamports * playerCount`
   - Track deposit status per player: `deposited: boolean` on `ServerPlayer`
   - Game start blocked until all players deposited

3. Remove local play entirely from `app/page.tsx`:
   - Remove `local-setup`, `local-game` screens
   - Remove `GameSetup` import and component
   - Remove `GameProvider` local mode usage
   - Screen flow: `connect` (wallet gate) -> `menu` -> `create` / `join` -> `lobby` -> `game`
   - If not authenticated, entire app shows connect wallet screen (no menu access)

4. Update `components/Lobby/CreateRoom.tsx` (replaces CreateCryptoRoom -- all rooms are crypto):
   - Add entry fee selector: 0.01, 0.05, 0.1, 0.25, 0.5, 1 SOL -- gold chip-style buttons
   - Pot preview: "4 players x 0.1 SOL = 0.4 SOL pot" (dynamic with max players)
   - Shows connected wallet address and SOL balance
   - If balance < entry fee, disable create button with "Insufficient balance" message
   - Character auto-filled from profile (editable)
   - Name auto-filled from profile (editable)

5. Update `components/Lobby/JoinRoom.tsx`:
   - After entering room code, show room's entry fee before confirming join
   - If balance < entry fee, show warning and block join
   - Wallet address sent automatically with join event

6. Update `components/Lobby/RoomLobby.tsx`:
   - Show entry fee and current pot prominently at top (gold banner)
   - Each player row shows deposit status: pending (yellow), confirmed (green checkmark)
   - "Ready" button replaced with "Deposit & Ready" -- triggers on-chain deposit
   - Game start button (host only) disabled until all players deposited and ready
   - If player leaves, their deposit is refunded (shown in UI)

7. Update `context/SocketContext.tsx`:
   - `createRoom` and `joinRoom` always pass wallet address from auth context
   - New function: `sendDeposit(txSignature)` emits `room:deposit`

8. Create `components/Auth/ConnectScreen.tsx`:
   - Full-screen landing page shown when not authenticated
   - Casino themed: dark background, gold casino crest, game title
   - Large "CONNECT WALLET" button (gold, prominent, casino styled)
   - Supported wallets shown as small icons below (Phantom, Solflare, Backpack)
   - Brief tagline: "Stake SOL. Roll dice. Win the pot."

**Design:**
- Entry fee chips: circular gold buttons with SOL amounts, selected = bright gold glow + scale
- Balance display: monospace font, green if sufficient, red if insufficient
- Pot display: large gold text with SOL icon in lobby banner
- Connect screen: dramatic, dark, casino entrance feel -- the first thing anyone sees
- No trace of free play anywhere in the UI

---

## Batch 9.5: On-Chain Escrow + Settlement + Stats

**Tasks:**

1. Install deps: `@coral-xyz/anchor` or just `@solana/web3.js` (depending on program complexity)

2. Create `server/solana.ts`:
   - Load server keypair from env var `SOLANA_KEYPAIR` (base58 encoded private key) or file path `SOLANA_KEYPAIR_PATH`
   - Configure connection to Solana RPC (env var `SOLANA_RPC_URL`)
   - Escrow approach (simple, no custom program needed for MVP):
     - Use a server-controlled escrow wallet instead of a full program
     - Players send SOL to escrow wallet address
     - Server verifies deposits by checking transactions
     - On game over, server sends pot to winner from escrow wallet
     - Platform fee (5%) retained in escrow wallet
   - Functions:
     - `getEscrowAddress()`: returns escrow wallet public key
     - `verifyDeposit(fromWallet, expectedAmount)`: check recent transactions to escrow for matching deposit
     - `settlePot(winnerWallet, potAmount)`: send (pot - 5% fee) to winner, return tx signature
     - `refundAll(deposits: {wallet, amount}[])`: refund each player, return tx signatures
     - `getBalance(wallet)`: get SOL balance
   - Note: this is a centralized escrow for MVP. Upgrade to PDA-based program in future batch

3. Create `lib/solana-client.ts` (frontend):
   - `depositToEscrow(amount)`: uses wallet adapter to send SOL to escrow address, returns tx signature
   - `getEscrowAddress()`: fetches from server or hardcoded env var
   - `getSolBalance(wallet)`: reads balance via RPC

4. Update lobby flow for crypto rooms:
   - When player clicks "Deposit & Ready" in crypto lobby:
     1. Frontend calls `depositToEscrow(entryFee)` -- wallet popup asks to approve
     2. Frontend sends tx signature to server via `room:deposit` socket event
     3. Server calls `verifyDeposit` to confirm on-chain
     4. If verified, mark player as ready + deposited
     5. Broadcast updated room state showing deposit confirmed (green checkmark)
   - Game cannot start until all players deposited
   - If player leaves lobby before game starts, server calls refund for that player

5. Create `server/stats.ts`:
   - `recordGameResult(room, gameState)`:
     - Insert into `game_history` with all player info, winner, pot
     - For each wallet-connected player: increment `games_played`, winner gets `games_won++`
     - For crypto games: update earned/lost lamports, increment crypto game counts
   - Called from `server/index.ts` on game-over

6. Wire settlement into game over:
   - In `server/index.ts`: when game reaches `game-over` phase in a crypto room:
     1. Determine winner (last non-bankrupt player)
     2. Call `settlePot(winnerWallet, potLamports)`
     3. Emit `game:settlement` event with tx signature and amounts
     4. Call `recordGameResult`
   - If settlement tx fails: retry 3 times, then emit `game:settlement-failed` and flag for manual review

7. Create `server/routes/stats.ts` -- Express router:
   - `GET /api/stats/leaderboard`: query top 50 users by `games_won` DESC. Return array of `{ wallet, displayName, characterId, gamesPlayed, gamesWon, winRate, earnedSol }`
   - `GET /api/stats/profile/:wallet`: public profile for any wallet
   - `GET /api/stats/me`: current authenticated user stats + last 30 game history
   - Mount: `app.use('/api/stats', statsRouter)`

8. Create `components/Auth/ProfileScreen.tsx`:
   - Shows: character sprite (large), display name, wallet address (truncated + copy button)
   - Edit display name and character (inline edit, save button)
   - Stats grid: games played, won, win rate, crypto earnings (in SOL)
   - Game history table: date, players, result (won/lost), pot size
   - Casino themed card layout

9. Create `components/Auth/LeaderboardScreen.tsx`:
   - Ranked table: position, character sprite, display name, games won, win rate, SOL earned
   - Top 3: gold/silver/bronze styling with larger sprites
   - Tabs: "All Time", "This Week"
   - Casino themed: dark bg, gold headers, pixel font for ranks

10. Update `components/GameOver/GameOver.tsx`:
    - Additional section showing:
      - "Settling on-chain..." spinner during settlement
      - "Winner received X SOL" with Solscan link to tx signature
      - Pot breakdown: total pot, platform fee (5%), winner payout
      - Each player's result: +X SOL or -X SOL

11. Add to main menu: "Leaderboard" button (gold, prominent)

---

## Environment Variables (new)
```
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_KEYPAIR=<base58 encoded server keypair>
SOLANA_NETWORK=mainnet-beta  # or devnet for testing
PLATFORM_FEE_BPS=500  # 5% = 500 basis points
```

## Edge Cases
- Wallet disconnects mid-game: game continues, if they win settlement goes to their wallet regardless
- Player disconnects before game starts: server refunds their deposit after 60s timeout
- Transaction fails during deposit: player stays un-ready, can retry
- Transaction fails during settlement: server retries 3x, then flags for manual review, funds stay in escrow
- Multiple browser tabs: session cookie shared, wallet adapter handles per-tab
- Insufficient balance: rejected with error message showing required amount
- Server restart during active game: game state lost (in-memory), escrow funds safe on-chain. Need manual settlement. Future improvement: persist active rooms to DB
- Double deposit (player sends twice): server only counts first valid deposit, excess stays in escrow (manual return)
- Network congestion (Solana): use priority fees, configurable via env var

## Security
- Server keypair is ONLY authority for settlement -- players cannot self-settle
- Nonce-based signature verification prevents replay attacks
- Rate limiting on auth endpoints
- Session tokens are random 64-char hex (256 bits of entropy)
- Cookie is httpOnly -- no JS access
- Escrow wallet private key never sent to frontend
- All deposit verification is on-chain (server checks actual transactions)

## File Structure (new files)
```
data/                              (gitignored)
  monopoly.db
server/
  db.ts
  db/cleanup.ts
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
  WalletButton.tsx
  ProfileSetup.tsx
  ProfileScreen.tsx
  LeaderboardScreen.tsx
components/Lobby/
  CreateCryptoRoom.tsx
```

## Migration Path
- Replaces entire existing flow -- local play and free rooms removed
- Database auto-creates on first server start
- Wallet connect is the gate -- nothing accessible without it
- Start on devnet, flip to mainnet via env var when ready
- Old components (GameSetup, local game provider) can be deleted
