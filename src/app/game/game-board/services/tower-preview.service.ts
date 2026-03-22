import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType, TOWER_CONFIGS, getEffectiveStats } from '../models/tower.model';
import { PREVIEW_CONFIG } from '../constants/preview.constants';
import { PREVIEW_GHOST_CONFIG, PREVIEW_GHOST_DEFAULT } from '../constants/ui.constants';

/** Tracks which tower type the current preview meshes were built for. */
type PreviewState = {
  towerType: TowerType;
  ghostMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  yCenter: number;
} | null;

@Injectable()
export class TowerPreviewService {
  private previewState: PreviewState = null;

  /**
   * Shows a ghost tower and range ring at (row, col).
   * Reuses existing meshes when only the position or validity changes;
   * recreates meshes when the tower type changes.
   */
  /** Set board dimensions so the range ring can be clipped at edges. */
  setBoardSize(width: number, height: number): void {
    this.boardWidth = width;
    this.boardHeight = height;
  }

  private boardWidth = 10;
  private boardHeight = 10;

  showPreview(
    towerType: TowerType,
    row: number,
    col: number,
    isValid: boolean,
    scene: THREE.Scene
  ): void {
    // Convert grid coords to world-space (board is centered at origin)
    const worldX = (col - this.boardWidth / 2) * 1; // tileSize = 1
    const worldZ = (row - this.boardHeight / 2) * 1;

    if (this.previewState?.towerType !== towerType) {
      this.removeMeshesFromScene(scene);
      this.disposeMeshes();
      this.previewState = this.createPreviewMeshes(towerType, scene);
    } else if (this.previewState) {
      // Same tower type but meshes may have been removed by hidePreview — re-add
      if (!this.previewState.ghostMesh.parent) {
        scene.add(this.previewState.ghostMesh);
      }
      if (!this.previewState.ringMesh.parent) {
        scene.add(this.previewState.ringMesh);
      }
    }

    const { ghostMesh, ringMesh } = this.previewState!;

    const ghostColor = isValid
      ? TOWER_CONFIGS[towerType].color
      : PREVIEW_CONFIG.invalidColor;
    (ghostMesh.material as THREE.MeshBasicMaterial).color.setHex(ghostColor);

    ghostMesh.position.set(worldX, this.previewState!.yCenter, worldZ);
    ringMesh.position.set(worldX, PREVIEW_CONFIG.groundOffset, worldZ);
  }

  /** Removes the preview meshes from the scene without disposing them. */
  hidePreview(scene: THREE.Scene): void {
    this.removeMeshesFromScene(scene);
  }

  /** Disposes all Three.js resources and clears internal state. Removes meshes from scene if provided. */
  cleanup(scene?: THREE.Scene): void {
    if (scene) {
      this.removeMeshesFromScene(scene);
    }
    this.disposeMeshes();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createPreviewMeshes(towerType: TowerType, scene: THREE.Scene): NonNullable<PreviewState> {
    const color = TOWER_CONFIGS[towerType].color;
    const range = getEffectiveStats(towerType, 1).range;

    // Ghost tower — type-specific silhouette
    const { geometry, yCenter } = this.createGhostGeometry(towerType);
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
    // Clipping planes keep ring within board world-space bounds
    // Board is centered: x ∈ [-w/2 - 0.5, w/2 - 0.5], z ∈ [-h/2 - 0.5, h/2 - 0.5]
    const halfW = this.boardWidth / 2;
    const halfH = this.boardHeight / 2;
    const clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), halfW + 0.5),     // x >= -halfW - 0.5
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfW - 0.5),    // x <= halfW - 0.5
      new THREE.Plane(new THREE.Vector3(0, 0, 1), halfH + 0.5),     // z >= -halfH - 0.5
      new THREE.Plane(new THREE.Vector3(0, 0, -1), halfH - 0.5),    // z <= halfH - 0.5
    ];

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: PREVIEW_CONFIG.rangeRingColor,
      transparent: true,
      opacity: PREVIEW_CONFIG.rangeRingOpacity,
      side: THREE.DoubleSide,
      clippingPlanes,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotateX(-Math.PI / 2);
    scene.add(ringMesh);

    return { towerType, ghostMesh, ringMesh, yCenter };
  }

  private createGhostGeometry(towerType: TowerType): { geometry: THREE.BufferGeometry; yCenter: number } {
    const config = PREVIEW_GHOST_CONFIG[towerType] ?? PREVIEW_GHOST_DEFAULT;
    const geometry = this.buildGeometry(config.type, config.args);
    return { geometry, yCenter: config.yCenter };
  }

  private buildGeometry(type: string, args: readonly number[]): THREE.BufferGeometry {
    switch (type) {
      case 'cone':     return new THREE.ConeGeometry(...(args as [number, number, number]));
      case 'sphere':   return new THREE.SphereGeometry(...(args as [number, number, number, number, number, number, number]));
      case 'cylinder': return new THREE.CylinderGeometry(...(args as [number, number, number, number]));
      case 'box':      return new THREE.BoxGeometry(...(args as [number, number, number]));
      default:         return new THREE.BoxGeometry(...(PREVIEW_GHOST_DEFAULT.args as [number, number, number]));
    }
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
