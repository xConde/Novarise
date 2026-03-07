import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, ENEMY_MESH_SEGMENTS, MINI_SWARM_MESH_SEGMENTS, GridNode, MINI_SWARM_STATS, FLYING_ENEMY_HEIGHT, MIN_ENEMY_SPEED } from '../models/enemy.model';
import { GameBoardService } from '../game-board.service';
import { BlockType } from '../models/game-board-tile';
import { HEALTH_BAR_CONFIG, SHIELD_VISUAL_CONFIG, ENEMY_VISUAL_CONFIG } from '../constants/ui.constants';
import { MinHeap } from '../utils/min-heap';
import { GameModifier, ModifierEffects, GAME_MODIFIER_CONFIGS } from '../models/game-modifier.model';

export interface DamageResult {
  killed: boolean;
  spawnedEnemies: Enemy[]; // Mini-swarm enemies added to the scene on parent death
}

@Injectable()
export class EnemyService {
  private enemies: Map<string, Enemy> = new Map();
  private enemyCounter = 0;
  private pathCache: Map<string, GridNode[]> = new Map();
  private modifierEffects: ModifierEffects = {};
  private activeModifiers: Set<GameModifier> = new Set();

  constructor(private gameBoardService: GameBoardService) {}

  /** Set active modifier effects and the raw modifier set. Called by the component when modifiers change. */
  setModifierEffects(effects: ModifierEffects, modifiers: Set<GameModifier>): void {
    this.modifierEffects = effects;
    this.activeModifiers = modifiers;
  }

  /**
   * Spawn a new enemy at a random spawner tile
   */
  spawnEnemy(type: EnemyType, scene: THREE.Scene): Enemy | null {
    const spawnerTiles = this.getSpawnerTiles();
    if (spawnerTiles.length === 0) {
      console.warn('No spawner tiles available');
      return null;
    }

    // Pick a random spawner tile
    const spawnerTile = spawnerTiles[Math.floor(Math.random() * spawnerTiles.length)];
    const { row, col } = spawnerTile;

    // Find path to exit
    const exitTiles = this.getExitTiles();
    if (exitTiles.length === 0) {
      console.warn('No exit tiles available');
      return null;
    }

    // Use first exit tile as target (they're grouped in center)
    const exitTile = exitTiles[0];

    // FLYING enemies bypass terrain — use a 2-node straight-line path
    const isFlying = type === EnemyType.FLYING;
    const path = isFlying
      ? this.buildStraightPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row })
      : this.findPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row });

    if (path.length === 0) {
      console.warn('No valid path found from spawner to exit');
      return null;
    }

    // Create enemy
    const stats = ENEMY_STATS[type];
    const worldPos = this.gridToWorld(row, col);

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

    // Apply modifier effects to spawned enemy stats
    if (this.modifierEffects.enemyHealthMultiplier !== undefined) {
      enemy.health = Math.round(enemy.health * this.modifierEffects.enemyHealthMultiplier);
      enemy.maxHealth = enemy.health;
    }
    // Speed modifiers: SPEED_DEMONS only applies to FAST/SWIFT types.
    // If both FAST_ENEMIES and SPEED_DEMONS are active, compute the combined
    // multiplier manually to apply SPEED_DEMONS selectively.
    if (this.activeModifiers.has(GameModifier.SPEED_DEMONS)) {
      const isFastOrSwift = type === EnemyType.FAST || type === EnemyType.SWIFT;
      if (isFastOrSwift) {
        // Apply the full merged speed multiplier (includes both modifiers)
        if (this.modifierEffects.enemySpeedMultiplier !== undefined) {
          enemy.speed *= this.modifierEffects.enemySpeedMultiplier;
        }
      } else {
        // Only apply FAST_ENEMIES portion (exclude SPEED_DEMONS' 2.0x)
        const speedDemonsMultiplier = GAME_MODIFIER_CONFIGS[GameModifier.SPEED_DEMONS].effects.enemySpeedMultiplier ?? 1;
        const totalMultiplier = this.modifierEffects.enemySpeedMultiplier ?? 1;
        // Guard against divide-by-zero (speedDemonsMultiplier should never be 0, but be safe)
        const nonDemonMultiplier = speedDemonsMultiplier !== 0
          ? totalMultiplier / speedDemonsMultiplier
          : totalMultiplier;
        if (nonDemonMultiplier !== 1) {
          enemy.speed *= nonDemonMultiplier;
        }
      }
    } else if (this.modifierEffects.enemySpeedMultiplier !== undefined) {
      // No SPEED_DEMONS — apply speed multiplier to all types
      enemy.speed *= this.modifierEffects.enemySpeedMultiplier;
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
    enemy.mesh = this.createEnemyMesh(enemy);
    scene.add(enemy.mesh);

    this.enemies.set(enemy.id, enemy);
    return enemy;
  }

  /**
   * Update all enemies - move along paths
   */
  updateEnemies(deltaTime: number): string[] {
    if (deltaTime <= 0) return [];

    const reachedExit: string[] = [];

    this.enemies.forEach(enemy => {
      // Skip dead enemies awaiting removal — prevents double-penalty if ordering changes
      if (enemy.health <= 0) return;

      if (enemy.pathIndex >= enemy.path.length - 1) {
        // Enemy reached exit
        reachedExit.push(enemy.id);
        return;
      }

      // Get current and next path nodes
      const currentNode = enemy.path[enemy.pathIndex];
      const nextNode = enemy.path[enemy.pathIndex + 1];

      // Convert grid positions to world positions
      const currentWorld = this.gridToWorld(currentNode.y, currentNode.x);
      const nextWorld = this.gridToWorld(nextNode.y, nextNode.x);

      // Calculate direction and distance
      const direction = new THREE.Vector3(
        nextWorld.x - currentWorld.x,
        0,
        nextWorld.z - currentWorld.z
      ).normalize();

      const moveDistance = enemy.speed * deltaTime;

      // Calculate distance to next node
      const distanceToNext = Math.sqrt(
        Math.pow(nextWorld.x - enemy.position.x, 2) +
        Math.pow(nextWorld.z - enemy.position.z, 2)
      );

      if (moveDistance >= distanceToNext) {
        // Reached next node - snap to it
        enemy.position.x = nextWorld.x;
        enemy.position.z = nextWorld.z;
        enemy.gridPosition.row = nextNode.y;
        enemy.gridPosition.col = nextNode.x;
        enemy.pathIndex++;
        enemy.distanceTraveled += distanceToNext;
      } else {
        // Move towards next node
        enemy.position.x += direction.x * moveDistance;
        enemy.position.z += direction.z * moveDistance;
        enemy.distanceTraveled += moveDistance;
      }

      // Update mesh position
      if (enemy.mesh) {
        enemy.mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
      }
    });

    return reachedExit;
  }

  /**
   * Remove an enemy and its mesh from the scene
   */
  removeEnemy(enemyId: string, scene: THREE.Scene): void {
    const enemy = this.enemies.get(enemyId);
    if (enemy) {
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
          this.removeShieldMesh(enemy);
        }
        return noOp; // Health untouched
      } else {
        // Shield breaks; carry remainder to health
        const remainder = damage - enemy.shield;
        enemy.shield = 0;
        this.removeShieldMesh(enemy);
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
   * Update all enemy health bars to reflect current health
   */
  updateHealthBars(): void {
    this.enemies.forEach(enemy => {
      if (!enemy.mesh) return;
      // The health bar is stored in userData
      const healthBarBg = enemy.mesh.userData?.['healthBarBg'] as THREE.Mesh | undefined;
      const healthBarFg = enemy.mesh.userData?.['healthBarFg'] as THREE.Mesh | undefined;

      if (healthBarBg && healthBarFg) {
        const healthPct = Math.max(0, enemy.health / enemy.maxHealth);
        healthBarFg.scale.x = healthPct;
        healthBarFg.position.x = -(1 - healthPct) * 0.25;

        // Color transitions: green -> yellow -> red
        const mat = healthBarFg.material as THREE.MeshBasicMaterial;
        if (healthPct > HEALTH_BAR_CONFIG.thresholdHigh) {
          mat.color.setHex(HEALTH_BAR_CONFIG.colorGreen);
        } else if (healthPct > HEALTH_BAR_CONFIG.thresholdLow) {
          mat.color.setHex(HEALTH_BAR_CONFIG.colorYellow);
        } else {
          mat.color.setHex(HEALTH_BAR_CONFIG.colorRed);
        }
      }
    });
  }

  /**
   * Create a 3D mesh for an enemy.
   * FLYING enemies use a flat diamond (kite) shape made of 2 triangles,
   * rotated to lie flat in the XZ plane.
   * All other enemies use a sphere.
   */
  private createEnemyMesh(enemy: Enemy): THREE.Mesh {
    const stats = ENEMY_STATS[enemy.type];

    let geometry: THREE.BufferGeometry;
    if (enemy.isFlying) {
      // Diamond: 4 vertices forming a rhombus in the XZ plane, 2 triangles
      const s = stats.size;
      const diamondGeom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
         0,  0, -s * 2,  // front tip
         s,  0,  0,      // right
         0,  0,  s * 2,  // back tip
        -s,  0,  0       // left
      ]);
      const indices = new Uint16Array([0, 1, 3, 1, 2, 3]);
      diamondGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      diamondGeom.setIndex(new THREE.BufferAttribute(indices, 1));
      diamondGeom.computeVertexNormals();
      geometry = diamondGeom;
    } else {
      geometry = new THREE.SphereGeometry(stats.size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
    }

    const material = new THREE.MeshLambertMaterial({
      color: stats.color,
      emissive: stats.color,
      emissiveIntensity: ENEMY_VISUAL_CONFIG.shieldedEmissive,
      side: enemy.isFlying ? THREE.DoubleSide : THREE.FrontSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add health bar above enemy
    const barWidth = HEALTH_BAR_CONFIG.width;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = stats.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);
    healthBarBg.lookAt(0, barY, 1); // Face camera roughly

    const fgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);
    healthBarFg.lookAt(0, barY + 0.001, 1);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    // Add shield visual for SHIELDED enemies
    if (enemy.type === EnemyType.SHIELDED && enemy.shield !== undefined && enemy.shield > 0) {
      const shieldMesh = this.createShieldMesh(stats.size);
      mesh.add(shieldMesh);
      mesh.userData['shieldMesh'] = shieldMesh;
    }

    return mesh;
  }

  /**
   * Create a semi-transparent sphere to represent the active shield.
   */
  private createShieldMesh(enemySize: number): THREE.Mesh {
    const shieldRadius = enemySize * SHIELD_VISUAL_CONFIG.radiusMultiplier;
    const shieldGeometry = new THREE.SphereGeometry(
      shieldRadius,
      SHIELD_VISUAL_CONFIG.segments,
      SHIELD_VISUAL_CONFIG.segments
    );
    const shieldMaterial = new THREE.MeshLambertMaterial({
      color: SHIELD_VISUAL_CONFIG.color,
      emissive: SHIELD_VISUAL_CONFIG.color,
      emissiveIntensity: SHIELD_VISUAL_CONFIG.emissiveIntensity,
      transparent: true,
      opacity: SHIELD_VISUAL_CONFIG.opacity,
      side: THREE.FrontSide
    });
    return new THREE.Mesh(shieldGeometry, shieldMaterial);
  }

  /**
   * Remove and dispose the shield visual when shield HP reaches 0.
   */
  private removeShieldMesh(enemy: Enemy): void {
    if (!enemy.mesh) return;
    const shieldMesh = enemy.mesh.userData['shieldMesh'] as THREE.Mesh | undefined;
    if (!shieldMesh) return;

    enemy.mesh.remove(shieldMesh);
    shieldMesh.geometry.dispose();
    if (Array.isArray(shieldMesh.material)) {
      shieldMesh.material.forEach(mat => mat.dispose());
    } else {
      shieldMesh.material.dispose();
    }
    delete enemy.mesh.userData['shieldMesh'];
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

    mini.mesh = this.createMiniSwarmMesh(mini);
    this.enemies.set(mini.id, mini);
    return mini;
  }

  /**
   * Create a scaled-down mesh for a mini-swarm enemy.
   * Uses MINI_SWARM_STATS directly rather than ENEMY_STATS to produce the smaller visual.
   */
  private createMiniSwarmMesh(mini: Enemy): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(MINI_SWARM_STATS.size, MINI_SWARM_MESH_SEGMENTS, MINI_SWARM_MESH_SEGMENTS);
    const material = new THREE.MeshLambertMaterial({
      color: MINI_SWARM_STATS.color,
      emissive: MINI_SWARM_STATS.color,
      emissiveIntensity: ENEMY_VISUAL_CONFIG.miniSwarmEmissive
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(mini.position.x, mini.position.y, mini.position.z);
    mesh.castShadow = true;

    // Small health bar
    const barWidth = HEALTH_BAR_CONFIG.width * 0.5;
    const barHeight = HEALTH_BAR_CONFIG.height;
    const barY = MINI_SWARM_STATS.size + HEALTH_BAR_CONFIG.yOffset;

    const bgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.bgColor, side: THREE.DoubleSide });
    const healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    healthBarBg.position.set(0, barY, 0);
    healthBarBg.lookAt(0, barY, 1);

    const fgGeometry = new THREE.PlaneGeometry(barWidth, barHeight);
    const fgMaterial = new THREE.MeshBasicMaterial({ color: HEALTH_BAR_CONFIG.colorGreen, side: THREE.DoubleSide });
    const healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
    healthBarFg.position.set(0, barY + 0.001, 0);
    healthBarFg.lookAt(0, barY + 0.001, 1);

    mesh.add(healthBarBg);
    mesh.add(healthBarFg);
    mesh.userData = { healthBarBg, healthBarFg };

    return mesh;
  }

  /**
   * A* pathfinding algorithm
   */
  private findPath(start: { x: number, y: number }, end: { x: number, y: number }): GridNode[] {
    const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;
    if (this.pathCache.has(cacheKey)) {
      // Return a shallow copy to prevent cache corruption
      return [...this.pathCache.get(cacheKey)!];
    }

    const openHeap = new MinHeap();
    const openMap = new Map<string, GridNode>(); // key -> best node for O(1) lookup
    const closedSet = new Set<string>();
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();

    // Create start node
    const startNode: GridNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.heuristic(start, end),
      f: 0
    };
    startNode.f = startNode.g + startNode.h;

    const startKey = `${start.x},${start.y}`;
    openHeap.insert(startNode);
    openMap.set(startKey, startNode);

    while (openHeap.size > 0) {
      const current = openHeap.extractMin()!;
      const currentKey = `${current.x},${current.y}`;

      // Skip stale heap entries (superseded by a better path via re-insertion)
      if (!openMap.has(currentKey) || openMap.get(currentKey) !== current) {
        continue;
      }
      openMap.delete(currentKey);

      // Check if we reached the goal
      if (current.x === end.x && current.y === end.y) {
        const path = this.reconstructPath(current);
        this.pathCache.set(cacheKey, path);
        return path;
      }

      closedSet.add(currentKey);

      // Check all neighbors (4-directional)
      const neighbors = [
        { x: current.x, y: current.y - 1 }, // Up
        { x: current.x, y: current.y + 1 }, // Down
        { x: current.x - 1, y: current.y }, // Left
        { x: current.x + 1, y: current.y }  // Right
      ];

      for (const neighbor of neighbors) {
        // Check bounds
        if (neighbor.x < 0 || neighbor.x >= boardWidth ||
            neighbor.y < 0 || neighbor.y >= boardHeight) {
          continue;
        }

        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // Check if already evaluated
        if (closedSet.has(neighborKey)) {
          continue;
        }

        // Check if traversable
        const tile = this.gameBoardService.getGameBoard()[neighbor.y][neighbor.x];
        if (!tile.isTraversable && tile.type !== BlockType.EXIT) {
          continue;
        }

        // Calculate costs
        const gScore = current.g + 1;
        const existingNode = openMap.get(neighborKey);

        // Skip if existing path to this neighbor is already better
        if (existingNode && gScore >= existingNode.g) {
          continue;
        }

        const hScore = this.heuristic(neighbor, end);
        const newNode: GridNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: current
        };

        // Insert new entry; stale entries for this key are skipped on extraction
        openMap.set(neighborKey, newNode);
        openHeap.insert(newNode);
      }
    }

    // No path found
    return [];
  }

  /**
   * Manhattan distance heuristic
   */
  private heuristic(a: { x: number, y: number }, b: { x: number, y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Reconstruct path from end node
   */
  private reconstructPath(endNode: GridNode): GridNode[] {
    const path: GridNode[] = [];
    let current: GridNode | undefined = endNode;

    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    return path;
  }

  /**
   * Get all spawner tiles
   */
  private getSpawnerTiles(): { row: number, col: number }[] {
    const spawners: { row: number, col: number }[] = [];
    const board = this.gameBoardService.getGameBoard();

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        if (board[row][col].type === BlockType.SPAWNER) {
          spawners.push({ row, col });
        }
      }
    }

    return spawners;
  }

  /**
   * Get all exit tiles
   */
  private getExitTiles(): { row: number, col: number }[] {
    const exits: { row: number, col: number }[] = [];
    const board = this.gameBoardService.getGameBoard();

    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        if (board[row][col].type === BlockType.EXIT) {
          exits.push({ row, col });
        }
      }
    }

    return exits;
  }

  /**
   * Convert grid coordinates to world coordinates
   */
  private gridToWorld(row: number, col: number): { x: number, z: number } {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const tileSize = this.gameBoardService.getTileSize();

    const x = (col - boardWidth / 2) * tileSize;
    const z = (row - boardHeight / 2) * tileSize;

    return { x, z };
  }

  /**
   * Build a direct 2-node path from start to end, ignoring terrain.
   * Used for FLYING enemies that bypass ground obstacles.
   */
  private buildStraightPath(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): GridNode[] {
    return [
      { x: start.x, y: start.y, g: 0, h: 0, f: 0 },
      { x: end.x,   y: end.y,   g: 0, h: 0, f: 0 }
    ];
  }

  /**
   * Returns the A* path from the first spawner to the first exit as world coordinates.
   * Used by path overlay visualization. Returns an empty array if no path exists.
   */
  getPathToExit(): { x: number; z: number }[] {
    const spawnerTiles = this.getSpawnerTiles();
    const exitTiles = this.getExitTiles();
    if (spawnerTiles.length === 0 || exitTiles.length === 0) return [];

    const spawner = spawnerTiles[0];
    const exit = exitTiles[0];
    const path = this.findPath(
      { x: spawner.col, y: spawner.row },
      { x: exit.col, y: exit.row }
    );
    if (path.length === 0) return [];

    return path.map(node => this.gridToWorld(node.y, node.x));
  }

  /**
   * Clear the path cache (call when board changes)
   */
  clearPathCache(): void {
    this.pathCache.clear();
  }

  /**
   * Full reset: remove all enemies from the scene, reset the ID counter,
   * and clear the path cache. Call on game restart to prevent stale state.
   */
  reset(scene: THREE.Scene): void {
    this.cleanup(scene);
    this.enemyCounter = 0;
    this.clearPathCache();
    this.modifierEffects = {};
    this.activeModifiers = new Set();
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
  }
}
