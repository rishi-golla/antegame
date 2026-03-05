'use client';

import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function LandingFooter() {
  return (
    <motion.footer
      className="landingFooter"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
    >
      <div className="landingFooterInner">
        <motion.div className="landingFooterBrand" variants={fadeIn}>
          <span className="landingFooterTitle">Ante</span>
        </motion.div>

        <motion.div className="landingFooterLinks" variants={fadeIn}>
          <div className="landingFooterCol">
            <h4>Game</h4>
            <a href="/features">The Board</a>
            <a href="/minigames">Minigames</a>
            <a href="/features">On-Chain</a>
          </div>
          <div className="landingFooterCol">
            <h4>Info</h4>
            <a href="/about">About</a>
            <a href="/leaderboard">Leaderboard</a>
          </div>
        </motion.div>

        <motion.div className="landingFooterSocials" variants={fadeIn}>
          {[
            { href: 'https://x.com/antedotwtf', label: 'Twitter', d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
          ].map((s) => (
            <motion.a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              whileHover={{ scale: 1.2, color: '#d4af37' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d={s.d} /></svg>
            </motion.a>
          ))}
        </motion.div>
      </div>

      <div className="landingFooterBottom">
        <span>Copyright 2026</span>
        <span>Built on Base + Solana</span>
      </div>
    </motion.footer>
  );
}
