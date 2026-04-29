/**
 * Phase C merge-readiness — Highground elevation × mutation × expiry.
 *
 * The sprint 30 red-team caught a HIGH bug: setElevationAt did not
 * update basePos[idx].y, so the sequence "elevate → mutate → mutation
 * expires" snapped the tile back to ground level. setElevationAt now
 * tracks elevation history; this spec covers the full lifecycle end-
 * to-end with REAL services to verify the just-fixed code path.
 *
 * Closest-to-WebGL coverage we can get from headless: assert the
 * actual matrix Y after each phase of the cycle.
 */

import * as THREE from 'three';
import { ElevationService } from './elevation.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { SceneService } from './scene.service';
import { PathMutationService } from './path-mutation.service';
import { PathfindingService } from './pathfinding.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { BOARD_CONFIG } from '../constants/board.constants';

describe('Highground elevation × mutation × expiry cycle (merge-readiness)', () => {
  let elevation: ElevationService;
  let pathMutation: PathMutationService;
  let gameBoard: GameBoardService;
  let registry: BoardMeshRegistryService;
  let sceneSpy: jasmine.SpyObj<SceneService>;
  let scene: THREE.Scene;
  let geomReg: GeometryRegistryService;
  let matReg: MaterialRegistryService;
  let pool: TerraformMaterialPoolService;

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

  function readInstanceY(layer: import('./tile-instance-layer').TileInstanceLayer, row: number, col: number): number {
    const idx = layer.findIndex(row, col);
    expect(idx).withContext(`(${row},${col}) must be in layer`).toBeGreaterThanOrEqual(0);
    const m = new THREE.Matrix4();
    layer.mesh.getMatrixAt(idx, m);
    const pos = new THREE.Vector3();
    m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    return pos.y;
  }

  beforeEach(() => {
    scene = new THREE.Scene();
    sceneSpy = jasmine.createSpyObj<SceneService>('SceneService', ['getScene']);
    sceneSpy.getScene.and.returnValue(scene);
    geomReg = new GeometryRegistryService();
    matReg = new MaterialRegistryService();
    pool = new TerraformMaterialPoolService();
    registry = new BoardMeshRegistryService();
    gameBoard = new GameBoardService(pool, geomReg, matReg);
    gameBoard.importBoard(buildBoard(5, 5), 5, 5);

    elevation = new ElevationService(gameBoard, registry, sceneSpy, pool, geomReg);
    const pathfinding = new PathfindingService(gameBoard);
    pathMutation = new PathMutationService(gameBoard, registry, pathfinding, pool, geomReg, matReg);

    const baseLayer = gameBoard.buildTileInstanceLayer(BlockType.BASE);
    if (baseLayer) {
      registry.tileInstanceLayers.set(BlockType.BASE, baseLayer);
      scene.add(baseLayer.mesh);
      registry.rebuildTilePickables();
    }
  });

  afterEach(() => {
    matReg.dispose();
    geomReg.dispose();
    pool.dispose();
    registry.tileInstanceLayers.forEach(layer => layer.dispose(scene));
    registry.tileInstanceLayers.clear();
  });

  it('full cycle: elevate → mutate → mutation expiry → instance returns to ELEVATED Y (sprint 30 fix)', () => {
    const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
    const groundY = BOARD_CONFIG.tileHeight / 2;
    const elevatedY = 1 + BOARD_CONFIG.tileHeight / 2;

    // (1) Initial: instance at ground Y.
    expect(readInstanceY(baseLayer, 2, 2)).toBeCloseTo(groundY, 5);

    // (2) Elevate: instance Y moves up.
    elevation.raise(2, 2, 1, null, 'card-r1', 1);
    expect(readInstanceY(baseLayer, 2, 2)).toBeCloseTo(elevatedY, 5);

    // (3) Mutate (build): instance hides (scale 0), overlay is created.
    pathMutation.swapMesh(2, 2, BlockType.BASE, scene, 'build');
    expect(baseLayer.lookupCoord(baseLayer.findIndex(2, 2))).toBeNull();
    const overlay = registry.tileMeshes.get('2-2');
    expect(overlay).toBeTruthy();

    // (4) Revert (mutation expires): overlay disposed, instance shown again.
    pathMutation.swapMesh(2, 2, BlockType.BASE, scene);
    expect(registry.tileMeshes.has('2-2')).toBeFalse();
    expect(baseLayer.lookupCoord(baseLayer.findIndex(2, 2))).toEqual({ row: 2, col: 2 });

    // (5) CRITICAL: instance is back at ELEVATED Y, not ground Y.
    // Pre-fix, this would have snapped to groundY because basePos was never updated.
    const yAfter = readInstanceY(baseLayer, 2, 2);
    expect(yAfter)
      .withContext(`expected elevated Y ${elevatedY} after mutation expiry, got ${yAfter}`)
      .toBeCloseTo(elevatedY, 5);
  });

  it('cliff column persists through mutation cycle on elevated tile', () => {
    elevation.raise(1, 1, 1, null, 'card-r2', 1);
    expect(registry.cliffMeshes.has('1-1')).toBeTrue();

    pathMutation.swapMesh(1, 1, BlockType.BASE, scene, 'build');
    expect(registry.cliffMeshes.has('1-1'))
      .withContext('cliff should persist while mutation is active on the raised tile')
      .toBeTrue();

    pathMutation.swapMesh(1, 1, BlockType.BASE, scene);
    expect(registry.cliffMeshes.has('1-1'))
      .withContext('cliff should still be present after mutation expiry')
      .toBeTrue();
  });

  it('two raised tiles where one mutates+expires: sibling stays at correct Y', () => {
    const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
    const elevatedY = 1 + BOARD_CONFIG.tileHeight / 2;

    elevation.raise(0, 0, 1, null, 'card-a', 1);
    elevation.raise(0, 1, 1, null, 'card-b', 1);

    // Mutate + revert tile (0,0). Tile (0,1) should be untouched.
    pathMutation.swapMesh(0, 0, BlockType.BASE, scene, 'build');
    pathMutation.swapMesh(0, 0, BlockType.BASE, scene);

    expect(readInstanceY(baseLayer, 0, 0)).toBeCloseTo(elevatedY, 5);
    expect(readInstanceY(baseLayer, 0, 1))
      .withContext('sibling tile must not be affected by neighbour mutation cycle')
      .toBeCloseTo(elevatedY, 5);
  });
});
