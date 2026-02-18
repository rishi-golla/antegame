'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Connect',
    desc: 'Plug in your wallet. Base chain. 10 seconds.',
    icon: '/assets/landing/icons/icon-connect.webp',
  },
  {
    number: '02',
    title: 'Stake',
    desc: 'Pick a table. Throw ETH in the pot. The smart contract holds it.',
    icon: '/assets/landing/icons/icon-stake.webp',
  },
  {
    number: '03',
    title: 'Roll',
    desc: 'Move around the board. Buy casinos. Land on minigames. Wreck your friends.',
    icon: '/assets/landing/icons/icon-roll.webp',
  },
  {
    number: '04',
    title: 'Collect',
    desc: 'Last one standing takes it all. Settled on-chain, instant.',
    icon: '/assets/landing/icons/icon-collect.webp',
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
        <motion.h2 className="hiwTitle" variants={item}>From wallet to winnings</motion.h2>

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
              <img src={step.icon} alt={step.title} className="hiwCardIcon" />
              <h3 className="hiwCardTitle">{step.title}</h3>
              <p className="hiwCardDesc">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="hiwConnector" />
      </motion.div>
    </section>
  );
}
