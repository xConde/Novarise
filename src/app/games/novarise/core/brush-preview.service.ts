import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { EditorStateService } from './editor-state.service';
import { disposeMesh } from '../../../game/game-board/utils/three-utils';
import {
  EDITOR_BRUSH_INDICATOR,
  EDITOR_BRUSH_PREVIEW,
  EDITOR_RENDER_ORDER,
} from '../constants/editor-ui.constants';

/**
 * Manages the brush indicator ring and multi-tile brush preview meshes
 * in the editor scene. Visual-only; no terrain state is modified here.
 */
@Injectable()
export class BrushPreviewService {
  private scene!: THREE.Scene;
  private terrainGrid!: TerrainGrid;

  private brushIndicator!: THREE.Mesh;
  private brushPreviewMeshes: THREE.Mesh[] = [];

  constructor(private editorState: EditorStateService) {}

  // ── Initialization ─────────────────────────────────────────────────────────

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  setTerrainGrid(grid: TerrainGrid): void {
    this.terrainGrid = grid;
  }

  // ── Brush indicator (single-tile ring) ────────────────────────────────────

  createBrushIndicator(): void {
    const geometry = new THREE.RingGeometry(
      EDITOR_BRUSH_INDICATOR.innerRadius,
      EDITOR_BRUSH_INDICATOR.outerRadius,
      EDITOR_BRUSH_INDICATOR.segments
    );
    const material = new THREE.MeshBasicMaterial({
      color: EDITOR_BRUSH_INDICATOR.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: EDITOR_BRUSH_INDICATOR.opacity,
      depthTest: false,
    });
    this.brushIndicator = new THREE.Mesh(geometry, material);
    this.brushIndicator.rotation.x = -Math.PI / 2;
    this.brushIndicator.visible = false;
    this.brushIndicator.renderOrder = EDITOR_RENDER_ORDER.brushIndicator;
    this.scene.add(this.brushIndicator);
  }

  getBrushIndicator(): THREE.Mesh {
    return this.brushIndicator;
  }

  updateBrushIndicatorColor(): void {
    if (this.brushIndicator) {
      const material = this.brushIndicator.material as THREE.MeshBasicMaterial;
      material.color.setHex(this.editorState.getColorForMode());
    }
  }

  positionBrushIndicator(tile: THREE.Mesh): void {
    this.brushIndicator.position.copy(tile.position);
    this.brushIndicator.position.y = tile.position.y + EDITOR_BRUSH_INDICATOR.yOffset;
    this.brushIndicator.visible = true;
    this.updateBrushIndicatorColor();
  }

  hideBrushIndicator(): void {
    if (this.brushIndicator) {
      this.brushIndicator.visible = false;
    }
  }

  // ── Multi-tile brush preview meshes ──────────────────────────────────────

  updateBrushPreview(): void {
    // Dispose and remove existing preview meshes
    this.brushPreviewMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    });
    this.brushPreviewMeshes = [];

    const brushSize = this.editorState.getBrushSize();
    if (brushSize <= 1) return;

    const halfSize = Math.floor(brushSize / 2);
    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dz = -halfSize; dz <= halfSize; dz++) {
        if (dx === 0 && dz === 0) continue; // Skip center (indicator covers it)

        const geometry = new THREE.RingGeometry(
          EDITOR_BRUSH_PREVIEW.innerRadius,
          EDITOR_BRUSH_PREVIEW.outerRadius,
          EDITOR_BRUSH_PREVIEW.segments
        );
        const material = new THREE.MeshBasicMaterial({
          color: EDITOR_BRUSH_PREVIEW.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: EDITOR_BRUSH_PREVIEW.opacity,
          depthTest: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.visible = false;
        mesh.renderOrder = EDITOR_RENDER_ORDER.brushPreview;
        mesh.userData = { offsetX: dx, offsetZ: dz };
        this.scene.add(mesh);
        this.brushPreviewMeshes.push(mesh);
      }
    }
  }

  updateBrushPreviewPositions(hoveredTile: THREE.Mesh): void {
    if (!hoveredTile?.userData ||
        typeof hoveredTile.userData['gridX'] !== 'number' ||
        typeof hoveredTile.userData['gridZ'] !== 'number') {
      this.hideBrushPreview();
      return;
    }

    const centerX = hoveredTile.userData['gridX'];
    const centerZ = hoveredTile.userData['gridZ'];

    this.brushPreviewMeshes.forEach(mesh => {
      const offsetX = mesh.userData['offsetX'];
      const offsetZ = mesh.userData['offsetZ'];
      const tile = this.terrainGrid.getTileAt(centerX + offsetX, centerZ + offsetZ);

      if (tile) {
        mesh.position.copy(tile.mesh.position);
        mesh.position.y = tile.mesh.position.y + EDITOR_BRUSH_PREVIEW.yOffset;
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    });
  }

  hideBrushPreview(): void {
    this.brushPreviewMeshes.forEach(mesh => {
      mesh.visible = false;
    });
  }

  // ── Tile computation ──────────────────────────────────────────────────────

  getAffectedTiles(centerTile: THREE.Mesh): THREE.Mesh[] {
    const tiles: THREE.Mesh[] = [centerTile];
    const brushSize = this.editorState.getBrushSize();

    if (brushSize === 1) return tiles;

    if (!centerTile.userData ||
        typeof centerTile.userData['gridX'] !== 'number' ||
        typeof centerTile.userData['gridZ'] !== 'number') {
      return tiles;
    }

    const centerX = centerTile.userData['gridX'];
    const centerZ = centerTile.userData['gridZ'];
    const halfSize = Math.floor(brushSize / 2);

    for (let dx = -halfSize; dx <= halfSize; dx++) {
      for (let dz = -halfSize; dz <= halfSize; dz++) {
        if (dx === 0 && dz === 0) continue;

        const tile = this.terrainGrid.getTileAt(centerX + dx, centerZ + dz);
        if (tile) {
          tiles.push(tile.mesh);
        }
      }
    }

    return tiles;
  }

  // ── Disposal ───────────────────────────────────────────────────────────────

  cleanup(): void {
    this.brushPreviewMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      disposeMesh(mesh);
    });
    this.brushPreviewMeshes = [];

    if (this.brushIndicator) {
      this.scene.remove(this.brushIndicator);
      disposeMesh(this.brushIndicator);
    }
  }
}
