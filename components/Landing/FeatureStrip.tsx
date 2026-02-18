'use client';

import { motion } from 'framer-motion';

const features = [
  {
    title: 'Not Your Dad\'s Board Game',
    desc: 'Monopoly meets poker night. 40 tiles, 10 minigames, real stakes. Every game ends with one winner and one fat payout.',
    image: '/assets/landing/feature-board.webp',
    href: '/features',
  },
  {
    title: 'No Trust Required',
    desc: 'Escrow holds the pot. Smart contract settles. You never hand your ETH to anyone — code does the math.',
    image: '/assets/landing/feature-onchain.webp',
    href: '/features',
  },
  {
    title: 'Built for Degen Hours',
    desc: 'Quick games. Private rooms. Trash talk in chat. This isn\'t a farm-and-wait game — you play, you win, you leave.',
    image: '/assets/landing/feature-multiplayer-room.webp',
    href: '/features',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
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
        <motion.p className="fsLabel" variants={item}>Why Ante</motion.p>
        <motion.h2 className="fsTitle" variants={item}>What makes Ante different</motion.h2>

        <div className="fsGrid fsGrid3">
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
                <span className="fsCardArrow">&rarr;</span>
              </div>
            </motion.a>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
