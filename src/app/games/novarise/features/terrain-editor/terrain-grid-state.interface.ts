import { TerrainType } from '../../models/terrain-types.enum';

/**
 * Serializable state of a TerrainGrid, produced by exportState() and consumed by importState().
 * Also used by MapStorageService for save/load and MapBridgeService for editor→game transfer.
 *
 * Version 2.0.0: spawnPoint/exitPoint replaced by spawnPoints/exitPoints arrays.
 * importState() handles backward compatibility with v1.0.0 single-point format.
 */
export interface TerrainGridState {
  gridSize: number;
  tiles: TerrainType[][];  // tiles[x][z] = TerrainType value
  heightMap: number[][];
  spawnPoints: { x: number; z: number }[];
  exitPoints: { x: number; z: number }[];
  version: string;
}

/**
 * Legacy v1 format — used only for backward-compatible deserialization.
 * @internal
 */
export interface TerrainGridStateLegacy {
  gridSize: number;
  tiles: TerrainType[][];
  heightMap: number[][];
  spawnPoint: { x: number; z: number } | null;
  exitPoint: { x: number; z: number } | null;
  version: string;
}
