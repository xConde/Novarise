import { EnemyType } from './enemy-type.model';

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
 * Returns true when the wave contains more than one BOSS-type enemy in total —
 * i.e. a "twin-boss" wave. Works for both entries[] and spawnTurns[][] formats.
 *
 * Used by CombatLoopService to halve per-BOSS leak damage on twin-boss waves so
 * a full double-leak doesn't instantly defeat the player (3+3 → 2+2 lives lost).
 */
export function isTwinBossWave(wave: WaveDefinition): boolean {
  let bossCount = 0;
  if (wave.spawnTurns) {
    for (const turn of wave.spawnTurns) {
      for (const type of turn) {
        if (type === EnemyType.BOSS) bossCount++;
      }
    }
  } else if (wave.entries) {
    for (const entry of wave.entries) {
      if (entry.type === EnemyType.BOSS) bossCount += entry.count;
    }
  }
  return bossCount > 1;
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
