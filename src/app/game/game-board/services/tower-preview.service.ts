import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { TowerType, TOWER_CONFIGS } from '../models/tower.model';
import { PREVIEW_CONFIG } from '../constants/preview.constants';
import { BOARD_CONFIG } from '../constants/board.constants';
import { gridToWorld } from '../utils/coordinate-utils';
import { TowerMeshFactoryService } from './tower-mesh-factory.service';
import { ElevationService } from './elevation.service';

/**
 * UX-3 + UX-4: ghost mesh now uses the REAL tower mesh (via
 * TowerMeshFactoryService) with each child material swapped for a
 * translucent BasicMaterial. Players see exactly what they'll get on
 * placement — no cone/box stand-in.
 *
 * UX-4 alignment: ghost position now respects tile elevation via
 * ElevationService, mirroring the actual tower placement logic in
 * TowerMeshLifecycleService.placeMesh.
 */
type PreviewState = {
  towerType: TowerType;
  /** The real tower group from TowerMeshFactoryService. */
  ghostGroup: THREE.Group;
  /** Translucent materials owned by THIS service (per-ghost). Disposed on cleanup. */
  ghostMaterials: THREE.MeshBasicMaterial[];
} | null;

@Injectable()
export class TowerPreviewService {
  private previewState: PreviewState = null;
  private boardWidth = 10;
  private boardHeight = 10;

  constructor(
    @Optional() private readonly towerFactory?: TowerMeshFactoryService,
    @Optional() private readonly elevationService?: ElevationService,
  ) {}

  setBoardSize(width: number, height: number): void {
    this.boardWidth = width;
    this.boardHeight = height;
  }

  showPreview(
    towerType: TowerType,
    row: number,
    col: number,
    isValid: boolean,
    scene: THREE.Scene
  ): void {
    const { x: worldX, z: worldZ } = gridToWorld(row, col, this.boardWidth, this.boardHeight, BOARD_CONFIG.tileSize);
    const elevation = this.elevationService?.getElevation(row, col) ?? 0;
    // Match the real placement Y in TowerMeshLifecycleService.placeMesh:
    // tower group sits at `elevation + tileHeight` (UX-4 alignment fix).
    const placementY = elevation + BOARD_CONFIG.tileHeight;

    if (this.previewState?.towerType !== towerType) {
      this.removeMeshesFromScene(scene);
      this.disposeMeshes();
      this.previewState = this.createPreviewMeshes(towerType, scene);
    } else if (this.previewState && !this.previewState.ghostGroup.parent) {
      // Same type but mesh was removed by hidePreview — re-add.
      scene.add(this.previewState.ghostGroup);
    }

    const { ghostGroup, ghostMaterials } = this.previewState!;
    const ghostColor = isValid
      ? TOWER_CONFIGS[towerType].color
      : PREVIEW_CONFIG.invalidColor;
    for (const mat of ghostMaterials) {
      mat.color.setHex(ghostColor);
    }
    ghostGroup.position.set(worldX, placementY, worldZ);
  }

  hidePreview(scene: THREE.Scene): void {
    this.removeMeshesFromScene(scene);
  }

  cleanup(scene?: THREE.Scene): void {
    if (scene) this.removeMeshesFromScene(scene);
    this.disposeMeshes();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createPreviewMeshes(towerType: TowerType, scene: THREE.Scene): NonNullable<PreviewState> {
    const ghostGroup = this.towerFactory
      ? this.towerFactory.createTowerMesh(0, 0, towerType, this.boardWidth, this.boardHeight)
      : this.fallbackGhostGroup(towerType);

    // Replace each child mesh's material with a translucent ghost material.
    // Geometries stay registry-owned (sprint 12) — we don't touch them.
    // Materials we install here are per-ghost; disposed on cleanup.
    const ghostMaterials: THREE.MeshBasicMaterial[] = [];
    const baseColor = TOWER_CONFIGS[towerType].color;
    ghostGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: PREVIEW_CONFIG.ghostOpacity,
          depthWrite: false,
        });
        child.material = mat;
        // Ghost is translucent — don't cast shadows.
        child.castShadow = false;
        child.receiveShadow = false;
        ghostMaterials.push(mat);
      }
    });

    scene.add(ghostGroup);
    return { towerType, ghostGroup, ghostMaterials };
  }

  /**
   * Fallback when TowerMeshFactoryService isn't injected (flat test beds).
   * Returns a minimal Group with a single placeholder cylinder so existing
   * specs that don't wire the factory still produce a renderable preview.
   */
  private fallbackGhostGroup(_towerType: TowerType): THREE.Group {
    const group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 1, 8);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return group;
  }

  private removeMeshesFromScene(scene: THREE.Scene): void {
    if (!this.previewState) return;
    scene.remove(this.previewState.ghostGroup);
  }

  private disposeMeshes(): void {
    if (!this.previewState) return;
    // Dispose only the per-ghost materials we created. Geometries are
    // registry-owned (when factory is present) or single-use fallback.
    for (const mat of this.previewState.ghostMaterials) {
      mat.dispose();
    }
    // For the fallback path (no factory), the geometry is a one-off — dispose it.
    // For the factory path, geometries are registry-owned and must NOT be disposed.
    if (!this.towerFactory) {
      this.previewState.ghostGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    }
    this.previewState = null;
  }
}
