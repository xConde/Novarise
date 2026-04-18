/**
 * Conduit system constants — adjacency networks between towers
 * (Phase 4, sprints 41-56).
 *
 * See `docs/design/conduit-adjacency-graph.md` for the locked design spike
 * that motivates each constant below.
 */
export const CONDUIT_CONFIG = {
  /**
   * Default per-tower link-slot capacity. A tower can participate in this
   * many spatial + virtual edges simultaneously. ARCHITECT (rare anchor,
   * sprint 49) increments `tower.linkSlots` past this default; every tower
   * with `linkSlots === undefined` reads the default.
   *
   * 4 = one slot per 4-direction neighbor on a grid. Matches the adjacency
   * model (4-dir, locked in spike §6). Diagonal adjacency is out of scope.
   */
  DEFAULT_LINK_SLOTS: 4,

  /**
   * Adjacency model: cardinal 4-direction only (up, down, left, right).
   * Diagonals are NOT neighbors. See spike §6 for rationale (visual
   * legibility, pathfinding precedent, Manhattan radius consistency).
   *
   * Changing this constant alone is INSUFFICIENT to switch adjacency
   * modes — TowerGraphService's neighbor-scan logic also iterates cardinal
   * offsets literally. Treat this as documentary; diagonal support is a
   * rewrite, not a flag flip.
   */
  ADJACENCY_MODE: 'cardinal-4' as const,

  /**
   * Metric used for disruption radius queries (DISRUPTOR sprint 53,
   * DIVIDER boss sprint 55). Manhattan distance matches 4-dir graph
   * semantics: radius-2 from (r, c) hits the Manhattan diamond of 13
   * tiles, not the 5x5 Chebyshev square of 25.
   *
   * Locked in spike §6. Documented for the card copy of DISRUPTOR /
   * DIVIDER so players see "within 2 tiles" as diamond-shaped.
   */
  DISRUPTION_METRIC: 'manhattan' as const,

  /**
   * Minimum straight-line length (inclusive of the tower itself) that triggers
   * FORMATION's +range additive. Plan §archetype-44: "towers in a row of 3+".
   * Sprint 44. Balance-tunable; anchored at 3 for initial playtest.
   */
  FORMATION_MIN_LINE_LENGTH: 3,

  /**
   * Minimum cluster size (inclusive of the tower itself) that activates
   * LINKWORK's shared fire-rate boost. Sprint 45. A lone tower (cluster size
   * 1) gets no benefit — the buff rewards building linked groups.
   *
   * Balance-tunable; anchored at 2 for initial playtest (any link triggers).
   */
  LINKWORK_MIN_CLUSTER_SIZE: 2,

  /**
   * Per-tower fire-rate boost granted by LINKWORK to every tower in a
   * qualifying cluster. Sprint 45. Added to `fireRateBoost` before the
   * shot-count ceiling so the ceil-semantic (1 + boost → 2 shots) applies
   * as if a FIRE_RATE modifier card were stacked in. Value mirrors the
   * OVERCLOCK / RAPID_FIRE economy.
   */
  LINKWORK_FIRE_RATE_BONUS: 1,
} as const;
