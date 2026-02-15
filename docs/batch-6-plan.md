# Batch 6: Movement Cutscene System

## Goal
When a player rolls dice, instead of just sliding the token across the 2D board, trigger a cinematic side-view cutscene showing a sprite character running tile-by-tile to their destination. All players see the cutscene in multiplayer. The board remains 2D top-down at all times outside of cutscenes.

## Architecture

### Cutscene Flow
1. Player rolls dice -> server broadcasts `game:state` with new position
2. Client detects position change (existing logic in Board.tsx)
3. Instead of animating the token on the board, a **CutsceneOverlay** takes over
4. Overlay shows a side-scrolling street scene with the player's sprite running through each tile
5. Each tile the sprite passes is visually represented (property color, name, icons)
6. Duration scales with tile count (~400ms per tile, so 2 tiles = ~0.8s, 12 tiles = ~4.8s)
7. When sprite reaches destination, brief "landing" animation, then overlay fades out
8. Board updates token position (instant, no step animation since cutscene handled it)

### Multiplayer Sync
- No new socket events needed -- the cutscene is triggered client-side when `game:state` arrives with a position change
- All clients detect the same position delta and play the same cutscene
- The cutscene is purely visual -- game state is already updated server-side

### Sprite System
- CSS sprite sheets for character run cycle (no canvas/WebGL)
- Each player gets a sprite colored to match their token color
- Run cycle: 4-6 frame loop using CSS `steps()` animation
- Landing: character stops, brief bounce/settle

## Phases

### 6.1: Cutscene Overlay Component
- New `components/Board/CutsceneOverlay.tsx`
- Full-screen overlay with semi-transparent backdrop (like dice focus layer)
- Side-scrolling container that moves left as sprite advances
- Props: `playerColor`, `playerName`, `tiles` (array of tile data for each step), `onComplete` callback
- Tile representation: colored rectangles with property name, matching board colors
- Street/sidewalk baseline graphic (CSS-drawn, no assets needed)

### 6.2: Sprite Character
- CSS-animated sprite character using `div` elements (no image assets)
- Body parts: head (circle), body (rectangle), legs (animated rectangles)
- Run cycle via CSS keyframes with `steps()` or smooth transforms
- Character colored to match player token color
- States: running, landing (bounce), idle
- Scale: ~40-60px tall relative to tile "buildings"

### 6.3: Tile Scene Rendering
- Each tile rendered as a "building" or landmark in the side-view
- Properties: colored building facade matching group color, name on sign
- Railroads: train track icon
- Utilities: lightbulb/water drop icon
- Corners: GO (green arrow), Jail (bars), Free Parking (P sign), Go To Jail (police)
- Tax: dollar sign
- Chance/Community Chest: card icon
- Buildings scroll left as sprite runs right (parallax optional)

### 6.4: Integration with Board.tsx
- Modify Board.tsx movement detection to trigger cutscene instead of step animation
- Add state: `cutscene: { active: boolean, playerIndex: number, fromTile: number, toTile: number, steps: number[] }`
- When cutscene completes (`onComplete`), update display positions instantly
- Jail teleport and large jumps still skip cutscene (direct position update)
- Disable roll button and other controls during cutscene

### 6.5: Timing and Polish
- Duration per tile: ~350-400ms (configurable)
- Easing: sprite accelerates at start, decelerates at end
- Camera tracks sprite (CSS transform on container)
- Passing GO: brief green flash effect
- Landing on owned property: rent warning flash
- Sound-ready hooks (no audio yet, but structured for future SFX)

### 6.6: Multiplayer Verification
- Test that all clients trigger cutscene on position change
- Test that cutscene doesn't block game state updates
- Test rapid successive rolls (doubles) queue cutscenes properly
- Verify jail teleport skips cutscene
- Verify card-based movement (Advance to X) triggers cutscene with correct path

## File Changes
- **New**: `components/Board/CutsceneOverlay.tsx` -- main cutscene component
- **New**: `components/Board/CutsceneSprite.tsx` -- CSS sprite character
- **New**: `components/Board/CutsceneTile.tsx` -- side-view tile rendering
- **Modified**: `components/Board/Board.tsx` -- cutscene trigger logic
- **Modified**: `app/globals.css` -- cutscene animations and styles
- **Modified**: `app/page.tsx` -- render CutsceneOverlay at page root if needed

## Completion Criteria
- Rolling dice triggers a side-view cutscene for all players
- Sprite visually runs through each intermediate tile
- Duration scales with distance
- Cutscene does not break game state or multiplayer sync
- Jail teleports and card jumps handled gracefully
- All 100 existing tests still pass
- No new game logic changes (purely visual feature)
