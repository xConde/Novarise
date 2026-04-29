import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { PREVIEW_CONFIG } from '../constants/preview.constants';
import { PREVIEW_GHOST_CONFIG, PREVIEW_GHOST_DEFAULT } from '../constants/ui.constants';
import { BOARD_CONFIG } from '../constants/board.constants';
import { gridToWorld } from '../utils/coordinate-utils';

/**
 * Tracks which tower type the current preview ghost was built for.
 *
 * UX-1 (sprint 32): the inline range ring this service used to create has
 * been removed — RangeVisualizationService.showForPosition is now the
 * sole owner of placement-preview range visualisation. This service owns
 * only the ghost-tower mesh.
 */
type PreviewState = {
  towerType: TowerType;
  ghostMesh: THREE.Mesh;
  yCenter: number;
} | null;

@Injectable()
export class TowerPreviewService {
  private previewState: PreviewState = null;

  /** Set board dimensions — used by gridToWorld() to centre the ghost. */
  setBoardSize(width: number, height: number): void {
    this.boardWidth = width;
    this.boardHeight = height;
  }

  private boardWidth = 10;
  private boardHeight = 10;

  /**
   * Shows a ghost tower at (row, col).
   * Reuses the existing mesh when only position/validity changes;
   * recreates it when the tower type changes.
   */
  showPreview(
    towerType: TowerType,
    row: number,
    col: number,
    isValid: boolean,
    scene: THREE.Scene
  ): void {
    const { x: worldX, z: worldZ } = gridToWorld(row, col, this.boardWidth, this.boardHeight, BOARD_CONFIG.tileSize);

    if (this.previewState?.towerType !== towerType) {
      this.removeMeshesFromScene(scene);
      this.disposeMeshes();
      this.previewState = this.createPreviewMeshes(towerType, scene);
    } else if (this.previewState && !this.previewState.ghostMesh.parent) {
      // Same tower type but mesh was removed by hidePreview — re-add.
      scene.add(this.previewState.ghostMesh);
    }

    const { ghostMesh } = this.previewState!;

    const ghostColor = isValid
      ? TOWER_CONFIGS[towerType].color
      : PREVIEW_CONFIG.invalidColor;
    (ghostMesh.material as THREE.MeshBasicMaterial).color.setHex(ghostColor);

    ghostMesh.position.set(worldX, this.previewState!.yCenter, worldZ);
  }

  hidePreview(scene: THREE.Scene): void {
    this.removeMeshesFromScene(scene);
  }

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

    const { geometry, yCenter } = this.createGhostGeometry(towerType);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: PREVIEW_CONFIG.ghostOpacity,
    });
    const ghostMesh = new THREE.Mesh(geometry, material);
    scene.add(ghostMesh);

    return { towerType, ghostMesh, yCenter };
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
  }

  private disposeMeshes(): void {
    if (!this.previewState) return;
    this.previewState.ghostMesh.geometry.dispose();
    (this.previewState.ghostMesh.material as THREE.MeshBasicMaterial).dispose();
    this.previewState = null;
  }
}
