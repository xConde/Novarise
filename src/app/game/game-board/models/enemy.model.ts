import * as THREE from 'three';

import { EnemyType } from '@core/models/enemy-type.model';
export { EnemyType };

export interface GridNode {
  x: number; // column
  y: number; // row
  f: number; // total cost (g + h)
  g: number; // distance from start
  h: number; // heuristic to end
  parent?: GridNode;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  position: { x: number, y: number, z: number }; // World position
  gridPosition: { row: number, col: number }; // Grid position
  health: number;
  maxHealth: number;
  speed: number; // Units per second
  value: number; // Currency reward when killed
  path: GridNode[];
  pathIndex: number;
  distanceTraveled: number;
  mesh?: THREE.Mesh; // 3D mesh representation
  leakDamage: number; // Lives lost when this enemy reaches the exit
  shield?: number;    // Current shield HP (SHIELDED type only)
  maxShield?: number; // Starting shield HP (SHIELDED type only)
  isMiniSwarm?: boolean; // True for mini-enemies spawned by SWARM death — prevents recursive spawning
  isFlying?: boolean; // True for FLYING type — ignores terrain, immune to slow
  needsRepath?: boolean; // Flagged when board changes — repath on next waypoint arrival
  dying?: boolean;     // True while the death shrink-fade animation is playing
  dyingTimer?: number; // Seconds remaining in the death animation (counts down to 0)
  hitFlashTimer?: number; // Seconds remaining in the hit-flash animation (counts down to 0)
  shieldBreaking?: boolean;    // True while the shield break animation is playing
  shieldBreakTimer?: number;   // Seconds remaining in the shield break animation (counts down to 0)
  statusParticles?: THREE.Mesh[]; // Small particle meshes for active status effect visuals
  statusParticleEffectType?: string; // Tracks which effect type the current particles belong to
}

export interface EnemyStats {
  health: number;
  /** Cosmetic only — used for mesh/modifier display and SLOW mutation. Actual movement is driven by `tilesPerTurn`. */
  speed: number;
  /** Integer tiles this enemy advances per turn. Replaces the hardcoded FAST/SWIFT type-switch. */
  tilesPerTurn: number;
  value: number;
  color: number; // Hex color for mesh
  size: number; // Sphere radius
  leakDamage: number; // Lives lost when this enemy reaches the exit
  maxShield?: number;   // Starting shield HP (SHIELDED type only)
  spawnOnDeath?: number; // Number of mini-enemies to spawn on death (SWARM type only)
}

// Enemy type statistics
export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  [EnemyType.BASIC]: {
    health: 100,
    speed: 2.0,
    tilesPerTurn: 1,
    value: 10,
    color: 0xff0000, // Red
    size: 0.3,
    leakDamage: 1
  },
  [EnemyType.FAST]: {
    health: 50,
    speed: 4.0,
    tilesPerTurn: 2,
    value: 15,
    color: 0xffff00, // Yellow
    size: 0.25,
    leakDamage: 1
  },
  [EnemyType.HEAVY]: {
    health: 300,
    speed: 1.0,
    tilesPerTurn: 1,
    value: 30,
    color: 0x0000ff, // Blue
    size: 0.4,
    leakDamage: 2
  },
  [EnemyType.SWIFT]: {
    health: 80,
    speed: 3.0,
    tilesPerTurn: 2,
    value: 20,
    color: 0x00ffff, // Cyan
    size: 0.3,
    leakDamage: 1
  },
  [EnemyType.BOSS]: {
    health: 1000,
    speed: 0.5,
    tilesPerTurn: 1,
    value: 100,
    color: 0xff00ff, // Magenta
    size: 0.6,
    leakDamage: 3
  },
  [EnemyType.SHIELDED]: {
    health: 120,
    speed: 1.2,
    tilesPerTurn: 1,
    value: 25,
    color: 0x4444ff, // Blue
    size: 0.35,
    leakDamage: 2,
    maxShield: 60
  },
  [EnemyType.SWARM]: {
    health: 40,
    speed: 2.5,
    tilesPerTurn: 2,
    value: 8,
    color: 0xaaaa00, // Yellow-green
    size: 0.25,
    leakDamage: 1,
    spawnOnDeath: 3
  },
  [EnemyType.FLYING]: {
    health: 60,
    speed: 2.5,
    tilesPerTurn: 1,
    value: 20,
    color: 0x88ccff, // Light blue
    size: 0.3,
    leakDamage: 1
  }
};

/** Y-position (world height) for flying enemies hovering above ground. */
export const FLYING_ENEMY_HEIGHT = 1.5;

/** Minimum enemy speed after all modifier/effect application — prevents zero or negative speed. */
export const MIN_ENEMY_SPEED = 0.1;

/** Sphere geometry segments for enemy mesh rendering. */
export const ENEMY_MESH_SEGMENTS = 16;
export const MINI_SWARM_MESH_SEGMENTS = 12;

/** Stats for mini-enemies spawned when a SWARM enemy dies. */
export const MINI_SWARM_STATS = {
  health: 15,
  speed: 3,
  tilesPerTurn: 1,
  value: 3,
  color: 0xaaaa00, // Same yellow-green as parent
  size: 0.15,
  leakDamage: 1
} as const;

/**
 * Result returned by {@link EnemyService.damageEnemy}.
 * `killed` is true when the hit reduces health to 0 or below.
 * `spawnedEnemies` is non-empty only when a SWARM parent dies; the caller
 * must add each entry's mesh to the Three.js scene.
 */
export interface DamageResult {
  killed: boolean;
  spawnedEnemies: Enemy[];
}
