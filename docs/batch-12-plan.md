# Batch 12: Sound Effects & Music

## Investigation Summary

### Current State
- Zero audio in the game — no sound hooks, no audio files, no context/provider
- Pixel art assets exist for minigames, sprites, tiles — all visual only
- Game phases that should have audio: rolling, landing, buying, rent, cards, jail, minigames, bankruptcy, game-over, turn transitions
- Casino theme throughout (gold/burgundy/felt-green) — audio should match Vegas energy
- Movement cutscene system (batch 6) has sprite animations that are silent
- Minigame plan (batch 10) mentioned "sound effect hooks: empty function stubs" — never implemented
- No `public/sounds/` or `public/audio/` directory exists yet

### Design Requirements
- Casino atmosphere: jazzy lounge BGM, slot machine jingles, chip sounds, card flips
- Pixel art consistency: 8-bit/chiptune SFX for minigame interactions
- Non-annoying: music should loop seamlessly, SFX shouldn't stack/overlap obnoxiously
- User control: mute toggle, separate volume for music vs SFX
- Performance: preload common sounds, use Web Audio API for low-latency playback
- Mobile: respect autoplay restrictions (unlock audio on first user interaction)

### Integration Points
- Every component that triggers a game action needs a sound call
- `context/GameContext.tsx` reducer: trigger SFX on state transitions
- `context/MultiplayerGameContext.tsx`: same triggers for multiplayer
- `components/Board/BoardCenterArt.tsx`: dice roll, buy, gamble, pay rent buttons
- `components/Board/Tile.tsx`: landing sounds
- `components/Minigames/`: each minigame needs interaction + result sounds
- `components/Board/PropertyPopup.tsx`: build/sell/mortgage clicks
- `components/PropertyCard/`: same actions from cards (batch 11)
- Cutscene system: footstep sounds during movement
- Lobby: ambient casino chatter, ready-up ding

---

## Batch 12.1: Audio Engine & Context

**New: `lib/audioEngine.ts`**

Singleton audio manager built on Web Audio API:
- `AudioEngine` class with single `AudioContext` instance
- Sound pool system: preloads sounds into `AudioBuffer` cache on init
- `play(soundId, options?)` — plays a sound with optional volume, pitch, pan
- `playMusic(trackId)` — starts looping background music with crossfade
- `stopMusic(fadeMs?)` — fades out current music
- `setMusicVolume(0-1)` / `setSfxVolume(0-1)`
- `mute()` / `unmute()` / `isMuted()`
- Handles mobile autoplay unlock: creates AudioContext on first user gesture via a one-time click/touch listener
- Prevents sound stacking: same sound can't play more than 3 overlapping instances
- `preload(soundIds[])` — batch preload for scene transitions (e.g., preload minigame sounds when entering minigame)

**New: `context/AudioContext.tsx`**

React context + provider wrapping the AudioEngine:
- `useAudio()` hook returns: `{ play, playMusic, stopMusic, sfxVolume, musicVolume, setSfxVolume, setMusicVolume, muted, toggleMute }`
- Persists volume/mute preferences to `localStorage`
- Initializes AudioEngine on mount, handles cleanup
- Wraps the app in `app/layout.tsx`

**New: `components/UI/AudioControls.tsx`**

Floating audio control widget:
- Small speaker icon in corner of screen (top-right, above game area)
- Click to toggle mute (speaker icon changes to muted)
- Hover/click expands to show two sliders: Music / SFX volume
- Collapses back after 3s of no interaction
- Casino-styled: gold icon, dark bg, matches theme
- Shows in all screens (lobby, game, menus)

---

## Batch 12.2: Sound Asset List & Generation

All sounds stored in `public/sounds/` as `.mp3` (broad compat) with `.ogg` fallback.

### SFX Categories

**Dice & Movement:**
- `dice-shake.mp3` — rattling dice (0.5s)
- `dice-roll.mp3` — dice hitting table (0.3s)
- `token-step.mp3` — single board step during movement/cutscene (0.1s, pitched differently per step)
- `token-land.mp3` — final landing thud (0.2s)
- `pass-go.mp3` — cash register cha-ching for collecting $200 (0.5s)

**Property:**
- `buy-property.mp3` — satisfying purchase stamp/ka-ching (0.4s)
- `decline-property.mp3` — subtle whoosh/pass (0.2s)
- `build-house.mp3` — construction hammer tap (0.3s)
- `sell-house.mp3` — reverse construction, wood creak (0.3s)
- `mortgage.mp3` — heavy stamp thud (0.3s)
- `unmortgage.mp3` — paper shuffle + light chime (0.3s)
- `full-set.mp3` — triumphant short jingle for completing a color group (1s)

**Money:**
- `pay-rent.mp3` — coins sliding across table (0.4s)
- `collect-money.mp3` — chips stacking (0.3s)
- `big-payment.mp3` — heavy coin pour for large amounts >$500 (0.5s)

**Cards:**
- `card-draw.mp3` — card flip from deck (0.2s)
- `card-good.mp3` — upbeat chime for positive cards (0.4s)
- `card-bad.mp3` — descending tone for negative cards (0.4s)
- `card-jail.mp3` — jail cell door clang (0.5s)

**Jail:**
- `go-to-jail.mp3` — dramatic gavel + cell slam (0.8s)
- `jail-escape.mp3` — lock picking + door creak (0.5s)
- `jail-fail.mp3` — metal clank of failed escape (0.3s)

**Minigames:**
- `minigame-intro.mp3` — 8-bit fanfare, minigame starting (1s)
- `slot-spin.mp3` — slot reel spinning loop (loopable)
- `slot-stop.mp3` — single reel stopping click (0.2s)
- `wheel-spin.mp3` — wheel of fortune spinning loop (loopable)
- `wheel-tick.mp3` — tick as wheel passes each segment (0.05s)
- `card-flip.mp3` — playing card flip for higher-lower/blackjack (0.15s)
- `dice-tumble.mp3` — craps dice bouncing (0.4s)
- `dart-throw.mp3` — whoosh + thud (0.3s)
- `dart-bullseye.mp3` — bullseye hit with crowd cheer (0.5s)
- `horse-gallop.mp3` — looping gallop (loopable)
- `mine-click.mp3` — tile reveal click (0.1s)
- `mine-boom.mp3` — explosion for mine hit (0.5s)
- `mine-safe.mp3` — gem sparkle for safe tile (0.2s)
- `safe-dial.mp3` — combination lock click (0.1s)
- `safe-crack.mp3` — vault opening (0.5s)
- `coin-flip-air.mp3` — coin spinning in air (0.3s)
- `blackjack-hit.mp3` — card dealt snap (0.15s)

**Minigame Results:**
- `tier-win.mp3` — big 8-bit victory fanfare + confetti (1.5s)
- `tier-close-win.mp3` — smaller victory chime (0.8s)
- `tier-close-loss.mp3` — descending "aww" tone (0.6s)
- `tier-loss.mp3` — sad trombone / failure buzzer (0.8s)
- `tier-catastrophic.mp3` — dramatic 8-bit explosion + skull (1.2s)

**Game Events:**
- `bankruptcy.mp3` — dramatic descending tone + crash (1s)
- `game-over.mp3` — victory fanfare for winner (2s)
- `turn-start.mp3` — subtle chime indicating your turn (0.3s)
- `turn-opponent.mp3` — quieter version for opponent turns (0.2s)
- `trade-offer.mp3` — notification ding (0.3s)
- `trade-accept.mp3` — handshake sound (0.4s)
- `trade-reject.mp3` — stamp rejection (0.3s)
- `chat-message.mp3` — subtle blip for incoming chat (0.1s)

**UI:**
- `button-hover.mp3` — subtle tick (0.05s)
- `button-click.mp3` — satisfying click (0.1s)
- `modal-open.mp3` — whoosh open (0.2s)
- `modal-close.mp3` — whoosh close (0.2s)
- `ready-up.mp3` — confirmation ding in lobby (0.3s)
- `player-join.mp3` — door open chime for lobby joins (0.3s)
- `countdown.mp3` — tick-tick-tick for game start countdown (0.5s per tick)

### Background Music

- `bgm-lobby.mp3` — chill jazzy lounge, casino ambiance (loop, ~60s)
- `bgm-game.mp3` — upbeat casino floor energy, piano + light percussion (loop, ~90s)
- `bgm-minigame.mp3` — 8-bit chiptune, faster tempo, arcade energy (loop, ~45s)
- `bgm-tension.mp3` — suspenseful variation for debt/bankruptcy moments (loop, ~30s)

All music tracks need clean loop points (no audible seam on repeat).

### Asset Sources
- Generate via AI music tools (Suno, Udio) for BGM
- Use royalty-free 8-bit SFX packs (freesound.org, opengameart.org)
- Or generate via sfxr/jsfxr for chiptune SFX
- Normalize all audio to -14 LUFS for consistent volume

---

## Batch 12.3: Game Phase Sound Triggers

Wire up SFX to every game state transition. Sounds triggered via `useAudio().play()` calls.

**BoardCenterArt.tsx (main game actions):**
- Roll button clicked → `dice-shake` then `dice-roll` after animation
- Buy button clicked → `buy-property`
- Decline/Pass → `decline-property`
- Gamble button → `minigame-intro`
- Pay Rent button → `pay-rent` (or `big-payment` if rent > $500)
- End Turn → `turn-start` for next player (or `turn-opponent` if not you)

**Movement (cutscene / token movement):**
- Each tile step → `token-step` with slight pitch variation per step
- Final landing → `token-land`
- Pass GO → `pass-go` layered over step sounds

**resolveLanding / phase transitions:**
- Land on own property → no sound (just land)
- Land on opponent property → `pay-rent` auto or pending
- Land on unowned property → `button-click` (buying prompt appears)
- Land on tax → `big-payment`
- Land on Chance/CC → `card-draw`
- Land on Go To Jail → `go-to-jail`
- Land on Free Parking → nothing special

**Cards:**
- Card drawn → `card-draw`
- Positive effect (collect money, GOOJF) → `card-good`
- Negative effect (pay money, go to jail) → `card-bad`
- Go to jail card specifically → `card-jail`

**Property actions (PropertyPopup + PropertyCard):**
- Build house → `build-house`
- Sell house → `sell-house`
- Mortgage → `mortgage`
- Unmortgage → `unmortgage`
- Color set completed → `full-set` (check after buy or trade)

**Jail:**
- Sent to jail → `go-to-jail`
- Escape attempt success (doubles or card) → `jail-escape`
- Escape attempt fail → `jail-fail`
- Pay bail → `pay-rent`

**Bankruptcy & Debt:**
- Enter debt phase → `bgm-tension` crossfade from `bgm-game`
- Resolve debt (paid off) → `collect-money` + crossfade back to `bgm-game`
- Declare bankruptcy → `bankruptcy`
- Asset transfer to creditor → `pay-rent` (bulk)

**Game Over:**
- Last player standing → `game-over` + stop BGM
- Winner announcement → brief silence then fanfare

**Trading:**
- Trade offer received → `trade-offer`
- Trade accepted → `trade-accept`
- Trade rejected → `trade-reject`

**Lobby:**
- Player joins room → `player-join`
- Player readies up → `ready-up`
- Game starting countdown → `countdown` ticks
- Chat message received → `chat-message`

---

## Batch 12.4: Minigame Audio

Each minigame component gets specific sound triggers:

**SlotMachine:** `slot-spin` (loop while reels spin), `slot-stop` (each reel stops)
**HigherLower:** `card-flip` (each card revealed)
**Craps:** `dice-tumble` (dice rolling)
**WheelOfFortune:** `wheel-spin` (loop), `wheel-tick` (per segment passed)
**MinesweeperLite:** `mine-click` (tile reveal), `mine-safe` or `mine-boom` (result)
**HorseRace:** `horse-gallop` (loop during race)
**DartThrow:** `dart-throw` (on throw), `dart-bullseye` (if bullseye)
**Blackjack:** `blackjack-hit` (each card dealt), `card-flip` (dealer reveal)
**CoinFlip:** `coin-flip-air` (each flip)
**SafeCracker:** `safe-dial` (each digit), `safe-crack` (if cracked)

**Results (all minigames):**
- Result tier → play corresponding `tier-{result}` sound
- Crossfade back to `bgm-game` from `bgm-minigame`

**Music transitions:**
- Entering minigame → crossfade `bgm-game` → `bgm-minigame` (500ms)
- Exiting minigame → crossfade back (500ms)

---

## Batch 12.5: Polish

**Spatial/contextual audio:**
- Opponent actions play at reduced volume (60%) compared to your own actions
- Rapid successive sounds (e.g., multiple steps) use pitch variation to avoid monotony
- Catastrophic tier: brief 200ms silence before explosion for dramatic effect

**Music system:**
- Smooth crossfades between all BGM tracks (500ms default)
- Music auto-pauses if tab loses focus (optional setting)
- Music volume ducks (reduces 50%) during important SFX (dice roll, bankruptcy, game-over)

**Settings persistence:**
- Music volume, SFX volume, mute state saved to localStorage
- Restore on page load

**Accessibility:**
- Respect `prefers-reduced-motion` — skip any audio-synced animations but keep audio
- Screen reader: audio controls have proper aria labels
- Mute keyboard shortcut: `M` key toggles mute (only when no text input focused)

**Performance:**
- Preload strategy: lobby sounds on app load, game sounds on room join, minigame sounds on minigame start
- Total audio budget: aim for <5MB total compressed
- Lazy load BGM tracks (larger files) on demand
- Clean up AudioBuffers when leaving game

---

## File Structure
```
lib/audioEngine.ts              — Web Audio API singleton manager
context/AudioContext.tsx         — React context + provider + useAudio hook
components/UI/AudioControls.tsx  — floating mute/volume widget
public/sounds/
  sfx/
    dice-shake.mp3
    dice-roll.mp3
    token-step.mp3
    token-land.mp3
    pass-go.mp3
    buy-property.mp3
    decline-property.mp3
    build-house.mp3
    sell-house.mp3
    mortgage.mp3
    unmortgage.mp3
    full-set.mp3
    pay-rent.mp3
    collect-money.mp3
    big-payment.mp3
    card-draw.mp3
    card-good.mp3
    card-bad.mp3
    card-jail.mp3
    go-to-jail.mp3
    jail-escape.mp3
    jail-fail.mp3
    bankruptcy.mp3
    game-over.mp3
    turn-start.mp3
    turn-opponent.mp3
    trade-offer.mp3
    trade-accept.mp3
    trade-reject.mp3
    chat-message.mp3
    button-hover.mp3
    button-click.mp3
    modal-open.mp3
    modal-close.mp3
    ready-up.mp3
    player-join.mp3
    countdown.mp3
  minigames/
    minigame-intro.mp3
    slot-spin.mp3
    slot-stop.mp3
    wheel-spin.mp3
    wheel-tick.mp3
    card-flip.mp3
    dice-tumble.mp3
    dart-throw.mp3
    dart-bullseye.mp3
    horse-gallop.mp3
    mine-click.mp3
    mine-boom.mp3
    mine-safe.mp3
    safe-dial.mp3
    safe-crack.mp3
    coin-flip-air.mp3
    blackjack-hit.mp3
    tier-win.mp3
    tier-close-win.mp3
    tier-close-loss.mp3
    tier-loss.mp3
    tier-catastrophic.mp3
  music/
    bgm-lobby.mp3
    bgm-game.mp3
    bgm-minigame.mp3
    bgm-tension.mp3
```

---

## Edge Cases
- **Mobile autoplay**: AudioContext created but suspended until first user tap. All `play()` calls silently no-op until unlocked. Show subtle "tap to enable audio" hint on mobile.
- **Tab backgrounded**: Music pauses/resumes on visibility change (optional, default on)
- **Rapid fire sounds**: Max 3 concurrent instances of same sound. 4th call kills oldest instance.
- **Missing audio file**: `play()` fails silently with console warning, never crashes game
- **Slow connection**: Game fully playable without audio loaded. Sounds play once available.
- **Multiple browser tabs**: Each tab has independent audio (no cross-tab conflicts)
- **Volume at 0**: Skip AudioBuffer decode entirely (save CPU)
