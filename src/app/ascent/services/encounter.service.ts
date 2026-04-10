import { Injectable } from '@angular/core';
import { MapNode, NodeType } from '../models/node-map.model';
import { EncounterConfig } from '../models/encounter.model';
import { RunState } from '../models/run-state.model';
import { WaveDefinition } from '../../game/game-board/models/wave.model';
import { MapBridgeService } from '../../core/services/map-bridge.service';
import { CampaignMapService } from '../../campaign/services/campaign-map.service';
import { WaveGeneratorService } from './wave-generator.service';
import { REWARD_CONFIG } from '../constants/ascent.constants';

/**
 * Orchestrates encounter preparation for Ascent Mode.
 *
 * Turns a MapNode + RunState into a fully-configured EncounterConfig and
 * loads the matching campaign map into MapBridgeService so GameBoardComponent
 * can pick it up on route transition to /play.
 *
 * This service is root-scoped to survive the /ascent → /play route transition.
 */
@Injectable({ providedIn: 'root' })
export class EncounterService {

  constructor(
    private readonly waveGenerator: WaveGeneratorService,
    private readonly mapBridge: MapBridgeService,
    private readonly campaignMapService: CampaignMapService,
  ) {}

  /**
   * Build an EncounterConfig from the given node and current run state.
   *
   * Does NOT load the map — call `loadEncounterMap()` separately once
   * the player commits to entering the encounter.
   */
  prepareEncounter(node: MapNode, runState: RunState): EncounterConfig {
    const waves = this.generateWavesForNode(node, runState);
    const goldReward = this.computeGoldReward(node, runState);

    return {
      nodeId: node.id,
      nodeType: node.type,
      campaignMapId: node.campaignMapId,
      waves,
      goldReward,
      isElite: node.type === NodeType.ELITE,
      isBoss: node.type === NodeType.BOSS,
    };
  }

  /**
   * Load the campaign map for the encounter into MapBridgeService.
   *
   * Must be called before navigating to /play. GameBoardComponent reads
   * the map state from MapBridgeService via GameGuard.
   */
  loadEncounterMap(config: EncounterConfig): void {
    const mapState = this.campaignMapService.loadLevel(config.campaignMapId);
    if (mapState === null) {
      // campaignMapId not found — this should not happen with valid data,
      // but fail fast with a clear error rather than silently loading nothing.
      throw new Error(
        `EncounterService: campaign map "${config.campaignMapId}" not found. ` +
        `Check CAMPAIGN_MAP_TIERS in ascent.constants.ts.`,
      );
    }
    this.mapBridge.setEditorMapState(mapState, config.campaignMapId);
  }

  // ── Private helpers ───────────────────────────────────────

  /** Routes to the correct WaveGeneratorService method based on node type. */
  private generateWavesForNode(node: MapNode, runState: RunState): WaveDefinition[] {
    const { row, type } = node;
    const { actIndex, seed } = runState;

    switch (type) {
      case NodeType.ELITE:
        return this.waveGenerator.generateEliteWaves(row, actIndex, seed);
      case NodeType.BOSS:
        return this.waveGenerator.generateBossWaves(actIndex, seed);
      case NodeType.COMBAT:
      case NodeType.UNKNOWN:
        // UNKNOWN reveals itself as combat when entered
        return this.waveGenerator.generateCombatWaves(row, actIndex, seed);
      default:
        // Non-combat nodes (REST, SHOP, EVENT) have no waves
        return [];
    }
  }

  /**
   * Computes the gold reward for completing an encounter.
   *
   * Uses REWARD_CONFIG base values; elite/boss nodes have been
   * designed to award gold via their wave rewards, so this is
   * supplemental pickup gold shown on the reward screen.
   */
  private computeGoldReward(node: MapNode, runState: RunState): number {
    const baseGold = REWARD_CONFIG.combatGoldBase + node.row * REWARD_CONFIG.combatGoldPerRow;

    switch (node.type) {
      case NodeType.ELITE:
        return Math.round(baseGold * 1.5);
      case NodeType.BOSS:
        return Math.round(baseGold * 2.0);
      default:
        return baseGold;
    }
  }
}
