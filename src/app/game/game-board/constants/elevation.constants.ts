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

  /**
   * Minimum elevation a tower must be on to qualify for the HIGH_PERCH range
   * bonus. Read by TowerCombatService.fireTurn so card-definitions.ts does not
   * need to export CARD_VALUES (which is a local const). Mirror is
   * CARD_VALUES.highPerchThreshold — both must remain in sync.
   */
  HIGH_PERCH_ELEVATION_THRESHOLD: 2,

  /**
   * Minimum elevation a tower must be on to qualify for the VANTAGE_POINT
   * damage bonus (sprint 31). A tower on a flat tile (elevation 0) does NOT
   * benefit even when VANTAGE_POINT is active. Mirror of
   * CARD_VALUES.vantagePointElevationThreshold — both must stay in sync.
   */
  VANTAGE_POINT_ELEVATION_THRESHOLD: 1,

  // ── Sprint 36: SURVEYOR_ROD relic ──────────────────────────────────────────

  /** Number of tiles SURVEYOR_ROD pre-elevates at encounter start. */
  SURVEYOR_ROD_TILE_COUNT: 5,

  /** Elevation amount applied per tile by SURVEYOR_ROD. */
  SURVEYOR_ROD_ELEVATION_AMOUNT: 1,

  // ── Sprint 36: OROGENY relic ────────────────────────────────────────────────

  /** How many turns must pass between OROGENY elevation triggers. */
  OROGENY_INTERVAL_TURNS: 5,

  /** Elevation amount OROGENY raises the chosen tower tile by. */
  OROGENY_ELEVATION_AMOUNT: 1,

  // ── Sprint 38: TITAN elite ──────────────────────────────────────────────────

  /**
   * Fraction of the elevation-bonus portion that is applied against a TITAN.
   * 0.5 = elevation bonus damage is halved (not the full damage — only the
   * portion above the base-without-elevation).
   */
  TITAN_ELEVATION_DAMAGE_REDUCTION: 0.5,

  // ── Sprint 39: Cliff column meshes ─────────────────────────────────────────

  /**
   * Stone-gray color for the cliff column mesh placed under raised tiles.
   * Chosen to evoke granite/basalt without competing with the tile color above.
   * Consumed by TerraformMaterialPoolService cliff material entry.
   */
  CLIFF_MATERIAL_COLOR: 0x3a3a42,

  // ── Sprint 39: WYRM_ASCENDANT boss counter (documentary) ───────────────────

  /**
   * Documentary flag — WYRM_ASCENDANT immuneToElevationDamageBonuses is true.
   * No runtime usage; keeps the constant file as the single source of truth for
   * the elevation-immunity model so sprint 79 balance passes don't need to hunt
   * through service code.
   */
  WYRM_BASE_DAMAGE_IMMUNITY: true,

  // ── GRAVITY_WELL upgraded — bleed tier ─────────────────────────────────────

  /**
   * Modifier-value threshold for the GRAVITY_WELL upgraded "bleed" tier.
   * EnemyService.stepEnemiesOneTurn reads MODIFIER_STAT.GRAVITY_WELL as a
   * numeric tier: ≥ 1 = gate-only (base card), ≥ 2 = gate + bleed (upgraded).
   * Mirror of CARD_VALUES.gravityWellUpgradedValue — both must stay in sync.
   */
  GRAVITY_WELL_UPGRADED_VALUE: 2,

  /**
   * Fraction of max-HP dealt to every enemy the upgraded GRAVITY_WELL gates
   * each turn. 0.10 = 10% per turn. Resolved through EnemyService.damageEnemy
   * so shields / exposed-damage multiplier / death spawns all run normally.
   * Mirror of CARD_VALUES.gravityWellBleedFraction — both must stay in sync.
   */
  GRAVITY_WELL_BLEED_FRACTION: 0.10,
} as const;
