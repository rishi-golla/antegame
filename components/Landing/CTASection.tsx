'use client';

import { motion } from 'framer-motion';

interface CTASectionProps {
  onConnect: () => void;
  onConnectSolana: () => void;
  onFreePlay?: () => void;
  connecting: boolean;
}

export default function CTASection({ onConnect, onConnectSolana, onFreePlay, connecting }: CTASectionProps) {
  return (
    <section className="ctaSection">
      <div className="ctaBg">
        <img src="/assets/landing/feature-multiplayer.webp" alt="" className="ctaBgImg" />
      </div>
      <div className="ctaOverlay" />

      <motion.div
        className="ctaContent"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
      >
        <p className="ctaLabel">Ready?</p>
        <h2 className="ctaTitle">Ante Up</h2>
        <p className="ctaSubtitle">Connect your wallet. Join the table. Take the pot.</p>

        <div className="ctaButtons">
          <motion.button
            className="ctaBtnPrimary"
            onClick={onConnect}
            disabled={connecting}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            {connecting ? 'Connecting...' : 'Connect with Base'}
          </motion.button>
          <motion.button
            className="ctaBtnPrimary ctaBtnSolana"
            onClick={onConnectSolana}
            disabled={connecting}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            {connecting ? 'Connecting...' : 'Connect with Solana'}
          </motion.button>
          {onFreePlay && (
            <motion.button
              className="ctaBtnGhost"
              onClick={onFreePlay}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Try Free Play
            </motion.button>
          )}
        </div>
      </motion.div>
    </section>
  );
}
