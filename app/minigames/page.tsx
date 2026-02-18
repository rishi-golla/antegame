'use client';

import { motion } from 'framer-motion';
import LandingNav from '@/components/Landing/LandingNav';
import LandingFooter from '@/components/Landing/LandingFooter';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const minigames = [
  { name: 'Blackjack', desc: 'Classic 21. Hit or stand against the dealer.', icon: '/assets/minigames/cards/card-table.png' },
  { name: 'Slots', desc: 'Pull the lever and pray for triple sevens.', icon: '/assets/minigames/slots/slot-machine.png' },
  { name: 'Wheel of Fortune', desc: 'Spin the wheel — multipliers from 0.25x to 5x.', icon: '/assets/minigames/wheel/wheel.png' },
  { name: 'Craps', desc: 'Roll the dice. Hit your number or bust.', icon: '/assets/minigames/dice/dice-cup.png' },
  { name: 'Coin Flip', desc: 'Heads or tails. Best of three.', icon: '/assets/minigames/coin/coin-heads.png' },
  { name: 'Horse Race', desc: 'Pick your horse and watch them run.', icon: '/assets/minigames/horses/horse-1.png' },
  { name: 'Dart Throw', desc: 'Aim for the bullseye. Closer = bigger payout.', icon: '/assets/minigames/darts/dartboard.png' },
  { name: 'Minesweeper', desc: 'Reveal gems, dodge mines. Cash out anytime.', icon: '/assets/minigames/minesweeper/gem.png' },
  { name: 'Safe Cracker', desc: 'Crack the combination before time runs out.', icon: '/assets/minigames/safe/safe-closed.png' },
  { name: 'Higher or Lower', desc: 'Guess if the next card is higher or lower.', icon: '/assets/minigames/cards/deck.png' },
];

export default function MinigamesPage() {
  return (
    <div className="landingPage">
      <LandingNav onConnect={() => window.location.href = '/'} connecting={false} />

      <section className="subpageHero">
        <div className="subpageHeroBg">
          <img src="/assets/landing/feature-minigames.webp" alt="" className="heroBgImg" />
        </div>
        <div className="heroOverlay" />
        <motion.div
          className="subpageHeroContent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="subpageTitle">Minigames</h1>
          <p className="subpageSubtitle">10 casino games. Land on Risk or Blind Chest to play.</p>
        </motion.div>
      </section>

      <motion.section
        className="subpageBody"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="minigameGrid">
          {minigames.map((mg, i) => (
            <motion.div key={i} className="minigameCard" variants={fadeUp} whileHover={{ y: -6, scale: 1.02 }}>
              <img src={mg.icon} alt={mg.name} className="minigameCardIcon" />
              <h3 className="minigameCardName">{mg.name}</h3>
              <p className="minigameCardDesc">{mg.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <LandingFooter />
    </div>
  );
}
