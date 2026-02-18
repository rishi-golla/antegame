# Economy Upgrade Plan — Monopoly Game

## Problem Statement

Games drag on forever because:
1. **No incentive to build** — players hoard cash, base rents are too low to kill anyone
2. **No money drain** — GO salary ($200/lap) pumps infinite cash into the economy with no sink besides low rents and occasional taxes
3. **No escalation mechanic** — nothing forces the game toward a conclusion
4. **Declined properties vanish** — no auctions mean prime properties go unowned, reducing rent exposure
5. **No housing scarcity** — unlimited houses means no strategic "housing shortage" play

The result: two players can orbit the board for 100+ rounds, both sitting on $3000+ cash with unimproved properties, neither dying because base rents ($2-$50) are noise.

---

## Economic Analysis

### Why Classic Monopoly Actually Ends

In real Monopoly, games end because of **three converging pressures**:

1. **Housing shortage** — Only 32 houses and 12 hotels exist physically. Smart players buy houses and *never upgrade to hotels* (returning houses to supply), starving opponents of the ability to develop. This is the #1 competitive strategy.

2. **Auction mechanic** — When a player declines to buy, the property goes to auction. This ensures ALL properties get owned quickly, maximizing rent exposure.

3. **Rent escalation curve** — A fully developed color group (3 houses+) creates "kill zones" where landing costs $500-$1700. With 2-3 of these on the board, someone dies within a few laps.

### The Math of Our Problem

Current economy flow per lap (avg):
- **Income**: $200 (GO) + ~$15 avg rent collected = ~$215/lap
- **Expense**: ~$30 avg rent paid + ~$10 tax = ~$40/lap  
- **Net gain per lap**: ~$175

At this rate, players accumulate cash faster than they lose it. The only way to lose is landing on a fully developed property ($500+), which requires someone to have invested $500-$1000 in houses first — money they could've kept safe as cash.

**The rational strategy is: never build.** Which means nobody ever dies.

### What Great Game Economies Do

Drawing from economic game design principles (Settlers of Catan, Ticket to Ride, Power Grid):

1. **Resource scarcity creates tension** — limited supply forces decisions
2. **Escalating costs/diminishing returns** — early investment is efficient, late investment is expensive
3. **Positive feedback loops with countermeasures** — leaders get stronger but face increasing costs
4. **Time pressure** — games MUST end, either through a hard timer or inevitable economic collapse

---

## The Plan: 7 Interconnected Systems

### 1. Property Auctions (Critical — Solves Unowned Properties)

**When a player declines to buy a property, it goes to auction.**

- All players (including the one who declined) can bid
- Bidding starts at $1, goes up in any increment
- 10-second timer per bid (auto-pass if no bid)
- Highest bidder wins, pays their bid amount
- If nobody bids, property stays with the bank

**Why**: This ensures all properties get owned within the first 10-15 rounds. More owned properties = more rent paid = faster cash drain.

**Implementation**: New `auction` game phase, `AuctionOverlay` component, server-side bid tracking.

### 2. Housing Scarcity (Critical — Forces Strategy)

**Global housing supply: 32 houses, 12 hotels.**

- Track `globalHouses` and `globalHotels` on GameState
- Building a house decrements `globalHouses`
- Upgrading to hotel: return 4 houses to supply, take 1 hotel
- If no houses available, nobody can build (even if they have the money/monopoly)
- Selling a house returns it to supply

**Why**: This is THE competitive mechanic of Monopoly. Players who build first lock out opponents. Creates a race to develop, which means spending money early (good for game pace). The "housing shortage" strategy (buy 4 houses per property, never upgrade to hotel) is a real competitive play that adds depth.

**Implementation**: Add `globalHouses: number` and `globalHotels: number` to GameState. Modify `buildHouse()` to check/decrement supply.

### 3. Escalating Rent Multiplier (Accelerates Endgame)

**After round N, all rents increase by a multiplier.**

| Round | Rent Multiplier |
|-------|----------------|
| 1-15  | 1.0x (normal)  |
| 16-25 | 1.25x          |
| 26-35 | 1.5x           |
| 36-45 | 2.0x           |
| 46+   | 3.0x           |

A "round" = every player has taken one turn.

**Why**: This is the key anti-stall mechanic. Even if nobody builds, rents naturally increase. A base rent of $22 becomes $66 after round 36. Combined with developed properties, this creates inevitable bankruptcies. Inspired by Power Grid's resource market escalation.

**Implementation**: Add `roundNumber` to GameState (increment when `currentPlayerIndex` wraps to 0). Apply multiplier in `calculateRent()`. Show current multiplier in UI.

### 4. Diminishing GO Salary (Inflation Control)

**GO salary decreases over time to reduce cash injection.**

| Round | GO Salary |
|-------|-----------|
| 1-15  | $200      |
| 16-25 | $150      |
| 26-35 | $100      |
| 36+   | $50       |

**Why**: The economy has a single cash source (GO) and multiple sinks (rent, tax, building). By throttling the source while sinks increase (via rent multiplier), you create a deflationary spiral that forces action. This mirrors real economic contractions — money becomes scarce, assets become king.

**Implementation**: Replace `GO_SALARY` constant with a function `getGoSalary(roundNumber)`.

### 5. Property Tax Assessment (Periodic Cash Drain)

**Every 10 rounds, all players pay property tax: 10% of their total asset value.**

- Total asset value = property prices + house values (at full cost, not half)
- If a player can't pay, they must sell/mortgage to cover it
- Tax goes to Free Parking pot (or just vanishes as a pure sink)

**Why**: This punishes cash hoarding. A player sitting on $3000 cash and $2000 in properties still loses $200 every 10 rounds. Forces players to either invest (building houses to earn rent > tax) or liquidate. Creates natural pressure cycles.

**Implementation**: Check in `endTurn()` when round milestones hit. New `tax-assessment` phase where each player resolves their payment.

### 6. Improved Card Effects (More Disruption)

**Add/modify Chance and Community Chest cards to create more economic chaos:**

New cards to add:
- **"Market Crash"** — All properties lose 1 house level (hotels → 4 houses, etc.)
- **"Housing Boom"** — 8 extra houses added to global supply this round
- **"Tax Audit"** — Pay 15% of total cash to bank
- **"Rent Strike"** — Your properties collect no rent for 1 full round
- **"Windfall"** — Receive $50 per property you own
- **"Eminent Domain"** — Bank buys back one of your properties at mortgage value (random)
- **"Interest Rate Hike"** — All mortgage interest doubled this round (20% instead of 10%)

**Why**: Cards inject controlled chaos and prevent predictable equilibriums. They can accelerate or disrupt, keeping games dynamic.

**Implementation**: Add new card types with corresponding effect handlers in `applyCardEffect()`.

### 7. Smart Endgame Timer (Hard Cap)

**After 50 rounds, the game enters "Final Rounds" mode:**

- Announcement: "The market is collapsing! 10 rounds remaining."
- All rents are 4x
- GO salary drops to $0
- No new building allowed
- After 60 total rounds: game ends, richest player (by net worth) wins

**Why**: This is the nuclear option — guarantees no game exceeds ~60 rounds. The escalating multipliers (Systems 3 & 4) should end most games by round 30-40. This is the hard backstop.

**Implementation**: Add end-game state tracking. `calculateRent()` checks for final rounds. Winner determined by `getNetWorth()` which already exists.

---

## Priority Order (What to Build First)

### Phase 1 — Core Economy Fix (Biggest Impact)
1. **Round tracking** — Foundation for everything else
2. **Escalating rent multiplier** — Single biggest impact on game length
3. **Diminishing GO salary** — Complements rent escalation
4. **Smart endgame timer** — Hard guarantee games end

### Phase 2 — Strategic Depth
5. **Housing scarcity** — Adds the deepest strategic layer
6. **Property auctions** — Ensures properties circulate

### Phase 3 — Polish
7. **Property tax assessment** — Extra pressure
8. **Improved card effects** — Chaos and variety

---

## Expected Impact

| Metric | Current | After Phase 1 | After Phase 2 |
|--------|---------|---------------|---------------|
| Avg game length | 80-∞ rounds | 30-45 rounds | 20-35 rounds |
| Avg game time (2P) | 45-90+ min | 20-30 min | 15-25 min |
| Strategic depth | Low (hoard cash) | Medium (timing) | High (housing race, auctions) |
| Player interaction | Low | Medium | High (auctions, scarcity) |

---

## Technical Notes

- All new state fields need to be added to `GameState` type in `types/game.ts`
- Server-side and client-side game engines must stay in sync
- Auction system needs real-time bidding via socket events
- UI needs: round counter display, rent multiplier indicator, housing supply counter, auction overlay
- All changes are backward-compatible (new fields have defaults)

---

## References & Inspiration

- **Monopoly tournament strategy** (housing shortage is the #1 competitive strategy in tournament play)
- **Power Grid** (Friedemann Friese) — escalating resource costs force economic pressure
- **Settlers of Catan** (Klaus Teuber) — resource scarcity drives trading and conflict
- **Henry George's "Progress and Poverty" (1879)** — the original economic theory Monopoly was designed to teach: land monopolists extract rent while producing nothing, leading to wealth concentration and eventual systemic collapse
- **Keynesian multiplier effect** — money velocity matters more than money supply; our rent multiplier increases velocity
- **Game theory: Nash equilibrium** — current game has a stable equilibrium at "don't build" which is degenerate; adding scarcity and time pressure creates mixed-strategy equilibria that are more interesting
