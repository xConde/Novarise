/**
 * Elevation system shared types — Highground archetype (sprint 25).
 *
 * ElevationService uses these; LineOfSightService (sprint 26) will read them;
 * TowerCombatService (sprint 29+) reads ElevationChange for range/damage scaling.
 */

export type ElevationOp = 'raise' | 'depress' | 'set' | 'collapse';

export interface ElevationChange {
  /** Stable ID for expiry matching. */
  readonly id: string;
  readonly op: ElevationOp;
  readonly row: number;
  readonly col: number;
  readonly appliedOnTurn: number;
  /** null = permanent (relics, setAbsolute). Positive integer = expires on that turn. */
  readonly expiresOnTurn: number | null;
  /** Elevation value that existed before this change — used for revert on expiry. */
  readonly priorElevation: number;
  /** For raise/depress: the delta applied. For set: the new absolute value. For collapse: always 0. */
  readonly deltaOrAbsolute: number;
  readonly source: 'card' | 'relic';
  /** Card definition id, relic id, etc. */
  readonly sourceId: string;
}

export type ElevationRejectionReason =
  | 'out-of-bounds'
  | 'spawner-or-exit'
  | 'out-of-range'                // exceeds MAX_ELEVATION or MAX_DEPRESS
  | 'already-changed-this-turn'   // anti-spam: one change per (row,col) per turn
  | 'no-op';                      // newElevation === priorElevation

export interface ElevationResult {
  readonly ok: boolean;
  readonly reason?: ElevationRejectionReason;
  readonly change?: ElevationChange;
  readonly newElevation?: number;
}

/**
 * Serializable snapshot for EncounterCheckpoint v9.
 * Sparse — only non-zero cells are included in `elevations`.
 */
export interface SerializableTileElevationState {
  /** Sparse per-tile elevation values (only non-zero cells). */
  readonly elevations: readonly { row: number; col: number; value: number }[];
  /** Journal snapshot (for turn-expiry restore). */
  readonly changes: readonly ElevationChange[];
  /** Next ID counter — monotonically increasing across the encounter. */
  readonly nextId: number;
}
