# Batch 10: Gambling Minigames

## Goal
Add gambling minigames to two key moments: **buying properties** and **paying rent**. 10 casino-themed minigames rotate randomly. Results are tiered — not just win/lose, but HOW MUCH you win or lose.

---

## Result Tiers

| Tier | Icon | Buying Property | Paying Rent |
|------|------|----------------|-------------|
| **Win** | ✅ | Property for FREE | Pay no rent |
| **Close Win** | 😅 | Property at 50% off | Pay 50% rent |
| **Close Loss** | 😬 | Pay 1.5x price, no property | Pay 1.5x rent |
| **Loss** | ❌ | Pay 2x price, no property | Pay 2x rent |
| **Catastrophic Loss** | 💀 | Pay 5x price, no property | Pay 5x rent |

Each minigame produces a **score** that maps to a tier. The mapping is defined per-minigame so each one feels unique.

---

## Two Gamble Triggers

### 1. Buying — Land on Unowned Property
```
Roll → Land on unowned → [BUY ($X)] [GAMBLE 🎰] [PASS]
                                         ↓
                               Random minigame
                                         ↓
                               Tier determines outcome
```
- Gamble button only enabled if player can afford the worst case (5x price)
- If they can't afford 5x but can afford 2x, show warning: "⚠️ You could owe up to $X"
- If they can't afford 1.5x, gamble disabled entirely

### 2. Rent — Land on Owned Property
```
Roll → Land on owned property → "You owe $X rent" → [PAY] [GAMBLE 🎰]
                                                          ↓
                                                Random minigame
                                                          ↓
                                                Tier determines outcome
```
- Current flow: rent is auto-deducted. New flow: show rent amount first, give option to gamble
- Win = pay nothing (or 50%), the landlord gets nothing (or 50%)
- Lose = pay more rent to the landlord
- Gamble enabled if player can afford worst case (5x rent)
- Same warning system as buying

**New phase needed:** `paying-rent` becomes interactive instead of auto-resolving.

---

## How It Fits Into the Existing Game Flow

### Current Flow:
```
Land on unowned → phase: 'buying' → Buy/Pass → turn-end
Land on owned   → payRent() auto-deducts → turn-end
```

### New Flow:
```
Land on unowned → phase: 'buying' → Buy/Gamble/Pass
                                       ↓ Gamble
                                  phase: 'minigame'
                                  minigameContext: 'buying'
                                       ↓ result
                                  tier applied → turn-end

Land on owned → phase: 'paying-rent' → Pay/Gamble buttons shown
                                           ↓ Gamble
                                      phase: 'minigame'
                                      minigameContext: 'rent'
                                           ↓ result
                                      tier applied → rent paid → turn-end
                                      ↓ Pay
                                      normal rent deducted → turn-end
```

### Engine Changes

**`types/game.ts`** — New types:
```ts
type MinigameId = 'slots' | 'higher-lower' | 'craps' | 'wheel' | 'minesweeper'
  | 'horse-race' | 'darts' | 'blackjack' | 'coin-flip' | 'safe-cracker';

type MinigameTier = 'win' | 'close-win' | 'close-loss' | 'loss' | 'catastrophic';

type MinigameContext = 'buying' | 'rent';

interface MinigameState {
  id: MinigameId;
  context: MinigameContext;     // what triggered it
  tileIndex: number;            // which property
  baseAmount: number;           // property price or rent amount
  status: 'intro' | 'playing' | 'result';
  tier: MinigameTier | null;    // set when minigame ends
  data: Record<string, any>;    // minigame-specific state
}
```

Update GamePhase:
```ts
| 'minigame'      // minigame active
| 'paying-rent'   // player sees rent amount, can pay or gamble
```

Update GameState:
```ts
activeMinigame: MinigameState | null;
minigamesEnabled: boolean;
pendingRent: { amount: number; toPlayer: number } | null;  // holds rent info during paying-rent phase
recentMinigames: MinigameId[];  // last 3, to avoid repeats
```

**`lib/gameEngine.ts`** — Changes:

1. **`payRent()` no longer auto-deducts.** Instead:
   - If minigames enabled: set `phase: 'paying-rent'`, store rent in `pendingRent`
   - If minigames disabled: current behavior (auto-deduct)

2. **New functions:**
```ts
startMinigame(state: GameState, context: MinigameContext): GameState
  → picks random MinigameId (avoids last 3)
  → sets phase: 'minigame', populates activeMinigame
  → log: "Player X is gambling!"

resolveMinigame(state: GameState, tier: MinigameTier): GameState
  → calculates amount based on tier + context:

  BUYING:
    win          → property added, pay $0
    close-win    → property added, pay 50% price
    close-loss   → no property, pay 1.5x price
    loss         → no property, pay 2x price
    catastrophic → no property, pay 5x price

  RENT:
    win          → pay $0 rent to landlord
    close-win    → pay 50% rent
    close-loss   → pay 1.5x rent
    loss         → pay 2x rent
    catastrophic → pay 5x rent

  → bankruptcy check if money < 0
  → clear activeMinigame
  → phase: 'turn-end'

payRentNormally(state: GameState): GameState
  → deducts pendingRent.amount, gives to landlord
  → clears pendingRent
  → phase: 'turn-end'
```

**`context/GameContext.tsx`** — New actions:
```ts
| { type: 'GAMBLE' }                              // starts minigame (works for both buying and rent)
| { type: 'MINIGAME_RESULT'; tier: MinigameTier } // resolves with tier
| { type: 'PAY_RENT' }                            // pay rent normally (no gamble)
```

### UI Changes

**`BoardCenterArt.tsx`:**

Buying phase:
```
[BUY $400] [GAMBLE 🎰] [PASS]
```

Rent phase (NEW):
```
"You owe $50 rent to Player 2"
[PAY $50] [GAMBLE 🎰]
```

Minigame phase:
```
MinigameOverlay takes over the board center
→ 2s intro: minigame name + stakes
→ gameplay (5-15s)
→ result: tier animation + outcome text
→ auto-dismiss → turn-end
```

**Result screen examples:**
- ✅ "You won Boardwalk for FREE!"
- 😅 "Close one! Boardwalk for $200 (50% off)"
- 😬 "Ouch. You pay $600 penalty. (1.5x)"
- ❌ "Bad luck. You pay $800 penalty. (2x)"
- 💀 "CATASTROPHIC! You pay $2,000! (5x)"

---

## The 10 Minigames

Each minigame maps its score to the 5 tiers differently:

### 1. 🎰 Slot Machine
- 3 reels with symbols, tap to stop each
- 3 match = Win, 2 match + close = Close Win, 2 match = Close Loss, 1 match = Loss, 3 skulls = Catastrophic

### 2. 🃏 Higher or Lower
- Guess 3 cards: higher or lower than previous
- 3 correct = Win, 2 correct = Close Win, 1 correct = Close Loss, 0 correct = Loss, 0 correct + all wrong by 1 = Catastrophic

### 3. 🎲 Craps
- Pick a target number (2-12), roll two dice
- Exact hit = Win, off by 1 = Close Win, off by 2 = Close Loss, off by 3+ = Loss, snake eyes when you picked 12 = Catastrophic

### 4. 🎡 Wheel of Fortune
- Wheel with segments: Win (2), Close Win (3), Close Loss (3), Loss (3), Catastrophic (1) — 12 segments total

### 5. 💣 Minesweeper Lite
- 3x3 grid, 3 mines. Pick tiles one at a time.
- 4+ safe = Win, 3 safe = Close Win, 2 safe = Close Loss, 1 safe = Loss, first pick is mine = Catastrophic

### 6. 🏇 Horse Race
- 4 horses, pick one. Hidden speed stats.
- 1st place = Win, 2nd = Close Win, 3rd = Close Loss, 4th = Loss, 4th by huge margin = Catastrophic

### 7. 🎯 Dart Throw
- Moving crosshair, tap to throw
- Bullseye = Win, inner ring = Close Win, outer ring = Close Loss, off board = Loss, hit the wall = Catastrophic

### 8. 🃏 Blackjack Speed Round
- One hand vs dealer
- Blackjack (21) = Win, beat dealer = Close Win, push/tie = Close Loss, dealer wins = Loss, bust = Catastrophic

### 9. 🪙 Coin Flip x3
- 3 flips, must survive all
- 3 heads = Win, 2 heads = Close Win, 1 head = Close Loss, 0 heads = Loss, 0 heads + all tails in < 2 seconds = Catastrophic

### 10. 🔒 Safe Cracker
- 3-digit combo, 3 attempts with hints
- Crack in 1 = Win, crack in 2 = Close Win, crack in 3 = Close Loss, fail all 3 but close = Loss, fail all 3 with 0 correct digits = Catastrophic

---

## File Structure
```
components/Minigames/
├── MinigameOverlay.tsx      # wrapper: intro → game → result
├── MinigameIntro.tsx        # shows name + stakes + tier info
├── MinigameResult.tsx       # tier animation + outcome
├── SlotMachine.tsx
├── HigherLower.tsx
├── Craps.tsx
├── WheelOfFortune.tsx
├── MinesweeperLite.tsx
├── HorseRace.tsx
├── DartThrow.tsx
├── Blackjack.tsx
├── CoinFlip.tsx
├── SafeCracker.tsx
└── minigameUtils.ts         # picker, tier calc, RNG, shared types
```

---

## Build Phases

### Phase 10.1 — Framework + Engine Changes
- Add all new types (MinigameState, MinigameTier, MinigameContext)
- Add `minigame` and `paying-rent` phases
- Modify `payRent()` to stop at `paying-rent` phase instead of auto-deducting
- Implement `startMinigame()`, `resolveMinigame()`, `payRentNormally()`
- Add `GAMBLE`, `MINIGAME_RESULT`, `PAY_RENT` actions to reducer
- Build MinigameOverlay shell + result screen
- Wire Gamble button into buying AND rent UI
- Test end-to-end with CoinFlip as the first minigame

### Phase 10.2 — Build Minigames 1-5
- Slot Machine, Higher or Lower, Craps, Wheel of Fortune, Minesweeper Lite
- Each exports: `{ component, generateInitialData, tierFromScore }`
- All pixel art casino themed

### Phase 10.3 — Build Minigames 6-10
- Horse Race, Dart Throw, Blackjack, Coin Flip, Safe Cracker

### Phase 10.4 — Multiplayer Wiring
- Socket events: `gamble`, `minigame-input`, `minigame-start`, `minigame-update`, `minigame-result`
- Server picks minigame + generates hidden state
- Server validates inputs, determines tier
- Spectators watch in real-time
- `pay-rent` socket event for choosing to pay normally

### Phase 10.5 — Polish
- Tier-specific animations (confetti scale with tier, explosions scale with loss)
- 💀 Catastrophic has screen shake + dramatic sound hook
- Gamble button gold glow/pulse
- Lobby setting: minigames on/off
- Game log shows tier + exact amounts
- Minigame stats per player (for leaderboard later)

---

## Edge Cases
- **Can't afford worst case (5x)** → Show warning with max possible loss, still allow if can afford 1.5x
- **Can't afford 1.5x** → Gamble button fully disabled
- **Timeout (15s)** → Auto-catastrophic loss (maximum penalty for stalling)
- **Disconnect during minigame** → Server auto-resolves as catastrophic after 15s
- **Bankruptcy from loss** → Standard bankruptcy flow (transfer assets to bank/creditor)
- **Doubles + minigame** → Minigame resolves first, then doubles extra roll continues
- **Rent gamble + landlord bankrupt** → Shouldn't happen (bankrupt players don't collect rent)
- **$0 rent** → No gamble option shown (nothing to gamble for)
