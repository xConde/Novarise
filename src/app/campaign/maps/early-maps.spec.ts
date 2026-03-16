import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import {
  buildTwinGates,
  buildOpenGround,
  buildTheNarrows,
  buildCrystalMaze,
} from './early-maps';
import { hasPath, collectTerrainTypes, expectMapStructureValid } from './testing/map-test-helpers';

// ---------------------------------------------------------------------------
// Map 5 — "Twin Gates"
// ---------------------------------------------------------------------------

describe('buildTwinGates', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildTwinGates();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 12, 2, 1);
  });

  it('should place spawners at (0,2) and (0,9), exit at (11,5)', () => {
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 2 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 9 }));
    expect(state.exitPoints[0]).toEqual({ x: 11, z: 5 });
  });

  it('should have BFS path from top spawner (0,2) to exit (11,5)', () => {
    expect(hasPath(state.tiles, 12, { x: 0, z: 2 }, { x: 11, z: 5 })).toBeTrue();
  });

  it('should have BFS path from bottom spawner (0,9) to exit (11,5)', () => {
    expect(hasPath(state.tiles, 12, { x: 0, z: 9 }, { x: 11, z: 5 })).toBeTrue();
  });

  it('should have walkable top corridor (z=2-3, x=0-7)', () => {
    for (let x = 0; x <= 7; x++) {
      for (let z = 2; z <= 3; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Top corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable bottom corridor (z=8-9, x=0-7)', () => {
    for (let x = 0; x <= 7; x++) {
      for (let z = 8; z <= 9; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Bottom corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable merge zone (z=5-6, x=7-11)', () => {
    for (let x = 7; x <= 11; x++) {
      for (let z = 5; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Merge zone tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Crystal divider between corridors (z=4-7, x=0-6)', () => {
    for (let x = 0; x <= 6; x++) {
      for (let z = 4; z <= 7; z++) {
        expect(state.tiles[x][z])
          .withContext(`Crystal divider tiles[${x}][${z}]`)
          .toBe(TerrainType.CRYSTAL);
      }
    }
  });

  it('should have Moss accents at merge and turn points', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 6 — "Open Ground"
// ---------------------------------------------------------------------------

describe('buildOpenGround', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildOpenGround();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 14, 1, 1);
  });

  it('should place spawner at (0,7) and exit at (13,6)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 7 });
    expect(state.exitPoints[0]).toEqual({ x: 13, z: 6 });
  });

  it('should have a BFS path from spawner to exit', () => {
    expect(hasPath(state.tiles, 14, { x: 0, z: 7 }, { x: 13, z: 6 })).toBeTrue();
  });

  it('should have Crystal border on top and bottom rows', () => {
    for (let x = 0; x < 14; x++) {
      expect(state.tiles[x][0]).withContext(`top border tiles[${x}][0]`).toBe(TerrainType.CRYSTAL);
      expect(state.tiles[x][13]).withContext(`bottom border tiles[${x}][13]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Crystal border on left and right columns', () => {
    for (let z = 1; z <= 12; z++) {
      // Left column — except spawn tile (0,7)
      if (z !== 7) {
        expect(state.tiles[0][z]).withContext(`left border tiles[0][${z}]`).toBe(TerrainType.CRYSTAL);
      }
      // Right column — except exit tile (13,6)
      if (z !== 6) {
        expect(state.tiles[13][z]).withContext(`right border tiles[13][${z}]`).toBe(TerrainType.CRYSTAL);
      }
    }
  });

  it('should have spawn tile (0,7) walkable', () => {
    const tile = state.tiles[0][7];
    expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS).toBeTrue();
  });

  it('should have exit tile (13,6) walkable', () => {
    const tile = state.tiles[13][6];
    expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS).toBeTrue();
  });

  it('should have scattered Crystal pillars in the interior', () => {
    // Verify a sample of interior crystal pillars exist
    expect(state.tiles[4][3]).toBe(TerrainType.CRYSTAL);
    expect(state.tiles[4][4]).toBe(TerrainType.CRYSTAL);
    expect(state.tiles[9][4]).toBe(TerrainType.CRYSTAL);
    expect(state.tiles[3][9]).toBe(TerrainType.CRYSTAL);
  });

  it('should have Moss accents scattered in the field', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });

  it('should be predominantly open (majority of interior tiles are walkable)', () => {
    let walkable = 0;
    let total = 0;
    // Interior only (exclude border)
    for (let x = 1; x <= 12; x++) {
      for (let z = 1; z <= 12; z++) {
        total++;
        const tile = state.tiles[x][z];
        if (tile === TerrainType.BEDROCK || tile === TerrainType.MOSS) {
          walkable++;
        }
      }
    }
    expect(walkable / total).toBeGreaterThan(0.7);
  });
});

// ---------------------------------------------------------------------------
// Map 7 — "The Narrows"
// ---------------------------------------------------------------------------

describe('buildTheNarrows', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildTheNarrows();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 14, 1, 1);
  });

  it('should place spawner at (0,1) and exit at (1,13)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 1 });
    expect(state.exitPoints[0]).toEqual({ x: 1, z: 13 });
  });

  it('should have a BFS path from spawner to exit', () => {
    expect(hasPath(state.tiles, 14, { x: 0, z: 1 }, { x: 1, z: 13 })).toBeTrue();
  });

  it('should have walkable Leg 1 (z=1-2, x=0-11)', () => {
    for (let x = 0; x <= 11; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 1 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Turn 1 connector (x=11-12, z=2-4)', () => {
    for (let x = 11; x <= 12; x++) {
      for (let z = 2; z <= 4; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Turn 1 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 2 (z=4-5, x=3-12)', () => {
    for (let x = 3; x <= 12; x++) {
      for (let z = 4; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 2 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Turn 2 connector (x=3-4, z=5-8)', () => {
    for (let x = 3; x <= 4; x++) {
      for (let z = 5; z <= 8; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Turn 2 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 3 (z=8-9, x=3-12)', () => {
    for (let x = 3; x <= 12; x++) {
      for (let z = 8; z <= 9; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 3 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Turn 3 connector (x=11-12, z=9-11)', () => {
    for (let x = 11; x <= 12; x++) {
      for (let z = 9; z <= 11; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Turn 3 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 4 (z=11-12, x=1-12)', () => {
    for (let x = 1; x <= 12; x++) {
      for (let z = 11; z <= 12; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 4 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable exit connector (x=1-2, z=12-13)', () => {
    for (let x = 1; x <= 2; x++) {
      for (let z = 12; z <= 13; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Exit connector tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should be predominantly Crystal (majority of tiles are walls)', () => {
    let crystal = 0;
    let total = 0;
    for (let x = 0; x < 14; x++) {
      for (let z = 0; z < 14; z++) {
        total++;
        if (state.tiles[x][z] === TerrainType.CRYSTAL) {
          crystal++;
        }
      }
    }
    // Narrow corridor map should have substantial crystal walls
    expect(crystal / total).toBeGreaterThan(0.4);
  });

  it('should have Moss accents at chokepoint turns', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 8 — "Crystal Maze"
// ---------------------------------------------------------------------------

describe('buildCrystalMaze', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildCrystalMaze();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 14, 1, 1);
  });

  it('should place spawner at (0,1) and exit at (13,12)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 1 });
    expect(state.exitPoints[0]).toEqual({ x: 13, z: 12 });
  });

  it('should have a BFS path from spawner to exit', () => {
    expect(hasPath(state.tiles, 14, { x: 0, z: 1 }, { x: 13, z: 12 })).toBeTrue();
  });

  it('should have walkable top corridor (z=1-2, x=0-12)', () => {
    for (let x = 0; x <= 12; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Top corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable right drop A (x=12-13, z=2-5)', () => {
    for (let x = 12; x <= 13; x++) {
      for (let z = 2; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Right drop A tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable mid corridor upper (z=5-6, x=4-13)', () => {
    for (let x = 4; x <= 13; x++) {
      for (let z = 5; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Mid corridor upper tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable mid corridor lower (z=9-10, x=4-13)', () => {
    for (let x = 4; x <= 13; x++) {
      for (let z = 9; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Mid corridor lower tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable exit corridor (z=12-13, x=0-13)', () => {
    for (let x = 0; x <= 13; x++) {
      for (let z = 12; z <= 13; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Exit corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable cross-link A (x=1-2, z=2-5)', () => {
    for (let x = 1; x <= 2; x++) {
      for (let z = 2; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Cross-link A tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable cross-link B (x=7-8, z=6-9)', () => {
    for (let x = 7; x <= 8; x++) {
      for (let z = 6; z <= 9; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Cross-link B tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have multiple distinct routes through the maze', () => {
    // Verify cross-link A junction tile (1,5) is reachable from spawn
    expect(hasPath(state.tiles, 14, { x: 0, z: 1 }, { x: 1, z: 5 })).toBeTrue();
    // Verify cross-link B junction (7,9) is reachable from spawn
    expect(hasPath(state.tiles, 14, { x: 0, z: 1 }, { x: 7, z: 9 })).toBeTrue();
    // Verify both mid corridors are reachable from spawn
    expect(hasPath(state.tiles, 14, { x: 0, z: 1 }, { x: 13, z: 5 })).toBeTrue();
    expect(hasPath(state.tiles, 14, { x: 0, z: 1 }, { x: 13, z: 9 })).toBeTrue();
  });

  it('should be predominantly Crystal (maze walls)', () => {
    let crystal = 0;
    let total = 0;
    for (let x = 0; x < 14; x++) {
      for (let z = 0; z < 14; z++) {
        total++;
        if (state.tiles[x][z] === TerrainType.CRYSTAL) {
          crystal++;
        }
      }
    }
    expect(crystal / total).toBeGreaterThan(0.35);
  });

  it('should have Moss accents at path intersections', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});
