export const AUDIO_CONFIG = {
  masterVolume: 0.3,

  towerFire: {
    basic:  { frequency: 220, endFrequency: 110, duration: 0.08, oscillatorType: 'square' as OscillatorType },
    sniper: { frequency: 440, endFrequency: 880, duration: 0.12, oscillatorType: 'sawtooth' as OscillatorType },
    splash: { frequency: 180, endFrequency: 80,  duration: 0.15, oscillatorType: 'triangle' as OscillatorType }
  },

  enemyHit: {
    frequency: 160,
    endFrequency: 80,
    duration: 0.06,
    throttleMs: 100,
    oscillatorType: 'triangle' as OscillatorType
  },

  enemyDeath: {
    frequency: 300,
    endFrequency: 60,
    duration: 0.25,
    oscillatorType: 'sawtooth' as OscillatorType,
    noiseGain: 0.15,
    noiseDuration: 0.1
  },

  waveStart: {
    frequency: 200,
    endFrequency: 600,
    duration: 0.5,
    oscillatorType: 'sine' as OscillatorType
  },

  waveClear: {
    notes: [523, 659, 784, 1047],  // C5, E5, G5, C6 — triumphant major chord arpeggio
    noteDuration: 0.1,
    noteGap: 0.08,
    oscillatorType: 'sine' as OscillatorType
  },

  goldEarned: {
    frequency: 1047,
    endFrequency: 1319,
    duration: 0.08,
    oscillatorType: 'sine' as OscillatorType
  },

  towerPlace: {
    frequency: 120,
    endFrequency: 60,
    duration: 0.15,
    oscillatorType: 'square' as OscillatorType,
    gain: 0.4
  },

  towerUpgrade: {
    notes: [523, 659, 784],  // C5, E5, G5 — ascending sparkle
    noteDuration: 0.07,
    noteGap: 0.05,
    oscillatorType: 'sine' as OscillatorType
  },

  towerSell: {
    notes: [784, 659, 523],  // G5, E5, C5 — descending cash register
    noteDuration: 0.06,
    noteGap: 0.04,
    oscillatorType: 'triangle' as OscillatorType
  },

  defeat: {
    frequency: 80,
    endFrequency: 40,
    duration: 1.5,
    oscillatorType: 'sawtooth' as OscillatorType,
    gain: 0.3
  },

  victory: {
    notes: [523, 659, 784, 1047, 784, 1047],  // C5 E5 G5 C6 G5 C6 — fanfare
    noteDuration: 0.12,
    noteGap: 0.08,
    oscillatorType: 'sine' as OscillatorType
  }
};
