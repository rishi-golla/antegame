# Batch 11: Property Cards & Portfolio

## Investigation Summary

### Current State
- **PropertyPopup** (`components/Board/PropertyPopup.tsx`): full-screen overlay triggered by clicking board tiles. Shows deed info (rent table, price, mortgage, owner, houses). Has build/sell/mortgage/unmortgage actions for owned properties.
- **PlayerList** (`components/PlayerList/PlayerList.tsx`): left panel shows player name, money, property count ("3 props"), net worth, jail/bankrupt badges, trade button. No visual property cards — just a count.
- **SidePanel** (`components/SidePanel/SidePanel.tsx`): right panel with Chat/Game Log tabs. No property view.
- **Board tiles** (`components/Board/Tile.tsx`): small squares on the board, color-coded, show owner indicator + house dots.
- **Layout**: 3-column — leftPanel (players), board (center), rightPanel (chat/log). CSS grid.
- **Missing**: No way to see your property portfolio at a glance. No mini deed cards. No way to manage properties without clicking individual board tiles. No color-group completion indicator. No quick sell/mortgage during debt phase without hunting for tiles on the board.

### Design Requirements
- Property cards should look like mini Monopoly deed cards (color header, name, key info)
- Must fit casino/pixel art theme (Cinzel headings, Nunito body, gold/burgundy palette)
- Need to work during `in-debt` phase for quick liquidation (sell houses, mortgage)
- Cards should show at-a-glance: owned, mortgaged, houses, color group completion
- Responsive: cards stack/scroll in the available panel space

### Integration Points
- `components/PlayerList/PlayerList.tsx`: expand to show property cards below each player OR add a new tab
- `components/SidePanel/SidePanel.tsx`: add "Properties" as a third tab option
- `components/Board/PropertyPopup.tsx`: can reuse rent table data, but cards are a separate compact view
- `context/GameContext.tsx`: already has BUILD_HOUSE, SELL_HOUSE, MORTGAGE, UNMORTGAGE actions
- `lib/gameData.ts`: has `COLOR_GROUPS` mapping for group completion checks
- `app/globals.css`: new card styles needed

---

## Batch 11.1: Property Card Component

**New Component: `components/PropertyCard/PropertyCard.tsx`**

Mini deed card showing:
- **Color bar** at top (matching property color group)
- **Name** (truncated if long, full on hover)
- **Key stats**: rent, price, mortgage value
- **Status indicators**: house count (1-4 dots or hotel star), mortgaged badge (red "M" overlay), color group completion (gold border glow if full set owned)
- **Quick actions** (only shown when it's your turn + you own it):
  - Build House (if eligible) — small "+" button
  - Sell House (if eligible) — small "-" button
  - Mortgage — small "M" button
  - Unmortgage — small "U" button
- Actions respect all existing rules (even building, full group ownership, enough money, etc.)

Size: ~80px wide x ~110px tall (compact enough to show 4-6 in a row)

**Card variants by tile type:**
- **Property**: color bar + rent + house indicators
- **Railroad**: train icon in header, shows "1/4", "2/4" etc. for how many railroads owned
- **Utility**: lightbulb/water icon, shows "1/2" or "2/2"

**Visual states:**
- Normal: standard card appearance
- Mortgaged: grayscale/dimmed with red "MORTGAGED" stamp diagonally
- Full set: gold shimmer border (CSS animation) indicating player can build
- Hoverable: slight scale + shadow on hover, shows full property name tooltip

---

## Batch 11.2: View Assets Modal

**New Component: `components/PropertyCard/AssetsModal.tsx`**

Full-screen overlay modal triggered by a "View Assets" button at the bottom of the PlayerList (left panel).

**Trigger:**
- Button at bottom of PlayerList: "View Assets" (styled like existing casino buttons — gold border, burgundy bg)
- Always visible, shows your property count as badge: "View Assets (7)"
- When in `in-debt` phase, button pulses red/amber with "MANAGE ASSETS" label instead

**Modal layout:**
- Dark semi-transparent backdrop (same as PropertyPopup overlay style)
- Centered modal card, scrollable if needed
- Properties displayed as PropertyCards grouped by color group (brown → dark-blue, board order)
- Each group has a subtle header label ("Brown", "Light Blue", etc.)
- Properties within a group shown left-to-right, wrapping
- Railroad group and Utility group shown at the bottom
- Empty groups not shown
- Close button (X) top-right + click backdrop to close
- Player name + total cash + net worth shown at top of modal

---

## Batch 11.3: Debt Phase Property Management

**Enhanced debt-phase UX:**

When in `in-debt` phase, the Assets modal auto-opens and becomes the primary interaction:
- Auto-opens on entering debt phase
- Modal header turns red/amber with "RAISE FUNDS" label
- Each PropertyCard shows sell/mortgage actions prominently (larger buttons, highlighted)
- Running total at top of modal: "Need: $X | Have: $Y | Shortfall: $Z"
- Shortfall counter updates live as player sells/mortgages
- Once player has enough money, "Pay Debt" button appears at top of the modal (in addition to the board center button)
- "Declare Bankruptcy" button at bottom (red, smaller)
- Modal can be closed to view the board, button still pulses to reopen

**Quick liquidation helpers:**
- "Sell All Houses" button per color group (sells evenly, maximizes cash)
- "Mortgage All" button to mortgage all unmortgaged properties with no houses
- These are convenience shortcuts — they dispatch multiple SELL_HOUSE/MORTGAGE actions in sequence

---

## Batch 11.4: Opponent Property View

**Viewing other players' properties:**

- In PlayerList, clicking a player expands their property bar into full mini-cards (read-only, no actions)
- Or: clicking a player opens a modal/overlay showing their full portfolio
- Useful for trade decisions and assessing threats
- Shows same PropertyCard component but without action buttons
- Mortgaged properties visible (opponents can see what's mortgaged)

---

## Batch 11.5: Polish & Animations

**Card animations:**
- New property acquired: card slides in with gold sparkle effect
- Property lost (bankruptcy transfer): card fades out with red tint
- House built: small bounce animation on house indicator
- Mortgaged: card flips to show "MORTGAGED" back (CSS 3D flip with `steps()` for pixel feel)

**Color group completion celebration:**
- When a player completes a color group, brief gold glow pulse on all cards in that group
- Game log message: "{Player} completed the {Color} set!"
- Sound hook (empty stub for future audio)

**Responsive:**
- On narrow screens, property cards shrink to icon-size (just color dot + house count)
- On very small screens, collapse to just the property bar (color dots only)

**Tooltips:**
- Hover on any PropertyCard shows full PropertyPopup-style info (rent table, etc.)
- Works for both your own and opponents' cards

---

## CSS

**New classes:**
- `.propertyCard` — base mini card (80x110, rounded corners, dark bg, gold border)
- `.propertyCard.mortgaged` — grayscale filter, red stamp overlay
- `.propertyCard.fullSet` — gold shimmer border animation
- `.propertyCardColorBar` — top color stripe (8px height)
- `.propertyCardName` — Cinzel font, 0.6rem, truncated
- `.propertyCardStats` — Nunito, 0.55rem, muted color
- `.propertyCardHouses` — flex row of dots/stars for house count
- `.propertyCardActions` — action button row (compact)
- `.propertyGroup` — group wrapper with label
- `.propertyPortfolio` — scrollable container
- `.propertyBar` — compact color dots view in PlayerList
- `.debtPortfolio` — red/amber variant for in-debt phase
- `.debtCounter` — running total display
- `.quickLiquidate` — bulk action buttons

**Animations:**
- `@keyframes cardSlideIn` — new property acquisition
- `@keyframes cardFadeOut` — property lost
- `@keyframes goldShimmer` — full set border glow
- `@keyframes mortgageFlip` — 3D flip with `steps()`
- `@keyframes houseBounce` — house built indicator

---

## File Structure
```
components/PropertyCard/
  PropertyCard.tsx        — individual mini deed card
  AssetsModal.tsx         — full-screen modal with grouped property cards
  PropertyBar.tsx         — compact color-dot bar for PlayerList
  DebtPanel.tsx           — enhanced debt-phase management overlay
  propertyCardUtils.ts    — helpers (group ordering, completion checks, color maps)
```

---

## Edge Cases
- Player with 0 properties: Properties tab shows "No properties yet" message
- Mortgaged property in full set: gold border NOT shown (can't build when mortgaged)
- During opponent's turn: your cards show but actions are disabled (can't build/sell out of turn — except during in-debt phase which is always your turn)
- Property transferred via bankruptcy: card appears in new owner's portfolio immediately with slide-in animation
- Property transferred via trade: same slide-in animation
- Hotel (5 houses): show single star/hotel icon instead of 5 dots
- Railroad/utility: no house indicators, show ownership count instead (1/4, 2/2)
- Mobile: cards collapse to dots, tap to expand
- During minigame phase: properties tab accessible but actions disabled
