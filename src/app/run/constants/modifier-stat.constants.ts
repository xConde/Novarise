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

  // Phase 2 Sprints 17/18 — Cartographer flag-style modifiers.
  //
  // These are BOOLEAN flags (not numeric stats) consumed by non-combat services
  // (CardPlayService, TowerCombatService) via `hasActiveModifier()` rather than
  // `getModifierValue()`. The aggregator-style numeric reads return 0 for these
  // when queried, which is harmless — no code sums these stats.
  //
  // They use `duration: null` on the ActiveModifier to mean "encounter-scoped
  // forever" (see ActiveModifier.remainingWaves widened to number | null).
  //
  // - TERRAFORM_ANCHOR (CARTOGRAPHER_SEAL, sprint 17): when active, forces all
  //   outgoing terraform mutations to duration=null (permanent).
  // - LABYRINTH_MIND (sprint 18): when active, tower damage scales with the
  //   current path length from spawner to exit.
  TERRAFORM_ANCHOR: 'terraformAnchor',
  LABYRINTH_MIND: 'labyrinthMind',

  // Phase 3 Sprint 29 — Highground modifier.
  //
  // Numeric stat (additive across stacked copies via getModifierValue).
  // Consumed in TowerCombatService.fireTurn per-tower: a tower on elevation ≥ 2
  // receives (1 + value) range multiplier on top of the passive elevation bonus.
  // HIGH_PERCH (1E common) uses duration=1 (one-wave countdown).
  HIGH_PERCH_RANGE_BONUS: 'highPerchRangeBonus',

  // Phase 3 Sprint 31 — VANTAGE_POINT modifier (uncommon).
  //
  // Numeric stat: +50% (base) / +75% (upgraded) damage for all elevated towers
  // (elevation ≥ VANTAGE_POINT_ELEVATION_THRESHOLD = 1) for the current wave.
  // Additive across stacked copies via getModifierValue, applied multiplicatively
  // in TowerCombatService.fireTurn after elevationRangeMult.
  // Uses duration=1 (one-wave countdown, mirrors HIGH_PERCH pattern).
  VANTAGE_POINT_DAMAGE_BONUS: 'vantagePointDamageBonus',

  // Phase 3 Sprint 33 — KING_OF_THE_HILL modifier (rare).
  //
  // Encounter-scoped (duration: null). Passive: the tower(s) at the HIGHEST
  // elevation on the board deal +100% damage (base) / +150% (upgraded).
  // Only activates when maxElevation ≥ 1 — flat boards get no bonus.
  // Ties: ALL towers sharing max elevation receive the bonus (anti-flapping).
  // Read in TowerCombatService.fireTurn via getMaxElevation() + per-tower check.
  KING_OF_THE_HILL_DAMAGE_BONUS: 'kingOfTheHillDamageBonus',

  // Phase 3 Sprint 34 — GRAVITY_WELL modifier (rare).
  //
  // Encounter-scoped (duration: null). Boolean flag: when active, enemies on
  // tiles with elevation < 0 (depressed) skip their movement for the turn.
  // Consumed in EnemyService.stepEnemiesOneTurn via getModifierValue() > 0.
  // Upgrade slot reserved for future balance tuning — same effect, no change.
  GRAVITY_WELL: 'gravityWell',

  // Phase 4 Sprint 43 — HANDSHAKE modifier (Conduit common).
  //
  // Numeric stat: +15% damage (base) / +25% (upgraded) for any tower with
  // at least one active (non-disrupted) 4-dir neighbor, for one wave.
  // Wave-scoped (duration=1, mirrors HIGH_PERCH pattern).
  // Read per-tower in TowerCombatService.composeDamageStack via a
  // towerGraphService.getNeighbors lookup. A disrupted tower's neighbor set
  // is empty by construction, so disruption transparently silences the
  // HANDSHAKE bonus without a second predicate.
  HANDSHAKE_DAMAGE_BONUS: 'handshakeDamageBonus',

  // Phase 4 Sprint 44 — FORMATION modifier (Conduit common).
  //
  // Additive-to-base range bonus (NOT multiplicative): towers in a straight
  // 4-dir line of 3+ towers gain `+value` tiles of range for the wave.
  // Conduit spike §13 locks the ordering — the additive folds inside the
  // `(base + additive) × multipliers` parenthesis so elevation + HIGH_PERCH
  // multipliers compound on top of the augmented base.
  //
  // Detected per-tower in composeDamageStack via
  // TowerGraphService.isInStraightLineOf(row, col, minLen=3). Base +1 tile,
  // upgraded +2 tiles. Duration 1 (wave-scoped).
  FORMATION_RANGE_ADDITIVE: 'formationRangeAdditive',

  // Phase 4 Sprint 45 — LINKWORK modifier (Conduit common).
  //
  // Boolean flag — turn-scoped (duration: 2 turns). When active, every tower
  // in a cluster reads the MAXIMUM base fireRate across its cluster (spatial
  // + virtual edges, non-disrupted members). Reads via hasActiveModifier(),
  // then `TowerGraphService.getClusterTowers(...)` in TowerCombatService.
  //
  // `value` is a sentinel (1) — the flag is what matters, not the number.
  // First turn-scoped modifier in the codebase — see tickTurn in
  // CardEffectService.
  LINKWORK_FIRE_RATE_SHARE: 'linkworkFireRateShare',

  // Phase 4 Sprint 46 — HARMONIC modifier (Conduit uncommon).
  //
  // Boolean flag — turn-scoped (duration: 3 turns base / 4 upgraded). When
  // active, a tower's fire at a target triggers up to HARMONIC_NEIGHBOR_COUNT
  // passenger shots from random cluster members at the same target (range-
  // gated). Non-recursive (passengers never cascade). Seeded RNG selection
  // via RunService.nextRandom() for replay determinism.
  //
  // Read as a boolean flag in TowerCombatService.fireTurn AFTER the shot loop
  // — propagation consumes `lastTarget` (last successful target of the main
  // tower this turn).
  HARMONIC_SIMULTANEOUS_FIRE: 'harmonicSimultaneousFire',

  // Phase 4 Sprint 47 — GRID_SURGE modifier (Conduit uncommon).
  //
  // Numeric damage multiplier — turn-scoped (duration: 1 turn). Applied per-
  // tower as stage 10 of composeDamageStack, gated on
  // `getNeighbors(currentTurn).length >= GRID_SURGE_MIN_NEIGHBORS` (4 = all
  // 4 cardinal neighbors filled and non-disrupted). Additive across stacks;
  // aggregate via getModifierValue.
  //
  // Disruption transparently silences the bonus (disrupted tower reads zero
  // neighbors — same pattern as HANDSHAKE).
  GRID_SURGE_DAMAGE_BONUS: 'gridSurgeDamageBonus',

  // Phase 4 Sprint 49 — ARCHITECT modifier (Conduit rare anchor).
  //
  // Boolean flag — encounter-scoped (duration: null). When active, neighbor-
  // gated cards (HANDSHAKE, GRID_SURGE) substitute `clusterSize - 1` for
  // the literal 4-dir neighbor count. Effect: a tower in a 10-tower cluster
  // counts as having 9 neighbors for gate purposes even if it has only 2
  // spatial adjacencies.
  //
  // Interpretation A from the phase-4 session-2 kickoff (extends propagation
  // radius from 1 to cluster for all neighbor-gated cards). Gives ARCHITECT
  // a rare-tier identity: transforms the cluster into one adjacency super-
  // node.
  //
  // Disruption still applies — a disrupted tower reads its cluster as just
  // itself, so the propagation silences transparently.
  ARCHITECT_CLUSTER_PROPAGATION: 'architectClusterPropagation',

  // Phase 4 Sprint 50 — HIVE_MIND modifier (Conduit rare build-around).
  //
  // Boolean flag — encounter-scoped (duration: null). When active, every
  // tower in a cluster reads the MAX composed damage and range across all
  // cluster members (spatial + virtual edges, non-disrupted). A cluster
  // of a BASIC tower (low damage) + a SNIPER (high damage) under HIVE_MIND
  // has both firing at the SNIPER's damage output.
  //
  // Stats composed: damage and range (via composeDamageStack's output).
  // Fire-rate sharing already covered by LINKWORK (sprint 45) — HIVE_MIND
  // does not duplicate that knob.
  //
  // Disruption gate: disrupted towers read their cluster as cluster-of-1
  // (themselves only), so the max-of-cluster collapses to their own stats.
  HIVE_MIND_CLUSTER_MAX: 'hiveMindClusterMax',
} as const;

export type ModifierStat = typeof MODIFIER_STAT[keyof typeof MODIFIER_STAT];
