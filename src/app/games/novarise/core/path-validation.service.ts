import { Injectable } from '@angular/core';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../models/terrain-types.enum';
import { EDITOR_FLOOD_FILL_MAX_ITERATIONS } from '../constants/editor-ui.constants';

export interface PathValidationResult {
  valid: boolean;
  path?: { x: number; z: number }[];
}

/** Terrain types that enemies can walk on. Must match EnemyService pathfinding. */
const WALKABLE_TYPES = new Set<TerrainType>([TerrainType.BEDROCK, TerrainType.MOSS]);

/** 4-directional BFS offsets — matches the game's A* pathfinding directions. */
const DIRECTIONS: ReadonlyArray<{ dx: number; dz: number }> = [
  { dx: 0, dz: -1 }, // north
  { dx: 0, dz: 1 },  // south
  { dx: -1, dz: 0 }, // west
  { dx: 1, dz: 0 },  // east
];

@Injectable()
export class PathValidationService {
  /**
   * Validate whether a walkable path exists from `spawnPoint` to `exitPoint`
   * using 4-directional BFS. Returns the path if found.
   */
  public validate(state: TerrainGridState): PathValidationResult {
    const { tiles, gridSize, spawnPoint, exitPoint } = state;

    if (!spawnPoint || !exitPoint) {
      return { valid: false };
    }

    // Same-tile spawn/exit — no path (game would be degenerate)
    if (spawnPoint.x === exitPoint.x && spawnPoint.z === exitPoint.z) {
      return { valid: false };
    }

    // Spawn or exit on non-walkable terrain
    if (!this.isTileWalkable(tiles, spawnPoint.x, spawnPoint.z)) {
      return { valid: false };
    }
    if (!this.isTileWalkable(tiles, exitPoint.x, exitPoint.z)) {
      return { valid: false };
    }

    // BFS from spawn to exit
    const visited = new Set<string>();
    const parent = new Map<string, string | null>();

    const startKey = this.key(spawnPoint.x, spawnPoint.z);
    const goalKey = this.key(exitPoint.x, exitPoint.z);

    const queue: { x: number; z: number }[] = [spawnPoint];
    visited.add(startKey);
    parent.set(startKey, null);

    let iterations = 0;
    const maxIterations = Math.max(EDITOR_FLOOD_FILL_MAX_ITERATIONS, gridSize * gridSize);

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      const currentKey = this.key(current.x, current.z);

      if (currentKey === goalKey) {
        return { valid: true, path: this.reconstructPath(parent, startKey, goalKey) };
      }

      for (const { dx, dz } of DIRECTIONS) {
        const nx = current.x + dx;
        const nz = current.z + dz;

        if (nx < 0 || nx >= gridSize || nz < 0 || nz >= gridSize) continue;

        const neighborKey = this.key(nx, nz);
        if (visited.has(neighborKey)) continue;
        if (!this.isTileWalkable(tiles, nx, nz)) continue;

        visited.add(neighborKey);
        parent.set(neighborKey, currentKey);
        queue.push({ x: nx, z: nz });
      }
    }

    return { valid: false };
  }

  private isTileWalkable(tiles: TerrainType[][], x: number, z: number): boolean {
    return WALKABLE_TYPES.has(tiles[x]?.[z]);
  }

  private key(x: number, z: number): string {
    return `${x},${z}`;
  }

  private reconstructPath(
    parent: Map<string, string | null>,
    startKey: string,
    goalKey: string
  ): { x: number; z: number }[] {
    const path: { x: number; z: number }[] = [];
    let current: string | null = goalKey;

    while (current !== null) {
      const [x, z] = current.split(',').map(Number);
      path.unshift({ x, z });
      current = parent.get(current) ?? null;
      if (current === startKey) {
        const [sx, sz] = current.split(',').map(Number);
        path.unshift({ x: sx, z: sz });
        break;
      }
    }

    return path;
  }
}
