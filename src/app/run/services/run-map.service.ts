import { Injectable } from '@angular/core';
import { TerrainGridState } from '../../games/novarise/features/terrain-editor/terrain-grid-state.interface';
import {
  buildFirstLight,
  buildTheBend,
  buildSerpentine,
  buildTheFork,
} from '../data/maps/intro-maps';
import {
  buildTwinGates,
  buildOpenGround,
  buildTheNarrows,
  buildCrystalMaze,
} from '../data/maps/early-maps';
import {
  buildCrossfire,
  buildTheSpiral,
  buildSiege,
  buildLabyrinth,
} from '../data/maps/mid-maps';
import {
  buildFortress,
  buildTheGauntlet,
  buildStorm,
  buildNovarise,
} from '../data/maps/late-maps';


/** Registry of hand-crafted run-mode map builders, keyed by level ID. */
const RUN_MAP_REGISTRY: Record<string, () => TerrainGridState> = {
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

/** Loads TerrainGridState maps for run-mode levels. */
@Injectable({ providedIn: 'root' })
export class RunMapService {
  /**
   * Load the TerrainGridState for a run-mode map.
   * All 16 levels return hand-crafted maps from RUN_MAP_REGISTRY.
   * Returns null for unknown level IDs.
   */
  loadLevel(levelId: string): TerrainGridState | null {
    const builder = RUN_MAP_REGISTRY[levelId];
    return builder ? builder() : null;
  }
}
