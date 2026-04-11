import { TerrainGridState } from '../../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';
import { createEmptyGrid, paintRect } from './map-helpers';

// ---------------------------------------------------------------------------
// Map 13 — "Fortress"  (18×18, 4 spawners, 1 exit)
// ---------------------------------------------------------------------------

/**
 * Defend a central stronghold from four directions. A plus-sign (+) layout
 * of corridors converges on the central moss fortress area.
 *
 * Layout (column-major, x=column 0-17, z=row 0-17):
 *   Background fill: CRYSTAL (walls everywhere by default)
 *
 *   Central fortress area: MOSS, x=7-10, z=7-10 — open zone around the exit
 *   Horizontal corridor (West→East): BEDROCK, x=0-17, z=8-9
 *   Vertical corridor (North→South): BEDROCK, x=8-9, z=0-17
 *
 *   Build pockets in the four quadrants between the corridor arms:
 *     NW pocket: BEDROCK, x=2-6, z=2-6
 *     NE pocket: BEDROCK, x=11-15, z=2-6
 *     SW pocket: BEDROCK, x=2-6, z=11-15
 *     SE pocket: BEDROCK, x=11-15, z=11-15
 *
 *   Abyss at the outermost corners: (0-1,0-1), (16-17,0-1), (0-1,16-17), (16-17,16-17)
 *
 *   Moss accents at corridor-junction entry points
 *
 *   Spawner North: (9, 0)
 *   Spawner East:  (17, 9)
 *   Spawner South: (9, 17)
 *   Spawner West:  (0, 9)
 *   Exit: (9, 9)
 */
export function buildFortress(): TerrainGridState {
  const GRID_SIZE = 18;

  // Start with Crystal everywhere (walls)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // Horizontal corridor (West→East): z=8-9, x=0-17
  paintRect(tiles, 0, 8, GRID_SIZE - 1, 9, TerrainType.BEDROCK);

  // Vertical corridor (North→South): x=8-9, z=0-17
  paintRect(tiles, 8, 0, 9, GRID_SIZE - 1, TerrainType.BEDROCK);

  // Central fortress area (Moss): x=7-10, z=7-10 — surrounds exit (9,9)
  paintRect(tiles, 7, 7, 10, 10, TerrainType.MOSS);

  // Build pockets in each quadrant (open bedrock for tower placement)
  // NW pocket: x=2-6, z=2-6
  paintRect(tiles, 2, 2, 6, 6, TerrainType.BEDROCK);
  // NE pocket: x=11-15, z=2-6
  paintRect(tiles, 11, 2, 15, 6, TerrainType.BEDROCK);
  // SW pocket: x=2-6, z=11-15
  paintRect(tiles, 2, 11, 6, 15, TerrainType.BEDROCK);
  // SE pocket: x=11-15, z=11-15
  paintRect(tiles, 11, 11, 15, 15, TerrainType.BEDROCK);

  // Abyss far corners (decorative depth)
  paintRect(tiles, 0, 0, 1, 1, TerrainType.ABYSS);
  paintRect(tiles, 16, 0, 17, 1, TerrainType.ABYSS);
  paintRect(tiles, 0, 16, 1, 17, TerrainType.ABYSS);
  paintRect(tiles, 16, 16, 17, 17, TerrainType.ABYSS);

  // Moss accents at corridor junctions entering the fortress
  tiles[8][6] = TerrainType.MOSS;
  tiles[9][6] = TerrainType.MOSS;
  tiles[8][11] = TerrainType.MOSS;
  tiles[9][11] = TerrainType.MOSS;
  tiles[6][8] = TerrainType.MOSS;
  tiles[6][9] = TerrainType.MOSS;
  tiles[11][8] = TerrainType.MOSS;
  tiles[11][9] = TerrainType.MOSS;

  state.spawnPoints = [
    { x: 9, z: 0 },   // North
    { x: 17, z: 9 },  // East
    { x: 9, z: 17 },  // South
    { x: 0, z: 9 },   // West
  ];
  state.exitPoints = [{ x: 9, z: 9 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 14 — "The Gauntlet"  (18×18, 1 spawner, 1 exit)
// ---------------------------------------------------------------------------

/**
 * An extremely long snaking path that covers nearly the entire 18×18 grid.
 * Enemies wind back and forth — every tower placement must count.
 * Corridors are 2 tiles wide with a few wider pockets for tower placement.
 *
 * Path layout (start Crystal-filled, carve corridors):
 *   Leg 1 (top, left→right):        z=1-2,  x=0-15
 *   Turn 1 (right side, down):       x=15-16, z=2-4
 *   Leg 2 (upper, right→left):       z=4-5,  x=2-16
 *   Turn 2 (left side, down):        x=2-3,  z=5-7
 *   Leg 3 (mid-upper, left→right):   z=7-8,  x=2-15
 *   Turn 3 (right side, down):       x=15-16, z=8-10
 *   Leg 4 (middle, right→left):      z=10-11, x=2-16
 *   Turn 4 (left side, down):        x=2-3,  z=11-13
 *   Leg 5 (mid-lower, left→right):   z=13-14, x=2-15
 *   Turn 5 (right side, down):       x=15-16, z=14-16
 *   Leg 6 (bottom, right→left):      z=16-17, x=1-16
 *   Exit connector (right side):      x=17,   z=16-17  (exit at (17,16))
 *
 *   Wider moss pockets (3×3) at selected turn points to allow tower placement.
 *   Spawner: (0,1)   Exit: (17,16)
 */
export function buildTheGauntlet(): TerrainGridState {
  const GRID_SIZE = 18;

  // Start with Crystal everywhere (tight maze)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // Leg 1 (top, left→right): z=1-2, x=0-15
  paintRect(tiles, 0, 1, 15, 2, TerrainType.BEDROCK);

  // Turn 1 (right, down): x=15-16, z=2-4
  paintRect(tiles, 15, 2, 16, 4, TerrainType.BEDROCK);

  // Leg 2 (upper, right→left): z=4-5, x=2-16
  paintRect(tiles, 2, 4, 16, 5, TerrainType.BEDROCK);

  // Turn 2 (left, down): x=2-3, z=5-7
  paintRect(tiles, 2, 5, 3, 7, TerrainType.BEDROCK);

  // Leg 3 (mid-upper, left→right): z=7-8, x=2-15
  paintRect(tiles, 2, 7, 15, 8, TerrainType.BEDROCK);

  // Turn 3 (right, down): x=15-16, z=8-10
  paintRect(tiles, 15, 8, 16, 10, TerrainType.BEDROCK);

  // Leg 4 (middle, right→left): z=10-11, x=2-16
  paintRect(tiles, 2, 10, 16, 11, TerrainType.BEDROCK);

  // Turn 4 (left, down): x=2-3, z=11-13
  paintRect(tiles, 2, 11, 3, 13, TerrainType.BEDROCK);

  // Leg 5 (mid-lower, left→right): z=13-14, x=2-15
  paintRect(tiles, 2, 13, 15, 14, TerrainType.BEDROCK);

  // Turn 5 (right, down): x=15-16, z=14-16
  paintRect(tiles, 15, 14, 16, 16, TerrainType.BEDROCK);

  // Leg 6 (bottom, right→left): z=16-17, x=1-16
  paintRect(tiles, 1, 16, 16, 17, TerrainType.BEDROCK);

  // Exit connector to right edge: x=17, z=16-17
  paintRect(tiles, 17, 16, 17, 17, TerrainType.BEDROCK);

  // Moss pockets at each turn — provide tower build spots and visual markers
  // Pocket at Turn 1 entrance
  paintRect(tiles, 14, 1, 16, 3, TerrainType.MOSS);
  // Pocket at Turn 2 entrance
  paintRect(tiles, 2, 4, 4, 6, TerrainType.MOSS);
  // Pocket at Turn 3 entrance
  paintRect(tiles, 14, 7, 16, 9, TerrainType.MOSS);
  // Pocket at Turn 4 entrance
  paintRect(tiles, 2, 10, 4, 12, TerrainType.MOSS);
  // Pocket at Turn 5 entrance
  paintRect(tiles, 14, 13, 16, 15, TerrainType.MOSS);
  // Pocket at exit end
  paintRect(tiles, 15, 16, 17, 17, TerrainType.MOSS);

  // Restore key bedrock tiles that moss may have overwritten (path connectivity)
  // Ensure Leg 1 entry and Turn 1 start are walkable
  tiles[0][1] = TerrainType.BEDROCK;  // spawner tile
  tiles[15][2] = TerrainType.BEDROCK; // turn corner
  tiles[16][4] = TerrainType.BEDROCK; // leg 2 entry
  tiles[2][5] = TerrainType.BEDROCK;  // turn 2 start
  tiles[3][7] = TerrainType.BEDROCK;  // turn 2 end
  tiles[15][8] = TerrainType.BEDROCK; // turn 3 start
  tiles[16][10] = TerrainType.BEDROCK; // leg 4 entry
  tiles[2][11] = TerrainType.BEDROCK; // turn 4 start
  tiles[3][13] = TerrainType.BEDROCK; // turn 4 end
  tiles[15][14] = TerrainType.BEDROCK; // turn 5 start
  tiles[16][16] = TerrainType.BEDROCK; // leg 6 entry
  tiles[17][16] = TerrainType.BEDROCK; // exit tile

  state.spawnPoints = [{ x: 0, z: 1 }];
  state.exitPoints = [{ x: 17, z: 16 }];

  return state;
}

// ---------------------------------------------------------------------------
// Map 15 — "Storm"  (20×20, 4 spawners, 2 exits)
// ---------------------------------------------------------------------------

/**
 * Maximum chaos. Four spawners on the left and right edges converge on two
 * adjacent central exits. All paths funnel through a central corridor hub.
 *
 * Layout (column-major, x=column 0-19, z=row 0-19):
 *   Background fill: ABYSS (dark, hostile)
 *
 *   Abyss perimeter border: x=0,19 columns + z=0,19 rows
 *   Crystal inner walls channel the corridors.
 *
 *   Four approach corridors:
 *     Upper-left:  BEDROCK, x=0-9,   z=3-4  (horizontal from west)
 *     Lower-left:  BEDROCK, x=0-9,   z=15-16 (horizontal from west)
 *     Upper-right: BEDROCK, x=10-19, z=3-4  (horizontal from east)
 *     Lower-right: BEDROCK, x=10-19, z=15-16 (horizontal from east)
 *
 *   Central vertical spine: BEDROCK, x=9-10, z=3-16
 *     Connects all four horizontal corridors vertically
 *     Both exits (9,10) and (10,10) are within this spine
 *
 *   Crystal channeling walls (non-buildable, force enemies through corridors):
 *     Upper-left crystal wall:  x=1-8,   z=5-9   (between upper-left corridor and spine)
 *     Upper-right crystal wall: x=11-18, z=5-9
 *     Lower-left crystal wall:  x=1-8,   z=11-14 (between spine and lower-left corridor)
 *     Lower-right crystal wall: x=11-18, z=11-14
 *
 *   Actual tower build areas (Bedrock strips flanking the spine):
 *     Left flank:  x=7-8,  z=5-14
 *     Right flank: x=11-12, z=5-14
 *
 *   Moss merge-point accents where corridors hit the spine
 *
 *   Spawner 1 (upper-left):  (0, 3)
 *   Spawner 2 (lower-left):  (0, 16)
 *   Spawner 3 (upper-right): (19, 3)
 *   Spawner 4 (lower-right): (19, 16)
 *   Exit 1: (9, 10)
 *   Exit 2: (10, 10)
 */
export function buildStorm(): TerrainGridState {
  const GRID_SIZE = 20;

  // Start with Abyss (hostile terrain)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.ABYSS);
  const { tiles } = state;

  // Upper-left horizontal corridor: x=0-9, z=3-4
  paintRect(tiles, 0, 3, 9, 4, TerrainType.BEDROCK);

  // Lower-left horizontal corridor: x=0-9, z=15-16
  paintRect(tiles, 0, 15, 9, 16, TerrainType.BEDROCK);

  // Upper-right horizontal corridor: x=10-19, z=3-4
  paintRect(tiles, 10, 3, 19, 4, TerrainType.BEDROCK);

  // Lower-right horizontal corridor: x=10-19, z=15-16
  paintRect(tiles, 10, 15, 19, 16, TerrainType.BEDROCK);

  // Central vertical spine: x=9-10, z=3-16
  // This connects all four corridors and contains both exits
  paintRect(tiles, 9, 3, 10, 16, TerrainType.BEDROCK);

  // Crystal channeling walls — force enemies through corridors (Crystal is non-buildable)
  // Upper-left crystal wall zone: x=1-8, z=5-9
  paintRect(tiles, 1, 5, 8, 9, TerrainType.CRYSTAL);

  // Upper-right crystal wall zone: x=11-18, z=5-9
  paintRect(tiles, 11, 5, 18, 9, TerrainType.CRYSTAL);

  // Lower-left crystal wall zone: x=1-8, z=11-14
  paintRect(tiles, 1, 11, 8, 14, TerrainType.CRYSTAL);

  // Lower-right crystal wall zone: x=11-18, z=11-14
  paintRect(tiles, 11, 11, 18, 14, TerrainType.CRYSTAL);

  // Bedrock build strips flanking the spine (tower placement near exits)
  // Left flank build strip: x=7-8, z=5-14
  paintRect(tiles, 7, 5, 8, 14, TerrainType.BEDROCK);
  // Right flank build strip: x=11-12, z=5-14
  paintRect(tiles, 11, 5, 12, 14, TerrainType.BEDROCK);

  // Moss accents at corridor merge points (where horizontals meet spine)
  // Upper merge points
  tiles[9][3] = TerrainType.MOSS;
  tiles[10][3] = TerrainType.MOSS;
  tiles[9][4] = TerrainType.MOSS;
  tiles[10][4] = TerrainType.MOSS;
  // Lower merge points
  tiles[9][15] = TerrainType.MOSS;
  tiles[10][15] = TerrainType.MOSS;
  tiles[9][16] = TerrainType.MOSS;
  tiles[10][16] = TerrainType.MOSS;
  // Exit area accents
  tiles[8][10] = TerrainType.MOSS;
  tiles[11][10] = TerrainType.MOSS;

  // Ensure spawner and exit tiles are walkable (not accidentally overwritten)
  tiles[0][3] = TerrainType.BEDROCK;
  tiles[0][16] = TerrainType.BEDROCK;
  tiles[19][3] = TerrainType.BEDROCK;
  tiles[19][16] = TerrainType.BEDROCK;
  tiles[9][10] = TerrainType.BEDROCK;
  tiles[10][10] = TerrainType.BEDROCK;

  state.spawnPoints = [
    { x: 0, z: 3 },   // upper-left
    { x: 0, z: 16 },  // lower-left
    { x: 19, z: 3 },  // upper-right
    { x: 19, z: 16 }, // lower-right
  ];
  state.exitPoints = [
    { x: 9, z: 10 },
    { x: 10, z: 10 },
  ];

  return state;
}

// ---------------------------------------------------------------------------
// Map 16 — "Novarise"  (20×20, 4 spawners, 4 exits)
// ---------------------------------------------------------------------------

/**
 * The grand finale. Corner spawners converge on a central diamond of four exits.
 * All 16 spawner→exit path combinations must be BFS-valid.
 *
 * Layout (column-major, x=column 0-19, z=row 0-19):
 *   Background fill: CRYSTAL (maze walls)
 *
 *   Central diamond exits at: (9,7), (12,10), (9,13), (6,10)
 *   All exits are MOSS tiles (strategic positions).
 *
 *   Central hub: BEDROCK, x=6-13, z=7-13 — open area around all four exits
 *   The hub is the convergence point for all corridors.
 *
 *   Corner approach corridors (BEDROCK, 2 tiles wide):
 *     NW corner (0,0) → hub:
 *       Horizontal: x=0-6,  z=0-1
 *       Vertical:   x=0-1,  z=0-7
 *       Diagonal-ish: x=1-6, z=1-7 connecting to hub
 *     NE corner (19,0) → hub:
 *       Horizontal: x=13-19, z=0-1
 *       Vertical:   x=18-19, z=0-7
 *       Connecting arm: x=13-18, z=1-7
 *     SW corner (0,19) → hub:
 *       Horizontal: x=0-6,  z=18-19
 *       Vertical:   x=0-1,  z=13-19
 *       Connecting arm: x=1-6, z=13-18
 *     SE corner (19,19) → hub:
 *       Horizontal: x=13-19, z=18-19
 *       Vertical:   x=18-19, z=13-19
 *       Connecting arm: x=13-18, z=13-18
 *
 *   Cross-connections ensuring all exits are reachable from all spawners:
 *     Horizontal connector: x=6-13, z=10 (links left/right through exits)
 *     Vertical connector:   x=9,    z=7-13 (links top/bottom through exits)
 *     Additional: x=12, z=7-13
 *
 *   Abyss patches in mid-sections for visual variety
 *   Moss clusters at key strategic chokepoints
 *
 *   Spawner NW: (0, 0)
 *   Spawner NE: (19, 0)
 *   Spawner SW: (0, 19)
 *   Spawner SE: (19, 19)
 *   Exit North: (9, 7)
 *   Exit East:  (12, 10)
 *   Exit South: (9, 13)
 *   Exit West:  (6, 10)
 */
export function buildNovarise(): TerrainGridState {
  const GRID_SIZE = 20;

  // Start with Crystal everywhere (dense maze)
  const state = createEmptyGrid(GRID_SIZE, TerrainType.CRYSTAL);
  const { tiles } = state;

  // ── Central hub: open area, x=6-13, z=7-13 ──────────────────────────────
  paintRect(tiles, 6, 7, 13, 13, TerrainType.BEDROCK);

  // ── NW corner (0,0) approach ─────────────────────────────────────────────
  // Diagonal corridor: staircase of 2-wide bedrock segments NW→hub
  // Horizontal top leg: x=0-8, z=0-1
  paintRect(tiles, 0, 0, 8, 1, TerrainType.BEDROCK);
  // Vertical left leg: x=0-1, z=0-8
  paintRect(tiles, 0, 0, 1, 8, TerrainType.BEDROCK);
  // Diagonal bridge step A: x=2-5, z=2-5
  paintRect(tiles, 2, 2, 5, 5, TerrainType.BEDROCK);
  // Connecting horizontal to hub: x=4-6, z=6-7
  paintRect(tiles, 4, 6, 6, 7, TerrainType.BEDROCK);
  // Connecting vertical to hub: x=0-1, z=7-10
  paintRect(tiles, 0, 7, 1, 10, TerrainType.BEDROCK);
  // Bridge from left leg to hub: x=1-6, z=9-10
  paintRect(tiles, 1, 9, 6, 10, TerrainType.BEDROCK);

  // ── NE corner (19,0) approach ────────────────────────────────────────────
  // Horizontal top leg: x=11-19, z=0-1
  paintRect(tiles, 11, 0, 19, 1, TerrainType.BEDROCK);
  // Vertical right leg: x=18-19, z=0-8
  paintRect(tiles, 18, 0, 19, 8, TerrainType.BEDROCK);
  // Diagonal bridge step: x=14-17, z=2-5
  paintRect(tiles, 14, 2, 17, 5, TerrainType.BEDROCK);
  // Connecting horizontal to hub: x=13-15, z=6-7
  paintRect(tiles, 13, 6, 15, 7, TerrainType.BEDROCK);
  // Connecting vertical to hub: x=18-19, z=7-10
  paintRect(tiles, 18, 7, 19, 10, TerrainType.BEDROCK);
  // Bridge from right leg to hub: x=13-18, z=9-10
  paintRect(tiles, 13, 9, 18, 10, TerrainType.BEDROCK);

  // ── SW corner (0,19) approach ────────────────────────────────────────────
  // Horizontal bottom leg: x=0-8, z=18-19
  paintRect(tiles, 0, 18, 8, 19, TerrainType.BEDROCK);
  // Vertical left leg: x=0-1, z=11-19
  paintRect(tiles, 0, 11, 1, 19, TerrainType.BEDROCK);
  // Diagonal bridge step: x=2-5, z=14-17
  paintRect(tiles, 2, 14, 5, 17, TerrainType.BEDROCK);
  // Connecting horizontal to hub: x=4-6, z=13-14
  paintRect(tiles, 4, 13, 6, 14, TerrainType.BEDROCK);
  // Connecting vertical to hub: x=0-1, z=9-13
  paintRect(tiles, 0, 9, 1, 13, TerrainType.BEDROCK);
  // Bridge from left leg to hub: x=1-6, z=9-10
  // (already painted above — shared with NW approach)

  // ── SE corner (19,19) approach ───────────────────────────────────────────
  // Horizontal bottom leg: x=11-19, z=18-19
  paintRect(tiles, 11, 18, 19, 19, TerrainType.BEDROCK);
  // Vertical right leg: x=18-19, z=11-19
  paintRect(tiles, 18, 11, 19, 19, TerrainType.BEDROCK);
  // Diagonal bridge step: x=14-17, z=14-17
  paintRect(tiles, 14, 14, 17, 17, TerrainType.BEDROCK);
  // Connecting horizontal to hub: x=13-15, z=13-14
  paintRect(tiles, 13, 13, 15, 14, TerrainType.BEDROCK);
  // Connecting vertical to hub: x=18-19, z=9-13
  paintRect(tiles, 18, 9, 19, 13, TerrainType.BEDROCK);
  // Bridge from right leg to hub: x=13-18, z=9-10
  // (already painted above — shared with NE approach)

  // ── Abyss decorative patches (mid-field atmosphere) ──────────────────────
  // NW mid-field
  paintRect(tiles, 3, 3, 4, 4, TerrainType.ABYSS);
  // NE mid-field
  paintRect(tiles, 15, 3, 16, 4, TerrainType.ABYSS);
  // SW mid-field
  paintRect(tiles, 3, 15, 4, 16, TerrainType.ABYSS);
  // SE mid-field
  paintRect(tiles, 15, 15, 16, 16, TerrainType.ABYSS);

  // ── Moss at key strategic chokepoints and exit tiles ─────────────────────
  // Exit positions (restored to BEDROCK, then marked as exits below)
  // Chokepoint entries to hub
  tiles[5][7] = TerrainType.MOSS;
  tiles[5][8] = TerrainType.MOSS;
  tiles[14][7] = TerrainType.MOSS;
  tiles[14][8] = TerrainType.MOSS;
  tiles[5][12] = TerrainType.MOSS;
  tiles[5][13] = TerrainType.MOSS;
  tiles[14][12] = TerrainType.MOSS;
  tiles[14][13] = TerrainType.MOSS;
  // Inside hub near exits
  tiles[7][8] = TerrainType.MOSS;
  tiles[11][8] = TerrainType.MOSS;
  tiles[7][12] = TerrainType.MOSS;
  tiles[11][12] = TerrainType.MOSS;

  // ── Ensure all spawner tiles are walkable ─────────────────────────────────
  tiles[0][0] = TerrainType.BEDROCK;
  tiles[19][0] = TerrainType.BEDROCK;
  tiles[0][19] = TerrainType.BEDROCK;
  tiles[19][19] = TerrainType.BEDROCK;

  // ── Ensure all exit tiles are walkable ────────────────────────────────────
  tiles[9][7] = TerrainType.BEDROCK;
  tiles[12][10] = TerrainType.BEDROCK;
  tiles[9][13] = TerrainType.BEDROCK;
  tiles[6][10] = TerrainType.BEDROCK;

  state.spawnPoints = [
    { x: 0, z: 0 },   // NW corner
    { x: 19, z: 0 },  // NE corner
    { x: 0, z: 19 },  // SW corner
    { x: 19, z: 19 }, // SE corner
  ];
  state.exitPoints = [
    { x: 9, z: 7 },   // North exit
    { x: 12, z: 10 }, // East exit
    { x: 9, z: 13 },  // South exit
    { x: 6, z: 10 },  // West exit
  ];

  return state;
}
