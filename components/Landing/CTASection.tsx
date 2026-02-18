'use client';

import { motion } from 'framer-motion';

interface CTASectionProps {
  onConnect: () => void;
  onFreePlay?: () => void;
  connecting: boolean;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function CTASection({ onConnect, onFreePlay, connecting }: CTASectionProps) {
  return (
    <section className="landingCTA">
      <motion.div
        className="landingCTAInner"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        <motion.h2 className="landingCTATitle" variants={fadeUp}>
          Ready to Ante Up?
        </motion.h2>
        <motion.p className="landingCTASubtitle" variants={fadeUp}>
          Connect your wallet and join the table.
        </motion.p>
        <motion.div className="landingCTAButtons" variants={fadeUp}>
          <motion.button
            className="landingCTABtn landingCTABtnPrimary"
            onClick={onConnect}
            disabled={connecting}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {connecting ? 'Connecting...' : 'Connect with Base'}
          </motion.button>
          <motion.button
            className="landingCTABtn landingCTABtnDisabled"
            disabled
            initial={{ opacity: 0.4 }}
          >
            Connect with Solana (Coming Soon)
          </motion.button>
          {onFreePlay && (
            <motion.button
              className="landingCTABtn landingCTABtnGhost"
              onClick={onFreePlay}
              whileHover={{ scale: 1.02, borderColor: 'rgba(212, 175, 55, 0.3)' }}
              whileTap={{ scale: 0.98 }}
            >
              Play for Free
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </section>
  );
}
