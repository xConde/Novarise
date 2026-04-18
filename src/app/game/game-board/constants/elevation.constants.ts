/**
 * Elevation system constants — Highground archetype (sprint 25).
 *
 * RANGE_BONUS_PER_ELEVATION is consumed by sprint 29 HIGH_PERCH and
 * downstream tower-combat integration. See elevation-model.md §10.
 */
export const ELEVATION_CONFIG = {
  MAX_ELEVATION: 3,
  MAX_DEPRESS: 2,
  RANGE_BONUS_PER_ELEVATION: 0.25,
} as const;
