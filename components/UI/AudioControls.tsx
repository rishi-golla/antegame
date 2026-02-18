'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAudio } from '@/context/AudioContext';

export default function AudioControls() {
  const { sfxVolume, musicVolume, setSfxVolume, setMusicVolume, muted, toggleMute } = useAudio();
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    collapseTimer.current = setTimeout(() => setExpanded(false), 3000);
  }, [clearTimer]);

  const handleMouseEnter = () => {
    clearTimer();
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    startTimer();
  };

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <div
      className="audio-controls-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="audio-controls-icon"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </button>

      {expanded && (
        <div className={`audio-controls-panel ${muted ? 'audio-controls-dimmed' : ''}`}>
          <label className="audio-controls-label">
            <span>Music</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            />
          </label>
          <label className="audio-controls-label">
            <span>SFX</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={sfxVolume}
              onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
}
