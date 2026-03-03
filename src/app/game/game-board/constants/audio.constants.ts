import { TowerType } from '../models/tower.model';

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
}

export const AUDIO_CONFIG: AudioConfig = {
  masterVolume: 0.3,
  maxTowerFiresPerFrame: 3,
  maxDeathSoundsPerFrame: 2,

  towerFire: {
    [TowerType.BASIC]:  { frequency: 220, endFrequency: 110, duration: 0.08, oscillatorType: 'square',   gain: 0.2 },
    [TowerType.SNIPER]: { frequency: 440, endFrequency: 880, duration: 0.12, oscillatorType: 'sawtooth', gain: 0.2 },
    [TowerType.SPLASH]: { frequency: 180, endFrequency: 80,  duration: 0.15, oscillatorType: 'triangle', gain: 0.2 },
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
};
