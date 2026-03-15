import { Injectable } from '@angular/core';
import { GameBoardService } from '../game-board.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum strategic multiplier applied on top of base cost (1.0 = up to 2× cost). */
const MAX_STRATEGIC_MULTIPLIER = 1.0;

/**
 * Weight factors for each pricing component.
 * Must sum to 1.0.
 */
const PRICING_WEIGHTS = {
  /**
   * How much longer the enemy path becomes if this tile is blocked,
   * blended with local corridor tightness for structural bottleneck detection.
   */
  pathLengthImpact: 0.50,
  /** How many cardinal neighbors are on the current shortest path. */
  pathAdjacency: 0.25,
  /** Manhattan-distance premium for tiles near spawners or exits. */
  proximity: 0.25,
} as const;

/**
 * Sub-weights within the pathLengthImpact factor.
 * BFS delta gets the majority weight; local tightness provides a structural
 * floor so corridor tiles score higher even when the active path routes elsewhere.
 * Must sum to 1.0.
 */
const IMPACT_SUB_WEIGHTS = {
  /** Measured path-length delta when this tile is blocked. */
  bfsDelta: 0.80,
  /**
   * Local corridor tightness: fraction of cardinal directions that are blocked
   * (walls, placed towers, or out-of-bounds).  A tile with 3 of 4 neighbours
   * blocked is structurally constrained regardless of the current route.
   */
  tightness: 0.20,
} as const;

/**
 * Path-length delta threshold at which a tile reaches maximum BFS impact score (1.0).
 * A detour of PATH_IMPACT_SATURATION tiles or more maps to a full score of 1.0.
 */
const PATH_IMPACT_SATURATION = 10;

/** How many tiles from a spawner/exit before the proximity premium drops to zero. */
const PROXIMITY_FALLOFF_DISTANCE = 6;

/**
 * Minimum adjacency count to reach full path-adjacency score.
 * A tile touching PATH_ADJACENCY_SATURATION+ path tiles gets the maximum adjacency premium.
 */
const PATH_ADJACENCY_SATURATION = 2;

/** Maximum number of cardinal directions (used as denominator for tightness). */
const MAX_CARDINAL_DIRECTIONS = 4;

/** Threshold above which a tile is considered to have a meaningful strategic premium. */
const PREMIUM_THRESHOLD = 0.1;

/**
 * Chebyshev-distance search radius around current path tiles within which a tile
 * is eligible for full BFS impact computation.
 * Tiles outside this radius cannot meaningfully extend the path and receive bfsDelta=0,
 * keeping their impactScore purely tightness-driven.
 */
const PATH_PROXIMITY_RADIUS = 2;

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Color tier for heatmap rendering, ordered from cheapest to most expensive.
 * Exported so components and constants can reference without a circular dep.
 */
export type StrategicTier = 'base' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Tier thresholds based on the strategic multiplier (0.0–1.0).
 * A multiplier below `low` maps to 'base' (no premium).
 */
export const STRATEGIC_TIERS = {
  low: 0.15,      // 0–15%  → base
  medium: 0.35,   // 15–35% → low
  high: 0.60,     // 35–60% → medium
  critical: 0.80, // 60–80% → high
                  // 80–100%→ critical
} as const;

export interface TilePriceInfo {
  /** The final cost to place this tower type on this tile. */
  cost: number;
  /** Raw strategic multiplier (0.0 = no premium, 1.0 = maximum premium). */
  strategicMultiplier: number;
  /** Percentage increase over base cost (0–100), for display labels. */
  percentIncrease: number;
  /** Color tier for heatmap rendering. */
  tier: StrategicTier;
  /** Whether this tile has any strategic premium. */
  isPremium: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Cardinal directions for BFS and neighbour scanning. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TilePricingService {
  /** Cached strategic values per tile. Key: "row-col", value: multiplier (0.0–1.0). */
  private strategicCache: Map<string, number> = new Map();
  private cacheValid = false;

  constructor(private gameBoardService: GameBoardService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get the price info for placing a tower type on a specific tile.
   * @param type Tower type to price
   * @param row Board row
   * @param col Board column
   * @param costMultiplier External cost multiplier (from game modifiers, default 1)
   */
  getTilePrice(type: TowerType, row: number, col: number, costMultiplier: number = 1): TilePriceInfo {
    const baseCost = TOWER_CONFIGS[type].cost;
    const strategic = this.getStrategicValue(row, col);
    const totalMultiplier = costMultiplier * (1 + strategic * MAX_STRATEGIC_MULTIPLIER);
    const cost = Math.round(baseCost * totalMultiplier);
    const percentIncrease = Math.round(strategic * MAX_STRATEGIC_MULTIPLIER * 100);
    return {
      cost,
      strategicMultiplier: strategic,
      percentIncrease,
      tier: this.multiplierToTier(strategic),
      isPremium: strategic > PREMIUM_THRESHOLD,
    };
  }

  /**
   * Get the price info for every priceable tile in a single call.
   * Useful for heatmap rendering — avoids repeated per-tile cache lookups.
   * @param type Tower type to price
   * @param costMultiplier External cost multiplier (from game modifiers, default 1)
   */
  getTilePriceMap(type: TowerType, costMultiplier: number = 1): Map<string, TilePriceInfo> {
    if (!this.cacheValid) {
      this.computeStrategicValues();
    }
    const result = new Map<string, TilePriceInfo>();
    for (const [key] of this.strategicCache) {
      const dashIdx = key.indexOf('-');
      const row = parseInt(key.slice(0, dashIdx), 10);
      const col = parseInt(key.slice(dashIdx + 1), 10);
      result.set(key, this.getTilePrice(type, row, col, costMultiplier));
    }
    return result;
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

  /**
   * Get the strategic tier for a tile without computing the full price.
   * Useful for heatmap coloring when cost is not needed.
   */
  getStrategicTier(row: number, col: number): StrategicTier {
    return this.multiplierToTier(this.getStrategicValue(row, col));
  }

  /** Invalidate cached strategic values. Call after any board mutation (tower placed/sold). */
  invalidateCache(): void {
    this.cacheValid = false;
    this.strategicCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Core computation
  // ---------------------------------------------------------------------------

  /**
   * Compute strategic values for all priceable BASE tiles on the board.
   *
   * Three factors (weighted sum):
   * 1. Path-length impact (50%): BFS path-delta when blocked, blended with local
   *    corridor tightness so structural bottlenecks score even off the active route.
   * 2. Path adjacency (25%): how many cardinal neighbours are on the shortest path.
   * 3. Proximity to spawner/exit (25%): Manhattan distance falloff.
   *
   * Optimisation: only tiles within PATH_PROXIMITY_RADIUS of the current path
   * get a full BFS delta run. Tiles further away receive bfsDelta=0 and only
   * accumulate tightness within the impact bucket.
   */
  private computeStrategicValues(): void {
    this.strategicCache.clear();

    const board = this.gameBoardService.getGameBoard();
    const width = this.gameBoardService.getBoardWidth();
    const height = this.gameBoardService.getBoardHeight();
    const spawnerTiles = this.gameBoardService.getSpawnerTiles();
    const exitTiles = this.gameBoardService.getExitTiles();

    // Baseline: shortest path length before any tile is blocked.
    const baselineLength = this.bfsShortestPath(board, width, height, spawnerTiles, exitTiles, null);

    // Path tiles are used for adjacency scoring and the near-path proximity filter.
    const pathTiles = this.computePathTiles(board, width, height, spawnerTiles, exitTiles);

    // Set of tile keys within PATH_PROXIMITY_RADIUS of any path tile.
    // Only these are eligible for the BFS delta sub-computation.
    const nearPathSet = this.buildNearPathSet(pathTiles, width, height);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const tile = board[row][col];
        // Only price BASE tiles that are purchasable and currently unoccupied.
        if (tile.type !== BlockType.BASE || !tile.isPurchasable || tile.towerType !== null) {
          continue;
        }

        const key = `${row}-${col}`;

        // Factor 1: Path-length impact (0–1)
        const impactScore = this.computePathLengthImpact(
          row, col, board, width, height, spawnerTiles, exitTiles,
          baselineLength, nearPathSet
        );

        // Factor 2: Path adjacency (0–1)
        const adjacencyScore = this.computePathAdjacency(row, col, pathTiles);

        // Factor 3: Proximity to spawner/exit (0–1)
        const proximityScore = this.computeProximityScore(row, col, spawnerTiles, exitTiles);

        const weighted =
          impactScore    * PRICING_WEIGHTS.pathLengthImpact +
          adjacencyScore * PRICING_WEIGHTS.pathAdjacency +
          proximityScore * PRICING_WEIGHTS.proximity;

        this.strategicCache.set(key, Math.min(1, Math.max(0, weighted)));
      }
    }

    this.cacheValid = true;
  }

  // ---------------------------------------------------------------------------
  // Factor 1: Path-length impact (BFS delta + structural tightness)
  // ---------------------------------------------------------------------------

  /**
   * Compute the path-length impact score for a single tile.
   *
   * The score is a weighted blend of two sub-signals:
   * - BFS delta (80%): how many tiles longer the shortest path becomes when this
   *   tile is blocked.  Tiles far from the active route receive bfsDelta=0.
   * - Local tightness (20%): fraction of cardinal directions that are impassable
   *   (out-of-bounds, walls, or placed towers).  Captures structural bottlenecks
   *   that remain strategically significant even when the active path routes elsewhere.
   */
  private computePathLengthImpact(
    row: number,
    col: number,
    board: GameBoardTile[][],
    width: number,
    height: number,
    spawnerTiles: number[][],
    exitTiles: number[][],
    baselineLength: number,
    nearPathSet: Set<string>
  ): number {
    // BFS delta — skipped for tiles too far from the active path.
    let bfsDelta = 0;
    if (nearPathSet.has(`${row}-${col}`)) {
      const newLength = this.bfsShortestPath(
        board, width, height, spawnerTiles, exitTiles, [row, col]
      );
      if (newLength === Infinity) {
        bfsDelta = 1.0; // Disconnects all paths — maximum impact.
      } else if (baselineLength !== Infinity) {
        const delta = newLength - baselineLength;
        bfsDelta = Math.min(1, Math.max(0, delta / PATH_IMPACT_SATURATION));
      }
    }

    // Local tightness — fraction of blocked cardinal directions.
    const tightness = this.computeLocalTightness(row, col, board, width, height);

    return IMPACT_SUB_WEIGHTS.bfsDelta * bfsDelta + IMPACT_SUB_WEIGHTS.tightness * tightness;
  }

  /**
   * BFS from all spawners simultaneously (multi-source) to find the shortest
   * path length (in tiles) to any exit tile.
   *
   * @param blockedTile Optional tile to treat as impassable during this run.
   * @returns Shortest path length, or Infinity if no path exists.
   */
  private bfsShortestPath(
    board: GameBoardTile[][],
    width: number,
    height: number,
    spawnerTiles: number[][],
    exitTiles: number[][],
    blockedTile: [number, number] | null
  ): number {
    if (spawnerTiles.length === 0 || exitTiles.length === 0) return Infinity;

    const exitSet = new Set(exitTiles.map(([r, c]) => `${r}-${c}`));
    const blockedKey = blockedTile ? `${blockedTile[0]}-${blockedTile[1]}` : null;

    const visited = new Set<string>();
    // Queue stores [row, col, distance]; use a typed flat array for efficiency.
    const queue: Array<[number, number, number]> = [];

    for (const [sRow, sCol] of spawnerTiles) {
      const sKey = `${sRow}-${sCol}`;
      if (visited.has(sKey)) continue;
      visited.add(sKey);
      queue.push([sRow, sCol, 0]);
    }

    let head = 0;
    while (head < queue.length) {
      const [r, c, dist] = queue[head++];
      const key = `${r}-${c}`;

      if (exitSet.has(key)) {
        return dist;
      }

      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;

        const nKey = `${nr}-${nc}`;
        if (visited.has(nKey)) continue;
        if (nKey === blockedKey) continue;
        if (!this.isTileTraversable(board[nr][nc])) continue;

        visited.add(nKey);
        queue.push([nr, nc, dist + 1]);
      }
    }

    return Infinity;
  }

  /** Returns true if enemies can traverse this tile (BASE with no tower, SPAWNER, EXIT). */
  private isTileTraversable(tile: GameBoardTile): boolean {
    if (tile.type === BlockType.WALL) return false;
    if (tile.type === BlockType.TOWER) return false;
    if (tile.type === BlockType.BASE && tile.towerType !== null) return false;
    return true;
  }

  /**
   * Compute local corridor tightness: the fraction of the 4 cardinal directions
   * that are impassable (out-of-bounds, wall, or placed tower).
   *
   * Returns 0.0 when all 4 neighbours are free, 1.0 when all 4 are blocked.
   * Uses MAX_CARDINAL_DIRECTIONS as denominator so edge/corner tiles are not
   * artificially inflated.
   */
  private computeLocalTightness(
    row: number,
    col: number,
    board: GameBoardTile[][],
    width: number,
    height: number
  ): number {
    let freeCount = 0;
    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
      if (this.isTileTraversable(board[nr][nc])) freeCount++;
    }
    // freeCount / MAX_CARDINAL_DIRECTIONS normalises across edge/corner tiles:
    // an open corner (2 in-bounds free, 2 out-of-bounds) gives tightness=0.5,
    // not 1.0, preventing false premiums on otherwise unremarkable corners.
    return 1 - (freeCount / MAX_CARDINAL_DIRECTIONS);
  }

  // ---------------------------------------------------------------------------
  // Factor 2: Path adjacency
  // ---------------------------------------------------------------------------

  /** Count how many of 4 cardinal neighbours are on the enemy path (normalised to 0–1). */
  private computePathAdjacency(row: number, col: number, pathTiles: Set<string>): number {
    let count = 0;
    for (const [dr, dc] of DIRECTIONS) {
      if (pathTiles.has(`${row + dr}-${col + dc}`)) count++;
    }
    return Math.min(1, count / PATH_ADJACENCY_SATURATION);
  }

  // ---------------------------------------------------------------------------
  // Factor 3: Proximity
  // ---------------------------------------------------------------------------

  /** Distance-based premium for tiles near spawners or exits (linear falloff). */
  private computeProximityScore(
    row: number,
    col: number,
    spawnerTiles: number[][],
    exitTiles: number[][]
  ): number {
    let minDist = Infinity;

    for (const [sr, sc] of spawnerTiles) {
      minDist = Math.min(minDist, Math.abs(row - sr) + Math.abs(col - sc));
    }
    for (const [er, ec] of exitTiles) {
      minDist = Math.min(minDist, Math.abs(row - er) + Math.abs(col - ec));
    }

    if (minDist >= PROXIMITY_FALLOFF_DISTANCE) return 0;
    return 1 - (minDist / PROXIMITY_FALLOFF_DISTANCE);
  }

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  /**
   * BFS from each spawner; traces back from the first reached exit to build
   * the set of tiles on the shortest path.  Used for adjacency scoring and
   * the near-path proximity filter.
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

    for (const [sRow, sCol] of spawnerTiles) {
      const visited = new Map<string, string | null>(); // key → parent key
      const queue: [number, number][] = [[sRow, sCol]];
      visited.set(`${sRow}-${sCol}`, null);
      let foundExit: string | null = null;

      let head = 0;
      while (head < queue.length && !foundExit) {
        const [r, c] = queue[head++];
        const key = `${r}-${c}`;

        if (exitSet.has(key)) {
          foundExit = key;
          break;
        }

        for (const [dr, dc] of DIRECTIONS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue;
          const nKey = `${nr}-${nc}`;
          if (visited.has(nKey)) continue;
          if (!this.isTileTraversable(board[nr][nc])) continue;
          visited.set(nKey, key);
          queue.push([nr, nc]);
        }
      }

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

  /**
   * Build the set of tile keys within PATH_PROXIMITY_RADIUS (Chebyshev distance)
   * of any path tile.  Only tiles in this set receive full BFS delta computation.
   */
  private buildNearPathSet(
    pathTiles: Set<string>,
    width: number,
    height: number
  ): Set<string> {
    const nearPathSet = new Set<string>();
    for (const key of pathTiles) {
      const dashIdx = key.indexOf('-');
      const pr = parseInt(key.slice(0, dashIdx), 10);
      const pc = parseInt(key.slice(dashIdx + 1), 10);
      for (let dr = -PATH_PROXIMITY_RADIUS; dr <= PATH_PROXIMITY_RADIUS; dr++) {
        for (let dc = -PATH_PROXIMITY_RADIUS; dc <= PATH_PROXIMITY_RADIUS; dc++) {
          const nr = pr + dr;
          const nc = pc + dc;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
            nearPathSet.add(`${nr}-${nc}`);
          }
        }
      }
    }
    return nearPathSet;
  }

  // ---------------------------------------------------------------------------
  // Tier helper
  // ---------------------------------------------------------------------------

  /** Map a strategic multiplier (0–1) to a StrategicTier. */
  private multiplierToTier(multiplier: number): StrategicTier {
    if (multiplier >= STRATEGIC_TIERS.critical) return 'critical';
    if (multiplier >= STRATEGIC_TIERS.high)     return 'high';
    if (multiplier >= STRATEGIC_TIERS.medium)   return 'medium';
    if (multiplier >= STRATEGIC_TIERS.low)      return 'low';
    return 'base';
  }
}
