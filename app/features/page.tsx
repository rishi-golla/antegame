'use client';

import { motion } from 'framer-motion';
import LandingNav from '@/components/Landing/LandingNav';
import LandingFooter from '@/components/Landing/LandingFooter';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const features = [
  {
    title: 'The Board',
    text: '40 casino-themed properties across 8 color sets. Every tile is a different casino venue, from dive bars to high-roller penthouses. Buy, build houses, and bankrupt your opponents.',
    image: '/assets/landing/feature-board.webp',
  },
  {
    title: 'On-Chain Escrow',
    text: 'All game funds are held in smart contracts on Base + Solana. When the game ends, contracts settle payouts automatically. No trust required. Just math.',
    image: '/assets/landing/feature-onchain.webp',
  },
  {
    title: 'Multiplayer Rooms',
    text: 'Create private rooms with a code, or jump into quick play matchmaking. Up to 6 players per game with real-time chat, trading, and spectator mode.',
    image: '/assets/landing/feature-multiplayer.webp',
  },
];

export default function FeaturesPage() {
  return (
    <div className="landingPage subpageRichBg">
      <LandingNav onConnect={() => window.location.href = '/'} onConnectSolana={() => window.location.href = '/'} connecting={false} />

      <section className="subpageHero">
        <div className="subpageHeroBg">
          <img src="/assets/landing/header-features.webp" alt="" className="heroBgImg" />
        </div>
        <div className="heroOverlay" />
        <motion.div
          className="subpageHeroContent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="subpageTitle">Features</h1>
          <p className="subpageSubtitle">Everything that makes Ante tick.</p>
        </motion.div>
      </section>

      <motion.section
        className="subpageBody"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {features.map((f, i) => (
          <motion.div key={i} className="subpageFeatureRow" variants={fadeUp}>
            <div className="subpageFeatureImage">
              <img src={f.image} alt={f.title} />
            </div>
            <div className="subpageFeatureText">
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </div>
          </motion.div>
        ))}
      </motion.section>

      <LandingFooter />
    </div>
  );
}
