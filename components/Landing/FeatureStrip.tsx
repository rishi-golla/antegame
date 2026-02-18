'use client';

import { motion } from 'framer-motion';

const features = [
  {
    title: 'The Board',
    desc: '40 casino-themed properties. Buy, build, bankrupt.',
    image: '/assets/landing/feature-board.webp',
    href: '/features',
  },
  {
    title: 'Minigames',
    desc: '10 casino games from slots to blackjack.',
    image: '/assets/landing/feature-minigames.webp',
    href: '/minigames',
  },
  {
    title: 'On-Chain',
    desc: 'Smart contract escrow. Transparent settlement.',
    image: '/assets/landing/feature-onchain.webp',
    href: '/features',
  },
  {
    title: 'Multiplayer',
    desc: 'Private rooms, quick play, up to 6 players.',
    image: '/assets/landing/feature-multiplayer.webp',
    href: '/features',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function FeatureStrip() {
  return (
    <section className="fsSection">
      <motion.div
        className="fsInner"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.p className="fsLabel" variants={item}>Explore</motion.p>
        <motion.h2 className="fsTitle" variants={item}>What makes Ante different</motion.h2>

        <div className="fsGrid">
          {features.map((f, i) => (
            <motion.a
              key={i}
              href={f.href}
              className="fsCard"
              variants={item}
              whileHover={{ y: -10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="fsCardImageWrap">
                <img src={f.image} alt={f.title} className="fsCardImage" />
                <div className="fsCardImageOverlay" />
              </div>
              <div className="fsCardBody">
                <h3 className="fsCardTitle">{f.title}</h3>
                <p className="fsCardDesc">{f.desc}</p>
                <span className="fsCardArrow">→</span>
              </div>
            </motion.a>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
