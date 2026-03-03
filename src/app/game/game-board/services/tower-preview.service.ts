import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType, TOWER_CONFIGS, getEffectiveStats } from '../models/tower.model';
import { PREVIEW_CONFIG } from '../constants/preview.constants';

/** Ghost tower box geometry half-height (centered at y=0.5 for a 1-unit tall box). */
const GHOST_BOX_SIZE = 0.6;

/** Y-center of the ghost tower mesh (sits on the tile surface). */
const GHOST_MESH_Y = 0.5;

/** Tracks which tower type the current preview meshes were built for. */
type PreviewState = {
  towerType: TowerType;
  ghostMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
} | null;

@Injectable()
export class TowerPreviewService {
  private previewState: PreviewState = null;

  /**
   * Shows a ghost tower and range ring at (row, col).
   * Reuses existing meshes when only the position or validity changes;
   * recreates meshes when the tower type changes.
   */
  showPreview(
    towerType: TowerType,
    row: number,
    col: number,
    isValid: boolean,
    scene: THREE.Scene
  ): void {
    const worldX = col;
    const worldZ = row;

    if (this.previewState?.towerType !== towerType) {
      this.removeMeshesFromScene(scene);
      this.disposeMeshes();
      this.previewState = this.createPreviewMeshes(towerType, scene);
    }

    const { ghostMesh, ringMesh } = this.previewState!;

    const ghostColor = isValid
      ? TOWER_CONFIGS[towerType].color
      : PREVIEW_CONFIG.invalidColor;
    (ghostMesh.material as THREE.MeshBasicMaterial).color.setHex(ghostColor);

    ghostMesh.position.set(worldX, GHOST_MESH_Y, worldZ);
    ringMesh.position.set(worldX, PREVIEW_CONFIG.groundOffset, worldZ);
  }

  /** Removes the preview meshes from the scene without disposing them. */
  hidePreview(scene: THREE.Scene): void {
    this.removeMeshesFromScene(scene);
  }

  /** Disposes all Three.js resources and clears internal state. */
  cleanup(): void {
    this.disposeMeshes();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createPreviewMeshes(towerType: TowerType, scene: THREE.Scene): NonNullable<PreviewState> {
    const color = TOWER_CONFIGS[towerType].color;
    const range = getEffectiveStats(towerType, 1).range;

    // Ghost tower — simple box
    const geometry = new THREE.BoxGeometry(GHOST_BOX_SIZE, 1, GHOST_BOX_SIZE);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: PREVIEW_CONFIG.ghostOpacity,
    });
    const ghostMesh = new THREE.Mesh(geometry, material);
    scene.add(ghostMesh);

    // Range ring
    const innerRadius = range - PREVIEW_CONFIG.rangeRingWidth;
    const outerRadius = range;
    const ringGeometry = new THREE.RingGeometry(
      innerRadius,
      outerRadius,
      PREVIEW_CONFIG.rangeRingSegments
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: PREVIEW_CONFIG.rangeRingColor,
      transparent: true,
      opacity: PREVIEW_CONFIG.rangeRingOpacity,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotateX(-Math.PI / 2);
    scene.add(ringMesh);

    return { towerType, ghostMesh, ringMesh };
  }

  private removeMeshesFromScene(scene: THREE.Scene): void {
    if (!this.previewState) return;
    scene.remove(this.previewState.ghostMesh);
    scene.remove(this.previewState.ringMesh);
  }

  private disposeMeshes(): void {
    if (!this.previewState) return;

    this.previewState.ghostMesh.geometry.dispose();
    (this.previewState.ghostMesh.material as THREE.MeshBasicMaterial).dispose();

    this.previewState.ringMesh.geometry.dispose();
    (this.previewState.ringMesh.material as THREE.MeshBasicMaterial).dispose();

    this.previewState = null;
  }
}
