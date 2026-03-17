import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';
import { TerrainGridState } from '../../../games/novarise/features/terrain-editor/terrain-grid-state.interface';

/**
 * Returns true if a walkable path exists from `start` to `end` through
 * BEDROCK or MOSS tiles, using 4-directional BFS.
 */
export function hasPath(
  tiles: TerrainType[][],
  gridSize: number,
  start: { x: number; z: number },
  end: { x: number; z: number },
): boolean {
  const visited = new Set<string>();
  const queue: { x: number; z: number }[] = [start];
  visited.add(`${start.x},${start.z}`);

  const DIRS: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === end.x && current.z === end.z) return true;

    for (const [dx, dz] of DIRS) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      const key = `${nx},${nz}`;

      if (
        nx >= 0 && nx < gridSize &&
        nz >= 0 && nz < gridSize &&
        !visited.has(key)
      ) {
        const tile = tiles[nx][nz];
        if (tile === TerrainType.BEDROCK || tile === TerrainType.MOSS) {
          visited.add(key);
          queue.push({ x: nx, z: nz });
        }
      }
    }
  }

  return false;
}

/**
 * Returns the set of unique TerrainType values present in the grid.
 */
export function collectTerrainTypes(state: TerrainGridState): Set<TerrainType> {
  const types = new Set<TerrainType>();
  for (let x = 0; x < state.gridSize; x++) {
    for (let z = 0; z < state.gridSize; z++) {
      types.add(state.tiles[x][z]);
    }
  }
  return types;
}

/**
 * Asserts all structural invariants that every campaign map must satisfy:
 * grid dimensions, heightMap all-zero, version string, spawner/exit counts,
 * spawn/exit tiles walkable, BFS reachability from every spawner to every exit,
 * and visual variety (at least 3 distinct terrain types).
 */
export function expectMapStructureValid(
  state: TerrainGridState,
  expectedGridSize: number,
  expectedSpawners: number,
  expectedExits: number,
): void {
  // gridSize field
  expect(state.gridSize).toBe(expectedGridSize);

  // tiles dimensions
  expect(state.tiles.length).toBe(expectedGridSize);
  for (let x = 0; x < expectedGridSize; x++) {
    expect(state.tiles[x].length).withContext(`tiles[${x}].length`).toBe(expectedGridSize);
  }

  // heightMap dimensions — all zero
  expect(state.heightMap.length).toBe(expectedGridSize);
  for (let x = 0; x < expectedGridSize; x++) {
    expect(state.heightMap[x].length).withContext(`heightMap[${x}].length`).toBe(expectedGridSize);
    for (let z = 0; z < expectedGridSize; z++) {
      expect(state.heightMap[x][z]).withContext(`heightMap[${x}][${z}]`).toBe(0);
    }
  }

  // version
  expect(state.version).toBe('2.0.0');

  // spawner / exit counts
  expect(state.spawnPoints.length).toBe(expectedSpawners);
  expect(state.exitPoints.length).toBe(expectedExits);

  // spawn / exit points within bounds
  for (const sp of state.spawnPoints) {
    expect(sp.x).toBeGreaterThanOrEqual(0);
    expect(sp.x).toBeLessThan(expectedGridSize);
    expect(sp.z).toBeGreaterThanOrEqual(0);
    expect(sp.z).toBeLessThan(expectedGridSize);
    // spawn tile must be walkable
    const tile = state.tiles[sp.x][sp.z];
    expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
      .withContext(`spawnPoint (${sp.x},${sp.z}) must be walkable, got ${tile}`)
      .toBeTrue();
  }

  for (const ep of state.exitPoints) {
    expect(ep.x).toBeGreaterThanOrEqual(0);
    expect(ep.x).toBeLessThan(expectedGridSize);
    expect(ep.z).toBeGreaterThanOrEqual(0);
    expect(ep.z).toBeLessThan(expectedGridSize);
    // exit tile must be walkable
    const tile = state.tiles[ep.x][ep.z];
    expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
      .withContext(`exitPoint (${ep.x},${ep.z}) must be walkable, got ${tile}`)
      .toBeTrue();
  }

  // BFS reachability: every spawner must reach every exit
  for (const sp of state.spawnPoints) {
    for (const ep of state.exitPoints) {
      expect(hasPath(state.tiles, expectedGridSize, sp, ep))
        .withContext(`No BFS path from (${sp.x},${sp.z}) to (${ep.x},${ep.z})`)
        .toBeTrue();
    }
  }

  // Visual variety: at least 3 distinct terrain types
  const types = collectTerrainTypes(state);
  expect(types.size)
    .withContext(`Expected at least 3 terrain types, got ${types.size}: [${[...types].join(', ')}]`)
    .toBeGreaterThanOrEqual(3);
}
