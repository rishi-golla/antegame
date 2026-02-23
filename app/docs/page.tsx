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
          Ante is a multiplayer crypto board game built on Base (Ethereum L2). Players stake ETH,
          roll dice around a 40-tile casino-themed board, buy properties, collect rent, play minigames,
          and trade with opponents. The last player standing takes the pot.
        </p>
        <h3>Quick Start</h3>
        <ol>
          <li>Connect your wallet (MetaMask, Coinbase, WalletConnect)</li>
          <li>Set up your profile: pick a name and character</li>
          <li>Create a room, join with a code, or hit Quick Play</li>
          <li>Stake your ETH and roll the dice</li>
        </ol>
        <h3>Win Condition</h3>
        <p>
          The game ends when all players except one have gone bankrupt. The surviving player
          collects the entire pot minus a flat 5% platform fee. If all remaining players
          disconnect, the game is cancelled and refunds are issued.
        </p>
        <h3>Starting State</h3>
        <ul>
          <li>Each player starts with <strong>$1,500</strong> in-game currency</li>
          <li>All players begin on tile 0 (GO)</li>
          <li>Turn order is randomized at game start</li>
          <li>The board has 40 tiles, 32 global houses, and 12 global hotels</li>
        </ul>
      </>
    ),
  },
  {
    id: 'board',
    title: 'The Board',
    content: (
      <>
        <p>
          40 tiles in a square loop. Every property is a casino venue with unique rent tables.
        </p>
        <h3>Tile Types</h3>
        <ul>
          <li><strong>Properties (22 tiles)</strong>: Organized into 8 color groups. Buy them, build houses, charge rent.</li>
          <li><strong>Railroads (4 tiles)</strong>: North, East, West, South. Rent scales with how many you own: $25 / $50 / $100 / $200.</li>
          <li><strong>Utilities (2 tiles)</strong>: Electric Company and Water Works. Rent = dice roll x4 (one owned) or x10 (both owned).</li>
          <li><strong>Risk (3 tiles)</strong>: Draw from the Risk deck. Movement, payments, or jail.</li>
          <li><strong>Blind Chest (3 tiles)</strong>: Draw from the Blind Chest deck. Rewards, penalties, or repairs.</li>
          <li><strong>Tax (2 tiles)</strong>: Income Tax ($200) and Luxury Tax ($100). Paid directly to the pot.</li>
          <li><strong>Corners (4 tiles)</strong>: GO, Jail / Just Visiting, Free Parking, Go to Jail.</li>
        </ul>

        <h3>Color Groups and Pricing</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Color</th><th>Properties</th><th>Price</th><th>House Cost</th><th>Base Rent</th><th>Hotel Rent</th></tr>
          </thead>
          <tbody>
            <tr><td>Brown</td><td>Coral Street, Mint Avenue</td><td>$60</td><td>$50</td><td>$2-4</td><td>$160-320</td></tr>
            <tr><td>Light Blue</td><td>Lemon Square, Clover Drive, Sunset Boulevard</td><td>$100-120</td><td>$50</td><td>$6-8</td><td>$400-450</td></tr>
            <tr><td>Pink</td><td>Orchid Lane, Lake View, Rosewood Place</td><td>$140-160</td><td>$100</td><td>$10-12</td><td>$625-700</td></tr>
            <tr><td>Orange</td><td>Maple Park, Cherry Row, Oak Crest</td><td>$180-200</td><td>$100</td><td>$14-16</td><td>$750-800</td></tr>
            <tr><td>Red</td><td>Sapphire Street, Pearl Street, Hill Crest</td><td>$220-240</td><td>$150</td><td>$18-20</td><td>$875-925</td></tr>
            <tr><td>Yellow</td><td>Luna Avenue, Garden Street, Willow Drive</td><td>$260-280</td><td>$150</td><td>$22-24</td><td>$975-1025</td></tr>
            <tr><td>Green</td><td>Plaza Way, Birch Point, River Side</td><td>$300-320</td><td>$200</td><td>$26-28</td><td>$1100-1200</td></tr>
            <tr><td>Dark Blue</td><td>Golden Road, Park Lane</td><td>$350-400</td><td>$200</td><td>$35-50</td><td>$1300-1700</td></tr>
          </tbody>
        </table>

        <h3>Rent Tiers</h3>
        <p>Each property has 6 rent levels:</p>
        <ol>
          <li><strong>Base rent</strong>: No houses, no monopoly</li>
          <li><strong>1 house</strong></li>
          <li><strong>2 houses</strong></li>
          <li><strong>3 houses</strong></li>
          <li><strong>4 houses</strong></li>
          <li><strong>Hotel</strong> (replaces all 4 houses)</li>
        </ol>
        <p>
          If you own all properties in a color group but have zero houses, base rent is doubled.
        </p>
      </>
    ),
  },
  {
    id: 'building',
    title: 'Building',
    content: (
      <>
        <h3>Requirements</h3>
        <ul>
          <li>You must own every property in the color group</li>
          <li>No property in the group can be mortgaged</li>
          <li>You must build evenly: you cannot place a second house on any property until every property in the group has at least one</li>
          <li>Maximum: 4 houses, then upgrade to a hotel</li>
          <li>Building is disabled during final rounds</li>
        </ul>

        <h3>Housing Supply</h3>
        <p>
          The game has a global pool of <strong>32 houses</strong> and <strong>12 hotels</strong>.
          When you build a house, one is removed from the pool. When you upgrade to a hotel,
          4 houses are returned and 1 hotel is taken. Housing shortages are a real strategic lever.
          If no houses are available, you cannot build, even if you have the money.
        </p>

        <h3>Selling</h3>
        <p>
          Houses sell for half the purchase price (rounded down). You must sell evenly within a
          color group, just like building. Downgrading a hotel requires 4 available houses in
          the pool. If there are not enough houses to downgrade, you may be forced to sell the
          entire hotel outright.
        </p>

        <h3>Mortgaging</h3>
        <ul>
          <li>Mortgage value = half the property price</li>
          <li>You must sell all houses in a color group before mortgaging any property in it</li>
          <li>Mortgaged properties collect no rent</li>
          <li>Unmortgaging costs 110% of the mortgage value (rounded up)</li>
          <li>Mortgaged properties can be traded. The new owner inherits the mortgage</li>
        </ul>
      </>
    ),
  },
  {
    id: 'economy',
    title: 'Economy Scaling',
    content: (
      <>
        <p>
          Ante uses a round-based economy that accelerates the game over time,
          preventing stalemates and forcing aggressive play in later rounds.
        </p>

        <h3>Rent Multiplier</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Rounds</th><th>Multiplier</th></tr>
          </thead>
          <tbody>
            <tr><td>1 to 15</td><td>1.0x (normal)</td></tr>
            <tr><td>16 to 25</td><td>1.25x</td></tr>
            <tr><td>26 to 35</td><td>1.5x</td></tr>
            <tr><td>36 to 45</td><td>2.0x</td></tr>
            <tr><td>46+</td><td>3.0x</td></tr>
            <tr><td>Final Rounds</td><td>4.0x</td></tr>
          </tbody>
        </table>

        <h3>GO Salary Decay</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Rounds</th><th>GO Salary</th></tr>
          </thead>
          <tbody>
            <tr><td>1 to 15</td><td>$200</td></tr>
            <tr><td>16 to 25</td><td>$150</td></tr>
            <tr><td>26 to 35</td><td>$100</td></tr>
            <tr><td>36+</td><td>$50</td></tr>
            <tr><td>Final Rounds</td><td>$0</td></tr>
          </tbody>
        </table>

        <h3>Final Rounds</h3>
        <p>
          At <strong>round 50</strong>, the game enters Final Rounds. This continues until round 60.
          During final rounds:
        </p>
        <ul>
          <li>Rent is multiplied by 4x</li>
          <li>GO salary drops to $0</li>
          <li>No building or buying is allowed</li>
          <li>The economy becomes purely extractive, forcing the endgame</li>
        </ul>
        <p>
          If the game reaches round 60, the player with the highest net worth wins.
          Net worth = cash + property values + house values (at sell price) - mortgage debts.
        </p>
      </>
    ),
  },
  {
    id: 'characters',
    title: 'Characters & Buffs',
    content: (
      <>
        <p>
          Each character has a unique passive ability that activates automatically throughout
          the game. Choose your character based on your play style. There is no objectively
          dominant pick: each buff shines in different situations.
        </p>

        <h3>All Characters</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Character</th><th>Buff Name</th><th>Effect</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>High Roller</strong></td>
              <td>Big Spender</td>
              <td>Properties cost 10% less to buy. Stacks with minigame discounts. Stretches your opening capital further.</td>
            </tr>
            <tr>
              <td><strong>Singer</strong></td>
              <td>Crowd Favorite</td>
              <td>Collect 20% more when passing GO. Extra $40 per lap in early rounds. Decays as salary decays.</td>
            </tr>
            <tr>
              <td><strong>Dealer</strong></td>
              <td>House Advantage</td>
              <td>Collect 15% more rent from opponents. Scales with the rent multiplier in later rounds. Best with expensive color groups.</td>
            </tr>
            <tr>
              <td><strong>Mobster</strong></td>
              <td>Protection Racket</td>
              <td>Pay 15% less rent to opponents. Pure defense. Keeps you alive when landing on developed properties.</td>
            </tr>
            <tr>
              <td><strong>Tourist</strong></td>
              <td>Lucky Traveler</td>
              <td>Railroads cost $0 to buy and you collect rent as if you own one more railroad than you do (capped at 4). Owning 1 railroad collects $50 instead of $25.</td>
            </tr>
            <tr>
              <td><strong>Card Shark</strong></td>
              <td>Stacked Deck</td>
              <td>Minigame payouts are 20% better. Win bonuses increase, loss penalties decrease. High variance, high reward.</td>
            </tr>
            <tr>
              <td><strong>VIP</strong></td>
              <td>Penthouse Suite</td>
              <td>Houses cost 15% less to build. Compound savings across a full color group. Strong mid-to-late game when building is critical.</td>
            </tr>
            <tr>
              <td><strong>Bartender</strong></td>
              <td>On the House</td>
              <td>Tax payments reduced by 50%. Income Tax drops from $200 to $100, Luxury Tax from $100 to $50. Niche but consistent savings.</td>
            </tr>
          </tbody>
        </table>

        <h3>Buff Mechanics</h3>
        <ul>
          <li>Buffs apply automatically. No activation required.</li>
          <li>All calculations are server-side to prevent exploitation.</li>
          <li>Percentage modifiers are floored after application (e.g., 15% off $140 = $119).</li>
          <li>Dealer and Mobster buffs can both apply to the same rent payment. If a Dealer charges a Mobster, the rent is boosted 15% then discounted 15%, resulting in roughly net-zero.</li>
          <li>Tourist railroad bonus is additive to the rent tier lookup, not a percentage.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'minigames',
    title: 'Minigames',
    content: (
      <>
        <p>
          Minigames trigger when landing on certain tiles or as part of card effects. They determine
          whether you get a discount on purchases, a reduction on rent owed, or pay a penalty.
          Each minigame produces one of five outcome tiers.
        </p>

        <h3>Outcome Tiers</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Tier</th><th>Buying Context</th><th>Rent Context</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>Win</strong></td><td>Buy property for free</td><td>Pay no rent</td></tr>
            <tr><td><strong>Close Win</strong></td><td>50% off purchase price</td><td>50% off rent</td></tr>
            <tr><td><strong>Close Loss</strong></td><td>Pay 50% of price as penalty (no property)</td><td>Pay 150% rent</td></tr>
            <tr><td><strong>Loss</strong></td><td>Pay 75% of price as penalty (no property)</td><td>Pay 200% rent</td></tr>
            <tr><td><strong>Catastrophic</strong></td><td>Pay full price as penalty (no property)</td><td>Pay 300% rent</td></tr>
          </tbody>
        </table>

        <h3>All 10 Minigames</h3>
        <table className="docsTable">
          <thead>
            <tr><th>Game</th><th>How It Works</th></tr>
          </thead>
          <tbody>
            <tr><td>Blackjack</td><td>Classic 21 against the dealer. Hit, stand, or bust.</td></tr>
            <tr><td>Slots</td><td>Pull the lever, 3 reels spin. Matching symbols pay out.</td></tr>
            <tr><td>Wheel of Fortune</td><td>Spin a segmented wheel. Land on a multiplier.</td></tr>
            <tr><td>Craps</td><td>Roll dice. Hit your point number before a 7.</td></tr>
            <tr><td>Coin Flip</td><td>Best of 3 heads/tails calls.</td></tr>
            <tr><td>Card War</td><td>You vs. the house — flip cards over 3 rounds. Highest total wins.</td></tr>
            <tr><td>Dart Throw</td><td>Click-timing to aim. Closer to bullseye = better payout.</td></tr>
            <tr><td>Minesweeper</td><td>Reveal gems, avoid mines. Cash out at any time or push your luck.</td></tr>
            <tr><td>Safe Cracker</td><td>Guess a 3-digit combination (digits 0 through 4). More correct digits = better tier.</td></tr>
            <tr><td>Higher or Lower</td><td>Guess if the next card is higher or lower. Consecutive correct guesses improve your tier.</td></tr>
          </tbody>
        </table>

        <h3>Minigame Context</h3>
        <p>
          Minigames trigger in two contexts:
        </p>
        <ul>
          <li><strong>Buying context</strong>: You landed on an unowned property. Win = free property. Lose = cash penalty with no property.</li>
          <li><strong>Rent context</strong>: You owe rent to another player. Win = skip rent. Lose = pay multiplied rent.</li>
        </ul>
        <p>
          Only the active player plays. Other players see a spectator overlay showing the game
          name, player, and final result.
        </p>
      </>
    ),
  },
  {
    id: 'jail',
    title: 'Jail',
    content: (
      <>
        <p>
          You go to jail by landing on Go to Jail, drawing a &quot;Go to Jail&quot; card, or rolling
          three consecutive doubles.
        </p>
        <h3>Escaping Jail</h3>
        <ul>
          <li><strong>Pay bail</strong>: $50. Immediate release, then roll normally.</li>
          <li><strong>Use a Get Out of Jail Free card</strong>: One-time use, obtained from Risk or Blind Chest decks.</li>
          <li><strong>Roll doubles</strong>: If you roll doubles on any of your 3 jail turns, you escape and move that distance. If you fail all 3 attempts, you pay $50 automatically and roll.</li>
        </ul>
        <h3>Jail Strategy</h3>
        <p>
          In early rounds, getting out fast is usually correct since you want to buy properties.
          In late rounds (especially with the 3x-4x rent multiplier), jail can be a safe haven
          since you avoid landing on expensive developed properties. Experienced players sometimes
          prefer to stay in jail during rounds 36+.
        </p>
      </>
    ),
  },
  {
    id: 'cards',
    title: 'Risk & Blind Chest',
    content: (
      <>
        <p>
          Two separate decks of 16 cards each. When you land on a Risk or Blind Chest tile,
          a card is drawn from the top of the respective shuffled deck.
        </p>

        <h3>Risk Cards (16)</h3>
        <ul>
          <li>Advance to GO (collect $200)</li>
          <li>Advance to Park Lane</li>
          <li>Advance to Sapphire Street (collect $200 if passing GO)</li>
          <li>Advance to Orchid Lane (collect $200 if passing GO)</li>
          <li>Advance to nearest Railroad (x2 cards)</li>
          <li>Advance to nearest Utility</li>
          <li>Bank dividend: collect $50</li>
          <li>Get Out of Jail Free</li>
          <li>Go back 3 spaces</li>
          <li>Go to Jail</li>
          <li>Repairs: $25 per house, $100 per hotel</li>
          <li>Pay poor tax: $15</li>
          <li>Trip to North Railroad (collect $200 if passing GO)</li>
          <li>Chairman of the Board: pay each player $50</li>
          <li>Building loan matures: collect $150</li>
        </ul>

        <h3>Blind Chest Cards (16)</h3>
        <ul>
          <li>Advance to GO (collect $200)</li>
          <li>Bank error: collect $200</li>
          <li>Doctor fees: pay $50</li>
          <li>Stock sale: collect $50</li>
          <li>Get Out of Jail Free</li>
          <li>Go to Jail</li>
          <li>Holiday fund: collect $100</li>
          <li>Tax refund: collect $20</li>
          <li>Birthday: collect $10 from each player</li>
          <li>Life insurance: collect $100</li>
          <li>Hospital fees: pay $100</li>
          <li>School fees: pay $50</li>
          <li>Consultancy fee: collect $25</li>
          <li>Street repairs: $40 per house, $115 per hotel</li>
          <li>Beauty contest: collect $10</li>
          <li>Inheritance: collect $100</li>
        </ul>
      </>
    ),
  },
  {
    id: 'trading',
    title: 'Trading',
    content: (
      <>
        <p>
          Trades can be proposed during your turn. Both sides can offer properties and/or cash.
        </p>
        <h3>How to Trade</h3>
        <ol>
          <li>Click a player in the player list</li>
          <li>Select properties and cash to offer and request</li>
          <li>Send the offer</li>
          <li>The other player can accept or reject</li>
        </ol>
        <h3>Rules</h3>
        <ul>
          <li>You can only trade properties you own</li>
          <li>Mortgaged properties can be traded. The new owner inherits the mortgage and must pay 110% to unmortgage</li>
          <li>Properties with houses cannot be traded. Sell the houses first</li>
          <li>Get Out of Jail Free cards are not tradeable</li>
          <li>Trades are atomic: both sides complete simultaneously or not at all</li>
        </ul>
      </>
    ),
  },
  {
    id: 'bankruptcy',
    title: 'Bankruptcy & Debt',
    content: (
      <>
        <p>
          When you owe more than you can pay, you enter <strong>debt resolution</strong>. This gives
          you one chance to raise funds before going bankrupt.
        </p>
        <h3>Debt Resolution</h3>
        <ol>
          <li>You can sell houses (at half price) to raise cash</li>
          <li>You can mortgage properties to raise cash</li>
          <li>If you raise enough to cover the debt, you pay it and continue playing</li>
          <li>If you cannot cover the debt, you go bankrupt</li>
        </ol>
        <h3>Bankruptcy</h3>
        <ul>
          <li>If you owe money to <strong>another player</strong>: all your properties (including mortgaged ones) transfer to that player. Your remaining cash goes to them as well.</li>
          <li>If you owe money to <strong>the bank</strong> (tax, card effects): all your properties are returned to unowned status and your cash is forfeit.</li>
          <li>All houses on your properties are destroyed and returned to the global supply.</li>
          <li>You are eliminated from the game.</li>
        </ul>

        <h3>Net Worth Calculation</h3>
        <p>Used for final rounds tiebreaker at round 60:</p>
        <ul>
          <li>Cash on hand</li>
          <li>+ Property prices (face value)</li>
          <li>+ House value at sell price (houseCost / 2 per house)</li>
          <li>- Mortgage values for mortgaged properties</li>
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
          <li><strong>Create Room</strong>: Set a stake amount and player count (2 to 6). Share the room code with friends.</li>
          <li><strong>Join Room</strong>: Enter a room code to join an existing lobby.</li>
          <li><strong>Quick Play</strong>: Auto-matchmaking by stake tier. Get paired with strangers.</li>
          <li><strong>Free Play</strong>: No wallet required. Play locally against bots with simulated currency.</li>
        </ul>
        <h3>Lobby</h3>
        <p>
          In the lobby, players can see who has joined, toggle ready status, and use the chat.
          The host starts the game once minimum player count (2) is reached and all players are ready.
          Player order is randomized at game start.
        </p>
        <h3>Reconnection</h3>
        <p>
          If you disconnect, your turn timer continues. Reconnect using the same room code
          and player name before the timer expires. If all players disconnect, the game is
          cancelled and refunds are available through the smart contract.
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
          Ante uses smart contracts on Base for escrow and settlement. Game logic runs on the server
          in real time. The blockchain handles money in and money out.
        </p>
        <h3>Flow</h3>
        <ol>
          <li><strong>Game creation</strong>: A game ID is registered on-chain with the stake amount.</li>
          <li><strong>Joining</strong>: Each player sends their stake to the MonopolyGame contract. Funds are held in escrow until the game ends.</li>
          <li><strong>Gameplay</strong>: All game logic (dice, rent, building, minigames) runs server-side. No on-chain transactions during play.</li>
          <li><strong>Settlement</strong>: When the game ends, the server signs a settlement message. The winner calls the contract to claim the pot minus the 5% fee.</li>
          <li><strong>Cancellation</strong>: If all players leave, the server signs a cancellation. Each player can claim their original stake back.</li>
        </ol>
        <h3>Contracts</h3>
        <ul>
          <li><strong>MonopolyGame.sol</strong>: Game registration, escrow, settlement, and cancellation.</li>
          <li><strong>FeeVault.sol</strong>: Collects the 5% fee. Handles refund distribution when games are cancelled.</li>
        </ul>
        <h3>Security</h3>
        <ul>
          <li>Funds never pass through any team wallet. Contract-to-player only.</li>
          <li>Settlement requires a valid server signature matching the game ID and winner address.</li>
          <li>Cancellation signatures are issued automatically when all players disconnect.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ',
    content: (
      <>
        <div className="docsFaq">
          <h3>Is there a fee?</h3>
          <p>
            Yes. A flat 5% fee is taken from the game pot at settlement. This goes to the FeeVault
            for platform maintenance. There is no house edge on game outcomes. All in-game mechanics
            (dice, cards, minigames) are deterministic or fair-random.
          </p>
        </div>
        <div className="docsFaq">
          <h3>What happens if I disconnect?</h3>
          <p>
            Your turn timer keeps running. If you do not reconnect before it expires, your turn is
            auto-skipped. After multiple skipped turns, you may be declared bankrupt. If all players
            disconnect, the game is cancelled and refunds are available.
          </p>
        </div>
        <div className="docsFaq">
          <h3>Which wallets are supported?</h3>
          <p>MetaMask, Coinbase Wallet, and any WalletConnect-compatible wallet.</p>
        </div>
        <div className="docsFaq">
          <h3>What chain is Ante on?</h3>
          <p>Base (Ethereum L2). Low gas fees, fast finality.</p>
        </div>
        <div className="docsFaq">
          <h3>Can I play for free?</h3>
          <p>
            Yes. Free Play mode runs the full game locally against bots with simulated currency.
            No wallet connection required.
          </p>
        </div>
        <div className="docsFaq">
          <h3>How do character buffs work?</h3>
          <p>
            Each character has one passive ability that applies automatically. Buffs are calculated
            server-side and cannot be exploited. See the Characters and Buffs section for the full list.
          </p>
        </div>
        <div className="docsFaq">
          <h3>What happens in a Dealer vs Mobster matchup?</h3>
          <p>
            Both buffs apply. The Dealer collects 15% more rent, and the Mobster pays 15% less.
            The effects roughly cancel out, making it a near-normal rent payment.
          </p>
        </div>
        <div className="docsFaq">
          <h3>Can games end in a tie?</h3>
          <p>
            Only if the game reaches round 60 and multiple players have exactly the same net worth,
            which is extremely unlikely. In practice, one player always has the highest net worth.
          </p>
        </div>
        <div className="docsFaq">
          <h3>Are minigames optional?</h3>
          <p>
            When triggered, minigames are mandatory. You cannot skip them. The outcome determines
            your financial result for that turn.
          </p>
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
