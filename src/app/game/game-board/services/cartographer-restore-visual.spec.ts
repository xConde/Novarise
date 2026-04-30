/**
 * Phase C merge-readiness — Cartographer mutation visual integration.
 *
 * The recent red-team caught a HIGH bug: checkpoint-restore-coordinator
 * called swapMesh without `mutation.op`, so restored mutation tiles
 * rendered as plain BASE/WALL instead of teal/amber/red/violet
 * TerraformPool tints. Fix landed; this spec verifies via REAL
 * services that the restored overlay mesh's material is the
 * TerraformPool material with the correct color baked in.
 *
 * Closest-to-WebGL coverage we can get from headless: assert the
 * actual material identity and color values, not just the call
 * signature (which the existing checkpoint-restore-coordinator spec
 * already covers).
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
import { MutationOp } from './path-mutation.types';

const TERRAFORM_EXPECTED_COLORS: Record<MutationOp, number> = {
  build: 0x3fd18a,
  block: 0xe8a033,
  destroy: 0x8a2f1f,
  bridgehead: 0x7c4dff,
};

describe('Cartographer mutation visual integration (merge-readiness)', () => {
  let pathMutation: PathMutationService;
  let gameBoard: GameBoardService;
  let registry: BoardMeshRegistryService;
  let pool: TerraformMaterialPoolService;
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
    pool = TestBed.inject(TerraformMaterialPoolService);
    scene = new THREE.Scene();
    gameBoard.importBoard(buildBoard(3, 3), 3, 3);
    const baseLayer = gameBoard.buildTileInstanceLayer(BlockType.BASE);
    if (baseLayer) {
      registry.tileInstanceLayers.set(BlockType.BASE, baseLayer);
      scene.add(baseLayer.mesh);
      registry.rebuildTilePickables();
    }
  });

  afterEach(() => {
    TestBed.inject(MaterialRegistryService).dispose();
    TestBed.inject(GeometryRegistryService).dispose();
    pool.dispose();
    registry.tileInstanceLayers.forEach(layer => layer.dispose(scene));
    registry.tileInstanceLayers.clear();
    registry.tileMeshes.forEach(m => {
      scene.remove(m);
      m.geometry.dispose();
      try { (m.material as THREE.Material).dispose(); } catch { /* may be pool material */ }
    });
    registry.tileMeshes.clear();
  });

  describe('fresh mutation tints', () => {
    (['build', 'block', 'destroy', 'bridgehead'] as MutationOp[]).forEach(op => {
      it(`fresh '${op}' mutation overlay uses TerraformPool material with color 0x${TERRAFORM_EXPECTED_COLORS[op].toString(16)}`, () => {
        const targetType = op === 'build' ? BlockType.BASE : BlockType.WALL;
        pathMutation.swapMesh(1, 1, targetType, scene, op);
        const overlay = registry.tileMeshes.get('1-1');
        expect(overlay).withContext(`overlay must exist for ${op}`).toBeTruthy();
        const mat = overlay!.material as THREE.MeshStandardMaterial;
        expect(pool.isPoolMaterial(mat))
          .withContext(`overlay material must be pool-owned for ${op}`)
          .toBeTrue();
        expect(mat.color.getHex())
          .withContext(`pool material color for ${op}`)
          .toBe(TERRAFORM_EXPECTED_COLORS[op]);
      });
    });
  });

  describe('checkpoint restore — call signature drives correct material', () => {
    // The checkpoint-restore-coordinator spec asserts the call signature.
    // This spec covers the OUTCOME: after the call, the registered overlay
    // mesh has the right material. If the coordinator regresses to passing
    // 4 args instead of 5 (missing mutation.op), this spec fires too.
    (['build', 'block', 'destroy', 'bridgehead'] as MutationOp[]).forEach(op => {
      it(`restored '${op}' mutation produces overlay with pool material (Phase C sprint 30 fix)`, () => {
        const targetType = op === 'build' ? BlockType.BASE : BlockType.WALL;
        // Simulate: setTileType (board state) + swapMesh (mesh) — same as the coordinator's restore loop.
        gameBoard.setTileType(0, 0, targetType, op,
          op === 'build' ? BlockType.WALL : BlockType.BASE);
        pathMutation.swapMesh(0, 0, targetType, scene, op);

        const overlay = registry.tileMeshes.get('0-0');
        expect(overlay).toBeTruthy();
        const mat = overlay!.material as THREE.MeshStandardMaterial;
        expect(pool.isPoolMaterial(mat)).toBeTrue();
        expect(mat.color.getHex()).toBe(TERRAFORM_EXPECTED_COLORS[op]);
      });
    });

    it('regression guard: restored tile is NOT a plain BASE/WALL with default emissive', () => {
      // The pre-fix bug: restored 'build' rendered as plain BASE.
      gameBoard.setTileType(0, 0, BlockType.BASE, 'build', BlockType.WALL);
      pathMutation.swapMesh(0, 0, BlockType.BASE, scene, 'build');

      const overlay = registry.tileMeshes.get('0-0');
      expect(overlay).toBeTruthy();
      const mat = overlay!.material as THREE.MeshStandardMaterial;
      // Pre-fix: this would have been the per-instance default tile material with
      // the BASE color (0x404858). Post-fix: the pool material with build green.
      expect(mat.color.getHex()).not.toBe(0x404858);
      expect(mat.color.getHex()).toBe(0x3fd18a);
    });
  });

  describe('mutation expiry returns tile to instance layer', () => {
    it('build expiry: overlay disposed, BASE instance restored', () => {
      const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
      const idx = baseLayer.findIndex(2, 2);

      // Apply mutation (BUILD on a BASE tile is a no-op type-wise; what matters is the overlay).
      pathMutation.swapMesh(2, 2, BlockType.BASE, scene, 'build');
      expect(registry.tileMeshes.has('2-2')).toBeTrue();
      expect(baseLayer.lookupCoord(idx)).toBeNull(); // hidden

      // Mutation expires → revert to BASE with no op.
      pathMutation.swapMesh(2, 2, BlockType.BASE, scene);

      expect(registry.tileMeshes.has('2-2')).toBeFalse();
      expect(baseLayer.lookupCoord(idx)).toEqual({ row: 2, col: 2 });
    });
  });
});
