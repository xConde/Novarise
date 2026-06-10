import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';
import {
  MusicTheme,
  MusicThemeConfig,
  MUSIC_THEME_CONFIGS,
  MUSIC_GAIN_EPSILON,
  SCHEDULE_INTERVAL_MS,
  SCHEDULE_HORIZON_SECONDS,
  PAD_FADE_IN_SECONDS,
  PAD_FADE_OUT_SECONDS,
  PLUCK_NOTE_DURATION_SECONDS,
  PLUCK_ATTACK_SECONDS,
} from '../constants/music.constants';

interface ActivePadLayer {
  oscillators: OscillatorNode[];
  filter: BiquadFilterNode;
  gainNode: GainNode;
  lfoOscillator: OscillatorNode;
  lfoGain: GainNode;
}

interface ActiveBassLayer {
  oscillator: OscillatorNode;
  gainNode: GainNode;
}

interface ThemeState {
  gainNode: GainNode;
  padLayers: ActivePadLayer[];
  bassLayers: ActiveBassLayer[];
  schedulerInterval: ReturnType<typeof setInterval> | null;
  beatIndex: number;
  nextBeatTime: number;
  config: MusicThemeConfig;
}

/**
 * Root-scoped procedural music service.
 *
 * Owns its own AudioContext — does NOT share with AudioService.
 * All audio is synthesised via WebAudio API; no audio files are used.
 *
 * Autoplay policy: AudioContext starts suspended. On first `playTheme()`,
 * one-time pointerdown + keydown listeners resume the context, then start
 * the pending theme. If the context is already running, the theme starts
 * immediately.
 *
 * Architecture:
 * - Each theme gets a GainNode child of masterGain.
 * - Crossfade is done by ramping the old theme's gain to 0 and the new
 *   theme's gain to 1 over `crossfadeSeconds`.
 * - A setInterval scheduler fires every SCHEDULE_INTERVAL_MS and books
 *   beats up to SCHEDULE_HORIZON_SECONDS ahead of `audioContext.currentTime`.
 */
@Injectable({ providedIn: 'root' })
export class MusicService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTheme: MusicTheme | null = null;
  private pendingTheme: MusicTheme | null = null;
  private autoplayListenersBound = false;

  private themeStates: Partial<Record<MusicTheme, ThemeState>> = {};

  private musicEnabled: boolean;
  private musicVolume: number;

  // Named arrow refs for proper listener removal in cleanup()
  private readonly onPointerDown = (): void => { this.handleUserGesture(); };
  private readonly onKeyDown = (): void => { this.handleUserGesture(); };

  constructor(private settingsService: SettingsService) {
    const settings = this.settingsService.get();
    this.musicEnabled = settings.musicEnabled;
    this.musicVolume = settings.musicVolume;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Request playback of the given theme. No-op if theme is already current.
   * Respects musicEnabled setting — does nothing if music is disabled.
   *
   * `currentTheme` is recorded synchronously — it tracks "what should be
   * playing" even before the autoplay gesture unlocks the AudioContext, so
   * idempotence and route wiring (landing sets hub pre-gesture) hold.
   * Actual audio start remains gesture-gated while the context is suspended.
   */
  playTheme(theme: MusicTheme): void {
    if (!this.musicEnabled) return;
    if (this.currentTheme === theme) return;

    this.ensureAudioContext();

    if (this.audioContext === null) {
      // WebAudio unavailable — still record intent so state stays queryable.
      this.currentTheme = theme;
      return;
    }

    if (this.audioContext.state === 'running') {
      this.crossfadeToTheme(theme);
    } else {
      // Suspended — record intent now; defer audio start to first gesture.
      this.currentTheme = theme;
      this.pendingTheme = theme;
      this.bindAutoplayListeners();
    }
  }

  /** Stop all music. Optionally fade out over fadeDurationSeconds. */
  stopMusic(fadeDurationSeconds = 0): void {
    if (this.audioContext === null || this.masterGain === null) {
      this.currentTheme = null;
      return;
    }

    const now = this.audioContext.currentTime;
    const fadeDuration = Math.max(0, fadeDurationSeconds);

    if (fadeDuration > MUSIC_GAIN_EPSILON) {
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
    } else {
      this.masterGain.gain.setValueAtTime(0, now);
    }

    // Stop all active theme schedulers
    const themes = Object.keys(this.themeStates) as MusicTheme[];
    for (const theme of themes) {
      this.stopThemeScheduler(theme);
    }

    this.currentTheme = null;
    this.pendingTheme = null;
  }

  /** Update master music volume (0–1, clamped). */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.min(1, Math.max(0, volume));
    if (this.masterGain && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.masterGain.gain.setValueAtTime(this.musicVolume, now);
    }
  }

  /** Enable or disable music. Stopping immediately when disabled. */
  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic(0);
    }
  }

  /** Tear down the audio context and all resources. Safe to call multiple times. */
  cleanup(): void {
    this.removeAutoplayListeners();

    const themes = Object.keys(this.themeStates) as MusicTheme[];
    for (const theme of themes) {
      this.stopThemeScheduler(theme);
      this.stopThemeNodes(theme);
    }
    this.themeStates = {};
    this.currentTheme = null;
    this.pendingTheme = null;

    if (this.audioContext) {
      // close() is async but we don't need to await it for cleanup purposes
      this.audioContext.close().catch(() => { /* ignore close errors */ });
      this.audioContext = null;
    }

    this.masterGain = null;
  }

  // ── Private: AudioContext lifecycle ──────────────────────────────────────

  private ensureAudioContext(): void {
    if (this.audioContext !== null) return;

    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(this.musicVolume, this.audioContext.currentTime);
      this.masterGain.connect(this.audioContext.destination);
    } catch {
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  private bindAutoplayListeners(): void {
    if (this.autoplayListenersBound) return;
    this.autoplayListenersBound = true;
    document.addEventListener('pointerdown', this.onPointerDown, { once: true });
    document.addEventListener('keydown', this.onKeyDown, { once: true });
  }

  private removeAutoplayListeners(): void {
    document.removeEventListener('pointerdown', this.onPointerDown);
    document.removeEventListener('keydown', this.onKeyDown);
    this.autoplayListenersBound = false;
  }

  private handleUserGesture(): void {
    this.autoplayListenersBound = false;
    if (this.audioContext === null) return;

    this.audioContext.resume().then(() => {
      if (this.pendingTheme !== null) {
        this.crossfadeToTheme(this.pendingTheme);
        this.pendingTheme = null;
      }
    }).catch(() => { /* resume may fail on context-close; ignore */ });
  }

  // ── Private: Crossfade ───────────────────────────────────────────────────

  private crossfadeToTheme(theme: MusicTheme): void {
    if (this.audioContext === null || this.masterGain === null) return;

    const config = MUSIC_THEME_CONFIGS[theme];
    const now = this.audioContext.currentTime;
    const fadeDuration = config.crossfadeSeconds;

    // Fade out old theme
    const oldTheme = this.currentTheme;
    if (oldTheme !== null) {
      const oldState = this.themeStates[oldTheme];
      if (oldState) {
        oldState.gainNode.gain.setValueAtTime(oldState.gainNode.gain.value, now);
        oldState.gainNode.gain.linearRampToValueAtTime(MUSIC_GAIN_EPSILON, now + fadeDuration);
        // Stop old scheduler after the fade
        const stopDelay = fadeDuration * 1000;
        setTimeout(() => {
          this.stopThemeScheduler(oldTheme);
          this.stopThemeNodes(oldTheme);
        }, stopDelay);
      }
    }

    // Ensure master gain is at current volume (may have been ramped to 0 by stopMusic)
    this.masterGain.gain.setValueAtTime(this.musicVolume, now);

    // Start new theme
    this.currentTheme = theme;
    this.startTheme(theme, fadeDuration);
  }

  // ── Private: Theme start / stop ──────────────────────────────────────────

  private startTheme(theme: MusicTheme, fadeInDuration: number): void {
    if (this.audioContext === null || this.masterGain === null) return;

    const config = MUSIC_THEME_CONFIGS[theme];

    // Create theme-level gain node (starts near silence, ramps to 1)
    const themeGain = this.audioContext.createGain();
    themeGain.gain.setValueAtTime(MUSIC_GAIN_EPSILON, this.audioContext.currentTime);
    themeGain.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + fadeInDuration);
    themeGain.connect(this.masterGain);

    const state: ThemeState = {
      gainNode: themeGain,
      padLayers: [],
      bassLayers: [],
      schedulerInterval: null,
      beatIndex: 0,
      nextBeatTime: this.audioContext.currentTime,
      config,
    };

    // Stop any existing state for this theme before overwriting
    if (this.themeStates[theme]) {
      this.stopThemeScheduler(theme);
      this.stopThemeNodes(theme);
    }

    this.themeStates[theme] = state;

    // Kick off the beat scheduler
    state.schedulerInterval = setInterval(() => {
      this.tick(theme);
    }, SCHEDULE_INTERVAL_MS);
  }

  private stopThemeScheduler(theme: MusicTheme): void {
    const state = this.themeStates[theme];
    if (!state) return;
    if (state.schedulerInterval !== null) {
      clearInterval(state.schedulerInterval);
      state.schedulerInterval = null;
    }
  }

  private stopThemeNodes(theme: MusicTheme): void {
    const state = this.themeStates[theme];
    if (!state) return;

    for (const pad of state.padLayers) {
      this.stopPadLayer(pad);
    }
    state.padLayers = [];

    for (const bass of state.bassLayers) {
      this.stopBassLayer(bass);
    }
    state.bassLayers = [];

    try {
      state.gainNode.disconnect();
    } catch { /* already disconnected */ }

    delete this.themeStates[theme];
  }

  // ── Private: Beat scheduler ──────────────────────────────────────────────

  private tick(theme: MusicTheme): void {
    if (this.audioContext === null) return;
    const state = this.themeStates[theme];
    if (!state) return;

    const horizon = this.audioContext.currentTime + SCHEDULE_HORIZON_SECONDS;

    while (state.nextBeatTime < horizon) {
      this.scheduleBeat(theme, state, state.nextBeatTime);
      const beatDuration = this.beatDuration(state.config.tempo);
      state.nextBeatTime += beatDuration;
      state.beatIndex++;
    }
  }

  private beatDuration(tempo: number): number {
    // seconds per beat = 60 / BPM
    return 60 / tempo;
  }

  private scheduleBeat(theme: MusicTheme, state: ThemeState, beatTime: number): void {
    if (this.audioContext === null) return;

    const config = state.config;
    const beatsPerBar = config.chordPattern.length;
    const beatInBar = state.beatIndex % beatsPerBar;
    const chordIndex = beatInBar;
    const chord = config.chordPattern[chordIndex];

    // On beat 0 of each bar — restart sustained pad + bass for new chord
    if (beatInBar === 0) {
      this.schedulePadChord(theme, state, chord, beatTime);
      this.scheduleBassNote(theme, state, chord, beatTime);
    }

    // Pluck: fire on beats determined by the noteProbability density
    this.schedulePluckNote(state, chord, beatInBar, beatTime);
  }

  // ── Private: Pad layer ───────────────────────────────────────────────────

  private schedulePadChord(
    theme: MusicTheme,
    state: ThemeState,
    chord: readonly number[],
    startTime: number,
  ): void {
    if (this.audioContext === null) return;
    const config = state.config;

    // Fade out and remove old pad layers
    for (const pad of state.padLayers) {
      this.fadePadOut(pad, startTime);
    }
    state.padLayers = [];

    // Create one pad layer per chord tone
    for (const scaleDegreeIndex of chord) {
      const semitones = config.scale[scaleDegreeIndex % config.scale.length];
      const noteHz = this.semitoneToHz(config.rootHz, semitones);
      const pad = this.createPadLayer(state, noteHz, startTime);
      state.padLayers.push(pad);
    }

    // Suppress 'theme' unused-variable lint — it's kept for API consistency
    void theme;
  }

  private createPadLayer(state: ThemeState, noteHz: number, startTime: number): ActivePadLayer {
    const ctx = this.audioContext!;
    const config = state.config.padLayer;

    // Lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(config.filterCutoff, startTime);
    filter.Q.setValueAtTime(config.filterQ, startTime);

    // Pad output gain
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(MUSIC_GAIN_EPSILON, startTime);
    gainNode.gain.linearRampToValueAtTime(config.padGain, startTime + PAD_FADE_IN_SECONDS);

    // LFO modulates filter frequency for a filter-sweep feel
    const lfoOscillator = ctx.createOscillator();
    lfoOscillator.type = 'sine';
    lfoOscillator.frequency.setValueAtTime(config.lfoRateHz, startTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(config.lfoDepth, startTime);

    lfoOscillator.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // Voice oscillators — detuned spread
    const oscillators: OscillatorNode[] = [];
    const voices = config.voices;
    for (let v = 0; v < voices; v++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';

      // Detune: centre voice at 0, outer voices at ±detune cents
      const detuneOffset = voices > 1
        ? (v / (voices - 1) - 0.5) * 2 * config.detune
        : 0;
      osc.frequency.setValueAtTime(noteHz, startTime);
      osc.detune.setValueAtTime(detuneOffset, startTime);

      osc.connect(filter);
      osc.start(startTime);
      oscillators.push(osc);
    }

    filter.connect(gainNode);
    gainNode.connect(state.gainNode);
    lfoOscillator.start(startTime);

    return { oscillators, filter, gainNode, lfoOscillator, lfoGain };
  }

  private fadePadOut(pad: ActivePadLayer, fromTime: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    pad.gainNode.gain.setValueAtTime(pad.gainNode.gain.value, fromTime);
    pad.gainNode.gain.linearRampToValueAtTime(
      MUSIC_GAIN_EPSILON,
      fromTime + PAD_FADE_OUT_SECONDS,
    );

    const stopTime = fromTime + PAD_FADE_OUT_SECONDS + 0.05;
    for (const osc of pad.oscillators) {
      try { osc.stop(stopTime); } catch { /* already stopped */ }
    }
    try { pad.lfoOscillator.stop(stopTime); } catch { /* already stopped */ }
  }

  private stopPadLayer(pad: ActivePadLayer): void {
    for (const osc of pad.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    try { pad.lfoOscillator.stop(); } catch { /* already stopped */ }
    try { pad.gainNode.disconnect(); } catch { /* already disconnected */ }
    try { pad.lfoGain.disconnect(); } catch { /* already disconnected */ }
    try { pad.filter.disconnect(); } catch { /* already disconnected */ }
  }

  // ── Private: Bass layer ──────────────────────────────────────────────────

  private scheduleBassNote(
    theme: MusicTheme,
    state: ThemeState,
    chord: readonly number[],
    startTime: number,
  ): void {
    if (this.audioContext === null) return;
    const config = state.config;

    // Stop previous bass
    for (const bass of state.bassLayers) {
      this.stopBassLayer(bass);
    }
    state.bassLayers = [];

    // Root of chord (first tone in chord array)
    const rootScaleDegree = chord[0];
    const semitones = config.scale[rootScaleDegree % config.scale.length];
    // Two octaves down
    const bassHz = this.semitoneToHz(
      config.rootHz,
      semitones + config.bassLayer.octaveOffset * 12,
    );

    const ctx = this.audioContext;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(bassHz, startTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(config.bassLayer.gain, startTime);

    osc.connect(gainNode);
    gainNode.connect(state.gainNode);
    osc.start(startTime);

    state.bassLayers.push({ oscillator: osc, gainNode });

    // Suppress unused lint warning
    void theme;
  }

  private stopBassLayer(bass: ActiveBassLayer): void {
    try { bass.oscillator.stop(); } catch { /* already stopped */ }
    try { bass.gainNode.disconnect(); } catch { /* already disconnected */ }
  }

  // ── Private: Pluck layer ─────────────────────────────────────────────────

  private schedulePluckNote(
    state: ThemeState,
    chord: readonly number[],
    beatInBar: number,
    beatTime: number,
  ): void {
    if (this.audioContext === null) return;
    const config = state.config;

    // Beat-modulo density pattern from noteProbability:
    // noteProbability=0.3 → fires every ~3 beats; 0.5 → every 2; 0.7 → every ~1-2
    const skipInterval = Math.max(1, Math.round(1 / config.pluckLayer.noteProbability));
    if (state.beatIndex % skipInterval !== 0) return;

    // Pick a tone from the current chord by beat index
    const toneIndex = chord[beatInBar % chord.length];
    const semitones = config.scale[toneIndex % config.scale.length];
    const noteHz = this.semitoneToHz(config.rootHz, semitones);

    const ctx = this.audioContext;

    const osc = ctx.createOscillator();
    osc.type = config.pluckLayer.oscillatorType;
    osc.frequency.setValueAtTime(noteHz, beatTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(MUSIC_GAIN_EPSILON, beatTime);
    gainNode.gain.linearRampToValueAtTime(
      config.pluckLayer.gain,
      beatTime + PLUCK_ATTACK_SECONDS,
    );
    gainNode.gain.linearRampToValueAtTime(
      MUSIC_GAIN_EPSILON,
      beatTime + PLUCK_NOTE_DURATION_SECONDS,
    );

    osc.connect(gainNode);
    gainNode.connect(state.gainNode);
    osc.start(beatTime);
    osc.stop(beatTime + PLUCK_NOTE_DURATION_SECONDS + 0.02);
  }

  // ── Private: Utility ─────────────────────────────────────────────────────

  private semitoneToHz(rootHz: number, semitones: number): number {
    return rootHz * Math.pow(2, semitones / 12);
  }
}
