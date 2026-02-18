# Batch 15: Landing Page Revamp (Chumbi-Style Hero)

## Goal
Replace the current ConnectScreen (small centered card) with a full scrollable landing page inspired by chumbivalley.com, using our existing pixel-art casino assets and a dark burgundy/gold/neon aesthetic.

## Reference
- **Chumbi Valley** (chumbivalley.com): Full-viewport illustrated hero, sticky nav, about section, feature showcase panels, footer
- **Ante twist**: Casino noir instead of forest. Pixelated chibi characters. Neon accents. Dark burgundy (#52142c) + gold (#d4a843) + neon pink/magenta palette.

## Existing Assets Available
- Character sprites: high-roller, singer, dealer, mobster, card-shark, tourist, vip, bartender (public/assets/sprites/)
- Board tiles: all property colors, corners, utilities, railroads, chance, community chest (public/assets/tiles/)
- Misc: ante-logo.webp, casino-crest.webp, chance-deck.webp, community-chest-deck.webp (public/assets/misc/)
- Minigame assets: slots, cards, dice, wheel, minesweeper, horses, darts, coin, safe, results (public/assets/minigames/)

## Assets to Generate
- **Hero background**: Wide casino interior panorama (pixel art, same style as existing assets). Neon signs, card tables, slot machines, velvet curtains. ~1920x1080 or tileable.
- **Section divider**: Decorative horizontal bar with card suits or poker chips (pixel art, transparent PNG)

---

## Batch 15.1 — Component Architecture & Routing

**Files:**
- Create `components/Landing/HeroSection.tsx`
- Create `components/Landing/AboutSection.tsx`
- Create `components/Landing/FeaturesSection.tsx`
- Create `components/Landing/CTASection.tsx`
- Create `components/Landing/LandingNav.tsx`
- Create `components/Landing/LandingFooter.tsx`
- Create `components/Landing/LandingPage.tsx` (assembles all sections)
- Refactor `app/page.tsx` to render LandingPage when unauthenticated (instead of ConnectScreen)

**Logic:**
- Wallet connect handlers (handleBase, handleSolana, onFreePlay) move into LandingPage and get passed down to LandingNav (nav CTA) and CTASection (bottom CTA)
- ConnectScreen.tsx remains as a fallback but is no longer the default entry point
- Auth state check stays in page.tsx — authenticated users skip landing, go straight to lobby

---

## Batch 15.2 — Hero Section

**Layout (full viewport, 100vh):**
- Background: Generated casino interior panorama (fixed/parallax)
- Top: LandingNav (sticky) — Ante logo (left), nav links (center: How It Works, Minigames, About), "Connect Wallet" button (right), audio toggle
- Center: Large "ANTE" title (stylized, pixel font or the existing ante-logo.webp scaled up)
- Below title: Tagline "Stake crypto. Roll dice. Win the pot."
- Below tagline: Social icons row (Twitter/X, Discord, Telegram)
- Bottom edges: 2-3 chibi character sprites (dealer, high-roller, singer) positioned like Chumbi's characters sitting on the cliff edge
- Floating pixel-art elements: poker chips, dice, cards drifting with subtle CSS animation

**CSS:**
- Dark gradient overlay on hero background for text readability
- Title: text-shadow with gold glow
- Nav: semi-transparent dark background, blur backdrop
- Parallax: background-attachment: fixed (or transform-based for mobile)

---

## Batch 15.3 — About Section

**Layout:**
- Dark solid background (#1a0a14 or similar deep burgundy-black)
- Decorative divider line with card suit symbols (or generated pixel divider asset)
- Centered heading: "About" (large, bold, pixel-style or chunky font)
- Body text: "Ante is a multiplayer crypto board game on Base. Stake ETH, roll dice, land on properties, and play casino minigames to win — or lose — it all. The pot goes to the last player standing."
- Optional: casino-crest.webp as a watermark or accent

---

## Batch 15.4 — Features Showcase

**Layout (alternating image/text panels like Chumbi):**

Panel 1 — "The Board" (image left, text right)
- Image: Composite of board tile assets or a screenshot of the actual board
- Title: "The Board"
- Text: "40 casino-themed properties across 8 color sets. Buy, build, and bankrupt your opponents."

Panel 2 — "Minigames" (image right, text left)
- Image: Grid/collage of minigame assets (slots, blackjack, wheel, dice)
- Title: "10 Casino Minigames"
- Text: "Land on Risk or Blind Chest and play blackjack, slots, craps, darts, and more. Win big or lose your stake."

Panel 3 — "On-Chain" (image left, text right)
- Image: Casino crest + chain/lock pixel art
- Title: "Fully On-Chain"
- Text: "Smart contract escrow on Base. Every game is settled transparently. Your crypto, your keys."

Panel 4 — "Multiplayer" (image right, text left)
- Image: Multiple character sprites together
- Title: "Play With Friends"
- Text: "Create private rooms, invite friends, or jump into quick play. Up to 6 players per game."

**CSS:**
- Each panel is ~80-100vh
- Fade-in-on-scroll animation (IntersectionObserver)
- Images have subtle float/bob animation

---

## Batch 15.5 — CTA Section + Footer

**CTA Section:**
- Dark background with neon glow accents
- Heading: "Ready to Ante Up?"
- Two buttons: "Connect with Base" (primary, gold), "Play for Free" (secondary, outline)
- "Solana Coming Soon" badge/text
- These buttons use the same wallet connect logic from the original ConnectScreen

**Footer:**
- Dark background
- Left: Ante logo
- Center: Link columns (How It Works, Minigames, About, Leaderboard)
- Right: Social icons (Twitter/X, Discord, Telegram)
- Bottom: "Copyright 2026" + "Built on Base"

---

## Batch 15.6 — Responsive & Polish

- Mobile breakpoints: stack hero elements vertically, single-column features, hamburger nav
- Scroll animations: fade-in sections via IntersectionObserver (no heavy libs)
- Smooth scroll for nav links (#about, #features, etc.)
- Audio toggle in nav (reuse existing AudioContext)
- Performance: lazy-load feature panel images
- OG meta tags update for the landing page

---

## Priority Order
15.1 (architecture) → 15.2 (hero) → 15.3 (about) → 15.4 (features) → 15.5 (CTA + footer) → 15.6 (responsive + polish)

## Git
- Branch: `landing-page-revamp`
- Conventional commits, no emojis
- Atomic commits per sub-batch
