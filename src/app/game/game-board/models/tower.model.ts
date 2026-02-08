import * as THREE from 'three';

export enum TowerType {
  BASIC = 'basic',
  SNIPER = 'sniper',
  SPLASH = 'splash'
}

export interface TowerStats {
  damage: number;
  range: number;        // tiles
  fireRate: number;     // seconds between shots
  cost: number;
  projectileSpeed: number; // tiles per second
  splashRadius: number; // tiles, 0 for single-target
  color: number;        // hex color for projectile
}

export interface PlacedTower {
  id: string;
  type: TowerType;
  row: number;
  col: number;
  lastFireTime: number; // elapsed game time of last shot
  kills: number;
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
  }
};
