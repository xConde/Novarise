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
  actsCount: 3,
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
  /**
   * Combat ending gold balance; on victory it becomes the run's gold in the
   * unified single-pool economy. Optional for backward-compat with pre-unify
   * saves.
   */
  readonly finalGold?: number;
}

import { CardId } from './card.model';
import { SerializedItemInventory } from './item.model';
import { SerializedRunStateFlags } from '../services/run-state-flag.service';

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
  /**
   * Wall-clock timestamp captured the instant the run terminates
   * (DEFEAT / VICTORY / ABANDONED). Absent while the run is in
   * progress; the summary screen uses (endedAt ?? Date.now()) to
   * derive duration so paused / saved-and-resumed runs do not keep
   * accumulating time after the run is over.
   */
  readonly endedAt?: number;
  readonly score: number;
  /** Item inventory persisted at run level. Absent in saves made before H5. */
  readonly itemInventory?: SerializedItemInventory;
  /** Run-state flags persisted at run level. Absent in saves made before H5. */
  readonly runStateFlags?: SerializedRunStateFlags;
  /**
   * Consecutive non-rare card-reward picks since the last rare. When this
   * reaches `CARD_PITY_THRESHOLD`, the next card pick is forced to RARE
   * (and the counter resets). Genre-standard pity timer — players who
   * hit a long unlucky streak get a guaranteed rare without bumping the
   * baseline 60/30/10 weights for everyone. Absent in pre-pity saves —
   * default to 0 on restore.
   */
  readonly cardPityCounter?: number;
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
    cardPityCounter: 0,
  };
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
