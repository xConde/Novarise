import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import * as THREE from 'three';

import { BOARD_CONFIG } from '../constants/board.constants';
import { TowerGraphService, TowerGraphEdge } from './tower-graph.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { gridToWorld } from '../utils/coordinate-utils';
import { GameBoardService } from '../game-board.service';

/**
 * Dedicated owner of Three.js line meshes for Conduit tower adjacency.
 *
 * ## Responsibility
 *
 * Renders a `THREE.Line` for every active edge in `TowerGraphService` (both
 * spatial 4-dir and virtual CONDUIT_BRIDGE edges). Subscribes to the graph
 * service's `edgesAdded$` / `edgesRemoved$` observables and maintains exactly
 * one line per edge.
 *
 * ## Lifecycle (spike §10)
 *
 * Dedicated owner — no other service creates or disposes link meshes.
 * Four trigger paths:
 *
 * 1. Edge added → create `THREE.Line`, store in `lines` keyed by canonical
 *    edge id `a__b`.
 * 2. Edge removed → remove from scene, dispose geometry, delete map entry.
 *    Shared materials are NOT disposed per-edge.
 * 3. Encounter teardown → `dispose()` iterates remaining lines, disposes
 *    each geometry, disposes the shared materials ONCE, clears the map.
 * 4. Encounter restart → same as teardown; fresh instance per encounter.
 *
 * Materials: one shared for spatial edges, one for virtual (visual
 * differentiation per spike §10). Disposed exactly once in `dispose()`.
 *
 * Scene attachment via `attachScene(scene)` at component init — injecting
 * SceneService creates a fragile DI ordering dependency. If the scene is
 * swapped (e.g., restart), call `dispose()` before `attachScene(newScene)`.
 */
@Injectable()
export class LinkMeshService implements OnDestroy {
  /** Canonical edge id (`a__b`, lex-ordered) → THREE.Line. One line per edge. */
  private readonly lines = new Map<string, THREE.Line>();

  /** Shared material for 4-dir spatial edges. Disposed exactly once in dispose(). */
  private readonly spatialMaterial = new THREE.LineBasicMaterial({
    color: LINK_CONFIG.spatialColor,
    transparent: true,
    opacity: LINK_CONFIG.spatialOpacity,
  });

  /** Shared material for CONDUIT_BRIDGE virtual edges. Disposed exactly once in dispose(). */
  private readonly virtualMaterial = new THREE.LineBasicMaterial({
    color: LINK_CONFIG.virtualColor,
    transparent: true,
    opacity: LINK_CONFIG.virtualOpacity,
  });

  private scene: THREE.Scene | null = null;
  private subscriptions = new Subscription();

  constructor(
    private readonly towerGraphService: TowerGraphService,
    private readonly registry: BoardMeshRegistryService,
    private readonly gameBoardService: GameBoardService,
  ) {
    this.subscriptions.add(
      this.towerGraphService.edgesAdded$.subscribe(edge => this.onEdgeAdded(edge)),
    );
    this.subscriptions.add(
      this.towerGraphService.edgesRemoved$.subscribe(edge => this.onEdgeRemoved(edge)),
    );
  }

  // ─── Scene wiring ─────────────────────────────────────────────────────

  /**
   * Called by GameBoardComponent after scene construction. Does nothing if
   * the same scene is passed twice (idempotent).
   *
   * If the caller switches scenes, they MUST call `dispose()` first — the
   * service does not detach old lines from a prior scene.
   */
  attachScene(scene: THREE.Scene): void {
    this.scene = scene;
  }

  // ─── Edge event handlers ─────────────────────────────────────────────

  private onEdgeAdded(edge: TowerGraphEdge): void {
    const key = edgeKey(edge);
    if (this.lines.has(key)) return; // Idempotent — re-adds do not duplicate.
    if (this.scene === null) return;

    const geometry = this.buildLineGeometry(edge.a, edge.b);
    if (geometry === null) return; // Tower not yet meshed — skip.

    const material = edge.kind === 'virtual' ? this.virtualMaterial : this.spatialMaterial;
    const line = new THREE.Line(geometry, material);
    line.userData = { linkEdgeKey: key, linkEdgeKind: edge.kind };
    this.scene.add(line);
    this.lines.set(key, line);
  }

  private onEdgeRemoved(edge: TowerGraphEdge): void {
    const key = edgeKey(edge);
    const line = this.lines.get(key);
    if (!line) return;
    if (this.scene !== null) this.scene.remove(line);
    line.geometry.dispose();
    // Material is shared — DO NOT dispose per-edge. Disposed once in dispose().
    this.lines.delete(key);
  }

  // ─── Geometry ────────────────────────────────────────────────────────

  /**
   * Build a 2-vertex line between two tower world positions. Returns null if
   * either tower is not yet meshed — no auto-rehydrate if a tower group
   * registers after its edge event.
   */
  private buildLineGeometry(aId: string, bId: string): THREE.BufferGeometry | null {
    const aPos = this.getTowerWorldPos(aId);
    const bPos = this.getTowerWorldPos(bId);
    if (aPos === null || bPos === null) return null;
    const positions = new Float32Array([
      aPos.x, aPos.y, aPos.z,
      bPos.x, bPos.y, bPos.z,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }

  private getTowerWorldPos(towerId: string): { x: number; y: number; z: number } | null {
    const mesh = this.registry.towerMeshes.get(towerId);
    if (mesh) {
      // Lift the line slightly above the tower base so it renders above the tile.
      return { x: mesh.position.x, y: mesh.position.y + LINK_CONFIG.verticalOffset, z: mesh.position.z };
    }
    // Fallback: compute from grid position directly when mesh is not yet
    // in the registry. Avoids failed-to-render edges in test contexts where
    // the registry is a spy without mesh entries.
    const [row, col] = towerId.split('-').map(Number);
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    const { x, z } = gridToWorld(
      row, col,
      this.gameBoardService.getBoardWidth(),
      this.gameBoardService.getBoardHeight(),
      this.gameBoardService.getTileSize(),
    );
    return { x, y: BOARD_CONFIG.tileHeight + LINK_CONFIG.verticalOffset, z };
  }

  // ─── Queries (for spec + disposal-audit) ─────────────────────────────

  /** Number of link lines currently tracked. Used by disposal-audit specs. */
  getLineCount(): number {
    return this.lines.size;
  }

  // ─── Disposal ────────────────────────────────────────────────────────

  /**
   * Full teardown — removes all lines from the scene, disposes every
   * geometry, disposes both shared materials exactly once, unsubscribes
   * from graph events.
   *
   * Called from `GameSessionService.cleanupScene` AND automatically in
   * `ngOnDestroy` (component scope). Idempotent — second call is a no-op.
   */
  dispose(): void {
    if (this.scene !== null) {
      for (const line of this.lines.values()) {
        this.scene.remove(line);
      }
    }
    for (const line of this.lines.values()) {
      line.geometry.dispose();
    }
    this.lines.clear();
    this.spatialMaterial.dispose();
    this.virtualMaterial.dispose();
    this.subscriptions.unsubscribe();
    this.scene = null;
  }

  ngOnDestroy(): void {
    this.dispose();
  }
}

// ─── Config ────────────────────────────────────────────────────────────

const LINK_CONFIG = {
  /** Cyan — matches the Conduit archetype accent. */
  spatialColor: 0x4ac4d4,
  spatialOpacity: 0.55,
  /** Amber — CONDUIT_BRIDGE virtual edges read as "synthetic" link. */
  virtualColor: 0xd4a44a,
  virtualOpacity: 0.65,
  /** Line Y-offset above tower-top so it doesn't z-fight with the tile mesh. */
  verticalOffset: 0.3,
} as const;

/** Canonical edge map key. Mirrors TowerGraphService edge-key convention. */
function edgeKey(edge: TowerGraphEdge): string {
  const [a, b] = edge.a < edge.b ? [edge.a, edge.b] : [edge.b, edge.a];
  return `${a}__${b}`;
}
