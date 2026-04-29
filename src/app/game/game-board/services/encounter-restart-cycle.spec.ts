/**
 * Phase C merge-readiness — encounter restart leak invariants.
 *
 * Simulates 5 cleanup→reset→render cycles and asserts that:
 *   - GeometryRegistry size returns to 0 after every dispose
 *   - MaterialRegistry size returns to 0 after every dispose
 *   - TileInstanceLayers map is empty after cleanup
 *   - TileMeshes map is empty after cleanup
 *   - Layer counts on the SECOND encounter exactly match the first
 *
 * Headless can't catch GPU memory leaks, but it CAN catch JS-side cache
 * accumulation that would compound across encounters in production.
 *
 * Closes WebGL gap risk: per-encounter resource accumulation that the
 * existing per-sprint specs cover individually but never exercise as a
 * full N-encounter cycle.
 */

import * as THREE from 'three';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { TextSpritePoolService } from './text-sprite-pool.service';
import { VfxPoolService } from './vfx-pool.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';

describe('Encounter restart cycle leak invariants (merge-readiness)', () => {
  function buildBoard(width: number, height: number): GameBoardTile[][] {
    const board: GameBoardTile[][] = [];
    for (let r = 0; r < height; r++) {
      const row: GameBoardTile[] = [];
      for (let c = 0; c < width; c++) {
        // Mix of types so all 4 instanced layers materialise.
        let tile: GameBoardTile;
        if (r === 0 && c === 0) tile = GameBoardTile.createSpawner(r, c);
        else if (r === height - 1 && c === width - 1) tile = GameBoardTile.createExit(r, c);
        else if ((r + c) % 5 === 0) tile = GameBoardTile.createWall(r, c);
        else tile = GameBoardTile.createBase(r, c);
        row.push(tile);
      }
      board.push(row);
    }
    return board;
  }

  function simulateRender(
    gameBoard: GameBoardService,
    registry: BoardMeshRegistryService,
    scene: THREE.Scene,
  ): void {
    // Mirror the production renderGameBoard flow.
    for (const t of [BlockType.BASE, BlockType.WALL, BlockType.SPAWNER, BlockType.EXIT]) {
      const layer = gameBoard.buildTileInstanceLayer(t);
      if (layer) {
        registry.tileInstanceLayers.set(t, layer);
        scene.add(layer.mesh);
      }
    }
    registry.rebuildTileMeshArray();
  }

  function simulateCleanup(
    registry: BoardMeshRegistryService,
    geom: GeometryRegistryService,
    mat: MaterialRegistryService,
    pool: TerraformMaterialPoolService,
    sprite: TextSpritePoolService,
    vfx: VfxPoolService,
    scene: THREE.Scene,
  ): void {
    // Mirror GameSessionService.cleanupScene order.
    registry.tileMeshes.forEach(m => {
      scene.remove(m);
      if (!geom.isRegisteredGeometry(m.geometry)) m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach(x => {
        if (pool.isPoolMaterial(x)) return;
        if (mat.isRegisteredMaterial(x)) return;
        x.dispose();
      });
    });
    registry.tileMeshes.clear();
    registry.tileInstanceLayers.forEach(layer => layer.dispose(scene));
    registry.tileInstanceLayers.clear();
    pool.dispose();
    mat.dispose();
    geom.dispose();
    sprite.dispose();
    vfx.dispose();
  }

  it('5-cycle restart: registries return to size 0 each time', () => {
    const cycles = 5;
    const sizesAfterFirstRender: { geom: number; mat: number; layers: number } = {
      geom: 0, mat: 0, layers: 0,
    };

    for (let i = 0; i < cycles; i++) {
      const scene = new THREE.Scene();
      const registry = new BoardMeshRegistryService();
      const geom = new GeometryRegistryService();
      const mat = new MaterialRegistryService();
      const pool = new TerraformMaterialPoolService();
      const sprite = new TextSpritePoolService();
      const vfx = new VfxPoolService(mat, geom);
      const gameBoard = new GameBoardService(pool, geom, mat);
      gameBoard.importBoard(buildBoard(8, 8), 8, 8);

      simulateRender(gameBoard, registry, scene);

      if (i === 0) {
        sizesAfterFirstRender.geom = geom.size();
        sizesAfterFirstRender.mat = mat.size();
        sizesAfterFirstRender.layers = registry.tileInstanceLayers.size;
      } else {
        // Subsequent encounters should produce IDENTICAL cache sizes — no drift.
        expect(geom.size())
          .withContext(`encounter ${i + 1}: geometry registry size differs from encounter 1`)
          .toBe(sizesAfterFirstRender.geom);
        expect(mat.size())
          .withContext(`encounter ${i + 1}: material registry size differs from encounter 1`)
          .toBe(sizesAfterFirstRender.mat);
        expect(registry.tileInstanceLayers.size)
          .withContext(`encounter ${i + 1}: layer count differs from encounter 1`)
          .toBe(sizesAfterFirstRender.layers);
      }

      simulateCleanup(registry, geom, mat, pool, sprite, vfx, scene);

      // After cleanup, every cache MUST be empty.
      expect(geom.size()).withContext(`encounter ${i + 1} post-cleanup geom size`).toBe(0);
      expect(mat.size()).withContext(`encounter ${i + 1} post-cleanup mat size`).toBe(0);
      expect(registry.tileInstanceLayers.size)
        .withContext(`encounter ${i + 1} post-cleanup layer count`)
        .toBe(0);
      expect(registry.tileMeshes.size)
        .withContext(`encounter ${i + 1} post-cleanup tile mesh count`)
        .toBe(0);
      expect(scene.children.length)
        .withContext(`encounter ${i + 1} post-cleanup scene children`)
        .toBe(0);
    }
  });

  it('5-cycle restart with text sprites: pool drains every time', () => {
    for (let i = 0; i < 5; i++) {
      const sprite = new TextSpritePoolService();
      // Acquire a few sprites to populate the pool.
      sprite.acquire({
        text: '+50g', textColor: '#fff', strokeColor: '#000', strokeWidth: 2,
        font: 'bold 24px sans-serif', canvasWidth: 128, canvasHeight: 64,
        scaleX: 1, scaleY: 0.5,
      });
      sprite.acquire({
        text: '+100g', textColor: '#fff', strokeColor: '#000', strokeWidth: 2,
        font: 'bold 24px sans-serif', canvasWidth: 128, canvasHeight: 64,
        scaleX: 1, scaleY: 0.5,
      });
      expect(sprite.activeCount()).toBe(2);
      expect(sprite.textureCacheSize()).toBe(2);

      sprite.dispose();

      expect(sprite.activeCount()).toBe(0);
      expect(sprite.freeCount()).toBe(0);
      expect(sprite.textureCacheSize()).toBe(0);
    }
  });

  it('5-cycle restart with VFX pool: drains every time', () => {
    for (let i = 0; i < 5; i++) {
      const mat = new MaterialRegistryService();
      const geom = new GeometryRegistryService();
      const vfx = new VfxPoolService(mat, geom);
      vfx.acquireArc(8, 0xff0000, 0.6);
      vfx.acquireZone(2, 24, 0xff8800, 0.4);

      vfx.dispose();
      mat.dispose();
      geom.dispose();

      expect(vfx.arcActiveCount()).toBe(0);
      expect(vfx.arcFreeCount()).toBe(0);
      expect(vfx.zoneActiveCount()).toBe(0);
      expect(vfx.zoneFreeCount()).toBe(0);
    }
  });

  it('subsequent encounter materials are FRESH instances (cache truly cleared)', () => {
    const scene1 = new THREE.Scene();
    const registry1 = new BoardMeshRegistryService();
    const geom1 = new GeometryRegistryService();
    const mat1 = new MaterialRegistryService();
    const pool1 = new TerraformMaterialPoolService();
    const sprite1 = new TextSpritePoolService();
    const vfx1 = new VfxPoolService(mat1, geom1);
    const gb1 = new GameBoardService(pool1, geom1, mat1);
    gb1.importBoard(buildBoard(5, 5), 5, 5);
    simulateRender(gb1, registry1, scene1);
    const e1Material = registry1.tileInstanceLayers.get(BlockType.BASE)!.mesh.material;
    simulateCleanup(registry1, geom1, mat1, pool1, sprite1, vfx1, scene1);

    // Fresh services for encounter 2.
    const scene2 = new THREE.Scene();
    const registry2 = new BoardMeshRegistryService();
    const geom2 = new GeometryRegistryService();
    const mat2 = new MaterialRegistryService();
    const pool2 = new TerraformMaterialPoolService();
    const gb2 = new GameBoardService(pool2, geom2, mat2);
    gb2.importBoard(buildBoard(5, 5), 5, 5);
    simulateRender(gb2, registry2, scene2);
    const e2Material = registry2.tileInstanceLayers.get(BlockType.BASE)!.mesh.material;

    expect(e2Material).not.toBe(e1Material);
    // Cleanup encounter 2.
    simulateCleanup(registry2, geom2, mat2, pool2, new TextSpritePoolService(), new VfxPoolService(mat2, geom2), scene2);
  });
});
