/**
 * Ascent Mode configuration constants.
 *
 * Balance values (relic stats, wave scaling) live in models/.
 * This file holds structural/UI config — node map geometry,
 * encounter parameters, reward tables, shop pricing.
 */

// ── Node Map Generation ───────────────────────────────────────

export const NODE_MAP_CONFIG = {
  /** Number of rows in each act (excludes boss row). */
  rowsPerAct: 11,

  /** Min/max nodes per row (lateral branching). */
  minNodesPerRow: 2,
  maxNodesPerRow: 4,

  /** Max forward connections per node. */
  maxConnectionsPerNode: 3,

  /** Minimum connections per node (ensures no dead ends). */
  minConnectionsPerNode: 1,

  /** Row indices that are guaranteed to contain specific node types. */
  guaranteedShop: 5,
  guaranteedRest: 8,

  /** Row indices where elite nodes can appear (not too early, not too late). */
  eliteMinRow: 3,
  eliteMaxRow: 9,

  /** Probability of each node type when randomly assigned. */
  nodeTypeWeights: {
    combat: 0.45,
    elite: 0.12,
    rest: 0.08,
    shop: 0.08,
    event: 0.15,
    unknown: 0.12,
  },
} as const;

// ── Encounter Generation ──────────────────────────────────────

export const ENCOUNTER_CONFIG = {
  /** Base wave count per encounter type. */
  wavesPerCombat: 4,
  wavesPerElite: 5,
  wavesPerBoss: 6,

  /** Enemy count scaling per act depth (multiplied by row index). */
  enemyCountBasePerWave: 5,
  enemyCountGrowthPerRow: 0.5,
  enemyCountActMultiplier: 1.4,

  /** Elite encounter multipliers. */
  eliteHealthMultiplier: 1.5,
  eliteGoldMultiplier: 1.5,

  /** Boss encounter multipliers. */
  bossHealthMultiplier: 2.5,
  bossGoldMultiplier: 2.0,
} as const;

// ── Campaign Map Tier Assignments ─────────────────────────────

/** Maps campaign map IDs to act tiers for encounter backdrop selection. */
export const CAMPAIGN_MAP_TIERS: Record<string, string[]> = {
  act1_early: ['campaign_01', 'campaign_02', 'campaign_03', 'campaign_04'],
  act1_mid: ['campaign_05', 'campaign_06', 'campaign_07', 'campaign_08'],
  act1_late: ['campaign_09', 'campaign_10', 'campaign_11', 'campaign_12'],
  act2_early: ['campaign_05', 'campaign_06', 'campaign_07', 'campaign_08'],
  act2_mid: ['campaign_09', 'campaign_10', 'campaign_11', 'campaign_12'],
  act2_late: ['campaign_13', 'campaign_14', 'campaign_15', 'campaign_16'],
};

/**
 * Given an act index and row within the act, return the tier key
 * for selecting a campaign map backdrop.
 */
export function getMapTierForNode(actIndex: number, row: number, totalRows: number): string {
  const progress = row / totalRows;
  const prefix = `act${actIndex + 1}`;
  if (progress < 0.33) return `${prefix}_early`;
  if (progress < 0.66) return `${prefix}_mid`;
  return `${prefix}_late`;
}

// ── Rewards ───────────────────────────────────────────────────

export const REWARD_CONFIG = {
  /** Base gold pickup after combat encounter. */
  combatGoldBase: 25,
  combatGoldPerRow: 3,

  /** Gold multiplier applied to base reward for elite encounters. */
  eliteGoldRewardMultiplier: 1.5,

  /** Gold multiplier applied to base reward for boss encounters. */
  bossGoldRewardMultiplier: 2.0,

  /** Number of relic choices offered after combat. */
  relicChoicesCombat: 3,
  relicChoicesElite: 3,
  relicChoicesBoss: 3,

  /** Elite always drops a relic. Boss always drops a relic. */
  eliteGuaranteedRelic: true,
  bossGuaranteedRelic: true,
} as const;

// ── Shop ──────────────────────────────────────────────────────

export const SHOP_CONFIG = {
  /** Number of relics available in shop. */
  relicsInShop: 3,

  /** Number of cards available in shop. */
  cardsInShop: 3,

  /** Base price by rarity. */
  priceByRarity: {
    common: 50,
    uncommon: 100,
    rare: 200,
  },

  /** Cost to heal 1 life. */
  healCostPerLife: 15,

  /** Max lives healable per shop visit. */
  maxHealPerVisit: 5,
} as const;

// ── Rest ──────────────────────────────────────────────────────

export const REST_CONFIG = {
  /** Percentage of max lives restored on rest. */
  healPercentage: 0.3,

  /** Minimum lives restored (floor). */
  minHeal: 2,
} as const;

// ── Run Progression ───────────────────────────────────────────

export const RUN_CONFIG = {
  /**
   * Prime multiplier used when re-seeding the RNG on run resume.
   * Advances the seed by a prime amount per completed encounter
   * to avoid repeating the same sequence.
   */
  resumeSeedPrime: 7919,

  /**
   * Prime offset applied per act when generating subsequent act maps.
   * Ensures each act gets a distinct seed even with the same run seed.
   */
  actSeedPrime: 99991,

  /** Score points awarded per enemy killed during an encounter. */
  scorePerKill: 10,

  /** Minimum starting gold after ascension reductions. */
  minStartingGold: 50,

  /** Minimum starting lives after ascension reductions. */
  minStartingLives: 5,
} as const;

// ── Relic Effect Constants ────────────────────────────────────

/**
 * Numeric effect values for relics that use non-obvious constants.
 * Obvious single-purpose values (e.g. +1 bounce) stay inline in RelicService.
 */
export const RELIC_EFFECT_CONFIG = {
  /** IRON_HEART: max lives granted when the relic is acquired. */
  ironHeartMaxLivesBonus: 3,

  /** LUCKY_COIN: probability of triggering the bonus gold roll (20%). */
  luckyCoinTriggerChance: 0.2,

  /** LUCKY_COIN: gold multiplier when the coin triggers (50% bonus). */
  luckyCoinGoldMultiplier: 1.5,

  /** BASIC_TRAINING: damage multiplier for basic tower (+35%). */
  basicTrainingDamageMultiplier: 1.35,

  /** SNIPER_SCOPE: range multiplier for sniper tower (+25%). */
  sniperScopeRangeMultiplier: 1.25,

  /** BOUNTY_HUNTER: gold multiplier for elite kills (double). */
  bountyHunterEliteGoldMultiplier: 2,
} as const;

// ── Seeded RNG ────────────────────────────────────────────────

/**
 * Stateful seeded PRNG (mulberry32) with inspectable/restorable state.
 * `next()` produces [0, 1) floats deterministically.
 * `getState()`/`setState()` enable checkpoint save/restore.
 */
export interface SeededRng {
  /** Produce the next pseudo-random float in [0, 1). */
  next(): number;
  /** Return the current internal state (a single 32-bit integer). */
  getState(): number;
  /** Restore a previously captured state. Subsequent next() calls replay from this point. */
  setState(s: number): void;
}

export function createSeededRng(seed: number): SeededRng {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState(): number {
      return s;
    },
    setState(newState: number): void {
      s = newState | 0;
    },
  };
}
