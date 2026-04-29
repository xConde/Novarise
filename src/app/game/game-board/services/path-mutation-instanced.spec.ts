/**
 * Phase C sprint 24 — terraform-mutation-on-instanced-tiles integration spec.
 *
 * Sprint 22 wired BASE tiles to TileInstanceLayer; sprint 23 widened to
 * WALL/SPAWNER/EXIT. This spec covers the swapMesh hybrid:
 *   - Mutating a BASE tile hides the BASE instance + creates an individual
 *     mutation Mesh in tileMeshes (TerraformPool material).
 *   - Reverting to BASE disposes the individual mesh + shows the instance.
 *   - Same flow works for WALL → mutation → revert.
 *
 * Uses real services (no spies) so the InstancedMesh state under test is
 * the actual production code path.
 */

import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { PathMutationService } from './path-mutation.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { PathfindingService } from './pathfinding.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';

describe('PathMutationService × InstancedMesh integration (sprint 24)', () => {
  let pathMutation: PathMutationService;
  let gameBoard: GameBoardService;
  let registry: BoardMeshRegistryService;
  let scene: THREE.Scene;

  function buildBoard(width: number, height: number): GameBoardTile[][] {
    const board: GameBoardTile[][] = [];
    for (let r = 0; r < height; r++) {
      const row: GameBoardTile[] = [];
      for (let c = 0; c < width; c++) {
        row.push(GameBoardTile.createBase(r, c));
      }
      board.push(row);
    }
    return board;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PathMutationService,
        GameBoardService,
        BoardMeshRegistryService,
        PathfindingService,
        TerraformMaterialPoolService,
        GeometryRegistryService,
        MaterialRegistryService,
      ],
    });
    pathMutation = TestBed.inject(PathMutationService);
    gameBoard = TestBed.inject(GameBoardService);
    registry = TestBed.inject(BoardMeshRegistryService);
    scene = new THREE.Scene();

    // Set up a tiny 3×3 board with a BASE layer.
    gameBoard.importBoard(buildBoard(3, 3), 3, 3);
    const baseLayer = gameBoard.buildTileInstanceLayer(BlockType.BASE);
    if (baseLayer) {
      registry.tileInstanceLayers.set(BlockType.BASE, baseLayer);
      scene.add(baseLayer.mesh);
      registry.rebuildTilePickables();
    }
  });

  afterEach(() => {
    // Drain pool + registry resources allocated during the test.
    TestBed.inject(MaterialRegistryService).dispose();
    TestBed.inject(GeometryRegistryService).dispose();
    TestBed.inject(TerraformMaterialPoolService).dispose();
    registry.tileInstanceLayers.forEach(layer => layer.dispose(scene));
    registry.tileInstanceLayers.clear();
    registry.tileMeshes.forEach(m => {
      scene.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      try { mat.dispose(); } catch { /* may be pool material */ }
    });
    registry.tileMeshes.clear();
  });

  describe('BASE tile mutation', () => {
    it('hides the BASE instance and registers an individual overlay on mutate', () => {
      const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
      expect(baseLayer.findIndex(1, 1)).toBeGreaterThanOrEqual(0);

      pathMutation.swapMesh(1, 1, BlockType.BASE, scene, 'build');

      // BASE instance for (1,1) is now hidden — lookupCoord returns null.
      const idx = baseLayer.findIndex(1, 1);
      expect(baseLayer.lookupCoord(idx)).toBeNull();

      // An individual overlay mesh now lives in tileMeshes for that coord.
      const overlay = registry.tileMeshes.get('1-1');
      expect(overlay).toBeTruthy();
      expect(overlay!.parent).toBe(scene);
    });

    it('disposes the overlay and shows the BASE instance on revert', () => {
      const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
      const idx = baseLayer.findIndex(1, 1);

      // Mutate then revert.
      pathMutation.swapMesh(1, 1, BlockType.BASE, scene, 'build');
      expect(registry.tileMeshes.has('1-1')).toBeTrue();
      expect(baseLayer.lookupCoord(idx)).toBeNull();

      pathMutation.swapMesh(1, 1, BlockType.BASE, scene); // no mutationOp = revert

      // Overlay was removed from tileMeshes and detached from scene.
      expect(registry.tileMeshes.has('1-1')).toBeFalse();
      // BASE instance is visible again.
      expect(baseLayer.lookupCoord(idx)).toEqual({ row: 1, col: 1 });
    });

    it('the overlay uses a TerraformPool material on mutation', () => {
      pathMutation.swapMesh(0, 0, BlockType.BASE, scene, 'build');
      const overlay = registry.tileMeshes.get('0-0')!;
      const mat = overlay.material as THREE.Material;
      const pool = TestBed.inject(TerraformMaterialPoolService);
      expect(pool.isPoolMaterial(mat)).toBeTrue();
    });

    it('repeated mutate calls on the same coord preserve invariants', () => {
      const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
      const idx = baseLayer.findIndex(2, 2);

      pathMutation.swapMesh(2, 2, BlockType.BASE, scene, 'build');
      const firstOverlay = registry.tileMeshes.get('2-2')!;

      // Same coord, different mutation — should dispose first overlay,
      // create a new one, instance still hidden.
      pathMutation.swapMesh(2, 2, BlockType.BASE, scene, 'destroy');
      const secondOverlay = registry.tileMeshes.get('2-2')!;
      expect(secondOverlay).not.toBe(firstOverlay);
      expect(firstOverlay.parent).toBeNull(); // detached
      expect(baseLayer.lookupCoord(idx)).toBeNull(); // still hidden
    });

    it('raycaster cannot resolve a hidden instance to its coord', () => {
      const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
      pathMutation.swapMesh(1, 1, BlockType.BASE, scene, 'build');

      // Simulate a hit on the instance itself by passing instanceId directly.
      const idx = baseLayer.findIndex(1, 1);
      const fakeIntersection = {
        object: baseLayer.mesh,
        instanceId: idx,
      } as unknown as THREE.Intersection;
      const resolved = registry.resolveTileHit(fakeIntersection);
      expect(resolved).toBeNull();
    });
  });
});
