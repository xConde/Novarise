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
  /**
   * Damage bonus multiplier applied in EnemyService.damageEnemy when the
   * target tile's elevation is negative (DEPRESS_TILE "exposed" mechanic).
   * +25% = 1 + 0.25 → `damage = Math.round(damage * (1 + EXPOSED_DAMAGE_BONUS))`.
   *
   * Source: card-definitions.ts CARD_VALUES.exposedDamageBonus (mirror constant
   * — both must stay in sync; the game service reads this copy to avoid a
   * cross-boundary import from run/constants into game/constants).
   */
  EXPOSED_DAMAGE_BONUS: 0.25,
} as const;
