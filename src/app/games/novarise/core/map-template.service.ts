import { Injectable } from '@angular/core';
import { TerrainType } from '../models/terrain-types.enum';
import { TerrainGridState } from '../features/terrain-editor/terrain-grid-state.interface';
import { MapTemplate } from './map-template.model';

const TEMPLATE_GRID_SIZE = 25;
const TEMPLATE_VERSION = '1.0.0';

/** Fill an entire grid with a single terrain type and zero height. */
function createEmptyGrid(width: number, height: number, fill: TerrainType = TerrainType.ABYSS): TerrainGridState {
  const tiles: TerrainType[][] = [];
  const heightMap: number[][] = [];

  for (let x = 0; x < width; x++) {
    tiles[x] = [];
    heightMap[x] = [];
    for (let z = 0; z < height; z++) {
      tiles[x][z] = fill;
      heightMap[x][z] = 0;
    }
  }

  return {
    gridSize: width,
    tiles,
    heightMap,
    spawnPoints: [],
    exitPoints: [],
    version: TEMPLATE_VERSION
  };
}

/** Paint a horizontal corridor at fixed z from x0 to x1 (inclusive). */
function paintHorizontalPath(
  tiles: TerrainType[][],
  z: number,
  x0: number,
  x1: number,
  type: TerrainType = TerrainType.BEDROCK
): void {
  for (let x = x0; x <= x1; x++) {
    tiles[x][z] = type;
  }
}

/** Paint a vertical corridor at fixed x from z0 to z1 (inclusive). */
function paintVerticalPath(
  tiles: TerrainType[][],
  x: number,
  z0: number,
  z1: number,
  type: TerrainType = TerrainType.BEDROCK
): void {
  const lo = Math.min(z0, z1);
  const hi = Math.max(z0, z1);
  for (let z = lo; z <= hi; z++) {
    tiles[x][z] = type;
  }
}

// ---------------------------------------------------------------------------
// Template builders
// ---------------------------------------------------------------------------

/**
 * Classic — straight horizontal path at mid-row, open buildable flanks.
 * Path: left edge (x=0) → right edge (x=24) at z=12.
 */
function buildClassicTemplate(): TerrainGridState {
  const state = createEmptyGrid(TEMPLATE_GRID_SIZE, TEMPLATE_GRID_SIZE);
  const midZ = Math.floor(TEMPLATE_GRID_SIZE / 2); // 12

  paintHorizontalPath(state.tiles, midZ, 0, TEMPLATE_GRID_SIZE - 1);

  state.spawnPoints = [{ x: 0, z: midZ }];
  state.exitPoints = [{ x: TEMPLATE_GRID_SIZE - 1, z: midZ }];

  return state;
}

/**
 * Maze — S-shaped path that zigzags vertically across the map.
 * Three horizontal legs connected by vertical transitions.
 *
 * Leg 1 (z=4):  x 0..17 → turn down to z=12
 * Leg 2 (z=12): x 7..24 (reversed) → turn down to z=20
 * Leg 3 (z=20): x 0..24
 */
function buildMazeTemplate(): TerrainGridState {
  const state = createEmptyGrid(TEMPLATE_GRID_SIZE, TEMPLATE_GRID_SIZE);
  const tiles = state.tiles;

  // Leg 1: horizontal, z=4, x=0..17
  paintHorizontalPath(tiles, 4, 0, 17);
  // Turn: vertical, x=17, z=4..12
  paintVerticalPath(tiles, 17, 4, 12);
  // Leg 2: horizontal, z=12, x=7..17
  paintHorizontalPath(tiles, 12, 7, 17);
  // Turn: vertical, x=7, z=12..20
  paintVerticalPath(tiles, 7, 12, 20);
  // Leg 3: horizontal, z=20, x=7..24
  paintHorizontalPath(tiles, 20, 7, 24);

  state.spawnPoints = [{ x: 0, z: 4 }];
  state.exitPoints = [{ x: 24, z: 20 }];

  return state;
}

/**
 * Spiral — path spirals inward from the top edge toward the center,
 * then exits via a short straight to the right edge.
 *
 * Outer ring segments (clockwise inward spiral, 2-cell bands):
 *   Top:    z=0, x=0..24
 *   Right:  x=24, z=0..24
 *   Bottom: z=24, x=2..24
 *   Left:   x=2, z=2..24
 *   Inner top: z=2, x=2..22
 *   Inner right: x=22, z=2..22
 *   Inner bottom: z=22, x=4..22
 *   Inner left: x=4, z=4..22
 *   Centre exit: z=12, x=12..24
 */
function buildSpiralTemplate(): TerrainGridState {
  const state = createEmptyGrid(TEMPLATE_GRID_SIZE, TEMPLATE_GRID_SIZE);
  const tiles = state.tiles;

  // Outer ring
  paintHorizontalPath(tiles, 0, 0, 24);    // top edge
  paintVerticalPath(tiles, 24, 0, 24);     // right edge
  paintHorizontalPath(tiles, 24, 2, 24);   // bottom edge (leave x=0..1 out — already covered)
  paintVerticalPath(tiles, 2, 2, 24);      // left inner

  // Second ring
  paintHorizontalPath(tiles, 2, 2, 22);    // top inner
  paintVerticalPath(tiles, 22, 2, 22);     // right inner
  paintHorizontalPath(tiles, 22, 4, 22);   // bottom inner
  paintVerticalPath(tiles, 4, 4, 22);      // left inner-inner

  // Third ring
  paintHorizontalPath(tiles, 4, 4, 20);
  paintVerticalPath(tiles, 20, 4, 20);
  paintHorizontalPath(tiles, 20, 6, 20);
  paintVerticalPath(tiles, 6, 6, 20);

  // Centre exit arm — path from core to right edge
  paintHorizontalPath(tiles, 12, 6, 24);

  state.spawnPoints = [{ x: 0, z: 0 }];
  state.exitPoints = [{ x: 24, z: 12 }];

  return state;
}

/**
 * Open Field — minimal structure; just spawner and exit on opposite edges,
 * all BEDROCK so the player can define their own path layout.
 */
function buildOpenFieldTemplate(): TerrainGridState {
  const state = createEmptyGrid(TEMPLATE_GRID_SIZE, TEMPLATE_GRID_SIZE, TerrainType.BEDROCK);
  const midZ = Math.floor(TEMPLATE_GRID_SIZE / 2);

  state.spawnPoints = [{ x: 0, z: midZ }];
  state.exitPoints = [{ x: TEMPLATE_GRID_SIZE - 1, z: midZ }];

  return state;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const TEMPLATES: MapTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Straight horizontal path from left to right through the center. Open buildable areas above and below.'
  },
  {
    id: 'maze',
    name: 'Maze',
    description: 'Winding S-shaped path that zigzags vertically across the map through narrow corridors.'
  },
  {
    id: 'spiral',
    name: 'Spiral',
    description: 'Path spirals inward from the top-left edge toward the center, then exits to the right.'
  },
  {
    id: 'open-field',
    name: 'Open Field',
    description: 'Spawner on the left edge, exit on the right edge, all open terrain — you define the maze.'
  }
];

@Injectable({ providedIn: 'root' })
export class MapTemplateService {
  /** Return the list of available map templates. */
  getTemplates(): MapTemplate[] {
    return [...TEMPLATES];
  }

  /** Generate and return the full grid state for a given template ID, or null if unknown. */
  loadTemplate(id: string): TerrainGridState | null {
    switch (id) {
      case 'classic':
        return buildClassicTemplate();
      case 'maze':
        return buildMazeTemplate();
      case 'spiral':
        return buildSpiralTemplate();
      case 'open-field':
        return buildOpenFieldTemplate();
      default:
        return null;
    }
  }
}
