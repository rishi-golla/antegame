'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Connect',
    desc: 'Link your wallet on Base. MetaMask, Coinbase, or WalletConnect.',
    icon: '🔗',
  },
  {
    number: '02',
    title: 'Stake',
    desc: 'Choose a table. Stake ETH into the smart contract escrow.',
    icon: '💎',
  },
  {
    number: '03',
    title: 'Play',
    desc: 'Roll dice, buy properties, play minigames. Bankrupt your opponents.',
    icon: '🎲',
  },
  {
    number: '04',
    title: 'Win',
    desc: 'Last player standing takes the pot. Settled on-chain.',
    icon: '🏆',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function HowItWorks() {
  return (
    <section className="hiwSection">
      <motion.div
        className="hiwInner"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.p className="hiwLabel" variants={item}>How It Works</motion.p>
        <motion.h2 className="hiwTitle" variants={item}>Four steps to the table</motion.h2>

        <div className="hiwGrid">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="hiwCard"
              variants={item}
              whileHover={{ y: -8, borderColor: 'rgba(212, 175, 55, 0.4)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <span className="hiwCardNumber">{step.number}</span>
              <span className="hiwCardIcon">{step.icon}</span>
              <h3 className="hiwCardTitle">{step.title}</h3>
              <p className="hiwCardDesc">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Connector line */}
        <div className="hiwConnector" />
      </motion.div>
    </section>
  );
}
