import * as THREE from 'three';
import { TowerType } from '../models/tower.model';
import { MaterialRegistryService } from './material-registry.service';

// ── Per-type material configurations ─────────────────────────────────────────

interface TowerMaterialConfig {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  transparent?: boolean;
  opacity?: number;
}

// Each tower body is desaturated and dimmed so it reads as "powered equipment
// placed in the scene" rather than a neon UI sprite, matching the cool
// deep-space board palette. Hue per type is preserved for at-a-glance
// distinguishability; saturation drops roughly 25–40% and emissiveIntensity
// drops to ~0.4 so towers no longer over-bloom against the dark board.
export const TOWER_MATERIAL_CONFIGS: Readonly<Record<TowerType, TowerMaterialConfig>> = {
  [TowerType.BASIC]:  { color: 0x9a6238, emissive: 0x5a3a18, emissiveIntensity: 0.4,  metalness: 0.3,  roughness: 0.6 },
  [TowerType.SNIPER]: { color: 0x6a5290, emissive: 0x3e2c5c, emissiveIntensity: 0.45, metalness: 0.4,  roughness: 0.4 },
  [TowerType.SPLASH]: { color: 0x3e8a5a, emissive: 0x205038, emissiveIntensity: 0.4,  metalness: 0.25, roughness: 0.7 },
  [TowerType.SLOW]:   { color: 0x4870b8, emissive: 0x1c3470, emissiveIntensity: 0.45, metalness: 0.5,  roughness: 0.3, transparent: true, opacity: 0.9 },
  [TowerType.CHAIN]:  { color: 0xa88840, emissive: 0x6a4a08, emissiveIntensity: 0.4,  metalness: 0.6,  roughness: 0.2 },
  [TowerType.MORTAR]: { color: 0x664422, emissive: 0x442200, emissiveIntensity: 0.3,  metalness: 0.7,  roughness: 0.5 },
};

export const DEFAULT_TOWER_MATERIAL_CONFIG: TowerMaterialConfig = {
  color: 0x9a6238, emissive: 0x4a2e10, emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.6,
};

// ── Factory function ──────────────────────────────────────────────────────────

/**
 * Build a MeshStandardMaterial for the given tower type, optionally going
 * through a MaterialRegistryService for cache sharing.
 *
 * When `registry` is provided, subsequent calls with the same `towerType`
 * return the same material instance — no duplicate GPU allocations.
 * When `registry` is absent (e.g. in tests without the full DI tree),
 * a fresh material is allocated each call.
 */
export function createTowerMaterial(
  towerType: TowerType,
  registry?: MaterialRegistryService,
): THREE.MeshStandardMaterial {
  const cfg = TOWER_MATERIAL_CONFIGS[towerType] ?? DEFAULT_TOWER_MATERIAL_CONFIG;
  if (registry) {
    return registry.getOrCreate(
      `tower:${towerType}`,
      () => new THREE.MeshStandardMaterial({ ...cfg }),
    );
  }
  return new THREE.MeshStandardMaterial({ ...cfg });
}
