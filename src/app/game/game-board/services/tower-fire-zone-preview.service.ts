import { Injectable, OnDestroy, Optional } from '@angular/core';
import * as THREE from 'three';

import { TOWER_CONFIGS, TowerType } from '../models/tower.model';
import { VEINSEEKER_SPEED_BOOST_WINDOW } from '../models/enemy.model';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerSelectionService } from './tower-selection.service';
import { SceneService } from './scene.service';
import { ForwardSimulationService } from './forward-simulation.service';
import { StatusEffectService } from './status-effect.service';
import { PathMutationService } from './path-mutation.service';
import { EnemyService } from './enemy.service';
import { PathfindingService } from './pathfinding.service';
import { CombatLoopService } from './combat-loop.service';

/**
 * Rendering config for the tower fire-zone preview dashed line.
 * All numeric and opacity values live here — no magic numbers in the service body.
 */
export const TOWER_FIRE_ZONE_PREVIEW_CONFIG = {
  /** Length of each rendered dash segment (world units). */
  dashSize: 0.18,
  /** Length of the gap between dash segments (world units). */
  gapSize: 0.12,
  /** Opacity of the dashed line material (0 = invisible, 1 = fully opaque). */
  opacity: 0.5,
  /** Vertical offset above the tile surface so the line clears tile geometry. */
  yOffset: 0.65,
  /**
   * Minimum distance between current and projected position (world units) below
   * which the projected line is suppressed. When the enemy will not move next
   * turn the dashed line would overlap the solid aim line — hiding it avoids
   * visual redundancy.
   */
  minProjectionDistance: 0.05,
} as const;

/**
 * Draws a dashed line from the selected tower to its current aim-target's
 * PROJECTED position after one turn of movement.
 *
 * Complements `AimLineService`, which draws a SOLID line to the current
 * position. When the target will not move the dashed line is suppressed so the
 * two lines do not overlap redundantly.
 *
 * Uses `THREE.LineDashedMaterial` with `computeLineDistances()` called after
 * each geometry update (required for dash rendering in Three.js).
 *
 * Component-scoped — provided in `GameBoardComponent.providers`.
 * Disposed via `cleanup()`. Also implements `OnDestroy` as a safety net.
 */
@Injectable()
export class TowerFireZonePreviewService implements OnDestroy {
  private line: THREE.Line | null = null;
  private lineGeo: THREE.BufferGeometry | null = null;
  private lineMat: THREE.LineDashedMaterial | null = null;

  /** Scene the line has been added to; used for safe removal. */
  private attachedScene: THREE.Scene | null = null;

  /** Scratch object reused to avoid per-frame allocation. */
  private readonly scratchWorld = { x: 0, z: 0 };

  /**
   * Persistent scratch Vector3s and Float32Array reused each frame to avoid
   * per-frame allocation on the hot animation path.
   */
  private readonly _scratchStart = new THREE.Vector3();
  private readonly _scratchEnd = new THREE.Vector3();
  /** Last endpoint values written to the geometry; used to skip setAttribute when unchanged. */
  private readonly _lastStart = new THREE.Vector3(NaN, NaN, NaN);
  private readonly _lastEnd = new THREE.Vector3(NaN, NaN, NaN);
  /** Persistent position buffer — 2 vertices × 3 floats. Avoids a new Float32Array per frame. */
  private readonly _positionBuf = new Float32Array(6);

  constructor(
    // @Optional() so flat test beds that don't provide all services still compile.
    @Optional() private sceneService?: SceneService,
    @Optional() private selectionService?: TowerSelectionService,
    @Optional() private meshRegistry?: BoardMeshRegistryService,
    @Optional() private forwardSim?: ForwardSimulationService,
    @Optional() private statusEffectService?: StatusEffectService,
    @Optional() private pathMutationService?: PathMutationService,
    @Optional() private enemyService?: EnemyService,
    @Optional() private pathfindingService?: PathfindingService,
    @Optional() private combatLoopService?: CombatLoopService,
  ) {}

  /** Angular lifecycle hook — delegates to cleanup() for route-change safety. */
  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Called once per animation frame (after `tickAim` and `AimLineService.update()`).
   * Reads the selected tower and its `currentAimTarget`, projects the target's
   * grid position one turn ahead, then repositions the dashed line.
   *
   * Hides the line when:
   * - Any required service is absent
   * - `reduceMotion` is true
   * - No tower is selected
   * - Selected tower has no `currentAimTarget`
   * - Projected position equals current position (target stationary — no info to add)
   *
   * @param reduceMotion When true, hide the line regardless of selection state.
   */
  update(reduceMotion = false): void {
    if (
      !this.sceneService ||
      !this.selectionService ||
      !this.meshRegistry ||
      !this.forwardSim ||
      !this.statusEffectService ||
      !this.enemyService ||
      !this.pathfindingService
    ) {
      return;
    }

    const scene = this.sceneService.getScene();
    if (!scene) {
      this.hide();
      return;
    }

    if (reduceMotion) {
      this.hide();
      return;
    }

    const selectedTower = this.selectionService.selectedTowerInfo;
    if (!selectedTower) {
      this.hide();
      return;
    }

    const towerKey = `${selectedTower.row}-${selectedTower.col}`;
    const towerGroup = this.meshRegistry.towerMeshes.get(towerKey);
    if (!towerGroup) {
      this.hide();
      return;
    }

    // Read the live aim target from userData — same source as AimLineService.
    const aimTargetRaw = towerGroup.userData['currentAimTarget'] as unknown;
    if (!aimTargetRaw || typeof aimTargetRaw !== 'object') {
      this.hide();
      return;
    }

    // Extract the enemy id and look up the full Enemy object for projection.
    const maybeTarget = aimTargetRaw as { id?: unknown };
    const enemyId = typeof maybeTarget.id === 'string' ? maybeTarget.id : null;
    if (!enemyId) {
      this.hide();
      return;
    }

    const enemy = this.enemyService.getEnemies().get(enemyId);
    if (!enemy) {
      this.hide();
      return;
    }

    // Determine slow reduction and VEINSEEKER boost state.
    const slowTileReduction = this.statusEffectService.getSlowTileReduction(enemyId);
    const currentTurn = this.combatLoopService?.getTurnNumber() ?? 0;
    const veinseekerBoosted =
      this.pathMutationService?.wasMutatedInLastTurns(currentTurn, VEINSEEKER_SPEED_BOOST_WINDOW) ?? false;

    // Project enemy grid position one turn ahead.
    const projected = this.forwardSim.projectGridPosition(
      enemy,
      1,
      slowTileReduction,
      0,
      veinseekerBoosted,
    );

    // Convert tower world position. Reuse _scratchStart as a temporary vector
    // before it is overwritten below (single allocation on the hot path).
    const towerWorld = this._scratchStart;
    towerGroup.getWorldPosition(towerWorld);

    // Convert current enemy grid position to world coords.
    this.pathfindingService.gridToWorldPosInto(
      enemy.gridPosition.row,
      enemy.gridPosition.col,
      this.scratchWorld,
    );
    const currentWorldX = this.scratchWorld.x;
    const currentWorldZ = this.scratchWorld.z;

    // Convert projected grid position to world coords.
    this.pathfindingService.gridToWorldPosInto(projected.row, projected.col, this.scratchWorld);
    const projectedWorldX = this.scratchWorld.x;
    const projectedWorldZ = this.scratchWorld.z;

    // Suppress if the enemy won't actually move (projected == current).
    const dx = projectedWorldX - currentWorldX;
    const dz = projectedWorldZ - currentWorldZ;
    const projectionDist = Math.sqrt(dx * dx + dz * dz);
    if (projectionDist < TOWER_FIRE_ZONE_PREVIEW_CONFIG.minProjectionDistance) {
      this.hide();
      return;
    }

    const y = towerWorld.y + TOWER_FIRE_ZONE_PREVIEW_CONFIG.yOffset;
    this._scratchStart.set(towerWorld.x, y, towerWorld.z);
    this._scratchEnd.set(projectedWorldX, y, projectedWorldZ);

    const length = this._scratchStart.distanceTo(this._scratchEnd);
    if (length < 0.001) {
      this.hide();
      return;
    }

    const color = TOWER_CONFIGS[selectedTower.type as TowerType]?.color ?? 0xffffff;

    this.ensureLine(scene, color);

    if (this.line && this.lineGeo && this.lineMat) {
      // Update color in case selection changed tower type.
      this.lineMat.color.setHex(color);

      // Only overwrite the GPU buffer when an endpoint has actually moved.
      // This avoids a new Float32Array allocation and a BufferAttribute upload
      // every frame when both tower and projected target are stationary.
      const startMoved = !this._scratchStart.equals(this._lastStart);
      const endMoved   = !this._scratchEnd.equals(this._lastEnd);
      if (startMoved || endMoved) {
        this._positionBuf[0] = this._scratchStart.x;
        this._positionBuf[1] = this._scratchStart.y;
        this._positionBuf[2] = this._scratchStart.z;
        this._positionBuf[3] = this._scratchEnd.x;
        this._positionBuf[4] = this._scratchEnd.y;
        this._positionBuf[5] = this._scratchEnd.z;
        this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this._positionBuf, 3));
        // computeLineDistances() populates the 'lineDistance' attribute that
        // LineDashedMaterial requires. Without it dashes won't appear.
        this.line.computeLineDistances();
        this.lineGeo.attributes['position'].needsUpdate = true;
        this._lastStart.copy(this._scratchStart);
        this._lastEnd.copy(this._scratchEnd);
      }

      this.line.visible = true;
    }
  }

  /**
   * Dispose all GPU resources and remove the line from the scene.
   * Safe to call multiple times or when no line has been created.
   */
  cleanup(): void {
    if (this.line && this.attachedScene) {
      this.attachedScene.remove(this.line);
    }
    if (this.lineGeo) {
      this.lineGeo.dispose();
      this.lineGeo = null;
    }
    if (this.lineMat) {
      this.lineMat.dispose();
      this.lineMat = null;
    }
    this.line = null;
    this.attachedScene = null;
    // Reset cached endpoints so the first update after a new encounter rebuilds the buffer.
    this._lastStart.set(NaN, NaN, NaN);
    this._lastEnd.set(NaN, NaN, NaN);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** Hide the line without disposing GPU resources (reused next frame). */
  private hide(): void {
    if (this.line) {
      this.line.visible = false;
    }
  }

  /**
   * Lazily create the `THREE.Line` with `LineDashedMaterial` and add it to the
   * scene. Subsequent calls are no-ops unless the scene reference changes.
   */
  private ensureLine(scene: THREE.Scene, color: number): void {
    if (this.line && this.attachedScene === scene) return;

    // Remove from any prior scene if the scene reference changed.
    if (this.line && this.attachedScene && this.attachedScene !== scene) {
      this.attachedScene.remove(this.line);
    }

    if (!this.line) {
      // Placeholder geometry with two coincident points; updated in update().
      this.lineGeo = new THREE.BufferGeometry();
      const placeholder = new Float32Array([0, 0, 0, 0, 0, 0]);
      this.lineGeo.setAttribute('position', new THREE.BufferAttribute(placeholder, 3));

      this.lineMat = new THREE.LineDashedMaterial({
        color,
        dashSize: TOWER_FIRE_ZONE_PREVIEW_CONFIG.dashSize,
        gapSize: TOWER_FIRE_ZONE_PREVIEW_CONFIG.gapSize,
        transparent: true,
        opacity: TOWER_FIRE_ZONE_PREVIEW_CONFIG.opacity,
        depthWrite: false,
      });

      this.line = new THREE.Line(this.lineGeo, this.lineMat);
      this.line.visible = false;
      this.line.renderOrder = 1; // render on top of tiles, same as AimLineService
    }

    scene.add(this.line);
    this.attachedScene = scene;
  }
}
