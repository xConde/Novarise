import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { GameStateService } from './game-state.service';
import { WaveService } from './wave.service';
import { EnemyService } from './enemy.service';
import { GameStatsService } from './game-stats.service';
import { GameNotificationService } from './game-notification.service';
import { ChallengeTrackingService } from './challenge-tracking.service';
import { GameEndService } from './game-end.service';
import { StatusEffectService } from './status-effect.service';
import { MapBridgeService } from '@core/services/map-bridge.service';
import { TutorialService } from '@core/services/tutorial.service';
import { PlayerProfileService } from '@core/services/player-profile.service';
import { CAMPAIGN_WAVE_DEFINITIONS } from '@campaign/waves/campaign-waves';
import { TowerCombatService } from './tower-combat.service';
import { TowerPreviewService } from './tower-preview.service';
import { DamagePopupService } from './damage-popup.service';
import { MinimapService } from './minimap.service';
import { PathVisualizationService } from './path-visualization.service';
import { TileHighlightService } from './tile-highlight.service';
import { RangeVisualizationService } from './range-visualization.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { SceneService } from './scene.service';
import { disposeMaterial } from '../utils/three-utils';

/** Options bag passed to cleanupScene — holds component-owned mesh maps. */
export interface CleanupSceneOpts {
  tileMeshes: Map<string, THREE.Mesh>;
  towerMeshes: Map<string, THREE.Group>;
  gridLines: THREE.Group | null;
}

/**
 * Orchestrates game-level lifecycle: service resets on restart and campaign wave wiring.
 * Component-scoped — provided in GameModule alongside the other game services.
 */
@Injectable()
export class GameSessionService {
  constructor(
    private gameStateService: GameStateService,
    private waveService: WaveService,
    private enemyService: EnemyService,
    private gameStatsService: GameStatsService,
    private gameNotificationService: GameNotificationService,
    private challengeTrackingService: ChallengeTrackingService,
    private gameEndService: GameEndService,
    private statusEffectService: StatusEffectService,
    private mapBridge: MapBridgeService,
    private tutorialService: TutorialService,
    private playerProfileService: PlayerProfileService,
    private towerCombatService: TowerCombatService,
    private towerPreviewService: TowerPreviewService,
    private damagePopupService: DamagePopupService,
    private minimapService: MinimapService,
    private pathVisualizationService: PathVisualizationService,
    private tileHighlightService: TileHighlightService,
    private rangeVisualizationService: RangeVisualizationService,
    private towerUpgradeVisualService: TowerUpgradeVisualService,
    private sceneService: SceneService,
  ) {}

  /**
   * Reset all game services to their initial state.
   * Called by restartGame() and playNextLevel().
   * scene parameter is needed for EnemyService which removes Three.js objects.
   */
  resetAllServices(scene: THREE.Scene): void {
    this.enemyService.reset(scene);
    this.waveService.reset();
    this.gameStateService.reset();
    this.gameStatsService.reset();
    this.gameEndService.reset();
    this.gameNotificationService.clear();
    this.challengeTrackingService.reset();
    this.statusEffectService.cleanup();
    this.tutorialService.resetCurrentStep();
    this.playerProfileService.resetSession();
  }

  /**
   * Load campaign wave definitions for the current map into WaveService and GameStateService.
   * No-op for non-campaign maps (standard 10-wave gameplay is unchanged).
   * Must be called after waveService.reset() — reset clears custom wave definitions.
   */
  applyCampaignWaves(): void {
    const mapId = this.mapBridge.getMapId();
    if (!mapId?.startsWith('campaign_')) return;

    const waves = CAMPAIGN_WAVE_DEFINITIONS[mapId];
    if (!waves) return;

    this.waveService.setCustomWaves(waves);
    this.gameStateService.setMaxWaves(waves.length);
  }

  /**
   * Dispose all Three.js scene objects (tile meshes, tower meshes, grid lines) and
   * clean up all associated services. Call before resetAllServices() on restart.
   *
   * The opts maps are mutated in place: they are cleared after disposal so the
   * component's cached arrays become empty without requiring separate calls.
   *
   * @returns The gridLines reference set to null (caller should assign to its field).
   */
  cleanupScene(opts: CleanupSceneOpts): null {
    const scene = this.sceneService.getScene();

    // Guard: scene may be null during WebGL context-loss recovery or mid-disposal.
    // Clear the component's mesh maps so its cached arrays rebuild empty, then bail.
    if (!scene) {
      opts.tileMeshes.clear();
      opts.towerMeshes.clear();
      return null;
    }

    // Clean up tower combat state (projectiles)
    this.towerCombatService.cleanup(scene);

    // Clean up tower placement preview
    this.towerPreviewService.cleanup(scene);

    // Clean up damage popups
    this.damagePopupService.cleanup(scene);

    // Clean up minimap
    this.minimapService.cleanup();

    // Clean up path overlay
    this.pathVisualizationService.hidePath(scene);
    this.pathVisualizationService.cleanup();

    // Clean up tile highlights (needs tile meshes before they are cleared)
    this.tileHighlightService.clearHighlights(opts.tileMeshes, scene);

    // Clean up range preview and range toggle rings
    this.rangeVisualizationService.cleanup(scene);

    // Clean up upgrade flash/glow ring effects
    this.towerUpgradeVisualService.cleanup(scene);

    // Dispose tower meshes
    opts.towerMeshes.forEach(group => {
      scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    });
    opts.towerMeshes.clear();

    // Dispose tile meshes
    opts.tileMeshes.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    opts.tileMeshes.clear();

    // Dispose grid lines
    if (opts.gridLines) {
      scene.remove(opts.gridLines);
      opts.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    }

    // Delegate particles, skybox, and lights cleanup to SceneService
    this.sceneService.disposeParticles();
    this.sceneService.disposeSkybox();
    this.sceneService.disposeLights();

    return null;
  }
}
