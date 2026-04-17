/**
 * Run state model for Ascent Mode (roguelite shell).
 *
 * A Run is one playthrough: multi-encounter, persistent lives/relics/gold,
 * 2 acts of ~12 nodes each, seeded RNG for deterministic replay.
 */

import { ChallengeDefinition } from '../data/challenges';

export enum RunStatus {
  IN_PROGRESS = 'in_progress',
  VICTORY = 'victory',
  DEFEAT = 'defeat',
  ABANDONED = 'abandoned',
}

export interface RunConfig {
  readonly startingLives: number;
  readonly startingGold: number;
  readonly actsCount: number;
  readonly nodesPerAct: number;
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  startingLives: 20,
  startingGold: 150,
  actsCount: 2,
  nodesPerAct: 12,
};

export interface EncounterResult {
  readonly nodeId: string;
  readonly nodeType: string;
  readonly victory: boolean;
  readonly livesLost: number;
  readonly goldEarned: number;
  readonly enemiesKilled: number;
  readonly wavesCompleted: number;
  /**
   * Challenges the player completed on this encounter (evaluated by
   * `GameEndService.recordEnd` via `evaluateChallenges`). Empty on defeat,
   * non-campaign maps, or when no mastery conditions were met. Consumed by
   * `RunService.generateRewards` to compute a per-encounter gold bonus.
   */
  readonly completedChallenges: readonly ChallengeDefinition[];
}

import { CardId } from './card.model';

export interface RunState {
  readonly id: string;
  readonly seed: number;
  readonly ascensionLevel: number;
  readonly config: RunConfig;
  readonly actIndex: number;
  readonly currentNodeId: string | null;
  readonly completedNodeIds: string[];
  readonly lives: number;
  readonly maxLives: number;
  readonly gold: number;
  readonly relicIds: string[];
  /** Card IDs in the player's deck — persists across encounters within a run. */
  readonly deckCardIds: CardId[];
  readonly encounterResults: EncounterResult[];
  readonly status: RunStatus;
  readonly startedAt: number;
  readonly score: number;
}

export function createInitialRunState(
  seed: number,
  config: RunConfig,
  ascensionLevel: number,
): RunState {
  return {
    id: generateRunId(),
    seed,
    ascensionLevel,
    config,
    actIndex: 0,
    currentNodeId: null,
    completedNodeIds: [],
    lives: config.startingLives,
    maxLives: config.startingLives,
    gold: config.startingGold,
    relicIds: [],
    deckCardIds: [],
    encounterResults: [],
    status: RunStatus.IN_PROGRESS,
    startedAt: Date.now(),
    score: 0,
  };
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
