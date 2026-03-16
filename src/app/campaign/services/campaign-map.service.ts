import { Injectable } from '@angular/core';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { CAMPAIGN_LEVELS } from '../models/campaign.model';

/** Schema version emitted by generated placeholder maps. */
const PLACEHOLDER_MAP_VERSION = '2.0.0';

/**
 * Generates placeholder TerrainGridState maps for campaign levels.
 *
 * Sprint 3-6 will replace these with hand-crafted maps stored in a registry.
 * The generated map creates a simple straight horizontal path from spawner to exit
 * scaled to the level's gridSize, with enough spawner/exit points per the level config.
 */
@Injectable({ providedIn: 'root' })
export class CampaignMapService {
  /**
   * Load the TerrainGridState for a campaign level.
   * Returns null for unknown level IDs.
   */
  loadLevel(levelId: string): TerrainGridState | null {
    const level = CAMPAIGN_LEVELS.find(l => l.id === levelId);
    if (!level) return null;
    return this.generatePlaceholder(
      level.gridSize,
      level.spawnerCount,
      level.exitCount,
    );
  }

  /**
   * Generates a minimal valid placeholder map:
   * - All tiles are BEDROCK (traversable)
   * - Spawner(s) on the left edge, evenly distributed
   * - Exit(s) on the right edge, evenly distributed
   */
  private generatePlaceholder(
    gridSize: number,
    spawnerCount: number,
    exitCount: number,
  ): TerrainGridState {
    const tiles: TerrainType[][] = [];
    for (let x = 0; x < gridSize; x++) {
      tiles[x] = [];
      for (let z = 0; z < gridSize; z++) {
        tiles[x][z] = TerrainType.BEDROCK;
      }
    }

    const heightMap: number[][] = [];
    for (let x = 0; x < gridSize; x++) {
      heightMap[x] = new Array<number>(gridSize).fill(0);
    }

    const spawnPoints = this.distributePoints(0, gridSize, spawnerCount);
    const exitPoints = this.distributePoints(gridSize - 1, gridSize, exitCount);

    return {
      gridSize,
      tiles,
      heightMap,
      spawnPoints,
      exitPoints,
      version: PLACEHOLDER_MAP_VERSION,
    };
  }

  /**
   * Distributes `count` points evenly along the z-axis at the given x column.
   */
  private distributePoints(
    x: number,
    gridSize: number,
    count: number,
  ): { x: number; z: number }[] {
    const points: { x: number; z: number }[] = [];
    // Distribute evenly across grid rows, clamped to valid range
    const step = gridSize / (count + 1);
    for (let i = 1; i <= count; i++) {
      const z = Math.min(Math.round(step * i) - 1, gridSize - 1);
      points.push({ x, z });
    }
    return points;
  }
}
