/**
 * Pure type declarations for the elevation subsystem.
 *
 * Service implementation types (ElevationOp, ElevationChange, ElevationResult,
 * SerializableTileElevationState) remain in elevation.types.ts alongside
 * the service layer they describe.
 */

/**
 * Reason an elevation change was rejected.
 */
export type ElevationRejectionReason =
  | 'out-of-bounds'
  | 'spawner-or-exit'
  | 'out-of-range'                // exceeds MAX_ELEVATION or MAX_DEPRESS
  | 'already-changed-this-turn'   // anti-spam: one change per (row,col) per turn
  | 'no-op'                       // newElevation === priorElevation
  | 'not-elevated';               // AVALANCHE_ORDER: target tile must have elevation ≥ 1
