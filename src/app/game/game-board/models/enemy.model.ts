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
  /** Turn number when this enemy was spawned. Set only for MINER — drives the 3-turn dig cadence. */
  spawnedOnTurn?: number;
  /** True for UNSHAKEABLE elite — skipped by applyDetour, cannot be rerouted. */
  immuneToDetour?: boolean;
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
  /**
   * Sprint 37 GLIDER — when true, this enemy is immune to elevation-based
   * penalties: the EXPOSED (+25% damage on depressed tiles) bonus is skipped
   * in damageEnemy, and the GRAVITY_WELL movement-skip is bypassed in
   * stepEnemiesOneTurn. Default undefined/false for all other enemies.
   */
  ignoresElevation?: boolean;
  /**
   * Sprint 38 TITAN elite — when true, elevation damage bonuses (VANTAGE_POINT
   * and KING_OF_THE_HILL multipliers) are halved before applying damage in
   * TowerCombatService.fireTurn. Status tick, chain, and card damage bypass.
   * Default undefined/false for all other enemies.
   */
  halvesElevationDamageBonuses?: boolean;
  /**
   * Sprint 39 WYRM_ASCENDANT boss counter — when true, elevation damage bonuses
   * (VANTAGE_POINT and KING_OF_THE_HILL multipliers) are stripped entirely in
   * TowerCombatService.fireTurn, reducing damage to base-without-elevation-bonuses.
   * Range bonuses still apply (boss is immune to damage bonuses, not range bonuses).
   * Status tick, chain, and card damage bypass (same carve-out as TITAN).
   * Default undefined/false for all other enemies.
   */
  immuneToElevationDamageBonuses?: boolean;
}

/** Named constants for UNSHAKEABLE elite stats — no magic numbers inline. */
export const UNSHAKEABLE_STATS = {
  health: 600,
  speed: 0.8,
  tilesPerTurn: 1,
  value: 30,
  color: 0x555555, // Stone gray — reads as heavy / immovable
  size: 0.5,
  leakDamage: 3,
} as const;

/** Named constants for MINER stats — no magic numbers inline. */
export const MINER_STATS = {
  health: 175,
  speed: 1.5,
  tilesPerTurn: 1,
  value: 12,
  color: 0x996633, // Earthy brown
  size: 0.35,
  leakDamage: 1,
} as const;

/** How many turns between MINER dig attempts (cadence: every Nth turn after spawn). */
export const MINER_DIG_INTERVAL_TURNS = 3;

/** Named constants for VEINSEEKER boss-variant stats — no magic numbers inline. */
export const VEINSEEKER_STATS = {
  health: 1000,
  /** Cosmetic only — same as BOSS, reads as heavy/boss-tier. */
  speed: 0.8,
  tilesPerTurn: 1,
  value: 100,
  /** Dark crimson — visually distinct from BOSS magenta and UNSHAKEABLE stone gray. */
  color: 0x6a0f25,
  size: 0.55,
  leakDamage: 5,
} as const;

/**
 * Number of turns after a path mutation during which VEINSEEKER is boosted.
 * When `pathMutationService.wasMutatedInLastTurns(currentTurn, VEINSEEKER_SPEED_BOOST_WINDOW)`
 * returns true, VEINSEEKER advances VEINSEEKER_BOOSTED_TILES_PER_TURN instead of its base 1.
 *
 * Design doc reference: archetype-depth plan, VEINSEEKER boss — "path modified in
 * past 3 turns → +30% speed", simplified to an integer tile bump (1→2 tiles/turn).
 */
export const VEINSEEKER_SPEED_BOOST_WINDOW = 3;

/**
 * Boosted tiles-per-turn for VEINSEEKER when the path was mutated recently.
 * Base is 1 (same as BOSS); this doubles movement when the Cartographer archetype
 * is active and reshaping the board.
 */
export const VEINSEEKER_BOOSTED_TILES_PER_TURN = 2;

/** Named constants for GLIDER stats — sprint 37 Highground archetype. */
export const GLIDER_STATS = {
  health: 80,
  speed: 2.5,
  tilesPerTurn: 2,
  value: 12,
  /** Pale sky blue — reads as low-altitude, aerodynamic. */
  color: 0xaaddff,
  size: 0.28,
  leakDamage: 1,
} as const;

/** Named constants for WYRM_ASCENDANT boss-counter stats — sprint 39 Highground archetype. */
export const WYRM_ASCENDANT_STATS = {
  /** High HP — boss-tier bulk, slower than BOSS to compensate for damage immunity. */
  health: 1400,
  /** Slow but relentless — cosmetic speed hint; movement driven by tilesPerTurn. */
  speed: 0.6,
  tilesPerTurn: 1,
  value: 120,
  /**
   * Deep violet — visually distinct from BOSS magenta, VEINSEEKER crimson, and
   * UNSHAKEABLE stone gray. The purple hue reinforces "anti-magic / immunity" theme.
   */
  color: 0x4b0082,
  /** Larger than BOSS — imposing, commands attention. */
  size: 0.70,
  leakDamage: 6,
} as const;

/** Named constants for TITAN elite stats — sprint 38 Highground archetype. */
export const TITAN_STATS = {
  /** 3× BASIC health — heavy, elite-tier bulk. */
  health: 300,
  speed: 0.9,
  tilesPerTurn: 1,
  value: 35,
  /** Burnished bronze — visually distinct from BOSS magenta and UNSHAKEABLE stone gray. */
  color: 0xb87333,
  size: 0.52,
  leakDamage: 3,
} as const;

// Enemy type statistics
export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  [EnemyType.BASIC]: {
    health: 100,
    speed: 2.0,
    tilesPerTurn: 1,
    value: 5,
    color: 0xff0000, // Red
    size: 0.3,
    leakDamage: 1
  },
  [EnemyType.FAST]: {
    health: 50,
    speed: 4.0,
    tilesPerTurn: 2,
    value: 8,
    color: 0xffff00, // Yellow
    size: 0.25,
    leakDamage: 1
  },
  [EnemyType.HEAVY]: {
    health: 300,
    speed: 1.0,
    tilesPerTurn: 1,
    value: 15,
    color: 0x0000ff, // Blue
    size: 0.4,
    leakDamage: 2
  },
  [EnemyType.SWIFT]: {
    health: 80,
    speed: 3.0,
    tilesPerTurn: 2,
    value: 10,
    color: 0x00ffff, // Cyan
    size: 0.3,
    leakDamage: 1
  },
  [EnemyType.BOSS]: {
    health: 1000,
    speed: 0.5,
    tilesPerTurn: 1,
    value: 50,
    color: 0xff00ff, // Magenta
    size: 0.6,
    leakDamage: 3
  },
  [EnemyType.SHIELDED]: {
    health: 120,
    speed: 1.2,
    tilesPerTurn: 1,
    value: 13,
    color: 0x4444ff, // Blue
    size: 0.35,
    leakDamage: 2,
    maxShield: 60
  },
  [EnemyType.SWARM]: {
    health: 40,
    speed: 2.5,
    tilesPerTurn: 2,
    value: 4,
    color: 0xaaaa00, // Yellow-green
    size: 0.25,
    leakDamage: 1,
    spawnOnDeath: 3
  },
  [EnemyType.FLYING]: {
    health: 60,
    speed: 2.5,
    tilesPerTurn: 1,
    value: 10,
    color: 0x88ccff, // Light blue
    size: 0.3,
    leakDamage: 1
  },
  [EnemyType.MINER]: {
    health: MINER_STATS.health,
    speed: MINER_STATS.speed,
    tilesPerTurn: MINER_STATS.tilesPerTurn,
    value: MINER_STATS.value,
    color: MINER_STATS.color,
    size: MINER_STATS.size,
    leakDamage: MINER_STATS.leakDamage,
  },
  [EnemyType.UNSHAKEABLE]: {
    health: UNSHAKEABLE_STATS.health,
    speed: UNSHAKEABLE_STATS.speed,
    tilesPerTurn: UNSHAKEABLE_STATS.tilesPerTurn,
    value: UNSHAKEABLE_STATS.value,
    color: UNSHAKEABLE_STATS.color,
    size: UNSHAKEABLE_STATS.size,
    leakDamage: UNSHAKEABLE_STATS.leakDamage,
  },
  [EnemyType.VEINSEEKER]: {
    health: VEINSEEKER_STATS.health,
    speed: VEINSEEKER_STATS.speed,
    tilesPerTurn: VEINSEEKER_STATS.tilesPerTurn,
    value: VEINSEEKER_STATS.value,
    color: VEINSEEKER_STATS.color,
    size: VEINSEEKER_STATS.size,
    leakDamage: VEINSEEKER_STATS.leakDamage,
  },
  // Sprint 37 — Highground archetype: ground enemy immune to elevation penalties
  [EnemyType.GLIDER]: {
    health: GLIDER_STATS.health,
    speed: GLIDER_STATS.speed,
    tilesPerTurn: GLIDER_STATS.tilesPerTurn,
    value: GLIDER_STATS.value,
    color: GLIDER_STATS.color,
    size: GLIDER_STATS.size,
    leakDamage: GLIDER_STATS.leakDamage,
    ignoresElevation: true,
  },
  // Sprint 38 — Highground archetype: elite enemy that halves elevation damage bonuses
  [EnemyType.TITAN]: {
    health: TITAN_STATS.health,
    speed: TITAN_STATS.speed,
    tilesPerTurn: TITAN_STATS.tilesPerTurn,
    value: TITAN_STATS.value,
    color: TITAN_STATS.color,
    size: TITAN_STATS.size,
    leakDamage: TITAN_STATS.leakDamage,
    halvesElevationDamageBonuses: true,
  },
  // Sprint 39 — Highground archetype: boss counter fully immune to elevation damage bonuses
  [EnemyType.WYRM_ASCENDANT]: {
    health: WYRM_ASCENDANT_STATS.health,
    speed: WYRM_ASCENDANT_STATS.speed,
    tilesPerTurn: WYRM_ASCENDANT_STATS.tilesPerTurn,
    value: WYRM_ASCENDANT_STATS.value,
    color: WYRM_ASCENDANT_STATS.color,
    size: WYRM_ASCENDANT_STATS.size,
    leakDamage: WYRM_ASCENDANT_STATS.leakDamage,
    immuneToElevationDamageBonuses: true,
  },
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
  value: 2,
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
