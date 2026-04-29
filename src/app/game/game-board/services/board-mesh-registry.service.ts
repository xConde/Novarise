import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockType } from '../models/game-board-tile';
import { TileInstanceLayer } from './tile-instance-layer';

/**
 * Owns all mesh maps for the game board — tiles, towers, and grid lines.
 * Extracted from GameBoardComponent (Decomposition Sprint 1).
 *
 * Other services inject this to read/write mesh state without going through
 * the component. The component no longer owns these maps.
 *
 * Phase C sprint 22: tile rendering is HYBRID. BASE tiles render via a
 * single InstancedMesh wrapped in `tileInstanceLayers`; non-BASE tiles
 * (WALL/SPAWNER/EXIT) and mutation-overlay tiles still render as
 * individual meshes in `tileMeshes`. Sprint 23 widens layer coverage to
 * WALL/SPAWNER/EXIT.
 */
@Injectable()
export class BoardMeshRegistryService {
  readonly tileMeshes = new Map<string, THREE.Mesh>();
  /** Per-BlockType InstancedMesh layer (sprint 22+). Currently BASE only. */
  readonly tileInstanceLayers = new Map<BlockType, TileInstanceLayer>();
  readonly towerMeshes = new Map<string, THREE.Group>();
  /**
   * Cliff column meshes placed under raised tiles (sprint 39 Highground polish).
   * Key: `"${row}-${col}"`. Created by ElevationService.applyElevation when
   * newElevation > 0 and priorElevation === 0; resized when elevation increases
   * while > 0; removed and geometry-disposed when elevation returns to 0.
   * Material is owned by TerraformMaterialPoolService — cliff meshes must NOT
   * dispose it individually.
   */
  readonly cliffMeshes = new Map<string, THREE.Mesh>();
  gridLines: THREE.Group | null = null;

  private tileMeshArray: THREE.Mesh[] = [];
  private tilePickables: THREE.Object3D[] = [];
  private towerChildrenArray: THREE.Object3D[] = [];

  /** @deprecated Use getTilePickables() — includes both instanced + individual tiles. */
  getTileMeshArray(): readonly THREE.Mesh[] { return this.tileMeshArray; }

  /**
   * Raycaster targets: includes individual tile meshes + every instanced
   * tile layer's InstancedMesh. Sprint 22+: BASE tiles live in instance
   * layers; non-BASE in individual meshes.
   */
  getTilePickables(): readonly THREE.Object3D[] { return this.tilePickables; }

  getTowerChildrenArray(): readonly THREE.Object3D[] { return this.towerChildrenArray; }

  rebuildTileMeshArray(): void {
    this.tileMeshArray = Array.from(this.tileMeshes.values());
    this.rebuildTilePickables();
  }

  rebuildTilePickables(): void {
    const out: THREE.Object3D[] = [];
    this.tileInstanceLayers.forEach(layer => out.push(layer.mesh));
    this.tileMeshes.forEach(mesh => out.push(mesh));
    this.tilePickables = out;
  }

  /**
   * Resolve a raycaster intersection to a tile coord regardless of
   * whether the hit was an InstancedMesh or an individual Mesh.
   * Returns null if the hit object isn't a tile.
   */
  resolveTileHit(intersection: THREE.Intersection): { row: number; col: number } | null {
    const obj = intersection.object;
    if (obj instanceof THREE.InstancedMesh) {
      const blockType = obj.userData['blockType'] as BlockType | undefined;
      if (blockType === undefined) return null;
      const layer = this.tileInstanceLayers.get(blockType);
      if (!layer || intersection.instanceId === undefined) return null;
      return layer.lookupCoord(intersection.instanceId);
    }
    if (obj instanceof THREE.Mesh) {
      const row = obj.userData['row'] as number | undefined;
      const col = obj.userData['col'] as number | undefined;
      if (row === undefined || col === undefined) return null;
      return { row, col };
    }
    return null;
  }

  /**
   * Returns information about which surface owns the (row, col):
   *   - kind 'instanced': in a TileInstanceLayer (BASE tiles)
   *   - kind 'individual': in tileMeshes Map (non-BASE, or mutation overlay)
   *   - kind 'none': not present anywhere
   *
   * Used by TileHighlightService and PathMutationService to dispatch the
   * right strategy per-tile.
   */
  findTileSurface(row: number, col: number):
    | { kind: 'instanced'; layer: TileInstanceLayer; index: number }
    | { kind: 'individual'; mesh: THREE.Mesh }
    | { kind: 'none' }
  {
    const key = `${row}-${col}`;
    const individual = this.tileMeshes.get(key);
    if (individual) return { kind: 'individual', mesh: individual };
    for (const layer of this.tileInstanceLayers.values()) {
      const idx = layer.findIndex(row, col);
      if (idx >= 0) return { kind: 'instanced', layer, index: idx };
    }
    return { kind: 'none' };
  }

  rebuildTowerChildrenArray(): void {
    // Collect all children of tower groups for raycasting
    const children: THREE.Object3D[] = [];
    this.towerMeshes.forEach(group => {
      group.children.forEach(child => children.push(child));
    });
    this.towerChildrenArray = children;
  }

  /**
   * Swap the tile mesh stored at (row, col) with `newMesh`.
   *
   * The caller is responsible for:
   *  - removing the old mesh from the scene
   *  - disposing the old mesh's geometry and material
   *  - adding `newMesh` to the scene
   *
   * This method only updates the internal map entry and rebuilds the flat
   * array consumed by the raycaster. Matches the tower-mesh-lifecycle pattern
   * where the component owns scene add/remove and the registry owns the map.
   */
  replaceTileMesh(row: number, col: number, newMesh: THREE.Mesh): void {
    const key = `${row}-${col}`;
    this.tileMeshes.set(key, newMesh);
    this.rebuildTileMeshArray();
  }

  /**
   * Translate a tile mesh's Y position without disposing or rebuilding geometry.
   * Used by ElevationService (Highground archetype, sprint 25).
   *
   * Disposal-neutral: no geometry or material is touched. The Three.js scene-graph
   * matrix update is automatic on the next render frame.
   *
   * Caller computes newY (typically `elevation + BOARD_CONFIG.tileHeight / 2`).
   */
  translateTileMesh(row: number, col: number, newY: number): void {
    const surface = this.findTileSurface(row, col);
    if (surface.kind === 'individual') {
      surface.mesh.position.y = newY;
    } else if (surface.kind === 'instanced') {
      surface.layer.setElevationAt(row, col, newY);
    }
  }

  /**
   * Translate a tower group's Y position without disposing or rebuilding.
   * Used by ElevationService when elevation changes on a tile that holds a tower.
   *
   * Tower meshes are keyed by `${row}-${col}` (same convention as tile meshes —
   * confirmed by BoardMeshRegistryService.spec.ts lines 74, 93-94 and
   * card-play.service.ts line 476). Tower group children are positioned relative
   * to the group origin (tower-mesh-factory.service.ts §51-277), so moving the
   * group Y moves every child with it. No child repositioning needed.
   *
   * Disposal-neutral: no geometry or material is touched.
   *
   * Caller computes newY (typically `elevation + BOARD_CONFIG.tileHeight`).
   */
  translateTowerMesh(row: number, col: number, newY: number): void {
    const group = this.towerMeshes.get(`${row}-${col}`);
    if (!group) return;
    group.position.y = newY;
  }

  clear(): void {
    this.tileMeshes.clear();
    this.tileInstanceLayers.clear();
    this.towerMeshes.clear();
    this.cliffMeshes.clear();
    this.gridLines = null;
    this.tileMeshArray = [];
    this.tilePickables = [];
    this.towerChildrenArray = [];
  }
}
