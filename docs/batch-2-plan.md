# Batch 2: Core Gameplay Loop

## Goal
Make the game fully playable end-to-end on a single device. All phases work correctly in the UI, token movement is animated step-by-step, and edge cases are handled.

## Context
Batch 1 built the engine but the UI integration has gaps:
- Token positions update instantly (no step-by-step animation)
- The dice animation triggers on state change but timing with engine is fragile
- No visual feedback for rent payments, tax, or property purchases
- Phase transitions work but feel abrupt
- No game setup screen (player count/names)
- Card draw flow works but needs polish

## Tasks

### 2.1 Game Setup Screen
- Create `components/GameSetup/GameSetup.tsx`
- Player name inputs (2-6 players), color picker
- "Start Game" button that initializes GameProvider with chosen names
- App starts on setup screen, transitions to game board on start
- Update `app/page.tsx` to conditionally render setup vs game

Tests:
- Renders setup with default 2 player slots
- Can add/remove players (min 2, max 6)
- Start button creates game with entered names

### 2.2 Animated Token Movement
- When a player moves, animate token step-by-step across tiles (like original code did)
- Create a movement queue: engine calculates final position instantly, but UI animates through each intermediate tile
- Use `useEffect` watching player positions to trigger animation sequence
- During animation, disable all buttons (isAnimating state)
- Passing GO should flash the GO tile during animation

Tests:
- Movement from tile 0 to tile 5 visits tiles 1,2,3,4,5 in sequence
- Wrapping from tile 38 to tile 3 visits 39,0,1,2,3

### 2.3 Turn Flow Polish
- After dice animation completes, THEN start token movement animation
- After token animation completes, THEN show the landing action (buy/card/rent/etc.)
- Rent payment: show a floating "-$X" on the payer and "+$X" on the receiver
- Tax payment: show floating "-$X"
- Buying: show floating "-$X" when purchased
- End turn: brief delay, then auto-advance (or button)
- Doubles: show "Doubles! Roll again" message before next roll

Tests:
- Phase transitions happen in correct order
- Dice -> movement -> landing action -> end turn flow is sequential

### 2.4 Property Ownership Indicators
- Tiles owned by a player get a colored border/dot matching the player's color
- Tiles with houses show small house icons (1-4 squares, hotel = triangle/star)
- Mortgaged tiles show a dimmed/striped overlay
- Clicking a tile shows a popup with full property info (name, color group, price, rent table, owner, houses)

Tests:
- Owned tile renders with owner color indicator
- Property popup displays correct rent values

### 2.5 Turn Indicator + Status Bar
- Top of board center: show current player name + color with "Your Turn" label
- Show dice result after roll
- Show money change animations (smooth counter)
- Show turn number

### 2.6 Edge Case Handling
- Player goes bankrupt mid-turn (money < 0 after rent/tax): mark bankrupt, skip future turns
- All properties of bankrupt player return to bank (unowned)
- Landing on own property: no action, just end turn
- Landing on bankrupt player's property: no rent
- Game over detection: last player standing wins, show victory screen

Tests:
- Bankrupt player is skipped in turn order
- Bankrupt player's properties become unowned
- Game ends when 1 player remains
- Victory screen shows winner

## Completion Criteria
- Full game playable from setup to victory
- Token movement animates step-by-step
- All phase transitions are visually clear
- Floating money indicators on payments
- Property ownership visible on board
- 0 TypeScript errors, all tests pass, build clean

## Files Created/Modified
- `components/GameSetup/GameSetup.tsx` (new)
- `components/Board/Board.tsx` (animated movement)
- `components/Board/BoardCenterArt.tsx` (turn indicator, polish)
- `components/Board/Tile.tsx` (ownership indicators, house icons, popup)
- `components/Board/PropertyPopup.tsx` (new)
- `components/Board/MoneyFloat.tsx` (new — floating +/- money)
- `components/GameOver/GameOver.tsx` (new)
- `context/GameContext.tsx` (setup flow, bankruptcy handling)
- `lib/gameEngine.ts` (bankruptcy property release)
- `lib/gameEngine.test.ts` (new tests)
- `app/page.tsx` (setup -> game flow)
- `app/globals.css` (new styles)
