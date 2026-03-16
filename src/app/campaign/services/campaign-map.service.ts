import { Injectable } from '@angular/core';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import { TerrainType } from '../../games/novarise/models/terrain-types.enum';
import { CAMPAIGN_LEVELS } from '../models/campaign.model';
import {
  buildFirstLight,
  buildTheBend,
  buildSerpentine,
  buildTheFork,
} from '../maps/intro-maps';
import {
  buildTwinGates,
  buildOpenGround,
  buildTheNarrows,
  buildCrystalMaze,
} from '../maps/early-maps';
import {
  buildCrossfire,
  buildTheSpiral,
  buildSiege,
  buildLabyrinth,
} from '../maps/mid-maps';
import {
  buildFortress,
  buildTheGauntlet,
  buildStorm,
  buildNovarise,
} from '../maps/late-maps';

/** Schema version emitted by generated placeholder maps. */
const PLACEHOLDER_MAP_VERSION = '2.0.0';

/**
 * Registry of hand-crafted campaign map builders, keyed by campaign level ID.
 * Levels not present here fall back to placeholder generation.
 */
const CAMPAIGN_MAP_REGISTRY: Record<string, () => TerrainGridState> = {
  campaign_01: buildFirstLight,
  campaign_02: buildTheBend,
  campaign_03: buildSerpentine,
  campaign_04: buildTheFork,
  campaign_05: buildTwinGates,
  campaign_06: buildOpenGround,
  campaign_07: buildTheNarrows,
  campaign_08: buildCrystalMaze,
  campaign_09: buildCrossfire,
  campaign_10: buildTheSpiral,
  campaign_11: buildSiege,
  campaign_12: buildLabyrinth,
  campaign_13: buildFortress,
  campaign_14: buildTheGauntlet,
  campaign_15: buildStorm,
  campaign_16: buildNovarise,
};

/**
 * Loads TerrainGridState maps for campaign levels.
 *
 * Levels 1-8 (Intro + Early tiers) return hand-crafted maps from CAMPAIGN_MAP_REGISTRY.
 * Levels 9-16 fall back to placeholder generation until their sprints land.
 */
@Injectable({ providedIn: 'root' })
export class CampaignMapService {
  /**
   * Load the TerrainGridState for a campaign level.
   * All 16 levels return hand-crafted maps from CAMPAIGN_MAP_REGISTRY.
   * Returns null for unknown level IDs.
   */
  loadLevel(levelId: string): TerrainGridState | null {
    const builder = CAMPAIGN_MAP_REGISTRY[levelId];
    if (builder) {
      return builder();
    }

    // Fallback to placeholder for levels without hand-crafted maps yet
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
