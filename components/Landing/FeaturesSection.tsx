'use client';

import { motion } from 'framer-motion';

interface FeaturePanel {
  id: string;
  title: string;
  text: string;
  image: string;
  reverse?: boolean;
}

const features: FeaturePanel[] = [
  {
    id: 'features',
    title: 'The Board',
    text: '40 casino-themed properties across 8 color sets. Buy, build, and bankrupt your opponents on a board dripping with neon and velvet.',
    image: '/assets/landing/feature-board.webp',
  },
  {
    id: 'minigames',
    title: '10 Casino Minigames',
    text: 'Land on Risk or Blind Chest and play blackjack, slots, craps, darts, wheel of fortune, and more. Win big or lose your stake.',
    image: '/assets/landing/feature-minigames.webp',
    reverse: true,
  },
  {
    id: 'onchain',
    title: 'Fully On-Chain',
    text: 'Smart contract escrow on Base. Every game is settled transparently. Your crypto, your keys, your winnings.',
    image: '/assets/landing/feature-onchain.webp',
  },
  {
    id: 'multiplayer',
    title: 'Play With Friends',
    text: 'Create private rooms, invite friends, or jump into quick play. Up to 6 players per game with real-time chat.',
    image: '/assets/landing/feature-multiplayer.webp',
    reverse: true,
  },
];

function FeatureCard({ feature, index }: { feature: FeaturePanel; index: number }) {
  const imgVariants = {
    hidden: { opacity: 0, x: feature.reverse ? 60 : -60 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, x: feature.reverse ? -40 : 40 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] },
    },
  };

  return (
    <motion.div
      id={feature.id}
      className={`featurePanel featurePanelVisible ${feature.reverse ? 'featurePanelReverse' : ''}`}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.div className="featureImageWrap" variants={imgVariants}>
        <motion.img
          src={feature.image}
          alt={feature.title}
          className="featureImage"
          loading="lazy"
          whileHover={{ scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
      </motion.div>
      <motion.div className="featureText" variants={textVariants}>
        <h3 className="featureTitle">{feature.title}</h3>
        <p className="featureDesc">{feature.text}</p>
      </motion.div>
    </motion.div>
  );
}

export default function FeaturesSection() {
  return (
    <section className="landingFeatures">
      {features.map((f, i) => (
        <FeatureCard key={f.id} feature={f} index={i} />
      ))}
    </section>
  );
}
