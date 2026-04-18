import { Injectable } from '@angular/core';
import { GameBoardService } from '../game-board.service';
import { BlockType } from '../models/game-board-tile';
import { GridNode } from '../models/enemy.model';
import { MinHeap } from '../utils/min-heap';
import { gridToWorld, gridToWorldInto } from '../utils/coordinate-utils';

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
   * Longest simple path (no revisits) from start to end using DFS with
   * no-revisit tracking. Returns the longest valid path as GridNode[],
   * or [] if no path exists.
   *
   * Longest path on a general grid is NP-hard in the worst case. On the
   * Novarise combat board (typically ~500 cells, ~50 traversable) this is
   * practically bounded because the DFS prunes: (1) any node already on
   * the current stack is skipped (no revisits), (2) paths shorter than the
   * best found are abandoned when no improvement is possible.
   *
   * Called by DETOUR (Sprint 14) to force enemies onto the longest route.
   * NOT cached — DETOUR is a rare card play, and the result depends on
   * the live board state which can change between calls.
   *
   * @param start {x: col, y: row} — inherits the same {x,y} = {col,row}
   *   convention used by findPath() for consistency.
   * @param end {x: col, y: row}
   * @param maxDepth Safety cap. Defaults to boardWidth * boardHeight
   *   (no simple path can exceed total cell count). Lower this to
   *   budget worst-case compute at the call site.
   */
  findLongestPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    maxDepth?: number,
  ): GridNode[] {
    const boardWidth = this.gameBoardService.getBoardWidth();
    const boardHeight = this.gameBoardService.getBoardHeight();
    const board = this.gameBoardService.getGameBoard();
    const depth = maxDepth ?? boardWidth * boardHeight;
    const iterationBudget = depth * depth;

    // Early-out: start must be in-bounds and traversable (or exit)
    if (
      start.x < 0 || start.x >= boardWidth ||
      start.y < 0 || start.y >= boardHeight
    ) {
      return [];
    }

    /** Iterative DFS frame — tracks which neighbor index to try next. */
    interface DfsFrame {
      node: GridNode;
      childIdx: number;
    }

    const visited = new Set<string>();
    const stack: DfsFrame[] = [];
    const currentPath: GridNode[] = [];
    let best: GridNode[] = [];
    let iterations = 0;
    let budgetExceeded = false;

    const startNode: GridNode = { x: start.x, y: start.y, g: 0, h: 0, f: 0 };
    stack.push({ node: startNode, childIdx: 0 });
    visited.add(`${start.x},${start.y}`);
    currentPath.push(startNode);

    const NEIGHBORS: ReadonlyArray<{ dx: number; dy: number }> = [
      { dx: 0, dy: -1 }, // Up
      { dx: 0, dy:  1 }, // Down
      { dx: -1, dy: 0 }, // Left
      { dx:  1, dy: 0 }, // Right
    ];

    while (stack.length > 0) {
      if (++iterations > iterationBudget) {
        budgetExceeded = true;
        break;
      }

      const frame = stack[stack.length - 1];
      const { node } = frame;

      // Check if we are at the destination
      if (node.x === end.x && node.y === end.y) {
        if (currentPath.length > best.length) {
          best = [...currentPath];
        }
        // Pop — cannot go further from the exit without revisiting
        stack.pop();
        currentPath.pop();
        visited.delete(`${node.x},${node.y}`);
        continue;
      }

      // Try next neighbor
      let pushed = false;
      while (frame.childIdx < NEIGHBORS.length) {
        const { dx, dy } = NEIGHBORS[frame.childIdx];
        frame.childIdx++;
        const nx = node.x + dx;
        const ny = node.y + dy;

        if (nx < 0 || nx >= boardWidth || ny < 0 || ny >= boardHeight) continue;
        const nKey = `${nx},${ny}`;
        if (visited.has(nKey)) continue;

        const tile = board[ny][nx];
        if (!tile.isTraversable && tile.type !== BlockType.EXIT) continue;

        const child: GridNode = { x: nx, y: ny, g: 0, h: 0, f: 0 };
        visited.add(nKey);
        currentPath.push(child);
        stack.push({ node: child, childIdx: 0 });
        pushed = true;
        break;
      }

      if (!pushed) {
        // No more neighbors — backtrack
        stack.pop();
        currentPath.pop();
        visited.delete(`${node.x},${node.y}`);
      }
    }

    if (budgetExceeded) {
      console.warn(
        `[PathfindingService.findLongestPath] Iteration budget (${iterationBudget}) exceeded. ` +
        `Returning best path found so far (length=${best.length}).`
      );
    }

    return best;
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

  /**
   * Like gridToWorldPos but writes into an existing object instead of allocating.
   * Use in hot paths (e.g., per-enemy per-frame movement) to avoid GC pressure.
   */
  gridToWorldPosInto(row: number, col: number, out: { x: number; z: number }): void {
    gridToWorldInto(
      row, col,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize(),
      out
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
