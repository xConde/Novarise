import { TerrainGridState } from '../../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';

/**
 * Metadata for a bundled demo map displayed on the map-select screen.
 * Separated from MapMetadata (which requires an id and timestamps from storage).
 */
export interface DemoMapConfig {
  /** Unique key used for identification in UI and tests */
  readonly key: string;
  /** Display name shown on the map card */
  readonly name: string;
  /** Short description of the map's characteristics */
  readonly description: string;
  /** The full terrain grid state, ready for MapBridgeService */
  readonly state: TerrainGridState;
}

// --- Shorthand aliases for readability in tile grids ---
const B = TerrainType.BEDROCK; // Buildable ground (towers go here)
const M = TerrainType.MOSS;    // Traversable path (enemies walk here)
const C = TerrainType.CRYSTAL; // Obstacle (wall)
const A = TerrainType.ABYSS;   // Obstacle (pit)

const DEMO_MAP_VERSION = '2.0.0';

/**
 * Convert a row-major visual grid (rows[z][x]) to column-major tiles[x][z]
 * so the layout in code reads like a top-down view of the map.
 *
 * Visual grid:  rows[z][x] — z increases downward, x increases rightward
 * Tiles array:  tiles[x][z] — x is column index, z is row index
 */
function rowMajorToColumnMajor(rows: TerrainType[][]): TerrainType[][] {
  const gridSize = rows.length;
  const tiles: TerrainType[][] = [];
  for (let x = 0; x < gridSize; x++) {
    tiles[x] = [];
    for (let z = 0; z < gridSize; z++) {
      tiles[x][z] = rows[z][x];
    }
  }
  return tiles;
}

/** Generate a flat height map (all zeros) for a given grid size. */
function flatHeightMap(gridSize: number): number[][] {
  const map: number[][] = [];
  for (let x = 0; x < gridSize; x++) {
    map[x] = [];
    for (let z = 0; z < gridSize; z++) {
      map[x][z] = 0;
    }
  }
  return map;
}

// ============================================================
// CLASSIC (10x10) — Simple winding path, great for beginners
// ============================================================
// Legend: S=Spawner, E=Exit, M=Path, B=Buildable, C=Crystal, A=Abyss
//
//   0 1 2 3 4 5 6 7 8 9
// 0 B B B B B B B B B B
// 1 S M M M B B B B B B
// 2 B B B M B B B B B B
// 3 B B B M M M M B B B
// 4 B B B B B B M B B B
// 5 B C B B B B M M M B
// 6 B B B B B B B B M B
// 7 B B B M M M M M M B
// 8 B B B M B B B B B B
// 9 B B B M M M M M M E

const CLASSIC_GRID_SIZE = 10;

const CLASSIC_ROWS: TerrainType[][] = [
  /*z=0*/ [B, B, B, B, B, B, B, B, B, B],
  /*z=1*/ [M, M, M, M, B, B, B, B, B, B],
  /*z=2*/ [B, B, B, M, B, B, B, B, B, B],
  /*z=3*/ [B, B, B, M, M, M, M, B, B, B],
  /*z=4*/ [B, B, B, B, B, B, M, B, B, B],
  /*z=5*/ [B, C, B, B, B, B, M, M, M, B],
  /*z=6*/ [B, B, B, B, B, B, B, B, M, B],
  /*z=7*/ [B, B, B, M, M, M, M, M, M, B],
  /*z=8*/ [B, B, B, M, B, B, B, B, B, B],
  /*z=9*/ [B, B, B, M, M, M, M, M, M, M],
];

const CLASSIC_STATE: TerrainGridState = {
  gridSize: CLASSIC_GRID_SIZE,
  tiles: rowMajorToColumnMajor(CLASSIC_ROWS),
  heightMap: flatHeightMap(CLASSIC_GRID_SIZE),
  spawnPoints: [{ x: 0, z: 1 }],   // top-left edge
  exitPoints: [{ x: 9, z: 9 }],    // bottom-right corner
  version: DEMO_MAP_VERSION,
};

// ============================================================
// CROSSROADS (12x12) — Two spawners, two exits, crossing paths
// ============================================================
//
//   0 1 2 3 4 5 6 7 8 9 A B
// 0 B B B B B S B B B B B B
// 1 B B B B B M B B B B B B
// 2 B B C B B M B B C B B B
// 3 B B B B B M B B B B B B
// 4 B B B B B M B B B B B B
// 5 S M M M M M M M M M M E
// 6 B B B B B M B B B B B B
// 7 B B B B B M B B B B B B
// 8 B B C B B M B B C B B B
// 9 B B B B B M B B B B B B
// A B B B B B M B B B B B B
// B B B B B B E B B B B B B

const CROSSROADS_GRID_SIZE = 12;

const CROSSROADS_ROWS: TerrainType[][] = [
  /*z=0 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=1 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=2 */ [B, B, C, B, B, M, B, B, C, B, B, B],
  /*z=3 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=4 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=5 */ [M, M, M, M, M, M, M, M, M, M, M, M],
  /*z=6 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=7 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=8 */ [B, B, C, B, B, M, B, B, C, B, B, B],
  /*z=9 */ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=10*/ [B, B, B, B, B, M, B, B, B, B, B, B],
  /*z=11*/ [B, B, B, B, B, M, B, B, B, B, B, B],
];

const CROSSROADS_STATE: TerrainGridState = {
  gridSize: CROSSROADS_GRID_SIZE,
  tiles: rowMajorToColumnMajor(CROSSROADS_ROWS),
  heightMap: flatHeightMap(CROSSROADS_GRID_SIZE),
  spawnPoints: [
    { x: 5, z: 0 },    // top center
    { x: 0, z: 5 },    // left center
  ],
  exitPoints: [
    { x: 5, z: 11 },   // bottom center
    { x: 11, z: 5 },   // right center
  ],
  version: DEMO_MAP_VERSION,
};

// ============================================================
// FORTRESS (15x15) — Large open map, minimal path, lots of room
// ============================================================
//
//    0 1 2 3 4 5 6 7 8 9 A B C D E
//  0 B B B B B B B B B B B B B B B
//  1 S M M B B B B B B B B B B B B
//  2 B B M B B B B A A B B B B B B
//  3 B B M M M B B B B B B B B B B
//  4 B B B B M B B B B B B B B B B
//  5 B B B B M M M M B B B B B B B
//  6 B B B B B B B M B B C B B B B
//  7 B A B B B B B M M M B B B B B
//  8 B B B B B B B B B M B B B B B
//  9 B B B B C B B B B M M M B B B
// 10 B B B B B B B B B B B M B B B
// 11 B B B B B B B B B B B M M M B
// 12 B B B B B B A B B B B B B M B
// 13 B B B B B B B B B B B B B M M
// 14 B B B B B B B B B B B B B B E

const FORTRESS_GRID_SIZE = 15;

const FORTRESS_ROWS: TerrainType[][] = [
  /*z=0 */ [B, B, B, B, B, B, B, B, B, B, B, B, B, B, B],
  /*z=1 */ [M, M, M, B, B, B, B, B, B, B, B, B, B, B, B],
  /*z=2 */ [B, B, M, B, B, B, B, A, A, B, B, B, B, B, B],
  /*z=3 */ [B, B, M, M, M, B, B, B, B, B, B, B, B, B, B],
  /*z=4 */ [B, B, B, B, M, B, B, B, B, B, B, B, B, B, B],
  /*z=5 */ [B, B, B, B, M, M, M, M, B, B, B, B, B, B, B],
  /*z=6 */ [B, B, B, B, B, B, B, M, B, B, C, B, B, B, B],
  /*z=7 */ [B, A, B, B, B, B, B, M, M, M, B, B, B, B, B],
  /*z=8 */ [B, B, B, B, B, B, B, B, B, M, B, B, B, B, B],
  /*z=9 */ [B, B, B, B, C, B, B, B, B, M, M, M, B, B, B],
  /*z=10*/ [B, B, B, B, B, B, B, B, B, B, B, M, B, B, B],
  /*z=11*/ [B, B, B, B, B, B, B, B, B, B, B, M, M, M, B],
  /*z=12*/ [B, B, B, B, B, B, A, B, B, B, B, B, B, M, B],
  /*z=13*/ [B, B, B, B, B, B, B, B, B, B, B, B, B, M, M],
  /*z=14*/ [B, B, B, B, B, B, B, B, B, B, B, B, B, B, M],
];

const FORTRESS_STATE: TerrainGridState = {
  gridSize: FORTRESS_GRID_SIZE,
  tiles: rowMajorToColumnMajor(FORTRESS_ROWS),
  heightMap: flatHeightMap(FORTRESS_GRID_SIZE),
  spawnPoints: [{ x: 0, z: 1 }],    // top-left edge
  exitPoints: [{ x: 14, z: 14 }],   // bottom-right corner
  version: DEMO_MAP_VERSION,
};

// ============================================================
// Exported demo maps array
// ============================================================

export const DEMO_MAPS: readonly DemoMapConfig[] = [
  {
    key: 'classic',
    name: 'Classic',
    description: 'A winding path with clear tower spots. Great for beginners.',
    state: CLASSIC_STATE,
  },
  {
    key: 'crossroads',
    name: 'Crossroads',
    description: 'Two spawners, two exits, paths that cross. Demands strategy.',
    state: CROSSROADS_STATE,
  },
  {
    key: 'fortress',
    name: 'Fortress',
    description: 'Wide open terrain with a long path. Build your defenses anywhere.',
    state: FORTRESS_STATE,
  },
] as const;
