# Batch 9: Wallet Auth + Crypto Rooms

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

### Integration Points
- **Express server (`server/index.ts`):** Mount auth API routes, add session middleware, add wallet verification to socket handshake
- **Socket events (`server/types.ts`):** Add `walletAddress` to `ServerPlayer`, add wallet fields to `ClientToServerEvents`
- **Room manager (`server/roomManager.ts`):** Support crypto room type with entry fee, pot tracking, wallet requirement enforcement
- **Frontend screens (`app/page.tsx`):** Add wallet button to all screens, add profile-setup screen, split menu into free/crypto sections
- **Lobby UI (`CreateRoom.tsx`, `JoinRoom.tsx`, `RoomLobby.tsx`):** Add crypto room creation with fee selector, deposit flow in lobby
- **Game over (`GameOver.tsx`):** Show settlement status for crypto games

### Solana Integration Notes
- Existing code in `~/.openclaw/workspace/sol-sniper/` has Jupiter swap and wallet patterns -- reference but do not import
- Escrow pattern: PDA (Program Derived Address) holds funds, server keypair is settlement authority
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
   - `GET /api/auth/me`: reads session cookie, returns `{ user, stats }` or `{ guest: true }`
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
- `/me` returns user when authenticated, guest when not
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
   - State: `user` (DB user object or null), `isGuest` (boolean), `isLoading` (boolean), `isNewUser` (boolean)
   - On mount: call `GET /api/auth/me`. If authenticated, set user. Otherwise guest
   - `connectAndSign()`:
     1. Trigger wallet connect (via wallet adapter `connect()`)
     2. Call `GET /api/auth/nonce` to get nonce + message
     3. Use wallet adapter `signMessage()` to sign the message
     4. Call `POST /api/auth/verify-wallet` with wallet address, signature (base58 encoded), nonce, chain
     5. If `isNewUser`, set flag to show profile setup screen
     6. Set user state
   - `disconnect()`: call `POST /api/auth/logout`, disconnect wallet adapter, clear state
   - `updateProfile(displayName, characterId)`: call `PATCH /api/auth/profile`, update local state
   - Expose: `user`, `isGuest`, `isLoading`, `isNewUser`, `connectAndSign`, `disconnect`, `updateProfile`, `setNewUserDone`

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

## Batch 9.4: Room Types (Free vs Crypto)

**Tasks:**

1. Update `server/types.ts`:
   - Add to `ServerPlayer`: `walletAddress: string | null`
   - Add to `Room`: `isCrypto: boolean`, `entryFeeLamports: number`, `potLamports: number`
   - Add to `RoomClientState`: `isCrypto: boolean`, `entryFee: number` (in SOL for display), `pot: number` (in SOL), player wallet connection status
   - Add to `ClientToServerEvents`:
     - Update `room:create` data: add `isCrypto`, `entryFeeLamports`, `walletAddress`
     - Update `room:join` data: add `walletAddress`

2. Update `server/roomManager.ts`:
   - `createRoom` accepts crypto params. If `isCrypto`, validates wallet provided
   - `joinRoom` validates: if room is crypto, joining player must provide wallet
   - Track pot: `potLamports = entryFeeLamports * playerCount` (calculated, not stored incrementally)
   - New method: `isPlayerWalletConnected(roomCode, socketId)` -- checks if player has wallet

3. Update main menu in `app/page.tsx`:
   - Restructure menu card:
     - "FREE PLAY" section header (green): Create Room, Join Room, Local Play
     - "CRYPTO ROOMS" section header (gold): Create Crypto Room, Join Crypto Room
     - Crypto section has small "Wallet required" note
     - If wallet not connected, crypto buttons show lock icon and trigger wallet connect on click

4. Create `components/Lobby/CreateCryptoRoom.tsx`:
   - Similar to CreateRoom but with entry fee selector
   - Entry fee tiers: 0.01, 0.05, 0.1, 0.25, 0.5, 1 SOL -- displayed as gold chip buttons
   - Pot preview: "4 players x 0.1 SOL = 0.4 SOL pot" (updates with max players selection)
   - Shows connected wallet address and SOL balance
   - If balance < entry fee, show warning and disable create
   - Character selection same as CreateRoom
   - Calls `createRoom` with `isCrypto: true, entryFeeLamports, walletAddress`

5. Update `components/Lobby/JoinRoom.tsx`:
   - When joining a crypto room, show entry fee and required balance
   - If wallet not connected, prompt to connect first
   - Pass wallet address in join event

6. Update `components/Lobby/RoomLobby.tsx`:
   - For crypto rooms:
     - Show entry fee and current pot prominently (gold text)
     - Each player row shows wallet connection status (green dot = connected, red = not)
     - "Ready" button text changes to "Deposit & Ready" for crypto rooms
     - For now: "Deposit & Ready" just marks ready (actual on-chain deposit in Batch 9.5)
     - Show banner: "Crypto Room -- Entry: 0.1 SOL" at top of lobby

7. Update `context/SocketContext.tsx`:
   - `createRoom` function passes wallet address from auth context
   - `joinRoom` function passes wallet address

**Design:**
- Crypto room indicators: gold border instead of standard border, small SOL icon
- Entry fee chips: circular buttons with SOL amounts, selected = gold glow
- Balance display: monospace font, green if sufficient, red if insufficient
- Pot display: large gold text with coin icon

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
   - Tabs: "All Time", "Crypto Only"
   - Casino themed: dark bg, gold headers, pixel font for ranks

10. Update `components/GameOver/GameOver.tsx`:
    - Free games: current behavior unchanged
    - Crypto games: additional section showing:
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
- Wallet disconnects mid-game (free room): game continues normally, player keeps playing as guest
- Wallet disconnects mid-game (crypto room): game continues, if they win settlement goes to their wallet regardless
- Player joins crypto room then disconnects before game starts: server refunds their deposit after 60s timeout
- Transaction fails during deposit: player stays un-ready, can retry
- Transaction fails during settlement: server retries 3x, then flags for manual review, funds stay in escrow
- Multiple browser tabs: session cookie shared, wallet adapter handles per-tab
- Player tries to join crypto room with insufficient balance: rejected with error message showing required amount
- Server restart during crypto game: game state lost (in-memory), escrow funds safe on-chain. Need manual settlement. Future improvement: persist active crypto rooms to DB
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
- Zero breaking changes to existing free play
- All new features are additive
- Database auto-creates on first server start
- Wallet button visible on all screens but never required for free rooms
- Crypto rooms are a separate flow -- free rooms untouched
- Start on devnet, flip to mainnet via env var when ready
