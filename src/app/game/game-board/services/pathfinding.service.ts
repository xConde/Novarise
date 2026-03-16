import { Injectable } from '@angular/core';
import { GameBoardService } from '../game-board.service';
import { BlockType } from '../models/game-board-tile';
import { GridNode } from '../models/enemy.model';
import { MinHeap } from '../utils/min-heap';
import { gridToWorld } from '../utils/coordinate-utils';

@Injectable()
export class PathfindingService {
  private pathCache: Map<string, GridNode[]> = new Map();

  constructor(private gameBoardService: GameBoardService) {}

  /**
   * A* pathfinding from start to end on the current board state.
   * Returns an ordered array of GridNodes from start to end,
   * or an empty array if no path exists.
   * Results are cached by start-end key; call {@link invalidateCache} when the board changes.
   */
  findPath(start: { x: number; y: number }, end: { x: number; y: number }): GridNode[] {
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
   * Build a direct 2-node path from start to end, ignoring terrain.
   * Used for FLYING enemies that bypass ground obstacles.
   */
  buildStraightPath(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): GridNode[] {
    return [
      { x: start.x, y: start.y, g: 0, h: 0, f: 0 },
      { x: end.x,   y: end.y,   g: 0, h: 0, f: 0 }
    ];
  }

  /**
   * Clear the path cache. Call after any board mutation (tower placed/sold).
   */
  invalidateCache(): void {
    this.pathCache.clear();
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

    return path.map(node => this.gridToWorldPos(node.y, node.x));
  }

  /**
   * Full reset: clear the path cache.
   * Call on game restart to prevent stale cached paths.
   */
  reset(): void {
    this.invalidateCache();
  }

  /** Get all spawner tiles on the current board. */
  getSpawnerTiles(): { row: number; col: number }[] {
    const spawners: { row: number; col: number }[] = [];
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

  /** Get all exit tiles on the current board. */
  getExitTiles(): { row: number; col: number }[] {
    const exits: { row: number; col: number }[] = [];
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

  /** Delegate to shared coordinate utility with current board dimensions. */
  gridToWorldPos(row: number, col: number): { x: number; z: number } {
    return gridToWorld(
      row, col,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize()
    );
  }

  /** Manhattan distance heuristic for A*. */
  private heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /** Reconstruct path by walking parent pointers from the goal node back to the start. */
  private reconstructPath(endNode: GridNode): GridNode[] {
    const path: GridNode[] = [];
    let current: GridNode | undefined = endNode;

    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    return path;
  }
}
