# Batch 10: Gambling Minigames

## Investigation Summary

### Current State
- Game uses `GamePhase` state machine with phases: rolling, landed, buying, paying-rent, drawing-card, etc.
- `payRent()` in `lib/gameEngine.ts` auto-deducts rent and transitions to turn-end
- `buyProperty()` and `declinePurchase()` handle buying phase
- `BoardCenterArt.tsx` renders the board center UI based on current phase (buttons, hints, overlays)
- `GameContext.tsx` dispatches actions (`ROLL`, `BUY`, `DECLINE`, etc.) to a reducer calling engine functions
- `MultiplayerGameContext.tsx` mirrors same actions but forwards them over sockets
- Existing pixel art assets: 8 chibi character sprites (`public/assets/sprites/`), tile backgrounds, casino crest
- Fonts: Cinzel (headings) and Nunito (body). No pixel font yet -- minigames need one
- CSS vars: `--felt-green`, `--gold`, `--burgundy`, `--neon-red`, `--board-border` define casino palette
- `lib/assetMap.ts` has `CHARACTERS` array with 8 characters (sprite path, color, name)

### Integration Points
- **Buying trigger:** `types/game.ts` GamePhase `buying` -> need to add `minigame` phase
- **Rent trigger:** `payRent()` in `lib/gameEngine.ts` -> need to intercept before auto-deduction, add `paying-rent` as interactive phase
- **UI:** `BoardCenterArt.tsx` Buy/Pass buttons -> add Gamble button; new MinigameOverlay replaces center content during minigame phase
- **Reducer:** `GameContext.tsx` and `MultiplayerGameContext.tsx` need new action types
- **Server:** `server/index.ts` and `server/types.ts` need new socket events for multiplayer minigames

### Design Requirements
- All minigame UIs must use pixel art aesthetic with chibi style
- Add `Press Start 2P` pixel font for minigame headers and labels
- Use `step()` CSS timing functions for retro animations (no smooth easing)
- Color palette: existing casino vars (golds, greens, reds, burgundy)
- `image-rendering: pixelated` on all sprite/pixel art elements
- Each minigame renders inside the board center area (`.boardCenterArt` dimensions)

---

## Tier System

Each minigame produces a score mapped to one of 5 tiers:

| Tier | Buying Outcome | Rent Outcome |
|------|---------------|-------------|
| Win | Property for FREE | Pay no rent |
| Close Win | Property at 50% price | Pay 50% rent |
| Close Loss | No property, pay 1.5x price | Pay 1.5x rent |
| Loss | No property, pay 2x price | Pay 2x rent |
| Catastrophic | No property, pay 5x price | Pay 5x rent |

---

## Batch 10.1: Engine and Framework

**Types (`types/game.ts`):**
- Add `MinigameId` union: `'slots' | 'higher-lower' | 'craps' | 'wheel' | 'minesweeper' | 'horse-race' | 'darts' | 'blackjack' | 'coin-flip' | 'safe-cracker'`
- Add `MinigameTier`: `'win' | 'close-win' | 'close-loss' | 'loss' | 'catastrophic'`
- Add `MinigameContext`: `'buying' | 'rent'`
- Add `MinigameState` interface: `{ id, context, tileIndex, baseAmount, status: 'intro' | 'playing' | 'result', tier: MinigameTier | null, data: Record<string, unknown> }`
- Add `'minigame'` to `GamePhase` union
- Add to `GameState`: `activeMinigame: MinigameState | null`, `minigamesEnabled: boolean`, `pendingRent: { amount: number; toPlayer: number } | null`, `recentMinigames: MinigameId[]`

**Engine (`lib/gameEngine.ts`):**
- New `calculateRent()` pure function: extracts rent calculation from `payRent()` into reusable function that returns the rent amount
- Modify `payRent()`: if `state.minigamesEnabled`, set `pendingRent` with calculated rent and `toPlayer`, transition to `phase: 'paying-rent'` instead of auto-deducting. If disabled, current behavior unchanged
- New `payRentNormally(state)`: deducts `pendingRent.amount` from current player, gives to `pendingRent.toPlayer`, clears `pendingRent`, transitions to turn-end. Handles bankruptcy
- New `startMinigame(state, context: MinigameContext)`: picks random `MinigameId` (excludes last 3 in `recentMinigames`), sets `phase: 'minigame'`, creates `activeMinigame` with tile info and base amount (price for buying, rent for rent), adds to log
- New `resolveMinigame(state, tier: MinigameTier)`: calculates actual amount based on tier multiplier and context. For buying: win = add property free, close-win = add property at 50%, close-loss/loss/catastrophic = deduct 1.5x/2x/5x with no property. For rent: win = 0 to landlord, close-win = 50% to landlord, etc. Clears `activeMinigame`, updates `recentMinigames`, handles bankruptcy, transitions to turn-end

**Reducer (`context/GameContext.tsx`):**
- Add action types: `GAMBLE`, `MINIGAME_RESULT` (with tier), `PAY_RENT`
- `GAMBLE`: calls `startMinigame(state, context)` where context is inferred from current phase (buying or paying-rent)
- `MINIGAME_RESULT`: calls `resolveMinigame(state, action.tier)`
- `PAY_RENT`: calls `payRentNormally(state)`

**Multiplayer (`context/MultiplayerGameContext.tsx` and `server/types.ts`):**
- Add `GAMBLE`, `MINIGAME_RESULT`, `PAY_RENT` to multiplayer action dispatch
- Add socket events: `game:gamble`, `game:minigame-result`, `game:pay-rent`
- Server applies same engine functions

**UI (`components/Board/BoardCenterArt.tsx`):**
- Buying phase: change `[BUY] [PASS]` to `[BUY] [GAMBLE] [PASS]`. Gamble button disabled if player cannot afford 1.5x price. Gold pulsing glow on gamble button
- Add `paying-rent` phase rendering: show rent amount and landlord name, `[PAY $X] [GAMBLE]` buttons. Gamble disabled if cannot afford 1.5x rent
- Add `minigame` phase rendering: render `MinigameOverlay` component instead of normal center content

**New Components:**
- `components/Minigames/MinigameOverlay.tsx`: wrapper that shows intro (2s, minigame name + stakes), renders active minigame component, shows result with tier animation, dispatches `MINIGAME_RESULT` on dismiss
- `components/Minigames/MinigameResult.tsx`: tier-specific result screen with pixel art effects. Win = green confetti, Close Win = small confetti, Close Loss = amber warning, Loss = red flash, Catastrophic = screen shake + skull

**CSS:**
- Add `Press Start 2P` font import
- Add `.minigameOverlay` styles (absolute positioned over board center, dark semi-transparent backdrop)
- Add `.minigameIntro` styles (pixel font, centered, tier multiplier display)
- Add `.minigameResult` styles per tier (color-coded, animations with `steps()`)
- Add `.gambleBtn` styles (gold glow pulse animation, pixel border)
- Add `.payRentPhase` styles for rent display

**Tests:**
- `calculateRent()` returns correct rent for property/railroad/utility
- `payRent()` transitions to `paying-rent` when minigames enabled
- `payRentNormally()` deducts and transfers correct amount
- `startMinigame()` picks valid minigame, avoids recent 3
- `resolveMinigame()` applies correct multiplier for each tier + context combo (10 test cases: 5 tiers x 2 contexts)
- `resolveMinigame()` triggers bankruptcy when money goes negative
- Gamble button disabled when player cannot afford 1.5x

---

## Batch 10.2: Minigames 1-5

Each minigame is a standalone component at `components/Minigames/[Name].tsx`. Each receives props: `{ onResult: (tier: MinigameTier) => void, baseAmount: number, context: MinigameContext }`. Each has a 15-second timeout that auto-resolves as catastrophic.

### 1. SlotMachine.tsx
- 3 vertical reels with 5 symbols each: cherry, seven, diamond, bar, skull
- Symbols are pixel art rendered via CSS (colored emoji-sized blocks or small canvas)
- Reels spin with `steps()` animation (discrete jumps, not smooth scroll)
- Player taps STOP for each reel left-to-right
- Tier mapping: 3 match = win, 2 match + third is adjacent symbol = close-win, 2 match = close-loss, 1 match = loss, 3 skulls = catastrophic
- Casino lever pull animation on start

### 2. HigherLower.tsx
- Shows a pixel art playing card face-up (rank + suit)
- Player guesses if next card is HIGHER or LOWER
- 3 rounds total
- Cards rendered as pixel art rectangles with rank/suit in pixel font
- Tier mapping: 3 correct = win, 2 correct = close-win, 1 correct = close-loss, 0 correct = loss, 0 correct + all guesses maximally wrong = catastrophic

### 3. Craps.tsx
- Player picks a target number from 2-12 via pixel art number buttons
- Two pixel art dice roll with `steps()` tumbling animation
- Result compared to target
- Tier mapping: exact match = win, off by 1 = close-win, off by 2 = close-loss, off by 3+ = loss, snake eyes (2) when target was 12 or vice versa = catastrophic

### 4. WheelOfFortune.tsx
- Circular wheel divided into 12 segments with tier labels
- Segments: 2x win, 3x close-win, 3x close-loss, 3x loss, 1x catastrophic
- Player clicks to spin, wheel decelerates with `steps()` animation
- Pointer/arrow at top indicates result
- Gold and red alternating segment colors

### 5. MinesweeperLite.tsx
- 3x3 grid of pixel art tiles (stone/gold texture)
- 3 mines hidden randomly
- Player clicks tiles one at a time, revealed tiles show safe (gem) or mine (skull)
- Mine hit = stop immediately
- Tier mapping: 6 safe = win, 4-5 safe = close-win, 2-3 safe = close-loss, 1 safe = loss, first click is mine = catastrophic

**CSS for all minigames:**
- Pixel font headers showing minigame name
- Chunky pixel borders (3-4px solid, stepped corners via box-shadow trick)
- Button styles: pixel art look with inset shadows and `steps()` hover
- Symbol/card/dice artwork via CSS shapes or small inline SVGs (no external image generation needed -- keep it CSS/canvas pixel art)
- Consistent sizing: fit within board center area (roughly 400x400px)
- Dark green felt background matching `--felt-green`

**Tests:**
- Each minigame calls `onResult` with valid tier
- Timeout triggers catastrophic after 15s
- Tier distribution matches expected mappings

---

## Batch 10.3: Minigames 6-10

### 6. HorseRace.tsx
- 4 pixel art horses (colored rectangles with legs animation via `steps()`)
- Player picks a horse before race starts
- Race runs for 3 seconds, horses advance at random speeds
- Pixel art track with lane dividers
- Tier mapping: 1st place = win, 2nd = close-win, 3rd = close-loss, 4th = loss, 4th by huge margin = catastrophic

### 7. DartThrow.tsx
- Pixel art circular dartboard with concentric rings
- Crosshair oscillates horizontally and vertically (two-axis movement)
- Player taps to throw
- Dart sticks where crosshair was
- Tier mapping: bullseye = win, inner ring = close-win, outer ring = close-loss, edge = loss, complete miss = catastrophic

### 8. Blackjack.tsx
- Dealt 2 pixel art cards, dealer gets 2 (one hidden)
- Simple HIT or STAND buttons
- One round only, no splits or doubles
- Cards animate in with `steps()` slide
- Tier mapping: blackjack (21) = win, beat dealer = close-win, push = close-loss, dealer wins = loss, bust = catastrophic

### 9. CoinFlip.tsx
- Pixel art coin with heads/tails
- 3 sequential flips, player calls each one
- Coin flip animation with `steps()` rotation
- Tier mapping: 3 correct = win, 2 correct = close-win, 1 correct = close-loss, 0 correct = loss, 0 correct in under 3 seconds = catastrophic

### 10. SafeCracker.tsx
- Pixel art combination lock with 3 digit dials (0-9)
- Player gets 3 attempts
- After each guess, shown how many digits are correct position (green) and correct digit wrong position (yellow) -- Mastermind style
- Tier mapping: crack in 1 = win, crack in 2 = close-win, crack in 3 = close-loss, fail with 2+ correct digits = loss, fail with 0 correct digits = catastrophic

**Tests:**
- Same as batch 10.2: each calls onResult with valid tier, timeout works

---

## Batch 10.4: Multiplayer Wiring

**Server-side (`server/index.ts`):**
- Handle `game:gamble` event: server picks minigame (not client), generates hidden state (mine positions, card order, horse speeds, safe combo, etc.), broadcasts `minigame-start` to all
- Handle `game:minigame-input` events: server processes player inputs, updates minigame state, broadcasts `minigame-update` to all for spectator rendering
- Handle `game:minigame-result`: server determines tier from final state, applies `resolveMinigame`, broadcasts updated game state
- Handle `game:pay-rent`: applies `payRentNormally`, broadcasts

**Client-side:**
- In multiplayer mode, minigame components send inputs via socket instead of computing locally
- Spectators render minigame state from broadcasts (read-only mode)
- Active player sees interactive controls, spectators see animations only

**Tests:**
- Server picks minigame and generates valid hidden state
- Invalid inputs rejected
- Spectators receive updates
- Timeout handled server-side (15s)

---

## Batch 10.5: Polish

- Win/lose pixel art animations: confetti particles for wins, explosion/skull for catastrophic
- Screen shake effect for catastrophic tier (CSS transform keyframes with `steps()`)
- Gamble button gold pulse animation (`@keyframes gambleGlow`)
- Game log messages for each tier outcome with amounts
- Lobby setting: host can toggle minigames on/off (adds to room create UI)
- Minigame intro screen shows chibi character of current player reacting
- Sound effect hooks: empty function stubs for future audio batch (no actual audio yet)

---

## Edge Cases
- Player cannot afford 1.5x: gamble button disabled with tooltip "Need $X to gamble"
- Player cannot afford 1.5x but can afford normal: only Buy/Pay and Pass shown
- Timeout (15s): auto-catastrophic, dispatch immediately
- Disconnect during minigame (multiplayer): server auto-resolves as catastrophic after 15s
- Bankruptcy from minigame loss: standard bankruptcy flow
- Doubles + minigame: minigame resolves first, extra roll continues after
- $0 rent: no gamble option (nothing to gamble for)
- Minigame during trading phase: not possible (gamble only triggers from buying/paying-rent)

## File Structure
```
components/Minigames/
  MinigameOverlay.tsx
  MinigameResult.tsx
  SlotMachine.tsx
  HigherLower.tsx
  Craps.tsx
  WheelOfFortune.tsx
  MinesweeperLite.tsx
  HorseRace.tsx
  DartThrow.tsx
  Blackjack.tsx
  CoinFlip.tsx
  SafeCracker.tsx
  minigameUtils.ts
```
