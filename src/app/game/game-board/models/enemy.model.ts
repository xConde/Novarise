import * as THREE from 'three';

export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  HEAVY = 'HEAVY',
  SWIFT = 'SWIFT',
  BOSS = 'BOSS',
  SHIELDED = 'SHIELDED',
  SWARM = 'SWARM',
  FLYING = 'FLYING',
  HEALER = 'HEALER'
}

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
  shield?: number;    // Current shield HP (SHIELDED type only)
  maxShield?: number; // Starting shield HP (SHIELDED type only)
  isMiniSwarm?: boolean; // True for mini-enemies spawned by SWARM death — prevents recursive spawning
  isFlying?: boolean; // True for FLYING type — ignores terrain, immune to slow
  isHealer?: boolean; // True for HEALER type — periodically restores health to nearby allies
}

export interface EnemyStats {
  health: number;
  speed: number;
  value: number;
  color: number; // Hex color for mesh
  size: number; // Sphere radius
  maxShield?: number;   // Starting shield HP (SHIELDED type only)
  spawnOnDeath?: number; // Number of mini-enemies to spawn on death (SWARM type only)
  healRange?: number;   // Heal radius in tiles (HEALER type only)
  healRate?: number;    // HP per second restored to nearby allies (HEALER type only)
}

// Enemy type statistics
export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  [EnemyType.BASIC]: {
    health: 100,
    speed: 2.0, // tiles per second
    value: 10,
    color: 0xff0000, // Red
    size: 0.3
  },
  [EnemyType.FAST]: {
    health: 50,
    speed: 4.0,
    value: 15,
    color: 0xffff00, // Yellow
    size: 0.25
  },
  [EnemyType.HEAVY]: {
    health: 300,
    speed: 1.0,
    value: 30,
    color: 0x0000ff, // Blue
    size: 0.4
  },
  [EnemyType.SWIFT]: {
    health: 80,
    speed: 3.0,
    value: 20,
    color: 0x00ffff, // Cyan
    size: 0.3
  },
  [EnemyType.BOSS]: {
    health: 1000,
    speed: 0.5,
    value: 100,
    color: 0xff00ff, // Magenta
    size: 0.6
  },
  [EnemyType.SHIELDED]: {
    health: 120,
    speed: 1.2,
    value: 25,
    color: 0x4444ff, // Blue
    size: 0.35,
    maxShield: 60
  },
  [EnemyType.SWARM]: {
    health: 40,
    speed: 2.5,
    value: 8,
    color: 0xaaaa00, // Yellow-green
    size: 0.25,
    spawnOnDeath: 3
  },
  [EnemyType.FLYING]: {
    health: 60,
    speed: 2.5,
    value: 20,
    color: 0x88ccff, // Light blue
    size: 0.3
  },
  [EnemyType.HEALER]: {
    health: 80,
    speed: 1.5,
    value: 35,
    color: 0x22cc44, // Green — healer (distinct from all other colors)
    size: 0.3,
    healRange: 3,
    healRate: 10
  }
};

/** Y-position (world height) for flying enemies hovering above ground. */
export const FLYING_ENEMY_HEIGHT = 1.5;

/** Sphere geometry segments for enemy mesh rendering. */
export const ENEMY_MESH_SEGMENTS = 16;
export const MINI_SWARM_MESH_SEGMENTS = 12;

/** Stats for mini-enemies spawned when a SWARM enemy dies. */
export const MINI_SWARM_STATS = {
  health: 15,
  speed: 3,
  value: 3,
  color: 0xaaaa00, // Same yellow-green as parent
  size: 0.15
} as const;
