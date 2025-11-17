import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Enemy, EnemyType, ENEMY_STATS, GridNode } from '../models/enemy.model';
import { GameBoardService } from '../game-board.service';
import { BlockType } from '../models/game-board-tile';

@Injectable()
export class EnemyService {
  private enemies: Map<string, Enemy> = new Map();
  private enemyCounter = 0;
  private pathCache: Map<string, GridNode[]> = new Map();

  constructor(private gameBoardService: GameBoardService) {}

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
    const path = this.findPath({ x: col, y: row }, { x: exitTile.col, y: exitTile.row });

    if (path.length === 0) {
      console.warn('No valid path found from spawner to exit');
      return null;
    }

    // Create enemy
    const stats = ENEMY_STATS[type];
    const worldPos = this.gridToWorld(row, col);

    const enemy: Enemy = {
      id: `enemy-${this.enemyCounter++}`,
      type,
      position: { x: worldPos.x, y: stats.size, z: worldPos.z },
      gridPosition: { row, col },
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      value: stats.value,
      path,
      pathIndex: 0,
      distanceTraveled: 0
    };

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
    const reachedExit: string[] = [];

    this.enemies.forEach(enemy => {
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
   * A* pathfinding algorithm
   */
  private findPath(start: { x: number, y: number }, end: { x: number, y: number }): GridNode[] {
    const cacheKey = `${start.x},${start.y}-${end.x},${end.y}`;
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
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
   * Create a 3D mesh for an enemy
   */
  private createEnemyMesh(enemy: Enemy): THREE.Mesh {
    const stats = ENEMY_STATS[enemy.type];

    const geometry = new THREE.SphereGeometry(stats.size, 16, 16);
    const material = new THREE.MeshLambertMaterial({
      color: stats.color,
      emissive: stats.color,
      emissiveIntensity: 0.3
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Clear the path cache (call when board changes)
   */
  clearPathCache(): void {
    this.pathCache.clear();
  }
}
