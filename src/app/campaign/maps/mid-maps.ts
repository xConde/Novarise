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
// Map 9 — "Crossfire"  (15×15, 2 spawners, 2 exits)
// ---------------------------------------------------------------------------

/**
 * Dual spawners + dual exits with crossing paths. Maximum multi-path chaos.
 *
 * Layout (column-major, x=column 0-14, z=row 0-14):
 *   Background fill: CRYSTAL
 *
 *   Path A (top corridor, spawner A→exit B):
 *     Horizontal leg A1: z=2-3, x=0-6      — moves right from top-left
 *     Diagonal step A:   x=6-8, z=3-5      — steps diagonally through center
 *     Horizontal leg A2: z=5-6, x=7-14     — continues right to exit at top-right
 *     (Exit B is at top-right: x=14, z=2; connected via z=2-3 at x=12-14)
 *
 *   Path B (bottom corridor, spawner B→exit A):
 *     Horizontal leg B1: z=11-12, x=0-6    — moves right from bottom-left
 *     Diagonal step B:   x=6-8, z=9-11     — steps diagonally through center
 *     Horizontal leg B2: z=8-9, x=7-14     — continues right to exit at bottom-right
 *     (Exit A is at bottom-right: x=14, z=12; connected via z=11-12 at x=12-14)
 *
 *   Crossing zone (center): x=6-8, z=5-9   — all open BEDROCK where paths share tiles
 *   Moss at intersection center (7,7) and approach tiles
 *
 *   Spawner A: (0,2)   Spawner B: (0,12)
 *   Exit A:    (14,12) Exit B:    (14,2)
 *
 * BFS validity:
 *   SpawnerA→ExitA: z=2-3 leg → center crossing → z=11-12 via south crossing
 *   SpawnerA→ExitB: z=2-3 leg → x=12-14, z=2-3 direct
 *   SpawnerB→ExitA: z=11-12 leg → x=12-14, z=11-12 direct
 *   SpawnerB→ExitB: z=11-12 leg → center crossing → z=2-3 via north crossing
 */
export function buildCrossfire(): TerrainGridState {
  const GRID_SIZE = 15;

  // Start with Crystal everywhere (walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // --- Path A: top corridor (Spawner A at left, connects to BOTH exits) ---

  // Top horizontal corridor: z=2-3, x=0-14 (full width)
  paintRect(tiles, 0, 2, 14, 3, TerrainType.BEDROCK);

  // --- Path B: bottom corridor (Spawner B at left, connects to BOTH exits) ---

  // Bottom horizontal corridor: z=11-12, x=0-14 (full width)
  paintRect(tiles, 0, 11, 14, 12, TerrainType.BEDROCK);

  // --- Crossing zone: vertical connector in center links top and bottom corridors ---

  // Central vertical connector: x=6-8, z=3-11 (bridges both horizontal corridors)
  // This allows Path A enemies to cross to exit A, and Path B enemies to cross to exit B
  paintRect(tiles, 6, 3, 8, 11, TerrainType.BEDROCK);

  // --- Build platforms alongside corridors ---

  // Build areas above top corridor (z=0-1, x=1-13) — ABYSS depth (impassable)
  // (Already crystal, leave as crystal walls above the top corridor)

  // Open build areas between corridors at left side: x=1-5, z=4-10
  paintRect(tiles, 1, 4, 5, 10, TerrainType.BEDROCK);

  // Open build areas between corridors at right side: x=9-13, z=4-10
  paintRect(tiles, 9, 4, 13, 10, TerrainType.BEDROCK);

  // --- Crystal walls to channel paths (restore walls in build areas) ---

  // Inner wall left (separates build zone from open field left): x=0, z=4-10
  paintColumn(tiles, 0, 4, 10, TerrainType.CRYSTAL);

  // Inner wall right: x=14, z=4-10
  paintColumn(tiles, 14, 4, 10, TerrainType.CRYSTAL);

  // Crystal pillars in build zones for visual interest (non-blocking)
  tiles[2][6] = TerrainType.CRYSTAL;
  tiles[2][8] = TerrainType.CRYSTAL;
  tiles[4][5] = TerrainType.CRYSTAL;
  tiles[4][9] = TerrainType.CRYSTAL;
  tiles[10][5] = TerrainType.CRYSTAL;
  tiles[10][9] = TerrainType.CRYSTAL;
  tiles[12][6] = TerrainType.CRYSTAL;
  tiles[12][8] = TerrainType.CRYSTAL;

  // --- Moss accents at intersection center and approach tiles ---
  tiles[7][7] = TerrainType.MOSS;
  tiles[6][5] = TerrainType.MOSS;
  tiles[8][5] = TerrainType.MOSS;
  tiles[6][9] = TerrainType.MOSS;
  tiles[8][9] = TerrainType.MOSS;

  // --- Spawn / exit ---
  // Restore border tiles that were painted crystal
  tiles[0][2] = TerrainType.BEDROCK;
  tiles[0][12] = TerrainType.BEDROCK;
  tiles[14][2] = TerrainType.BEDROCK;
  tiles[14][12] = TerrainType.BEDROCK;

  state.spawnPoints = [
    { x: 0, z: 2 },
    { x: 0, z: 12 },
  ];
  state.exitPoints = [
    { x: 14, z: 12 },
    { x: 14, z: 2 },
  ];

  return state;
}

// ---------------------------------------------------------------------------
// Map 10 — "The Spiral"  (15×15, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Long clockwise spiral path that winds inward from the outer ring to center.
 * Very long path = lots of tower opportunities but limited build space on inner rings.
 *
 * Layout — path carved through Crystal fill:
 *
 *   Outer ring (clockwise):
 *     Top leg:    z=1-2, x=0-13   — left to right along top
 *     Right leg:  x=12-13, z=2-12 — down the right side
 *     Bottom leg: z=12-13, x=2-13 — right to left along bottom
 *     Left leg:   x=1-2, z=3-12   — up the left side
 *
 *   Inner ring (clockwise, 3 tiles inward):
 *     Top leg:    z=4-5, x=3-10   — left to right
 *     Right leg:  x=10-11, z=5-10 — down
 *     Bottom leg: z=10-11, x=4-10 — right to left
 *     Left drop:  x=3-4, z=5-10   — (already open from left leg connector)
 *
 *   Connector (outer → inner):
 *     At x=2-3, z=3-5 (joins outer left leg to inner top left)
 *
 *   Center exit area: x=6-8, z=6-8 — inner zone, exit at (7,7)
 *   Inner connector to center: x=5-6, z=7-8 or from inner bottom
 *
 *   Moss at each ring corner turn
 *
 *   Spawner: (0,1)   Exit: (7,7)
 */
export function buildTheSpiral(): TerrainGridState {
  const GRID_SIZE = 15;

  // Start with Crystal everywhere (walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // --- Outer ring (clockwise spiral) ---

  // Top leg: z=1-2, x=0-13 (left to right)
  paintRect(tiles, 0, 1, 13, 2, TerrainType.BEDROCK);

  // Right leg: x=12-13, z=2-12 (down)
  paintRect(tiles, 12, 2, 13, 12, TerrainType.BEDROCK);

  // Bottom leg: z=12-13, x=2-13 (right to left — connects to right leg at x=12-13)
  paintRect(tiles, 2, 12, 13, 13, TerrainType.BEDROCK);

  // Left leg: x=1-2, z=3-13 (up the left side — connects bottom leg to outer start)
  // Only z=3-12 to avoid overlapping the top leg at z=1-2
  paintRect(tiles, 1, 3, 2, 13, TerrainType.BEDROCK);

  // --- Connector: outer left leg → inner ring ---
  // At x=2-4, z=3-5: transition from outer left leg into inner top leg
  paintRect(tiles, 2, 3, 4, 5, TerrainType.BEDROCK);

  // --- Inner ring (clockwise, 3 tiles inward from outer) ---

  // Top leg: z=4-5, x=4-10 (left to right)
  paintRect(tiles, 4, 4, 10, 5, TerrainType.BEDROCK);

  // Right leg: x=10-11, z=5-10 (down)
  paintRect(tiles, 10, 5, 11, 10, TerrainType.BEDROCK);

  // Bottom leg: z=10-11, x=4-11 (right to left)
  paintRect(tiles, 4, 10, 11, 11, TerrainType.BEDROCK);

  // Left leg (inner): x=4-5, z=5-10 (down to join inner bottom)
  paintRect(tiles, 4, 5, 5, 10, TerrainType.BEDROCK);

  // --- Connector: inner ring → center exit ---
  // From inner bottom leg at x=6-8, z=10-11 down into center
  // Center corridor: x=6-8, z=7-11
  paintRect(tiles, 6, 7, 8, 11, TerrainType.BEDROCK);

  // Center exit zone: x=6-9, z=6-8
  paintRect(tiles, 6, 6, 9, 8, TerrainType.BEDROCK);

  // --- Moss accents at turn points ---
  tiles[13][2] = TerrainType.MOSS;   // outer top-right turn
  tiles[13][12] = TerrainType.MOSS;  // outer bottom-right turn
  tiles[2][13] = TerrainType.MOSS;   // outer bottom-left turn
  tiles[2][3] = TerrainType.MOSS;    // outer→inner connector
  tiles[10][5] = TerrainType.MOSS;   // inner top-right turn
  tiles[10][10] = TerrainType.MOSS;  // inner bottom-right turn
  tiles[4][10] = TerrainType.MOSS;   // inner bottom-left turn
  tiles[7][7] = TerrainType.MOSS;    // center exit zone

  // --- Spawn / exit ---
  state.spawnPoints = [{ x: 0, z: 1 }];
  state.exitPoints = [{ x: 7, z: 7 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 11 — "Siege"  (16×16, 3 spawners, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Three spawners converging on a central exit point. Requires balanced defense
 * across three fronts.
 *
 * Layout (column-major, x=column 0-15, z=row 0-15):
 *   Background fill: CRYSTAL
 *
 *   Central hub: x=6-9, z=6-9  — open BEDROCK where all paths converge
 *   Exit at (8, 8) — center of the map
 *
 *   North corridor (top spawner → center):
 *     x=7-8, z=0-7  — vertical channel from north edge down to hub
 *     Build areas: x=5-6, z=1-6 and x=9-10, z=1-6
 *
 *   West corridor (left spawner → center):
 *     z=7-8, x=0-7  — horizontal channel from west edge right to hub
 *     Build areas: z=5-6, x=1-6 and z=9-10, x=1-6
 *
 *   South corridor (bottom spawner → center):
 *     x=7-8, z=8-15 — vertical channel from hub down to south edge
 *     Build areas: x=5-6, z=9-14 and x=9-10, z=9-14
 *
 *   Moss accents at hub corners and mid-corridor
 *
 *   Spawner 1 (north): (8,0)    Spawner 2 (west): (0,8)    Spawner 3 (south): (8,15)
 *   Exit: (8,8)
 */
export function buildSiege(): TerrainGridState {
  const GRID_SIZE = 16;

  // Start with Crystal everywhere (walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // --- Central hub: x=6-9, z=6-9 ---
  paintRect(tiles, 6, 6, 9, 9, TerrainType.BEDROCK);

  // --- North corridor: x=7-8, z=0-7 ---
  paintRect(tiles, 7, 0, 8, 7, TerrainType.BEDROCK);

  // North build areas flanking the corridor
  paintRect(tiles, 5, 1, 6, 6, TerrainType.BEDROCK);
  paintRect(tiles, 9, 1, 10, 6, TerrainType.BEDROCK);

  // --- West corridor: z=7-8, x=0-7 ---
  paintRect(tiles, 0, 7, 7, 8, TerrainType.BEDROCK);

  // West build areas flanking the corridor
  paintRect(tiles, 1, 5, 6, 6, TerrainType.BEDROCK);
  paintRect(tiles, 1, 9, 6, 10, TerrainType.BEDROCK);

  // --- South corridor: x=7-8, z=9-15 ---
  paintRect(tiles, 7, 9, 8, 15, TerrainType.BEDROCK);

  // South build areas flanking the corridor
  paintRect(tiles, 5, 9, 6, 14, TerrainType.BEDROCK);
  paintRect(tiles, 9, 9, 10, 14, TerrainType.BEDROCK);

  // --- Crystal separators between build zones (keep zones distinct) ---

  // NW corner separator: x=3-4, z=3-4
  paintRect(tiles, 3, 3, 4, 4, TerrainType.CRYSTAL);

  // NE corner separator: x=11-12, z=3-4
  paintRect(tiles, 11, 3, 12, 4, TerrainType.CRYSTAL);

  // SW corner separator: x=3-4, z=11-12
  paintRect(tiles, 3, 11, 4, 12, TerrainType.CRYSTAL);

  // Eastern wall (no east corridor — closed flank)
  // Already crystal; add reinforcement tiles for clarity
  paintRect(tiles, 11, 7, 14, 8, TerrainType.CRYSTAL);

  // --- Moss accents at hub and mid-corridor points ---
  tiles[8][8] = TerrainType.MOSS;   // center exit
  tiles[6][6] = TerrainType.MOSS;   // hub NW corner
  tiles[9][6] = TerrainType.MOSS;   // hub NE corner
  tiles[6][9] = TerrainType.MOSS;   // hub SW corner
  tiles[9][9] = TerrainType.MOSS;   // hub SE corner
  tiles[7][3] = TerrainType.MOSS;   // north corridor mid
  tiles[3][7] = TerrainType.MOSS;   // west corridor mid
  tiles[7][12] = TerrainType.MOSS;  // south corridor mid

  // --- Spawn / exit ---
  // Ensure spawner/exit tiles are walkable (crystal border may have overwritten)
  tiles[8][0] = TerrainType.BEDROCK;   // north spawner
  tiles[0][8] = TerrainType.BEDROCK;   // west spawner
  tiles[8][15] = TerrainType.BEDROCK;  // south spawner
  tiles[8][8] = TerrainType.MOSS;      // center exit (already set above)

  state.spawnPoints = [
    { x: 8, z: 0 },
    { x: 0, z: 8 },
    { x: 8, z: 15 },
  ];
  state.exitPoints = [{ x: 8, z: 8 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 12 — "Labyrinth"  (16×16, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Complex maze with multiple viable routes. Tower placement redirects enemies
 * from shorter to longer paths.
 *
 * Layout — corridors carved through Crystal fill, all 2 tiles wide:
 *
 *   Four route tiers connecting (0,1) → (15,14):
 *
 *   Route A (top fast route):
 *     Top corridor:    z=1-2, x=0-13       — enters from left, moves right
 *     Right drop A:    x=13-14, z=2-6      — down the right side
 *     Mid-top cross:   z=6-7, x=7-14       — moves left to crossroads
 *
 *   Route B (through upper-mid):
 *     From top corridor at x=4-5, z=2-5    — left vertical branch
 *     Mid connector:   z=5-6, x=4-10       — horizontal link
 *     Cross-drop B:    x=9-10, z=6-10      — down to lower mid
 *
 *   Route C (lower-mid):
 *     Lower corridor:  z=9-10, x=2-14      — wide horizontal corridor
 *     Right drop C:    x=13-14, z=10-14    — down to exit corridor
 *
 *   Route D (bottom slow route):
 *     Left drop:       x=1-2, z=2-11       — down the left side
 *     Bottom corridor: z=11-12, x=1-14     — full width
 *     Exit connector:  x=13-14, z=12-14    — to exit
 *
 *   Exit corridor:     z=13-14, x=0-15     — full width exit row
 *
 *   Cross-links at intersections: (x=7-8, z=6-10) centre vertical
 *
 *   Moss at major intersections
 *
 *   Spawner: (0,1)   Exit: (15,14)
 */
export function buildLabyrinth(): TerrainGridState {
  const GRID_SIZE = 16;

  // Start with Crystal everywhere (maze walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // --- Route A: top fast corridor ---

  // Top corridor: z=1-2, x=0-13
  paintRect(tiles, 0, 1, 13, 2, TerrainType.BEDROCK);

  // Right drop A: x=13-14, z=2-6
  paintRect(tiles, 13, 2, 14, 6, TerrainType.BEDROCK);

  // Mid-top cross: z=6-7, x=7-14
  paintRect(tiles, 7, 6, 14, 7, TerrainType.BEDROCK);

  // --- Route B: upper-mid branch ---

  // Left branch drop from top corridor: x=4-5, z=2-5
  paintRect(tiles, 4, 2, 5, 5, TerrainType.BEDROCK);

  // Mid connector: z=5-6, x=4-10
  paintRect(tiles, 4, 5, 10, 6, TerrainType.BEDROCK);

  // Cross-drop B: x=9-10, z=6-10
  paintRect(tiles, 9, 6, 10, 10, TerrainType.BEDROCK);

  // --- Centre vertical cross-link (connects routes A/B/C) ---
  // x=7-8, z=6-10
  paintRect(tiles, 7, 6, 8, 10, TerrainType.BEDROCK);

  // --- Route C: lower-mid corridor ---

  // Lower corridor: z=9-10, x=2-14
  paintRect(tiles, 2, 9, 14, 10, TerrainType.BEDROCK);

  // Right drop C: x=13-14, z=10-14
  paintRect(tiles, 13, 10, 14, 14, TerrainType.BEDROCK);

  // --- Route D: bottom slow route ---

  // Left drop: x=1-2, z=2-11
  paintRect(tiles, 1, 2, 2, 11, TerrainType.BEDROCK);

  // Bottom corridor: z=11-12, x=1-14
  paintRect(tiles, 1, 11, 14, 12, TerrainType.BEDROCK);

  // --- Exit corridor: z=13-14, x=0-15 ---
  paintRect(tiles, 0, 13, 15, 14, TerrainType.BEDROCK);

  // --- Dead-end alcoves for tower placement ---
  // Alcove NE: x=11-12, z=3-4
  paintRect(tiles, 11, 3, 12, 4, TerrainType.BEDROCK);

  // Alcove SW: x=3-4, z=7-8
  paintRect(tiles, 3, 7, 4, 8, TerrainType.BEDROCK);

  // --- Moss at major intersections ---
  tiles[4][5] = TerrainType.MOSS;   // Route B/top branch junction
  tiles[9][9] = TerrainType.MOSS;   // cross-drop B meets lower corridor
  tiles[7][9] = TerrainType.MOSS;   // centre link meets lower corridor
  tiles[13][6] = TerrainType.MOSS;  // Route A right drop meets mid-top
  tiles[1][11] = TerrainType.MOSS;  // Route D left drop meets bottom corridor
  tiles[13][13] = TerrainType.MOSS; // right drop C meets exit corridor
  tiles[7][6] = TerrainType.MOSS;   // centre cross junction

  // --- Spawn / exit ---
  // Ensure border tiles are walkable
  tiles[0][1] = TerrainType.BEDROCK;   // spawner
  tiles[15][14] = TerrainType.BEDROCK; // exit

  state.spawnPoints = [{ x: 0, z: 1 }];
  state.exitPoints = [{ x: 15, z: 14 }];

  return state;
}
