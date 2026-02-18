/**
 * AudioEngine — Singleton Web Audio API manager for Ante.
 * Handles SFX playback, looping BGM with crossfade, volume/mute controls,
 * and mobile autoplay unlock.
 */

type PlayOptions = {
  volume?: number;   // 0-1
  pitch?: number;    // playbackRate
  pan?: number;      // -1 (left) to 1 (right)
};

const MAX_CONCURRENT = 3;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private activeSfx = new Map<string, number>(); // soundId → active count

  // Gain nodes
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Music state
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private currentMusicId: string | null = null;

  // Volume state
  private _musicVolume = 0.5;
  private _sfxVolume = 0.7;
  private _muted = false;
  private _unlocked = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initUnlockListener();
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    return this.ctx;
  }

  private _pendingMusicId: string | null = null;

  /** Mobile autoplay unlock — resume suspended context on first user gesture */
  private initUnlockListener(): void {
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          // Retry pending music that failed due to suspended context
          if (this._pendingMusicId && !this.currentMusicSource) {
            const id = this._pendingMusicId;
            this._pendingMusicId = null;
            this.currentMusicId = null; // force replay
            this.playMusic(id);
          }
        });
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('click', unlock, { once: false });
    document.addEventListener('touchstart', unlock, { once: false });
  }

  /** Preload sound files into the buffer cache */
  async preload(soundIds: string[]): Promise<void> {
    const ctx = this.ensureContext();
    await Promise.all(
      soundIds.map(async (id) => {
        if (this.cache.has(id)) return;
        try {
          const resp = await fetch(`/sounds/${id}.mp3`);
          if (!resp.ok) {
            console.warn(`[AudioEngine] Failed to fetch /sounds/${id}.mp3`);
            return;
          }
          const arrayBuf = await resp.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          this.cache.set(id, audioBuf);
        } catch (e) {
          console.warn(`[AudioEngine] Error preloading ${id}:`, e);
        }
      })
    );
  }

  /** Play a one-shot SFX. Auto-fetches if not cached yet. */
  play(soundId: string, options?: PlayOptions): void {
    const buffer = this.cache.get(soundId);
    if (!buffer) {
      // Auto-fetch on first play, then play once loaded
      this.preload([soundId]).then(() => {
        const buf = this.cache.get(soundId);
        if (buf) this.play(soundId, options);
      });
      return;
    }

    const active = this.activeSfx.get(soundId) ?? 0;
    if (active >= MAX_CONCURRENT) return;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (options?.pitch) source.playbackRate.value = options.pitch;

    // Build chain: source → pan? → gain → sfxGain
    let node: AudioNode = source;

    if (options?.pan !== undefined && options.pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = options.pan;
      node.connect(panner);
      node = panner;
    }

    if (options?.volume !== undefined && options.volume !== 1) {
      const g = ctx.createGain();
      g.gain.value = options.volume;
      node.connect(g);
      node = g;
    }

    node.connect(this.sfxGain!);

    this.activeSfx.set(soundId, active + 1);
    source.onended = () => {
      const c = this.activeSfx.get(soundId) ?? 1;
      if (c <= 1) this.activeSfx.delete(soundId);
      else this.activeSfx.set(soundId, c - 1);
    };

    source.start();
  }

  /** Start looping BGM with 500ms crossfade from current track */
  playMusic(trackId: string): void {
    if (this.currentMusicId === trackId) return;
    this._pendingMusicId = trackId;

    const buffer = this.cache.get(trackId);
    if (!buffer) {
      // Auto-fetch then play
      this.preload([trackId]).then(() => {
        if (this.cache.has(trackId)) this.playMusic(trackId);
      });
      return;
    }

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();

    // Fade out current
    if (this.currentMusicSource && this.musicGain) {
      const oldSource = this.currentMusicSource;
      const fadeGain = ctx.createGain();
      fadeGain.gain.value = 1;
      fadeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      // Reconnect old source through fade gain
      try { oldSource.disconnect(); } catch { /* ignore */ }
      oldSource.connect(fadeGain);
      fadeGain.connect(this.musicGain);
      setTimeout(() => { try { oldSource.stop(); } catch { /* ignore */ } }, 500);
    }

    // Start new track
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Fade in
    const fadeIn = ctx.createGain();
    fadeIn.gain.value = 0;
    fadeIn.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.5);
    source.connect(fadeIn);
    fadeIn.connect(this.musicGain!);

    source.start();
    this.currentMusicSource = source;
    this.currentMusicId = trackId;
  }

  /** Fade out and stop current music */
  stopMusic(fadeMs = 500): void {
    if (!this.currentMusicSource || !this.ctx || !this.musicGain) return;

    const ctx = this.ctx;
    const source = this.currentMusicSource;
    const fadeGain = ctx.createGain();
    fadeGain.gain.value = 1;
    fadeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000);

    try { source.disconnect(); } catch { /* ignore */ }
    source.connect(fadeGain);
    fadeGain.connect(this.musicGain);

    setTimeout(() => { try { source.stop(); } catch { /* ignore */ } }, fadeMs);
    this.currentMusicSource = null;
    this.currentMusicId = null;
  }

  setMusicVolume(v: number): void {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this._musicVolume;
  }

  setSfxVolume(v: number): void {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this._sfxVolume;
  }

  mute(): void {
    this._muted = true;
    if (this.masterGain) this.masterGain.gain.value = 0;
  }

  unmute(): void {
    this._muted = false;
    if (this.masterGain) this.masterGain.gain.value = 1;
  }

  toggleMute(): void {
    if (this._muted) this.unmute();
    else this.mute();
  }

  get isMuted(): boolean {
    return this._muted;
  }

  get musicVolume(): number {
    return this._musicVolume;
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }
}

export const audio = new AudioEngine();
