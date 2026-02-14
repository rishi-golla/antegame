# Batch 4: House Building, Trading, Mortgage, Auction

## Goal
Add the remaining core Monopoly mechanics: building houses/hotels, mortgaging properties, player-to-player trading, and property auctions when a landed property is declined.

## Phases

### 4.1 House Building & Selling (Engine + Tests)
- `buildHouse(state, playerIndex, tileIndex)` -> GameState
  - Validate: player owns full color group, no mortgaged properties in group
  - Validate: even building rule (can only build on lowest-housed property in group)
  - Validate: player has enough money (tile.houseCost)
  - Max 5 per property (5 = hotel)
  - Deduct money, increment houses record
- `sellHouse(state, playerIndex, tileIndex)` -> GameState
  - Validate: even selling rule (can only sell from highest-housed in group)
  - Refund half of houseCost
  - Decrement houses record
- Tests: even build/sell rules, cost deduction, hotel upgrade at 5, cannot build without full set, cannot build on mortgaged group

### 4.2 Mortgage & Unmortgage (Engine + Tests)
- `mortgageProperty(state, playerIndex, tileIndex)` -> GameState
  - Validate: player owns property, no houses on any property in same color group
  - Add to mortgaged array, credit mortgageValue
- `unmortgageProperty(state, playerIndex, tileIndex)` -> GameState
  - Validate: property is mortgaged, player has enough money (mortgageValue * 1.1)
  - Remove from mortgaged, deduct cost
- Tests: mortgage credits correct amount, cannot mortgage with houses, unmortgage costs 110%, cannot unmortgage non-mortgaged property

### 4.3 Auction System (Engine + Tests)
- New phases: `'auction'` (already in GamePhase type)
- `startAuction(state, tileIndex)` -> GameState
  - Sets phase to auction, stores auction state
- Add `AuctionState` to GameState: `{ tileIndex, currentBid, currentBidder, biddingOrder, activeIndex, passedPlayers }`
- `placeBid(state, playerIndex, amount)` -> GameState
  - Validate: bid > currentBid, player has enough money
  - Advance to next non-passed player
- `passAuction(state, playerIndex)` -> GameState
  - Mark player as passed, advance to next
  - If one player left, they win at current bid price
  - If all pass with no bids, property remains unowned
- Wire `declinePurchase` to trigger `startAuction` instead of just advancing phase
- Tests: bidding increments, pass eliminates, last bidder wins, all-pass returns unowned, can't bid more than money

### 4.4 Trading System (Engine + Tests)
- New phase: add `'trading'` to GamePhase
- `TradeOffer` type: `{ fromPlayer, toPlayer, offerMoney, requestMoney, offerProperties, requestProperties }`
- Add `activeTradeOffer: TradeOffer | null` to GameState
- `proposeTrade(state, offer)` -> GameState
  - Sets phase to trading, stores offer
  - Validate: offered properties owned by proposer, requested properties owned by target
- `acceptTrade(state)` -> GameState
  - Transfer properties and money between players
  - Clear offer, restore previous phase
- `rejectTrade(state)` -> GameState
  - Clear offer, restore previous phase
- Trading can happen during turn-end phase (current player's action)
- Tests: valid trade transfers correctly, invalid trade rejected, both sides validated

### 4.5 Multiplayer Socket Events
- Add socket events for all new actions:
  - `game:build-house`, `game:sell-house`
  - `game:mortgage`, `game:unmortgage`
  - `game:bid`, `game:pass-auction`
  - `game:propose-trade`, `game:accept-trade`, `game:reject-trade`
- Update `gameManager.ts` to handle new actions with validation
- Update `MultiplayerGameContext.tsx` dispatch cases
- Update `SocketContext.tsx` sendGameAction event map

### 4.6 Property Management UI
- Property popup (existing `PropertyPopup.tsx`) gets action buttons:
  - "Build House" (when eligible), "Sell House" (when has houses)
  - "Mortgage" / "Unmortgage" toggle
- Show house cost and mortgage value in popup
- Only show actions for properties you own, on your turn
- Visual feedback: disabled states, cost labels

### 4.7 Auction UI
- Auction modal/overlay when auction phase active
  - Show property being auctioned
  - Current bid and bidder
  - Bid input (increment buttons: +$10, +$50, +$100, custom)
  - Pass button
  - Highlight active bidder
- Timer optional (can add later for online play)

### 4.8 Trade UI
- Trade modal triggered from player list (click opponent -> "Propose Trade")
- Two-column layout: Your Offer | Your Request
  - Property cards (checkboxes from owned properties)
  - Money input (slider or number input)
- Recipient sees accept/reject modal with trade summary
- System chat message on trade completion

## Completion Criteria
- Houses/hotels can be built/sold following even-build rules
- Properties can be mortgaged/unmortgaged with correct costs
- Declining a purchase triggers auction among all non-bankrupt players
- Players can propose and accept/reject trades
- All actions work in both local and multiplayer modes
- All new engine functions have tests
- TS clean, build clean, all tests pass
