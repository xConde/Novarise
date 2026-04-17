import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';
import { MAP_VERSION, createEmptyGrid, paintRow, paintColumn, paintRect } from './map-helpers';

// ---------------------------------------------------------------------------
// MAP_VERSION constant
// ---------------------------------------------------------------------------

describe('MAP_VERSION', () => {
  it('should be the 2.0.0 schema version string', () => {
    expect(MAP_VERSION).toBe('2.0.0');
  });
});

// ---------------------------------------------------------------------------
// createEmptyGrid
// ---------------------------------------------------------------------------

describe('createEmptyGrid', () => {
  it('should set gridSize to the requested size', () => {
    const state = createEmptyGrid(5, TerrainType.CRYSTAL);
    expect(state.gridSize).toBe(5);
  });

  it('should produce a tiles array of length gridSize', () => {
    const state = createEmptyGrid(4, TerrainType.BEDROCK);
    expect(state.tiles.length).toBe(4);
  });

  it('should produce inner tile columns of length gridSize', () => {
    const size = 6;
    const state = createEmptyGrid(size, TerrainType.BEDROCK);
    for (let x = 0; x < size; x++) {
      expect(state.tiles[x].length).withContext(`tiles[${x}].length`).toBe(size);
    }
  });

  it('should fill every tile with the given fill type', () => {
    const size = 3;
    const state = createEmptyGrid(size, TerrainType.ABYSS);
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        expect(state.tiles[x][z])
          .withContext(`tiles[${x}][${z}]`)
          .toBe(TerrainType.ABYSS);
      }
    }
  });

  it('should fill every tile with BEDROCK when fill is BEDROCK', () => {
    const state = createEmptyGrid(2, TerrainType.BEDROCK);
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        expect(state.tiles[x][z]).toBe(TerrainType.BEDROCK);
      }
    }
  });

  it('should produce a heightMap array of length gridSize', () => {
    const state = createEmptyGrid(5, TerrainType.CRYSTAL);
    expect(state.heightMap.length).toBe(5);
  });

  it('should produce inner heightMap columns of length gridSize', () => {
    const size = 4;
    const state = createEmptyGrid(size, TerrainType.MOSS);
    for (let x = 0; x < size; x++) {
      expect(state.heightMap[x].length).withContext(`heightMap[${x}].length`).toBe(size);
    }
  });

  it('should initialise all heightMap values to zero', () => {
    const size = 4;
    const state = createEmptyGrid(size, TerrainType.MOSS);
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        expect(state.heightMap[x][z]).withContext(`heightMap[${x}][${z}]`).toBe(0);
      }
    }
  });

  it('should return empty spawnPoints array', () => {
    const state = createEmptyGrid(5, TerrainType.BEDROCK);
    expect(state.spawnPoints).toEqual([]);
  });

  it('should return empty exitPoints array', () => {
    const state = createEmptyGrid(5, TerrainType.BEDROCK);
    expect(state.exitPoints).toEqual([]);
  });

  it('should set version to MAP_VERSION', () => {
    const state = createEmptyGrid(5, TerrainType.BEDROCK);
    expect(state.version).toBe(MAP_VERSION);
  });

  it('should handle size 1 (single-cell grid)', () => {
    const state = createEmptyGrid(1, TerrainType.CRYSTAL);
    expect(state.gridSize).toBe(1);
    expect(state.tiles.length).toBe(1);
    expect(state.tiles[0].length).toBe(1);
    expect(state.tiles[0][0]).toBe(TerrainType.CRYSTAL);
    expect(state.heightMap[0][0]).toBe(0);
  });

  it('should handle MOSS fill type', () => {
    const state = createEmptyGrid(3, TerrainType.MOSS);
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        expect(state.tiles[x][z]).toBe(TerrainType.MOSS);
      }
    }
  });

  it('should produce independent column arrays (no shared references)', () => {
    const state = createEmptyGrid(3, TerrainType.BEDROCK);
    state.tiles[0][0] = TerrainType.CRYSTAL;
    expect(state.tiles[1][0]).toBe(TerrainType.BEDROCK);
  });
});

// ---------------------------------------------------------------------------
// paintRow
// ---------------------------------------------------------------------------

describe('paintRow', () => {
  let tiles: TerrainType[][];

  beforeEach(() => {
    const state = createEmptyGrid(6, TerrainType.ABYSS);
    tiles = state.tiles;
  });

  it('should paint all columns in the range [x0, x1] at the given z', () => {
    paintRow(tiles, 2, 1, 4, TerrainType.BEDROCK);
    for (let x = 1; x <= 4; x++) {
      expect(tiles[x][2]).withContext(`tiles[${x}][2]`).toBe(TerrainType.BEDROCK);
    }
  });

  it('should not affect columns outside [x0, x1]', () => {
    paintRow(tiles, 2, 2, 3, TerrainType.BEDROCK);
    expect(tiles[0][2]).toBe(TerrainType.ABYSS);
    expect(tiles[1][2]).toBe(TerrainType.ABYSS);
    expect(tiles[4][2]).toBe(TerrainType.ABYSS);
    expect(tiles[5][2]).toBe(TerrainType.ABYSS);
  });

  it('should not affect other rows (z values)', () => {
    paintRow(tiles, 3, 0, 5, TerrainType.CRYSTAL);
    expect(tiles[0][2]).toBe(TerrainType.ABYSS);
    expect(tiles[0][4]).toBe(TerrainType.ABYSS);
  });

  it('should handle a single-cell range (x0 === x1)', () => {
    paintRow(tiles, 1, 3, 3, TerrainType.MOSS);
    expect(tiles[3][1]).toBe(TerrainType.MOSS);
    expect(tiles[2][1]).toBe(TerrainType.ABYSS);
    expect(tiles[4][1]).toBe(TerrainType.ABYSS);
  });

  it('should be inclusive on both x0 and x1 endpoints', () => {
    paintRow(tiles, 0, 0, 5, TerrainType.MOSS);
    expect(tiles[0][0]).toBe(TerrainType.MOSS);
    expect(tiles[5][0]).toBe(TerrainType.MOSS);
  });

  it('should overwrite a previously painted tile', () => {
    paintRow(tiles, 2, 2, 4, TerrainType.BEDROCK);
    paintRow(tiles, 2, 3, 3, TerrainType.CRYSTAL);
    expect(tiles[3][2]).toBe(TerrainType.CRYSTAL);
    expect(tiles[2][2]).toBe(TerrainType.BEDROCK);
    expect(tiles[4][2]).toBe(TerrainType.BEDROCK);
  });

  it('should paint all four TerrainType values correctly', () => {
    paintRow(tiles, 0, 0, 0, TerrainType.BEDROCK);
    paintRow(tiles, 1, 0, 0, TerrainType.CRYSTAL);
    paintRow(tiles, 2, 0, 0, TerrainType.MOSS);
    paintRow(tiles, 3, 0, 0, TerrainType.ABYSS);
    expect(tiles[0][0]).toBe(TerrainType.BEDROCK);
    expect(tiles[0][1]).toBe(TerrainType.CRYSTAL);
    expect(tiles[0][2]).toBe(TerrainType.MOSS);
    expect(tiles[0][3]).toBe(TerrainType.ABYSS);
  });
});

// ---------------------------------------------------------------------------
// paintColumn
// ---------------------------------------------------------------------------

describe('paintColumn', () => {
  let tiles: TerrainType[][];

  beforeEach(() => {
    const state = createEmptyGrid(8, TerrainType.ABYSS);
    tiles = state.tiles;
  });

  it('should paint all rows in the range [z0, z1] at the given x', () => {
    paintColumn(tiles, 3, 1, 5, TerrainType.BEDROCK);
    for (let z = 1; z <= 5; z++) {
      expect(tiles[3][z]).withContext(`tiles[3][${z}]`).toBe(TerrainType.BEDROCK);
    }
  });

  it('should not affect rows outside [z0, z1]', () => {
    paintColumn(tiles, 3, 2, 4, TerrainType.BEDROCK);
    expect(tiles[3][0]).toBe(TerrainType.ABYSS);
    expect(tiles[3][1]).toBe(TerrainType.ABYSS);
    expect(tiles[3][5]).toBe(TerrainType.ABYSS);
  });

  it('should not affect other columns (x values)', () => {
    paintColumn(tiles, 4, 0, 7, TerrainType.CRYSTAL);
    expect(tiles[3][0]).toBe(TerrainType.ABYSS);
    expect(tiles[5][0]).toBe(TerrainType.ABYSS);
  });

  it('should normalise reversed range (z0 > z1)', () => {
    paintColumn(tiles, 2, 5, 2, TerrainType.MOSS);
    for (let z = 2; z <= 5; z++) {
      expect(tiles[2][z]).withContext(`tiles[2][${z}] after reversed range`).toBe(TerrainType.MOSS);
    }
  });

  it('should produce identical output whether z0 < z1 or z0 > z1', () => {
    const stateA = createEmptyGrid(6, TerrainType.ABYSS);
    const stateB = createEmptyGrid(6, TerrainType.ABYSS);
    paintColumn(stateA.tiles, 1, 1, 4, TerrainType.CRYSTAL);
    paintColumn(stateB.tiles, 1, 4, 1, TerrainType.CRYSTAL);
    expect(stateA.tiles).toEqual(stateB.tiles);
  });

  it('should handle a single-cell range (z0 === z1)', () => {
    paintColumn(tiles, 5, 3, 3, TerrainType.MOSS);
    expect(tiles[5][3]).toBe(TerrainType.MOSS);
    expect(tiles[5][2]).toBe(TerrainType.ABYSS);
    expect(tiles[5][4]).toBe(TerrainType.ABYSS);
  });

  it('should be inclusive on both z0 and z1 endpoints', () => {
    paintColumn(tiles, 0, 0, 7, TerrainType.BEDROCK);
    expect(tiles[0][0]).toBe(TerrainType.BEDROCK);
    expect(tiles[0][7]).toBe(TerrainType.BEDROCK);
  });

  it('should overwrite previously painted tiles', () => {
    paintColumn(tiles, 2, 1, 5, TerrainType.BEDROCK);
    paintColumn(tiles, 2, 3, 3, TerrainType.CRYSTAL);
    expect(tiles[2][3]).toBe(TerrainType.CRYSTAL);
    expect(tiles[2][2]).toBe(TerrainType.BEDROCK);
    expect(tiles[2][4]).toBe(TerrainType.BEDROCK);
  });
});

// ---------------------------------------------------------------------------
// paintRect
// ---------------------------------------------------------------------------

describe('paintRect', () => {
  let tiles: TerrainType[][];

  beforeEach(() => {
    const state = createEmptyGrid(8, TerrainType.ABYSS);
    tiles = state.tiles;
  });

  it('should paint all tiles within the rectangle', () => {
    paintRect(tiles, 1, 1, 3, 3, TerrainType.BEDROCK);
    for (let x = 1; x <= 3; x++) {
      for (let z = 1; z <= 3; z++) {
        expect(tiles[x][z]).withContext(`tiles[${x}][${z}]`).toBe(TerrainType.BEDROCK);
      }
    }
  });

  it('should not affect tiles outside the rectangle', () => {
    paintRect(tiles, 2, 2, 4, 4, TerrainType.CRYSTAL);
    // corners outside
    expect(tiles[0][0]).toBe(TerrainType.ABYSS);
    expect(tiles[7][7]).toBe(TerrainType.ABYSS);
    expect(tiles[1][2]).toBe(TerrainType.ABYSS);
    expect(tiles[2][1]).toBe(TerrainType.ABYSS);
    expect(tiles[5][3]).toBe(TerrainType.ABYSS);
    expect(tiles[3][5]).toBe(TerrainType.ABYSS);
  });

  it('should handle a 1×1 rectangle (x0===x1, z0===z1)', () => {
    paintRect(tiles, 4, 4, 4, 4, TerrainType.MOSS);
    expect(tiles[4][4]).toBe(TerrainType.MOSS);
    expect(tiles[3][4]).toBe(TerrainType.ABYSS);
    expect(tiles[5][4]).toBe(TerrainType.ABYSS);
    expect(tiles[4][3]).toBe(TerrainType.ABYSS);
    expect(tiles[4][5]).toBe(TerrainType.ABYSS);
  });

  it('should handle a single row (z0 === z1)', () => {
    paintRect(tiles, 1, 3, 5, 3, TerrainType.MOSS);
    for (let x = 1; x <= 5; x++) {
      expect(tiles[x][3]).withContext(`tiles[${x}][3]`).toBe(TerrainType.MOSS);
    }
    expect(tiles[1][2]).toBe(TerrainType.ABYSS);
    expect(tiles[1][4]).toBe(TerrainType.ABYSS);
  });

  it('should handle a single column (x0 === x1)', () => {
    paintRect(tiles, 3, 1, 3, 5, TerrainType.CRYSTAL);
    for (let z = 1; z <= 5; z++) {
      expect(tiles[3][z]).withContext(`tiles[3][${z}]`).toBe(TerrainType.CRYSTAL);
    }
    expect(tiles[2][3]).toBe(TerrainType.ABYSS);
    expect(tiles[4][3]).toBe(TerrainType.ABYSS);
  });

  it('should be inclusive on all four boundary edges', () => {
    paintRect(tiles, 0, 0, 7, 7, TerrainType.BEDROCK);
    // all four corners must be painted
    expect(tiles[0][0]).toBe(TerrainType.BEDROCK);
    expect(tiles[7][0]).toBe(TerrainType.BEDROCK);
    expect(tiles[0][7]).toBe(TerrainType.BEDROCK);
    expect(tiles[7][7]).toBe(TerrainType.BEDROCK);
  });

  it('should overwrite previously painted tiles', () => {
    paintRect(tiles, 0, 0, 7, 7, TerrainType.BEDROCK);
    paintRect(tiles, 2, 2, 5, 5, TerrainType.CRYSTAL);
    expect(tiles[2][2]).toBe(TerrainType.CRYSTAL);
    expect(tiles[5][5]).toBe(TerrainType.CRYSTAL);
    // outside inner rect still bedrock
    expect(tiles[1][1]).toBe(TerrainType.BEDROCK);
    expect(tiles[6][6]).toBe(TerrainType.BEDROCK);
  });

  it('should paint all four TerrainType values correctly', () => {
    paintRect(tiles, 0, 0, 1, 1, TerrainType.BEDROCK);
    paintRect(tiles, 2, 0, 3, 1, TerrainType.CRYSTAL);
    paintRect(tiles, 0, 2, 1, 3, TerrainType.MOSS);
    paintRect(tiles, 2, 2, 3, 3, TerrainType.ABYSS);
    expect(tiles[0][0]).toBe(TerrainType.BEDROCK);
    expect(tiles[2][0]).toBe(TerrainType.CRYSTAL);
    expect(tiles[0][2]).toBe(TerrainType.MOSS);
    expect(tiles[2][2]).toBe(TerrainType.ABYSS);
  });

  it('should correctly paint a full grid', () => {
    const state = createEmptyGrid(4, TerrainType.ABYSS);
    paintRect(state.tiles, 0, 0, 3, 3, TerrainType.BEDROCK);
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        expect(state.tiles[x][z]).withContext(`tiles[${x}][${z}]`).toBe(TerrainType.BEDROCK);
      }
    }
  });
});
