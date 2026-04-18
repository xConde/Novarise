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
} as const;

export type ModifierStat = typeof MODIFIER_STAT[keyof typeof MODIFIER_STAT];
