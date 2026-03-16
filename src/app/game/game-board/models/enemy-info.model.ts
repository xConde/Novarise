import { EnemyType, ENEMY_STATS } from './enemy.model';

export interface EnemyInfo {
  type: EnemyType;
  name: string;
  description: string;
  health: number;
  speed: number;
  reward: number;
  leakDamage: number;
  special: string | null;  // special ability description
  color: number;           // hex color for display
  immunities: string[];    // e.g., ['Slow'] for Flying
}

/** Pre-computed enemy info cards for all enemy types */
export const ENEMY_INFO: Record<EnemyType, EnemyInfo> = {
  [EnemyType.BASIC]: {
    type: EnemyType.BASIC,
    name: 'Basic',
    description: 'Standard enemy. No special abilities.',
    health: ENEMY_STATS[EnemyType.BASIC].health,
    speed: ENEMY_STATS[EnemyType.BASIC].speed,
    reward: ENEMY_STATS[EnemyType.BASIC].value,
    leakDamage: ENEMY_STATS[EnemyType.BASIC].leakDamage,
    special: null,
    color: ENEMY_STATS[EnemyType.BASIC].color,
    immunities: [],
  },
  [EnemyType.FAST]: {
    type: EnemyType.FAST,
    name: 'Fast',
    description: 'Quick and fragile. Rushes past slow defenses.',
    health: ENEMY_STATS[EnemyType.FAST].health,
    speed: ENEMY_STATS[EnemyType.FAST].speed,
    reward: ENEMY_STATS[EnemyType.FAST].value,
    leakDamage: ENEMY_STATS[EnemyType.FAST].leakDamage,
    special: 'High speed',
    color: ENEMY_STATS[EnemyType.FAST].color,
    immunities: [],
  },
  [EnemyType.HEAVY]: {
    type: EnemyType.HEAVY,
    name: 'Heavy',
    description: 'Slow but extremely tough.',
    health: ENEMY_STATS[EnemyType.HEAVY].health,
    speed: ENEMY_STATS[EnemyType.HEAVY].speed,
    reward: ENEMY_STATS[EnemyType.HEAVY].value,
    leakDamage: ENEMY_STATS[EnemyType.HEAVY].leakDamage,
    special: 'High health, 2 leak damage',
    color: ENEMY_STATS[EnemyType.HEAVY].color,
    immunities: [],
  },
  [EnemyType.SWIFT]: {
    type: EnemyType.SWIFT,
    name: 'Swift',
    description: 'Balanced speed and durability.',
    health: ENEMY_STATS[EnemyType.SWIFT].health,
    speed: ENEMY_STATS[EnemyType.SWIFT].speed,
    reward: ENEMY_STATS[EnemyType.SWIFT].value,
    leakDamage: ENEMY_STATS[EnemyType.SWIFT].leakDamage,
    special: 'Moderate speed',
    color: ENEMY_STATS[EnemyType.SWIFT].color,
    immunities: [],
  },
  [EnemyType.BOSS]: {
    type: EnemyType.BOSS,
    name: 'Boss',
    description: 'Massive enemy with enormous health.',
    health: ENEMY_STATS[EnemyType.BOSS].health,
    speed: ENEMY_STATS[EnemyType.BOSS].speed,
    reward: ENEMY_STATS[EnemyType.BOSS].value,
    leakDamage: ENEMY_STATS[EnemyType.BOSS].leakDamage,
    special: '3 leak damage, crown visual',
    color: ENEMY_STATS[EnemyType.BOSS].color,
    immunities: [],
  },
  [EnemyType.SHIELDED]: {
    type: EnemyType.SHIELDED,
    name: 'Shielded',
    description: 'Protected by an energy shield that absorbs damage.',
    health: ENEMY_STATS[EnemyType.SHIELDED].health,
    speed: ENEMY_STATS[EnemyType.SHIELDED].speed,
    reward: ENEMY_STATS[EnemyType.SHIELDED].value,
    leakDamage: ENEMY_STATS[EnemyType.SHIELDED].leakDamage,
    special: 'Shield absorbs first 60 damage',
    color: ENEMY_STATS[EnemyType.SHIELDED].color,
    immunities: [],
  },
  [EnemyType.SWARM]: {
    type: EnemyType.SWARM,
    name: 'Swarm',
    description: 'Splits into 3 mini-swarms on death.',
    health: ENEMY_STATS[EnemyType.SWARM].health,
    speed: ENEMY_STATS[EnemyType.SWARM].speed,
    reward: ENEMY_STATS[EnemyType.SWARM].value,
    leakDamage: ENEMY_STATS[EnemyType.SWARM].leakDamage,
    special: 'Spawns 3 mini-swarms',
    color: ENEMY_STATS[EnemyType.SWARM].color,
    immunities: [],
  },
  [EnemyType.FLYING]: {
    type: EnemyType.FLYING,
    name: 'Flying',
    description: 'Hovers above terrain, ignoring ground obstacles.',
    health: ENEMY_STATS[EnemyType.FLYING].health,
    speed: ENEMY_STATS[EnemyType.FLYING].speed,
    reward: ENEMY_STATS[EnemyType.FLYING].value,
    leakDamage: ENEMY_STATS[EnemyType.FLYING].leakDamage,
    special: 'Ignores pathing',
    color: ENEMY_STATS[EnemyType.FLYING].color,
    immunities: ['Slow'],
  },
};
