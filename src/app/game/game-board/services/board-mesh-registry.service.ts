import { Injectable } from '@angular/core';
import * as THREE from 'three';

/**
 * Owns all mesh maps for the game board — tiles, towers, and grid lines.
 * Extracted from GameBoardComponent (Decomposition Sprint 1).
 *
 * Other services inject this to read/write mesh state without going through
 * the component. The component no longer owns these maps.
 */
@Injectable()
export class BoardMeshRegistryService {
  readonly tileMeshes = new Map<string, THREE.Mesh>();
  readonly towerMeshes = new Map<string, THREE.Group>();
  gridLines: THREE.Group | null = null;

  private tileMeshArray: THREE.Mesh[] = [];
  private towerChildrenArray: THREE.Object3D[] = [];

  getTileMeshArray(): readonly THREE.Mesh[] { return this.tileMeshArray; }
  getTowerChildrenArray(): readonly THREE.Object3D[] { return this.towerChildrenArray; }

  rebuildTileMeshArray(): void {
    this.tileMeshArray = Array.from(this.tileMeshes.values());
  }

  rebuildTowerChildrenArray(): void {
    // Collect all children of tower groups for raycasting
    const children: THREE.Object3D[] = [];
    this.towerMeshes.forEach(group => {
      group.children.forEach(child => children.push(child));
    });
    this.towerChildrenArray = children;
  }

  clear(): void {
    this.tileMeshes.clear();
    this.towerMeshes.clear();
    this.gridLines = null;
    this.tileMeshArray = [];
    this.towerChildrenArray = [];
  }
}
