import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';

/** Schema version for all hand-crafted campaign maps. */
const MAP_VERSION = '2.0.0';

// ---------------------------------------------------------------------------
// Grid builder helpers (module-private)
// ---------------------------------------------------------------------------

/**
 * Allocates a gridSize×gridSize grid filled with the given terrain type,
 * plus an all-zero heightMap. spawnPoints and exitPoints are left empty
 * for the caller to populate.
 */
function createEmptyGrid(size: number, fill: TerrainType): TerrainGridState {
  const tiles: TerrainType[][] = [];
  const heightMap: number[][] = [];
  for (let x = 0; x < size; x++) {
    tiles[x] = [];
    heightMap[x] = [];
    for (let z = 0; z < size; z++) {
      tiles[x][z] = fill;
      heightMap[x][z] = 0;
    }
  }
  return {
    gridSize: size,
    tiles,
    heightMap,
    spawnPoints: [],
    exitPoints: [],
    version: MAP_VERSION,
  };
}

/**
 * Paints tiles[x][z] for x in [x0, x1] at fixed row z with the given type.
 * Inclusive on both ends.
 */
function paintRow(
  tiles: TerrainType[][],
  z: number,
  x0: number,
  x1: number,
  type: TerrainType,
): void {
  for (let x = x0; x <= x1; x++) {
    tiles[x][z] = type;
  }
}

/**
 * Paints tiles[x][z] for z in [z0, z1] at fixed column x with the given type.
 * Inclusive on both ends; z0 may be greater than z1 (range is normalised).
 */
function paintColumn(
  tiles: TerrainType[][],
  x: number,
  z0: number,
  z1: number,
  type: TerrainType,
): void {
  const lo = Math.min(z0, z1);
  const hi = Math.max(z0, z1);
  for (let z = lo; z <= hi; z++) {
    tiles[x][z] = type;
  }
}

/**
 * Paints a filled rectangle of tiles with the given type.
 * Columns x in [x0, x1], rows z in [z0, z1] — all inclusive.
 */
function paintRect(
  tiles: TerrainType[][],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  type: TerrainType,
): void {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      tiles[x][z] = type;
    }
  }
}

// ---------------------------------------------------------------------------
// Map 1 — "First Light"  (10×10, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Simplest possible map. Teaches tower placement and basic defense.
 *
 * Layout (column-major, x=column 0-9, z=row 0-9):
 *   z=0,9       — Crystal border (top/bottom edge)
 *   z=1,8       — Abyss depth border
 *   z=2-3       — Buildable Bedrock above the corridor
 *   z=4-5       — Main corridor Bedrock (enemy path)
 *   z=6-7       — Buildable Bedrock below the corridor
 *   Moss accents at corner-build tiles (1,2), (8,2), (1,7), (8,7)
 *   Spawner: (0,4)  Exit: (9,5)
 */
export function buildFirstLight(): TerrainGridState {
  const GRID_SIZE = 10;
  const state = createEmptyGrid(GRID_SIZE, TerrainType.ABYSS);
  const { tiles } = state;

  // Crystal top/bottom borders
  paintRow(tiles, 0, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  paintRow(tiles, GRID_SIZE - 1, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);

  // Abyss depth border rows (z=1 and z=8)
  paintRow(tiles, 1, 0, GRID_SIZE - 1, TerrainType.ABYSS);
  paintRow(tiles, 8, 0, GRID_SIZE - 1, TerrainType.ABYSS);

  // Buildable area above corridor (z=2-3)
  paintRect(tiles, 0, 2, GRID_SIZE - 1, 3, TerrainType.BEDROCK);

  // Main corridor (z=4-5) — enemy path left to right
  paintRect(tiles, 0, 4, GRID_SIZE - 1, 5, TerrainType.BEDROCK);

  // Buildable area below corridor (z=6-7)
  paintRect(tiles, 0, 6, GRID_SIZE - 1, 7, TerrainType.BEDROCK);

  // Moss corner accents for visual variety
  tiles[1][2] = TerrainType.MOSS;
  tiles[8][2] = TerrainType.MOSS;
  tiles[1][7] = TerrainType.MOSS;
  tiles[8][7] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 0, z: 4 }];
  state.exitPoints = [{ x: 9, z: 5 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 2 — "The Bend"  (10×10, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * L-shaped path. Teaches range positioning at corners.
 *
 * Layout:
 *   Vertical corridor: x=2-3, z=0-6
 *   Horizontal corridor: z=6-7, x=2-8
 *   Crystal left wall: x=1, z=0-8
 *   Crystal inner corner wall: x=4, z=0-5
 *   Crystal top of horizontal: z=5, x=4-9
 *   Crystal bottom wall: z=8, x=1-9
 *   Crystal right wall: x=9, z=5-8
 *   Abyss fills remaining space (top-right zone, edges)
 *   Moss at the corner turn point (3,6)
 *   Spawner: (2,0)  Exit: (8,7)
 */
export function buildTheBend(): TerrainGridState {
  const GRID_SIZE = 10;

  // Start with Abyss everywhere
  const state = createEmptyGrid(GRID_SIZE, TerrainType.ABYSS);
  const { tiles } = state;

  // Vertical corridor: columns x=2-3, rows z=0-6
  paintRect(tiles, 2, 0, 3, 6, TerrainType.BEDROCK);

  // Horizontal corridor: row z=6-7, columns x=2-8
  paintRect(tiles, 2, 6, 8, 7, TerrainType.BEDROCK);

  // Crystal walls — define the L channel
  // Left boundary of vertical corridor
  paintColumn(tiles, 1, 0, 8, TerrainType.CRYSTAL);
  // Right boundary of vertical corridor (inner corner wall)
  paintColumn(tiles, 4, 0, 5, TerrainType.CRYSTAL);
  // Ceiling of horizontal corridor (above z=6)
  paintRow(tiles, 5, 4, 9, TerrainType.CRYSTAL);
  // Floor of horizontal corridor
  paintRow(tiles, 8, 1, 9, TerrainType.CRYSTAL);
  // Right boundary of horizontal corridor
  paintColumn(tiles, 9, 5, 8, TerrainType.CRYSTAL);

  // Moss accent at the inside corner of the turn
  tiles[3][6] = TerrainType.MOSS;
  tiles[2][6] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 2, z: 0 }];
  state.exitPoints = [{ x: 8, z: 7 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 3 — "Serpentine"  (12×12, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Classic S-curve zigzag. Teaches economy and upgrades — long path
 * means more time between spawn and exit, more gold income available.
 *
 * Layout (3 horizontal legs connected by vertical turns):
 *   Leg 1 (top):    z=1-2, x=0-9  — left to right
 *   Turn 1:         x=9-10, z=2-5  — vertical connector down
 *   Leg 2 (middle): z=5-6, x=2-10 — right to left (path meets Turn 1 at x=10, z=5)
 *   Turn 2:         x=2-3, z=6-9  — vertical connector down
 *   Leg 3 (bottom): z=9-10, x=2-11 — left to right
 *
 *   Crystal walls at z=3-4 (between legs 1 and 2) and z=7-8 (between legs 2 and 3)
 *   Moss accents at turn points
 *   Spawner: (0,1)  Exit: (11,10)
 */
export function buildSerpentine(): TerrainGridState {
  const GRID_SIZE = 12;

  // Start with Abyss everywhere
  const state = createEmptyGrid(GRID_SIZE, TerrainType.ABYSS);
  const { tiles } = state;

  // Leg 1 (top): z=1-2, x=0-9
  paintRect(tiles, 0, 1, 9, 2, TerrainType.BEDROCK);

  // Turn 1: x=9-10, z=2-5 (vertical connector, right side)
  paintRect(tiles, 9, 2, 10, 5, TerrainType.BEDROCK);

  // Leg 2 (middle): z=5-6, x=2-10
  paintRect(tiles, 2, 5, 10, 6, TerrainType.BEDROCK);

  // Turn 2: x=2-3, z=6-9 (vertical connector, left side)
  paintRect(tiles, 2, 6, 3, 9, TerrainType.BEDROCK);

  // Leg 3 (bottom): z=9-10, x=2-11
  paintRect(tiles, 2, 9, 11, 10, TerrainType.BEDROCK);

  // Crystal walls between legs
  // Between Leg 1 and Leg 2 (z=3-4), only where there's no corridor
  paintRow(tiles, 3, 0, 8, TerrainType.CRYSTAL);
  paintRow(tiles, 4, 0, 8, TerrainType.CRYSTAL);

  // Between Leg 2 and Leg 3 (z=7-8), only where there's no corridor
  paintRow(tiles, 7, 4, 11, TerrainType.CRYSTAL);
  paintRow(tiles, 8, 4, 11, TerrainType.CRYSTAL);

  // Moss accents at turn points for visual interest
  tiles[9][2] = TerrainType.MOSS;
  tiles[10][5] = TerrainType.MOSS;
  tiles[2][6] = TerrainType.MOSS;
  tiles[3][9] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 0, z: 1 }];
  state.exitPoints = [{ x: 11, z: 10 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 4 — "The Fork"  (12×12, 1 spawner, 2 exits)
// ---------------------------------------------------------------------------

/**
 * Path splits into two branches. Teaches multi-exit defense and resource splitting.
 *
 * Layout:
 *   Main corridor: z=5-6, x=0-5  — horizontal entry from left
 *   Split point at x=5
 *   North branch: z=5 goes up x=5-10 at z=1-2, then exit at x=11
 *     Vertical connector: x=5-6, z=2-5 (north branch descends z=2→5 to meet main)
 *     Horizontal north arm: z=1-2, x=5-10
 *   South branch: z=6 goes down x=5-10 at z=9-10, then exit at x=11
 *     Vertical connector: x=5-6, z=6-9 (south branch ascends z=6→9)
 *     Horizontal south arm: z=9-10, x=5-10
 *   Crystal walls separate branches and borders
 *   Moss accents at split point
 *   Spawner: (0,5)  Exit 1 (north): (11,1)  Exit 2 (south): (11,10)
 */
export function buildTheFork(): TerrainGridState {
  const GRID_SIZE = 12;

  // Start with Abyss everywhere
  const state = createEmptyGrid(GRID_SIZE, TerrainType.ABYSS);
  const { tiles } = state;

  // Main corridor entering from the left: z=5-6, x=0-5
  paintRect(tiles, 0, 5, 5, 6, TerrainType.BEDROCK);

  // North branch vertical connector: x=5-6, z=2-5
  paintRect(tiles, 5, 2, 6, 5, TerrainType.BEDROCK);

  // North branch horizontal arm: z=1-2, x=5-11
  paintRect(tiles, 5, 1, 11, 2, TerrainType.BEDROCK);

  // South branch vertical connector: x=5-6, z=6-9
  paintRect(tiles, 5, 6, 6, 9, TerrainType.BEDROCK);

  // South branch horizontal arm: z=9-10, x=5-11
  paintRect(tiles, 5, 9, 11, 10, TerrainType.BEDROCK);

  // Crystal walls — create borders and channel separators
  // Top border row
  paintRow(tiles, 0, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  // Bottom border row
  paintRow(tiles, GRID_SIZE - 1, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  // Left border column
  paintColumn(tiles, 0, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);

  // Ceiling of north arm
  // (z=0 is already crystal border; z=1 is open bedrock for north arm, ok)

  // Floor of north arm / ceiling of gap between north and south
  // Crystal wall at z=3-4 from x=7 to x=11 (gap between north arm z=1-2 and corridor z=5-6)
  paintRect(tiles, 7, 3, 11, 4, TerrainType.CRYSTAL);

  // Crystal wall at z=7-8 from x=7 to x=11 (gap between corridor z=5-6 and south arm z=9-10)
  paintRect(tiles, 7, 7, 11, 8, TerrainType.CRYSTAL);

  // Restore spawn tile (left border painted over it)
  tiles[0][5] = TerrainType.BEDROCK;
  tiles[0][6] = TerrainType.BEDROCK;

  // Moss accents at the split point
  tiles[5][5] = TerrainType.MOSS;
  tiles[5][6] = TerrainType.MOSS;
  tiles[6][5] = TerrainType.MOSS;
  tiles[6][6] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 0, z: 5 }];
  state.exitPoints = [
    { x: 11, z: 1 },
    { x: 11, z: 10 },
  ];

  return state;
}
