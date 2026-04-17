import { Injectable } from '@angular/core';
import * as THREE from 'three';

import { TowerType } from '../models/tower.model';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { SceneService } from './scene.service';
import { GameBoardService } from '../game-board.service';
import { disposeMaterial } from '../utils/three-utils';

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
    this.meshRegistry.towerMeshes.set(`${row}-${col}`, mesh);
    this.sceneService.getScene().add(mesh);
    this.meshRegistry.rebuildTowerChildrenArray();
    return mesh;
  }

  /**
   * Remove a tower mesh from the scene, dispose its geometry and materials,
   * delete it from the registry, and rebuild the tower children array.
   * No-op if the key is not found in the registry.
   */
  removeMesh(key: string): void {
    const group = this.meshRegistry.towerMeshes.get(key);
    if (!group) return;
    const scene = this.sceneService.getScene();
    scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        disposeMaterial(child.material);
      }
    });
    this.meshRegistry.towerMeshes.delete(key);
    this.meshRegistry.rebuildTowerChildrenArray();
  }
}
