import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { RANGE_PREVIEW_CONFIG, SELECTION_RING_CONFIG } from '../constants/ui.constants';
import { PlacedTower, getEffectiveStats } from '../models/tower.model';
import { disposeMesh } from '../utils/three-utils';

@Injectable()
export class RangeVisualizationService {
  private rangePreviewMesh: THREE.Mesh | null = null;
  private selectionRingMesh: THREE.Mesh | null = null;
  private rangeRingMeshes: THREE.Mesh[] = [];

  /** Show range ring + selection ring for a placed tower. */
  showForTower(
    tower: PlacedTower,
    boardWidth: number,
    boardHeight: number,
    tileSize: number,
    scene: THREE.Scene
  ): void {
    this.removePreview(scene);

    const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
    const x = (tower.col - boardWidth / 2) * tileSize;
    const z = (tower.row - boardHeight / 2) * tileSize;

    // Range ring
    this.rangePreviewMesh = this.createRangeRing(stats.range, stats.color, RANGE_PREVIEW_CONFIG.opacity, x, z);
    scene.add(this.rangePreviewMesh);

    // Selection ring — tight ring around the tower base to indicate it's selected
    const selectionGeometry = new THREE.RingGeometry(
      SELECTION_RING_CONFIG.radius - SELECTION_RING_CONFIG.thickness,
      SELECTION_RING_CONFIG.radius,
      SELECTION_RING_CONFIG.segments
    );
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: SELECTION_RING_CONFIG.color,
      transparent: true,
      opacity: SELECTION_RING_CONFIG.opacity,
      side: THREE.DoubleSide,
    });
    this.selectionRingMesh = new THREE.Mesh(selectionGeometry, selectionMaterial);
    this.selectionRingMesh.rotation.x = -Math.PI / 2;
    this.selectionRingMesh.position.set(x, RANGE_PREVIEW_CONFIG.yPosition + SELECTION_RING_CONFIG.yOffset, z);
    scene.add(this.selectionRingMesh);
  }

  /** Remove the single-tower range preview and selection ring. */
  removePreview(scene: THREE.Scene): void {
    if (this.rangePreviewMesh) {
      scene.remove(this.rangePreviewMesh);
      disposeMesh(this.rangePreviewMesh);
      this.rangePreviewMesh = null;
    }
    if (this.selectionRingMesh) {
      scene.remove(this.selectionRingMesh);
      disposeMesh(this.selectionRingMesh);
      this.selectionRingMesh = null;
    }
  }

  /**
   * Toggle range rings for all placed towers.
   * Returns the new toggle state (true = rings now visible, false = rings removed).
   */
  toggleAllRanges(
    showAllRanges: boolean,
    placedTowers: Map<string, PlacedTower>,
    boardWidth: number,
    boardHeight: number,
    tileSize: number,
    scene: THREE.Scene
  ): boolean {
    const newState = !showAllRanges;

    // Remove existing range rings
    for (const mesh of this.rangeRingMeshes) {
      scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.rangeRingMeshes = [];

    if (newState) {
      placedTowers.forEach(tower => {
        const stats = getEffectiveStats(tower.type, tower.level, tower.specialization);
        const worldX = (tower.col - boardWidth / 2) * tileSize;
        const worldZ = (tower.row - boardHeight / 2) * tileSize;
        const ring = this.createRangeRing(
          stats.range,
          RANGE_PREVIEW_CONFIG.allRangesColor,
          RANGE_PREVIEW_CONFIG.opacity * RANGE_PREVIEW_CONFIG.allRangesOpacityScale,
          worldX,
          worldZ
        );
        scene.add(ring);
        this.rangeRingMeshes.push(ring);
      });
    }

    return newState;
  }

  /** Remove all range ring meshes. Used during cleanup. */
  cleanup(scene: THREE.Scene): void {
    this.removePreview(scene);
    for (const mesh of this.rangeRingMeshes) {
      scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.rangeRingMeshes = [];
  }

  private createRangeRing(radius: number, color: number, opacity: number, x: number, z: number): THREE.Mesh {
    const geometry = new THREE.RingGeometry(
      radius - RANGE_PREVIEW_CONFIG.ringThickness,
      radius,
      RANGE_PREVIEW_CONFIG.segments
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, RANGE_PREVIEW_CONFIG.yPosition, z);
    return ring;
  }
}
