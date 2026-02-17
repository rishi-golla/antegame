'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CHARACTERS } from '@/lib/assetMap';

export default function ProfileSetup() {
  const { updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Enter a display name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile(displayName.trim(), selectedChar);
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Welcome, High Roller</h1>
        <p className="setupSubtitle casinoSubtitle">Set up your profile</p>

        <input
          className="setupPlayerInput"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={20}
          style={{ marginBottom: 16, textAlign: 'center' }}
        />

        <div className="characterGrid">
          {CHARACTERS.map((c) => (
            <div
              key={c.id}
              className={`characterCard ${selectedChar === c.id ? 'characterCardSelected' : ''}`}
              onClick={() => setSelectedChar(c.id)}
            >
              <img src={c.sprite} alt={c.name} className="characterCardSprite" draggable={false} />
              <span className="characterCardName">{c.name}</span>
            </div>
          ))}
        </div>

        {error && <p className="lobbyError">{error}</p>}

        <button className="setupStartBtn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Enter the Casino'}
        </button>
      </div>
    </div>
  );
}
