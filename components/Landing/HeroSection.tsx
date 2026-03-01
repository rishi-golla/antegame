'use client';

import { motion } from 'framer-motion';

export default function HeroSection({ onConnect, onConnectSolana, onFreePlay, connecting }: { onConnect: () => void; onConnectSolana: () => void; onFreePlay?: () => void; connecting: boolean }) {
  return (
    <section className="heroSection">
      <div className="heroBg">
        <motion.img
          src="/assets/landing/hero-bg.webp"
          alt=""
          className="heroBgImg"
          initial={{ scale: 1.15 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.5, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
        />
      </div>
      <div className="heroOverlay" />

      {/* Animated particles */}
      <div className="heroParticles">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="heroParticle"
            style={{ left: `${15 + i * 14}%`, top: `${20 + (i % 3) * 25}%` }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.15, 0.4, 0.15],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.8,
              ease: 'easeInOut' as const,
            }}
          />
        ))}
      </div>

      <motion.div className="heroContent">
        <motion.div
          className="heroBadge"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Base &bull; Solana
        </motion.div>

        <motion.h1
          className="heroTitle"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number,number,number,number] }}
        >
          ANTE
        </motion.h1>

        <motion.p
          className="heroTagline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          The multiplayer crypto board game<br />
          where every roll counts.
        </motion.p>

        <motion.div
          className="heroCampaignNotice"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          Referral Campaign Live -- Earn up to 50% of house fees + 1% lifetime revenue
        </motion.div>

        <motion.div
          className="heroButtons"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
        >
          <motion.button
            className="heroBtnPrimary"
            onClick={onConnect}
            disabled={connecting}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            {connecting ? 'Connecting...' : 'Play with Base'}
          </motion.button>
          <motion.button
            className="heroBtnPrimary heroBtnSolana"
            onClick={onConnectSolana}
            disabled={connecting}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            {connecting ? 'Connecting...' : 'Play with Solana'}
          </motion.button>
          <motion.a
            href="/docs"
            className="heroBtnSecondary"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            Learn More
          </motion.a>
        </motion.div>

        <motion.div
          className="heroSocials"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          <a href="https://x.com/antedotwtf" target="_blank" rel="noopener noreferrer" className="heroSocialLink" aria-label="Twitter">
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </motion.div>
      </motion.div>

      <motion.div
        className="heroScrollHint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 0.6, delay: 2.0 }}
      >
        <motion.div
          className="heroScrollArrow"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const }}
        />
      </motion.div>
    </section>
  );
}
