import { Injectable } from '@angular/core';
import { WaveDefinition, WaveEntry } from '../../game/game-board/models/wave.model';
import { EnemyType } from '../../game/game-board/models/enemy.model';
import { ENCOUNTER_CONFIG, SeededRng, createSeededRng } from '../constants/run.constants';
import { BossPreset, ACT1_BOSS_PRESETS, ACT2_BOSS_PRESETS, ACT3_BOSS_PRESETS } from '../constants/boss-presets';

// ── Enemy pool constants ───────────────────────────────────────

/** Enemy types available at each depth tier in act 1. */
const ACT1_EARLY_POOL: EnemyType[] = [EnemyType.BASIC, EnemyType.FAST];
const ACT1_MID_POOL: EnemyType[] = [EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT];
/**
 * Act 1 late pool — rows 8+. Introduces FLYING at low exposure so players
 * encounter air units before the Sky Marshal boss.
 */
const ACT1_LATE_POOL: EnemyType[] = [
  EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT, EnemyType.SHIELDED, EnemyType.FLYING,
];
const ACT2_BASE_POOL: EnemyType[] = [
  EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT,
  EnemyType.SHIELDED, EnemyType.SWARM,
];
/** Act 2 mid pool — FLYING joins once the player has seen them in act 1. */
const ACT2_FLYING_POOL: EnemyType[] = [...ACT2_BASE_POOL, EnemyType.FLYING, EnemyType.GLIDER];
/**
 * Act 2 late pool — MINER included at low weight (1 in 9 types) so the
 * board-mutation threat appears occasionally without dominating waves.
 */
const ACT2_LATE_POOL: EnemyType[] = [...ACT2_FLYING_POOL, EnemyType.MINER];

/**
 * Act 3 base pool — full act-2 roster plus heavier archetype threats.
 * TITAN and WYRM_ASCENDANT are boss-tier counters from Highground archetype
 * and appear here only in the heavy/late tier; VEINSEEKER is a Cartographer
 * boss counter and is intentionally excluded from random pools (too disruptive
 * in procedural contexts — appears in boss presets instead).
 */
const ACT3_BASE_POOL: EnemyType[] = [
  EnemyType.BASIC, EnemyType.FAST, EnemyType.HEAVY, EnemyType.SWIFT,
  EnemyType.SHIELDED, EnemyType.SWARM, EnemyType.FLYING, EnemyType.GLIDER,
];
const ACT3_HEAVY_POOL: EnemyType[] = [...ACT3_BASE_POOL, EnemyType.TITAN];

/** Row in act 3 at which the heavy pool (includes TITAN) appears. */
const ACT3_HEAVY_MIN_ROW = 5;

/** Row thresholds for act 1 enemy pool tiers. */
const ACT1_EARLY_MAX_ROW = 3;
/** Rows above this threshold (>= 8) use ACT1_LATE_POOL which includes FLYING. */
const ACT1_MID_MAX_ROW = 7;

/** Minimum row in act 2 at which FLYING and GLIDER enemies appear. */
const ACT2_FLYING_MIN_ROW = 3;
/** Minimum row in act 2 at which MINER appears (late pool, low weight). */
const ACT2_MINER_MIN_ROW = 5;

/**
 * Row offset added per act index when computing enemy count so that act openers
 * connect smoothly to the previous act's density instead of resetting to the
 * act-1-row-0 baseline. Offset 2 means act-2 starts at effectiveRow=2 rather
 * than 0, preventing a hard density drop at the act boundary. The offset does
 * NOT guarantee numeric equality with any specific act-1 row — the 1.4x act
 * multiplier makes act-2 row-0 (effectiveRow=2) denser than act-1 row 2.
 */
const ACT_ROW_OFFSET = 2;

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
    return this.buildWaves(rng, pool, row, actIndex, ENCOUNTER_CONFIG.wavesPerCombat, 1);
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
      ENCOUNTER_CONFIG.eliteGoldMultiplier,
    );

    // Guarantee one wave has a BOSS-type entry
    return injectBossWave(waves, rng, ENCOUNTER_CONFIG.eliteGoldMultiplier);
  }

  /**
   * Generate waves for the act boss node using themed preset compositions.
   *
   * The preset is chosen deterministically from ACT1_BOSS_PRESETS or
   * ACT2_BOSS_PRESETS based on actIndex and seed. Act 1 presets have
   * 6 waves; Act 2 presets have 7 waves.
   */
  generateBossWaves(actIndex: number, seed: number): WaveDefinition[] {
    return this.getBossPreset(actIndex, seed).waves;
  }

  /**
   * Return the BossPreset that will be used for the given act and seed.
   * Used by RunComponent to display the boss name before entering the node.
   */
  getBossPreset(actIndex: number, seed: number): BossPreset {
    const rng = createSeededRng(seed);
    const presets = actIndex === 0 ? ACT1_BOSS_PRESETS : actIndex === 1 ? ACT2_BOSS_PRESETS : ACT3_BOSS_PRESETS;
    return presets[Math.floor(rng.next() * presets.length)];
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
    rng: SeededRng,
    pool: EnemyType[],
    row: number,
    actIndex: number,
    count: number,
    goldMultiplier: number,
  ): WaveDefinition[] {
    const waves: WaveDefinition[] = [];

    for (let i = 0; i < count; i++) {
      const entryTypeCount = MIN_ENTRY_TYPES + Math.floor(rng.next() * (MAX_ENTRY_TYPES - MIN_ENTRY_TYPES + 1));
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
 * Acts beyond index 1 default to the act-3 pools.
 */
function getEnemyPool(row: number, actIndex: number): EnemyType[] {
  if (actIndex === 0) {
    if (row <= ACT1_EARLY_MAX_ROW) return ACT1_EARLY_POOL;
    if (row <= ACT1_MID_MAX_ROW) return ACT1_MID_POOL;
    // Late act 1 (row > ACT1_MID_MAX_ROW, i.e. >= ACT1_FLYING_MIN_ROW): FLYING
    // joins so players see air units before the Sky Marshal boss.
    return ACT1_LATE_POOL;
  }
  if (actIndex === 1) {
    // Act 2 late: MINER joins at low weight alongside FLYING/GLIDER.
    if (row >= ACT2_MINER_MIN_ROW) return ACT2_LATE_POOL;
    // Act 2 mid: FLYING and GLIDER join mid-act.
    if (row >= ACT2_FLYING_MIN_ROW) return ACT2_FLYING_POOL;
    return ACT2_BASE_POOL;
  }
  // Act 3: full roster; heavier elite type (TITAN) appears past mid-act.
  if (row >= ACT3_HEAVY_MIN_ROW) return ACT3_HEAVY_POOL;
  return ACT3_BASE_POOL;
}

/**
 * Computes the number of enemies for a single WaveEntry.
 * Scales with row depth and act index.
 *
 * effectiveRow adds ACT_ROW_OFFSET per act so density at the start of a
 * new act matches partway through the previous act, avoiding the ~30%
 * count drop at act-boundary row 0.
 */
function computeEnemyCount(row: number, actIndex: number, rng: SeededRng): number {
  const effectiveRow = row + actIndex * ACT_ROW_OFFSET;
  let count = Math.floor(
    ENCOUNTER_CONFIG.enemyCountBasePerWave + effectiveRow * ENCOUNTER_CONFIG.enemyCountGrowthPerRow,
  );
  if (actIndex > 0) {
    count = Math.floor(count * ENCOUNTER_CONFIG.enemyCountActMultiplier);
  }
  // Act 3 applies an additional multiplier on top of the act-2 multiplier.
  if (actIndex >= 2) {
    count = Math.floor(count * ENCOUNTER_CONFIG.enemyCountAct3Multiplier);
  }
  // Small random variance (+/- 1) to avoid identical waves
  count += Math.floor(rng.next() * 3) - 1;
  return Math.max(1, count);
}

/**
 * Computes spawn interval in seconds.
 * Decreases with row depth (faster spawns later), clamped to [MIN, MAX].
 */
function computeSpawnInterval(row: number, rng: SeededRng): number {
  const base = SPAWN_INTERVAL_MAX - row * SPAWN_INTERVAL_ROW_REDUCTION;
  // Small random jitter (+/- 0.05s)
  const jitter = (rng.next() - 0.5) * 0.1;
  return Math.min(SPAWN_INTERVAL_MAX, Math.max(SPAWN_INTERVAL_MIN, base + jitter));
}

/**
 * Selects up to `count` unique random elements from `pool`.
 * Safe when pool.length < count (returns full pool).
 */
function pickRandom<T>(pool: T[], count: number, rng: SeededRng): T[] {
  if (pool.length === 0) return [];
  const copy = [...pool];
  const picked: T[] = [];
  const limit = Math.min(count, copy.length);
  for (let i = 0; i < limit; i++) {
    const idx = Math.floor(rng.next() * copy.length);
    picked.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return picked;
}

/**
 * Modifies the final wave in the set to include a BOSS-type entry.
 * The target wave's reward is already scaled by eliteGoldMultiplier — no
 * second multiplication is applied.
 */
function injectBossWave(waves: WaveDefinition[], rng: SeededRng, _goldMultiplier: number): WaveDefinition[] {
  if (waves.length === 0) return waves;

  const targetIdx = waves.length - 1;
  const bossGold = waves[targetIdx].reward;
  const bossEntry: WaveEntry = {
    type: EnemyType.BOSS,
    count: 1,
    spawnInterval: computeSpawnInterval(0, rng), // generous interval for the boss
  };

  const updated = [...waves];
  updated[targetIdx] = {
    entries: [...(waves[targetIdx].entries ?? []), bossEntry],
    reward: bossGold,
  };
  return updated;
}
