import { EnemyType } from './enemy.model';

export interface WaveEntry {
  type: EnemyType;
  count: number;
  spawnInterval: number; // seconds between spawns
}

export interface WaveDefinition {
  entries: WaveEntry[];
  reward: number; // bonus gold for completing wave
}

export const WAVE_DEFINITIONS: WaveDefinition[] = [
  // Wave 1: Easy intro
  {
    entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: 1.5 }
    ],
    reward: 25
  },
  // Wave 2: More basics
  {
    entries: [
      { type: EnemyType.BASIC, count: 8, spawnInterval: 1.2 }
    ],
    reward: 30
  },
  // Wave 3: Fast enemies introduced
  {
    entries: [
      { type: EnemyType.BASIC, count: 5, spawnInterval: 1.0 },
      { type: EnemyType.FAST, count: 3, spawnInterval: 0.8 }
    ],
    reward: 40
  },
  // Wave 4: Heavy enemies
  {
    entries: [
      { type: EnemyType.BASIC, count: 6, spawnInterval: 1.0 },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: 2.0 }
    ],
    reward: 50
  },
  // Wave 5: Mixed assault
  {
    entries: [
      { type: EnemyType.BASIC, count: 8, spawnInterval: 0.8 },
      { type: EnemyType.FAST, count: 5, spawnInterval: 0.6 },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: 1.5 }
    ],
    reward: 75
  },
  // Wave 6: Swift assault
  {
    entries: [
      { type: EnemyType.FAST, count: 6, spawnInterval: 0.6 },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: 1.0 }
    ],
    reward: 80
  },
  // Wave 7: Heavy siege
  {
    entries: [
      { type: EnemyType.HEAVY, count: 5, spawnInterval: 1.5 },
      { type: EnemyType.BASIC, count: 10, spawnInterval: 0.8 }
    ],
    reward: 100
  },
  // Wave 8: Speed rush
  {
    entries: [
      { type: EnemyType.FAST, count: 12, spawnInterval: 0.4 },
      { type: EnemyType.SWIFT, count: 6, spawnInterval: 0.5 }
    ],
    reward: 120
  },
  // Wave 9: Pre-boss gauntlet
  {
    entries: [
      { type: EnemyType.BASIC, count: 10, spawnInterval: 0.6 },
      { type: EnemyType.HEAVY, count: 5, spawnInterval: 1.0 },
      { type: EnemyType.FAST, count: 8, spawnInterval: 0.5 },
      { type: EnemyType.SWIFT, count: 4, spawnInterval: 0.8 }
    ],
    reward: 150
  },
  // Wave 10: Boss wave
  {
    entries: [
      { type: EnemyType.BOSS, count: 1, spawnInterval: 0 },
      { type: EnemyType.HEAVY, count: 3, spawnInterval: 2.0 },
      { type: EnemyType.BASIC, count: 8, spawnInterval: 1.0 }
    ],
    reward: 250
  }
];
