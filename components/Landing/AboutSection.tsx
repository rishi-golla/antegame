'use client';

import { motion } from 'framer-motion';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
};

export default function AboutSection() {
  return (
    <section className="landingAbout" id="about">
      <motion.div
        className="landingAboutInner"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.div className="landingDivider" variants={fadeUp}>
          <span className="landingDividerLine" />
          <span className="landingDividerIcon">&#9830;&#9827;</span>
          <span className="landingDividerLine" />
        </motion.div>
        <motion.h2 className="landingAboutTitle" variants={fadeUp}>
          About
        </motion.h2>
        <motion.p className="landingAboutText" variants={fadeUp}>
          Ante is a multiplayer crypto board game on Base + Solana. Stake ETH/SOL, roll dice,
          land on properties, and play casino minigames to win or lose it all.
          The pot goes to the last player standing.
        </motion.p>
        <motion.img
          src="/assets/landing/crest-emblem.webp"
          alt=""
          className="landingAboutCrest"
          variants={fadeUp}
          whileHover={{ scale: 1.1, rotate: 3 }}
          transition={{ type: 'spring', stiffness: 300 }}
        />
      </motion.div>
    </section>
  );
}
