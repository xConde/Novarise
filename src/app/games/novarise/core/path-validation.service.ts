import { Injectable } from '@angular/core';
import { TerrainGridState, TerrainGridStateLegacy } from '../features/terrain-editor/terrain-grid-state.interface';
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
   * Validate whether every spawn point can reach at least one exit point
   * using 4-directional BFS. Returns valid only if ALL spawn points are reachable.
   *
   * Handles both v2 (spawnPoints/exitPoints arrays) and v1 (spawnPoint/exitPoint) formats.
   */
  public validate(state: TerrainGridState): PathValidationResult {
    const { tiles, gridSize } = state;

    // Resolve spawn/exit arrays — handle v1 backward compat
    const spawnPoints = this.resolveSpawnPoints(state);
    const exitPoints = this.resolveExitPoints(state);

    if (spawnPoints.length === 0 || exitPoints.length === 0) {
      return { valid: false };
    }

    // Validate every spawn can reach at least one exit
    for (const spawn of spawnPoints) {
      // Check spawn is on walkable terrain
      if (!this.isTileWalkable(tiles, spawn.x, spawn.z)) {
        return { valid: false };
      }

      const reachableExits = this.bfsToAnyExit(tiles, gridSize, spawn, exitPoints);
      if (!reachableExits) {
        return { valid: false };
      }
    }

    // All spawn points validated — return path from first spawn to first reachable exit
    const firstPath = this.bfsPath(tiles, gridSize, spawnPoints[0], exitPoints);
    return { valid: true, path: firstPath ?? undefined };
  }

  /**
   * Resolve spawn points from either v2 array or v1 single-point format.
   */
  private resolveSpawnPoints(state: TerrainGridState): { x: number; z: number }[] {
    if (state.spawnPoints && Array.isArray(state.spawnPoints) && state.spawnPoints.length > 0) {
      return state.spawnPoints;
    }
    // v1 backward compat
    const legacy = state as unknown as TerrainGridStateLegacy;
    if (legacy.spawnPoint) {
      return [legacy.spawnPoint];
    }
    return [];
  }

  /**
   * Resolve exit points from either v2 array or v1 single-point format.
   */
  private resolveExitPoints(state: TerrainGridState): { x: number; z: number }[] {
    if (state.exitPoints && Array.isArray(state.exitPoints) && state.exitPoints.length > 0) {
      return state.exitPoints;
    }
    // v1 backward compat
    const legacy = state as unknown as TerrainGridStateLegacy;
    if (legacy.exitPoint) {
      return [legacy.exitPoint];
    }
    return [];
  }

  /**
   * BFS from a spawn point — returns true if ANY exit is reachable.
   */
  private bfsToAnyExit(
    tiles: TerrainType[][],
    gridSize: number,
    spawn: { x: number; z: number },
    exitPoints: { x: number; z: number }[]
  ): boolean {
    // All exits must be on walkable terrain (checked here for early exit)
    const walkableExits = exitPoints.filter(e => this.isTileWalkable(tiles, e.x, e.z));
    if (walkableExits.length === 0) return false;

    // Same-tile check
    for (const exit of walkableExits) {
      if (spawn.x === exit.x && spawn.z === exit.z) {
        return false; // degenerate — same tile
      }
    }

    const exitKeys = new Set(walkableExits.map(e => this.key(e.x, e.z)));

    const visited = new Set<string>();
    const startKey = this.key(spawn.x, spawn.z);
    const queue: { x: number; z: number }[] = [spawn];
    visited.add(startKey);

    let iterations = 0;
    const maxIterations = Math.max(EDITOR_FLOOD_FILL_MAX_ITERATIONS, gridSize * gridSize);

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      const currentKey = this.key(current.x, current.z);

      if (exitKeys.has(currentKey)) {
        return true;
      }

      for (const { dx, dz } of DIRECTIONS) {
        const nx = current.x + dx;
        const nz = current.z + dz;

        if (nx < 0 || nx >= gridSize || nz < 0 || nz >= gridSize) continue;

        const neighborKey = this.key(nx, nz);
        if (visited.has(neighborKey)) continue;
        if (!this.isTileWalkable(tiles, nx, nz)) continue;

        visited.add(neighborKey);
        queue.push({ x: nx, z: nz });
      }
    }

    return false;
  }

  /**
   * BFS from a spawn point to any exit, returning the path if found.
   */
  private bfsPath(
    tiles: TerrainType[][],
    gridSize: number,
    spawn: { x: number; z: number },
    exitPoints: { x: number; z: number }[]
  ): { x: number; z: number }[] | null {
    const walkableExits = exitPoints.filter(e => this.isTileWalkable(tiles, e.x, e.z));
    if (walkableExits.length === 0) return null;

    const exitKeys = new Set(walkableExits.map(e => this.key(e.x, e.z)));

    const visited = new Set<string>();
    const parent = new Map<string, string | null>();
    const startKey = this.key(spawn.x, spawn.z);

    const queue: { x: number; z: number }[] = [spawn];
    visited.add(startKey);
    parent.set(startKey, null);

    let iterations = 0;
    const maxIterations = Math.max(EDITOR_FLOOD_FILL_MAX_ITERATIONS, gridSize * gridSize);

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      const currentKey = this.key(current.x, current.z);

      if (exitKeys.has(currentKey)) {
        return this.reconstructPath(parent, startKey, currentKey);
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

    return null;
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
