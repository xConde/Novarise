import { Enemy } from '../models/enemy.model';

export interface SpatialGridConfig {
  /** Size of each grid cell in world units */
  readonly cellSize: number;
}

/** Cell size roughly matches max tower range (Sniper = 6, so 2 cells covers it) */
export const SPATIAL_GRID_CONFIG: SpatialGridConfig = {
  cellSize: 3,
} as const;

/**
 * Broad-phase spatial index for fast range queries over enemies.
 *
 * Rebuilt once per frame in TowerCombatService.update() — insert all living
 * enemies, then use queryRadius() to get candidates for each tower/zone.
 * Callers MUST still perform the narrow-phase distance check.
 */
export class SpatialGrid {
  private cells = new Map<string, Enemy[]>();
  private readonly cellSize: number;

  constructor(cellSize: number = SPATIAL_GRID_CONFIG.cellSize) {
    this.cellSize = cellSize;
  }

  /** Clear all cells. Call once per frame before re-inserting enemies. */
  clear(): void {
    this.cells.clear();
  }

  /** Insert an enemy into the grid based on its current position. */
  insert(enemy: Enemy): void {
    const key = this.getCellKey(enemy.position.x, enemy.position.z);
    const cell = this.cells.get(key);
    if (cell) {
      cell.push(enemy);
    } else {
      this.cells.set(key, [enemy]);
    }
  }

  /**
   * Query all enemies within `radius` of the given world position.
   * Returns candidates that MAY be in range — caller must do final distance check.
   * This is the broad phase; the caller applies the narrow phase (exact distance).
   */
  queryRadius(x: number, z: number, radius: number): Enemy[] {
    const results: Enemy[] = [];
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellZ = Math.floor((z - radius) / this.cellSize);
    const maxCellZ = Math.floor((z + radius) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.cells.get(`${cx},${cz}`);
        if (cell) {
          for (const enemy of cell) {
            results.push(enemy);
          }
        }
      }
    }

    return results;
  }

  private getCellKey(x: number, z: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }
}
