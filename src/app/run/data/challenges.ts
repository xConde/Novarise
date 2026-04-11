import { assertNever } from '../../game/game-board/utils/assert-never';

export enum ChallengeType {
  NO_SLOW = 'no_slow',           // Win without using Slow towers
  SPEED_RUN = 'speed_run',       // Win in under N seconds
  FRUGAL = 'frugal',             // Win spending under N total gold
  UNTOUCHABLE = 'untouchable',   // Win without losing any lives
  TOWER_LIMIT = 'tower_limit',   // Win with max N towers placed at peak
  SINGLE_TYPE = 'single_type',   // Win using only one tower type
}

export interface ChallengeDefinition {
  id: string;                    // e.g., 'c01_untouchable'
  type: ChallengeType;
  name: string;
  description: string;
  scoreBonus: number;            // flat score bonus for completing
  // Type-specific params
  timeLimit?: number;            // seconds for SPEED_RUN
  goldLimit?: number;            // max gold spent for FRUGAL
  towerLimit?: number;           // max peak tower count for TOWER_LIMIT
}

/**
 * Input state for evaluating per-level challenges.
 *
 * Pre-pivot relic — `ChallengeEvaluatorService` was deleted with the campaign
 * runtime in M2 S6-S9. Type kept for `ChallengeDisplayService` (HUD badges) and
 * setup-panel binding contract per project_pivot_handoff.md §10.
 */
export interface GameEndState {
  livesLost: number;
  elapsedTime: number;           // total seconds in COMBAT phase
  totalGoldSpent: number;
  maxTowersPlaced: number;       // peak tower count during the game
  towerTypesUsed: Set<string>;   // TowerType values placed at any point
}

// ── Challenge assignments per campaign level (2-3 per level) ──────────────────

const NO_SLOW_BONUS = 200;
const UNTOUCHABLE_BONUS = 200;
const TOWER_LIMIT_BONUS = 300;
const SPEED_RUN_BONUS = 250;
const FRUGAL_BONUS = 250;
const SINGLE_TYPE_BONUS = 350;

export const CAMPAIGN_CHALLENGES: Record<string, ChallengeDefinition[]> = {
  // ── INTRO (Maps 1-4) — simpler challenges ──────────────────────────────────
  'campaign_01': [
    {
      id: 'c01_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
    {
      id: 'c01_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 4 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 4,
    },
  ],
  'campaign_02': [
    {
      id: 'c02_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
    {
      id: 'c02_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 120 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 120,
    },
  ],
  'campaign_03': [
    {
      id: 'c03_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
    {
      id: 'c03_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 600 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 600,
    },
  ],
  'campaign_04': [
    {
      id: 'c04_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
    {
      id: 'c04_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 5 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 5,
    },
    {
      id: 'c04_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
  ],

  // ── EARLY (Maps 5-8) — medium challenges ───────────────────────────────────
  'campaign_05': [
    {
      id: 'c05_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 150 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 150,
    },
    {
      id: 'c05_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
    {
      id: 'c05_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
  ],
  'campaign_06': [
    {
      id: 'c06_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 800 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 800,
    },
    {
      id: 'c06_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 6 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 6,
    },
  ],
  'campaign_07': [
    {
      id: 'c07_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: `Win using only one tower type`,
      scoreBonus: SINGLE_TYPE_BONUS,
    },
    {
      id: 'c07_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 160 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 160,
    },
  ],
  'campaign_08': [
    {
      id: 'c08_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
    {
      id: 'c08_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 900 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 900,
    },
    {
      id: 'c08_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
  ],

  // ── MID (Maps 9-12) — harder challenges ────────────────────────────────────
  'campaign_09': [
    {
      id: 'c09_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 200 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 200,
    },
    {
      id: 'c09_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 7 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 7,
    },
    {
      id: 'c09_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
  ],
  'campaign_10': [
    {
      id: 'c10_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: 'Win using only one tower type',
      scoreBonus: SINGLE_TYPE_BONUS,
    },
    {
      id: 'c10_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 1000 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 1000,
    },
  ],
  'campaign_11': [
    {
      id: 'c11_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
    {
      id: 'c11_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 180 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 180,
    },
    {
      id: 'c11_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 8 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 8,
    },
  ],
  'campaign_12': [
    {
      id: 'c12_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
    {
      id: 'c12_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 1100 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 1100,
    },
  ],

  // ── LATE (Maps 13-14) — brutal challenges ──────────────────────────────────
  'campaign_13': [
    {
      id: 'c13_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 6 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 6,
    },
    {
      id: 'c13_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 200 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 200,
    },
    {
      id: 'c13_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: 'Win using only one tower type',
      scoreBonus: SINGLE_TYPE_BONUS,
    },
  ],
  'campaign_14': [
    {
      id: 'c14_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
    {
      id: 'c14_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 1200 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 1200,
    },
    {
      id: 'c14_no_slow',
      type: ChallengeType.NO_SLOW,
      name: 'No Slow',
      description: 'Win without using Slow towers',
      scoreBonus: NO_SLOW_BONUS,
    },
  ],

  // ── ENDGAME (Maps 15-16) — brutal challenges ───────────────────────────────
  'campaign_15': [
    {
      id: 'c15_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 240 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 240,
    },
    {
      id: 'c15_tower_limit',
      type: ChallengeType.TOWER_LIMIT,
      name: 'Minimalist',
      description: 'Win with 8 or fewer towers at once',
      scoreBonus: TOWER_LIMIT_BONUS,
      towerLimit: 8,
    },
    {
      id: 'c15_single_type',
      type: ChallengeType.SINGLE_TYPE,
      name: 'Specialist',
      description: 'Win using only one tower type',
      scoreBonus: SINGLE_TYPE_BONUS,
    },
  ],
  'campaign_16': [
    {
      id: 'c16_untouchable',
      type: ChallengeType.UNTOUCHABLE,
      name: 'Untouchable',
      description: 'Win without losing any lives',
      scoreBonus: UNTOUCHABLE_BONUS,
    },
    {
      id: 'c16_speed_run',
      type: ChallengeType.SPEED_RUN,
      name: 'Speed Run',
      description: 'Win in under 270 seconds',
      scoreBonus: SPEED_RUN_BONUS,
      timeLimit: 270,
    },
    {
      id: 'c16_frugal',
      type: ChallengeType.FRUGAL,
      name: 'Frugal',
      description: 'Win spending 1500 gold or less',
      scoreBonus: FRUGAL_BONUS,
      goldLimit: 1500,
    },
  ],
};

/** Returns challenges for a campaign level, or empty array for non-campaign maps. */
export function getChallengesForLevel(levelId: string): ChallengeDefinition[] {
  return CAMPAIGN_CHALLENGES[levelId] ?? [];
}

/** Validates that a ChallengeDefinition has the required type-specific param. */
export function challengeHasRequiredParam(challenge: ChallengeDefinition): boolean {
  switch (challenge.type) {
    case ChallengeType.SPEED_RUN:
      return challenge.timeLimit !== undefined;
    case ChallengeType.FRUGAL:
      return challenge.goldLimit !== undefined;
    case ChallengeType.TOWER_LIMIT:
      return challenge.towerLimit !== undefined;
    case ChallengeType.NO_SLOW:
    case ChallengeType.UNTOUCHABLE:
    case ChallengeType.SINGLE_TYPE:
      return true;
    default:
      assertNever(challenge.type);
  }
}
