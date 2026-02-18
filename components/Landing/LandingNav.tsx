'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LandingNavProps {
  onConnect: () => void;
  connecting: boolean;
}

export default function LandingNav({ onConnect, connecting }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <motion.nav
      className={`landingNav ${scrolled ? 'landingNavScrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
    >
      <div className="landingNavInner">
        <motion.img
          src="/assets/misc/ante-logo.webp"
          alt="Ante"
          className="landingNavLogo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        />

        <div className={`landingNavLinks ${menuOpen ? 'landingNavLinksOpen' : ''}`}>
          {['about', 'features', 'minigames'].map((id) => (
            <motion.button
              key={id}
              className="landingNavLink"
              onClick={() => scrollTo(id)}
              whileHover={{ color: '#d4af37', y: -1 }}
              transition={{ duration: 0.2 }}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </motion.button>
          ))}
        </div>

        <motion.button
          className="landingNavCTA"
          onClick={onConnect}
          disabled={connecting}
          whileHover={{ scale: 1.05, boxShadow: '0 6px 30px rgba(212, 175, 55, 0.5)' }}
          whileTap={{ scale: 0.95 }}
        >
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </motion.button>

        <button
          className="landingNavHamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </motion.nav>
  );
}
