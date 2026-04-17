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
import { TowerCombatService } from './tower-combat.service';
import { TowerPreviewService } from './tower-preview.service';
import { DamagePopupService } from './damage-popup.service';
import { MinimapService } from './minimap.service';
import { PathVisualizationService } from './path-visualization.service';
import { TileHighlightService } from './tile-highlight.service';
import { RangeVisualizationService } from './range-visualization.service';
import { TowerUpgradeVisualService } from './tower-upgrade-visual.service';
import { SceneService } from './scene.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { CombatLoopService } from './combat-loop.service';
import { WavePreviewService } from './wave-preview.service';
import { GamePauseService } from './game-pause.service';
import { PathMutationService } from './path-mutation.service';
import { disposeMaterial } from '../utils/three-utils';

/**
 * Orchestrates game-level lifecycle: service resets on restart and Three.js scene cleanup.
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
    private meshRegistry: BoardMeshRegistryService,
    private combatLoopService: CombatLoopService,
    private wavePreviewService: WavePreviewService,
    private gamePauseService: GamePauseService,
    private pathMutationService: PathMutationService,
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
    // Clear per-encounter turn counter / leak flag / frame buffers. Without this,
    // turnNumber carries over from the prior encounter and SPEED_RUN challenges
    // start wildly over budget on encounter 2+. (Regression discovered after
    // Phase 10 retargeted SPEED_RUN to turn count.)
    this.combatLoopService.reset();
    // Clear one-shot scout bonuses from scout spells played in a prior encounter.
    this.wavePreviewService.resetForEncounter();
    // Clear stale autoPaused / showQuitConfirm state from a prior encounter so
    // the pause menu doesn't open mid-new-encounter stuck on the quit dialog.
    this.gamePauseService.reset();
    // Clear active path mutations from a prior encounter (defense-in-depth; the
    // service is component-scoped so it would be destroyed anyway, but explicit
    // reset matches the pattern for all other encounter-scoped services).
    this.pathMutationService.reset();
  }

  /**
   * Dispose all Three.js scene objects (tile meshes, tower meshes, grid lines) and
   * clean up all associated services. Call before resetAllServices() on restart.
   *
   * Mesh maps in BoardMeshRegistryService are cleared in place after disposal so
   * the registry's cached arrays become empty without requiring separate calls.
   */
  cleanupScene(): void {
    const scene = this.sceneService.getScene();

    // Guard: scene may be null during WebGL context-loss recovery or mid-disposal.
    // Clear the registry's mesh maps so cached arrays rebuild empty, then bail.
    if (!scene) {
      this.meshRegistry.tileMeshes.clear();
      this.meshRegistry.towerMeshes.clear();
      return;
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
    this.tileHighlightService.clearHighlights(this.meshRegistry.tileMeshes, scene);

    // Clean up range preview and range toggle rings
    this.rangeVisualizationService.cleanup(scene);

    // Clean up upgrade flash/glow ring effects
    this.towerUpgradeVisualService.cleanup(scene);

    // Dispose tower meshes
    this.meshRegistry.towerMeshes.forEach(group => {
      scene.remove(group);
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    });
    this.meshRegistry.towerMeshes.clear();

    // Dispose tile meshes
    this.meshRegistry.tileMeshes.forEach(mesh => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    });
    this.meshRegistry.tileMeshes.clear();

    // Dispose grid lines
    if (this.meshRegistry.gridLines) {
      scene.remove(this.meshRegistry.gridLines);
      this.meshRegistry.gridLines.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    }
    this.meshRegistry.gridLines = null;

    // Delegate particles, skybox, and lights cleanup to SceneService
    this.sceneService.disposeParticles();
    this.sceneService.disposeSkybox();
    this.sceneService.disposeLights();
  }
}
