# Batch 7: Loud Casino Theme Revamp

## Goal
Transform the entire visual identity from dark space/navy theme to a loud, flashy casino aesthetic. Every screen should feel like you walked into a high-energy Vegas casino floor.

## Design Direction
- **Loud casino**: neon glows, gold accents, rich felt greens, deep reds/burgundy, flashing accents
- **Felt texture**: board and panels sit on casino felt (CSS gradient, no images)
- **Gold everywhere**: borders, accents, titles, winner highlights
- **Neon touches**: glowing text, pulsing borders, subtle light leaks
- **Casino typography**: bold display font for titles (e.g. Playfair Display or similar serif for that casino marquee feel), keep Nunito for body

## Phases

### 7.1: Color Palette and Foundations
- Replace ALL CSS custom properties in `:root`
  - `--bg-root`: deep casino green (#0b3d0b) or rich black (#0a0a0a)
  - `--bg-panel`: dark felt green with slight texture gradient
  - `--bg-card`: burgundy/maroon tint (#2a0f1f)
  - `--bg-elevated`: slightly lighter felt
  - `--accent`: casino gold (#d4af37)
  - `--accent-hover`: bright gold (#ffd700)
  - `--danger`: neon red (#ff1744)
  - `--success`: neon green (#00e676)
  - `--info`: electric blue (#00b0ff)
  - `--ink`: warm white (#fff8e7)
  - `--muted`: soft gold-gray
- Replace body background from space gradients to casino floor
  - Remove star particles (body::before)
  - Add subtle felt texture via repeating CSS gradients
  - Dark vignette around edges
- Import a display font for headings (Google Fonts -- Playfair Display, Cinzel, or similar)

### 7.2: Board Reskin
- Board background: dark green felt with gold border trim
- Tile backgrounds: darker felt with subtle emboss
- Property color strips: keep but add gold outline/bevel
- Corner tiles: casino-themed icons
  - GO: gold arrow with sparkle
  - Jail: iron bars on dark bg
  - Free Parking: casino chip icon
  - Go To Jail: red flashing border
- Tile hover: gold glow instead of blue
- Active tile: pulsing gold ring
- Token styling: make them look like casino chips (circular, ridged border, embossed letter)
- Board border: thick gold with inner shadow, like a framed table

### 7.3: Dice and Controls
- Dice: red translucent casino dice with white pips, rounded corners
- Dice focus layer: green felt backdrop instead of dark blur
- Roll button: styled as a gold chip or casino button with neon glow
- Buy/Pass buttons: chip-styled with embossed text
- Turn indicator: gold banner with player chip color accent
- Phase hints: neon sign style text

### 7.4: Side Panels
- Panel borders: gold trim with corner ornaments (CSS pseudo-elements)
- Player list: each player shown as a casino chip with their color
- Money display: styled like a casino credit counter (gold numbers, LED-segment feel)
- Chat: dark felt background, messages in speech bubbles with gold accent
- Panel tabs: styled like casino table placards
- Bankrupt badge: red "BUSTED" neon sign style
- Jail badge: black/white striped

### 7.5: Overlays and Modals
- Property popup: styled as a casino property deed with ornate gold border
- Trade modal: poker table felt background, cards/chips metaphor
- Game over: jackpot celebration -- gold confetti, flashing lights, slot-machine-style winner reveal
- All modal backdrops: smoky dark with subtle light rays

### 7.6: Setup, Menu, and Lobby
- Main menu: casino marquee title with flickering neon letters (CSS animation)
- "MONOPOLY" in bold serif with gold gradient and text-shadow glow
- Menu buttons: styled as casino chips (circular accents) or neon-bordered buttons
- Game setup: player color picker as casino chip selector
- Player name inputs: felt-textured with gold underline
- Lobby: VIP room aesthetic -- dark with gold accents, room code as "Table #"
- Copy code button: gold chip that flips on click
- Ready state: green neon "READY" glow

### 7.7: Animations and Micro-interactions
- Gold sparkle particles on important actions (property purchase, rent collection)
- Neon flicker on title text
- Chip stack animation on money changes
- Smooth felt-slide transitions between screens
- Button hover: neon glow intensifies
- Button press: chip press-down with shadow change
- Loading state: spinning roulette wheel or shuffling cards

## File Changes
- **Modified**: `app/globals.css` -- complete reskin (most lines change)
- **Modified**: `components/Board/Tile.tsx` -- chip tokens, corner icons
- **Modified**: `components/Board/Board.tsx` -- board frame styling classes
- **Modified**: `components/Board/BoardCenterArt.tsx` -- casino center art
- **Modified**: `components/Board/DicePips.tsx` -- red dice styling
- **Modified**: `components/Board/PropertyPopup.tsx` -- deed card design
- **Modified**: `components/Board/TradeModal.tsx` -- poker table style
- **Modified**: `components/GameSetup/GameSetup.tsx` -- chip selector, marquee title
- **Modified**: `components/GameOver/GameOver.tsx` -- jackpot celebration
- **Modified**: `components/Lobby/*.tsx` -- VIP room aesthetic
- **Modified**: `components/PlayerList/PlayerList.tsx` -- chip avatars, credit counter
- **Modified**: `components/SidePanel/*.tsx` -- felt panels, gold tabs
- **Modified**: `app/page.tsx` -- MainMenu marquee

## Completion Criteria
- Every screen screams "casino" -- no remnants of the space theme
- Gold, green felt, neon accents throughout
- Tokens look like casino chips
- Dice look like real casino dice
- All hover/active states use gold glow
- Consistent loud-but-cohesive visual language
- Typography hierarchy: display serif for titles, Nunito for body
- All 100 tests still pass
- No game logic changes
