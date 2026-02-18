'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingNav from '@/components/Landing/LandingNav';
import LandingFooter from '@/components/Landing/LandingFooter';

interface DocSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const sections: DocSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    content: (
      <>
        <p>
          Ante is a multiplayer crypto board game built on Base (Ethereum L2). Players stake ETH to enter,
          roll dice around a 40-tile casino-themed board, buy properties, pay rent, and play minigames.
          The last player standing wins the pot.
        </p>
        <h3>Quick Start</h3>
        <ol>
          <li>Connect your wallet (MetaMask, Coinbase, WalletConnect)</li>
          <li>Set up your profile — pick a name and character</li>
          <li>Create a room, join with a code, or hit Quick Play</li>
          <li>Stake your ETH and roll the dice</li>
        </ol>
      </>
    ),
  },
  {
    id: 'board',
    title: 'The Board',
    content: (
      <>
        <p>
          The board has 40 tiles arranged in a square, just like classic Monopoly — but every property
          is a casino venue.
        </p>
        <h3>Tile Types</h3>
        <ul>
          <li><strong>Properties</strong> — 8 color sets (Brown, Light Blue, Pink, Orange, Red, Yellow, Green, Dark Blue). Buy them, build houses, charge rent.</li>
          <li><strong>Railroads</strong> — 4 railroad tiles. Rent scales with how many you own.</li>
          <li><strong>Utilities</strong> — Electric Company &amp; Water Works. Rent = dice roll multiplier.</li>
          <li><strong>Risk (Chance)</strong> — Draw a card. Could be good, could be bad. Sometimes triggers a minigame.</li>
          <li><strong>Blind Chest (Community Chest)</strong> — Mystery cards with rewards or penalties. Can trigger minigames.</li>
          <li><strong>Tax</strong> — Pay a fixed tax to the pot.</li>
          <li><strong>Corners</strong> — GO (collect salary), Jail, Free Parking, Go to Jail.</li>
        </ul>
        <h3>Building</h3>
        <p>
          Once you own all properties in a color set, you can build houses (up to 4) and then a hotel.
          Each house increases rent dramatically. You can also mortgage properties for quick cash.
        </p>
      </>
    ),
  },
  {
    id: 'minigames',
    title: 'Minigames',
    content: (
      <>
        <p>
          When you land on Risk or Blind Chest, you may trigger a minigame. The result affects your
          in-game balance — win big or lose your stake.
        </p>
        <h3>All 10 Minigames</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Game</th><th>How It Works</th><th>Payout Range</th></tr>
          </thead>
          <tbody>
            <tr><td>Blackjack</td><td>Classic 21 against the dealer</td><td>0x – 2x</td></tr>
            <tr><td>Slots</td><td>Pull the lever, reels auto-stop</td><td>0x – 5x</td></tr>
            <tr><td>Wheel of Fortune</td><td>Spin and land on a multiplier</td><td>0.25x – 5x</td></tr>
            <tr><td>Craps</td><td>Roll dice, hit your number</td><td>0x – 3x</td></tr>
            <tr><td>Coin Flip</td><td>Best of 3 heads/tails calls</td><td>0.5x – 2x</td></tr>
            <tr><td>Horse Race</td><td>Pick a horse, watch the race</td><td>0x – 4x</td></tr>
            <tr><td>Dart Throw</td><td>Aim for bullseye (click timing)</td><td>0.25x – 3x</td></tr>
            <tr><td>Minesweeper</td><td>Reveal gems, avoid mines, cash out</td><td>0x – 4x</td></tr>
            <tr><td>Safe Cracker</td><td>Guess the 3-digit combo (0-4)</td><td>0x – 5x</td></tr>
            <tr><td>Higher or Lower</td><td>Guess if next card is higher/lower</td><td>0x – 3x</td></tr>
          </tbody>
        </table>
        <p>
          Only the active player plays the minigame. Other players see a spectator view with the
          player&apos;s name and result.
        </p>
      </>
    ),
  },
  {
    id: 'trading',
    title: 'Trading',
    content: (
      <>
        <p>
          You can propose trades with other players at any time during your turn. Trades can include
          properties and in-game cash.
        </p>
        <h3>How to Trade</h3>
        <ol>
          <li>Click another player in the player list</li>
          <li>Select properties and/or cash to offer and request</li>
          <li>Send the offer — the other player can accept, reject, or counter</li>
        </ol>
        <p>
          Counter-offers bounce back and forth until both sides agree or someone cancels.
          Mortgaged properties can be traded (the new owner inherits the mortgage).
        </p>
      </>
    ),
  },
  {
    id: 'onchain',
    title: 'On-Chain Settlement',
    content: (
      <>
        <p>
          Ante uses smart contracts on Base for escrow and settlement.
        </p>
        <h3>How It Works</h3>
        <ol>
          <li><strong>Game Creation</strong> — A game is registered on-chain with a unique ID and stake amount.</li>
          <li><strong>Joining</strong> — Each player sends their stake to the MonopolyGame contract. Funds are held in escrow.</li>
          <li><strong>Playing</strong> — Game logic runs on the server in real-time. The blockchain isn&apos;t involved during gameplay.</li>
          <li><strong>Settlement</strong> — When the game ends, the server signs a settlement message. The winner calls the contract to claim the pot.</li>
          <li><strong>Refunds</strong> — If all players disconnect or the game is cancelled, each player can claim a refund via the FeeVault contract.</li>
        </ol>
        <h3>Contracts</h3>
        <ul>
          <li><strong>MonopolyGame.sol</strong> — Escrow, game registration, settlement</li>
          <li><strong>FeeVault.sol</strong> — Fee collection and refund management</li>
        </ul>
      </>
    ),
  },
  {
    id: 'rooms',
    title: 'Rooms & Matchmaking',
    content: (
      <>
        <h3>Room Types</h3>
        <ul>
          <li><strong>Create Room</strong> — Set a stake amount and player count. Share the room code with friends.</li>
          <li><strong>Join Room</strong> — Enter a room code to join a friend&apos;s game.</li>
          <li><strong>Quick Play</strong> — Auto-matchmaking. Choose a stake tier and get paired with other players.</li>
          <li><strong>Free Play</strong> — No wallet needed. Play locally against bots with fake money.</li>
        </ul>
        <h3>In the Lobby</h3>
        <p>
          Once in a room, players can see who&apos;s joined, ready up, and chat. The host can start the game
          once the minimum player count is reached and everyone is ready.
        </p>
      </>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ',
    content: (
      <>
        <div className="docsFaq">
          <h3>Is there a house edge?</h3>
          <p>No. Ante is player-vs-player. The only fee is a small percentage that goes to the FeeVault for platform maintenance.</p>
        </div>
        <div className="docsFaq">
          <h3>What happens if I disconnect?</h3>
          <p>Your turn timer continues. If you don&apos;t reconnect before it expires, your turn is auto-skipped. If ALL players disconnect, the game is cancelled and refunds are available.</p>
        </div>
        <div className="docsFaq">
          <h3>Which wallets are supported?</h3>
          <p>MetaMask, Coinbase Wallet, and any WalletConnect-compatible wallet. Solana support is coming soon.</p>
        </div>
        <div className="docsFaq">
          <h3>What chain is Ante on?</h3>
          <p>Base (Ethereum L2). Low gas fees, fast transactions.</p>
        </div>
        <div className="docsFaq">
          <h3>Can I play for free?</h3>
          <p>Yes — Free Play mode lets you play locally with bots using fake money. No wallet required.</p>
        </div>
      </>
    ),
  },
];

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const active = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="landingPage">
      <LandingNav onConnect={() => window.location.href = '/'} connecting={false} />

      <section className="subpageHero subpageHeroShort">
        <div className="subpageHeroBg">
          <img src="/assets/landing/header-docs.webp" alt="" className="heroBgImg" />
        </div>
        <div className="heroOverlay" />
        <motion.div
          className="subpageHeroContent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="subpageTitle">Documentation</h1>
          <p className="subpageSubtitle">Rules, mechanics, and technical details.</p>
        </motion.div>
      </section>

      <div className="docsLayout">
        <nav className="docsSidebar">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`docsSidebarLink ${activeSection === s.id ? 'docsSidebarLinkActive' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>

        <main className="docsContent">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              className="docsArticle"
              variants={fadeIn}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <h2 className="docsArticleTitle">{active.title}</h2>
              {active.content}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <LandingFooter />
    </div>
  );
}
