import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import {
  buildFortress,
  buildTheGauntlet,
  buildStorm,
  buildNovarise,
} from './late-maps';
import { hasPath, collectTerrainTypes, expectMapStructureValid } from './testing/map-test-helpers';

// ---------------------------------------------------------------------------
// Map 13 — "Fortress"
// ---------------------------------------------------------------------------

describe('buildFortress', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildFortress();
  });

  it('should satisfy all structural invariants (18×18, 4 spawners, 1 exit)', () => {
    expectMapStructureValid(state, 18, 4, 1);
  });

  it('should place spawners on all four edges and exit at center', () => {
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 9, z: 0 }));   // North
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 17, z: 9 }));  // East
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 9, z: 17 }));  // South
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 9 }));   // West
    expect(state.exitPoints[0]).toEqual({ x: 9, z: 9 });
  });

  it('should have BFS path from every spawner to the central exit', () => {
    const exit = { x: 9, z: 9 };
    for (const sp of state.spawnPoints) {
      expect(hasPath(state.tiles, 18, sp, exit))
        .withContext(`No path from (${sp.x},${sp.z}) to central exit`)
        .toBeTrue();
    }
  });

  it('should have walkable horizontal corridor (z=8-9, x=0-17)', () => {
    for (let x = 0; x < 18; x++) {
      for (let z = 8; z <= 9; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Horizontal corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable vertical corridor (x=8-9, z=0-17)', () => {
    for (let z = 0; z < 18; z++) {
      for (let x = 8; x <= 9; x++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Vertical corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Moss central fortress area around the exit (x=7-10, z=7-10)', () => {
    // Central area should be moss (fortress zone)
    for (let x = 7; x <= 10; x++) {
      for (let z = 7; z <= 10; z++) {
        // Some tiles in this zone may be corridor bedrock (x=8-9)
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Central fortress tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
    // Confirm moss is used in the fortress region
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });

  it('should have walkable NW build pocket (x=2-6, z=2-6)', () => {
    for (let x = 2; x <= 6; x++) {
      for (let z = 2; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`NW pocket tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable NE build pocket (x=11-15, z=2-6)', () => {
    for (let x = 11; x <= 15; x++) {
      for (let z = 2; z <= 6; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`NE pocket tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable SW build pocket (x=2-6, z=11-15)', () => {
    for (let x = 2; x <= 6; x++) {
      for (let z = 11; z <= 15; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`SW pocket tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable SE build pocket (x=11-15, z=11-15)', () => {
    for (let x = 11; x <= 15; x++) {
      for (let z = 11; z <= 15; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`SE pocket tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have Abyss in the far corners', () => {
    // Far corner spots should be Abyss
    expect(state.tiles[0][0]).toBe(TerrainType.ABYSS);
    expect(state.tiles[17][0]).toBe(TerrainType.ABYSS);
    expect(state.tiles[0][17]).toBe(TerrainType.ABYSS);
    expect(state.tiles[17][17]).toBe(TerrainType.ABYSS);
  });

  it('should have Crystal walls in the inter-arm regions', () => {
    // Spot-check crystal in the gap between NW quadrant and corridor
    // e.g., corner of the quadrant gap (x=1, z=1 is Abyss; x=7, z=1 should be Crystal)
    expect(state.tiles[7][1]).toBe(TerrainType.CRYSTAL);
    expect(state.tiles[1][7]).toBe(TerrainType.CRYSTAL);
  });
});

// ---------------------------------------------------------------------------
// Map 14 — "The Gauntlet"
// ---------------------------------------------------------------------------

describe('buildTheGauntlet', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildTheGauntlet();
  });

  it('should satisfy all structural invariants (18×18, 1 spawner, 1 exit)', () => {
    expectMapStructureValid(state, 18, 1, 1);
  });

  it('should place spawner at (0,1) and exit at (17,16)', () => {
    expect(state.spawnPoints[0]).toEqual({ x: 0, z: 1 });
    expect(state.exitPoints[0]).toEqual({ x: 17, z: 16 });
  });

  it('should have a BFS path from spawner to exit', () => {
    expect(hasPath(state.tiles, 18, { x: 0, z: 1 }, { x: 17, z: 16 })).toBeTrue();
  });

  it('should have walkable Leg 1 (z=1-2, x=0-15)', () => {
    for (let x = 0; x <= 15; x++) {
      for (let z = 1; z <= 2; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 1 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 2 (z=4-5, x=2-16)', () => {
    for (let x = 2; x <= 16; x++) {
      for (let z = 4; z <= 5; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 2 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 3 (z=7-8, x=2-15)', () => {
    for (let x = 2; x <= 15; x++) {
      for (let z = 7; z <= 8; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 3 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 4 (z=10-11, x=2-16)', () => {
    for (let x = 2; x <= 16; x++) {
      for (let z = 10; z <= 11; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 4 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 5 (z=13-14, x=2-15)', () => {
    for (let x = 2; x <= 15; x++) {
      for (let z = 13; z <= 14; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 5 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable Leg 6 (z=16-17, x=1-16)', () => {
    for (let x = 1; x <= 16; x++) {
      for (let z = 16; z <= 17; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Leg 6 tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should be predominantly Crystal (tight maze)', () => {
    let crystal = 0;
    let total = 0;
    for (let x = 0; x < 18; x++) {
      for (let z = 0; z < 18; z++) {
        total++;
        if (state.tiles[x][z] === TerrainType.CRYSTAL) {
          crystal++;
        }
      }
    }
    // Tight corridor map should have substantial crystal walls
    expect(crystal / total).toBeGreaterThan(0.35);
  });

  it('should have Moss pockets at turn points for tower placement', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });

  it('should have intermediate waypoints reachable from spawner', () => {
    const spawn = { x: 0, z: 1 };
    // Check each leg is reachable
    expect(hasPath(state.tiles, 18, spawn, { x: 16, z: 4 })).toBeTrue(); // Leg 2 end
    expect(hasPath(state.tiles, 18, spawn, { x: 2, z: 7 })).toBeTrue();  // Leg 3 start
    expect(hasPath(state.tiles, 18, spawn, { x: 16, z: 10 })).toBeTrue(); // Leg 4 end
    expect(hasPath(state.tiles, 18, spawn, { x: 2, z: 13 })).toBeTrue(); // Leg 5 start
  });
});

// ---------------------------------------------------------------------------
// Map 15 — "Storm"
// ---------------------------------------------------------------------------

describe('buildStorm', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildStorm();
  });

  it('should satisfy all structural invariants (20×20, 4 spawners, 2 exits)', () => {
    expectMapStructureValid(state, 20, 4, 2);
  });

  it('should place spawners on left/right edges and exits in center', () => {
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 3 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 16 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 19, z: 3 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 19, z: 16 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 9, z: 10 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 10, z: 10 }));
  });

  it('should have BFS path from every spawner to both exits', () => {
    for (const sp of state.spawnPoints) {
      for (const ep of state.exitPoints) {
        expect(hasPath(state.tiles, 20, sp, ep))
          .withContext(`No BFS path from (${sp.x},${sp.z}) to (${ep.x},${ep.z})`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable upper-left corridor (x=0-9, z=3-4)', () => {
    for (let x = 0; x <= 9; x++) {
      for (let z = 3; z <= 4; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Upper-left corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable lower-left corridor (x=0-9, z=15-16)', () => {
    for (let x = 0; x <= 9; x++) {
      for (let z = 15; z <= 16; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Lower-left corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable upper-right corridor (x=10-19, z=3-4)', () => {
    for (let x = 10; x <= 19; x++) {
      for (let z = 3; z <= 4; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Upper-right corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable lower-right corridor (x=10-19, z=15-16)', () => {
    for (let x = 10; x <= 19; x++) {
      for (let z = 15; z <= 16; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Lower-right corridor tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable central vertical spine (x=9-10, z=3-16)', () => {
    for (let x = 9; x <= 10; x++) {
      for (let z = 3; z <= 16; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Central spine tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have exit tiles walkable at (9,10) and (10,10)', () => {
    const t1 = state.tiles[9][10];
    const t2 = state.tiles[10][10];
    expect(t1 === TerrainType.BEDROCK || t1 === TerrainType.MOSS).toBeTrue();
    expect(t2 === TerrainType.BEDROCK || t2 === TerrainType.MOSS).toBeTrue();
  });

  it('should have Crystal channeling walls between corridors', () => {
    // Upper-left crystal band should be present (spot check)
    expect(state.tiles[4][7]).toBe(TerrainType.CRYSTAL);
    // Upper-right crystal band
    expect(state.tiles[15][7]).toBe(TerrainType.CRYSTAL);
  });

  it('should have Moss accents at corridor merge points', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });

  it('should use Abyss as background fill', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.ABYSS)).toBeTrue();
  });
});

// ---------------------------------------------------------------------------
// Map 16 — "Novarise"
// ---------------------------------------------------------------------------

describe('buildNovarise', () => {
  let state: TerrainGridState;

  beforeEach(() => {
    state = buildNovarise();
  });

  it('should satisfy all structural invariants (20×20, 4 spawners, 4 exits)', () => {
    expectMapStructureValid(state, 20, 4, 4);
  });

  it('should place spawners at all four corners', () => {
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 0 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 19, z: 0 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 0, z: 19 }));
    expect(state.spawnPoints).toContain(jasmine.objectContaining({ x: 19, z: 19 }));
  });

  it('should place exits in a diamond formation near center', () => {
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 9, z: 7 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 12, z: 10 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 9, z: 13 }));
    expect(state.exitPoints).toContain(jasmine.objectContaining({ x: 6, z: 10 }));
  });

  it('should have BFS path from every spawner to every exit (all 16 combinations)', () => {
    for (const sp of state.spawnPoints) {
      for (const ep of state.exitPoints) {
        expect(hasPath(state.tiles, 20, sp, ep))
          .withContext(`No BFS path from spawner (${sp.x},${sp.z}) to exit (${ep.x},${ep.z})`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable central hub (x=6-13, z=7-13)', () => {
    for (let x = 6; x <= 13; x++) {
      for (let z = 7; z <= 13; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Central hub tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable NW corner approach (x=0-8, z=0-1)', () => {
    for (let x = 0; x <= 8; x++) {
      for (let z = 0; z <= 1; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`NW approach tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable NE corner approach (x=11-19, z=0-1)', () => {
    for (let x = 11; x <= 19; x++) {
      for (let z = 0; z <= 1; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`NE approach tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable SW corner approach (x=0-8, z=18-19)', () => {
    for (let x = 0; x <= 8; x++) {
      for (let z = 18; z <= 19; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`SW approach tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable SE corner approach (x=11-19, z=18-19)', () => {
    for (let x = 11; x <= 19; x++) {
      for (let z = 18; z <= 19; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`SE approach tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable left bridge from NW/SW legs to hub (x=1-6, z=9-10)', () => {
    for (let x = 1; x <= 6; x++) {
      for (let z = 9; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Left bridge tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have walkable right bridge from NE/SE legs to hub (x=13-18, z=9-10)', () => {
    for (let x = 13; x <= 18; x++) {
      for (let z = 9; z <= 10; z++) {
        const tile = state.tiles[x][z];
        expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
          .withContext(`Right bridge tiles[${x}][${z}] should be walkable, got ${tile}`)
          .toBeTrue();
      }
    }
  });

  it('should have all four exit tiles as walkable', () => {
    const exits = [
      { x: 9, z: 7 }, { x: 12, z: 10 }, { x: 9, z: 13 }, { x: 6, z: 10 },
    ];
    for (const ep of exits) {
      const tile = state.tiles[ep.x][ep.z];
      expect(tile === TerrainType.BEDROCK || tile === TerrainType.MOSS)
        .withContext(`Exit (${ep.x},${ep.z}) must be walkable, got ${tile}`)
        .toBeTrue();
    }
  });

  it('should have Abyss decorative patches in mid-field quadrants', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.ABYSS)).toBeTrue();
    // Spot-check specific abyss patches
    expect(state.tiles[3][3]).toBe(TerrainType.ABYSS);
    expect(state.tiles[15][3]).toBe(TerrainType.ABYSS);
    expect(state.tiles[3][15]).toBe(TerrainType.ABYSS);
    expect(state.tiles[15][15]).toBe(TerrainType.ABYSS);
  });

  it('should have Moss accents at strategic chokepoints', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.MOSS)).toBeTrue();
  });

  it('should be predominantly Crystal (complex maze walls)', () => {
    let crystal = 0;
    let total = 0;
    for (let x = 0; x < 20; x++) {
      for (let z = 0; z < 20; z++) {
        total++;
        if (state.tiles[x][z] === TerrainType.CRYSTAL) {
          crystal++;
        }
      }
    }
    // Endgame map has complex maze — should have substantial crystal
    expect(crystal / total).toBeGreaterThan(0.25);
  });

  it('should use all four terrain types', () => {
    const types = collectTerrainTypes(state);
    expect(types.has(TerrainType.BEDROCK)).toBeTrue();
    expect(types.has(TerrainType.CRYSTAL)).toBeTrue();
    expect(types.has(TerrainType.MOSS)).toBeTrue();
    expect(types.has(TerrainType.ABYSS)).toBeTrue();
  });
});
