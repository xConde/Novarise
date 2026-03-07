export enum GameModifier {
  ARMORED_ENEMIES = 'ARMORED_ENEMIES',
  FAST_ENEMIES = 'FAST_ENEMIES',
  EXPENSIVE_TOWERS = 'EXPENSIVE_TOWERS',
  NO_INTEREST = 'NO_INTEREST',
  DOUBLE_SPAWN = 'DOUBLE_SPAWN',
  GLASS_CANNON = 'GLASS_CANNON',
  SPEED_DEMONS = 'SPEED_DEMONS',
  WEALTHY_START = 'WEALTHY_START',
}

export interface ModifierEffects {
  enemyHealthMultiplier?: number;
  enemySpeedMultiplier?: number;
  towerCostMultiplier?: number;
  disableInterest?: boolean;
  waveCountMultiplier?: number;
  towerDamageMultiplier?: number;
  startingGoldMultiplier?: number;
}

export interface GameModifierConfig {
  id: GameModifier;
  label: string;
  description: string;
  /** Score multiplier bonus for this modifier (e.g., 0.2 = +20% score) */
  scoreBonus: number;
  /** Stat adjustments applied by this modifier */
  effects: ModifierEffects;
}

export const GAME_MODIFIER_CONFIGS: Record<GameModifier, GameModifierConfig> = {
  [GameModifier.ARMORED_ENEMIES]: {
    id: GameModifier.ARMORED_ENEMIES,
    label: 'Armored',
    description: 'Enemies have 2x health',
    scoreBonus: 0.3,
    effects: { enemyHealthMultiplier: 2.0 },
  },
  [GameModifier.FAST_ENEMIES]: {
    id: GameModifier.FAST_ENEMIES,
    label: 'Swift Horde',
    description: 'Enemies move 50% faster',
    scoreBonus: 0.25,
    effects: { enemySpeedMultiplier: 1.5 },
  },
  [GameModifier.EXPENSIVE_TOWERS]: {
    id: GameModifier.EXPENSIVE_TOWERS,
    label: 'Inflation',
    description: 'Tower costs increased by 50%',
    scoreBonus: 0.2,
    effects: { towerCostMultiplier: 1.5 },
  },
  [GameModifier.NO_INTEREST]: {
    id: GameModifier.NO_INTEREST,
    label: 'No Interest',
    description: 'No gold interest between waves',
    scoreBonus: 0.15,
    effects: { disableInterest: true },
  },
  [GameModifier.DOUBLE_SPAWN]: {
    id: GameModifier.DOUBLE_SPAWN,
    label: 'Swarm',
    description: 'Double enemy count per wave',
    scoreBonus: 0.4,
    effects: { waveCountMultiplier: 2.0 },
  },
  [GameModifier.GLASS_CANNON]: {
    id: GameModifier.GLASS_CANNON,
    label: 'Glass Cannon',
    description: 'Towers deal 2x damage but cost 2x',
    scoreBonus: 0.1,
    effects: { towerDamageMultiplier: 2.0, towerCostMultiplier: 2.0 },
  },
  [GameModifier.SPEED_DEMONS]: {
    id: GameModifier.SPEED_DEMONS,
    label: 'Speed Demons',
    description: 'Fast and Swift enemies have 2x speed',
    scoreBonus: 0.2,
    effects: { enemySpeedMultiplier: 2.0 },
  },
  [GameModifier.WEALTHY_START]: {
    id: GameModifier.WEALTHY_START,
    label: 'Head Start',
    description: 'Start with 2x gold (score penalty)',
    scoreBonus: -0.2,
    effects: { startingGoldMultiplier: 2.0 },
  },
};

/** Minimum score multiplier floor to prevent negative/zero scores */
const MIN_SCORE_MULTIPLIER = 0.1;

/**
 * Calculate total score multiplier from active modifiers.
 * Returns 1.0 + sum of all active modifier score bonuses,
 * floored at MIN_SCORE_MULTIPLIER to prevent negative scores.
 */
export function calculateModifierScoreMultiplier(activeModifiers: Set<GameModifier>): number {
  let bonus = 0;
  for (const mod of activeModifiers) {
    bonus += GAME_MODIFIER_CONFIGS[mod].scoreBonus;
  }
  return Math.max(MIN_SCORE_MULTIPLIER, 1.0 + bonus);
}

/**
 * Merge all active modifier effects into a single ModifierEffects object.
 * Numeric multipliers stack multiplicatively; boolean flags use logical OR.
 */
export function mergeModifierEffects(activeModifiers: Set<GameModifier>): ModifierEffects {
  const merged: ModifierEffects = {};
  for (const mod of activeModifiers) {
    const effects = GAME_MODIFIER_CONFIGS[mod].effects;
    if (effects.enemyHealthMultiplier !== undefined) {
      merged.enemyHealthMultiplier = (merged.enemyHealthMultiplier ?? 1) * effects.enemyHealthMultiplier;
    }
    if (effects.enemySpeedMultiplier !== undefined) {
      merged.enemySpeedMultiplier = (merged.enemySpeedMultiplier ?? 1) * effects.enemySpeedMultiplier;
    }
    if (effects.towerCostMultiplier !== undefined) {
      merged.towerCostMultiplier = (merged.towerCostMultiplier ?? 1) * effects.towerCostMultiplier;
    }
    if (effects.towerDamageMultiplier !== undefined) {
      merged.towerDamageMultiplier = (merged.towerDamageMultiplier ?? 1) * effects.towerDamageMultiplier;
    }
    if (effects.waveCountMultiplier !== undefined) {
      merged.waveCountMultiplier = (merged.waveCountMultiplier ?? 1) * effects.waveCountMultiplier;
    }
    if (effects.startingGoldMultiplier !== undefined) {
      merged.startingGoldMultiplier = (merged.startingGoldMultiplier ?? 1) * effects.startingGoldMultiplier;
    }
    if (effects.disableInterest) {
      merged.disableInterest = true;
    }
  }
  return merged;
}
