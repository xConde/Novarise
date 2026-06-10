// Music system constants and theme configurations.
// All numeric literals are named — no magic numbers anywhere in music.service.ts.

export type MusicTheme = 'hub' | 'combat' | 'boss';

// ── Config interfaces ────────────────────────────────────────────────────────

export interface PadLayerConfig {
  filterCutoff: number;   // Hz — lowpass cutoff
  filterQ: number;        // resonance
  lfoRateHz: number;      // LFO modulation speed
  lfoDepth: number;       // LFO depth (Hz deviation on filter)
  padGain: number;        // base gain for pad layer (0–1)
  detune: number;         // cents of detune spread across voices
  voices: number;         // number of oscillator voices in the pad
}

export interface BassDroneConfig {
  gain: number;           // base gain for bass layer (0–1)
  octaveOffset: number;   // octaves relative to root (typically -2)
}

export interface PluckLayerConfig {
  gain: number;               // base gain for pluck layer (0–1)
  noteProbability: number;    // 0–1 density; used to compute beat-skip modulo
  oscillatorType: OscillatorType;
}

export interface MusicThemeConfig {
  tempo: number;                      // BPM
  rootHz: number;                     // root note frequency (Hz)
  scale: readonly number[];           // intervals in semitones from root
  chordPattern: readonly number[][];  // chord tone indices into scale, one entry per chord slot
  padLayer: PadLayerConfig;
  bassLayer: BassDroneConfig;
  pluckLayer: PluckLayerConfig;
  crossfadeSeconds: number;
}

// ── Global music constants ───────────────────────────────────────────────────

/** Duration of crossfade between themes, in seconds. */
export const CROSSFADE_SECONDS = 2;

/** How often the scheduler tick fires, in milliseconds. */
export const SCHEDULE_INTERVAL_MS = 200;

/** How far ahead the scheduler books beats, in seconds. */
export const SCHEDULE_HORIZON_SECONDS = 0.5;

/** Default master music volume (0–1). */
export const DEFAULT_MUSIC_VOLUME = 0.4;

/**
 * Minimum gain value for exponential ramps — WebAudio requires > 0.
 * Never pass 0 to exponentialRampToValueAtTime.
 */
export const MUSIC_GAIN_EPSILON = 0.001;

/** Pad gain fade-in time on chord start, in seconds. */
export const PAD_FADE_IN_SECONDS = 0.3;

/** Pad gain fade-out time on theme stop, in seconds. */
export const PAD_FADE_OUT_SECONDS = 0.5;

/** Duration of a pluck note envelope, in seconds. */
export const PLUCK_NOTE_DURATION_SECONDS = 0.2;

/** Volume ramp-up time for a pluck note, in seconds. */
export const PLUCK_ATTACK_SECONDS = 0.02;

// ── HUB theme — calm, sparse ─────────────────────────────────────────────────

const HUB_PAD: PadLayerConfig = {
  filterCutoff: 800,
  filterQ: 1.2,
  lfoRateHz: 0.1,
  lfoDepth: 60,
  padGain: 0.18,
  detune: 8,
  voices: 3,
};

const HUB_BASS: BassDroneConfig = {
  gain: 0.12,
  octaveOffset: -2,
};

const HUB_PLUCK: PluckLayerConfig = {
  gain: 0.08,
  noteProbability: 0.3,
  oscillatorType: 'triangle',
};

export const HUB_THEME_CONFIG: MusicThemeConfig = {
  tempo: 60,
  rootHz: 130.81,   // C3
  // C Dorian — slightly melancholic, spacious
  scale: [0, 2, 3, 5, 7, 9, 10, 12],
  // 4 chords cycling: triads/sus on scale degrees 0, 1, 3, 4
  chordPattern: [
    [0, 2, 4],
    [1, 3, 5],
    [3, 5, 7],
    [0, 2, 5],
  ],
  padLayer: HUB_PAD,
  bassLayer: HUB_BASS,
  pluckLayer: HUB_PLUCK,
  crossfadeSeconds: CROSSFADE_SECONDS,
};

// ── COMBAT theme — tense, mid-energy ────────────────────────────────────────

const COMBAT_PAD: PadLayerConfig = {
  filterCutoff: 1200,
  filterQ: 1.8,
  lfoRateHz: 0.25,
  lfoDepth: 100,
  padGain: 0.22,
  detune: 12,
  voices: 3,
};

const COMBAT_BASS: BassDroneConfig = {
  gain: 0.18,
  octaveOffset: -2,
};

const COMBAT_PLUCK: PluckLayerConfig = {
  gain: 0.14,
  noteProbability: 0.5,
  oscillatorType: 'sawtooth',
};

export const COMBAT_THEME_CONFIG: MusicThemeConfig = {
  tempo: 90,
  rootHz: 146.83,   // D3
  // Phrygian Dominant — exotic, tense
  scale: [0, 1, 4, 5, 7, 8, 10, 12],
  chordPattern: [
    [0, 2, 4],
    [1, 3, 5],
    [2, 4, 6],
    [0, 3, 5],
  ],
  padLayer: COMBAT_PAD,
  bassLayer: COMBAT_BASS,
  pluckLayer: COMBAT_PLUCK,
  crossfadeSeconds: CROSSFADE_SECONDS,
};

// ── BOSS theme — dark, driving ───────────────────────────────────────────────

const BOSS_PAD: PadLayerConfig = {
  filterCutoff: 1600,
  filterQ: 2.5,
  lfoRateHz: 0.4,
  lfoDepth: 150,
  padGain: 0.26,
  detune: 18,
  voices: 3,
};

const BOSS_BASS: BassDroneConfig = {
  gain: 0.22,
  octaveOffset: -2,
};

const BOSS_PLUCK: PluckLayerConfig = {
  gain: 0.18,
  noteProbability: 0.7,
  oscillatorType: 'square',
};

export const BOSS_THEME_CONFIG: MusicThemeConfig = {
  tempo: 110,
  rootHz: 123.47,   // B2
  // Locrian — darkest mode
  scale: [0, 1, 3, 5, 6, 8, 10, 12],
  chordPattern: [
    [0, 2, 4],
    [1, 3, 5],
    [0, 3, 6],
    [2, 4, 7],
  ],
  padLayer: BOSS_PAD,
  bassLayer: BOSS_BASS,
  pluckLayer: BOSS_PLUCK,
  crossfadeSeconds: CROSSFADE_SECONDS,
};

// ── Theme config lookup ──────────────────────────────────────────────────────

export const MUSIC_THEME_CONFIGS: Record<MusicTheme, MusicThemeConfig> = {
  hub: HUB_THEME_CONFIG,
  combat: COMBAT_THEME_CONFIG,
  boss: BOSS_THEME_CONFIG,
};
