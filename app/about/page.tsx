'use client';

import { motion } from 'framer-motion';
import LandingNav from '@/components/Landing/LandingNav';
import LandingFooter from '@/components/Landing/LandingFooter';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

export default function AboutPage() {
  return (
    <div className="landingPage">
      <LandingNav onConnect={() => window.location.href = '/'} connecting={false} />

      <section className="subpageHero">
        <div className="subpageHeroBg">
          <img src="/assets/landing/hero-bg.webp" alt="" className="heroBgImg" />
        </div>
        <div className="heroOverlay" />
        <motion.div
          className="subpageHeroContent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="subpageTitle">About</h1>
        </motion.div>
      </section>

      <motion.section
        className="subpageBody"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div className="subpageBlock" variants={fadeUp}>
          <h2>What is Ante?</h2>
          <p>
            Ante is a multiplayer crypto board game built on Base. Think Monopoly meets poker night
            — but every dollar is real ETH, every property is a casino, and every roll of the dice
            could make or break you.
          </p>
        </motion.div>

        <motion.div className="subpageBlock" variants={fadeUp}>
          <h2>How It Works</h2>
          <p>
            Players stake ETH to enter a game. The funds go into a smart contract escrow. You roll dice,
            move around the board, buy properties, pay rent, and play minigames when you land on special tiles.
            The last player standing takes the pot.
          </p>
        </motion.div>

        <motion.div className="subpageBlock" variants={fadeUp}>
          <h2>Fair & Transparent</h2>
          <p>
            Every game is settled on-chain. The smart contract handles escrow, payouts, and refunds.
            No house edge, no hidden fees. If all players disconnect, funds are automatically refundable.
          </p>
        </motion.div>

        <motion.div className="subpageBlock" variants={fadeUp}>
          <img
            src="/assets/landing/crest-emblem.webp"
            alt="Ante Crest"
            className="subpageBlockImage"
            style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }}
          />
        </motion.div>
      </motion.section>

      <LandingFooter />
    </div>
  );
}
