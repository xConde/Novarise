import { EnemyType } from './enemy.model';

export interface WaveEntry {
  type: EnemyType;
  count: number;
  spawnInterval: number; // seconds between spawns
}

export interface WaveDefinition {
  /**
   * Legacy time-based entries. When set, the engine interleaves one-per-entry
   * per turn at startWave time (see WaveService.buildTurnSchedule). Kept for
   * backward compatibility with existing WAVE_DEFINITIONS, boss presets, and
   * procedural wave generation.
   *
   * At least one of `entries` or `spawnTurns` MUST be set — a wave with both
   * undefined is a runtime error.
   */
  readonly entries?: WaveEntry[];

  /**
   * Authored per-turn spawn schedule. When set, takes precedence over `entries`.
   * Each inner array is the enemies to spawn on turn N (0-indexed from wave
   * start). Empty arrays are intentional "prep turns" with no spawns — used
   * to telegraph a boss arrival or to give the player a breathing turn before
   * a burst.
   *
   * Example:
   *   [[BASIC, BASIC], [], [], [HEAVY], [BOSS]]
   *   turn 0: spawn 2 BASIC
   *   turn 1: (empty — prep)
   *   turn 2: (empty — prep)
   *   turn 3: spawn 1 HEAVY
   *   turn 4: spawn 1 BOSS
   */
  readonly spawnTurns?: EnemyType[][];

  reward: number; // bonus gold for completing wave
}

/**
 * Total enemy count for a wave, regardless of whether it uses entries or spawnTurns.
 * Use this instead of accessing wave.entries directly to handle both formats.
 */
export function getWaveEnemyCount(wave: WaveDefinition): number {
  if (wave.spawnTurns) return wave.spawnTurns.reduce((sum, turn) => sum + turn.length, 0);
  if (wave.entries) return wave.entries.reduce((sum, e) => sum + e.count, 0);
  return 0;
}

/**
 * Returns the set of EnemyTypes present in a wave, regardless of format.
 * Useful for boss-detection checks that previously accessed wave.entries directly.
 */
export function getWaveEnemyTypes(wave: WaveDefinition): Set<EnemyType> {
  const types = new Set<EnemyType>();
  if (wave.spawnTurns) {
    for (const turn of wave.spawnTurns) {
      for (const type of turn) types.add(type);
    }
  } else if (wave.entries) {
    for (const entry of wave.entries) types.add(entry.type);
  }
  return types;
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
  // Wave 7: Heavy siege with shielded vanguard
  {
    entries: [
      { type: EnemyType.SHIELDED, count: 3, spawnInterval: 2.0 },
      { type: EnemyType.HEAVY, count: 4, spawnInterval: 1.5 },
      { type: EnemyType.BASIC, count: 8, spawnInterval: 0.8 }
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
