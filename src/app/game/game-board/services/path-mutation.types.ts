import { BlockType } from '../models/game-board-tile';

/**
 * The type of a path mutation operation performed on the board.
 *
 * - `build`      — convert a WALL tile to a BASE (path) tile
 * - `block`      — convert a BASE tile to a WALL tile
 * - `destroy`    — convert a BASE tile to a WALL tile (enemies on it take damage)
 * - `bridgehead` — convert a WALL tile to a tower-only (non-traversable BASE) tile
 */
export type MutationOp = 'build' | 'block' | 'destroy' | 'bridgehead';

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
 * Reason a mutation was rejected.
 */
export type MutationRejectionReason =
  | 'out-of-bounds'
  | 'spawner-or-exit'
  | 'tower-occupied'
  | 'would-block-all-paths'
  | 'already-mutated-this-turn'
  | 'no-op';

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
