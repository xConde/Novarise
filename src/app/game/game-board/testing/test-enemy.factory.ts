import { Enemy, EnemyType, ENEMY_STATS } from '../models/enemy.model';

/**
 * Create a test Enemy object with sensible defaults.
 * Use for unit tests that need Enemy instances without full service setup.
 */
export function createTestEnemy(
  id: string,
  x: number = 0,
  z: number = 0,
  health: number = 100,
  options?: {
    type?: EnemyType;
    speed?: number;
    isFlying?: boolean;
    isMiniSwarm?: boolean;
  }
): Enemy {
  const type = options?.type ?? EnemyType.BASIC;
  const stats = ENEMY_STATS[type];
  return {
    id,
    type,
    position: { x, y: 0.3, z },
    gridPosition: { row: Math.round(z), col: Math.round(x) },
    health,
    maxHealth: health,
    speed: options?.speed ?? stats.speed,
    value: stats.value,
    leakDamage: stats.leakDamage ?? 1,
    path: [],
    pathIndex: 0,
    distanceTraveled: 0,
    isFlying: options?.isFlying ?? false,
    isMiniSwarm: options?.isMiniSwarm ?? false,
  };
}
