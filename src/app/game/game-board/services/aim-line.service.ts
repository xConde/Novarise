import { Injectable, OnDestroy, Optional } from '@angular/core';
import * as THREE from 'three';

import { TOWER_CONFIGS, TowerType } from '../models/tower.model';
import { AIM_LINE_CONFIG } from '../constants/tower-aim.constants';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TowerSelectionService } from './tower-selection.service';
import { SceneService } from './scene.service';

/**
 * Draws a single thin cylinder from the selected tower to its current aim
 * target. Visible only when a tower is selected AND that tower has an active
 * preview target; hidden otherwise.
 *
 * One mesh instance is reused each frame — its geometry is recreated only when
 * the start or end position changes significantly, so there is no per-frame
 * geometry allocation under steady aim.
 *
 * Component-scoped — provided in `GameBoardComponent.providers`.
 * Disposed via `cleanup()`, called from `GameSessionService.cleanupScene()`.
 * Also implements `OnDestroy` as a safety net for route-change teardown.
 */
@Injectable()
export class AimLineService implements OnDestroy {
  private lineMesh: THREE.Mesh | null = null;
  private lineGeo: THREE.CylinderGeometry | null = null;
  private lineMat: THREE.MeshBasicMaterial | null = null;

  /** Scene the line mesh has been added to; used for safe removal. */
  private attachedScene: THREE.Scene | null = null;

  /**
   * Cached endpoints from the last geometry build. When the new start/end
   * are within `AIM_LINE_CONFIG.rebuildThreshold` of the cached values, the
   * geometry is reused as-is — only position/quaternion are updated. This
   * prevents a per-frame CylinderGeometry allocation + GPU upload when the
   * tower and target are both stationary (the common case during planning).
   */
  private lastStart: THREE.Vector3 | null = null;
  private lastEnd: THREE.Vector3 | null = null;

  /**
   * Persistent scratch Vector3s for the hot animation path — prevents
   * allocating new Vector3 instances on every call to update().
   */
  private readonly _scratchTowerWorld = new THREE.Vector3();
  private readonly _scratchStart = new THREE.Vector3();
  private readonly _scratchEnd = new THREE.Vector3();
  private readonly _scratchMid = new THREE.Vector3();
  private readonly _scratchDir = new THREE.Vector3();
  private readonly _scratchUp = new THREE.Vector3(0, 1, 0);

  constructor(
    // @Optional() so flat test beds that don't provide these still compile.
    @Optional() private meshRegistry?: BoardMeshRegistryService,
    @Optional() private selectionService?: TowerSelectionService,
    @Optional() private sceneService?: SceneService,
  ) {}

  /** Angular lifecycle hook — delegates to cleanup() for route-change safety. */
  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Called once per animation frame after `tickAim`. Reads the currently
   * selected tower and its `currentAimTarget` from userData; repositions
   * (or hides) the aim-line cylinder accordingly.
   *
   * When `reduceMotion` is true the line is hidden — a static decorative
   * element that implies movement direction is still a visual affordance
   * some motion-sensitive users prefer to suppress.
   *
   * @param reduceMotion  When true, hide the line regardless of selection state.
   */
  update(reduceMotion = false): void {
    if (!this.sceneService || !this.selectionService || !this.meshRegistry) {
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

    const target = towerGroup.userData['currentAimTarget'] as
      | { position: { x: number; y: number; z: number } }
      | null
      | undefined;

    if (!target) {
      this.hide();
      return;
    }

    // Compute world position of the tower into the persistent scratch vector.
    towerGroup.getWorldPosition(this._scratchTowerWorld);

    this._scratchStart.set(
      this._scratchTowerWorld.x,
      this._scratchTowerWorld.y + AIM_LINE_CONFIG.yOffset,
      this._scratchTowerWorld.z,
    );
    this._scratchEnd.set(
      target.position.x,
      this._scratchTowerWorld.y + AIM_LINE_CONFIG.yOffset,
      target.position.z,
    );

    const length = this._scratchStart.distanceTo(this._scratchEnd);
    // Degenerate case: tower and target at same position — hide to avoid NaN.
    if (length < 0.001) {
      this.hide();
      return;
    }

    const color = TOWER_CONFIGS[selectedTower.type as TowerType]?.color ?? 0xffffff;

    this.ensureMesh(scene, color);

    if (this.lineMesh && this.lineGeo && this.lineMat) {
      // Update color in case selection changed tower type.
      this.lineMat.color.setHex(color);

      // Rebuild geometry only when an endpoint has moved beyond the rebuild
      // threshold. Under steady aim the tower and target are stationary across
      // many frames — reusing the existing geometry avoids a per-frame
      // CylinderGeometry allocation and GPU buffer upload (Finding D-1).
      const needsRebuild =
        !this.lastStart ||
        !this.lastEnd ||
        this._scratchStart.distanceTo(this.lastStart) > AIM_LINE_CONFIG.rebuildThreshold ||
        this._scratchEnd.distanceTo(this.lastEnd) > AIM_LINE_CONFIG.rebuildThreshold;

      if (needsRebuild) {
        this.lineGeo.dispose();
        this.lineGeo = new THREE.CylinderGeometry(
          AIM_LINE_CONFIG.radius,
          AIM_LINE_CONFIG.radius,
          length,
          AIM_LINE_CONFIG.segments,
        );
        this.lineMesh.geometry = this.lineGeo;
        if (!this.lastStart) this.lastStart = this._scratchStart.clone();
        else this.lastStart.copy(this._scratchStart);
        if (!this.lastEnd) this.lastEnd = this._scratchEnd.clone();
        else this.lastEnd.copy(this._scratchEnd);
      }

      // Always recompute position/quaternion — transform is cheap, geometry is not.
      this._scratchMid.copy(this._scratchStart).lerp(this._scratchEnd, 0.5);
      this.lineMesh.position.copy(this._scratchMid);

      // CylinderGeometry's axis is +Y; align it to the aim direction.
      this._scratchDir.copy(this._scratchEnd).sub(this._scratchStart).normalize();
      this.lineMesh.quaternion.setFromUnitVectors(this._scratchUp, this._scratchDir);

      this.lineMesh.visible = true;
    }
  }

  /**
   * Dispose all GPU resources and remove the line mesh from the scene.
   * Safe to call multiple times or when no mesh has been created.
   */
  cleanup(): void {
    if (this.lineMesh && this.attachedScene) {
      this.attachedScene.remove(this.lineMesh);
    }
    if (this.lineGeo) {
      this.lineGeo.dispose();
      this.lineGeo = null;
    }
    if (this.lineMat) {
      this.lineMat.dispose();
      this.lineMat = null;
    }
    this.lineMesh = null;
    this.attachedScene = null;
    // Clear cached endpoints so a fresh encounter does not skip the first rebuild.
    this.lastStart = null;
    this.lastEnd = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** Hide the line without disposing GPU resources (reused next frame). */
  private hide(): void {
    if (this.lineMesh) {
      this.lineMesh.visible = false;
    }
  }

  /**
   * Lazily create the cylinder mesh and add it to the scene on first call.
   * Subsequent calls are no-ops unless the scene reference changes.
   */
  private ensureMesh(scene: THREE.Scene, color: number): void {
    if (this.lineMesh && this.attachedScene === scene) return;

    // Remove from any prior scene if scene reference changed.
    if (this.lineMesh && this.attachedScene && this.attachedScene !== scene) {
      this.attachedScene.remove(this.lineMesh);
    }

    if (!this.lineMesh) {
      this.lineGeo = new THREE.CylinderGeometry(
        AIM_LINE_CONFIG.radius,
        AIM_LINE_CONFIG.radius,
        1, // placeholder length; resized in update()
        AIM_LINE_CONFIG.segments,
      );
      this.lineMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: AIM_LINE_CONFIG.opacity,
        depthWrite: false,
      });
      this.lineMesh = new THREE.Mesh(this.lineGeo, this.lineMat);
      this.lineMesh.visible = false;
      this.lineMesh.renderOrder = 1; // render on top of tiles
    }

    scene.add(this.lineMesh);
    this.attachedScene = scene;
  }
}
