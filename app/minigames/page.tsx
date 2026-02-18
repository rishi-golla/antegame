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
  { name: 'Blackjack', desc: 'Classic 21. Hit or stand against the dealer. Get closer to 21 without busting.', image: '/assets/landing/minigames/blackjack.webp' },
  { name: 'Slots', desc: 'Pull the lever and pray for triple sevens. Instant payout or instant regret.', image: '/assets/landing/minigames/slots.webp' },
  { name: 'Wheel of Fortune', desc: 'Spin the wheel. Multipliers from 0.25x to 5x. One spin decides your fate.', image: '/assets/landing/minigames/wheel.webp' },
  { name: 'Craps', desc: 'Roll the dice. Hit your number or bust. Classic casino energy.', image: '/assets/landing/minigames/craps.webp' },
  { name: 'Coin Flip', desc: 'Heads or tails. Best of three. Simple, brutal, effective.', image: '/assets/landing/minigames/coinflip.webp' },
  { name: 'Horse Race', desc: 'Pick your horse and watch them run. The fastest one pays out.', image: '/assets/landing/minigames/horse.webp' },
  { name: 'Dart Throw', desc: 'Aim for the bullseye. Closer you land, bigger the payout.', image: '/assets/landing/minigames/darts.webp' },
  { name: 'Minesweeper', desc: 'Reveal gems, dodge mines. Cash out anytime or push your luck.', image: '/assets/landing/minigames/minesweeper.webp' },
  { name: 'Safe Cracker', desc: 'Crack the combination before time runs out. Pressure makes diamonds.', image: '/assets/landing/minigames/safecracker.webp' },
  { name: 'Higher or Lower', desc: 'Guess if the next card is higher or lower. Streak it for big multipliers.', image: '/assets/landing/minigames/highlow.webp' },
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
        <div className="mgGrid">
          {minigames.map((mg, i) => (
            <motion.div key={i} className="mgCard" variants={fadeUp} whileHover={{ y: -6 }}>
              <div className="mgCardImageWrap">
                <img src={mg.image} alt={mg.name} className="mgCardImage" loading="lazy" />
                <div className="mgCardImageOverlay" />
              </div>
              <div className="mgCardBody">
                <h3 className="mgCardName">{mg.name}</h3>
                <p className="mgCardDesc">{mg.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <LandingFooter />
    </div>
  );
}
