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
} as const;
