import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { TerrainType } from '../models/terrain-types.enum';
import {
  EditHistoryService,
  PaintCommand,
  HeightCommand,
  TileState,
} from './edit-history.service';
import { EditorStateService } from './editor-state.service';
import {
  EDITOR_FLOOD_FILL_MAX_ITERATIONS,
  EDITOR_HEIGHT,
} from '../constants/editor-ui.constants';

/**
 * Handles terrain painting algorithms: flood-fill, rectangle fill, brush apply,
 * and per-tile undo tracking. Visual feedback (flash, markers) stays in the
 * component; this service is purely algorithmic.
 */
@Injectable()
export class TerrainEditService {
  private terrainGrid!: TerrainGrid;

  // Track tiles being edited in current stroke for batching
  private currentStrokeTiles: Map<string, TileState> = new Map();
  private currentStrokeNewHeights: Map<string, number> = new Map();
  private isInStroke = false;

  constructor(
    private editHistory: EditHistoryService,
    private editorState: EditorStateService,
  ) {}

  /** Call once after TerrainGrid is initialized (ngAfterViewInit). */
  setTerrainGrid(grid: TerrainGrid): void {
    this.terrainGrid = grid;
  }

  // ── Stroke management ──────────────────────────────────────────────────────

  startStroke(): void {
    this.isInStroke = true;
    this.currentStrokeTiles.clear();
    this.currentStrokeNewHeights.clear();
  }

  endStroke(onPathValidation: () => void): void {
    this.isInStroke = false;

    const editMode = this.editorState.getEditMode();

    if (editMode === 'paint' && this.currentStrokeTiles.size > 0) {
      const tiles = Array.from(this.currentStrokeTiles.values());
      const command = new PaintCommand(
        tiles,
        this.editorState.getTerrainType(),
        (x, z, type) => this.terrainGrid.paintTile(x, z, type)
      );
      this.editHistory.record(command);
      onPathValidation();
    } else if (editMode === 'height' && this.currentStrokeTiles.size > 0) {
      const tiles = Array.from(this.currentStrokeTiles.values());
      const command = new HeightCommand(
        tiles,
        new Map(this.currentStrokeNewHeights),
        (x, z, height) => this.terrainGrid.setHeight(x, z, height)
      );
      this.editHistory.record(command);
    }

    this.currentStrokeTiles.clear();
    this.currentStrokeNewHeights.clear();
  }

  get isTracking(): boolean {
    return this.isInStroke;
  }

  // ── Brush apply ────────────────────────────────────────────────────────────

  /**
   * Apply the current edit tool/mode to the given tile meshes.
   * Returns the list of meshes that were painted (for flash feedback).
   * Spawn/exit modes are not handled here — caller manages those.
   */
  applyBrushEdit(
    affectedTileMeshes: THREE.Mesh[],
    onPathValidation: () => void
  ): THREE.Mesh[] {
    const editMode = this.editorState.getEditMode();
    const flashTargets: THREE.Mesh[] = [];

    affectedTileMeshes.forEach(tileMesh => {
      const x = tileMesh.userData['gridX'] as number;
      const z = tileMesh.userData['gridZ'] as number;

      if (editMode === 'paint') {
        this.trackTileForUndo(x, z);
        this.terrainGrid.paintTile(x, z, this.editorState.getTerrainType());
        flashTargets.push(tileMesh);
      } else if (editMode === 'height') {
        this.trackTileForUndo(x, z);
        this.terrainGrid.adjustHeight(x, z, EDITOR_HEIGHT.stepSize);
        const tile = this.terrainGrid.getTileAt(x, z);
        if (tile) {
          const key = `${x},${z}`;
          this.currentStrokeNewHeights.set(key, tile.height);
          flashTargets.push(tile.mesh);
        }
      }
    });

    return flashTargets;
  }

  // ── Flood fill ─────────────────────────────────────────────────────────────

  /**
   * Flood-fill from a tile. Returns meshes that were painted for flash feedback.
   * Records a PaintCommand for undo.
   */
  floodFill(startTile: THREE.Mesh, onPathValidation: () => void): THREE.Mesh[] {
    if (
      !startTile.userData ||
      typeof startTile.userData['gridX'] !== 'number' ||
      typeof startTile.userData['gridZ'] !== 'number'
    ) {
      return [];
    }

    const editMode = this.editorState.getEditMode();
    if (editMode !== 'paint') return [];

    const startX = startTile.userData['gridX'] as number;
    const startZ = startTile.userData['gridZ'] as number;
    const startTileData = this.terrainGrid.getTileAt(startX, startZ);
    if (!startTileData) return [];

    const targetType = startTileData.type;
    const replacementType = this.editorState.getTerrainType();

    if (targetType === replacementType) return [];

    const affectedTiles: TileState[] = [];
    const flashTargets: THREE.Mesh[] = [];

    const visited = new Set<string>();
    const queue: [number, number][] = [[startX, startZ]];
    let iterations = 0;

    while (queue.length > 0 && iterations < EDITOR_FLOOD_FILL_MAX_ITERATIONS) {
      iterations++;
      const [x, z] = queue.shift()!;
      const key = `${x},${z}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const tile = this.terrainGrid.getTileAt(x, z);
      if (!tile || tile.type !== targetType) continue;

      affectedTiles.push({ x, z, type: tile.type, height: tile.height });
      this.terrainGrid.paintTile(x, z, replacementType);
      flashTargets.push(tile.mesh);

      const neighbors: [number, number][] = [
        [x - 1, z], [x + 1, z],
        [x, z - 1], [x, z + 1],
      ];
      neighbors.forEach(([nx, nz]) => {
        if (!visited.has(`${nx},${nz}`)) {
          queue.push([nx, nz]);
        }
      });
    }

    if (affectedTiles.length > 0) {
      const command = new PaintCommand(
        affectedTiles,
        replacementType,
        (x, z, type) => this.terrainGrid.paintTile(x, z, type)
      );
      this.editHistory.record(command);
      onPathValidation();
    }

    return flashTargets;
  }

  // ── Rectangle fill ─────────────────────────────────────────────────────────

  /**
   * Fill a rectangle region between two tiles.
   * Returns meshes that were modified for flash feedback.
   * Also returns whether a path revalidation is needed.
   */
  fillRectangle(
    startTile: THREE.Mesh,
    endTile: THREE.Mesh,
    onPathValidation: () => void
  ): THREE.Mesh[] {
    if (
      !startTile.userData || !endTile.userData ||
      typeof startTile.userData['gridX'] !== 'number' ||
      typeof startTile.userData['gridZ'] !== 'number' ||
      typeof endTile.userData['gridX'] !== 'number' ||
      typeof endTile.userData['gridZ'] !== 'number'
    ) {
      return [];
    }

    const x1 = startTile.userData['gridX'] as number;
    const z1 = startTile.userData['gridZ'] as number;
    const x2 = endTile.userData['gridX'] as number;
    const z2 = endTile.userData['gridZ'] as number;

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    const editMode = this.editorState.getEditMode();
    const affectedTiles: TileState[] = [];
    const newHeights = new Map<string, number>();
    const flashTargets: THREE.Mesh[] = [];

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const tile = this.terrainGrid.getTileAt(x, z);
        if (!tile) continue;

        affectedTiles.push({ x, z, type: tile.type, height: tile.height });

        if (editMode === 'paint') {
          this.terrainGrid.paintTile(x, z, this.editorState.getTerrainType());
        } else if (editMode === 'height') {
          this.terrainGrid.adjustHeight(x, z, EDITOR_HEIGHT.stepSize);
          const updatedTile = this.terrainGrid.getTileAt(x, z);
          if (updatedTile) {
            newHeights.set(`${x},${z}`, updatedTile.height);
          }
        }
        flashTargets.push(tile.mesh);
      }
    }

    if (affectedTiles.length > 0) {
      if (editMode === 'paint') {
        const command = new PaintCommand(
          affectedTiles,
          this.editorState.getTerrainType(),
          (x, z, type) => this.terrainGrid.paintTile(x, z, type)
        );
        this.editHistory.record(command);
        onPathValidation();
      } else if (editMode === 'height') {
        const command = new HeightCommand(
          affectedTiles,
          newHeights,
          (x, z, height) => this.terrainGrid.setHeight(x, z, height)
        );
        this.editHistory.record(command);
      }
    }

    return flashTargets;
  }

  // ── Undo tracking ──────────────────────────────────────────────────────────

  /**
   * Record a tile's state before editing so it can be undone.
   * Only records the first state in a stroke (before any changes).
   */
  trackTileForUndo(x: number, z: number): void {
    const key = `${x},${z}`;
    if (!this.currentStrokeTiles.has(key)) {
      const tile = this.terrainGrid.getTileAt(x, z);
      if (tile) {
        this.currentStrokeTiles.set(key, {
          x,
          z,
          type: tile.type,
          height: tile.height,
        });
      }
    }
  }
}
