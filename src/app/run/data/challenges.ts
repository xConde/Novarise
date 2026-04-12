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
 * Input state for evaluating per-encounter challenges.
 *
 * Used by `evaluateChallenges()` below and `ChallengeDisplayService` for live HUD
 * badge computation. In the turn-based run mode, `elapsedTime` is used only by
 * SPEED_RUN challenges which are excluded from evaluation (see `evaluateChallenges`).
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

/**
 * Evaluate which challenges the player completed for a given campaign map.
 *
 * Pure function — no side effects, no service dependencies. Called from
 * `GameEndService.recordEnd` on encounter victory. Returns the subset of
 * `getChallengesForLevel(mapId)` that the player's end state satisfies.
 *
 * SPEED_RUN challenges are excluded from turn-based run-mode evaluation —
 * `elapsedTime` doesn't have consistent meaning when players end turns
 * manually. Future work may re-add them as a `TURN_LIMIT` type with
 * rebalanced targets.
 *
 * @param mapId Campaign map ID (e.g., 'campaign_01').
 * @param state End-state snapshot computed at encounter-end.
 * @returns ChallengeDefinitions that evaluated as passing. Empty array if the
 *          map has no challenges OR if no challenges were satisfied.
 */
export function evaluateChallenges(
  mapId: string,
  state: GameEndState,
): ChallengeDefinition[] {
  const challenges = getChallengesForLevel(mapId);
  if (challenges.length === 0) return [];

  const completed: ChallengeDefinition[] = [];
  for (const challenge of challenges) {
    if (isChallengeSatisfied(challenge, state)) {
      completed.push(challenge);
    }
  }
  return completed;
}

/**
 * Check whether a single challenge is satisfied by the given end state.
 * Exported for unit testing; production callers should use `evaluateChallenges`.
 *
 * SPEED_RUN always returns false in the current implementation (excluded).
 */
export function isChallengeSatisfied(
  challenge: ChallengeDefinition,
  state: GameEndState,
): boolean {
  switch (challenge.type) {
    case ChallengeType.UNTOUCHABLE:
      return state.livesLost === 0;

    case ChallengeType.TOWER_LIMIT:
      // `towerLimit` is required per challengeHasRequiredParam; default to 0
      // for type-safety — a TOWER_LIMIT challenge with no limit is data error.
      return state.maxTowersPlaced <= (challenge.towerLimit ?? 0);

    case ChallengeType.FRUGAL:
      return state.totalGoldSpent <= (challenge.goldLimit ?? 0);

    case ChallengeType.NO_SLOW:
      // Don't import TowerType at module level to avoid a cross-layer cycle;
      // compare against the string literal which matches TowerType.SLOW's value.
      // (TowerType is a string-backed enum; TowerType.SLOW = 'slow'.)
      return !state.towerTypesUsed.has('slow');

    case ChallengeType.SINGLE_TYPE:
      // Strict: exactly one tower type used. 0-tower victories (theoretically
      // possible via pure spell damage) do NOT qualify — the challenge rewards
      // specialist mastery, not absence of towers. ChallengeDisplayService uses
      // the same strict semantics so HUD badges and end-of-encounter evaluation
      // agree.
      return state.towerTypesUsed.size === 1;

    case ChallengeType.SPEED_RUN:
      // Turn-based run mode excludes SPEED_RUN evaluation. `elapsedTime` has no
      // consistent meaning when players control turn pacing. Future work: rebalance
      // as a TURN_LIMIT type with explicit turn budgets per level.
      return false;

    default:
      assertNever(challenge.type);
  }
}

/**
 * Divisor used to translate a challenge's pre-pivot `scoreBonus` (200-350 pts)
 * into a run-mode gold reward. Keeps the translation in one place so rebalancing
 * is a single-line change. At /5, a 200-pt challenge grants 40 gold, 250 → 50,
 * 350 → 70. Rounded to integer gold.
 */
export const CHALLENGE_SCORE_TO_GOLD_RATIO = 5;

/**
 * Sum the gold reward from a list of completed challenges. Each challenge grants
 * `Math.round(scoreBonus / CHALLENGE_SCORE_TO_GOLD_RATIO)` gold; the sum is
 * added to the encounter's base reward in `RunService.generateRewards`.
 *
 * Pure function; lives here (next to `evaluateChallenges`) rather than on
 * RunService so the challenge data layer owns all challenge-related math.
 */
export function computeChallengeGoldBonus(
  challenges: readonly ChallengeDefinition[],
): number {
  return challenges.reduce(
    (sum, c) => sum + Math.round(c.scoreBonus / CHALLENGE_SCORE_TO_GOLD_RATIO),
    0,
  );
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
