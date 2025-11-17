import * as THREE from 'three';

export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  HEAVY = 'HEAVY',
  FLYING = 'FLYING',
  BOSS = 'BOSS'
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
}

export interface EnemyStats {
  health: number;
  speed: number;
  value: number;
  color: number; // Hex color for mesh
  size: number; // Sphere radius
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
  [EnemyType.FLYING]: {
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
  }
};
