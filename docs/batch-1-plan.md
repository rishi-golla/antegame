# Batch 1: Foundation (Architecture + Game Data Model)

## Goal
Migrate to TypeScript, decompose the monolithic page into proper components, build the complete game data model (40 tiles, cards), create a pure-function game engine, and wire it up via React context. App should render identically to current state but powered by real game state.

## Tasks

### 1.1 Project Setup
- Install TypeScript, `@types/react`, `@types/react-dom`
- Install Vitest + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom`
- Create `tsconfig.json` (strict mode, paths alias `@/`)
- Add `vitest.config.ts`
- Rename `app/page.js` -> `app/page.tsx`, `app/layout.js` -> `app/layout.tsx`
- Rename `next.config.mjs` -> `next.config.ts` (or keep mjs, add TS support)
- Update `package.json` scripts: add `"test": "vitest"`, `"test:run": "vitest run"`
- Verify app still builds and renders

### 1.2 Component Decomposition
Break `page.tsx` into:
- `components/Board/Board.tsx` — grid, center art, dice focus layer
- `components/Board/Tile.tsx` — individual tile rendering
- `components/Board/DicePips.tsx` — pip layout for a single die
- `components/Board/BoardCenterArt.tsx` — decks + roll button
- `components/SidePanel/SidePanel.tsx` — chat/log toggle panel
- `components/SidePanel/ChatView.tsx` — chat messages + input
- `components/SidePanel/GameLogView.tsx` — game log entries
- `components/PlayerList/PlayerList.tsx` — left panel player list

Each component gets proper TypeScript props interfaces.
Keep `globals.css` as-is for now (design system is Batch 4).
Verify app renders identically after decomposition.

### 1.3 Type Definitions
Create `types/game.ts`:
```
- TileType: 'property' | 'railroad' | 'utility' | 'tax' | 'chance' | 'community-chest' | 'corner'
- ColorGroup: 'brown' | 'light-blue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'dark-blue'
- PropertyTile: { index, name, type, colorGroup?, price?, rent[] (base, set, 1h, 2h, 3h, 4h, hotel), houseCost?, mortgageValue? }
- RailroadTile: { index, name, type:'railroad', price:200, mortgageValue:100 }
- UtilityTile: { index, name, type:'utility', price:150, mortgageValue:75 }
- TaxTile: { index, name, type:'tax', amount }
- CornerTile: { index, name, type:'corner', cornerType: 'go'|'jail'|'free-parking'|'go-to-jail' }
- ChanceTile / CommunityChestTile
- Tile = union of all tile types
- Card: { id, type:'chance'|'community-chest', text, effect: CardEffect }
- CardEffect: { kind: 'move-to' | 'move-relative' | 'collect' | 'pay' | 'pay-each-player' | 'collect-from-each' | 'get-out-of-jail' | 'go-to-jail' | 'nearest-railroad' | 'nearest-utility' | 'repairs' }
- Player: { id, name, color, money, position, properties: number[], houses: Record<number, number>, inJail, jailTurns, getOutOfJailCards, bankrupt }
- GameState: { players, currentPlayerIndex, tiles, chanceDeck, communityChestDeck, chanceDiscard, communityChestDiscard, dice, doublesCount, phase, log, winner }
- GamePhase: 'waiting' | 'rolling' | 'moving' | 'landed' | 'buying' | 'auction' | 'paying-rent' | 'drawing-card' | 'in-jail' | 'turn-end' | 'game-over'
```

### 1.4 Game Data
Create `lib/gameData.ts`:
- `TILES`: Array of all 40 tiles with real Monopoly-equivalent data (renamed properties for legal safety)
- Tile order: GO, Brown1, Community Chest, Brown2, Income Tax, Railroad1, LightBlue1-3, Jail, Pink1-3, Utility1, Orange1-3, Free Parking, Red1-3, Chance, Yellow1-3, Railroad3, Green1-3, Community Chest, Utility2(?), Dark Blue1-2, Go To Jail — adapted to 40 slots
- `CHANCE_CARDS`: 16 cards with effects
- `COMMUNITY_CHEST_CARDS`: 16 cards with effects
- `COLOR_GROUPS`: Map of color group -> tile indices (for checking set completion)
- `STARTING_MONEY`: 1500

Tests:
- Verify 40 tiles exist
- Verify each color group has correct count (2 for brown/dark-blue, 3 for others)
- Verify all cards have valid effects
- Verify tile indices are sequential 0-39

### 1.5 Game Engine
Create `lib/gameEngine.ts` — pure functions, no side effects:
- `createGame(playerNames: string[]): GameState` — initialize fresh game
- `rollDice(state): { state, dice }` — generate roll, handle doubles tracking
- `movePlayer(state, steps): GameState` — move current player, handle passing GO
- `getLandingAction(state): LandingAction` — determine what happens on current tile
- `buyProperty(state): GameState` — current player buys current tile
- `declinePurchase(state): GameState` — triggers auction phase
- `payRent(state): GameState` — calculate and transfer rent
- `drawCard(state, deckType): { state, card }` — draw chance/community chest
- `applyCardEffect(state, card): GameState` — execute card effect
- `goToJail(state): GameState` — send current player to jail
- `attemptJailEscape(state, method): GameState` — bail/doubles/card
- `endTurn(state): GameState` — advance to next non-bankrupt player
- `checkBankruptcy(state, playerId): boolean`
- `getNetWorth(state, playerId): number`

Tests (TDD — write these first):
- Creating a game with 2-6 players
- Rolling dice returns 1-6 for each
- Moving wraps around tile 39 -> 0 and collects $200
- Landing on unowned property allows purchase
- Landing on owned property charges correct rent
- Rent doubles with color set
- Railroad rent scales with count owned
- Utility rent uses dice multiplier
- Income tax deducts $200
- Go to jail sends to tile 10, sets inJail
- Chance/community chest draw and reshuffle when empty
- Doubles tracking (3 doubles = jail)
- Turn advances to next non-bankrupt player

### 1.6 React Context
Create `context/GameContext.tsx`:
- `GameProvider` wrapping the app
- Exposes `state` and action dispatchers (`roll`, `buy`, `endTurn`, etc.)
- Internal `useReducer` calling engine functions
- Update `Board` to read positions/current player from context
- Update `PlayerList` to show real money from context
- Update `GameLog` to show real log entries from context
- Keep dice animation logic in Board (it's UI), but actual roll result comes from engine

Tests:
- Rendering GameProvider doesn't crash
- Dispatching roll updates state
- Components reflect state changes

## Completion Criteria
- `npm run build` passes with zero errors
- `npm run test:run` passes all tests
- App renders visually identical to current state
- All game state flows through context, no hardcoded data in components

## Files Created/Modified
- `tsconfig.json` (new)
- `vitest.config.ts` (new)
- `types/game.ts` (new)
- `lib/gameData.ts` (new)
- `lib/gameEngine.ts` (new)
- `lib/gameEngine.test.ts` (new)
- `lib/gameData.test.ts` (new)
- `context/GameContext.tsx` (new)
- `context/GameContext.test.tsx` (new)
- `components/Board/Board.tsx` (new)
- `components/Board/Tile.tsx` (new)
- `components/Board/DicePips.tsx` (new)
- `components/Board/BoardCenterArt.tsx` (new)
- `components/SidePanel/SidePanel.tsx` (new)
- `components/SidePanel/ChatView.tsx` (new)
- `components/SidePanel/GameLogView.tsx` (new)
- `components/PlayerList/PlayerList.tsx` (new)
- `app/page.tsx` (rewritten — thin shell importing components)
- `app/layout.tsx` (renamed from .js)
- `app/globals.css` (unchanged)
- `package.json` (updated deps + scripts)
