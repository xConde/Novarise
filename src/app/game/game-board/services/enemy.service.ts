import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, MINI_SWARM_STATS, FLYING_ENEMY_HEIGHT, MIN_ENEMY_SPEED, DamageResult } from '../models/enemy.model';
import { GameBoardService } from '../game-board.service';
import { GameModifier, GAME_MODIFIER_CONFIGS } from '../models/game-modifier.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { PathfindingService } from './pathfinding.service';
import { GameStateService } from './game-state.service';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { EnemyVisualService } from './enemy-visual.service';
import { EnemyHealthService } from './enemy-health.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';

export { DamageResult } from '../models/enemy.model';

@Injectable()
export class EnemyService {
  private enemies: Map<string, Enemy> = new Map();
  private enemyCounter = 0;
  /** Scratch Vector3 reused each frame to avoid per-enemy allocation in movement. */
  private scratchDirection = new THREE.Vector3();
  /** Scratch world-position objects reused each frame to avoid per-enemy allocation. */
  private scratchCurrentWorld = { x: 0, z: 0 };
  private scratchNextWorld = { x: 0, z: 0 };

  constructor(
    private gameBoardService: GameBoardService,
    private pathfindingService: PathfindingService,
    private gameStateService: GameStateService,
    private enemyMeshFactory: EnemyMeshFactoryService,
    private enemyVisual: EnemyVisualService,
    private enemyHealth: EnemyHealthService,
    private cardEffectService: CardEffectService,
  ) {}

  /**
   * Spawn a new enemy of the given type at a randomly chosen spawner tile.
   * Applies active modifier effects (health/speed multipliers) to the enemy's
   * base stats, creates a Three.js mesh, and adds it to `scene`.
   * FLYING enemies use a straight-line path that bypasses terrain.
   * Returns `null` if no spawner/exit tiles exist or no valid path is found.
   *
   * @param waveHealthMultiplier Additional health scaling from endless-wave progression (1.0 = no change).
   * @param waveSpeedMultiplier  Additional speed scaling from endless-wave progression (1.0 = no change).
   *   Applied multiplicatively on top of modifier-scaled stats; speed floor is enforced after.
   */
  spawnEnemy(
    type: EnemyType,
    scene: THREE.Scene,
    waveHealthMultiplier = 1,
    waveSpeedMultiplier = 1,
  ): Enemy | null {
    const spawnerTiles = this.pathfindingService.getSpawnerTiles();
    if (spawnerTiles.length === 0) {
      console.warn('No spawner tiles available');
      return null;
    }

    // Pick a random spawner tile
    const spawnerTile = spawnerTiles[Math.floor(Math.random() * spawnerTiles.length)];
    const { row, col } = spawnerTile;

    // Find path to exit
    const exitTiles = this.pathfindingService.getExitTiles();
    if (exitTiles.length === 0) {
      console.warn('No exit tiles available');
      return null;
    }

    // Use first exit tile as target (they're grouped in center)
    const exitTile = exitTiles[0];

    // FLYING enemies bypass terrain — use a 2-node straight-line path
    const isFlying = type === EnemyType.FLYING;
    const path = isFlying
      ? this.pathfindingService.buildStraightPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row })
      : this.pathfindingService.findPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row });

    if (path.length === 0) {
      console.warn('No valid path found from spawner to exit');
      return null;
    }

    // Create enemy
    const stats = ENEMY_STATS[type];
    const worldPos = this.pathfindingService.gridToWorldPos(row, col);

    // FLYING enemies hover above ground
    const yPos = isFlying ? FLYING_ENEMY_HEIGHT : stats.size;

    const enemy: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type,
      position: { x: worldPos.x, y: yPos, z: worldPos.z },
      gridPosition: { row, col },
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      value: stats.value,
      leakDamage: stats.leakDamage,
      path,
      pathIndex: 0,
      distanceTraveled: 0
    };

    // Apply modifier effects to spawned enemy stats — read from GameStateService on demand.
    const modifierEffects = this.gameStateService.getModifierEffects();
    const activeModifiers = this.gameStateService.getState().activeModifiers;
    if (modifierEffects.enemyHealthMultiplier !== undefined) {
      enemy.health = Math.round(enemy.health * modifierEffects.enemyHealthMultiplier);
      enemy.maxHealth = enemy.health;
    }
    // Speed modifiers: SPEED_DEMONS only applies to FAST/SWIFT types.
    // If both FAST_ENEMIES and SPEED_DEMONS are active, compute the combined
    // multiplier manually to apply SPEED_DEMONS selectively.
    if (activeModifiers.has(GameModifier.SPEED_DEMONS)) {
      const isFastOrSwift = type === EnemyType.FAST || type === EnemyType.SWIFT;
      if (isFastOrSwift) {
        // Apply the full merged speed multiplier (includes both modifiers)
        if (modifierEffects.enemySpeedMultiplier !== undefined) {
          enemy.speed *= modifierEffects.enemySpeedMultiplier;
        }
      } else {
        // Only apply FAST_ENEMIES portion (exclude SPEED_DEMONS' 2.0x)
        const speedDemonsMultiplier = GAME_MODIFIER_CONFIGS[GameModifier.SPEED_DEMONS].effects.enemySpeedMultiplier ?? 1;
        const totalMultiplier = modifierEffects.enemySpeedMultiplier ?? 1;
        // Guard against divide-by-zero (speedDemonsMultiplier should never be 0, but be safe)
        const nonDemonMultiplier = speedDemonsMultiplier !== 0
          ? totalMultiplier / speedDemonsMultiplier
          : totalMultiplier;
        if (nonDemonMultiplier !== 1) {
          enemy.speed *= nonDemonMultiplier;
        }
      }
    } else if (modifierEffects.enemySpeedMultiplier !== undefined) {
      // No SPEED_DEMONS — apply speed multiplier to all types
      enemy.speed *= modifierEffects.enemySpeedMultiplier;
    }

    // Apply endless-wave scaling on top of modifier scaling (multiplicative stacking)
    if (waveHealthMultiplier !== 1) {
      enemy.health = Math.round(enemy.health * waveHealthMultiplier);
      enemy.maxHealth = enemy.health;
    }
    if (waveSpeedMultiplier !== 1) {
      enemy.speed *= waveSpeedMultiplier;
    }

    // Floor speed to prevent zero/negative from extreme modifier stacking
    enemy.speed = Math.max(MIN_ENEMY_SPEED, enemy.speed);

    if (isFlying) {
      enemy.isFlying = true;
    }

    if (stats.maxShield !== undefined) {
      enemy.shield = stats.maxShield;
      enemy.maxShield = stats.maxShield;
    }

    // Create mesh
    enemy.mesh = this.enemyMeshFactory.createEnemyMesh(enemy);
    scene.add(enemy.mesh);

    this.enemies.set(enemy.id, enemy);
    return enemy;
  }

  /**
   * Turn-based movement: advance every living enemy by exactly `tilesPerTurn`
   * tiles along its cached path. `tilesPerTurn` is computed per enemy from its
   * `speed` stat rounded to an integer, minus any SLOW reduction supplied by the
   * caller (floored at 0 tiles).
   *
   * This is the Phase 4 replacement for {@link updateEnemies}. Called once per
   * resolution phase by CombatLoopService.resolveTurn().
   *
   * @param slowReductionFor  Callback returning the SLOW tile reduction to apply
   *                          to a given enemy id. Caller typically passes
   *                          `(id) => statusEffectService.getSlowTileReduction(id)`.
   * @returns IDs of enemies that reached the exit this turn (callers apply
   *          leak damage and call {@link removeEnemy}).
   */
  stepEnemiesOneTurn(slowReductionFor: (enemyId: string) => number): string[] {
    const reachedExit: string[] = [];
    // enemySpeed modifier: floored integer reduction. Weak (<50%) modifiers won't affect FAST/SWIFT,
    // won't affect 1-tile movers at all. Balance in M4 S5.
    const enemySpeedSlow = this.cardEffectService.getModifierValue(MODIFIER_STAT.ENEMY_SPEED);

    this.enemies.forEach(enemy => {
      if (enemy.health <= 0 || enemy.dying) return;

      // Already at exit — push once, don't advance again.
      if (enemy.pathIndex >= enemy.path.length - 1) {
        reachedExit.push(enemy.id);
        return;
      }

      // Integer tiles-per-turn by enemy type. FAST/SWIFT are the "fast movers";
      // everything else moves 1 tile/turn by default. SLOW status is a flat
      // -1 tile reduction, floored at 0 (can fully stop 1-tile movers).
      const baseTiles = (enemy.type === EnemyType.FAST || enemy.type === EnemyType.SWIFT) ? 2 : 1;
      const slowReduction = slowReductionFor(enemy.id);
      const enemySpeedReduction = enemySpeedSlow > 0 ? Math.floor(baseTiles * enemySpeedSlow) : 0;
      const tilesToMove = Math.max(0, baseTiles - slowReduction - enemySpeedReduction);
      if (tilesToMove === 0) return;

      let stepsRemaining = tilesToMove;
      while (stepsRemaining > 0 && enemy.pathIndex < enemy.path.length - 1) {
        enemy.pathIndex++;
        const node = enemy.path[enemy.pathIndex];
        enemy.gridPosition.row = node.y;
        enemy.gridPosition.col = node.x;

        // Snap world position to the new tile center.
        this.pathfindingService.gridToWorldPosInto(node.y, node.x, this.scratchCurrentWorld);
        enemy.position.x = this.scratchCurrentWorld.x;
        enemy.position.z = this.scratchCurrentWorld.z;
        enemy.distanceTraveled += 1; // one tile worth, abstract units

        // Execute deferred repath now that we're snapped to a grid node.
        if (enemy.needsRepath) {
          this.executeRepath(enemy);
        }

        stepsRemaining--;
      }

      // Did this enemy reach the final path node during its movement?
      if (enemy.pathIndex >= enemy.path.length - 1) {
        reachedExit.push(enemy.id);
      }

      // Snap mesh to final world position for this turn.
      if (enemy.mesh) {
        enemy.mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
        // Face along the last movement direction toward the next path node (if any).
        if (enemy.pathIndex + 1 < enemy.path.length) {
          const next = enemy.path[enemy.pathIndex + 1];
          this.pathfindingService.gridToWorldPosInto(next.y, next.x, this.scratchNextWorld);
          const dx = this.scratchNextWorld.x - enemy.position.x;
          const dz = this.scratchNextWorld.z - enemy.position.z;
          if (dx !== 0 || dz !== 0) {
            enemy.mesh.rotation.y = Math.atan2(dx, dz);
          }
        }
      }
    });

    return reachedExit;
  }

  // M2 S1: deltaTime-based updateEnemies() DELETED. Replaced by
  // stepEnemiesOneTurn (turn-based). Spec call sites cast to (svc as any) so
  // they fail at runtime — H2 will rewrite those tests against stepEnemiesOneTurn.

  /**
   * Remove an enemy by ID: disposes all child geometries/materials (health bar,
   * shield, crown), removes the mesh from `scene`, and deletes the entry from
   * the internal enemies map. No-op if the ID is not found.
   */
  removeEnemy(enemyId: string, scene: THREE.Scene): void {
    const enemy = this.enemies.get(enemyId);
    if (enemy) {
      // Remove status-effect particles (geometry/material are shared — just scene.remove)
      this.enemyVisual.removeStatusParticles(enemy, scene);

      if (enemy.mesh) {
        // Dispose health bar and shield children before removing
        enemy.mesh.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        scene.remove(enemy.mesh);
        enemy.mesh.geometry.dispose();
        if (Array.isArray(enemy.mesh.material)) {
          enemy.mesh.material.forEach(mat => mat.dispose());
        } else {
          enemy.mesh.material.dispose();
        }
      }
      this.enemies.delete(enemyId);
    }
  }

  /**
   * Deal damage to the enemy with the highest current health.
   * Flying enemies and dying enemies are excluded from the search.
   * No-op when no living enemies exist.
   */
  damageStrongestEnemy(damage: number): void {
    let strongestId: string | null = null;
    let highestHealth = -Infinity;
    for (const [id, enemy] of this.enemies) {
      if (!enemy.dying && enemy.health > highestHealth) {
        highestHealth = enemy.health;
        strongestId = id;
      }
    }
    if (strongestId !== null) {
      this.damageEnemy(strongestId, damage);
    }
  }

  /**
   * Get all active enemies
   */
  getEnemies(): Map<string, Enemy> {
    return this.enemies;
  }

  /**
   * Deal damage to a specific enemy.
   *
   * For SHIELDED enemies, damage is absorbed by the shield first. Once the shield
   * is exhausted, remaining damage carries through to health. When the shield
   * breaks the shield visual is removed from the mesh.
   *
   * For SWARM enemies that die, mini-swarm enemies are spawned at the parent's
   * current path position. The spawned enemies are registered internally and
   * returned so the caller can add their meshes to the scene.
   *
   * Returns a DamageResult with `killed` (true when health reaches 0) and
   * `spawnedEnemies` (non-empty only when a SWARM enemy dies).
   */
  damageEnemy(enemyId: string, damage: number): DamageResult {
    const noOp: DamageResult = { killed: false, spawnedEnemies: [] };
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.health <= 0) return noOp;

    // --- Shield absorption (SHIELDED type) ---
    if (enemy.shield !== undefined && enemy.shield > 0) {
      if (damage <= enemy.shield) {
        // Shield fully absorbs the hit
        enemy.shield -= damage;
        if (enemy.shield === 0) {
          this.enemyMeshFactory.removeShieldMesh(enemy);
        }
        return noOp; // Health untouched
      } else {
        // Shield breaks; carry remainder to health
        const remainder = damage - enemy.shield;
        enemy.shield = 0;
        this.enemyMeshFactory.removeShieldMesh(enemy);
        damage = remainder;
      }
    }

    // --- Apply to health ---
    enemy.health -= damage;

    if (enemy.health > 0) {
      return { killed: false, spawnedEnemies: [] };
    }

    // --- Enemy died ---
    const spawnedEnemies: Enemy[] = [];

    // SWARM death: spawn mini-enemies (only if this is NOT already a mini-swarm)
    if (enemy.type === EnemyType.SWARM && !enemy.isMiniSwarm) {
      const parentStats = ENEMY_STATS[EnemyType.SWARM];
      const spawnCount = parentStats.spawnOnDeath ?? 0;
      for (let i = 0; i < spawnCount; i++) {
        const mini = this.spawnMiniSwarm(enemy);
        if (mini) {
          spawnedEnemies.push(mini);
        }
      }
    }

    return { killed: true, spawnedEnemies };
  }

  /**
   * Sync every enemy's health-bar fill and color to its current health ratio.
   * Delegates to EnemyHealthService.
   * @param cameraQuaternion When provided, billboards health-bar planes to face
   *   the camera, compensating for the parent enemy mesh's own rotation.
   *   Omit during unit tests or when billboarding is not needed.
   */
  updateHealthBars(cameraQuaternion?: THREE.Quaternion): void {
    this.enemyHealth.updateHealthBars(this.enemies, cameraQuaternion);
  }

  /**
   * Tint enemy mesh emissive color based on active status effects.
   * Delegates to EnemyVisualService.
   */
  updateStatusVisuals(activeEffects: Map<string, StatusEffectType[]>): void {
    this.enemyVisual.updateStatusVisuals(this.enemies, activeEffects);
  }

  /**
   * Spin boss crowns for visual flair. Called once per frame.
   * Delegates to EnemyVisualService.
   */
  updateEnemyAnimations(deltaTime: number): void {
    this.enemyVisual.updateEnemyAnimations(this.enemies, deltaTime);
  }

  /**
   * Create/animate/remove small particle meshes for active status effects.
   * Delegates to EnemyVisualService.
   *
   * Call once per render frame (NOT inside the fixed-timestep physics loop).
   */
  updateStatusEffectParticles(
    deltaTime: number,
    scene: THREE.Scene,
    activeEffects: Map<string, StatusEffectType[]>,
  ): void {
    this.enemyVisual.updateStatusEffectParticles(this.enemies, deltaTime, scene, activeEffects);
  }

  /**
   * Tick all active shield break animations by `deltaTime` seconds.
   * Delegates to EnemyHealthService.
   * Call once per render frame (not inside the fixed-timestep physics loop).
   */
  updateShieldBreakAnimations(deltaTime: number): void {
    this.enemyHealth.updateShieldBreakAnimations(this.enemies, deltaTime);
  }

  /**
   * Spawn a mini-swarm enemy at the parent's current path position.
   * The mini-enemy continues along the parent's remaining path.
   * isMiniSwarm is set to true to prevent recursive spawning.
   */
  private spawnMiniSwarm(parent: Enemy): Enemy | null {
    // Remaining path from the parent's current node onwards
    const remainingPath = parent.path.slice(parent.pathIndex);
    if (remainingPath.length === 0) return null;

    const mini: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type: EnemyType.SWARM,
      position: { x: parent.position.x, y: MINI_SWARM_STATS.size, z: parent.position.z },
      gridPosition: { ...parent.gridPosition },
      health: MINI_SWARM_STATS.health,
      maxHealth: MINI_SWARM_STATS.health,
      speed: MINI_SWARM_STATS.speed,
      value: MINI_SWARM_STATS.value,
      leakDamage: MINI_SWARM_STATS.leakDamage,
      path: remainingPath,
      pathIndex: 0,
      distanceTraveled: parent.distanceTraveled,
      isMiniSwarm: true
    };

    mini.mesh = this.enemyMeshFactory.createMiniSwarmMesh(mini);
    this.enemies.set(mini.id, mini);
    return mini;
  }

  /**
   * Mark an enemy as dying and start the shrink-fade animation.
   * The enemy is immediately removed from the spatial-grid targeting pool (health is 0)
   * but remains in the enemies map until the animation completes.
   * BOSS enemies use a longer duration for added impact.
   * SWARM mini-spawn happens in damageEnemy() before this is called — no special handling needed here.
   * Delegates to EnemyHealthService.
   */
  startDyingAnimation(enemyId: string): void {
    this.enemyHealth.startDyingAnimation(this.enemies, enemyId);
  }

  /**
   * Trigger a brief white emissive flash on the hit enemy.
   * No-op if the enemy is dying, already flashing, or not found.
   * Delegates to EnemyHealthService.
   */
  startHitFlash(enemyId: string): void {
    this.enemyHealth.startHitFlash(this.enemies, enemyId);
  }

  /**
   * Tick all active hit-flash timers and restore emissive when each expires.
   * Call once per render frame (not inside fixed-timestep physics).
   * Delegates to EnemyHealthService.
   */
  updateHitFlashes(deltaTime: number): void {
    this.enemyHealth.updateHitFlashes(this.enemies, deltaTime);
  }

  /**
   * Advance all active dying animations by `deltaTime` seconds.
   * Scales the mesh down and fades opacity toward 0.
   * When the timer expires, calls removeEnemy() to dispose the mesh.
   *
   * This must be called from the render loop (not inside the fixed-timestep physics loop)
   * so the animation runs at real-time frame rate regardless of game speed.
   * Delegates to EnemyHealthService.
   */
  updateDyingAnimations(deltaTime: number, scene: THREE.Scene): void {
    this.enemyHealth.updateDyingAnimations(this.enemies, deltaTime, scene, (id, s) => this.removeEnemy(id, s));
  }

  /**
   * Returns the count of enemies that are alive and NOT in the dying animation.
   * Use this for wave-completion checks instead of enemies.size, because dying
   * enemies are still in the map during their animation but are already "dead"
   * from the game-logic perspective.
   */
  getLivingEnemyCount(): number {
    let count = 0;
    this.enemies.forEach(enemy => {
      if (!enemy.dying) count++;
    });
    return count;
  }

  /**
   * Returns the A* path from the first spawner to the first exit as world coordinates.
   * Delegates to PathfindingService. Used by path overlay visualization.
   */
  getPathToExit(): { x: number; z: number }[] {
    return this.pathfindingService.getPathToExit();
  }

  /**
   * Clear the path cache (call when board changes).
   * Delegates to PathfindingService.
   */
  clearPathCache(): void {
    this.pathfindingService.invalidateCache();
  }

  /**
   * Flag enemies for deferred repath on their next waypoint arrival.
   * Only flags enemies whose remaining path passes through the changed tile.
   * The actual repath happens in updateEnemies() when the enemy reaches its
   * next waypoint — this avoids direction-vector bugs from repathing mid-stride.
   *
   * @param changedRow Row of the placed/sold tower (or -1 to flag ALL ground enemies)
   * @param changedCol Column of the placed/sold tower (or -1 to flag ALL ground enemies)
   */
  repathAffectedEnemies(changedRow: number, changedCol: number): void {
    this.clearPathCache();

    const forceAll = changedRow < 0 || changedCol < 0;

    for (const enemy of this.enemies.values()) {
      if (enemy.isFlying) continue;

      if (forceAll || this.pathCrossesTile(enemy, changedRow, changedCol)) {
        enemy.needsRepath = true;
      }
    }
  }

  /** Check if an enemy's remaining path (from current index forward) crosses a specific tile. */
  private pathCrossesTile(enemy: Enemy, row: number, col: number): boolean {
    for (let i = enemy.pathIndex; i < enemy.path.length; i++) {
      const node = enemy.path[i];
      if (node.y === row && node.x === col) {
        return true;
      }
    }
    return false;
  }

  /** Execute deferred repath for an enemy that reached a waypoint. */
  private executeRepath(enemy: Enemy): void {
    enemy.needsRepath = false;

    const exitTiles = this.pathfindingService.getExitTiles();
    if (exitTiles.length === 0) return;
    const exitTile = exitTiles[0];

    // Repath from the node the enemy just arrived at (gridPosition is now current)
    const newPath = this.pathfindingService.findPath(
      { x: enemy.gridPosition.col, y: enemy.gridPosition.row },
      { x: exitTile.col, y: exitTile.row }
    );

    if (newPath.length > 0) {
      enemy.path = newPath;
      enemy.pathIndex = 0;
    }
    // If findPath returns empty (no route — should be unreachable via wouldBlockPath guard),
    // the enemy keeps its old path. This is a defensive no-op, not a silent failure,
    // because wouldBlockPath prevents placements that fully block spawner→exit routes.
  }

  /**
   * Full reset: remove all enemies from the scene, reset the ID counter,
   * and clear the path cache. Call on game restart to prevent stale state.
   */
  reset(scene: THREE.Scene): void {
    this.cleanup(scene);
    this.enemyCounter = 0;
    this.clearPathCache();
  }

  /**
   * Remove all enemies from the scene, dispose their geometries/materials,
   * and clear the internal enemies map. Call on game restart or route teardown.
   */
  cleanup(scene: THREE.Scene): void {
    this.enemies.forEach((enemy, id) => {
      this.removeEnemy(id, scene);
    });
    // removeEnemy deletes entries during forEach — ensure map is cleared in case
    // any entry was skipped (e.g. enemy with no mesh)
    this.enemies.clear();

    // Dispose shared status-particle geometry and materials (owned by EnemyVisualService)
    this.enemyVisual.cleanup();
  }
}
