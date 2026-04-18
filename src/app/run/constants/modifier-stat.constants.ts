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
} as const;

export type ModifierStat = typeof MODIFIER_STAT[keyof typeof MODIFIER_STAT];
