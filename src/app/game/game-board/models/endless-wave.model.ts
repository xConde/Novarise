import { EnemyType } from './enemy.model';
import { WaveEntry } from './wave.model';

// ---------------------------------------------------------------------------
// Enum & interfaces
// ---------------------------------------------------------------------------

export enum EndlessWaveTemplate {
  RUSH     = 'rush',
  SIEGE    = 'siege',
  SWARM    = 'swarm',
  AIR_RAID = 'air_raid',
  MIXED    = 'mixed',
  BOSS     = 'boss',
  BLITZ    = 'blitz',
}

export interface TemplateEnemyEntry {
  type: EnemyType;
  weight: number;
}

export interface EndlessWaveTemplateConfig {
  template: EndlessWaveTemplate;
  entries: TemplateEnemyEntry[];
  /** 1.0 = normal, 0.5 = twice as fast, 1.5 = slower. Applied to base spawn interval. */
  spawnIntervalMultiplier: number;
  /** Extra gold awarded on top of the base reward for clearing this template. */
  bonusReward: number;
  /** Short human-readable description shown in the HUD. */
  description: string;
}

export interface EndlessWaveResult {
  entries: WaveEntry[];
  reward: number;
  template: EndlessWaveTemplate;
  healthMultiplier: number;
  speedMultiplier: number;
  isMilestone: boolean;
}

// ---------------------------------------------------------------------------
// Scaling constants — all magic numbers named here
// ---------------------------------------------------------------------------

/** Health multiplier added per endless wave number (e.g. wave 1 = 1.2×, wave 5 = 2.0×). */
export const ENDLESS_HEALTH_SCALE_PER_WAVE = 0.2;

/** Speed multiplier added per endless wave number (before cap). */
export const ENDLESS_SPEED_SCALE_PER_WAVE = 0.03;

/** Hard cap on speed multiplier — prevents impossibly fast enemies in deep endless. */
export const ENDLESS_MAX_SPEED_MULTIPLIER = 1.8;

/** Enemy count increases by this amount per endless wave number (fractional, floored). */
export const ENDLESS_COUNT_SCALE_PER_WAVE = 0.8;

/** Minimum enemies per entry after weight distribution (keeps waves non-trivial). */
export const ENDLESS_MIN_ENEMIES_PER_ENTRY = 2;

/** Base enemy count before wave-number scaling. */
export const ENDLESS_BASE_ENEMY_COUNT = 8;

/** Base spawn interval in seconds (before template and scaling adjustments). */
export const ENDLESS_BASE_SPAWN_INTERVAL_S = 0.8;

/** Minimum spawn interval in seconds — prevents near-zero values. */
export const ENDLESS_MIN_SPAWN_INTERVAL_S = 0.25;

/** Base wave reward gold before milestone bonuses. */
export const ENDLESS_BASE_WAVE_REWARD = 200;

/** Gold added to the base reward per endless wave number. */
export const ENDLESS_REWARD_SCALE_PER_WAVE = 30;

/** Milestone every N endless waves — always uses BOSS template. */
export const ENDLESS_BOSS_INTERVAL = 5;

/** Gold multiplier for milestone boss rewards: bonus = MILESTONE_REWARD_PER_MILESTONE * milestoneNumber. */
export const ENDLESS_MILESTONE_REWARD_PER_BOSS = 100;

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

// Per-template bonus rewards (gold awarded on wave clear, in addition to base reward)
const RUSH_BONUS_REWARD     = 30;
const SIEGE_BONUS_REWARD    = 50;
const SWARM_BONUS_REWARD    = 35;
const AIR_RAID_BONUS_REWARD = 40;
const MIXED_BONUS_REWARD    = 25;
const BOSS_BONUS_REWARD     = 0;  // boss uses milestone-based reward instead
const BLITZ_BONUS_REWARD    = 45;

// Spawn rate multipliers (< 1.0 = faster spawning, > 1.0 = slower)
const RUSH_SPAWN_RATE     = 0.6;
const SIEGE_SPAWN_RATE    = 1.5;
const SWARM_SPAWN_RATE    = 0.7;
const AIR_RAID_SPAWN_RATE = 0.8;
const MIXED_SPAWN_RATE    = 1.0;
const BOSS_SPAWN_RATE     = 1.2;
const BLITZ_SPAWN_RATE    = 0.5;

/** Non-boss templates cycled in order for variety. BOSS is selected by the milestone rule. */
export const NON_BOSS_TEMPLATES: EndlessWaveTemplate[] = [
  EndlessWaveTemplate.RUSH,
  EndlessWaveTemplate.SIEGE,
  EndlessWaveTemplate.SWARM,
  EndlessWaveTemplate.AIR_RAID,
  EndlessWaveTemplate.MIXED,
  EndlessWaveTemplate.BLITZ,
];

export const ENDLESS_WAVE_TEMPLATES: Record<EndlessWaveTemplate, EndlessWaveTemplateConfig> = {
  [EndlessWaveTemplate.RUSH]: {
    template: EndlessWaveTemplate.RUSH,
    entries: [
      { type: EnemyType.FAST,  weight: 4 },  // 50.0% of spawns
      { type: EnemyType.SWIFT, weight: 3 },  // 37.5% of spawns
      { type: EnemyType.BASIC, weight: 1 },  // 12.5% of spawns
    ],
    spawnIntervalMultiplier: RUSH_SPAWN_RATE,
    bonusReward: RUSH_BONUS_REWARD,
    description: 'Rush — Fast enemies flood the field',
  },
  [EndlessWaveTemplate.SIEGE]: {
    template: EndlessWaveTemplate.SIEGE,
    entries: [
      { type: EnemyType.HEAVY,    weight: 3 },  // 50.0% of spawns
      { type: EnemyType.SHIELDED, weight: 2 },  // 33.3% of spawns
      { type: EnemyType.BASIC,    weight: 1 },  // 16.7% of spawns
    ],
    spawnIntervalMultiplier: SIEGE_SPAWN_RATE,
    bonusReward: SIEGE_BONUS_REWARD,
    description: 'Siege — Armored enemies march forward',
  },
  [EndlessWaveTemplate.SWARM]: {
    template: EndlessWaveTemplate.SWARM,
    entries: [
      { type: EnemyType.SWARM, weight: 5 },  // 62.5% of spawns
      { type: EnemyType.FAST,  weight: 2 },  // 25.0% of spawns
      { type: EnemyType.BASIC, weight: 1 },  // 12.5% of spawns
    ],
    spawnIntervalMultiplier: SWARM_SPAWN_RATE,
    bonusReward: SWARM_BONUS_REWARD,
    description: 'Swarm — Clusters that split on death',
  },
  [EndlessWaveTemplate.AIR_RAID]: {
    template: EndlessWaveTemplate.AIR_RAID,
    entries: [
      { type: EnemyType.FLYING, weight: 5 },  // 62.5% of spawns
      { type: EnemyType.SWIFT,  weight: 2 },  // 25.0% of spawns
      { type: EnemyType.FAST,   weight: 1 },  // 12.5% of spawns
    ],
    spawnIntervalMultiplier: AIR_RAID_SPAWN_RATE,
    bonusReward: AIR_RAID_BONUS_REWARD,
    description: 'Air Raid — Flying units immune to slow',
  },
  [EndlessWaveTemplate.MIXED]: {
    template: EndlessWaveTemplate.MIXED,
    entries: [
      { type: EnemyType.BASIC,    weight: 2 },  // 28.6% of spawns
      { type: EnemyType.FAST,     weight: 2 },  // 28.6% of spawns
      { type: EnemyType.HEAVY,    weight: 1 },  // 14.3% of spawns
      { type: EnemyType.SHIELDED, weight: 1 },  // 14.3% of spawns
      { type: EnemyType.FLYING,   weight: 1 },  // 14.3% of spawns
    ],
    spawnIntervalMultiplier: MIXED_SPAWN_RATE,
    bonusReward: MIXED_BONUS_REWARD,
    description: 'Mixed — Balanced assault from all fronts',
  },
  [EndlessWaveTemplate.BOSS]: {
    template: EndlessWaveTemplate.BOSS,
    entries: [
      { type: EnemyType.BOSS,     weight: 1 },  // 20.0% of spawns
      { type: EnemyType.SHIELDED, weight: 2 },  // 40.0% of spawns
      { type: EnemyType.HEAVY,    weight: 2 },  // 40.0% of spawns
    ],
    spawnIntervalMultiplier: BOSS_SPAWN_RATE,
    bonusReward: BOSS_BONUS_REWARD, // bonus is milestone-based instead
    description: 'Boss — Elite enemy with armored escorts',
  },
  [EndlessWaveTemplate.BLITZ]: {
    template: EndlessWaveTemplate.BLITZ,
    entries: [
      { type: EnemyType.BASIC,  weight: 3 },  // 33.3% of spawns
      { type: EnemyType.FAST,   weight: 3 },  // 33.3% of spawns
      { type: EnemyType.SWIFT,  weight: 2 },  // 22.2% of spawns
      { type: EnemyType.FLYING, weight: 1 },  // 11.1% of spawns
    ],
    spawnIntervalMultiplier: BLITZ_SPAWN_RATE,
    bonusReward: BLITZ_BONUS_REWARD,
    description: 'Blitz — Maximum speed, all types at once',
  },
};

// ---------------------------------------------------------------------------
// Wave generation
// ---------------------------------------------------------------------------

/**
 * Selects the template for an endless wave number (1-based relative to endless).
 *
 * - Every `ENDLESS_BOSS_INTERVAL`-th wave is always a BOSS milestone.
 * - All other waves cycle through NON_BOSS_TEMPLATES deterministically.
 */
export function selectEndlessTemplate(endlessWaveNumber: number): EndlessWaveTemplate {
  if (endlessWaveNumber % ENDLESS_BOSS_INTERVAL === 0) {
    return EndlessWaveTemplate.BOSS;
  }
  const nonBossIndex = (endlessWaveNumber - 1) % NON_BOSS_TEMPLATES.length;
  return NON_BOSS_TEMPLATES[nonBossIndex];
}

/**
 * Generates a wave composition for an endless wave number.
 *
 * @param endlessWaveNumber 1-based index relative to endless mode start
 *   (i.e. the first post-scripted wave = endless wave 1).
 *
 * Scaling:
 *   healthMultiplier = 1.0 + endlessWaveNumber * ENDLESS_HEALTH_SCALE_PER_WAVE
 *   speedMultiplier  = 1.0 + min(endlessWaveNumber * ENDLESS_SPEED_SCALE_PER_WAVE, ENDLESS_MAX_SPEED_MULTIPLIER - 1)
 *   totalEnemies     = ENDLESS_BASE_ENEMY_COUNT + floor(endlessWaveNumber * ENDLESS_COUNT_SCALE_PER_WAVE)
 *
 * Enemy counts are distributed across template entries proportionally to their weights.
 * Each entry gets at least ENDLESS_MIN_ENEMIES_PER_ENTRY enemies.
 *
 * Spawn interval per entry = template.spawnIntervalMultiplier * base / speedMultiplier,
 * clamped to ENDLESS_MIN_SPAWN_INTERVAL_S.
 */
export function generateEndlessWave(endlessWaveNumber: number): EndlessWaveResult {
  const template = selectEndlessTemplate(endlessWaveNumber);
  const templateConfig = ENDLESS_WAVE_TEMPLATES[template];
  const isMilestone = endlessWaveNumber % ENDLESS_BOSS_INTERVAL === 0;
  const milestoneNumber = endlessWaveNumber / ENDLESS_BOSS_INTERVAL; // integer only on milestone waves

  // Stat multipliers
  const healthMultiplier = 1.0 + endlessWaveNumber * ENDLESS_HEALTH_SCALE_PER_WAVE;
  const rawSpeedBonus = endlessWaveNumber * ENDLESS_SPEED_SCALE_PER_WAVE;
  const speedMultiplier = 1.0 + Math.min(rawSpeedBonus, ENDLESS_MAX_SPEED_MULTIPLIER - 1.0);

  // Total enemy count for this wave
  const totalEnemies =
    ENDLESS_BASE_ENEMY_COUNT + Math.floor(endlessWaveNumber * ENDLESS_COUNT_SCALE_PER_WAVE);

  // Distribute enemies by weight
  const totalWeight = templateConfig.entries.reduce((sum, e) => sum + e.weight, 0);
  const entries: WaveEntry[] = distributeEnemies(
    templateConfig.entries,
    totalWeight,
    totalEnemies,
    templateConfig.spawnIntervalMultiplier,
    speedMultiplier,
  );

  // Reward calculation
  const baseReward = ENDLESS_BASE_WAVE_REWARD + ENDLESS_REWARD_SCALE_PER_WAVE * (endlessWaveNumber - 1);
  const milestoneBonus = isMilestone ? ENDLESS_MILESTONE_REWARD_PER_BOSS * milestoneNumber : 0;
  const reward = baseReward + templateConfig.bonusReward + milestoneBonus;

  return {
    entries,
    reward,
    template,
    healthMultiplier,
    speedMultiplier,
    isMilestone,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Distributes `totalEnemies` across `entries` proportionally to weight.
 * Ensures each entry has at least ENDLESS_MIN_ENEMIES_PER_ENTRY enemies.
 * Spawn interval is scaled by speedMultiplier and clamped to min.
 */
function distributeEnemies(
  entries: TemplateEnemyEntry[],
  totalWeight: number,
  totalEnemies: number,
  spawnIntervalMult: number,
  speedMultiplier: number,
): WaveEntry[] {
  const results: WaveEntry[] = [];
  let remainingCount = totalEnemies;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;

    // Give last entry whatever is left to avoid rounding loss
    const rawCount = isLast
      ? remainingCount
      : Math.round((entry.weight / totalWeight) * totalEnemies);

    const count = Math.max(ENDLESS_MIN_ENEMIES_PER_ENTRY, rawCount);
    remainingCount -= count;

    const rawInterval = (ENDLESS_BASE_SPAWN_INTERVAL_S * spawnIntervalMult) / speedMultiplier;
    const spawnInterval = Math.max(ENDLESS_MIN_SPAWN_INTERVAL_S, rawInterval);

    results.push({ type: entry.type, count, spawnInterval });
  }

  return results;
}
