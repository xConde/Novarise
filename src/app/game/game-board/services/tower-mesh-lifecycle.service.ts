import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';

import { TowerType } from '../models/tower.model';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { SceneService } from './scene.service';
import { GameBoardService } from '../game-board.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { BOARD_CONFIG } from '../constants/board.constants';
import { buildDisposeProtect, disposeGroup } from '../utils/three-utils';

/**
 * Consolidates the repeated mesh creation+registration and mesh disposal patterns
 * that were duplicated across tryPlaceTower(), sellTower(), and salvageLastTower().
 *
 * Component-scoped — provided in GameBoardComponent.providers.
 */
@Injectable()
export class TowerMeshLifecycleService {
  constructor(
    private towerMeshFactory: TowerMeshFactoryService,
    private meshRegistry: BoardMeshRegistryService,
    private sceneService: SceneService,
    private gameBoardService: GameBoardService,
    @Optional() private geometryRegistry?: GeometryRegistryService,
    @Optional() private materialRegistry?: MaterialRegistryService,
  ) {}

  /**
   * Create a tower mesh, register it in the mesh registry, add it to the scene,
   * and rebuild the tower children array. Returns the created mesh group.
   */
  placeMesh(row: number, col: number, type: TowerType): THREE.Group {
    const mesh = this.towerMeshFactory.createTowerMesh(
      row,
      col,
      type,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
    );
    // Tower factory places the group at fixed tileHeight. If the underlying
    // tile is elevated (Highground archetype), lift the group to sit on top
    // of the raised tile. Disposal-neutral — identity-stable mesh.
    const board = this.gameBoardService.getGameBoard();
    const tileElevation = board?.[row]?.[col]?.elevation ?? 0;
    if (tileElevation !== 0) {
      mesh.position.y = tileElevation + BOARD_CONFIG.tileHeight;
    }
    this.meshRegistry.towerMeshes.set(`${row}-${col}`, mesh);
    this.sceneService.getScene().add(mesh);
    this.meshRegistry.rebuildTowerChildrenArray();
    return mesh;
  }

  /**
   * Remove a tower mesh from the scene, dispose its geometry and materials,
   * delete it from the registry, and rebuild the tower children array.
   * No-op if the key is not found in the registry.
   *
   * When `animated` is true (sell path), the mesh is NOT immediately disposed.
   * Instead `userData['selling']` and `userData['sellingStart']` are written so
   * `TowerAnimationService.tickSellAnimations` can drive the shrink-and-fade over
   * SELL_ANIM_CONFIG.durationSec and then call `removeMesh(key, false)` on
   * expiry. The group stays in the registry (and the scene) during the animation.
   *
   * All other call sites (encounter teardown, restart, salvage) pass the default
   * `animated = false` and behave exactly as before — synchronous, immediate disposal.
   */
  removeMesh(key: string, animated = false): void {
    const group = this.meshRegistry.towerMeshes.get(key);
    if (!group) return;

    if (animated && !group.userData['selling']) {
      // Mark for deferred animation; tickSellAnimations will call removeMesh(key, false).
      group.userData['selling'] = true;
      group.userData['sellingStart'] = performance.now() / 1000;
      // Rebuild children array so the selling group is still tracked by animation
      // ticks but combat service no longer fires at it (caller already deregisters).
      this.meshRegistry.rebuildTowerChildrenArray();
      return;
    }

    // Synchronous disposal (animated=false, or animation already in progress and
    // encounter cleanup wants it gone NOW — clear the selling flag first so no
    // re-entry occurs).
    group.userData['selling'] = false;
    group.userData['sellingStart'] = undefined;
    disposeGroup(group, this.sceneService.getScene(),
      buildDisposeProtect(this.geometryRegistry, this.materialRegistry));
    this.meshRegistry.towerMeshes.delete(key);
    this.meshRegistry.rebuildTowerChildrenArray();
  }
}
