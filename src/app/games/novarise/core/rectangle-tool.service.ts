import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { TerrainEditService } from './terrain-edit.service';
import { disposeMesh } from '../../../game/game-board/utils/three-utils';
import {
  EDITOR_RECTANGLE_PREVIEW,
  EDITOR_RENDER_ORDER,
} from '../constants/editor-ui.constants';

/** Maximum tile count before the rectangle preview is skipped for performance. */
const RECTANGLE_PREVIEW_MAX_TILES = 100;

/**
 * Manages the rectangle selection tool: preview mesh lifecycle and
 * delegating fill operations to TerrainEditService.
 * Visual-only meshes are fully disposed on cleanup.
 */
@Injectable()
export class RectangleToolService {
  private scene!: THREE.Scene;
  private terrainGrid!: TerrainGrid;

  private startTile: THREE.Mesh | null = null;
  private previewMeshes: THREE.Mesh[] = [];

  constructor(private terrainEdit: TerrainEditService) {}

  // ── Initialization ─────────────────────────────────────────────────────────

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  setTerrainGrid(grid: TerrainGrid): void {
    this.terrainGrid = grid;
  }

  // ── Start / end tile ───────────────────────────────────────────────────────

  setStartTile(tile: THREE.Mesh): void {
    this.startTile = tile;
  }

  getStartTile(): THREE.Mesh | null {
    return this.startTile;
  }

  clearStartTile(): void {
    this.startTile = null;
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  /**
   * Rebuild preview meshes for the rectangular region between startTile and
   * endTile. Skips rendering when the selection exceeds RECTANGLE_PREVIEW_MAX_TILES
   * to avoid GPU pressure on very large rectangles.
   */
  updatePreview(startTile: THREE.Mesh, endTile: THREE.Mesh): void {
    this.clearPreview();

    if (
      !startTile.userData || !endTile.userData ||
      typeof startTile.userData['gridX'] !== 'number' ||
      typeof startTile.userData['gridZ'] !== 'number' ||
      typeof endTile.userData['gridX'] !== 'number' ||
      typeof endTile.userData['gridZ'] !== 'number'
    ) {
      return;
    }

    const x1 = startTile.userData['gridX'] as number;
    const z1 = startTile.userData['gridZ'] as number;
    const x2 = endTile.userData['gridX'] as number;
    const z2 = endTile.userData['gridZ'] as number;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    // Performance guard: skip preview for very large selections
    const tileCount = (maxX - minX + 1) * (maxZ - minZ + 1);
    if (tileCount > RECTANGLE_PREVIEW_MAX_TILES) {
      return;
    }

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const tile = this.terrainGrid.getTileAt(x, z);
        if (!tile) continue;

        const geometry = new THREE.RingGeometry(
          EDITOR_RECTANGLE_PREVIEW.innerRadius,
          EDITOR_RECTANGLE_PREVIEW.outerRadius,
          EDITOR_RECTANGLE_PREVIEW.segments
        );
        const material = new THREE.MeshBasicMaterial({
          color: EDITOR_RECTANGLE_PREVIEW.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: EDITOR_RECTANGLE_PREVIEW.opacity,
          depthTest: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(tile.mesh.position);
        mesh.position.y = tile.mesh.position.y + EDITOR_RECTANGLE_PREVIEW.yOffset;
        mesh.renderOrder = EDITOR_RENDER_ORDER.rectanglePreview;
        this.scene.add(mesh);
        this.previewMeshes.push(mesh);
      }
    }
  }

  /** Remove and dispose all current preview meshes. */
  clearPreview(): void {
    this.previewMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    });
    this.previewMeshes = [];
  }

  // ── Fill ───────────────────────────────────────────────────────────────────

  /**
   * Apply terrain to the rectangular region, clear the preview, and reset
   * the start tile. Returns the flash targets for caller-side animation.
   */
  fill(
    startTile: THREE.Mesh,
    endTile: THREE.Mesh,
    onPathValidation: () => void
  ): THREE.Mesh[] {
    const flashTargets = this.terrainEdit.fillRectangle(
      startTile,
      endTile,
      onPathValidation
    );
    this.clearPreview();
    this.startTile = null;
    return flashTargets;
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  /** Full reset: clear preview and start tile (e.g. on tool switch). */
  reset(): void {
    this.startTile = null;
    this.clearPreview();
  }

  // ── Disposal ───────────────────────────────────────────────────────────────

  cleanup(): void {
    this.clearPreview();
    this.startTile = null;
  }
}
