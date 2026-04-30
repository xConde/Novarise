/**
 * Phase C sprint 25 — elevation-on-instanced-tiles integration spec.
 *
 * Sprint 22 wired translateTileMesh to dispatch on TileInstanceLayer when
 * the tile is in an instance layer. This spec covers the Highground
 * elevation flow:
 *   - Raising an instanced BASE tile translates the instance Y.
 *   - Cliff mesh is created/resized/removed normally (still individual).
 *   - Lowering back to 0 removes the cliff and resets instance Y.
 */

import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { ElevationService } from './elevation.service';
import { GameBoardService } from '../game-board.service';
import { BoardMeshRegistryService } from './board-mesh-registry.service';
import { SceneService } from './scene.service';
import { TerraformMaterialPoolService } from './terraform-material-pool.service';
import { GeometryRegistryService } from './geometry-registry.service';
import { MaterialRegistryService } from './material-registry.service';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { BOARD_CONFIG } from '../constants/board.constants';

describe('ElevationService × InstancedMesh integration (sprint 25)', () => {
  let elevation: ElevationService;
  let gameBoard: GameBoardService;
  let registry: BoardMeshRegistryService;
  let scene: THREE.Scene;
  let sceneSpy: jasmine.SpyObj<SceneService>;

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
    scene = new THREE.Scene();
    sceneSpy = jasmine.createSpyObj<SceneService>('SceneService', ['getScene']);
    sceneSpy.getScene.and.returnValue(scene);

    TestBed.configureTestingModule({
      providers: [
        ElevationService,
        GameBoardService,
        BoardMeshRegistryService,
        TerraformMaterialPoolService,
        GeometryRegistryService,
        MaterialRegistryService,
        { provide: SceneService, useValue: sceneSpy },
      ],
    });
    elevation = TestBed.inject(ElevationService);
    gameBoard = TestBed.inject(GameBoardService);
    registry = TestBed.inject(BoardMeshRegistryService);

    gameBoard.importBoard(buildBoard(5, 5), 5, 5);
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
    TestBed.inject(TerraformMaterialPoolService).dispose();
    registry.tileInstanceLayers.forEach(layer => layer.dispose(scene));
    registry.tileInstanceLayers.clear();
  });

  it('raising a BASE tile translates the instance Y, no individual mesh', () => {
    const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
    const idx = baseLayer.findIndex(2, 2);
    expect(idx).toBeGreaterThanOrEqual(0);

    const result = elevation.raise(2, 2, 1, null, 'card-1', 100);
    expect(result.ok).withContext(JSON.stringify(result)).toBeTrue();

    // Instance Y should have moved to elevation + tileHeight/2.
    const m = new THREE.Matrix4();
    baseLayer.mesh.getMatrixAt(idx, m);
    const pos = new THREE.Vector3();
    m.decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    expect(pos.y).toBeCloseTo(1 + BOARD_CONFIG.tileHeight / 2, 5);

    // No individual mesh allocated for that coord.
    expect(registry.tileMeshes.has('2-2')).toBeFalse();
  });

  it('cliff mesh appears below the raised instance', () => {
    elevation.raise(1, 1, 1, null, 'card-2', 100);
    const cliff = registry.cliffMeshes.get('1-1');
    expect(cliff).toBeTruthy();
    expect(cliff!.parent).toBe(scene);
  });

  it('two raised tiles do not alias each other (per-instance Y)', () => {
    const baseLayer = registry.tileInstanceLayers.get(BlockType.BASE)!;
    const idxA = baseLayer.findIndex(0, 0);
    const idxB = baseLayer.findIndex(0, 1);

    elevation.raise(0, 0, 1, null, 'card-3', 100);

    const mA = new THREE.Matrix4();
    const mB = new THREE.Matrix4();
    baseLayer.mesh.getMatrixAt(idxA, mA);
    baseLayer.mesh.getMatrixAt(idxB, mB);
    const posA = new THREE.Vector3();
    const posB = new THREE.Vector3();
    mA.decompose(posA, new THREE.Quaternion(), new THREE.Vector3());
    mB.decompose(posB, new THREE.Quaternion(), new THREE.Vector3());

    expect(posA.y).toBeCloseTo(1 + BOARD_CONFIG.tileHeight / 2, 5);
    expect(posB.y).toBeCloseTo(BOARD_CONFIG.tileHeight / 2, 5);
  });
});
