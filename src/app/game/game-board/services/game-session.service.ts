import { Injectable, Optional } from '@angular/core';
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
import { ElevationService } from './elevation.service';
import { TowerGraphService } from './tower-graph.service';
import { LinkMeshService } from './link-mesh.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { TextSpritePoolService } from './text-sprite-pool.service';
import { GoldPopupService } from './gold-popup.service';
import { VfxPoolService } from './vfx-pool.service';
import { TowerDecalLibraryService } from './tower-decal-library.service';
import { buildDisposeProtect, disposeGroup } from '../utils/three-utils';

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
    private elevationService: ElevationService,
    @Optional() private terraformPool?: TerraformMaterialPoolService,
    // @Optional() so flat test beds without GameBoardComponent.providers
    // don't need to register the registries.
    @Optional() private geometryRegistry?: GeometryRegistryService,
    @Optional() private materialRegistry?: MaterialRegistryService,
    @Optional() private textSpritePool?: TextSpritePoolService,
    @Optional() private goldPopupService?: GoldPopupService,
    @Optional() private vfxPool?: VfxPoolService,
    // @Optional() so pre-Conduit test beds don't need to register this.
    // Production wires it via GameBoardComponent.providers.
    @Optional() private towerGraphService?: TowerGraphService,
    // @Optional() — LinkMeshService owns all link-mesh disposal; cleanupScene
    // delegates to its dispose().
    @Optional() private linkMeshService?: LinkMeshService,
    // @Optional() — Phase A tower polish. Caches CanvasTextures; dispose()
    // must be called at encounter teardown to release GPU texture memory.
    @Optional() private towerDecalLibrary?: TowerDecalLibraryService,
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
    // Clear active elevation state from a prior encounter (same lifecycle as pathMutationService).
    this.elevationService.reset();
    // Clear adjacency graph state (virtual edges, disruption entries).
    // Explicit call makes the encounter-teardown contract visible even
    // though the graph is derived from placedTowers (already reset above).
    this.towerGraphService?.reset();
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

    // Dispose link-mesh lines + shared materials before tower meshes are
    // disposed. Contract: link meshes are torn down by their dedicated owner
    // first (defensive — positions aren't needed on dispose).
    this.linkMeshService?.dispose();

    // Clean up tower placement preview
    this.towerPreviewService.cleanup(scene);

    // Clean up damage + gold popups (sprint 16 — gold popup cleanup was
    // missing from cleanupScene before; pre-Phase-B leak fixed here).
    this.damagePopupService.cleanup(scene);
    this.goldPopupService?.cleanup(scene);

    // Clean up minimap
    this.minimapService.cleanup();

    // Clean up path overlay
    this.pathVisualizationService.hidePath(scene);
    this.pathVisualizationService.cleanup();

    // Clean up tile highlights (needs tile meshes before they are cleared)
    // Drop all highlight/hover/selection state before layer disposal so the
    // next encounter's fresh layers aren't poisoned by stale saved colors
    // (sprint 30 red-team fix).
    this.tileHighlightService.resetAllState();

    // Clean up range preview and range toggle rings
    this.rangeVisualizationService.cleanup(scene);

    // Clean up upgrade flash/glow ring effects
    this.towerUpgradeVisualService.cleanup(scene);


    // Dispose tower meshes — protect registry-owned geometry/material so
    // single-mesh disposal doesn't break the cache. Registries themselves
    // are disposed below.
    const protect = buildDisposeProtect(this.geometryRegistry, this.materialRegistry, this.terraformPool);
    this.meshRegistry.towerMeshes.forEach(group => disposeGroup(group, scene, protect));
    this.meshRegistry.towerMeshes.clear();

    // Dispose individual tile meshes (non-instanced surfaces — non-BASE
    // tiles in sprint 22; widens with sprint 23).
    //  - Pool materials (terraformed tiles) skipped — terraformPool.dispose() below.
    //  - Registry geometry skipped (sprint 12) — geometryRegistry.dispose() below.
    //  - Pre-sprint-21 fix: tile materials are per-instance again, so they
    //    dispose normally (registry guard is a no-op here).
    this.meshRegistry.tileMeshes.forEach(mesh => {
      scene.remove(mesh);
      if (!this.geometryRegistry?.isRegisteredGeometry(mesh.geometry)) {
        mesh.geometry.dispose();
      }
      const mat = mesh.material as THREE.Material | THREE.Material[];
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach(m => {
        if (this.terraformPool?.isPoolMaterial(m)) return;
        if (this.materialRegistry?.isRegisteredMaterial(m)) return;
        m.dispose();
      });
    });
    this.meshRegistry.tileMeshes.clear();

    // Dispose tile InstancedMesh layers (sprint 22 BASE; sprint 23 widens).
    // Layer.dispose disposes the InstancedMesh itself; geometry + material
    // are registry-owned and disposed in their respective batch passes.
    this.meshRegistry.tileInstanceLayers.forEach(layer => layer.dispose(scene));
    this.meshRegistry.tileInstanceLayers.clear();

    // Dispose cliff column meshes (sprint 39 Highground polish).
    // Geometry skipped if registry-shared (sprint 12), material is pool-owned.
    this.meshRegistry.cliffMeshes.forEach(cliffMesh => {
      scene.remove(cliffMesh);
      if (!this.geometryRegistry?.isRegisteredGeometry(cliffMesh.geometry)) {
        cliffMesh.geometry.dispose();
      }
    });
    this.meshRegistry.cliffMeshes.clear();

    // Dispose all pooled terraform materials in one batch.
    this.terraformPool?.dispose();

    // Dispose all registry-shared materials in one batch (sprint 14).
    this.materialRegistry?.dispose();

    // Dispose all registry-shared geometries in one batch.
    this.geometryRegistry?.dispose();

    // Dispose pooled sprites + their cached textures (sprint 16).
    // Must run AFTER gold/damage popup cleanup so popups release back into
    // the pool first, then the pool drains its caches.
    this.textSpritePool?.dispose();

    // Dispose pooled VFX visuals (chain arcs, mortar zones — sprint 18).
    // CombatVFXService.cleanup() (called via towerCombatService.cleanup())
    // already released the active visuals back into the pool above.
    this.vfxPool?.dispose();

    // Dispose decal CanvasTextures. Must run after tower mesh disposal so any
    // material that held a decal texture reference is already gone.
    this.towerDecalLibrary?.dispose();

    // Dispose grid lines (Mesh + Line children, both handled by disposeGroup).
    // Grid material is currently per-instance; once Phase B sprint 28 (or
    // earlier) collapses grid lines into LineSegments, consider routing it
    // through MaterialRegistry as well.
    if (this.meshRegistry.gridLines) {
      disposeGroup(this.meshRegistry.gridLines, scene);
    }
    this.meshRegistry.gridLines = null;

    // Delegate particles, skybox, and lights cleanup to SceneService
    this.sceneService.disposeParticles();
    this.sceneService.disposeSkybox();
    this.sceneService.disposeLights();
  }
}
