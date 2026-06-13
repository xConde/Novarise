/**
 * Pure type declarations for the path-mutation subsystem.
 *
 * Service implementation types (PathMutation, MutationResult,
 * SerializablePathMutationState) remain in path-mutation.types.ts
 * alongside the service layer they describe.
 */

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
 * Reason a mutation was rejected.
 */
export type MutationRejectionReason =
  | 'out-of-bounds'
  | 'spawner-or-exit'
  | 'tower-occupied'
  | 'would-block-all-paths'
  | 'already-mutated-this-turn'
  | 'no-op';
