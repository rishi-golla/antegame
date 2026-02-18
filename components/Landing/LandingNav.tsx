'use client';

import { useState, useEffect } from 'react';

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
    <nav className={`landingNav ${scrolled ? 'landingNavScrolled' : ''}`}>
      <div className="landingNavInner">
        <img
          src="/assets/misc/ante-logo.webp"
          alt="Ante"
          className="landingNavLogo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        />

        <div className={`landingNavLinks ${menuOpen ? 'landingNavLinksOpen' : ''}`}>
          <button className="landingNavLink" onClick={() => scrollTo('about')}>About</button>
          <button className="landingNavLink" onClick={() => scrollTo('features')}>Features</button>
          <button className="landingNavLink" onClick={() => scrollTo('minigames')}>Minigames</button>
        </div>

        <button
          className="landingNavCTA"
          onClick={onConnect}
          disabled={connecting}
        >
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </button>

        <button
          className="landingNavHamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>
    </nav>
  );
}
