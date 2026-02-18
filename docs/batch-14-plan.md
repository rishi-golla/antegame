# Batch 14: Minigame & Stability Fixes

## Issues reported (4-player game test)

### 14.1 — Minigame spectator mode (CRITICAL)
- **Bug**: When one player enters a minigame, ALL players see the interactive minigame on their screen
- **Expected**: Only the active player plays. Others see a "watching" overlay with the player's name
- **Fix**: In MinigameOverlay, check if current user is the active player. If not, show spectator view.

### 14.2 — Safe Cracker too hard
- **Bug**: 3 digits × 10 values = 1000 combinations, only 3 attempts = nearly impossible
- **Fix**: Reduce to 3 digits × 5 values (0-4), give 4 attempts, extend timeout to 45s

### 14.3 — Slot machine feels like replaying
- **Bug**: Pull lever + click 3 reels = 4 interactions feels like playing multiple times
- **Note**: This is by design (each reel stops independently) but UX is confusing
- **Fix**: Auto-stop reels with staggered timing after lever pull. Player just pulls once.

### 14.4 — Game gets stuck after minigame (CRITICAL)
- **Bug**: After slot machine, timer stopped and game was infinitely bugged
- **Root cause**: Likely the 30s timeout fires `onResult('catastrophic')` while result is already being processed, or the minigame result doesn't properly transition back to game state
- **Fix**: Add guard in MinigameOverlay to prevent double-result. Clear timeout on any result.

### 14.5 — All-players-leave refund system
- **Bug**: If game gets stuck, all money is lost
- **Fix**: Server tracks disconnections. If ALL players disconnect/leave during a game, auto-cancel and sign refund for each. Store pending refunds in a simple JSON so players can claim later from their profile.

### 14.6 — View Assets not centered
- **Bug**: Assets modal text and pictures not displayed properly
- **Fix**: CSS fixes for AssetsModal

## Priority
14.4 → 14.1 → 14.5 → 14.2 → 14.3 → 14.6
