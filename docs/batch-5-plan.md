# Batch 5: Design Polish

## Goal
Transform the functional but plain UI into a polished, indie-game aesthetic. Better typography, color palette, spacing, micro-interactions, and responsive layout.

## Phases

### 5.1 Color Palette & Typography
- Define CSS custom properties for consistent theming (backgrounds, surfaces, borders, text levels)
- Import a distinctive font (e.g. Space Grotesk or Inter) via next/font
- Apply consistent font sizing scale across all components
- Dark theme refinement: deeper backgrounds, better contrast ratios

### 5.2 Board Visual Upgrade
- Color-coded tile strips matching Monopoly property groups (brown, light-blue, pink, etc.)
- Better tile hover states and active tile glow
- Smoother token design (rounded, shadowed, slight 3D effect)
- Tile text truncation with tooltip for long names
- Corner tiles get distinct styling (GO arrow, jail bars icon, parking, police)

### 5.3 Center Area & Controls
- Refined roll button with hover/press states and glow effect
- Better card draw animation and card visual design
- Cleaner turn indicator with animated transition between players
- Status text improvements (phase hints)

### 5.4 Side Panels
- Player list: card-style entries, cleaner badges (jail, bankrupt), property count icons
- Chat: message bubbles with proper spacing, timestamps, system message styling
- Game log: color-coded entries, player avatars inline
- Panel toggle with animated underline indicator

### 5.5 Overlays & Modals
- Auction overlay: property card preview, animated bid counter
- Trade notification: subtle pulse animation on arrival
- Property popup: property card design matching the board colors
- Game over screen: confetti or particle effect, smoother rankings

### 5.6 Setup & Lobby Screens
- Main menu: title treatment with subtle animation
- Game setup: better color picker (visual swatches instead of auto-assign)
- Lobby: copy-code button with feedback toast, player cards with ready animation

### 5.7 Responsive & Micro-interactions
- Board scales properly on different screen sizes
- Smooth transitions on state changes (money updates, property acquisition)
- Button press feedback across all interactive elements
- Loading/connecting states

## Completion Criteria
- Consistent visual language across all screens
- All interactive elements have hover/active/disabled states
- Dark theme with good contrast and readability
- No visual regressions -- all functionality still works
- Indie game vibe: playful but clean
