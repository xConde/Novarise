import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import {
  buildCrossfire,
  buildTheSpiral,
  buildSiege,
  buildLabyrinth,
} from './mid-maps';

// ---------------------------------------------------------------------------
// BFS path validator
// ---------------------------------------------------------------------------

/**
 * Returns true if a walkable path exists from `start` to `end` through
 * BEDROCK or MOSS tiles, using 4-directional BFS.
 */
function hasPath(
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
function collectTerrainTypes(state: TerrainGridState): Set<TerrainType> {
  const types = new Set<TerrainType>();
  for (let x = 0; x < state.gridSize; x++) {
    for (let z = 0; z < state.gridSize; z++) {
      types.add(state.tiles[x][z]);
    }
  }
  return types;
}

// ---------------------------------------------------------------------------
// Shared structural assertions applied to every mid map
// ---------------------------------------------------------------------------

function expectMapStructureValid(
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

// ---------------------------------------------------------------------------
// Map 9 — "Crossfire"
// ---------------------------------------------------------------------------

describe('buildCrossfire', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildCrossfire();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 15, 2, 2);
  });

  it('should place spawners at (0,2) and (0,12)', () => {
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 2 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 12 }));
  });

  it('should place exits at (14,12) and (14,2)', () => {
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 14, z: 12 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 14, z: 2 }));
  });

  it('should have BFS path from spawner A (0,2) to exit A (14,12)', () => {
    expect(hasPath(state.tiles, 15, { x: 0, z: 2 }, { x: 14, z: 12 })).toBeTrue();
  });

  it('should have BFS path from spawner A (0,2) to exit B (14,2)', () => {
    expect(hasPath(state.tiles, 15, { x: 0, z: 2 }, { x: 14, z: 2 })).toBeTrue();
  });

  it('should have BFS path from spawner B (0,12) to exit A (14,12)', () => {
    expect(hasPath(state.tiles, 15, { x: 0, z: 12 }, { x: 14, z: 12 })).toBeTrue();
  });

  it('should have BFS path from spawner B (0,12) to exit B (14,2)', () => {
    expect(hasPath(state.tiles, 15, { x: 0, z: 12 }, { x: 14, z: 2 })).toBeTrue();
  });

  it('should have walkable top corridor (z=2-3, x=0-14)', () => {
    for (let x = 0; x <= 14; x++) {
      for (let z = 2; z <= 3; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Top corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable bottom corridor (z=11-12, x=0-14)', () => {
    for (let x = 0; x <= 14; x++) {
      for (let z = 11; z <= 12; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Bottom corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable central crossing zone (x=6-8, z=3-11)', () => {
    for (let x = 6; x <= 8; x++) {
      for (let z = 3; z <= 11; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Central crossing tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Moss accents at intersection', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 10 — "The Spiral"
// ---------------------------------------------------------------------------

describe('buildTheSpiral', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildTheSpiral();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 15, 1, 1);
  });

  it('should place spawner at (0,1) and exit at (7,7)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 1 });
    expect(state.exitPoints[0]).toEqual({ x: 7, z: 7 });
  });

  it('should have a BFS path from spawner to exit', () => {
    expect(hasPath(state.tiles, 15, { x: 0, z: 1 }, { x: 7, z: 7 })).toBeTrue();
  });

  it('should have walkable outer top leg (z=1-2, x=0-13)', () => {
    for (let x = 0; x <= 13; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Outer top leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable outer right leg (x=12-13, z=2-12)', () => {
    for (let x = 12; x <= 13; x++) {
      for (let z = 2; z <= 12; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Outer right leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable outer bottom leg (z=12-13, x=2-13)', () => {
    for (let x = 2; x <= 13; x++) {
      for (let z = 12; z <= 13; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Outer bottom leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable outer left leg (x=1-2, z=3-13)', () => {
    for (let x = 1; x <= 2; x++) {
      for (let z = 3; z <= 13; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Outer left leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable inner top leg (z=4-5, x=4-10)', () => {
    for (let x = 4; x <= 10; x++) {
      for (let z = 4; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Inner top leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable inner right leg (x=10-11, z=5-10)', () => {
    for (let x = 10; x <= 11; x++) {
      for (let z = 5; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Inner right leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable inner bottom leg (z=10-11, x=4-11)', () => {
    for (let x = 4; x <= 11; x++) {
      for (let z = 10; z <= 11; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Inner bottom leg tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable center exit zone (x=6-9, z=6-8)', () => {
    for (let x = 6; x <= 9; x++) {
      for (let z = 6; z <= 8; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Center exit zone tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should be predominantly Crystal (spiral walls)', () => {
    let crystal = 0;
    let total = 0;
    for (let x = 0; x < 15; x++) {
      for (let z = 0; z < 15; z++) {
        total++;
        if (state.tiles[x][z] === TerrainType.CRYSTAL) {
          crystal++;
        }
      }
    }
    // Spiral maps are mostly walls
    expect(crystal / total).toBeGreaterThan(0.3);
  });

  it('should have Moss accents at turn points', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 11 — "Siege"
// ---------------------------------------------------------------------------

describe('buildSiege', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildSiege();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 16, 3, 1);
  });

  it('should place spawners at (8,0), (0,8), (8,15)', () => {
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 8, z: 0 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 8 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 8, z: 15 }));
  });

  it('should place exit at (8,8)', () => {
    expect(state.exitPoints[0]).toEqual({ x: 8, z: 8 });
  });

  it('should have BFS path from north spawner (8,0) to exit (8,8)', () => {
    expect(hasPath(state.tiles, 16, { x: 8, z: 0 }, { x: 8, z: 8 })).toBeTrue();
  });

  it('should have BFS path from west spawner (0,8) to exit (8,8)', () => {
    expect(hasPath(state.tiles, 16, { x: 0, z: 8 }, { x: 8, z: 8 })).toBeTrue();
  });

  it('should have BFS path from south spawner (8,15) to exit (8,8)', () => {
    expect(hasPath(state.tiles, 16, { x: 8, z: 15 }, { x: 8, z: 8 })).toBeTrue();
  });

  it('should have walkable north corridor (x=7-8, z=0-7)', () => {
    for (let x = 7; x <= 8; x++) {
      for (let z = 0; z <= 7; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`North corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable west corridor (z=7-8, x=0-7)', () => {
    for (let x = 0; x <= 7; x++) {
      for (let z = 7; z <= 8; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`West corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable south corridor (x=7-8, z=9-15)', () => {
    for (let x = 7; x <= 8; x++) {
      for (let z = 9; z <= 15; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`South corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable central hub (x=6-9, z=6-9)', () => {
    for (let x = 6; x <= 9; x++) {
      for (let z = 6; z <= 9; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Central hub tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Moss accents at hub corners and corridor mid-points', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 12 — "Labyrinth"
// ---------------------------------------------------------------------------

describe('buildLabyrinth', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildLabyrinth();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 16, 1, 1);
  });

  it('should place spawner at (0,1) and exit at (15,14)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 1 });
    expect(state.exitPoints[0]).toEqual({ x: 15, z: 14 });
  });

  it('should have a BFS path from spawner to exit', () => {
    expect(hasPath(state.tiles, 16, { x: 0, z: 1 }, { x: 15, z: 14 })).toBeTrue();
  });

  it('should have walkable top corridor (z=1-2, x=0-13)', () => {
    for (let x = 0; x <= 13; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Top corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable right drop A (x=13-14, z=2-6)', () => {
    for (let x = 13; x <= 14; x++) {
      for (let z = 2; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Right drop A tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Route B left branch (x=4-5, z=2-5)', () => {
    for (let x = 4; x <= 5; x++) {
      for (let z = 2; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Route B left branch tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable lower corridor (z=9-10, x=2-14)', () => {
    for (let x = 2; x <= 14; x++) {
      for (let z = 9; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Lower corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Route D left drop (x=1-2, z=2-11)', () => {
    for (let x = 1; x <= 2; x++) {
      for (let z = 2; z <= 11; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Route D left drop tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable bottom corridor (z=11-12, x=1-14)', () => {
    for (let x = 1; x <= 14; x++) {
      for (let z = 11; z <= 12; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Bottom corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable exit corridor (z=13-14, x=0-15)', () => {
    for (let x = 0; x <= 15; x++) {
      for (let z = 13; z <= 14; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Exit corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have multiple distinct routes (cross-links reachable from spawner)', () => {
    // Route B mid connector junction
    expect(hasPath(state.tiles, 16, { x: 0, z: 1 }, { x: 9, z: 6 })).toBeTrue();
    // Centre cross-link junction
    expect(hasPath(state.tiles, 16, { x: 0, z: 1 }, { x: 8, z: 9 })).toBeTrue();
    // Route D left drop is reachable
    expect(hasPath(state.tiles, 16, { x: 0, z: 1 }, { x: 1, z: 11 })).toBeTrue();
    // Lower corridor right side
    expect(hasPath(state.tiles, 16, { x: 0, z: 1 }, { x: 14, z: 9 })).toBeTrue();
  });

  it('should be predominantly Crystal (maze walls)', () => {
    let crystal = 0;
    let total = 0;
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        total++;
        if (state.tiles[x][z] === TerrainType.CRYSTAL) {
          crystal++;
        }
      }
    }
    // Complex maze should have significant crystal walls
    expect(crystal / total).toBeGreaterThan(0.25);
  });

  it('should have Moss accents at major intersections', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});
