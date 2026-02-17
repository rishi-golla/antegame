'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CHARACTERS } from '@/lib/assetMap';

export default function WalletButton() {
  const { user, disconnect } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const char = CHARACTERS.find((c) => c.id === user.characterId);
  const shortAddr = user.walletAddress.slice(0, 4) + '...' + user.walletAddress.slice(-4);

  return (
    <div className="walletBtnWrap" ref={ref}>
      <button className="walletBtn" onClick={() => setOpen(!open)}>
        {char && (
          <img
            src={char.sprite}
            alt={char.name}
            className="walletBtnSprite"
          />
        )}
        <span className="walletBtnAddr">{shortAddr}</span>
      </button>
      {open && (
        <div className="walletDropdown">
          <div className="walletDropdownName">{user.displayName ?? 'Anonymous'}</div>
          <div className="walletDropdownAddr">{user.walletAddress}</div>
          <button className="walletDropdownBtn" onClick={() => { setOpen(false); disconnect(); }}>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
