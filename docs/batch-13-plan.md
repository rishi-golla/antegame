# Batch 13: Trade System Polish & Revamp

## Investigation Summary

### Current State
- **TradeModal**: Basic two-column layout (offer vs request). Checkbox list of property names, money input fields. No visual flair — just text names, no colors, no property cards.
- **TradeOfferView**: Shows pending offer with Accept/Reject buttons. Already gated so only recipient can act (server-side + client-side).
- **TradeNotification**: Inline notification in PlayerList showing the offer summary.
- **Trading logic** (`lib/trading.ts`): Validates ownership, house-in-group restrictions, money limits. Transfers properties, money, and mortgage status. Tile ownership updated.
- **Multiplayer bug**: Accept button sometimes doesn't work — socket event may not reach server. Needs investigation.
- **Missing features**: No counter-offers, no GOOJF card trading, no mortgaged property trading, no trade history, no "sweeten the deal" flow.

### Key Files
- `components/Board/TradeModal.tsx` — proposal UI (165 lines)
- `components/PlayerList/PlayerList.tsx` — trade button + TradeNotification
- `lib/trading.ts` — game logic (proposeTrade, acceptTrade, rejectTrade)
- `context/GameContext.tsx` — PROPOSE_TRADE, ACCEPT_TRADE, REJECT_TRADE actions
- `context/MultiplayerGameContext.tsx` — dispatches to socket
- `context/SocketContext.tsx` — sendTradeAction → socket emit
- `server/index.ts` — game:propose-trade, game:accept-trade, game:reject-trade handlers
- `types/game.ts` — TradeOffer interface

---

## Sub-batch 13.1: Fix Multiplayer Accept Bug
**Goal**: Make accept/reject actually work in multiplayer.

**Tasks**:
1. Add logging to `sendTradeAction` in SocketContext to confirm emit fires
2. Verify `MultiplayerGameContext` dispatch intercepts `ACCEPT_TRADE` correctly (not falling through to local reducer)
3. Check if `TradeOfferView` uses the multiplayer dispatch or the local GameContext dispatch — if it imports `useGame()` directly, it bypasses the multiplayer socket layer
4. Fix: `TradeOfferView` must use dispatch from whichever context is active (multiplayer wraps GameContext, so `useGame().dispatch` should already be overridden — verify this)

**Root cause hypothesis**: `TradeOfferView` may be rendering outside the `MultiplayerGameProvider` wrapper, or the dispatch override isn't catching ACCEPT_TRADE.

---

## Sub-batch 13.2: Visual Overhaul — Trade Proposal Modal
**Goal**: Replace plain text trade UI with property cards and casino theme.

**Tasks**:
1. Replace checkbox property lists with `PropertyCard` mini-cards (from Batch 11) — draggable or click-to-toggle
2. Add color-coded headers with player sprites: "🎰 [Player sprite] You Offer" / "[Sprite] You Request"
3. Money input → styled slider + numeric input with dollar chip icons
4. Show property card previews in each column with mortgage badge, house count
5. Add "Select All" / "Deselect All" per column
6. Allow trading mortgaged properties (Monopoly rules allow it — recipient pays 10% interest immediately or unmortgages for full price + 10%)
7. Show net value summary: "You give: ~$850 | You get: ~$620"
8. Animate cards sliding between columns on toggle

**CSS Specs**:
- Modal: `background: radial-gradient(ellipse at center, #1a0a14 0%, #0d0509 100%)`, gold border
- Property cards: reuse `.propertyCard` from Batch 11, add `.propertyCardTrade` variant (smaller, with checkbox overlay)
- Slide animation: `translateX` + `opacity` transition 200ms ease
- Money slider: gold track, chip-shaped thumb

---

## Sub-batch 13.3: Counter-Offer System
**Goal**: Let the recipient modify and send back instead of just accept/reject.

**Tasks**:
1. Add `COUNTER_TRADE` action type to GameContext + MultiplayerGameContext
2. `counterTrade(state, newOffer)` in `trading.ts` — swaps fromPlayer/toPlayer, clears old offer, sets new one
3. Server handler `game:counter-trade` — validates and broadcasts
4. UI: Add "Counter" button next to Accept/Reject in TradeOfferView
5. Counter button opens TradeModal pre-filled with the current offer (flipped perspective)
6. Add counter-offer count indicator: "Counter #2" so players know it's going back and forth
7. Max 5 counter-offers before auto-reject (prevent infinite loops)

**TradeOffer type update**:
```ts
interface TradeOffer {
  fromPlayer: number;
  toPlayer: number;
  offerMoney: number;
  requestMoney: number;
  offerProperties: number[];
  requestProperties: number[];
  counterCount?: number;  // NEW
  includesGOOJF?: { from: number; to: number }; // NEW — count of GOOJF cards each side offers
}
```

---

## Sub-batch 13.4: GOOJF Card Trading
**Goal**: Allow Get Out of Jail Free cards in trades.

**Tasks**:
1. Add `goojfCardsOffered` and `goojfCardsRequested` to TradeOffer
2. Show GOOJF card count in TradeModal with +/- buttons
3. Transfer GOOJF cards in `acceptTrade()` (adjust `player.getOutOfJailFreeCards`)
4. Validate: can't offer more GOOJF cards than you have
5. Display GOOJF cards in TradeOfferView/TradeNotification

---

## Sub-batch 13.5: Trade UX Polish
**Goal**: Quality-of-life improvements.

**Tasks**:
1. **Trade during any phase**: Currently trade button only shows when it's not your turn and no active offer. Allow proposing trades during the `post-roll` phase (after rolling, before ending turn) — matches real Monopoly.
2. **Trade notification sound**: Already wired (`sfx/trade-offer`). Add distinct sounds for accept (`sfx/trade-accept`) and reject (`sfx/trade-reject`).
3. **Toast notifications**: "Trade accepted! You received Sunset Boulevard + $200" / "Trade rejected by [Player]"
4. **Cancel own offer**: Proposer can cancel their pending offer (add CANCEL_TRADE action)
5. **Trade cooldown**: After a rejection, 10-second cooldown before you can trade the same player again (prevent spam)
6. **Keyboard shortcuts**: `T` to open trade with selected player, `Esc` to close
7. **Mortgaged property warning**: When accepting a trade with mortgaged properties, show warning: "You'll owe $X in mortgage interest"

---

## Edge Cases
- Player goes bankrupt during active trade → auto-reject
- Trade proposed to disconnected player → auto-reject after 30s
- Trading a property that completes a color group → highlight with gold glow
- Trading away a property that breaks a color group → warning indicator
- Both players trade properties in same color group → correctly update group ownership

## File Changes Summary
| File | Changes |
|------|---------|
| `types/game.ts` | Update TradeOffer interface (counterCount, GOOJF) |
| `lib/trading.ts` | Add counterTrade(), GOOJF logic, mortgaged property interest |
| `context/GameContext.tsx` | Add COUNTER_TRADE, CANCEL_TRADE actions |
| `context/MultiplayerGameContext.tsx` | Map new actions to socket |
| `context/SocketContext.tsx` | Add new trade socket emitters |
| `server/index.ts` | Add game:counter-trade, game:cancel-trade handlers |
| `components/Board/TradeModal.tsx` | Full visual overhaul with PropertyCards |
| `components/Board/TradeOfferView.tsx` | Extract from TradeModal, add Counter button |
| `components/PlayerList/PlayerList.tsx` | Trade cooldown, updated notification |
| `public/sounds/sfx/` | trade-accept.mp3, trade-reject.mp3 |

## Priority Order
1. **13.1** — Fix multiplayer accept bug (blocker)
2. **13.2** — Visual overhaul (biggest impact)
3. **13.5** — UX polish (low effort, high value)
4. **13.3** — Counter-offers (nice to have)
5. **13.4** — GOOJF trading (nice to have)
