import { TowerType } from '../models/tower.model';

// --- SFX_CONFIGS: lightweight config for new tower type and game event sounds ---

export interface SfxConfig {
  type: OscillatorType;
  frequency: number;
  endFrequency: number;
  duration: number;
  volume: number;
}

export interface SfxSequenceConfig {
  type: OscillatorType;
  notes: { freq: number; duration: number }[];
  volume: number;
}

export type SfxConfigEntry = SfxConfig | SfxSequenceConfig;

export function isSfxSequenceConfig(cfg: SfxConfigEntry): cfg is SfxSequenceConfig {
  return 'notes' in cfg;
}

export const SFX_CONFIGS: Record<string, SfxConfigEntry> = {
  // High-frequency electric zap for chain lightning tower
  chainZap: {
    type: 'square',
    frequency: 880,
    endFrequency: 1760,
    duration: 0.05,
    volume: 0.18,
  } as SfxConfig,

  // Deep boom for mortar explosion impact
  mortarExplosion: {
    type: 'sine',
    frequency: 80,
    endFrequency: 40,
    duration: 0.3,
    volume: 0.25,
  } as SfxConfig,

  // Subtle hum for slow tower aura activation
  slowAura: {
    type: 'sine',
    frequency: 220,
    endFrequency: 220,
    duration: 0.1,
    volume: 0.1,
  } as SfxConfig,

  // 5-note ascending arpeggio for achievement unlock (C5 E5 G5 B5 C6 — major 7th chord)
  achievement: {
    type: 'sine',
    notes: [
      { freq: 523, duration: 0.08 },   // C5
      { freq: 659, duration: 0.08 },   // E5
      { freq: 784, duration: 0.08 },   // G5
      { freq: 988, duration: 0.08 },   // B5
      { freq: 1047, duration: 0.16 },  // C6 — held
    ],
    volume: 0.3,
  } as SfxSequenceConfig,

  // Quick 2-note ascending chime for streak bonus (E5 G5)
  streak: {
    type: 'sine',
    notes: [
      { freq: 659, duration: 0.07 },   // E5
      { freq: 784, duration: 0.12 },   // G5 — held
    ],
    volume: 0.28,
  } as SfxSequenceConfig,

  // Rapid descending coin cascade for challenge completion (C6 E6 G6)
  challenge: {
    type: 'triangle',
    notes: [
      { freq: 1047, duration: 0.06 },  // C6
      { freq: 1319, duration: 0.06 },  // E6
      { freq: 1568, duration: 0.12 },  // G6 — held
    ],
    volume: 0.25,
  } as SfxSequenceConfig,

  // Ascending tone fanfare for wave completion (multi-note sequence)
  waveComplete: {
    type: 'sine',
    notes: [
      { freq: 440, duration: 0.1 },   // A4
      { freq: 554, duration: 0.1 },   // C#5
      { freq: 659, duration: 0.1 },   // E5
      { freq: 880, duration: 0.2 },   // A5 — held
    ],
    volume: 0.3,
  } as SfxSequenceConfig,

  // Descending tone for game over
  gameOver: {
    type: 'sine',
    frequency: 440,
    endFrequency: 110,
    duration: 0.5,
    volume: 0.3,
  } as SfxConfig,

  // Bright ascending chirp for tower upgrade confirmation
  towerUpgrade: {
    type: 'square',
    frequency: 300,
    endFrequency: 600,
    duration: 0.15,
    volume: 0.25,
  } as SfxConfig,
};

// ---

interface ToneConfig {
  frequency: number;
  endFrequency: number;
  duration: number;
  oscillatorType: OscillatorType;
  gain: number;
}

interface ArpeggioConfig {
  notes: number[];
  noteDuration: number;
  noteGap: number;
  oscillatorType: OscillatorType;
  gain: number;
}

interface EnemyHitConfig extends ToneConfig {
  throttleMs: number;
}

interface EnemyDeathConfig extends ToneConfig {
  noiseGain: number;
  noiseDuration: number;
}

export interface AudioConfig {
  masterVolume: number;
  /** Max simultaneous tower fire sounds per frame. */
  maxTowerFiresPerFrame: number;
  /** Max simultaneous enemy death sounds per frame. */
  maxDeathSoundsPerFrame: number;
  towerFire: Record<TowerType, ToneConfig>;
  enemyHit: EnemyHitConfig;
  enemyDeath: EnemyDeathConfig;
  waveStart: ToneConfig;
  waveClear: ArpeggioConfig;
  goldEarned: ToneConfig;
  towerPlace: ToneConfig;
  towerUpgrade: ArpeggioConfig;
  towerSell: ArpeggioConfig;
  defeat: ToneConfig;
  victory: ArpeggioConfig;
  /** Descending dissonant tone signalling a life lost (~200Hz → 80Hz, square wave). */
  lifeLoss: ToneConfig;
}

export const AUDIO_CONFIG: AudioConfig = {
  masterVolume: 0.3,
  maxTowerFiresPerFrame: 3,
  maxDeathSoundsPerFrame: 2,

  towerFire: {
    [TowerType.BASIC]:   { frequency: 220, endFrequency: 110, duration: 0.08, oscillatorType: 'square',   gain: 0.2 },
    [TowerType.SNIPER]:  { frequency: 440, endFrequency: 880, duration: 0.12, oscillatorType: 'sawtooth', gain: 0.2 },
    [TowerType.SPLASH]:  { frequency: 180, endFrequency: 80,  duration: 0.15, oscillatorType: 'triangle', gain: 0.2 },
    [TowerType.SLOW]:    { frequency: 160, endFrequency: 60,  duration: 0.20, oscillatorType: 'sine',     gain: 0.15 },
    [TowerType.CHAIN]:   { frequency: 300, endFrequency: 600, duration: 0.06, oscillatorType: 'sawtooth', gain: 0.18 },
    [TowerType.MORTAR]:  { frequency: 100, endFrequency: 50,  duration: 0.30, oscillatorType: 'triangle', gain: 0.25 },
  },

  enemyHit: {
    frequency: 160,
    endFrequency: 80,
    duration: 0.06,
    throttleMs: 100,
    oscillatorType: 'triangle',
    gain: 0.15,
  },

  enemyDeath: {
    frequency: 300,
    endFrequency: 60,
    duration: 0.25,
    oscillatorType: 'sawtooth',
    gain: 0.25,
    noiseGain: 0.15,
    noiseDuration: 0.1,
  },

  waveStart: {
    frequency: 200,
    endFrequency: 600,
    duration: 0.5,
    oscillatorType: 'sine',
    gain: 0.3,
  },

  waveClear: {
    notes: [523, 659, 784, 1047],  // C5, E5, G5, C6 — triumphant major chord arpeggio
    noteDuration: 0.1,
    noteGap: 0.08,
    oscillatorType: 'sine',
    gain: 0.3,
  },

  goldEarned: {
    frequency: 1047,
    endFrequency: 1319,
    duration: 0.08,
    oscillatorType: 'sine',
    gain: 0.2,
  },

  towerPlace: {
    frequency: 120,
    endFrequency: 60,
    duration: 0.15,
    oscillatorType: 'square',
    gain: 0.4,
  },

  towerUpgrade: {
    notes: [523, 659, 784],  // C5, E5, G5 — ascending sparkle
    noteDuration: 0.07,
    noteGap: 0.05,
    oscillatorType: 'sine',
    gain: 0.3,
  },

  towerSell: {
    notes: [784, 659, 523],  // G5, E5, C5 — descending cash register
    noteDuration: 0.06,
    noteGap: 0.04,
    oscillatorType: 'triangle',
    gain: 0.3,
  },

  defeat: {
    frequency: 80,
    endFrequency: 40,
    duration: 1.5,
    oscillatorType: 'sawtooth',
    gain: 0.3,
  },

  victory: {
    notes: [523, 659, 784, 1047, 784, 1047],  // C5 E5 G5 C6 G5 C6 — fanfare
    noteDuration: 0.12,
    noteGap: 0.08,
    oscillatorType: 'sine',
    gain: 0.35,
  },

  // Descending dissonant tone: ~200Hz → 80Hz over 300ms, square wave (harsh register)
  lifeLoss: {
    frequency: 200,
    endFrequency: 80,
    duration: 0.3,
    oscillatorType: 'square',
    gain: 0.35,
  },
};
