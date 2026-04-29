import { Injectable, Optional } from '@angular/core';
import * as THREE from 'three';
import { RANGE_PREVIEW_CONFIG, SELECTION_RING_CONFIG } from '../constants/ui.constants';
import { PlacedTower, TowerType, TOWER_CONFIGS, getEffectiveStats } from '../models/tower.model';
import { disposeMesh } from '../utils/three-utils';
import { gridToWorld } from '../utils/coordinate-utils';
import { ElevationService } from './elevation.service';

@Injectable()
export class RangeVisualizationService {
  private rangePreviewMesh: THREE.Mesh | null = null;
  private hoverRangeMesh: THREE.Mesh | null = null;
  private selectionRingMesh: THREE.Mesh | null = null;
  private rangeRingMeshes: THREE.Mesh[] = [];

  /**
   * @Optional() — older flat test beds don't register ElevationService.
   * When absent, all elevation reads return 0 and the rings sit at the
   * default ground-tile Y. Production wires it via GameModule.
   */
  constructor(@Optional() private readonly elevationService?: ElevationService) {}

  private elevationOf(row: number, col: number): number {
    return this.elevationService?.getElevation(row, col) ?? 0;
  }

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
    const { x, z } = gridToWorld(tower.row, tower.col, boardWidth, boardHeight, tileSize);
    const elevation = this.elevationOf(tower.row, tower.col);

    // Range ring — Y elevated with the tile so it doesn't bury inside
    // raised Highground tiles (UX-2 red-team fix).
    this.rangePreviewMesh = this.createRangeRing(stats.range, stats.color, RANGE_PREVIEW_CONFIG.opacity, x, z, elevation);
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
    this.selectionRingMesh.position.set(x, RANGE_PREVIEW_CONFIG.yPosition + SELECTION_RING_CONFIG.yOffset + elevation, z);
    scene.add(this.selectionRingMesh);
  }

  /**
   * Show a range ring at a prospective placement position — no selection ring.
   * Called during placement mode as the pointer hovers tiles so the player
   * can see exactly where the tower would cover before committing.
   */
  showForPosition(
    towerType: TowerType,
    row: number,
    col: number,
    boardWidth: number,
    boardHeight: number,
    tileSize: number,
    scene: THREE.Scene
  ): void {
    this.hideHoverRange(scene);
    const config = TOWER_CONFIGS[towerType];
    const { x, z } = gridToWorld(row, col, boardWidth, boardHeight, tileSize);
    const elevation = this.elevationOf(row, col);
    // Soft-desaturated hover color reads as "potential" vs. the saturated
    // selected-tower ring (UX-2).
    const hoverColor = new THREE.Color(config.color)
      .lerp(new THREE.Color(0xffffff), RANGE_PREVIEW_CONFIG.hoverDesaturation)
      .getHex();
    this.hoverRangeMesh = this.createRangeRing(
      config.range,
      hoverColor,
      RANGE_PREVIEW_CONFIG.opacity * RANGE_PREVIEW_CONFIG.hoverOpacityScale,
      x,
      z,
      elevation,
    );
    scene.add(this.hoverRangeMesh);
  }

  /** Hide the hover-preview range ring. */
  hideHoverRange(scene: THREE.Scene): void {
    if (this.hoverRangeMesh) {
      scene.remove(this.hoverRangeMesh);
      disposeMesh(this.hoverRangeMesh);
      this.hoverRangeMesh = null;
    }
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
        const { x: worldX, z: worldZ } = gridToWorld(tower.row, tower.col, boardWidth, boardHeight, tileSize);
        const ring = this.createRangeRing(
          stats.range,
          RANGE_PREVIEW_CONFIG.allRangesColor,
          RANGE_PREVIEW_CONFIG.opacity * RANGE_PREVIEW_CONFIG.allRangesOpacityScale,
          worldX,
          worldZ,
          this.elevationOf(tower.row, tower.col),
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
    this.hideHoverRange(scene);
    for (const mesh of this.rangeRingMeshes) {
      scene.remove(mesh);
      disposeMesh(mesh);
    }
    this.rangeRingMeshes = [];
  }

  private createRangeRing(
    radius: number,
    color: number,
    opacity: number,
    x: number,
    z: number,
    elevation = 0,
  ): THREE.Mesh {
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
    // Elevation-aware Y so rings on raised Highground tiles still sit just
    // above the tile surface instead of burying inside the geometry.
    ring.position.set(x, RANGE_PREVIEW_CONFIG.yPosition + elevation, z);
    return ring;
  }
}
