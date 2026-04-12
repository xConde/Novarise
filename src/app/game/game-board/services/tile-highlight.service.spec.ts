import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { TileHighlightService } from './tile-highlight.service';
import { GameBoardService } from '../game-board.service';
import { GameStateService } from './game-state.service';
import { TILE_EMISSIVE } from '../constants/ui.constants';
import { BlockType, GameBoardTile } from '../models/game-board-tile';
import { TowerType } from '../models/tower.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMesh(row: number, col: number, type: BlockType = BlockType.BASE): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData['row'] = row;
  mesh.userData['col'] = col;
  mesh.userData['tile'] = { type };
  return mesh;
}

function makeTile(
  row: number,
  col: number,
  type: BlockType = BlockType.BASE,
  isPurchasable = true,
  towerType: TowerType | null = null
): GameBoardTile {
  const tile = new GameBoardTile(row, col, type, type !== BlockType.WALL, isPurchasable, 0, towerType);
  return tile;
}

function makeTileMeshes(specs: Array<{ row: number; col: number; type?: BlockType }>): Map<string, THREE.Mesh> {
  const map = new Map<string, THREE.Mesh>();
  for (const spec of specs) {
    const mesh = makeMesh(spec.row, spec.col, spec.type ?? BlockType.BASE);
    map.set(`${spec.row}-${spec.col}`, mesh);
  }
  return map;
}

function disposeMeshMap(meshes: Map<string, THREE.Mesh>): void {
  for (const mesh of meshes.values()) {
    mesh.geometry.dispose();
    (mesh.material as THREE.MeshStandardMaterial).dispose();
  }
}

// ---------------------------------------------------------------------------
// TileHighlightService
// ---------------------------------------------------------------------------

describe('TileHighlightService', () => {
  let service: TileHighlightService;
  let boardSpy: jasmine.SpyObj<GameBoardService>;
  let stateSpy: jasmine.SpyObj<GameStateService>;
  let scene: THREE.Scene;

  beforeEach(() => {
    boardSpy = jasmine.createSpyObj<GameBoardService>(
      'GameBoardService',
      ['getGameBoard', 'getBoardWidth', 'getBoardHeight', 'getTileSize']
    );
    stateSpy = jasmine.createSpyObj<GameStateService>(
      'GameStateService',
      ['canAfford']
    );

    boardSpy.getBoardWidth.and.returnValue(5);
    boardSpy.getBoardHeight.and.returnValue(5);
    boardSpy.getTileSize.and.returnValue(1);

    TestBed.configureTestingModule({
      providers: [
        TileHighlightService,
        { provide: GameBoardService, useValue: boardSpy },
        { provide: GameStateService, useValue: stateSpy },
      ],
    });
    service = TestBed.inject(TileHighlightService);
    scene = new THREE.Scene();
  });

  afterEach(() => {
    scene.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // updateHighlights
  // ---------------------------------------------------------------------------

  describe('updateHighlights', () => {
    it('marks affordable BASE tiles as highlighted', () => {
      const board = [
        [makeTile(0, 0), makeTile(0, 1)],
        [makeTile(1, 0), makeTile(1, 1)],
      ];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([
        { row: 0, col: 0 }, { row: 0, col: 1 },
        { row: 1, col: 0 }, { row: 1, col: 1 },
      ]);

      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeTrue();
      expect(service.isHighlighted('0-1')).toBeTrue();
      expect(service.isHighlighted('1-0')).toBeTrue();
      expect(service.isHighlighted('1-1')).toBeTrue();

      disposeMeshMap(tileMeshes);
    });

    it('applies emissive color to affordable tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBeGreaterThan(0);
      expect(mesh.userData['heatmapR']).toBeDefined();
      expect(mesh.userData['heatmapG']).toBeDefined();
      expect(mesh.userData['heatmapB']).toBeDefined();
      expect(mesh.userData['heatmapIntensity']).toBeDefined();

      disposeMeshMap(tileMeshes);
    });

    it('dims emissive for unaffordable-but-valid tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(false); // cannot afford

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const expectedIntensity = TILE_EMISSIVE.validPlacement * TILE_EMISSIVE.unaffordableDimming;
      expect(mat.emissiveIntensity).toBeCloseTo(expectedIntensity, 5);

      disposeMeshMap(tileMeshes);
    });

    it('skips the selected tile', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, { row: 0, col: 0 }, scene, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();

      disposeMeshMap(tileMeshes);
    });

    it('skips non-BASE tiles', () => {
      const board = [[makeTile(0, 0, BlockType.WALL)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0, type: BlockType.WALL }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();

      disposeMeshMap(tileMeshes);
    });

    it('skips tiles with a tower already placed', () => {
      const board = [[makeTile(0, 0, BlockType.BASE, true, TowerType.BASIC)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeFalse();

      disposeMeshMap(tileMeshes);
    });
  });

  // ---------------------------------------------------------------------------
  // clearHighlights
  // ---------------------------------------------------------------------------

  describe('clearHighlights', () => {
    it('restores original emissive values on all highlighted tiles', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeTrue();

      service.clearHighlights(tileMeshes, scene);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.base);
      expect(service.isHighlighted('0-0')).toBeFalse();
      expect(mesh.userData['heatmapR']).toBeUndefined();

      disposeMeshMap(tileMeshes);
    });

    it('clears the highlightedTiles set', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);
      service.clearHighlights(tileMeshes, scene);

      expect(service.getHighlightedTiles().size).toBe(0);

      disposeMeshMap(tileMeshes);
    });
  });

  // ---------------------------------------------------------------------------
  // restoreAfterHover
  // ---------------------------------------------------------------------------

  describe('restoreAfterHover', () => {
    it('restores highlight emissive when tile is highlighted', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      const mesh = tileMeshes.get('0-0')!;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      // Simulate hover by bumping emissiveIntensity
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBeCloseTo(mesh.userData['heatmapIntensity'], 5);

      disposeMeshMap(tileMeshes);
    });

    it('restores BASE emissive when tile is not highlighted', () => {
      const mesh = makeMesh(1, 1, BlockType.BASE);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.base);

      mesh.geometry.dispose();
      mat.dispose();
    });

    it('restores WALL emissive when tile is not highlighted', () => {
      const mesh = makeMesh(1, 1, BlockType.WALL);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.wall);

      mesh.geometry.dispose();
      mat.dispose();
    });

    it('restores special emissive for non-BASE/WALL types', () => {
      const mesh = makeMesh(1, 1, BlockType.SPAWNER);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = TILE_EMISSIVE.hover;

      service.restoreAfterHover(mesh);

      expect(mat.emissiveIntensity).toBe(TILE_EMISSIVE.special);

      mesh.geometry.dispose();
      mat.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // isHighlighted / getHighlightedTiles
  // ---------------------------------------------------------------------------

  describe('isHighlighted', () => {
    it('returns false for unhighlighted key', () => {
      expect(service.isHighlighted('2-3')).toBeFalse();
    });

    it('returns true after highlighting', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.isHighlighted('0-0')).toBeTrue();

      disposeMeshMap(tileMeshes);
    });
  });

  describe('getHighlightedTiles', () => {
    it('returns a ReadonlySet', () => {
      expect(service.getHighlightedTiles()).toEqual(jasmine.any(Set));
    });

    it('reflects current highlight state', () => {
      const board = [[makeTile(0, 0)]];
      boardSpy.getGameBoard.and.returnValue(board);
      stateSpy.canAfford.and.returnValue(true);

      const tileMeshes = makeTileMeshes([{ row: 0, col: 0 }]);
      service.updateHighlights(TowerType.BASIC, tileMeshes, null, scene, 1);

      expect(service.getHighlightedTiles().has('0-0')).toBeTrue();
      expect(service.getHighlightedTiles().size).toBe(1);

      disposeMeshMap(tileMeshes);
    });
  });
});
