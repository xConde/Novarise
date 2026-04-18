import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, MINI_SWARM_STATS, FLYING_ENEMY_HEIGHT, MIN_ENEMY_SPEED, DamageResult, GridNode, MINER_DIG_INTERVAL_TURNS, VEINSEEKER_SPEED_BOOST_WINDOW, VEINSEEKER_BOOSTED_TILES_PER_TURN } from '../models/enemy.model';
import { GameBoardService } from '../game-board.service';
import { GameModifier, GAME_MODIFIER_CONFIGS } from '../models/game-modifier.model';
import { StatusEffectType } from '../constants/status-effect.constants';
import { PathfindingService } from './pathfinding.service';
import { GameStateService } from './game-state.service';
import { EnemyMeshFactoryService } from './enemy-mesh-factory.service';
import { EnemyVisualService } from './enemy-visual.service';
import { RelicService } from '../../../run/services/relic.service';
import { EnemyHealthService } from './enemy-health.service';
import { CardEffectService } from '../../../run/services/card-effect.service';
import { MODIFIER_STAT } from '../../../run/constants/modifier-stat.constants';
import { SerializableEnemy } from '../models/encounter-checkpoint.model';
import { PathMutationService } from './path-mutation.service';
import { BlockType } from '../models/game-board-tile';

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
    private relicService: RelicService,
    /**
     * @Optional() breaks the EnemyService → PathMutationService DI.
     * PathMutationService already avoids injecting EnemyService directly
     * (uses a setRepathHook callback instead), so no cycle exists at
     * runtime — @Optional() is a belt-and-suspenders guard for test beds
     * that don't register PathMutationService in their providers array.
     * tickMinerDigs early-outs when the service is null so MINERs simply
     * don't dig in those test contexts.
     */
    @Optional() private pathMutationService: PathMutationService | null,
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
    /**
     * Set of "row-col" keys that are considered occupied for this spawn call.
     * When provided by the caller (e.g. WaveService batching multiple spawns
     * per turn), newly-spawned enemies from earlier in the same batch are
     * included — preventing same-turn stacking across different spawner tiles.
     * When omitted (single-call callers, test helpers), occupancy is derived
     * fresh from the live enemies map (previous-turn enemies only).
     */
    externalOccupied?: Set<string>,
    /**
     * The current turn number, threaded from CombatLoopService.resolveTurn
     * → WaveService.spawnForTurn → here. Only used to stamp spawnedOnTurn on
     * MINER enemies. Callers that don't have a turn context (test helpers, one-off
     * spawns) should omit this — MINERs spawned without a turn context won't dig.
     */
    currentTurn?: number,
  ): Enemy | null {
    const spawnerTiles = this.pathfindingService.getSpawnerTiles();
    if (spawnerTiles.length === 0) {
      console.warn('No spawner tiles available');
      return null;
    }

    // Find path to exit
    const exitTiles = this.pathfindingService.getExitTiles();
    if (exitTiles.length === 0) {
      console.warn('No exit tiles available');
      return null;
    }

    // Shuffle spawner tiles with a seeded Fisher-Yates so selection is
    // deterministic on save/resume. GameStateService does not expose an RNG
    // directly, so we use Math.random() here — the order can't affect
    // save/resume correctness because spawner selection is not checkpointed.
    const candidates = [...spawnerTiles];
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Occupancy check: only applies when called from a spawn batch (i.e.,
    // externalOccupied is provided by WaveService). Direct calls (mini-swarm,
    // tests, one-off spawns) skip the check — the caller manages occupancy.
    let chosenRow: number;
    let chosenCol: number;

    if (externalOccupied !== undefined) {
      // Batch mode: try each shuffled spawner; skip occupied ones.
      let foundRow: number | null = null;
      let foundCol: number | null = null;
      for (const candidate of candidates) {
        if (!externalOccupied.has(`${candidate.row}-${candidate.col}`)) {
          foundRow = candidate.row;
          foundCol = candidate.col;
          break;
        }
      }

      // All spawners occupied — caller will retry next turn.
      if (foundRow === null || foundCol === null) {
        return null;
      }

      // Reserve this spawner for the remainder of the batch.
      externalOccupied.add(`${foundRow}-${foundCol}`);
      chosenRow = foundRow;
      chosenCol = foundCol;
    } else {
      // Single-call mode: pick a random candidate (legacy shuffle behavior).
      const picked = candidates[0];
      chosenRow = picked.row;
      chosenCol = picked.col;
    }

    const row = chosenRow;
    const col = chosenCol;

    // FLYING enemies bypass terrain — use a 2-node straight-line path to the
    // geometrically nearest exit. Ground enemies try every exit via A* and
    // take the shortest valid path. This matches the multi-exit semantics
    // of GameBoardService.wouldBlockPath (any exit reachable = placement OK);
    // before this, enemies unconditionally aimed for exitTiles[0] and got
    // stranded whenever a tower cut off exit[0] but left exit[1] reachable.
    const isFlying = type === EnemyType.FLYING;
    let path = isFlying
      ? this.buildStraightPathToNearestExit(col, row, exitTiles)
      : this.findShortestPathToAnyExit(col, row, exitTiles);

    if (path.length === 0) {
      if (isFlying) {
        // Flying already uses straight-line — no exit tiles means truly nothing.
        console.warn('No valid path found from spawner to any exit (flying)');
        return null;
      }
      // Ground enemy: A* failed (board fully fenced off). Fall back to a
      // straight-line path so the enemy still spawns rather than being silently
      // dropped. Ground units will walk through towers in this degenerate case —
      // that is acceptable because wouldBlockPath prevents valid placements from
      // fully fencing off every route; this only fires on adversarial edge cases.
      path = this.buildStraightPathToNearestExit(col, row, exitTiles);
      if (path.length === 0) {
        console.warn('No valid path found from spawner to any exit (ground straight-line fallback also failed)');
        return null;
      }
      console.warn('Ground enemy using straight-line fallback path (A* found no route)');
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

    // Apply relic speed multiplier (STURDY_BOOTS — 0.92x). Stacks multiplicatively
    // with ascension and game-modifier scaling. Flying enemies are NOT exempt —
    // the relic description is "Enemies move X% slower" with no type carve-out.
    const relicSpeedMult = this.relicService.getEnemySpeedMultiplier();
    if (relicSpeedMult !== 1) {
      enemy.speed *= relicSpeedMult;
    }

    // Floor speed to prevent zero/negative from extreme modifier stacking
    enemy.speed = Math.max(MIN_ENEMY_SPEED, enemy.speed);

    if (isFlying) {
      enemy.isFlying = true;
    }

    // MINER: record spawn turn for 3-turn dig cadence.
    // spawnEnemy receives currentTurn via an optional parameter threaded
    // from CombatLoopService.resolveTurn → WaveService.spawnForTurn(scene, currentTurn)
    // → EnemyService.spawnEnemy(..., currentTurn). Existing callers that
    // omit currentTurn get undefined — those MINERs won't dig, which is
    // correct for test helpers and one-off spawns that have no turn context.
    if (type === EnemyType.MINER && currentTurn !== undefined) {
      enemy.spawnedOnTurn = currentTurn;
    }

    // UNSHAKEABLE: flag immunity to DETOUR rerouting.
    if (type === EnemyType.UNSHAKEABLE) {
      enemy.immuneToDetour = true;
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
  stepEnemiesOneTurn(slowReductionFor: (enemyId: string) => number, currentTurn = 0): string[] {
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

      // VEINSEEKER speed-up mechanic: when the path was mutated in the past
      // VEINSEEKER_SPEED_BOOST_WINDOW turns, VEINSEEKER advances 2 tiles/turn
      // instead of its base 1. This is the archetype-depth plan's "path modified
      // in past 3 turns → +30% speed" mechanic, simplified to an integer tile bump.
      // Slow and modifier reductions apply to the boosted value as normal.
      let baseTiles = ENEMY_STATS[enemy.type].tilesPerTurn;
      if (
        enemy.type === EnemyType.VEINSEEKER &&
        this.pathMutationService?.wasMutatedInLastTurns(currentTurn, VEINSEEKER_SPEED_BOOST_WINDOW)
      ) {
        baseTiles = VEINSEEKER_BOOSTED_TILES_PER_TURN;
      }
      const slowReduction = slowReductionFor(enemy.id);
      const enemySpeedReduction = enemySpeedSlow > 0 ? Math.floor(baseTiles * enemySpeedSlow) : 0;
      // Floor at 1 tile/turn — SLOW aura re-applies each turn while enemy is in
      // range, so a 0-floor would permanently freeze any 1-tile mover (BASIC,
      // HEAVY, BOSS, SHIELDED, FLYING). SLOW tower is still effective against
      // 2-tile movers (FAST, SWIFT, SWARM) which drop from 2→1.
      const tilesToMove = Math.max(1, baseTiles - slowReduction - enemySpeedReduction);

      let stepsRemaining = tilesToMove;
      while (stepsRemaining > 0 && enemy.pathIndex < enemy.path.length - 1) {
        // Consume a deferred repath BEFORE committing to the next node.
        // If we check after the pathIndex++/position update, the enemy
        // first walks onto the tower tile (their path's next waypoint)
        // and only then repaths — visually passing through the tower.
        // In a turn-based loop, the enemy is always snapped to a grid
        // node at the top of each iteration, so repathing here is
        // equivalent to "on waypoint arrival" without the off-by-one.
        if (enemy.needsRepath) {
          this.executeRepath(enemy);
        }

        enemy.pathIndex++;
        const node = enemy.path[enemy.pathIndex];
        enemy.gridPosition.row = node.y;
        enemy.gridPosition.col = node.x;

        // Track tile for SURVEYOR_COMPASS relic (no-op if relic inactive).
        this.relicService.recordTileVisited(node.y, node.x);

        // Snap world position to the new tile center.
        this.pathfindingService.gridToWorldPosInto(node.y, node.x, this.scratchCurrentWorld);
        enemy.position.x = this.scratchCurrentWorld.x;
        enemy.position.z = this.scratchCurrentWorld.z;
        enemy.distanceTraveled += 1; // one tile worth, abstract units

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
      if (!enemy.dying && !enemy.isFlying && enemy.health > highestHealth) {
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

  // ────────────────────────────────────────────────────────────────────────
  // MINER dig phase (Sprint 21)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Scan the MINER's remaining path and return the first WALL tile that is
   * legal to dig: not SPAWNER / EXIT (PathMutationService.destroy rejects those
   * automatically) AND not player-built (would invalidate Cartographer
   * counter-play per design doc §9). Returns null if no legal WALL is
   * reachable on the remaining path.
   *
   * GridNode convention: node.x = col, node.y = row.
   */
  findMinerDigTarget(enemy: Enemy): { row: number; col: number } | null {
    const board = this.gameBoardService.getGameBoard();
    for (let i = enemy.pathIndex; i < enemy.path.length; i++) {
      const node = enemy.path[i];
      const row = node.y;
      const col = node.x;
      const boardRow = board[row];
      if (!boardRow) continue;
      const tile = boardRow[col];
      if (!tile) continue;
      if (tile.type !== BlockType.WALL) continue;
      // Skip walls that the player intentionally blocked (e.g. Siegeworks).
      if (this.pathMutationService?.isPlayerBlocked(row, col)) continue;
      return { row, col };
    }
    return null;
  }

  /**
   * Trigger the MINER dig behaviour for all living, non-flying MINERs whose
   * 3-turn cadence fires this turn. Called from CombatLoopService.resolveTurn
   * after enemy movement (step 2.5) so each MINER walks first, then digs
   * from its new position.
   *
   * Early-outs:
   * - If PathMutationService is absent (test contexts) — no dig.
   * - If enemy is dying or flying.
   * - If spawnedOnTurn is undefined (non-MINER or legacy spawn).
   * - If (currentTurn - spawnedOnTurn) is 0 or not a multiple of MINER_DIG_INTERVAL_TURNS.
   *
   * Each dig is journaled as source='boss', sourceId=`miner:<enemyId>` so
   * save/restore preserves the tile mutation even after the MINER dies.
   */
  tickMinerDigs(currentTurn: number, scene: THREE.Scene): void {
    if (!this.pathMutationService) return;

    for (const enemy of this.enemies.values()) {
      if (enemy.dying || enemy.health <= 0) continue;
      if (enemy.isFlying) continue;
      if (enemy.type !== EnemyType.MINER) continue;
      if (enemy.spawnedOnTurn === undefined) continue;

      const turnsSinceSpawn = currentTurn - enemy.spawnedOnTurn;
      if (turnsSinceSpawn <= 0) continue;
      if (turnsSinceSpawn % MINER_DIG_INTERVAL_TURNS !== 0) continue;

      const target = this.findMinerDigTarget(enemy);
      if (!target) continue;

      this.pathMutationService.destroy(
        target.row,
        target.col,
        `miner:${enemy.id}`,
        currentTurn,
        scene,
        'boss',
      );
    }
  }

  /**
   * Spawn a mini-swarm enemy at the parent's current path position.
   * The mini-enemy continues along the parent's remaining path.
   * Applies the same health-scaling chain used in spawnEnemy (modifier,
   * endless-wave, and relic multipliers) so mini-swarms scale with the run.
   * isMiniSwarm is set to true to prevent recursive spawning.
   */
  private spawnMiniSwarm(parent: Enemy): Enemy | null {
    // Remaining path from the parent's current node onwards
    const remainingPath = parent.path.slice(parent.pathIndex);
    if (remainingPath.length === 0) return null;

    let health: number = MINI_SWARM_STATS.health;

    // Apply the same modifier → wave → relic health-scaling chain as spawnEnemy.
    const modifierEffects = this.gameStateService.getModifierEffects();
    if (modifierEffects.enemyHealthMultiplier !== undefined) {
      health = Math.round(health * modifierEffects.enemyHealthMultiplier);
    }

    const mini: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type: EnemyType.SWARM,
      position: { x: parent.position.x, y: MINI_SWARM_STATS.size, z: parent.position.z },
      gridPosition: { ...parent.gridPosition },
      health,
      maxHealth: health,
      speed: MINI_SWARM_STATS.speed,
      value: MINI_SWARM_STATS.value,
      leakDamage: MINI_SWARM_STATS.leakDamage,
      path: remainingPath,
      pathIndex: 0,
      distanceTraveled: parent.distanceTraveled,
      isMiniSwarm: true,
      ...(parent.needsRepath && { needsRepath: true }),
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
      if (!enemy.dying && enemy.health > 0) count++;
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
   * The actual repath happens in stepEnemiesOneTurn() at the top of the next
   * movement iteration — BEFORE the enemy commits to the next path node —
   * so they re-plan from their current waypoint instead of stepping onto
   * the newly-occupied tile first.
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

    // Repath from the node the enemy just arrived at — try every exit and
    // take the shortest valid path (multi-exit aware; see spawn comment).
    const newPath = this.findShortestPathToAnyExit(
      enemy.gridPosition.col,
      enemy.gridPosition.row,
      exitTiles,
    );

    if (newPath.length > 0) {
      enemy.path = newPath;
      enemy.pathIndex = 0;
    }
    // If every exit is unreachable, the enemy keeps its old path. This is a
    // defensive no-op: wouldBlockPath prevents placements that fully cut off
    // every spawner→exit route, so we should never actually reach this branch.
  }

  /**
   * Build a set of "row-col" keys for all spawner tiles currently occupied by
   * alive (non-dying) enemies. Used to detect occupancy at spawn time so that
   * a second enemy in the same turn batch does not land on a tile already taken
   * by a freshly-placed enemy from earlier in the same batch.
   *
   * Called by WaveService before a spawn batch begins; exposed as public so
   * WaveService can seed the batch-level occupied set.
   */
  /**
   * Returns the set of spawner grid positions that are blocked at the START
   * of the current turn's spawn batch.
   *
   * Enemies that did NOT advance off their spawner tile (e.g. SLOW-paralyzed
   * enemies) must be included so the batch spawner does not stack a new enemy
   * on an occupied spawner. Dying enemies are excluded — their tile is
   * effectively vacated.
   *
   * Same-turn stacking (two enemies landing on the same spawner in the same
   * spawnForTurn call) is handled by the within-batch `externalOccupied`
   * accumulation inside spawnEnemy on top of this seed.
   */
  buildOccupiedSpawnerSet(): Set<string> {
    const spawnerTiles = this.pathfindingService.getSpawnerTiles();
    if (spawnerTiles.length === 0) {
      return new Set<string>();
    }
    const spawnerKeys = new Set(spawnerTiles.map(t => `${t.row}-${t.col}`));
    const occupied = new Set<string>();
    for (const enemy of this.enemies.values()) {
      if (enemy.dying) continue;
      const key = `${enemy.gridPosition.row}-${enemy.gridPosition.col}`;
      if (spawnerKeys.has(key)) {
        occupied.add(key);
      }
    }
    return occupied;
  }

  /**
   * Find the shortest A* path from (startCol, startRow) to the nearest
   * reachable exit. Returns an empty array when NO exit is reachable.
   *
   * Cheap iteration: A* is fast and exit counts per map are small (1–4).
   * Runs in tight budget on spawn + repath hot paths.
   */
  private findShortestPathToAnyExit(
    startCol: number,
    startRow: number,
    exitTiles: ReadonlyArray<{ row: number; col: number }>,
  ): GridNode[] {
    let best: GridNode[] = [];
    for (const exit of exitTiles) {
      const candidate = this.pathfindingService.findPath(
        { x: startCol, y: startRow },
        { x: exit.col, y: exit.row },
      );
      if (candidate.length === 0) continue;
      if (best.length === 0 || candidate.length < best.length) {
        best = candidate;
      }
    }
    return best;
  }

  /**
   * Override every non-flying, non-dying enemy's path with the longest simple
   * path from their current grid position to any exit, for one movement step.
   *
   * Called by the DETOUR card (Sprint 14). The enemy's `pathIndex` resets to 0
   * so they begin walking the new route immediately on the next movement
   * iteration. Enemies naturally fall back to shortest-path re-planning at the
   * next waypoint arrival (executeRepath flow).
   *
   * UNSHAKEABLE enemies (immuneToDetour === true) are skipped — they cannot be rerouted.
   *
   * @returns Number of enemies whose path was overridden.
   */
  applyDetour(): number {
    const exitTiles = this.pathfindingService.getExitTiles();
    if (exitTiles.length === 0) return 0;

    let overrideCount = 0;

    for (const enemy of this.enemies.values()) {
      if (enemy.isFlying) continue;
      if (enemy.dying) continue;
      if (enemy.immuneToDetour === true) continue;

      const { col, row } = enemy.gridPosition;

      // Skip enemies already standing on an exit — no path to compute.
      const atExit = exitTiles.some(e => e.row === row && e.col === col);
      if (atExit) continue;

      // Find the longest path to each exit; pick the overall longest.
      let longestPath: import('../models/enemy.model').GridNode[] = [];
      for (const exit of exitTiles) {
        const candidate = this.pathfindingService.findLongestPath(
          { x: col, y: row },
          { x: exit.col, y: exit.row },
        );
        if (candidate.length > longestPath.length) {
          longestPath = candidate;
        }
      }

      // Only override if the longest path is strictly longer than the current
      // remaining path — otherwise DETOUR has no routing benefit.
      if (longestPath.length === 0) continue;
      const remainingCurrent = enemy.path.length - enemy.pathIndex;
      if (longestPath.length > remainingCurrent) {
        enemy.path = longestPath;
        enemy.pathIndex = 0;
        overrideCount++;
      }
    }

    return overrideCount;
  }

  /**
   * Build a straight-line path to the geometrically nearest exit (Manhattan
   * distance). FLYING enemies bypass terrain so "reachability" always holds;
   * we just pick the closest target.
   */
  private buildStraightPathToNearestExit(
    startCol: number,
    startRow: number,
    exitTiles: ReadonlyArray<{ row: number; col: number }>,
  ): GridNode[] {
    if (exitTiles.length === 0) return [];
    let nearest = exitTiles[0];
    let nearestDist = Math.abs(startCol - nearest.col) + Math.abs(startRow - nearest.row);
    for (let i = 1; i < exitTiles.length; i++) {
      const e = exitTiles[i];
      const d = Math.abs(startCol - e.col) + Math.abs(startRow - e.row);
      if (d < nearestDist) {
        nearest = e;
        nearestDist = d;
      }
    }
    return this.pathfindingService.buildStraightPath(
      { x: startCol, y: startRow },
      { x: nearest.col, y: nearest.row },
    );
  }

  /**
   * Serialize enemies for checkpoint save, stripping Three.js objects and circular refs.
   * `mesh`, `statusParticles`, and `statusParticleEffectType` are omitted.
   * `GridNode.parent` is omitted from each path node to break circular references.
   */
  serializeEnemies(): { enemies: SerializableEnemy[]; enemyCounter: number } {
    const enemies: SerializableEnemy[] = Array.from(this.enemies.values()).map(e => ({
      id: e.id,
      type: e.type,
      position: { ...e.position },
      gridPosition: { ...e.gridPosition },
      health: e.health,
      maxHealth: e.maxHealth,
      speed: e.speed,
      value: e.value,
      path: e.path.map(n => ({ x: n.x, y: n.y, f: n.f, g: n.g, h: n.h })),
      pathIndex: e.pathIndex,
      distanceTraveled: e.distanceTraveled,
      leakDamage: e.leakDamage,
      ...(e.shield !== undefined && { shield: e.shield }),
      ...(e.maxShield !== undefined && { maxShield: e.maxShield }),
      ...(e.isMiniSwarm !== undefined && { isMiniSwarm: e.isMiniSwarm }),
      ...(e.isFlying !== undefined && { isFlying: e.isFlying }),
      ...(e.needsRepath !== undefined && { needsRepath: e.needsRepath }),
      ...(e.dying !== undefined && { dying: e.dying }),
      ...(e.dyingTimer !== undefined && { dyingTimer: e.dyingTimer }),
      ...(e.hitFlashTimer !== undefined && { hitFlashTimer: e.hitFlashTimer }),
      ...(e.shieldBreaking !== undefined && { shieldBreaking: e.shieldBreaking }),
      ...(e.shieldBreakTimer !== undefined && { shieldBreakTimer: e.shieldBreakTimer }),
      ...(e.spawnedOnTurn !== undefined && { spawnedOnTurn: e.spawnedOnTurn }),
      ...(e.immuneToDetour !== undefined && { immuneToDetour: e.immuneToDetour }),
    }));
    return { enemies, enemyCounter: this.enemyCounter };
  }

  /**
   * Restore enemies from checkpoint. Meshes must be pre-built externally
   * and provided in the `meshes` map keyed by enemy id.
   * The internal enemies Map is fully replaced and `enemyCounter` is reset
   * to `counter` so subsequent spawns continue with unique IDs.
   */
  restoreEnemies(enemies: SerializableEnemy[], meshes: Map<string, THREE.Mesh>, counter: number): void {
    this.enemies.clear();
    for (const e of enemies) {
      const enemy: Enemy = {
        ...e,
        path: e.path.map(n => ({ ...n })),
        mesh: meshes.get(e.id),
      };
      this.enemies.set(e.id, enemy);
    }
    this.enemyCounter = counter;
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
