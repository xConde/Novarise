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
} as const;

export type ModifierStat = typeof MODIFIER_STAT[keyof typeof MODIFIER_STAT];
