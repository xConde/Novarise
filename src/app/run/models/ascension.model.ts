/**
 * Ascension model for Ascent Mode.
 *
 * Ascension levels 1-20 add cumulative challenge modifiers.
 * No permanent power creep — only escalating difficulty.
 * Follows StS design: each level primarily adds ONE specific twist;
 * secondary effects can be expressed via `additionalEffects`.
 */

export enum AscensionEffectType {
  ENEMY_HEALTH_MULTIPLIER = 'enemy_health_multiplier',
  ENEMY_SPEED_MULTIPLIER = 'enemy_speed_multiplier',
  STARTING_GOLD_REDUCTION = 'starting_gold_reduction',
  STARTING_LIVES_REDUCTION = 'starting_lives_reduction',
  TOWER_COST_MULTIPLIER = 'tower_cost_multiplier',
  ELITE_HEALTH_MULTIPLIER = 'elite_health_multiplier',
  BOSS_HEALTH_MULTIPLIER = 'boss_health_multiplier',
  REST_HEAL_REDUCTION = 'rest_heal_reduction',
  SHOP_PRICE_MULTIPLIER = 'shop_price_multiplier',
  FEWER_RELIC_CHOICES = 'fewer_relic_choices',
  FEWER_CARD_CHOICES = 'fewer_card_choices',
}

export interface AscensionEffect {
  readonly type: AscensionEffectType;
  readonly value: number;
}

export interface AscensionLevel {
  readonly level: number;
  readonly label: string;
  readonly description: string;
  readonly effect: AscensionEffect;
  /** Optional secondary effects applied at the same level (e.g. A11 reduces both relics and card choices). */
  readonly additionalEffects?: readonly AscensionEffect[];
}

export const MAX_ASCENSION_LEVEL = 20;

export const ASCENSION_LEVELS: ReadonlyArray<AscensionLevel> = [
  { level: 1, label: 'Hardened', description: 'Enemies have 10% more health', effect: { type: AscensionEffectType.ENEMY_HEALTH_MULTIPLIER, value: 1.1 } },
  { level: 2, label: 'Swift', description: 'Enemies move 5% faster', effect: { type: AscensionEffectType.ENEMY_SPEED_MULTIPLIER, value: 1.05 } },
  { level: 3, label: 'Taxed', description: 'Start with 20 less gold', effect: { type: AscensionEffectType.STARTING_GOLD_REDUCTION, value: 20 } },
  { level: 4, label: 'Fragile', description: 'Start with 2 fewer lives', effect: { type: AscensionEffectType.STARTING_LIVES_REDUCTION, value: 2 } },
  { level: 5, label: 'Fortified', description: 'Elite enemies have 25% more health', effect: { type: AscensionEffectType.ELITE_HEALTH_MULTIPLIER, value: 1.25 } },
  { level: 6, label: 'Inflation', description: 'All towers cost 10% more', effect: { type: AscensionEffectType.TOWER_COST_MULTIPLIER, value: 1.1 } },
  { level: 7, label: 'Ironclad', description: 'Enemies have 20% more health', effect: { type: AscensionEffectType.ENEMY_HEALTH_MULTIPLIER, value: 1.2 } },
  { level: 8, label: 'Lean Rations', description: 'Rest heals 25% less', effect: { type: AscensionEffectType.REST_HEAL_REDUCTION, value: 0.75 } },
  { level: 9, label: 'Gouged', description: 'Shop prices 20% higher', effect: { type: AscensionEffectType.SHOP_PRICE_MULTIPLIER, value: 1.2 } },
  { level: 10, label: 'Bulwark', description: 'Boss enemies have 30% more health', effect: { type: AscensionEffectType.BOSS_HEALTH_MULTIPLIER, value: 1.3 } },
  { level: 11, label: 'Scarce', description: 'One fewer relic choice and one fewer card choice offered', effect: { type: AscensionEffectType.FEWER_RELIC_CHOICES, value: 1 }, additionalEffects: [{ type: AscensionEffectType.FEWER_CARD_CHOICES, value: 1 }] },
  { level: 12, label: 'Quickened', description: 'Enemies move 10% faster', effect: { type: AscensionEffectType.ENEMY_SPEED_MULTIPLIER, value: 1.1 } },
  { level: 13, label: 'Austerity', description: 'Start with 30 less gold', effect: { type: AscensionEffectType.STARTING_GOLD_REDUCTION, value: 30 } },
  { level: 14, label: 'Exposed', description: 'Start with 3 fewer lives', effect: { type: AscensionEffectType.STARTING_LIVES_REDUCTION, value: 3 } },
  { level: 15, label: 'Relentless', description: 'Enemies have 30% more health', effect: { type: AscensionEffectType.ENEMY_HEALTH_MULTIPLIER, value: 1.3 } },
  { level: 16, label: 'Gourmand', description: 'All towers cost 20% more', effect: { type: AscensionEffectType.TOWER_COST_MULTIPLIER, value: 1.2 } },
  { level: 17, label: 'Frugal Rest', description: 'Rest heals 50% less', effect: { type: AscensionEffectType.REST_HEAL_REDUCTION, value: 0.5 } },
  { level: 18, label: 'Ironclad Elite', description: 'Elite enemies have 50% more health', effect: { type: AscensionEffectType.ELITE_HEALTH_MULTIPLIER, value: 1.5 } },
  { level: 19, label: 'Haste', description: 'Enemies move 15% faster', effect: { type: AscensionEffectType.ENEMY_SPEED_MULTIPLIER, value: 1.15 } },
  { level: 20, label: 'Apex', description: 'Boss enemies have 60% more health', effect: { type: AscensionEffectType.BOSS_HEALTH_MULTIPLIER, value: 1.6 } },
];

/**
 * Aggregate all ascension effects up to and including the given level.
 * Effects of the same type stack multiplicatively (multipliers) or additively (reductions).
 * Processes both `effect` and `additionalEffects` for each level entry.
 */
export function getAscensionEffects(level: number): Map<AscensionEffectType, number> {
  const effects = new Map<AscensionEffectType, number>();
  const clampedLevel = Math.min(Math.max(0, level), MAX_ASCENSION_LEVEL);

  for (let i = 0; i < clampedLevel; i++) {
    const asc = ASCENSION_LEVELS[i];
    applyAscensionEffect(asc.effect, effects);
    for (const extra of asc.additionalEffects ?? []) {
      applyAscensionEffect(extra, effects);
    }
  }

  return effects;
}

function applyAscensionEffect(
  effect: AscensionEffect,
  effects: Map<AscensionEffectType, number>,
): void {
  const current = effects.get(effect.type);

  switch (effect.type) {
    // Multiplicative stacking
    case AscensionEffectType.ENEMY_HEALTH_MULTIPLIER:
    case AscensionEffectType.ENEMY_SPEED_MULTIPLIER:
    case AscensionEffectType.TOWER_COST_MULTIPLIER:
    case AscensionEffectType.ELITE_HEALTH_MULTIPLIER:
    case AscensionEffectType.BOSS_HEALTH_MULTIPLIER:
    case AscensionEffectType.SHOP_PRICE_MULTIPLIER:
      effects.set(effect.type, (current ?? 1) * effect.value);
      break;

    // Multiplicative reduction (applies to heal percentage)
    case AscensionEffectType.REST_HEAL_REDUCTION:
      effects.set(effect.type, (current ?? 1) * effect.value);
      break;

    // Additive stacking
    case AscensionEffectType.STARTING_GOLD_REDUCTION:
    case AscensionEffectType.STARTING_LIVES_REDUCTION:
    case AscensionEffectType.FEWER_RELIC_CHOICES:
    case AscensionEffectType.FEWER_CARD_CHOICES:
      effects.set(effect.type, (current ?? 0) + effect.value);
      break;
  }
}
