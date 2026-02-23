'use client';

import { useState } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';

export default function ProfileSetup() {
  const { updateProfile } = useMultiChain();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Default to first character — no selection needed
  const defaultChar = CHARACTERS[0].id;

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Enter a display name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile(displayName.trim(), defaultChar);
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Welcome</h1>
        <p className="setupSubtitle casinoSubtitle">Choose a display name</p>

        <input
          className="setupPlayerInput"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && displayName.trim()) handleSave(); }}
          maxLength={20}
          autoFocus
          style={{ marginBottom: 24, textAlign: 'center' }}
        />

        {error && <p className="lobbyError">{error}</p>}

        <button className="setupStartBtn" onClick={handleSave} disabled={saving || !displayName.trim()}>
          {saving ? 'Saving...' : 'Enter the Casino'}
        </button>
      </div>
    </div>
  );
}
