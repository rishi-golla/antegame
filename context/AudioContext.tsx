'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { audio } from '@/lib/audioEngine';

type AudioContextValue = {
  play: (soundId: string, options?: { volume?: number; pitch?: number; pan?: number }) => void;
  playMusic: (trackId: string) => void;
  stopMusic: () => void;
  sfxVolume: number;
  musicVolume: number;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
};

const AudioCtx = createContext<AudioContextValue | null>(null);

const LS_SFX_VOL = 'monopoly_sfx_volume';
const LS_MUSIC_VOL = 'monopoly_music_volume';
const LS_MUTED = 'monopoly_muted';

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [sfxVolume, setSfxVolumeState] = useState(0.7);
  const [musicVolume, setMusicVolumeState] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const initialized = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const savedSfx = localStorage.getItem(LS_SFX_VOL);
    const savedMusic = localStorage.getItem(LS_MUSIC_VOL);
    const savedMute = localStorage.getItem(LS_MUTED);

    const sv = savedSfx !== null ? parseFloat(savedSfx) : 0.7;
    const mv = savedMusic !== null ? parseFloat(savedMusic) : 0.5;
    const m = savedMute === 'true';

    setSfxVolumeState(sv);
    setMusicVolumeState(mv);
    setMuted(m);

    audio.setSfxVolume(sv);
    audio.setMusicVolume(mv);
    if (m) audio.mute();
  }, []);

  const play = useCallback((soundId: string, options?: { volume?: number; pitch?: number; pan?: number }) => {
    audio.play(soundId, options);
  }, []);

  const playMusic = useCallback((trackId: string) => {
    audio.playMusic(trackId);
  }, []);

  const stopMusic = useCallback(() => {
    audio.stopMusic();
  }, []);

  const setSfxVolume = useCallback((v: number) => {
    setSfxVolumeState(v);
    audio.setSfxVolume(v);
    localStorage.setItem(LS_SFX_VOL, String(v));
  }, []);

  const setMusicVolume = useCallback((v: number) => {
    setMusicVolumeState(v);
    audio.setMusicVolume(v);
    localStorage.setItem(LS_MUSIC_VOL, String(v));
  }, []);

  const toggleMute = useCallback(() => {
    audio.toggleMute();
    const newMuted = audio.isMuted;
    setMuted(newMuted);
    localStorage.setItem(LS_MUTED, String(newMuted));
  }, []);

  return (
    <AudioCtx.Provider value={{ play, playMusic, stopMusic, sfxVolume, musicVolume, setSfxVolume, setMusicVolume, muted, toggleMute }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
