import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { TerrainGrid } from '../features/terrain-editor/terrain-grid.class';
import { disposeMesh } from '../../../game/game-board/utils/three-utils';
import {
  EDITOR_SPAWN_MARKER,
  EDITOR_EXIT_MARKER,
  EDITOR_RENDER_ORDER,
} from '../constants/editor-ui.constants';

/**
 * Manages spawn and exit marker meshes in the editor scene.
 * Syncs marker counts and positions with the TerrainGrid's spawn/exit point arrays.
 */
@Injectable()
export class SpawnExitMarkerService {
  private scene!: THREE.Scene;
  private terrainGrid!: TerrainGrid;

  private spawnMarkers: THREE.Mesh[] = [];
  private exitMarkers: THREE.Mesh[] = [];

  // ── Initialization ─────────────────────────────────────────────────────────

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  setTerrainGrid(grid: TerrainGrid): void {
    this.terrainGrid = grid;
  }

  // ── Initial creation ───────────────────────────────────────────────────────

  createSpawnExitMarkers(): void {
    this.updateSpawnMarkers();
    this.updateExitMarkers();
  }

  // ── Mesh factories ─────────────────────────────────────────────────────────

  private createSpawnMarkerMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      EDITOR_SPAWN_MARKER.radiusTop,
      EDITOR_SPAWN_MARKER.radiusBottom,
      EDITOR_SPAWN_MARKER.height,
      EDITOR_SPAWN_MARKER.radialSegments
    );
    const material = new THREE.MeshBasicMaterial({
      color: EDITOR_SPAWN_MARKER.color,
      transparent: true,
      opacity: EDITOR_SPAWN_MARKER.opacity,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = EDITOR_RENDER_ORDER.spawnMarker;
    return mesh;
  }

  private createExitMarkerMesh(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      EDITOR_EXIT_MARKER.radiusTop,
      EDITOR_EXIT_MARKER.radiusBottom,
      EDITOR_EXIT_MARKER.height,
      EDITOR_EXIT_MARKER.radialSegments
    );
    const material = new THREE.MeshBasicMaterial({
      color: EDITOR_EXIT_MARKER.color,
      transparent: true,
      opacity: EDITOR_EXIT_MARKER.opacity,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = EDITOR_RENDER_ORDER.exitMarker;
    return mesh;
  }

  // ── Sync with TerrainGrid ──────────────────────────────────────────────────

  /** Sync spawn marker meshes with the terrainGrid's spawnPoints array. */
  updateSpawnMarkers(): void {
    const points = this.terrainGrid.getSpawnPoints();

    // Remove excess markers
    while (this.spawnMarkers.length > points.length) {
      const marker = this.spawnMarkers.pop()!;
      this.scene.remove(marker);
      disposeMesh(marker);
    }

    // Add missing markers
    while (this.spawnMarkers.length < points.length) {
      const marker = this.createSpawnMarkerMesh();
      this.spawnMarkers.push(marker);
      this.scene.add(marker);
    }

    // Position all markers
    for (let i = 0; i < points.length; i++) {
      const tile = this.terrainGrid.getTileAt(points[i].x, points[i].z);
      if (tile) {
        this.spawnMarkers[i].position.copy(tile.mesh.position);
        this.spawnMarkers[i].position.y += EDITOR_SPAWN_MARKER.yBase;
        this.spawnMarkers[i].visible = true;
      }
    }
  }

  /** Sync exit marker meshes with the terrainGrid's exitPoints array. */
  updateExitMarkers(): void {
    const points = this.terrainGrid.getExitPoints();

    // Remove excess markers
    while (this.exitMarkers.length > points.length) {
      const marker = this.exitMarkers.pop()!;
      this.scene.remove(marker);
      disposeMesh(marker);
    }

    // Add missing markers
    while (this.exitMarkers.length < points.length) {
      const marker = this.createExitMarkerMesh();
      this.exitMarkers.push(marker);
      this.scene.add(marker);
    }

    // Position all markers
    for (let i = 0; i < points.length; i++) {
      const tile = this.terrainGrid.getTileAt(points[i].x, points[i].z);
      if (tile) {
        this.exitMarkers[i].position.copy(tile.mesh.position);
        this.exitMarkers[i].position.y += EDITOR_EXIT_MARKER.yBase;
        this.exitMarkers[i].visible = true;
      }
    }
  }

  // ── Per-marker animation (called from animate loop) ───────────────────────

  getSpawnMarkers(): THREE.Mesh[] {
    return this.spawnMarkers;
  }

  getExitMarkers(): THREE.Mesh[] {
    return this.exitMarkers;
  }

  // ── Disposal ───────────────────────────────────────────────────────────────

  cleanup(): void {
    for (const marker of this.spawnMarkers) {
      this.scene.remove(marker);
      disposeMesh(marker);
    }
    this.spawnMarkers = [];

    for (const marker of this.exitMarkers) {
      this.scene.remove(marker);
      disposeMesh(marker);
    }
    this.exitMarkers = [];
  }
}
