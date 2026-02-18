'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LandingNavProps {
  onConnect: () => void;
  connecting: boolean;
}

const navLinks = [
  { label: 'About', href: '/about' },
  { label: 'Features', href: '/features' },
  { label: 'Minigames', href: '/minigames' },
];

export default function LandingNav({ onConnect, connecting }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      className={`landingNav ${scrolled ? 'landingNavScrolled' : ''}`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
    >
      <div className="landingNavInner">
        <motion.a
          href="/"
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
        >
          <img
            src="/assets/misc/ante-logo.webp"
            alt="Ante"
            className="landingNavLogo"
          />
        </motion.a>

        <div className={`landingNavLinks ${menuOpen ? 'landingNavLinksOpen' : ''}`}>
          {navLinks.map((link) => (
            <motion.a
              key={link.href}
              href={link.href}
              className="landingNavLink"
              whileHover={{ color: '#d4af37', y: -1 }}
              transition={{ duration: 0.2 }}
            >
              {link.label}
            </motion.a>
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
