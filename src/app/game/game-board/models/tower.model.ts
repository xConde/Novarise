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
  mesh: THREE.Group | null;
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
    fireRate: 3.0,   // Slow-firing artillery
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
  { damage: 1.0,  range: 1.0,  fireRate: 1.0  },  // Level 1 (base)
  { damage: 1.5,  range: 1.15, fireRate: 0.85 },   // Level 2 (+50% dmg, +15% range, 15% faster)
  { damage: 2.2,  range: 1.3,  fireRate: 0.7  },   // Level 3 (+120% dmg, +30% range, 30% faster)
];

/** Get the upgrade cost from current level to next level.
 *  Level 1→2: 75% of base cost; Level 2→3: 100% of base cost. */
export function getUpgradeCost(type: TowerType, currentLevel: number): number {
  if (currentLevel < 1 || currentLevel >= MAX_TOWER_LEVEL) return Infinity;
  const baseCost = TOWER_CONFIGS[type].cost;
  return Math.round(baseCost * (0.5 + currentLevel * 0.25));
}

/** Get the sell refund (50% of total gold invested). */
export function getSellValue(totalInvested: number): number {
  return Math.round(totalInvested * 0.5);
}

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
