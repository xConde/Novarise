import { Injectable } from '@angular/core';
import { GameBoardService } from '../game-board.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';

/** Maximum strategic multiplier (1.0 = tower costs double at most strategic spot). */
const MAX_STRATEGIC_MULTIPLIER = 1.0;

/** Weight factors for each pricing component. */
const PRICING_WEIGHTS = {
  /** Premium for tiles adjacent to the enemy path (0-4 adjacent path tiles). */
  pathAdjacency: 0.4,
  /** Premium for tiles that would significantly extend the enemy path. */
  chokepoint: 0.4,
  /** Mild premium for tiles near spawners or exits. */
  proximity: 0.2,
} as const;

/** How many tiles from a spawner/exit before the proximity premium drops to zero. */
const PROXIMITY_FALLOFF_DISTANCE = 6;

/**
 * Minimum adjacency count to reach full path-adjacency score.
 * A tile touching 2+ path tiles gets the maximum adjacency premium.
 */
const PATH_ADJACENCY_SATURATION = 2;

export interface TilePriceInfo {
  /** The multiplied cost to place this tower type on this tile. */
  cost: number;
  /** The strategic multiplier applied (0.0 = no premium, up to MAX_STRATEGIC_MULTIPLIER). */
  strategicMultiplier: number;
  /** Whether this tile has any strategic premium. */
  isPremium: boolean;
}

/** Threshold above which a tile is considered to have a meaningful strategic premium. */
const PREMIUM_THRESHOLD = 0.1;

@Injectable()
export class TilePricingService {
  /** Cached strategic values per tile. Key: "row-col", value: multiplier (0.0 - 1.0). */
  private strategicCache: Map<string, number> = new Map();
  private cacheValid = false;

  constructor(private gameBoardService: GameBoardService) {}

  /**
   * Get the price info for placing a tower type on a specific tile.
   * @param type The tower type to price
   * @param row Board row
   * @param col Board column
   * @param costMultiplier External cost multiplier (from game modifiers)
   */
  getTilePrice(type: TowerType, row: number, col: number, costMultiplier: number = 1): TilePriceInfo {
    const baseCost = TOWER_CONFIGS[type].cost;
    const strategic = this.getStrategicValue(row, col);
    const totalMultiplier = costMultiplier * (1 + strategic * MAX_STRATEGIC_MULTIPLIER);
    return {
      cost: Math.round(baseCost * totalMultiplier),
      strategicMultiplier: strategic,
      isPremium: strategic > PREMIUM_THRESHOLD,
    };
  }

  /**
   * Get raw strategic value for a tile (0.0 = no value, 1.0 = maximum strategic value).
   * Uses cached values; call invalidateCache() when the board changes.
   */
  getStrategicValue(row: number, col: number): number {
    if (!this.cacheValid) {
      this.computeStrategicValues();
    }
    return this.strategicCache.get(`${row}-${col}`) ?? 0;
  }

  /** Invalidate cached strategic values. Call after any board mutation (tower placed/sold). */
  invalidateCache(): void {
    this.cacheValid = false;
    this.strategicCache.clear();
  }

  /**
   * Compute strategic values for all BASE tiles on the board.
   * Factors:
   * 1. Path adjacency — how many adjacent tiles are on the current enemy path
   * 2. Chokepoint — does this tile have few free neighbors, making it a bottleneck?
   * 3. Proximity — distance to nearest spawner or exit point
   */
  private computeStrategicValues(): void {
    this.strategicCache.clear();
    const board = this.gameBoardService.getGameBoard();
    const width = this.gameBoardService.getBoardWidth();
    const height = this.gameBoardService.getBoardHeight();
    const spawnerTiles = this.gameBoardService.getSpawnerTiles();
    const exitTiles = this.gameBoardService.getExitTiles();

    // Build a set of tiles on the current shortest path (BFS flood from spawners to exits)
    const pathTiles = this.computePathTiles(board, width, height, spawnerTiles, exitTiles);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tile = board[row][col];
        // Only price BASE tiles that could receive a tower
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) continue;

        const key = `${row}-${col}`;

        // Factor 1: Path adjacency (0-1)
        const adjacencyScore = this.computePathAdjacency(row, col, pathTiles);

        // Factor 2: Chokepoint value (0-1)
        const chokepointScore = this.computeChokepointValue(row, col, board, width, height);

        // Factor 3: Proximity to spawner/exit (0-1)
        const proximityScore = this.computeProximityScore(row, col, spawnerTiles, exitTiles);

        const weighted =
          adjacencyScore * PRICING_WEIGHTS.pathAdjacency +
          chokepointScore * PRICING_WEIGHTS.chokepoint +
          proximityScore * PRICING_WEIGHTS.proximity;

        // Clamp to [0, 1]
        this.strategicCache.set(key, Math.min(1, Math.max(0, weighted)));
      }
    }

    this.cacheValid = true;
  }

  /**
   * BFS from all spawners to find tiles on shortest paths to exits.
   * Returns a Set of "row-col" keys representing path tiles.
   */
  private computePathTiles(
    board: GameBoardTile[][],
    width: number,
    height: number,
    spawnerTiles: number[][],
    exitTiles: number[][]
  ): Set<string> {
    const pathTiles = new Set<string>();
    if (spawnerTiles.length === 0 || exitTiles.length === 0) return pathTiles;

    const exitSet = new Set(exitTiles.map(([r, c]) => `${r}-${c}`));
    const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    // BFS from each spawner to find all tiles on shortest path to any exit
    for (const [sRow, sCol] of spawnerTiles) {
      const visited = new Map<string, string | null>(); // key -> parent key
      const queue: [number, number][] = [[sRow, sCol]];
      visited.set(`${sRow}-${sCol}`, null);
      let foundExit: string | null = null;

      while (queue.length > 0 && !foundExit) {
        const [r, c] = queue.shift()!;
        const key = `${r}-${c}`;

        if (exitSet.has(key)) {
          foundExit = key;
          break;
        }

        for (const [dr, dc] of directions) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
          const nKey = `${nr}-${nc}`;
          if (visited.has(nKey)) continue;
          const nTile = board[nr][nc];
          // Traversable: BASE with no tower, SPAWNER, EXIT — skip WALL, TOWER, and occupied BASE
          if (nTile.type === BlockType.WALL) continue;
          if (nTile.type === BlockType.TOWER) continue;
          if (nTile.type === BlockType.BASE && nTile.towerType !== null) continue;
          visited.set(nKey, key);
          queue.push([nr, nc]);
        }
      }

      // Trace back from exit to spawner, marking path tiles
      if (foundExit) {
        let current: string | null = foundExit;
        while (current !== null) {
          pathTiles.add(current);
          current = visited.get(current) ?? null;
        }
      }
    }

    return pathTiles;
  }

  /** Count how many of 4 cardinal neighbors are on the enemy path (0-4, normalized to 0-1). */
  private computePathAdjacency(row: number, col: number, pathTiles: Set<string>): number {
    const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let count = 0;
    for (const [dr, dc] of directions) {
      if (pathTiles.has(`${row + dr}-${col + dc}`)) count++;
    }
    // Normalize: PATH_ADJACENCY_SATURATION+ adjacent path tiles = full score
    return Math.min(1, count / PATH_ADJACENCY_SATURATION);
  }

  /**
   * Estimate chokepoint value by counting how many free cardinal neighbors this tile has.
   * A tile with fewer free neighbors (more walls/towers around it) is more of a chokepoint.
   */
  private computeChokepointValue(
    row: number,
    col: number,
    board: GameBoardTile[][],
    width: number,
    height: number
  ): number {
    const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let freeNeighbors = 0;

    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      const tile = board[nr][nc];
      // A neighbor is "blocked" (not free) if it is a wall, a tower, or an
      // occupied BASE tile (BASE with towerType set, which should not happen
      // in practice since placeTower replaces it with TOWER type, but guard anyway).
      const isBlocked =
        tile.type === BlockType.WALL ||
        tile.type === BlockType.TOWER ||
        (tile.type === BlockType.BASE && tile.towerType !== null);
      if (!isBlocked) {
        freeNeighbors++;
      }
    }

    // Normalize against 4 (max possible neighbors) to avoid inflating
    // corner/edge tiles which have fewer than 4 neighbors.
    // Corner tile (2 neighbors, 2 blocked): 2/4 free = 0.5, not 1.0.
    const maxNeighbors = 4;
    return 1 - (freeNeighbors / maxNeighbors);
  }

  /** Distance-based premium for tiles near spawners or exits. */
  private computeProximityScore(
    row: number,
    col: number,
    spawnerTiles: number[][],
    exitTiles: number[][]
  ): number {
    let minDist = Infinity;

    for (const [sr, sc] of spawnerTiles) {
      const dist = Math.abs(row - sr) + Math.abs(col - sc);
      minDist = Math.min(minDist, dist);
    }
    for (const [er, ec] of exitTiles) {
      const dist = Math.abs(row - er) + Math.abs(col - ec);
      minDist = Math.min(minDist, dist);
    }

    if (minDist >= PROXIMITY_FALLOFF_DISTANCE) return 0;
    return 1 - (minDist / PROXIMITY_FALLOFF_DISTANCE);
  }
}
