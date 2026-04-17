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

  /**
   * Swap the tile mesh stored at (row, col) with `newMesh`.
   *
   * The caller is responsible for:
   *  - removing the old mesh from the scene
   *  - disposing the old mesh's geometry and material
   *  - adding `newMesh` to the scene
   *
   * This method only updates the internal map entry and rebuilds the flat
   * array consumed by the raycaster. Matches the tower-mesh-lifecycle pattern
   * where the component owns scene add/remove and the registry owns the map.
   */
  replaceTileMesh(row: number, col: number, newMesh: THREE.Mesh): void {
    const key = `${row}-${col}`;
    this.tileMeshes.set(key, newMesh);
    this.rebuildTileMeshArray();
  }

  clear(): void {
    this.tileMeshes.clear();
    this.towerMeshes.clear();
    this.gridLines = null;
    this.tileMeshArray = [];
    this.towerChildrenArray = [];
  }
}
