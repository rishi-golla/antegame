# Batch 9: Wallet Auth + Crypto Rooms

## Goal

Wallet connect IS the auth. Connect Phantom/MetaMask = your account. No usernames, no passwords, no emails. First connect picks a display name + character, stored in DB linked to wallet address. Guest play stays for free rooms. Crypto rooms require wallet connection + SOL/ETH stake. Winner takes the pot.

---

## Investigation Summary

### Current Architecture
- **Frontend:** Next.js 14 (App Router), single `app/page.tsx` with screen state machine
- **Backend:** Custom Express 5 server (`server/index.ts`) with Socket.IO
- **State:** In-memory `RoomManager`, no persistence
- **Player Identity:** Ephemeral -- name/color/sprite per session, tied to socket ID
- **Room Types:** All rooms identical, no distinction between free/paid
- **Existing Crypto Code:** `sol-sniper/` has Jupiter swap, bridge, and wallet modules -- can reference for Solana patterns

### What This Batch Delivers
- Wallet-based authentication (Phantom, Solflare, MetaMask, Coinbase Wallet)
- SQLite persistence for profiles, stats, game history
- Two room types: Free rooms (anyone) and Crypto rooms (wallet required, staked entry)
- Solana escrow program for holding stakes
- Settlement on game-over (winner gets pot)
- Leaderboard and stats

### Tech Stack Additions
- `@solana/wallet-adapter-react` + `@solana/wallet-adapter-wallets` (Solana wallet UI)
- `@solana/web3.js` (Solana transactions)
- `@coral-xyz/anchor` (Solana program interaction)
- `wagmi` + `viem` (EVM wallet connect -- Base chain, stretch goal)
- `better-sqlite3` (persistence)
- `bs58` (signature verification)

---

## Batched Implementation Plan

### Batch 9.1: Database + Wallet Auth Backend

**Tasks:**
1. Install `better-sqlite3`, `@types/better-sqlite3`, `bs58`
2. Create `server/db.ts` -- SQLite at `data/monopoly.db`
   - `users` table: `wallet_address` (TEXT PRIMARY KEY), `chain` (TEXT: 'solana' | 'evm'), `display_name` (TEXT), `character_id` (TEXT), `created_at` (INTEGER), `last_seen` (INTEGER)
   - `stats` table: `wallet_address` (TEXT FK), `games_played` (INT DEFAULT 0), `games_won` (INT DEFAULT 0), `total_earnings_lamports` (BIGINT DEFAULT 0), `total_losses_lamports` (BIGINT DEFAULT 0), `minigames_played` (INT DEFAULT 0), `minigames_won` (INT DEFAULT 0), `crypto_games_played` (INT DEFAULT 0), `crypto_games_won` (INT DEFAULT 0)
   - `game_history` table: `id` (TEXT), `finished_at` (INTEGER), `duration_ms` (INTEGER), `player_count` (INTEGER), `players` (TEXT JSON), `winner_wallet` (TEXT nullable), `winner_name` (TEXT), `pot_lamports` (BIGINT DEFAULT 0), `is_crypto` (BOOLEAN DEFAULT 0)
   - Auto-migrate on first run
3. Create `server/routes/auth.ts`:
   - `POST /api/auth/verify-wallet` -- body: `{ walletAddress, chain, signature, message }` -- verifies signed message, creates/updates user, returns session cookie
   - `GET /api/auth/me` -- returns user profile or `{ guest: true }`
   - `POST /api/auth/logout` -- clears session
   - `PATCH /api/auth/profile` -- update display_name, character_id (wallet-authed only)
   - `GET /api/auth/nonce` -- returns a random nonce string for the wallet to sign (prevents replay attacks)
4. Create `server/auth.ts` -- session management
   - Sessions stored in `sessions` table (token, wallet_address, expires_at)
   - Cookie: `monopoly_session`, httpOnly, 30 days
   - `validateSession(token)` returns user or null
5. Wallet signature verification:
   - Solana: verify ed25519 signature using `@solana/web3.js` PublicKey + `bs58`
   - EVM: verify using `viem` `verifyMessage` (stretch)

**Tests:**
- Nonce generation returns unique values
- Valid Solana signature verifies correctly
- Invalid signature rejected
- User created on first verify, updated on subsequent
- Session create/validate/destroy cycle

---

### Batch 9.2: Frontend Wallet Connect

**Tasks:**
1. Install `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/web3.js`
2. Create `context/WalletContext.tsx`:
   - Wraps app in Solana `WalletProvider` + `ConnectionProvider`
   - Configured for mainnet-beta (with devnet toggle via env var)
   - Supported wallets: Phantom, Solflare, Backpack
3. Create `context/AuthContext.tsx`:
   - Manages auth state: `user`, `isGuest`, `isConnecting`
   - `connectWallet()` -- triggers wallet popup, signs nonce message, calls `/api/auth/verify-wallet`, sets session
   - `disconnect()` -- calls `/api/auth/logout`, clears state
   - `updateProfile(displayName, characterId)` -- calls PATCH
   - Auto-checks `/api/auth/me` on mount (resumes session if cookie exists)
4. Create `components/Auth/WalletButton.tsx`:
   - Casino themed button: "Connect Wallet" when disconnected, truncated address + character sprite when connected
   - Dropdown on click when connected: Profile, Stats, Disconnect
   - Pixel art styled matching casino theme
5. Create `components/Auth/ProfileSetup.tsx`:
   - Shown on FIRST wallet connect only
   - Pick display name + character (reuse character grid from GameSetup)
   - "Welcome to the Casino" header
   - Saves to DB, then proceeds to main menu
6. Update `app/page.tsx`:
   - Wrap in `WalletContext` and `AuthContext`
   - Add `WalletButton` to top-right corner of all screens
   - Add `profile-setup` screen for first-time wallet users
7. Update `app/layout.tsx` to include providers

**Design rules:**
- Wallet button: fixed top-right, pill shape, gold border, casino chip style
- Profile setup: same `.setupCard` / `.casinoMenuCard` container
- Character grid: reuse `.characterGrid` / `.characterCard` classes from CreateRoom
- All pixel art themed, no generic wallet adapter UI -- custom styled

---

### Batch 9.3: Room Types -- Free vs Crypto

**Tasks:**
1. Update `server/types.ts`:
   - Add to `Room`: `isCrypto` (boolean), `entryFeeLamports` (bigint), `potLamports` (bigint), `escrowAddress` (string nullable)
   - Add to `ServerPlayer`: `walletAddress` (string nullable)
   - Add to `RoomClientState`: `isCrypto`, `entryFee`, `pot`
2. Update `server/roomManager.ts`:
   - `createRoom` accepts `isCrypto`, `entryFeeLamports`, `walletAddress`
   - Crypto rooms require all players to have `walletAddress`
   - Crypto rooms track pot (entry fees * player count)
3. Update Socket events in `server/types.ts`:
   - `room:create` data adds: `isCrypto`, `entryFeeLamports`, `walletAddress`
   - `room:join` data adds: `walletAddress`
   - New event: `game:crypto-deposit-confirmed` -- player confirmed on-chain deposit
4. Update main menu in `app/page.tsx`:
   - Two sections: "Free Play" and "Crypto Rooms"
   - Free Play: current Create/Join/Local flow
   - Crypto Rooms: Create Crypto Room / Join Crypto Room (wallet required)
5. Create `components/Lobby/CreateCryptoRoom.tsx`:
   - Same as CreateRoom but with entry fee selector
   - Entry fee options: 0.01, 0.05, 0.1, 0.25, 0.5, 1 SOL
   - Shows pot size preview: "Entry: 0.1 SOL | 4 players = 0.4 SOL pot"
   - Wallet must be connected (redirect to connect if not)
   - Shows wallet balance
6. Update `components/Lobby/RoomLobby.tsx`:
   - Crypto rooms show: entry fee, current pot, each player's deposit status
   - "Ready" button replaced with "Deposit + Ready" for crypto rooms
   - Shows on-chain confirmation status
   - Game can't start until all deposits confirmed

---

### Batch 9.4: Solana Escrow Program

**Tasks:**
1. Create `programs/` directory for Anchor program (or use raw Solana instructions)
   - Keep it simple: PDA-based escrow, no Anchor if too heavy
2. Escrow program logic:
   - `create_game(entry_fee, max_players)` -- host creates game PDA, deposits entry fee
   - `join_game(game_pda)` -- player deposits entry fee into PDA
   - `settle_game(game_pda, winner)` -- server authority signs, releases pot to winner minus platform fee
   - `cancel_game(game_pda)` -- refund all if game never starts (timeout or host cancels)
   - `claim_refund(game_pda)` -- player claims refund if game cancelled
3. Platform fee: 5% of pot, sent to treasury wallet
4. Create `server/solana.ts`:
   - Server keypair loaded from env var or file (the settlement authority)
   - `createEscrow(entryFee, maxPlayers)` -- creates game PDA, returns escrow address
   - `verifyDeposit(escrowAddress, walletAddress)` -- confirms player deposited
   - `settleGame(escrowAddress, winnerWallet, potAmount)` -- signs and sends settle tx
   - `cancelGame(escrowAddress)` -- triggers refunds
5. Create `lib/solana-client.ts` (frontend):
   - `depositToEscrow(escrowAddress, amount)` -- player signs deposit tx
   - `getEscrowBalance(escrowAddress)` -- read pot size
6. Wire into room flow:
   - On room create (crypto): server calls `createEscrow`, stores address in room
   - On player ready: frontend calls `depositToEscrow`, server calls `verifyDeposit`
   - On game over: server calls `settleGame`
   - On room cancel/timeout: server calls `cancelGame`

**Security:**
- Server keypair is the ONLY authority that can settle (players can't self-settle)
- Deposits verified on-chain before game starts
- Timeout: if game doesn't start within 10 min, auto-cancel + refund
- If winner disconnects before settlement, funds held until they reconnect (or 24h timeout then refund all)

**Tests:**
- Escrow creation returns valid PDA
- Deposit verification works
- Settlement sends correct amounts (pot - 5% fee to winner, fee to treasury)
- Cancel refunds all depositors
- Unauthorized settle attempts rejected

---

### Batch 9.5: Stats, Leaderboard, and Settlement UI

**Tasks:**
1. Create `server/stats.ts`:
   - `recordGameResult(room, gameState)` -- called on game-over
   - Inserts `game_history` row
   - Updates stats for all wallet-connected players
   - For crypto games: tracks earnings/losses in lamports
2. Create `server/routes/stats.ts`:
   - `GET /api/stats/leaderboard` -- top 50 by wins (separate tabs: overall, crypto only)
   - `GET /api/stats/profile/:wallet` -- public profile for any wallet
   - `GET /api/stats/me` -- current user stats + game history
3. Wire settlement into game-over flow:
   - `server/index.ts`: on game-over event for crypto rooms, call `settleGame`
   - Broadcast `game:settlement` event with tx signature
4. Update `components/GameOver/GameOver.tsx`:
   - Free games: current behavior
   - Crypto games: show settlement status
     - "Settling on-chain..." with spinner
     - "Settled! Winner received X SOL" with Solscan link to tx
     - Show pot breakdown: pot size, platform fee, winner payout
5. Create `components/Auth/ProfileScreen.tsx`:
   - Display name, character, wallet address
   - Stats: games played/won, win rate, crypto earnings
   - Game history (last 30)
   - Edit display name + character
6. Create `components/Auth/LeaderboardScreen.tsx`:
   - Table: rank, character sprite, name, games won, win rate, crypto earnings
   - Gold/silver/bronze styling for top 3
   - Tabs: All Time, This Week, Crypto Only
   - Casino themed
7. Add to main menu:
   - "Leaderboard" button
   - "Profile" in wallet dropdown

---

## Edge Cases

- **Wallet disconnects mid-game (free room):** game continues, player uses last known name. Reconnect resumes
- **Wallet disconnects mid-game (crypto room):** game continues. If they lose, pot still settles to winner. If they win, funds held until reconnect (24h timeout then refund all)
- **Player tries to join crypto room without enough SOL:** error message with required amount
- **Transaction fails during deposit:** player shown retry button, not marked as ready
- **Transaction fails during settlement:** server retries 3 times with exponential backoff, then flags for manual review
- **Multiple wallets same person:** each wallet is a separate account, that's fine
- **Server restarts during crypto game:** game state lost (in-memory), escrow funds safe on-chain. Manual cancel/refund needed. Future improvement: persist room state to DB
- **Entry fee options:** predefined tiers only (0.01-1 SOL), no custom amounts
- **Minimum players for crypto:** 2 (no solo crypto games)
- **Platform fee:** 5%, configurable via env var. Treasury wallet address in env var

## File Structure (new files)
```
data/                              (gitignored)
  monopoly.db
server/
  db.ts                            (SQLite init + helpers)
  auth.ts                          (session management)
  stats.ts                         (game result recording)
  solana.ts                        (escrow interaction)
  routes/
    auth.ts                        (wallet verify, profile)
    stats.ts                       (leaderboard, history)
context/
  WalletContext.tsx                 (Solana wallet adapter)
  AuthContext.tsx                   (auth state, connect/disconnect)
lib/
  solana-client.ts                 (frontend escrow interaction)
components/Auth/
  WalletButton.tsx                 (connect/disconnect pill)
  ProfileSetup.tsx                 (first-time name/character pick)
  ProfileScreen.tsx                (stats, history, edit)
  LeaderboardScreen.tsx            (rankings)
components/Lobby/
  CreateCryptoRoom.tsx             (entry fee selector, balance check)
programs/                          (Solana escrow program -- may be separate repo)
  escrow/
```

## Deployment Considerations
- Server keypair must be secured (env var, not committed)
- Treasury wallet address in env var
- Start on devnet for testing, mainnet flag via `SOLANA_NETWORK=mainnet-beta`
- SQLite file needs persistent disk (not ephemeral containers)
- Rate limit wallet verify endpoint (prevent spam)

## Migration Path
- No breaking changes to existing free play
- All new features are additive
- Wallet button appears on all screens but is never required for free rooms
- Database auto-creates on first run
- Escrow program deployed separately, address configured via env var
