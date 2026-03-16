import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { createEmptyGrid, paintRow, paintColumn, paintRect } from './map-helpers';

// ---------------------------------------------------------------------------
// Map 5 — "Twin Gates"  (12×12, 2 spawners, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Two entry corridors converge at a single exit. Teaches threat management
 * from multiple directions.
 *
 * Layout (column-major, x=column 0-11, z=row 0-11):
 *   Background fill: ABYSS
 *
 *   Top corridor:   z=2-3, x=0-7  — top spawner travels right
 *   Vertical join (top):  x=7-8, z=3-5  — corridor bends down to merge zone
 *   Bottom corridor: z=8-9, x=0-7  — bottom spawner travels right
 *   Vertical join (bottom): x=7-8, z=5-8  — corridor bends up to merge zone
 *   Merge zone:  z=5-6, x=7-11  — both paths join here, exit at x=11,z=5
 *
 *   Crystal wall separating corridors: x=0-6, z=4-7
 *   Crystal outer borders: z=0,z=11 and x=0,x=11 (edges only; spawn/exit tiles restored)
 *
 *   Moss accents at merge point and corridor turns
 *
 *   Spawner 1: (0,2)   Spawner 2: (0,9)   Exit: (11,5)
 */
export function buildTwinGates(): TerrainGridState {
  const GRID_SIZE = 12;

  const state = createEmptyGrid(GRID_SIZE, TerrainType.ABYSS);
  const { tiles } = state;

  // --- Corridors ---

  // Top corridor: z=2-3, x=0-7
  paintRect(tiles, 0, 2, 7, 3, TerrainType.BEDROCK);

  // Top vertical join: x=7-8, z=3-5 (connects top corridor to merge zone)
  paintRect(tiles, 7, 3, 8, 5, TerrainType.BEDROCK);

  // Bottom corridor: z=8-9, x=0-7
  paintRect(tiles, 0, 8, 7, 9, TerrainType.BEDROCK);

  // Bottom vertical join: x=7-8, z=5-8 (connects bottom corridor to merge zone)
  paintRect(tiles, 7, 5, 8, 8, TerrainType.BEDROCK);

  // Merge zone: z=5-6, x=7-11
  paintRect(tiles, 7, 5, 11, 6, TerrainType.BEDROCK);

  // --- Crystal walls ---

  // Top/bottom outer border rows
  paintRow(tiles, 0, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  paintRow(tiles, GRID_SIZE - 1, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);

  // Crystal divider between the two corridors: z=4-7, x=0-6
  paintRect(tiles, 0, 4, 6, 7, TerrainType.CRYSTAL);

  // Crystal wall separating merge zone above from open abyss: x=9-11, z=0-4
  paintRect(tiles, 9, 1, 11, 4, TerrainType.CRYSTAL);

  // Crystal wall separating merge zone below from open abyss: x=9-11, z=7-10
  paintRect(tiles, 9, 7, 11, 10, TerrainType.CRYSTAL);

  // --- Moss accents ---
  // At merge point where corridors converge
  tiles[8][5] = TerrainType.MOSS;
  tiles[8][6] = TerrainType.MOSS;
  // At top corridor turn
  tiles[7][3] = TerrainType.MOSS;
  // At bottom corridor turn
  tiles[7][8] = TerrainType.MOSS;

  // --- Spawn / exit ---
  state.spawnPoints = [
    { x: 0, z: 2 },
    { x: 0, z: 9 },
  ];
  state.exitPoints = [{ x: 11, z: 5 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 6 — "Open Ground"  (14×14, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Nearly open field. Teaches strategic tower placement to create longer paths.
 *
 * Layout (column-major, x=column 0-13, z=row 0-13):
 *   Background fill: BEDROCK (almost entirely open)
 *   Crystal outer border: x=0,13 columns + z=0,13 rows (1-tile perimeter)
 *   Spawn tile at (0,7) and exit tile at (13,6) are restored to BEDROCK
 *
 *   Scattered Crystal pillars (small 1-2 tile formations) for visual structure:
 *     Pillar A: (4,3)-(4,4)
 *     Pillar B: (9,4)
 *     Pillar C: (3,9)-(4,9)
 *     Pillar D: (9,9)-(9,10)
 *     Pillar E: (6,6)-(7,6) — centre obstructions
 *     Pillar F: (6,7)-(7,7)
 *
 *   Moss accents scattered for visual variety
 *
 *   Spawner: (0,7)   Exit: (13,6)
 */
export function buildOpenGround(): TerrainGridState {
  const GRID_SIZE = 14;

  // Start fully open
  const state = createEmptyGrid(GRID_SIZE, TerrainType.BEDROCK);
  const { tiles } = state;

  // Crystal perimeter border
  paintRow(tiles, 0, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  paintRow(tiles, GRID_SIZE - 1, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  paintColumn(tiles, 0, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);
  paintColumn(tiles, GRID_SIZE - 1, 0, GRID_SIZE - 1, TerrainType.CRYSTAL);

  // Restore spawn and exit tiles (border overwrote them)
  tiles[0][7] = TerrainType.BEDROCK;
  tiles[GRID_SIZE - 1][6] = TerrainType.BEDROCK;

  // Scattered Crystal pillars — visual interest without blocking the field
  // (All isolated, ensuring BFS path always exists across open BEDROCK)
  tiles[4][3] = TerrainType.CRYSTAL;
  tiles[4][4] = TerrainType.CRYSTAL;

  tiles[9][4] = TerrainType.CRYSTAL;

  tiles[3][9] = TerrainType.CRYSTAL;
  tiles[4][9] = TerrainType.CRYSTAL;

  tiles[9][9] = TerrainType.CRYSTAL;
  tiles[9][10] = TerrainType.CRYSTAL;

  // Centre obstructions encourage tower maze building around them
  tiles[6][6] = TerrainType.CRYSTAL;
  tiles[7][6] = TerrainType.CRYSTAL;
  tiles[6][7] = TerrainType.CRYSTAL;
  tiles[7][7] = TerrainType.CRYSTAL;

  // Moss accents for visual variety (spread across field)
  tiles[2][3] = TerrainType.MOSS;
  tiles[5][5] = TerrainType.MOSS;
  tiles[8][3] = TerrainType.MOSS;
  tiles[11][5] = TerrainType.MOSS;
  tiles[2][10] = TerrainType.MOSS;
  tiles[5][11] = TerrainType.MOSS;
  tiles[8][10] = TerrainType.MOSS;
  tiles[11][9] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 0, z: 7 }];
  state.exitPoints = [{ x: 13, z: 6 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 7 — "The Narrows"  (14×14, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Long snaking narrow corridor through Crystal walls. Teaches splash and slow
 * tower value at bottlenecks.
 *
 * Path layout (2 tiles wide throughout, creating tight chokepoints):
 *
 *   Leg 1 (top, left→right):    z=1-2, x=0-11
 *   Turn 1 (right side, down):  x=11-12, z=2-4
 *   Leg 2 (upper-mid, right→left): z=4-5, x=3-12
 *   Turn 2 (left side, down):   x=3-4, z=5-8
 *   Leg 3 (lower-mid, left→right): z=8-9, x=3-12
 *   Turn 3 (right side, down):  x=11-12, z=9-11
 *   Leg 4 (bottom, right→left): z=11-12, x=1-12
 *   Exit connector (left side, down): x=1-2, z=12-13
 *
 *   Crystal fills all remaining space (non-path tiles)
 *   Moss accents at each chokepoint turn
 *
 *   Spawner: (0,1)   Exit: (1,13)
 */
export function buildTheNarrows(): TerrainGridState {
  const GRID_SIZE = 14;

  // Start with Crystal everywhere (walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // Leg 1 (top): z=1-2, x=0-11
  paintRect(tiles, 0, 1, 11, 2, TerrainType.BEDROCK);

  // Turn 1 (right side, down): x=11-12, z=2-4
  paintRect(tiles, 11, 2, 12, 4, TerrainType.BEDROCK);

  // Leg 2 (upper-middle, right→left): z=4-5, x=3-12
  paintRect(tiles, 3, 4, 12, 5, TerrainType.BEDROCK);

  // Turn 2 (left pocket, down): x=3-4, z=5-8
  paintRect(tiles, 3, 5, 4, 8, TerrainType.BEDROCK);

  // Leg 3 (lower-middle, left→right): z=8-9, x=3-12
  paintRect(tiles, 3, 8, 12, 9, TerrainType.BEDROCK);

  // Turn 3 (right pocket, down): x=11-12, z=9-11
  paintRect(tiles, 11, 9, 12, 11, TerrainType.BEDROCK);

  // Leg 4 (bottom, right→left): z=11-12, x=1-12
  paintRect(tiles, 1, 11, 12, 12, TerrainType.BEDROCK);

  // Exit connector (left side, down to exit row): x=1-2, z=12-13
  paintRect(tiles, 1, 12, 2, 13, TerrainType.BEDROCK);

  // Moss accents at chokepoint turns
  tiles[11][2] = TerrainType.MOSS;
  tiles[12][4] = TerrainType.MOSS;
  tiles[3][5] = TerrainType.MOSS;
  tiles[4][8] = TerrainType.MOSS;
  tiles[11][9] = TerrainType.MOSS;
  tiles[12][11] = TerrainType.MOSS;
  tiles[1][12] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 0, z: 1 }];
  state.exitPoints = [{ x: 1, z: 13 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 8 — "Crystal Maze"  (14×14, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Pre-built maze with multiple valid routes. Enemies take shortest path —
 * strategic tower placement can redirect them to longer routes.
 *
 * Three routes from spawner (0,1) to exit (13,12):
 *   Short route:  top corridor → right side → bottom
 *   Medium route: middle corridor with one extra bend
 *   Long route:   bottom corridor all the way around
 *
 * Layout — open corridors carved through Crystal fill:
 *
 *   Top corridor:      z=1-2, x=0-12
 *   Right drop A:      x=12-13, z=2-5
 *   Mid corridor top:  z=5-6, x=4-13
 *   Left drop:         x=4-5, z=6-9
 *   Mid corridor bot:  z=9-10, x=4-13
 *   Right drop B:      x=12-13, z=10-12
 *   Exit corridor:     z=12-13, x=0-13
 *
 *   Cross-link A (connects top to mid via left): x=1-2, z=2-5
 *   Cross-link B (connects mid corridors):       x=7-8, z=6-9
 *
 *   Moss patches at path intersections
 *
 *   Spawner: (0,1)   Exit: (13,12)
 */
export function buildCrystalMaze(): TerrainGridState {
  const GRID_SIZE = 14;

  // Start with Crystal everywhere (maze walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // --- Main corridors ---

  // Top corridor: z=1-2, x=0-12
  paintRect(tiles, 0, 1, 12, 2, TerrainType.BEDROCK);

  // Right drop A: x=12-13, z=2-5
  paintRect(tiles, 12, 2, 13, 5, TerrainType.BEDROCK);

  // Mid corridor (upper): z=5-6, x=4-13
  paintRect(tiles, 4, 5, 13, 6, TerrainType.BEDROCK);

  // Left drop: x=4-5, z=6-9
  paintRect(tiles, 4, 6, 5, 9, TerrainType.BEDROCK);

  // Mid corridor (lower): z=9-10, x=4-13
  paintRect(tiles, 4, 9, 13, 10, TerrainType.BEDROCK);

  // Right drop B: x=12-13, z=10-12
  paintRect(tiles, 12, 10, 13, 12, TerrainType.BEDROCK);

  // Exit corridor: z=12-13, x=0-13
  paintRect(tiles, 0, 12, 13, 13, TerrainType.BEDROCK);

  // --- Cross-links (alternative routes) ---

  // Cross-link A: left-side vertical connecting top corridor to mid corridor
  // x=1-2, z=2-5 — creates a second path that bypasses the right drop A
  paintRect(tiles, 1, 2, 2, 5, TerrainType.BEDROCK);

  // Horizontal connector for cross-link A into mid corridor top:
  // z=5-6, x=1-4 — joins cross-link A with mid corridor at x=4
  paintRect(tiles, 1, 5, 4, 6, TerrainType.BEDROCK);

  // Cross-link B: centre vertical connecting the two mid corridors
  // x=7-8, z=6-9 — alternative path between mid corridors
  paintRect(tiles, 7, 6, 8, 9, TerrainType.BEDROCK);

  // --- Moss at intersections ---
  // Where cross-link A meets top corridor
  tiles[1][2] = TerrainType.MOSS;
  tiles[2][2] = TerrainType.MOSS;
  // Where cross-link A meets mid corridor (upper)
  tiles[1][5] = TerrainType.MOSS;
  tiles[2][5] = TerrainType.MOSS;
  // Where cross-link B meets mid corridors
  tiles[7][6] = TerrainType.MOSS;
  tiles[8][9] = TerrainType.MOSS;
  // Where right drop B meets exit corridor
  tiles[12][12] = TerrainType.MOSS;
  tiles[13][12] = TerrainType.MOSS;

  state.spawnPoints = [{ x: 0, z: 1 }];
  state.exitPoints = [{ x: 13, z: 12 }];

  return state;
}
