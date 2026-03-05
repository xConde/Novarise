import * as THREE from 'three';

export enum TowerType {
  BASIC = 'basic',
  SNIPER = 'sniper',
  SPLASH = 'splash',
  SLOW = 'slow',
  CHAIN = 'chain',
  MORTAR = 'mortar'
}

export const MAX_TOWER_LEVEL = 3;

export const UPGRADE_COST_CONFIG = {
  baseMultiplier: 0.5,
  levelScale: 0.25,
} as const;

export const SELL_REFUND_RATE = 0.5;

export interface TowerStats {
  damage: number;
  range: number;        // tiles
  fireRate: number;     // seconds between shots
  cost: number;
  projectileSpeed: number; // tiles per second
  splashRadius: number; // tiles, 0 for single-target
  color: number;        // hex color for projectile
  // Slow tower
  slowFactor?: number;
  slowDuration?: number;
  // Chain lightning tower
  chainCount?: number;
  chainRange?: number;
  // Mortar tower
  blastRadius?: number;
  dotDuration?: number;
  dotDamage?: number;
}

export interface TowerAbility {
  name: string;
  description: string;
  cooldown: number; // seconds
  duration: number; // seconds (0 for instant / next-shot)
}

export const TOWER_ABILITIES: Record<TowerType, TowerAbility> = {
  [TowerType.BASIC]: {
    name: 'Rapid Fire',
    description: 'Doubles fire rate for 5 seconds',
    cooldown: 20,
    duration: 5,
  },
  [TowerType.SNIPER]: {
    name: 'Overcharge',
    description: 'Next shot deals 3x damage',
    cooldown: 15,
    duration: 0,
  },
  [TowerType.SPLASH]: {
    name: 'Napalm',
    description: 'Next shot leaves a burning area for 5 seconds',
    cooldown: 25,
    duration: 0,
  },
  [TowerType.SLOW]: {
    name: 'Freeze',
    description: 'Completely stops all enemies in range for 3 seconds',
    cooldown: 30,
    duration: 3,
  },
  [TowerType.CHAIN]: {
    name: 'Overload',
    description: 'Next chain bounces to 6 targets instead of 3',
    cooldown: 20,
    duration: 0,
  },
  [TowerType.MORTAR]: {
    name: 'Barrage',
    description: 'Fires 3 mortars in quick succession',
    cooldown: 25,
    duration: 0,
  },
};

/** Constants for ability mechanics to avoid magic numbers. */
export const ABILITY_CONFIG = {
  rapidFireMultiplier: 0.5,
  overchargeMultiplier: 3,
  overloadChainCount: 6,
  barrageCharges: 3,
  barrageFireRate: 0.3,
  napalmDotDuration: 5,
  freezeSpeedFactor: 0,
  /** Fraction of projectile damage used as napalm zone DoT damage per tick. */
  napalmDotDamageFraction: 0.5,
} as const;

export const enum TargetingPriority {
  FIRST = 0,     // Closest to exit (most distanceTraveled)
  LAST = 1,      // Farthest from exit (least distanceTraveled)
  STRONGEST = 2, // Most current HP
  WEAKEST = 3    // Least current HP
}

export const TARGETING_LABELS: Record<TargetingPriority, string> = {
  [TargetingPriority.FIRST]: 'First',
  [TargetingPriority.LAST]: 'Last',
  [TargetingPriority.STRONGEST]: 'Strong',
  [TargetingPriority.WEAKEST]: 'Weak',
};

export const TARGETING_PRIORITIES = [
  TargetingPriority.FIRST,
  TargetingPriority.LAST,
  TargetingPriority.STRONGEST,
  TargetingPriority.WEAKEST,
] as const;

export interface PlacedTower {
  id: string;
  type: TowerType;
  level: number;        // 1-3
  row: number;
  col: number;
  lastFireTime: number; // elapsed game time of last shot
  kills: number;
  totalInvested: number; // cumulative gold spent (placement + upgrades)
  mesh: THREE.Group | null;
  abilityCooldownEnd: number;  // gameTime when ability becomes available again (0 = ready)
  abilityActiveEnd: number;    // gameTime when active ability effect expires (0 = not active)
  abilityCharges: number;      // remaining charges for multi-shot abilities like Barrage
  abilityPrimed: boolean;      // true when a next-shot ability is pending
  targetingPriority: TargetingPriority; // which enemies this tower prefers to target
}

export const TOWER_CONFIGS: Record<TowerType, TowerStats> = {
  [TowerType.BASIC]: {
    damage: 25,
    range: 3,
    fireRate: 1.0,
    cost: 50,
    projectileSpeed: 8,
    splashRadius: 0,
    color: 0xd47a3a
  },
  [TowerType.SNIPER]: {
    damage: 100,
    range: 6,
    fireRate: 2.5,
    cost: 100,
    projectileSpeed: 15,
    splashRadius: 0,
    color: 0x7a5ac4
  },
  [TowerType.SPLASH]: {
    damage: 15,
    range: 3.5,
    fireRate: 1.5,
    cost: 75,
    projectileSpeed: 6,
    splashRadius: 1.5,
    color: 0x4ac47a
  },
  [TowerType.SLOW]: {
    damage: 0,
    range: 2.5,
    fireRate: 0.5,
    cost: 75,
    projectileSpeed: 0,
    splashRadius: 0,
    color: 0x4488ff,
    slowFactor: 0.5,
    slowDuration: 2
  },
  [TowerType.CHAIN]: {
    damage: 15,
    range: 3,
    fireRate: 0.8,
    cost: 150,
    projectileSpeed: 12,
    splashRadius: 0,
    color: 0xffdd00,
    chainCount: 3,
    chainRange: 2
  },
  [TowerType.MORTAR]: {
    damage: 8,
    range: 4,
    fireRate: 3.0,
    cost: 200,
    projectileSpeed: 4,
    splashRadius: 0,
    color: 0xff6622,
    blastRadius: 1.5,
    dotDuration: 3,
    dotDamage: 3
  }
};

/** Per-level stat multipliers. Index 0 = level 1 (base), 1 = level 2, 2 = level 3. */
export const UPGRADE_MULTIPLIERS: { damage: number; range: number; fireRate: number }[] = [
  { damage: 1.0,  range: 1.0,  fireRate: 1.0  },
  { damage: 1.5,  range: 1.15, fireRate: 0.85 },
  { damage: 2.2,  range: 1.3,  fireRate: 0.7  },
];

/** Get the upgrade cost from current level to next level. */
export function getUpgradeCost(type: TowerType, currentLevel: number): number {
  if (currentLevel < 1 || currentLevel >= MAX_TOWER_LEVEL) return Infinity;
  const baseCost = TOWER_CONFIGS[type].cost;
  return Math.round(baseCost * (UPGRADE_COST_CONFIG.baseMultiplier + currentLevel * UPGRADE_COST_CONFIG.levelScale));
}

/** Get the sell refund (50% of total gold invested). */
export function getSellValue(totalInvested: number): number {
  return Math.round(totalInvested * SELL_REFUND_RATE);
}

/** One-line description of each tower's special ability, shown in hover tooltips. */
export const TOWER_DESCRIPTIONS: Record<TowerType, string> = {
  [TowerType.BASIC]:  'Balanced all-rounder',
  [TowerType.SNIPER]: 'Long range, high damage, slow fire',
  [TowerType.SPLASH]: 'Area damage in a radius',
  [TowerType.SLOW]:   'Slows enemies, no damage',
  [TowerType.CHAIN]:  'Lightning bounces between enemies',
  [TowerType.MORTAR]: 'Creates damage zones on the ground',
};

/** Resolve effective stats for a tower at a given level (clamped to 1..MAX_TOWER_LEVEL). */
export function getEffectiveStats(type: TowerType, level: number): TowerStats {
  const base = TOWER_CONFIGS[type];
  const clampedIndex = Math.max(0, Math.min(level, MAX_TOWER_LEVEL) - 1);
  const mult = UPGRADE_MULTIPLIERS[clampedIndex];
  return {
    ...base,
    damage: Math.round(base.damage * mult.damage),
    range: +(base.range * mult.range).toFixed(2),
    fireRate: +(base.fireRate * mult.fireRate).toFixed(2),
  };
}
