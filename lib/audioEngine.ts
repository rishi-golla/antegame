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

type MusicIntensity = 'calm' | 'normal' | 'tense' | 'hype';

const MAX_CONCURRENT = 3;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private activeSfx = new Map<string, number>(); // soundId → active count

  // Gain nodes
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;

  // Music intensity filter chain
  private musicFilterChain: {
    lowpass: BiquadFilterNode | null;
    highpass: BiquadFilterNode | null;
    gain: GainNode | null;
  } = { lowpass: null, highpass: null, gain: null };

  // Music state
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private currentMusicId: string | null = null;
  private currentIntensity: MusicIntensity = 'normal';

  // Ambient state
  private ambientSources: AudioBufferSourceNode[] = [];
  private ambientActive = false;
  private ambientIntervals: number[] = [];

  // Volume state
  private _musicVolume = 0.35;
  private _sfxVolume = 0.45;
  private _ambientVolume = 0.2;
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

      // Music chain with filters
      this.musicFilterChain.lowpass = this.ctx.createBiquadFilter();
      this.musicFilterChain.lowpass.type = 'lowpass';
      this.musicFilterChain.lowpass.frequency.value = 22000;

      this.musicFilterChain.highpass = this.ctx.createBiquadFilter();
      this.musicFilterChain.highpass.type = 'highpass';
      this.musicFilterChain.highpass.frequency.value = 20;

      this.musicFilterChain.gain = this.ctx.createGain();
      this.musicFilterChain.gain.gain.value = 1;

      // Chain: musicGain -> lowpass -> highpass -> filterGain -> masterGain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this._musicVolume;
      this.musicGain.connect(this.musicFilterChain.lowpass);
      this.musicFilterChain.lowpass.connect(this.musicFilterChain.highpass);
      this.musicFilterChain.highpass.connect(this.musicFilterChain.gain);
      this.musicFilterChain.gain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this._sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this._ambientVolume;
      this.ambientGain.connect(this.masterGain);
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

    // Fade in - connect directly to musicGain (filters are in the chain after musicGain)
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

  setAmbientVolume(v: number): void {
    this._ambientVolume = Math.max(0, Math.min(1, v));
    if (this.ambientGain) this.ambientGain.gain.value = this._ambientVolume;
  }

  get ambientVolume(): number {
    return this._ambientVolume;
  }

  /** Set music intensity with filter effects */
  setMusicIntensity(level: MusicIntensity): void {
    if (this.currentIntensity === level) return;
    this.currentIntensity = level;

    if (!this.ctx || !this.musicFilterChain.lowpass || !this.musicFilterChain.highpass || !this.musicFilterChain.gain) return;

    const ctx = this.ctx;
    const currentTime = ctx.currentTime;

    // Apply filters based on intensity
    switch (level) {
      case 'calm':
        this.musicFilterChain.lowpass.frequency.linearRampToValueAtTime(8000, currentTime + 0.5);
        this.musicFilterChain.highpass.frequency.linearRampToValueAtTime(20, currentTime + 0.5);
        this.musicFilterChain.gain.gain.linearRampToValueAtTime(0.8, currentTime + 0.5);
        break;
      case 'normal':
        this.musicFilterChain.lowpass.frequency.linearRampToValueAtTime(22000, currentTime + 0.5);
        this.musicFilterChain.highpass.frequency.linearRampToValueAtTime(20, currentTime + 0.5);
        this.musicFilterChain.gain.gain.linearRampToValueAtTime(1.0, currentTime + 0.5);
        break;
      case 'tense':
        this.musicFilterChain.lowpass.frequency.linearRampToValueAtTime(22000, currentTime + 0.5);
        this.musicFilterChain.highpass.frequency.linearRampToValueAtTime(100, currentTime + 0.5);
        this.musicFilterChain.gain.gain.linearRampToValueAtTime(1.05, currentTime + 0.5);
        break;
      case 'hype':
        this.musicFilterChain.lowpass.frequency.linearRampToValueAtTime(22000, currentTime + 0.5);
        this.musicFilterChain.highpass.frequency.linearRampToValueAtTime(200, currentTime + 0.5);
        this.musicFilterChain.gain.gain.linearRampToValueAtTime(1.1, currentTime + 0.5);
        break;
    }
  }

  /** Play procedural ambient casino sounds */
  playAmbient(): void {
    if (this.ambientActive) return;
    this.ambientActive = true;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();

    // Background hum using filtered noise
    const noise = this.createNoise();
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 120;
    humFilter.Q.value = 2;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.05;
    noise.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.ambientGain!);
    this.ambientSources.push(noise);
    noise.start();

    // Random distant slot jingles (every 8-15 seconds)
    const scheduleSlotJingle = () => {
      if (!this.ambientActive) return;
      const delay = 8000 + Math.random() * 7000;
      const timer = window.setTimeout(() => {
        if (this.ambientActive) {
          this.play('sfx/collect-money', { volume: 0.15, pitch: 0.8 + Math.random() * 0.4 });
          scheduleSlotJingle();
        }
      }, delay);
      this.ambientIntervals.push(timer);
    };
    scheduleSlotJingle();

    // Random distant cheers (every 12-25 seconds)
    const scheduleCheer = () => {
      if (!this.ambientActive) return;
      const delay = 12000 + Math.random() * 13000;
      const timer = window.setTimeout(() => {
        if (this.ambientActive) {
          // Create a brief cheer sound using oscillators
          this.createDistantCheer();
          scheduleCheer();
        }
      }, delay);
      this.ambientIntervals.push(timer);
    };
    scheduleCheer();
  }

  /** Stop ambient sounds */
  stopAmbient(): void {
    this.ambientActive = false;
    
    // Stop all ambient sources
    this.ambientSources.forEach(source => {
      try { source.stop(); } catch { /* ignore */ }
    });
    this.ambientSources = [];

    // Clear intervals
    this.ambientIntervals.forEach(id => clearTimeout(id));
    this.ambientIntervals = [];
  }

  /** Create procedural noise for ambient hum */
  private createNoise(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2) - 1;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  /** Create a procedural distant cheer sound */
  private createDistantCheer(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    
    // Create a brief burst of filtered noise to simulate distant crowd
    const cheerNoise = this.createNoise();
    const cheerFilter = ctx.createBiquadFilter();
    cheerFilter.type = 'bandpass';
    cheerFilter.frequency.value = 800 + Math.random() * 400;
    cheerFilter.Q.value = 3;
    
    const envelope = ctx.createGain();
    envelope.gain.value = 0;
    envelope.gain.linearRampToValueAtTime(0.04, now + 0.1);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    cheerNoise.connect(cheerFilter);
    cheerFilter.connect(envelope);
    envelope.connect(this.ambientGain!);
    
    cheerNoise.start(now);
    cheerNoise.stop(now + 1);
  }

  /** Play money transaction sound based on amount */
  playMoneySound(amount: number): void {
    if (amount < 50) {
      this.play('sfx/collect-money', { volume: 0.25, pitch: 1.2 });
    } else if (amount < 200) {
      this.play('sfx/collect-money', { volume: 0.4 });
    } else if (amount < 500) {
      this.play('sfx/collect-money', { volume: 0.5 });
      setTimeout(() => this.play('sfx/big-payment', { volume: 0.2 }), 100);
    } else {
      this.play('sfx/big-payment', { volume: 0.5 });
    }
  }

  /** Play distant celebration for other players' wins */
  playDistantCelebration(): void {
    setTimeout(() => {
      this.play('sfx/collect-money', { volume: 0.2, pitch: 0.9 });
    }, Math.random() * 200);
    
    setTimeout(() => {
      this.createDistantCheer();
    }, 300 + Math.random() * 200);
  }
}

export const audio = new AudioEngine();
