export interface MinimapEntityData {
  x: number;
  z: number;
  type: 'tower' | 'enemy';
}

export interface MinimapTerrainData {
  gridWidth: number;
  gridHeight: number;
  /** @deprecated Use gridWidth/gridHeight */
  gridSize?: number;
  isPath: (row: number, col: number) => boolean;
  spawnPoints?: { x: number; z: number }[];
  exitPoints?: { x: number; z: number }[];
  /** @deprecated Use spawnPoints. Kept for backward compat. */
  spawnPoint?: { x: number; z: number };
  /** @deprecated Use exitPoints. Kept for backward compat. */
  exitPoint?: { x: number; z: number };
}
