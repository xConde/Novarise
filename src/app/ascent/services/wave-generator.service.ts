import { Injectable } from '@angular/core';
import { WaveDefinition, WaveEntry } from '../../game/game-board/models/wave.model';
import { EnemyType } from '../../game/game-board/models/enemy.model';
import { ENCOUNTER_CONFIG, createSeededRng } from '../constants/ascent.constants';

// ── Enemy pool constants ───────────────────────────────────────

/** Enemy types available at each depth tier in act 1. */
const ACT1_EARLY_POOL: EnemyType[] = [EnemyType.BASIC, EnemyType.FAST];
const ACT1_MID_POOL: EnemyType[] = [EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT];
const ACT1_LATE_POOL: EnemyType[] = [
  EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT, EnemyType.SHIELDED,
];
const ACT2_BASE_POOL: EnemyType[] = [
  EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT,
  EnemyType.SHIELDED, EnemyType.SWARM,
];
const ACT2_FLYING_POOL: EnemyType[] = [...ACT2_BASE_POOL, EnemyType.FLYING];

/** Row thresholds for act 1 enemy pool tiers. */
const ACT1_EARLY_MAX_ROW = 3;
const ACT1_MID_MAX_ROW = 7;

/** Minimum row in act 2 at which FLYING enemies appear. */
const ACT2_FLYING_MIN_ROW = 3;

// ── Wave scaling constants ─────────────────────────────────────

/** Gold reward per wave: base + row scaling. */
const WAVE_GOLD_BASE = 15;
const WAVE_GOLD_PER_ROW = 3;

/** Spawn interval clamping bounds (seconds). */
const SPAWN_INTERVAL_MAX = 1.0;
const SPAWN_INTERVAL_MIN = 0.4;
const SPAWN_INTERVAL_ROW_REDUCTION = 0.03;

/** Number of entry types per wave (1-2 enemy types per wave). */
const MIN_ENTRY_TYPES = 1;
const MAX_ENTRY_TYPES = 2;

/**
 * Generates procedural WaveDefinition arrays for Ascent Mode encounters.
 *
 * All generation is deterministic: seed is combined with row and actIndex
 * so each node on the map produces a unique but reproducible wave set.
 */
@Injectable({ providedIn: 'root' })
export class WaveGeneratorService {

  /**
   * Generate waves for a standard combat node.
   * Produces ENCOUNTER_CONFIG.wavesPerCombat waves.
   */
  generateCombatWaves(row: number, actIndex: number, seed: number): WaveDefinition[] {
    const rng = createSeededRng(seed + row * 1000 + actIndex * 10000);
    const pool = getEnemyPool(row, actIndex);
    return this.buildWaves(rng, pool, row, actIndex, ENCOUNTER_CONFIG.wavesPerCombat, 1, 1);
  }

  /**
   * Generate waves for an elite node.
   * Same structure as combat but with health and gold multipliers applied,
   * and one wave guaranteed to include a BOSS-type enemy.
   */
  generateEliteWaves(row: number, actIndex: number, seed: number): WaveDefinition[] {
    const rng = createSeededRng(seed + row * 1000 + actIndex * 10000);
    const pool = getEnemyPool(row, actIndex);
    const waves = this.buildWaves(
      rng,
      pool,
      row,
      actIndex,
      ENCOUNTER_CONFIG.wavesPerElite,
      ENCOUNTER_CONFIG.eliteHealthMultiplier,
      ENCOUNTER_CONFIG.eliteGoldMultiplier,
    );

    // Guarantee one wave has a BOSS-type entry
    return injectBossWave(waves, rng, ENCOUNTER_CONFIG.eliteGoldMultiplier);
  }

  /**
   * Generate waves for the act boss node.
   * Heavily scaled — final wave is always a single BOSS enemy with max scaling.
   */
  generateBossWaves(actIndex: number, seed: number): WaveDefinition[] {
    // Boss row is always the last row (rowsPerAct = 11)
    const bossRow = 11;
    const rng = createSeededRng(seed + bossRow * 1000 + actIndex * 10000);
    const pool = getEnemyPool(bossRow, actIndex);
    const waves = this.buildWaves(
      rng,
      pool,
      bossRow,
      actIndex,
      ENCOUNTER_CONFIG.wavesPerBoss - 1, // reserve last wave for solo boss
      ENCOUNTER_CONFIG.bossHealthMultiplier,
      ENCOUNTER_CONFIG.bossGoldMultiplier,
    );

    // Final wave: single BOSS entry with max gold scaling
    const finalGold = Math.round(
      (WAVE_GOLD_BASE + bossRow * WAVE_GOLD_PER_ROW) * ENCOUNTER_CONFIG.bossGoldMultiplier * 2,
    );
    const finalWave: WaveDefinition = {
      entries: [{ type: EnemyType.BOSS, count: 1, spawnInterval: 0 }],
      reward: finalGold,
    };

    return [...waves, finalWave];
  }

  // ── Private builders ──────────────────────────────────────

  /**
   * Core wave builder. Generates `count` WaveDefinitions with the given
   * health and gold multipliers.
   *
   * Each wave picks 1-2 enemy types from `pool` and scales enemy count
   * by row depth and act index.
   */
  private buildWaves(
    rng: () => number,
    pool: EnemyType[],
    row: number,
    actIndex: number,
    count: number,
    _healthMultiplier: number,
    goldMultiplier: number,
  ): WaveDefinition[] {
    const waves: WaveDefinition[] = [];

    for (let i = 0; i < count; i++) {
      const entryTypeCount = MIN_ENTRY_TYPES + Math.floor(rng() * (MAX_ENTRY_TYPES - MIN_ENTRY_TYPES + 1));
      const chosenTypes = pickRandom(pool, entryTypeCount, rng);

      const entries: WaveEntry[] = chosenTypes.map(type => ({
        type,
        count: computeEnemyCount(row, actIndex, rng),
        spawnInterval: computeSpawnInterval(row, rng),
      }));

      const baseGold = WAVE_GOLD_BASE + row * WAVE_GOLD_PER_ROW;
      waves.push({
        entries,
        reward: Math.round(baseGold * goldMultiplier),
      });
    }

    return waves;
  }
}

// ── Module-level helpers ───────────────────────────────────────

/**
 * Returns the enemy pool appropriate for the given act and row depth.
 * Acts beyond index 1 default to the full act-2 pool.
 */
function getEnemyPool(row: number, actIndex: number): EnemyType[] {
  if (actIndex === 0) {
    if (row <= ACT1_EARLY_MAX_ROW) return ACT1_EARLY_POOL;
    if (row <= ACT1_MID_MAX_ROW) return ACT1_MID_POOL;
    return ACT1_LATE_POOL;
  }
  // Act 2+
  if (row >= ACT2_FLYING_MIN_ROW) return ACT2_FLYING_POOL;
  return ACT2_BASE_POOL;
}

/**
 * Computes the number of enemies for a single WaveEntry.
 * Scales with row depth and act index.
 */
function computeEnemyCount(row: number, actIndex: number, rng: () => number): number {
  let count = Math.floor(
    ENCOUNTER_CONFIG.enemyCountBasePerWave + row * ENCOUNTER_CONFIG.enemyCountGrowthPerRow,
  );
  if (actIndex > 0) {
    count = Math.floor(count * ENCOUNTER_CONFIG.enemyCountActMultiplier);
  }
  // Small random variance (+/- 1) to avoid identical waves
  count += Math.floor(rng() * 3) - 1;
  return Math.max(1, count);
}

/**
 * Computes spawn interval in seconds.
 * Decreases with row depth (faster spawns later), clamped to [MIN, MAX].
 */
function computeSpawnInterval(row: number, rng: () => number): number {
  const base = SPAWN_INTERVAL_MAX - row * SPAWN_INTERVAL_ROW_REDUCTION;
  // Small random jitter (+/- 0.05s)
  const jitter = (rng() - 0.5) * 0.1;
  return Math.min(SPAWN_INTERVAL_MAX, Math.max(SPAWN_INTERVAL_MIN, base + jitter));
}

/**
 * Selects up to `count` unique random elements from `pool`.
 * Safe when pool.length < count (returns full pool).
 */
function pickRandom<T>(pool: T[], count: number, rng: () => number): T[] {
  if (pool.length === 0) return [];
  const copy = [...pool];
  const picked: T[] = [];
  const limit = Math.min(count, copy.length);
  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(rng() * copy.length);
    picked.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return picked;
}

/**
 * Modifies one wave in the set to include a BOSS-type entry.
 * Targets the middle wave by default; falls back to the first wave.
 */
function injectBossWave(waves: WaveDefinition[], rng: () => number, goldMultiplier: number): WaveDefinition[] {
  if (waves.length === 0) return waves;

  const targetIdx = Math.floor(waves.length / 2);
  const bossGold = Math.round(waves[targetIdx].reward * goldMultiplier);
  const bossEntry: WaveEntry = {
    type: EnemyType.BOSS,
    count: 1,
    spawnInterval: computeSpawnInterval(0, rng), // generous interval for the boss
  };

  const updated = [...waves];
  updated[targetIdx] = {
    entries: [...waves[targetIdx].entries, bossEntry],
    reward: bossGold,
  };
  return updated;
}
