import * as THREE from 'three';
import { StatusEffectType } from '../constants/status-effect.constants';

export type TargetingMode = 'nearest' | 'first' | 'strongest';
export const TARGETING_MODES: TargetingMode[] = ['nearest', 'first', 'strongest'];
export const DEFAULT_TARGETING_MODE: TargetingMode = 'nearest';

export const TARGETING_MODE_LABELS: Record<TargetingMode, string> = {
  nearest: 'Nearest',
  first: 'First',
  strongest: 'Strongest',
};

export enum TowerType {
  BASIC = 'basic',
  SNIPER = 'sniper',
  SPLASH = 'splash',
  SLOW = 'slow',
  CHAIN = 'chain',
  MORTAR = 'mortar'
}

export enum TowerSpecialization {
  ALPHA = 'alpha',
  BETA = 'beta',
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
  slowFactor?: number;    // Speed reduction multiplier (0.5 = 50% of base speed)
  slowDuration?: number;  // Duration of slow effect in seconds
  // Chain lightning tower
  chainCount?: number;    // Number of chain bounces after primary target
  chainRange?: number;    // World-unit radius to find next chain target
  // Mortar tower
  blastRadius?: number;   // Area-of-effect radius for mortar zones
  dotDuration?: number;   // How long the mortar zone persists (seconds)
  dotDamage?: number;     // Damage per second dealt by mortar zone
  // Status effects
  statusEffect?: StatusEffectType; // Applied to enemies on hit
}

export interface SpecializationStats {
  label: string;
  description: string;
  damage: number;          // Multiplier on base damage at L3
  range: number;           // Multiplier on base range at L3
  fireRate: number;        // Multiplier on base fireRate at L3 (lower = faster)
  splashRadiusBonus?: number;
  chainCountBonus?: number;
  slowFactorOverride?: number;
  dotDamageMultiplier?: number;
  statusEffect?: StatusEffectType; // Overrides/adds status effect at L3 spec
}

export interface PlacedTower {
  id: string;
  type: TowerType;
  level: number;        // 1-3
  row: number;
  col: number;
  lastFireTime: number; // elapsed game time of last shot
  kills: number;
  totalInvested: number; // cumulative gold spent (placement + upgrades)
  targetingMode: TargetingMode;
  mesh: THREE.Group | null;
  specialization?: TowerSpecialization; // Set when upgraded to L3
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
    damage: 80,
    range: 6,
    fireRate: 2.5,
    cost: 125,
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
    fireRate: 0.5,   // Aura pulse interval; not used for projectile fire rate
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
    cost: 120,
    projectileSpeed: 12,
    splashRadius: 0,
    color: 0xffdd00,
    chainCount: 3,
    chainRange: 2
  },
  [TowerType.MORTAR]: {
    damage: 8,
    range: 4,
    fireRate: 3.0,   // Slow-firing artillery
    cost: 140,
    projectileSpeed: 4,
    splashRadius: 0,
    color: 0xff6622,
    blastRadius: 1.5,
    dotDuration: 3,
    dotDamage: 5,
    statusEffect: StatusEffectType.BURN
  }
};

export const TOWER_SPECIALIZATIONS: Record<TowerType, Record<TowerSpecialization, SpecializationStats>> = {
  [TowerType.BASIC]: {
    [TowerSpecialization.ALPHA]: {
      label: 'Marksman',
      description: 'High damage, slight range boost',
      damage: 3.0, range: 1.2, fireRate: 0.8,
    },
    [TowerSpecialization.BETA]: {
      label: 'Rapid',
      description: 'Much faster fire rate, wider range',
      damage: 1.8, range: 1.5, fireRate: 0.5,
    },
  },
  [TowerType.SNIPER]: {
    [TowerSpecialization.ALPHA]: {
      label: 'Assassin',
      description: 'Extreme damage, very long range',
      damage: 3.5, range: 1.5, fireRate: 0.75,
    },
    [TowerSpecialization.BETA]: {
      label: 'Sharpshooter',
      description: 'Fast semi-auto, moderate range',
      damage: 2.0, range: 1.2, fireRate: 0.45,
    },
  },
  [TowerType.SPLASH]: {
    [TowerSpecialization.ALPHA]: {
      label: 'Bombardier',
      description: 'Larger blast, more damage, poisons targets',
      damage: 2.8, range: 1.2, fireRate: 0.8,
      splashRadiusBonus: 0.5,
      statusEffect: StatusEffectType.POISON,
    },
    [TowerSpecialization.BETA]: {
      label: 'Suppressor',
      description: 'Rapid small explosions, wider range',
      damage: 1.8, range: 1.5, fireRate: 0.5,
    },
  },
  [TowerType.SLOW]: {
    [TowerSpecialization.ALPHA]: {
      label: 'Glacier',
      description: 'Stronger slow effect, wider range',
      damage: 1.0, range: 1.5, fireRate: 1.0,
      slowFactorOverride: 0.3,
    },
    [TowerSpecialization.BETA]: {
      label: 'Frostbite',
      description: 'Faster pulse rate, extended range',
      damage: 1.0, range: 1.3, fireRate: 0.7,
    },
  },
  [TowerType.CHAIN]: {
    [TowerSpecialization.ALPHA]: {
      label: 'Tesla',
      description: 'More bounces, longer chain range, burns targets',
      damage: 2.0, range: 1.2, fireRate: 0.8,
      chainCountBonus: 2,
      statusEffect: StatusEffectType.BURN,
    },
    [TowerSpecialization.BETA]: {
      label: 'Arc',
      description: 'Faster arcs, higher damage per hit',
      damage: 2.8, range: 1.3, fireRate: 0.5,
    },
  },
  [TowerType.MORTAR]: {
    [TowerSpecialization.ALPHA]: {
      label: 'Siege',
      description: 'Larger zones, stronger DoT',
      damage: 2.5, range: 1.2, fireRate: 0.85,
      dotDamageMultiplier: 2.0,
    },
    [TowerSpecialization.BETA]: {
      label: 'Barrage',
      description: 'Faster firing, more zones active',
      damage: 1.8, range: 1.3, fireRate: 0.5,
    },
  },
};

/** Per-level stat multipliers. Index 0 = level 1 (base), 1 = level 2, 2 = level 3. */
export const UPGRADE_MULTIPLIERS: { damage: number; range: number; fireRate: number }[] = [
  { damage: 1.0,  range: 1.0,  fireRate: 1.0  },  // Level 1 (base)
  { damage: 1.5,  range: 1.15, fireRate: 0.85 },   // Level 2 (+50% dmg, +15% range, 15% faster)
  { damage: 2.2,  range: 1.3,  fireRate: 0.7  },   // Level 3 (+120% dmg, +30% range, 30% faster)
];

/** Get the upgrade cost from current level to next level.
 *  Level 1→2: 75% of base cost; Level 2→3: 100% of base cost. */
export function getUpgradeCost(type: TowerType, currentLevel: number, costMultiplier: number = 1): number {
  if (currentLevel < 1 || currentLevel >= MAX_TOWER_LEVEL) return Infinity;
  const baseCost = TOWER_CONFIGS[type].cost;
  return Math.round(baseCost * (UPGRADE_COST_CONFIG.baseMultiplier + currentLevel * UPGRADE_COST_CONFIG.levelScale) * costMultiplier);
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

/** Resolve effective stats for a tower at a given level (clamped to 1..MAX_TOWER_LEVEL).
 *  At MAX_TOWER_LEVEL with a specialization, uses spec multipliers instead of standard L3. */
export function getEffectiveStats(type: TowerType, level: number, specialization?: TowerSpecialization): TowerStats {
  const base = TOWER_CONFIGS[type];

  if (level >= MAX_TOWER_LEVEL && specialization) {
    const spec = TOWER_SPECIALIZATIONS[type][specialization];
    const result: TowerStats = {
      ...base,
      damage: Math.round(base.damage * spec.damage),
      range: +(base.range * spec.range).toFixed(2),
      fireRate: +(base.fireRate * spec.fireRate).toFixed(2),
    };
    if (spec.splashRadiusBonus && result.splashRadius) {
      result.splashRadius += spec.splashRadiusBonus;
    }
    if (spec.chainCountBonus && result.chainCount) {
      result.chainCount += spec.chainCountBonus;
    }
    if (spec.slowFactorOverride !== undefined) {
      result.slowFactor = spec.slowFactorOverride;
    }
    if (spec.dotDamageMultiplier && result.dotDamage) {
      result.dotDamage = Math.round(result.dotDamage * spec.dotDamageMultiplier);
    }
    if (spec.statusEffect) {
      result.statusEffect = spec.statusEffect;
    }
    return result;
  }

  const clampedIndex = Math.max(0, Math.min(level, MAX_TOWER_LEVEL) - 1);
  const mult = UPGRADE_MULTIPLIERS[clampedIndex];
  return {
    ...base,
    damage: Math.round(base.damage * mult.damage),
    range: +(base.range * mult.range).toFixed(2),
    fireRate: +(base.fireRate * mult.fireRate).toFixed(2),
  };
}
