/**
 * String keys for card modifier stats. Use these constants — never raw strings —
 * when writing or reading modifier values via CardEffectService.
 *
 * Why this exists: round 2 hit a bug where two cards wrote the same conceptual
 * stat under different string keys ('fireRate' vs 'fire_rate'). The fix unified
 * them but the string-typing made the bug invisible at compile time. Promoting
 * to a const-keyed object surfaces typos at compile time.
 */
export const MODIFIER_STAT = {
  DAMAGE: 'damage',
  RANGE: 'range',
  SNIPER_DAMAGE: 'sniperDamage',
  FIRE_RATE: 'fireRate',
  CHAIN_BOUNCES: 'chainBounces',
  ENEMY_SPEED: 'enemySpeed',
  GOLD_MULTIPLIER: 'goldMultiplier',
  LEAK_BLOCK: 'leakBlock',

  // Cartographer flag-style modifiers. BOOLEAN flags (not numeric stats) consumed
  // via `hasActiveModifier()` rather than `getModifierValue()` — the aggregator
  // returns 0, which is harmless.
  //
  // - TERRAFORM_ANCHOR (CARTOGRAPHER_SEAL): when active, forces terraform
  //   mutations to duration=null (permanent).
  // - LABYRINTH_MIND: tower damage scales with current spawner→exit path length.
  TERRAFORM_ANCHOR: 'terraformAnchor',
  LABYRINTH_MIND: 'labyrinthMind',

  /** HIGH_PERCH: conditional range bonus for towers on elevation ≥ 2. */
  HIGH_PERCH_RANGE_BONUS: 'highPerchRangeBonus',

  /** VANTAGE_POINT: damage bonus for towers on elevation ≥ 1. */
  VANTAGE_POINT_DAMAGE_BONUS: 'vantagePointDamageBonus',

  /**
   * KING_OF_THE_HILL: encounter-scoped damage bonus for tower(s) at the
   * board-wide max elevation. Only activates when maxElevation ≥ 1; ties
   * award ALL towers at the max (anti-flapping).
   */
  KING_OF_THE_HILL_DAMAGE_BONUS: 'kingOfTheHillDamageBonus',

  /**
   * GRAVITY_WELL: encounter-scoped tier sentinel. Value 1 = gate-only (base
   * card); value 2 = gate + 10% max-HP bleed per turn on gated enemies
   * (upgraded card). EnemyService.stepEnemiesOneTurn reads the numeric value
   * and branches: value ≥ 1 → movement gate on depressed tiles; value ≥ 2 →
   * per-turn bleed on each gated enemy.
   */
  GRAVITY_WELL: 'gravityWell',

  /**
   * HANDSHAKE (Conduit common): wave-scoped damage bonus for towers with ≥ 1
   * active (non-disrupted) 4-dir neighbor. Disruption silences via an empty
   * neighbor set — no second predicate needed.
   */
  HANDSHAKE_DAMAGE_BONUS: 'handshakeDamageBonus',

  /**
   * FORMATION (Conduit common): additive-to-base range for towers in a
   * straight 4-dir line of 3+. Folds inside `(base + additive) × multipliers`
   * per spike §13.
   */
  FORMATION_RANGE_ADDITIVE: 'formationRangeAdditive',

  /**
   * LINKWORK (Conduit common): turn-scoped boolean flag. When active, every
   * tower in a qualifying cluster gains LINKWORK_FIRE_RATE_BONUS shots/turn.
   * `value` is a sentinel — the flag is what matters.
   */
  LINKWORK_FIRE_RATE_SHARE: 'linkworkFireRateShare',

  /**
   * HARMONIC (Conduit uncommon): turn-scoped boolean flag. After a tower
   * fires at a target, up to HARMONIC_NEIGHBOR_COUNT cluster neighbors fire
   * at the same target (range-gated). Non-recursive — passengers never
   * cascade. Seeded RNG for replay determinism.
   */
  HARMONIC_SIMULTANEOUS_FIRE: 'harmonicSimultaneousFire',

  /**
   * GRID_SURGE (Conduit uncommon): turn-scoped damage multiplier, gated on
   * ≥ GRID_SURGE_MIN_NEIGHBORS (4) non-disrupted cardinal neighbors.
   * Additive across stacks via getModifierValue.
   */
  GRID_SURGE_DAMAGE_BONUS: 'gridSurgeDamageBonus',

  /**
   * ARCHITECT (Conduit rare anchor): encounter-scoped boolean flag. When
   * active, neighbor-gated cards (HANDSHAKE, GRID_SURGE) substitute
   * `clusterSize - 1` for the literal 4-dir neighbor count — a tower in a
   * 10-tower cluster counts as having 9 neighbors. Disruption shrinks the
   * cluster transparently.
   */
  ARCHITECT_CLUSTER_PROPAGATION: 'architectClusterPropagation',

  /**
   * HIVE_MIND (Conduit rare build-around): encounter-scoped boolean flag.
   * Every tower in a cluster reads the MAX composed damage and range across
   * cluster members. A BASIC + SNIPER cluster fires both at SNIPER damage.
   * Disrupted towers read their cluster as cluster-of-1.
   */
  HIVE_MIND_CLUSTER_MAX: 'hiveMindClusterMax',
} as const;

export type ModifierStat = typeof MODIFIER_STAT[keyof typeof MODIFIER_STAT];
