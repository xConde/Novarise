import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, ENEMY_MESH_SEGMENTS, MINI_SWARM_MESH_SEGMENTS, GridNode, MINI_SWARM_STATS, FLYING_ENEMY_HEIGHT } from '../models/enemy.model';
import { GameBoardService } from '../game-board.service';
import { BlockType } from '../models/game-board-tile';
import { HEALTH_BAR_CONFIG, SHIELD_VISUAL_CONFIG, ENEMY_VISUAL_CONFIG, HEALER_CROSS_CONFIG } from '../constants/ui.constants';
import { DEFAULT_DIFFICULTY, DifficultyLevel, getDifficultyHealthMultiplier, getDifficultySpeedMultiplier } from '../models/difficulty.model';

export interface DamageResult {
  killed: boolean;
  spawnedEnemies: Enemy[]; // Mini-swarm enemies added to the scene on parent death
}

@Injectable()
export class EnemyService {
  private enemies: Map<string, Enemy> = new Map();
  private enemyCounter = 0;
  private pathCache: Map<string, GridNode[]> = new Map();
  private difficulty: DifficultyLevel = DEFAULT_DIFFICULTY;

  constructor(private gameBoardService: GameBoardService) {}

  /**
   * Set the active difficulty level. Must be called before the first wave
   * starts so that spawned enemies receive the correct health/speed scaling.
   */
  setDifficulty(difficulty: DifficultyLevel): void {
    this.difficulty = difficulty;
  }

  /** Returns the active difficulty level. */
  getDifficulty(): DifficultyLevel {
    return this.difficulty;
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

    // Apply difficulty scaling to health and speed
    const healthMult = getDifficultyHealthMultiplier(this.difficulty);
    const speedMult = getDifficultySpeedMultiplier(this.difficulty);
    const scaledHealth = Math.round(stats.health * healthMult);
    const scaledSpeed = stats.speed * speedMult;

    const enemy: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type,
      position: { x: worldPos.x, y: yPos, z: worldPos.z },
      gridPosition: { row, col },
      health: scaledHealth,
      maxHealth: scaledHealth,
      speed: scaledSpeed,
      value: stats.value,
      path,
      pathIndex: 0,
      distanceTraveled: 0
    };

    if (isFlying) {
      enemy.isFlying = true;
    }

    if (type === EnemyType.HEALER) {
      enemy.isHealer = true;
    }

    if (stats.maxShield !== undefined) {
      const scaledShield = Math.round(stats.maxShield * healthMult);
      enemy.shield = scaledShield;
      enemy.maxShield = scaledShield;
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
  /**
   * Heal nearby allies for all active HEALER enemies.
   * Called at the start of each updateEnemies tick before movement.
   * Does not heal self, dead enemies, or enemies beyond healRange tiles.
   */
  healNearbyEnemies(deltaTime: number): void {
    const tileSize = this.gameBoardService.getTileSize();

    this.enemies.forEach(healer => {
      if (!healer.isHealer || healer.health <= 0) return;
      // Frozen healers (speed <= 0 from Freeze ability) cannot heal allies
      if (healer.speed <= 0) return;

      const healerStats = ENEMY_STATS[EnemyType.HEALER];
      const healRange = healerStats.healRange!;
      const healRate = healerStats.healRate!;
      const healAmount = healRate * deltaTime;
      const rangeWorld = healRange * tileSize;

      this.enemies.forEach(ally => {
        if (ally.id === healer.id) return; // Skip self
        if (ally.health <= 0) return;       // Skip dead
        if (ally.health >= ally.maxHealth) return; // Already full

        const dx = ally.position.x - healer.position.x;
        const dz = ally.position.z - healer.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq <= rangeWorld * rangeWorld) {
          ally.health = Math.min(ally.maxHealth, ally.health + healAmount);
        }
      });
    });
  }

  updateEnemies(deltaTime: number): string[] {
    if (deltaTime <= 0) return [];

    this.healNearbyEnemies(deltaTime);

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
   * Update health bar planes to face the camera each frame (billboard effect).
   * Call this from the animate() loop after updateEnemies().
   */
  updateHealthBarFacing(camera: THREE.Camera): void {
    this.enemies.forEach(enemy => {
      if (!enemy.mesh) return;
      const healthBarBg = enemy.mesh.userData?.['healthBarBg'] as THREE.Mesh | undefined;
      const healthBarFg = enemy.mesh.userData?.['healthBarFg'] as THREE.Mesh | undefined;
      if (healthBarBg) {
        healthBarBg.lookAt(camera.position);
      }
      if (healthBarFg) {
        healthBarFg.lookAt(camera.position);
      }
    });
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
    } else if (enemy.isHealer) {
      // Cross shape: two merged BoxGeometry arms (horizontal + vertical)
      const hGeom = new THREE.BoxGeometry(
        HEALER_CROSS_CONFIG.armLength,
        HEALER_CROSS_CONFIG.armHeight,
        HEALER_CROSS_CONFIG.armWidth
      );
      const vGeom = new THREE.BoxGeometry(
        HEALER_CROSS_CONFIG.armWidth,
        HEALER_CROSS_CONFIG.armHeight,
        HEALER_CROSS_CONFIG.armLength
      );
      // Merge by copying attributes into a single BufferGeometry
      const crossGeom = new THREE.BufferGeometry();
      const hPos = hGeom.getAttribute('position') as THREE.BufferAttribute;
      const vPos = vGeom.getAttribute('position') as THREE.BufferAttribute;
      const merged = new Float32Array(hPos.array.length + vPos.array.length);
      merged.set(hPos.array as Float32Array, 0);
      merged.set(vPos.array as Float32Array, hPos.array.length);
      crossGeom.setAttribute('position', new THREE.BufferAttribute(merged, 3));
      crossGeom.computeVertexNormals();
      hGeom.dispose();
      vGeom.dispose();
      geometry = crossGeom;
    } else {
      geometry = new THREE.SphereGeometry(stats.size, ENEMY_MESH_SEGMENTS, ENEMY_MESH_SEGMENTS);
    }

    const material = new THREE.MeshLambertMaterial({
      color: stats.color,
      emissive: stats.color,
      emissiveIntensity: enemy.isHealer
        ? ENEMY_VISUAL_CONFIG.healerEmissive
        : ENEMY_VISUAL_CONFIG.shieldedEmissive,
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
    healthBarFg.position.set(0, barY + HEALTH_BAR_CONFIG.fgZOffset, 0);
    healthBarFg.lookAt(0, barY + HEALTH_BAR_CONFIG.fgZOffset, 1);

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
    const barWidth = HEALTH_BAR_CONFIG.width * HEALTH_BAR_CONFIG.miniSwarmWidthScale;
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
    healthBarFg.position.set(0, barY + HEALTH_BAR_CONFIG.fgZOffset, 0);
    healthBarFg.lookAt(0, barY + HEALTH_BAR_CONFIG.fgZOffset, 1);

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

    const openSet: GridNode[] = [];
    const closedSet: Set<string> = new Set();
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
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Find node with lowest f cost
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      // Check if we reached the goal
      if (current.x === end.x && current.y === end.y) {
        const path = this.reconstructPath(current);
        this.pathCache.set(cacheKey, path);
        return path;
      }

      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.y}`);

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

        // Check if already evaluated
        const neighborKey = `${neighbor.x},${neighbor.y}`;
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
        const hScore = this.heuristic(neighbor, end);
        const fScore = gScore + hScore;

        // Check if this path to neighbor is better
        const existingNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
        if (existingNode) {
          if (gScore < existingNode.g) {
            existingNode.g = gScore;
            existingNode.h = hScore;
            existingNode.f = fScore;
            existingNode.parent = current;
          }
        } else {
          openSet.push({
            x: neighbor.x,
            y: neighbor.y,
            g: gScore,
            h: hScore,
            f: fScore,
            parent: current
          });
        }
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
   * Clear the path cache (call when board changes)
   */
  clearPathCache(): void {
    this.pathCache.clear();
  }

  /**
   * Compute the world-space path from the first available spawner to the first
   * exit tile. Returns an array of {x, z} points suitable for path visualization.
   * Returns an empty array if no spawner or exit tile exists, or if A* finds no path.
   */
  computePreviewPath(): { x: number; z: number }[] {
    const spawnerTiles = this.getSpawnerTiles();
    if (spawnerTiles.length === 0) return [];

    const exitTiles = this.getExitTiles();
    if (exitTiles.length === 0) return [];

    const start = spawnerTiles[0];
    const exit = exitTiles[0];

    const gridPath = this.findPath(
      { x: start.col, y: start.row },
      { x: exit.col, y: exit.row }
    );

    return gridPath.map(node => this.gridToWorld(node.y, node.x));
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
