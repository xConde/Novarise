/**
 * Elevation system shared types — Highground archetype.
 *
 * ElevationService uses these; LineOfSightService reads them;
 * TowerCombatService reads ElevationChange for range/damage scaling.
 */

import { ElevationRejectionReason } from '../models/elevation.model';

// Pure type declarations live in the models layer; re-exported here for
// backward compatibility with all existing service-layer importers.
export { ElevationRejectionReason } from '../models/elevation.model';

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
