import { EnemyType } from './enemy.model';
import { WaveEntry, WaveDefinition, getWaveEnemyCount, getWaveEnemyTypes } from '@core/models/wave-definition.model';
export { WaveEntry, WaveDefinition, getWaveEnemyCount, getWaveEnemyTypes };

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
  // Wave 7: Heavy siege with shielded vanguard, plus diggers.
  // Phase 2 sprint 21 — MINER introduced as a mid-wave board-mutation threat.
  // 2 MINERs every 2.0s on an 8-turn-ish wave means each digs once if the
  // wave runs long enough (dig cadence is every 3rd turn post-spawn). Their
  // adjacent-wall destruction can carve new paths for follower enemies.
  // Balance: placeholder count — refine via playtest + sprint 79 balance pass.
  {
    entries: [
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: 2.0 },
      { type: EnemyType.HEAVY, count: 4, spawnInterval: 1.5 },
      { type: EnemyType.BASIC, count: 8, spawnInterval: 0.8 },
      { type: EnemyType.MINER, count: 2, spawnInterval: 2.5 }
    ],
    reward: 100
  },
  // Wave 8: Swarm rush with flying scouts
  {
    entries: [
      { type: EnemyType.SWARM, count: 8, spawnInterval: 0.6 },
      { type: EnemyType.FAST, count: 6, spawnInterval: 0.4 },
      { type: EnemyType.FLYING, count: 3, spawnInterval: 1.2 }
    ],
    reward: 120
  },
  // Wave 9: Mixed shielded, swarm, and flying gauntlet
  {
    entries: [
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: 1.5 },
      { type: EnemyType.SWARM, count: 5, spawnInterval: 0.8 },
      { type: EnemyType.HEAVY, count: 2, spawnInterval: 1.2 },
      { type: EnemyType.FAST, count: 4, spawnInterval: 0.5 },
      { type: EnemyType.FLYING, count: 3, spawnInterval: 1.0 }
    ],
    reward: 150
  },
  // Wave 10: Boss wave with escort
  {
    entries: [
      { type: EnemyType.BOSS, count: 1, spawnInterval: 0 },
      { type: EnemyType.SHIELDED, count: 2, spawnInterval: 1.5 },
      { type: EnemyType.SWARM, count: 3, spawnInterval: 1.0 },
      { type: EnemyType.HEAVY, count: 1, spawnInterval: 2.0 }
    ],
    reward: 250
  }
];
