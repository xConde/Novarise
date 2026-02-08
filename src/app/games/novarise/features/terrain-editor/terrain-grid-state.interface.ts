import { TerrainType } from '../../models/terrain-types.enum';

/**
 * Serializable state of a TerrainGrid, produced by exportState() and consumed by importState().
 * Also used by MapStorageService for save/load and MapBridgeService for editor→game transfer.
 */
export interface TerrainGridState {
  gridSize: number;
  tiles: TerrainType[][];  // tiles[x][z] = TerrainType value
  heightMap: number[][];
  spawnPoint: { x: number; z: number } | null;
  exitPoint: { x: number; z: number } | null;
  version: string;
}
