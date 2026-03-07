export enum StatusEffectType {
  SLOW = 'SLOW',
  BURN = 'BURN',
  POISON = 'POISON',
}

export interface StatusEffectConfig {
  /** Effect type identifier */
  type: StatusEffectType;
  /** Duration in game-time seconds */
  duration: number;
  /** Speed multiplier (1.0 = no change, 0.5 = half speed). Only for SLOW. */
  speedMultiplier?: number;
  /** Damage per tick (for DoT effects like BURN, POISON) */
  damagePerTick?: number;
  /** Tick interval in game-time seconds (for DoT effects) */
  tickInterval?: number;
  /** Whether this effect stacks with same type (false = refresh duration only) */
  stacks?: boolean;
}

export const STATUS_EFFECT_CONFIGS: Record<StatusEffectType, StatusEffectConfig> = {
  [StatusEffectType.SLOW]: {
    type: StatusEffectType.SLOW,
    duration: 2,
    speedMultiplier: 0.5,
    stacks: false,
  },
  [StatusEffectType.BURN]: {
    type: StatusEffectType.BURN,
    duration: 3,
    damagePerTick: 5,
    tickInterval: 0.5,
    stacks: false,
  },
  [StatusEffectType.POISON]: {
    type: StatusEffectType.POISON,
    duration: 4,
    damagePerTick: 3,
    tickInterval: 1,
    stacks: false,
  },
};
