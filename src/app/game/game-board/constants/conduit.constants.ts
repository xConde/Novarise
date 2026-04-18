/**
 * Conduit system constants — adjacency networks between towers.
 *
 * See `docs/design/conduit-adjacency-graph.md` for the locked design spike
 * that motivates each constant below.
 */
export const CONDUIT_CONFIG = {
  /**
   * Adjacency model: cardinal 4-direction only (spike §6). Changing this
   * constant is INSUFFICIENT to switch modes — TowerGraphService's
   * neighbor-scan iterates cardinal offsets literally. Documentary; diagonal
   * support is a rewrite, not a flag flip.
   */
  ADJACENCY_MODE: 'cardinal-4' as const,

  /**
   * Metric for disruption radius queries. Manhattan matches 4-dir graph
   * semantics: radius-2 from (r, c) hits a Manhattan diamond of 13 tiles,
   * not the 5x5 Chebyshev square of 25. Locked in spike §6.
   */
  DISRUPTION_METRIC: 'manhattan' as const,

  /**
   * Minimum straight-line length (inclusive of the tower itself) that
   * triggers FORMATION's +range additive. Balance-tunable; anchored at 3.
   */
  FORMATION_MIN_LINE_LENGTH: 3,

  /**
   * Minimum cluster size (inclusive of the tower itself) that activates
   * LINKWORK's shared fire-rate boost. A lone tower (size 1) gets no benefit
   * — the buff rewards building linked groups.
   */
  LINKWORK_MIN_CLUSTER_SIZE: 2,

  /**
   * Per-tower fire-rate boost granted by LINKWORK to every tower in a
   * qualifying cluster. Added to `fireRateBoost` before the shot-count
   * ceiling so the ceil-semantic (1 + boost → 2 shots) applies as if a
   * FIRE_RATE modifier card were stacked in.
   */
  LINKWORK_FIRE_RATE_BONUS: 1,

  /**
   * Number of cluster neighbors selected to fire-along when HARMONIC is
   * active. Passengers chosen via seeded RNG so replays are deterministic.
   * When fewer non-disrupted neighbors exist, all eligible members fire.
   */
  HARMONIC_NEIGHBOR_COUNT: 2,

  /**
   * Minimum 4-direction neighbor count (non-disrupted) required to activate
   * GRID_SURGE's damage multiplier. 4 is the hard upper bound on a 4-dir
   * grid, so GRID_SURGE rewards maximal clustering density.
   */
  GRID_SURGE_MIN_NEIGHBORS: 4,
} as const;
