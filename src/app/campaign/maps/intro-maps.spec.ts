import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { buildFirstLight, buildTheBend, buildSerpentine, buildTheFork } from './intro-maps';
import { hasPath, collectTerrainTypes, expectMapStructureValid } from './testing/map-test-helpers';

// ---------------------------------------------------------------------------
// Map 1 — "First Light"
// ---------------------------------------------------------------------------

describe('buildFirstLight', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildFirstLight();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 10, 1, 1);
  });

  it('should place spawner at (0,4) and exit at (9,5)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 4 });
    expect(state.exitPoints[0]).toEqual({ x: 9, z: 5 });
  });

  it('should have Crystal top and bottom border rows', () => {
    for (let x = 0; x < 10; x++) {
      expect(state.tiles[x][0]).withContext(`tiles[${x}][0]`).toBe(TerrainType.CRYSTAL);
      expect(state.tiles[x][9]).withContext(`tiles[${x}][9]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Bedrock main corridor at z=4-5 across all columns', () => {
    for (let x = 0; x < 10; x++) {
      expect(state.tiles[x][4]).withContext(`tiles[${x}][4]`).toBe(TerrainType.BEDROCK);
      expect(state.tiles[x][5]).withContext(`tiles[${x}][5]`).toBe(TerrainType.BEDROCK);
    }
  });

  it('should have Moss corner accents', () => {
    expect(state.tiles[1][2]).toBe(TerrainType.MOSS);
    expect(state.tiles[8][2]).toBe(TerrainType.MOSS);
    expect(state.tiles[1][7]).toBe(TerrainType.MOSS);
    expect(state.tiles[8][7]).toBe(TerrainType.MOSS);
  });

  it('should use Abyss as border depth (z=1 and z=8)', () => {
    // Abyss at z=1 and z=8 (depth border rows)
    for (let x = 0; x < 10; x++) {
      expect(state.tiles[x][1]).withContext(`tiles[${x}][1]`).toBe(TerrainType.ABYSS);
      expect(state.tiles[x][8]).withContext(`tiles[${x}][8]`).toBe(TerrainType.ABYSS);
    }
  });
});

// ---------------------------------------------------------------------------
// Map 2 — "The Bend"
// ---------------------------------------------------------------------------

describe('buildTheBend', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildTheBend();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 10, 1, 1);
  });

  it('should place spawner at (2,0) and exit at (8,7)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 2, z: 0 });
    expect(state.exitPoints[0]).toEqual({ x: 8, z: 7 });
  });

  it('should have Bedrock vertical corridor at x=2-3, z=0-6', () => {
    for (let x = 2; x <= 3; x++) {
      for (let z = 0; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Bedrock horizontal corridor at z=6-7, x=2-8', () => {
    for (let x = 2; x <= 8; x++) {
      for (let z = 6; z <= 7; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Crystal left boundary wall at x=1', () => {
    for (let z = 0; z <= 8; z++) {
      expect(state.tiles[1][z]).withContext(`tiles[1][${z}]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Crystal floor wall at z=8', () => {
    for (let x = 1; x <= 9; x++) {
      expect(state.tiles[x][8]).withContext(`tiles[${x}][8]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Moss accents at the corner turn', () => {
    const tile2 = state.tiles[2][6];
    const tile3 = state.tiles[3][6];
    expect(tile2 === TerrainType.MOSS || tile2 === TerrainType.BEDROCK).toBeTrue();
    expect(tile3 === TerrainType.MOSS || tile3 === TerrainType.BEDROCK).toBeTrue();
    // At least one moss accent in the map
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 3 — "Serpentine"
// ---------------------------------------------------------------------------

describe('buildSerpentine', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildSerpentine();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 12, 1, 1);
  });

  it('should place spawner at (0,1) and exit at (11,10)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 1 });
    expect(state.exitPoints[0]).toEqual({ x: 11, z: 10 });
  });

  it('should have walkable Leg 1 tiles (z=1-2, x=0-9)', () => {
    for (let x = 0; x <= 9; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 1 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Turn 1 connector (x=9-10, z=2-5)', () => {
    for (let x = 9; x <= 10; x++) {
      for (let z = 2; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Turn 1 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 2 tiles (z=5-6, x=2-10)', () => {
    for (let x = 2; x <= 10; x++) {
      for (let z = 5; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 2 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Turn 2 connector (x=2-3, z=6-9)', () => {
    for (let x = 2; x <= 3; x++) {
      for (let z = 6; z <= 9; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Turn 2 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 3 tiles (z=9-10, x=2-11)', () => {
    for (let x = 2; x <= 11; x++) {
      for (let z = 9; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 3 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Crystal walls between legs 1 and 2 at x=0-8, z=3-4', () => {
    for (let x = 0; x <= 8; x++) {
      expect(state.tiles[x][3]).withContext(`tiles[${x}][3]`).toBe(TerrainType.CRYSTAL);
      expect(state.tiles[x][4]).withContext(`tiles[${x}][4]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Crystal walls between legs 2 and 3 at x=4-11, z=7-8', () => {
    for (let x = 4; x <= 11; x++) {
      expect(state.tiles[x][7]).withContext(`tiles[${x}][7]`).toBe(TerrainType.CRYSTAL);
      expect(state.tiles[x][8]).withContext(`tiles[${x}][8]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Moss accents at turn points', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 4 — "The Fork"
// ---------------------------------------------------------------------------

describe('buildTheFork', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildTheFork();
  });

  it('should satisfy all structural invariants', () => {
    expectMapStructureValid(state, 12, 1, 2);
  });

  it('should place spawner at (0,5) and exits at (11,1) and (11,10)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 5 });
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 11, z: 1 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 11, z: 10 }));
  });

  it('should have BFS path from spawner (0,5) to north exit (11,1)', () => {
    expect(hasPath(state.tiles, 12, { x: 0, z: 5 }, { x: 11, z: 1 })).toBeTrue();
  });

  it('should have BFS path from spawner (0,5) to south exit (11,10)', () => {
    expect(hasPath(state.tiles, 12, { x: 0, z: 5 }, { x: 11, z: 10 })).toBeTrue();
  });

  it('should have walkable main corridor (z=5-6, x=0-5)', () => {
    for (let x = 0; x <= 5; x++) {
      for (let z = 5; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Main corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable north branch horizontal arm (z=1-2, x=5-11)', () => {
    for (let x = 5; x <= 11; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`North arm tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable south branch horizontal arm (z=9-10, x=5-11)', () => {
    for (let x = 5; x <= 11; x++) {
      for (let z = 9; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`South arm tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Crystal top border at z=0', () => {
    for (let x = 0; x < 12; x++) {
      expect(state.tiles[x][0]).withContext(`tiles[${x}][0]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Crystal bottom border at z=11', () => {
    for (let x = 0; x < 12; x++) {
      expect(state.tiles[x][11]).withContext(`tiles[${x}][11]`).toBe(TerrainType.CRYSTAL);
    }
  });

  it('should have Moss accents at the split point', () => {
    const tile55 = state.tiles[5][5];
    const tile56 = state.tiles[5][6];
    expect(tile55 === TerrainType.MOSS || tile55 === TerrainType.BEDROCK).toBeTrue();
    expect(tile56 === TerrainType.MOSS || tile56 === TerrainType.BEDROCK).toBeTrue();
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });
});
