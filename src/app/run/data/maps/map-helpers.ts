import { TerrainGridState } from '../../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../../games/novarise/models/terrain-types.enum';

/** Schema version for all hand-crafted campaign maps. */
export const MAP_VERSION = '2.0.0';

/**
 * Allocates a gridSize×gridSize grid filled with the given terrain type,
 * plus an all-zero heightMap. spawnPoints and exitPoints are left empty
 * for the caller to populate.
 */
export function createEmptyGrid(size: number, fill: TerrainType): TerrainGridState {
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
export function paintRow(
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
export function paintColumn(
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
export function paintRect(
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
