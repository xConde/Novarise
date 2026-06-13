import { BlockType } from '../models/game-board-tile';
import { MutationOp, MutationRejectionReason } from '../models/path-mutation.model';

// Pure type declarations live in the models layer; re-exported here for
// backward compatibility with all existing service-layer importers.
export { MutationOp, MutationRejectionReason } from '../models/path-mutation.model';

/**
 * A single active path mutation entry in the journal.
 * All fields are JSON-safe for checkpoint serialization.
 */
export interface PathMutation {
  /** Monotonically-increasing stable ID within an encounter. */
  readonly id: string;
  readonly op: MutationOp;
  readonly row: number;
  readonly col: number;
  /** Turn on which this mutation was applied. */
  readonly appliedOnTurn: number;
  /** Turn on which this mutation expires; null means permanent. */
  readonly expiresOnTurn: number | null;
  /** The tile type that existed before this mutation (for revert). */
  readonly priorType: BlockType;
  readonly source: 'card' | 'relic' | 'boss';
  readonly sourceId: string;
}

/**
 * Return value of PathMutationService.build / block / destroy / bridgehead.
 */
export interface MutationResult {
  readonly ok: boolean;
  readonly reason?: MutationRejectionReason;
  readonly mutation?: PathMutation;
}

/**
 * Serializable snapshot of all active path mutations and the ID counter.
 * Stored on the EncounterCheckpoint as `pathMutations` (added in v8).
 */
export interface SerializablePathMutationState {
  readonly mutations: readonly PathMutation[];
  readonly nextId: number;
}
